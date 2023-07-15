#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

mod api;

fn main() {
    tauri::Builder::default()
        .plugin(api::fs::init())
        .plugin(api::baidu_pcs::init())
        .plugin(api::http::init())
        .plugin(api::compress::init())
        .plugin(api::process::init())
        .plugin(api::crypto::init())
        .plugin(api::secrets::init())
        .plugin(api::os::init())
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
