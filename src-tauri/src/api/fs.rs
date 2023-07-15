// fs redirects std::fs to tauri commands

use tauri::{
    plugin::{Builder, TauriPlugin},
    Runtime,
};

#[tauri::command]
pub fn read_dir(path: String) -> Vec<String> {
    let mut result = Vec::new();
    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries {
            if let Ok(entry) = entry {
                result.push(entry.path().to_str().unwrap().to_string());
            }
        }
    }
    result
}

#[tauri::command]
pub fn remove_file(path: String) -> Result<(), String> {
    std::fs::remove_file(path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn remove_dir(path: String) -> Result<(), String> {
    std::fs::remove_dir(path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn make_dir(path: String) -> Result<(), String> {
    std::fs::create_dir_all(path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn remove_all(path: String) -> Result<(), String> {
    if std::path::Path::new(&path).is_dir() {
        return std::fs::remove_dir_all(path).map_err(|e| e.to_string());
    }
    std::fs::remove_file(path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn read_text_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn write_text_file(path: String, content: String) -> Result<(), String> {
    std::fs::write(path, content).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn exists(path: String) -> bool {
    std::path::Path::new(&path).exists()
}

#[tauri::command]
pub fn rename(from: String, to: String) -> Result<(), String> {
    std::fs::rename(from, to).map_err(|e| e.to_string())
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("fs")
        .invoke_handler(tauri::generate_handler![
            read_dir,
            remove_file,
            remove_dir,
            make_dir,
            remove_all,
            read_text_file,
            write_text_file,
            exists,
            rename,
        ])
        .build()
}
