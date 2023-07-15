use tauri::{
    plugin::{Builder, TauriPlugin},
    Runtime,
};

use super::utils::command;

static _7Z: &'static str = r"C:\Users\z\code\shadow\src-tauri\bin\7z.exe";

fn cmd(args: Vec<String>) -> Result<String, String> {
    command::cmd(_7Z, args)
}

#[tauri::command]
pub async fn extract(
    archive: &str,
    dst_dir: &str,
    password: Option<&str>,
    work_dir: Option<&str>,
) -> Result<(), String> {
    let mut args = vec![
        "x".to_string(),
        "-y".to_string(),
        archive.to_string(),
        format!("-o{}", dst_dir),
    ];

    if let Some(work_dir) = work_dir {
        args.push(format!("-w{}", work_dir));
    } else {
        args.push(format!("-w{}", dst_dir));
    }

    if let Some(password) = password {
        args.push(format!("-p{}", password));
    }

    cmd(args)?;
    Ok(())
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("compress")
        .invoke_handler(tauri::generate_handler![extract])
        .build()
}

#[cfg(test)]
mod test {
    use tauri::async_runtime::block_on;

    use super::extract;

    #[test]
    fn test_extract() {
        block_on(extract(
            "C:\\Users\\z\\local\\tmp\\test.zip",
            "C:\\Users\\z\\local\\tmp",
            None,
            None,
        ))
        .expect("extract failed")
    }
}
