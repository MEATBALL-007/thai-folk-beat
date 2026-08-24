// Hide the console window in release builds — a double-clicked .exe should not
// open a terminal behind the game (spec: "a Windows .exe the user can double-click").
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running THAI FOLK BEAT");
}
