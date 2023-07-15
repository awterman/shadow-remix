use std::env;

use tauri::plugin::{Builder, TauriPlugin};
use tauri::Runtime;

#[tauri::command]
pub async fn get_current_exe() -> Result<String, String> {
    let current_exe = env::current_exe().map_err(|e| e.to_string())?;
    let path = current_exe.to_str().ok_or_else(|| String::from("Unable to retrieve binary path."))?;
    Ok(path.to_string())
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("os")
        .invoke_handler(tauri::generate_handler![get_current_exe])
        .build()
}