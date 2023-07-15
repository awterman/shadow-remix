use std::{
    collections::HashMap,
    io::{Read, Write},
    process::{Command, Stdio},
    sync::{Arc, Mutex},
};

use tauri::{
    async_runtime::{channel, spawn, Sender},
    plugin::{Builder, TauriPlugin},
    AppHandle, Manager, Runtime, State,
};

use shared_child::SharedChild;

macro_rules! event_name {
    ($pid:expr, $($tag:expr),*) => {
        {
            let mut event_name = "process:".to_string();
            $(
                event_name += &$tag;
                event_name += ":";
            )*
            event_name += &$pid.to_string();
            event_name
        }
    };
}

pub struct ProcessManager {
    children: Arc<Mutex<HashMap<String, Arc<SharedChild>>>>,
    stdin_senders: Arc<Mutex<HashMap<String, Sender<String>>>>,
}

impl ProcessManager {
    pub fn new() -> Self {
        Self {
            children: Arc::new(Mutex::new(HashMap::new())),
            stdin_senders: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    // create a child process, pipe stdin/stdout/stderr, emit events asynchronously, add the process to children, and return the pid
    pub fn create_process<R: Runtime>(
        &self,
        app: AppHandle<R>,
        program: &str,
        args: Vec<String>,
    ) -> Result<String, String> {
        let child = Command::new(program)
            .args(args)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| e.to_string())?;
        let child = SharedChild::new(child).map_err(|e| e.to_string())?;
        let child = Arc::new(child);

        let pid = child.id().to_string();

        let _pid = pid.clone();
        let _app = app.clone();
        let _child = child.clone();
        let mut stdout = _child.take_stdout().unwrap();
        spawn(async move {
            let mut buf = [0; 1024]; // read up to 1024 bytes at a time
            loop {
                match stdout.read(&mut buf) {
                    Ok(0) => {
                        _app.emit_all(&event_name!(&_pid, "stdout", "end"), Some(()))
                            .unwrap();
                        break; // end of stream
                    }
                    Ok(n) => {
                        let output = std::str::from_utf8(&buf[0..n]).unwrap().to_string();
                        _app.emit_all(&event_name!(&_pid, "stdout", "chunk"), Some(output))
                            .unwrap();
                    }
                    Err(e) => {
                        _app.emit_all(&event_name!(&_pid, "stdout", "error"), Some(e.to_string()))
                            .unwrap();
                        break;
                    }
                }
            }
        });

        let _app = app.clone();
        let _pid = pid.clone();
        let _child = child.clone();
        let mut stderr = _child.take_stderr().unwrap();
        spawn(async move {
            let mut buf = [0; 1024]; // read up to 1024 bytes at a time
            loop {
                match stderr.read(&mut buf) {
                    Ok(0) => {
                        _app.emit_all(&event_name!(&_pid, "stderr", "end"), Some(()))
                            .unwrap();
                        break; // end of stream
                    }
                    Ok(n) => {
                        let output = std::str::from_utf8(&buf[0..n]).unwrap().to_string();
                        _app.emit_all(&event_name!(&_pid, "stderr", "chunk"), Some(output))
                            .unwrap();
                    }
                    Err(e) => {
                        _app.emit_all(&event_name!(&_pid, "stderr", "error"), Some(e.to_string()))
                            .unwrap();
                        break;
                    }
                }
            }
        });

        let _app = app.clone();
        let _pid = pid.clone();
        let _child = child.clone();
        spawn(async move {
            let status = _child.wait().unwrap();
            _app.emit_all(&event_name!(&_pid, "exit"), Some(status.code()))
                .unwrap();
        });

        // TODO(try): create a channel to send stdin to the child process, and store the sender in the manager, to avoid the borrow and lifetime issues
        // TODO(try): run child in python/golang
        let (stdin_sender, mut stdin_receiver) = channel::<String>(1);

        let _child = child.clone();
        let mut stdin = _child.take_stdin().unwrap();
        spawn(async move {
            loop {
                match stdin_receiver.recv().await {
                    Some(data) => {
                        println!("stdin: {}", data);
                        stdin.write(data.as_bytes()).unwrap();
                    }
                    None => {
                        break;
                    }
                }
            }
        });

        self.children.lock().unwrap().insert(pid.clone(), child);
        self.stdin_senders
            .lock()
            .unwrap()
            .insert(pid.clone(), stdin_sender);

        Ok(pid.clone())
    }

    // write to stdin of a child process
    pub async fn write_stdin(&self, pid: &str, data: &str) -> Result<(), String> {
        let sender = {
            let senders = self.stdin_senders.lock().map_err(|e| e.to_string())?;
            senders.get(pid).ok_or("pid not found")?.clone()
        };

        sender
            .send(data.to_string())
            .await
            .map_err(|e| e.to_string())?;

        Ok(())
    }

    // kill a child process
    pub fn kill(&self, pid: &str) -> Result<(), String> {
        self.children
            .lock()
            .map_err(|e| e.to_string())?
            .get_mut(pid)
            .ok_or("pid not found")?
            .kill()
            .map_err(|e| e.to_string())?;
        Ok(())
    }
}

#[tauri::command]
pub async fn create<R: Runtime>(
    app: AppHandle<R>,
    program: String,
    args: Vec<String>,
    manager: State<'_, ProcessManager>,
) -> Result<String, String> {
    manager.create_process(app, &program, args)
}

#[tauri::command]
pub async fn write_stdin(
    pid: String,
    data: String,
    manager: State<'_, ProcessManager>,
) -> Result<(), String> {
    manager.write_stdin(&pid, &data).await
}

#[tauri::command]
pub async fn kill(pid: String, manager: State<'_, ProcessManager>) -> Result<(), String> {
    manager.kill(&pid)
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("process")
        .invoke_handler(tauri::generate_handler![create, write_stdin, kill])
        .setup(|app| {
            let manager = ProcessManager::new();
            app.manage(manager);
            Ok(())
        })
        .build()
}
