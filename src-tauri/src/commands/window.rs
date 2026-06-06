//! Window and tray popup management commands.

use tauri::{AppHandle, Manager};

/// Label of the borderless tray popup window.
pub const TRAY_WINDOW: &str = "tray";

/// Hide the tray popup window (called by the tray UI after an action).
#[tauri::command]
pub fn hide_tray_window(app: AppHandle) {
    if let Some(window) = app.get_webview_window(TRAY_WINDOW) {
        let _ = window.hide();
    }
}

/// Bring the main window to the foreground and hide the tray popup.
#[tauri::command]
pub fn open_main_window(app: AppHandle) {
    if let Some(tray) = app.get_webview_window(TRAY_WINDOW) {
        let _ = tray.hide();
    }
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

/// Quit the whole application from the tray.
#[tauri::command]
pub fn quit_app(app: AppHandle) {
    app.exit(0);
}
