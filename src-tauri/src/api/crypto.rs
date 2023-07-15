use std::fs::File;
use std::io::{BufReader, Read};

use md5::{Digest, Md5};
use tauri::plugin::{Builder, TauriPlugin};
use tauri::Runtime;

#[tauri::command]
pub async fn md5sum(path: String) -> Result<String, String> {
    let file = File::open(path).map_err(|e| e.to_string())?;
    let mut buf_reader = BufReader::new(file);
    let mut hasher = Md5::new();
    let mut buffer = [0; 1024];

    loop {
        let bytes_read = buf_reader.read(&mut buffer).map_err(|e| e.to_string())?;
        if bytes_read == 0 {
            break;
        }
        hasher.update(&buffer[..bytes_read]);
    }

    let result = hasher.finalize();
    Ok(format!("{:x}", result))
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("crypto")
        .invoke_handler(tauri::generate_handler![md5sum])
        .build()
}
