use std::time::Duration;

use tauri::{
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, PhysicalPosition, Runtime, WebviewUrl, WebviewWindowBuilder,
    WindowEvent,
};

use crate::{auth::get_accounts_file, commands::window::TRAY_WINDOW};

const TRAY_ID: &str = "codex-switcher-tray";
const TRAY_REFRESH_EVENT: &str = "tray-refresh";
const ACCOUNTS_CHANGED_EVENT: &str = "accounts-changed";
const TRAY_WIDTH: f64 = 300.0;
const TRAY_HEIGHT: f64 = 420.0;

pub fn setup(app: &AppHandle) -> tauri::Result<()> {
    create_tray_window(app)?;

    let icon = app
        .default_window_icon()
        .cloned()
        .expect("application icon should be configured");

    TrayIconBuilder::with_id(TRAY_ID)
        .icon(icon)
        .tooltip("Codex Switcher")
        .on_tray_icon_event(handle_tray_icon_event)
        .build(app)?;

    watch_accounts_file(app.clone());
    Ok(())
}

fn create_tray_window<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    if app.get_webview_window(TRAY_WINDOW).is_some() {
        return Ok(());
    }

    let window = WebviewWindowBuilder::new(app, TRAY_WINDOW, WebviewUrl::App("tray.html".into()))
        .title("Codex Switcher")
        .inner_size(TRAY_WIDTH, TRAY_HEIGHT)
        .resizable(false)
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        .skip_taskbar(true)
        .visible(false)
        .build()?;

    // Hide the popup as soon as it loses focus so it behaves like a native menu.
    let app_handle = app.clone();
    window.on_window_event(move |event| {
        if let WindowEvent::Focused(false) = event {
            if let Some(window) = app_handle.get_webview_window(TRAY_WINDOW) {
                let _ = window.hide();
            }
        }
    });

    Ok(())
}

fn handle_tray_icon_event<R: Runtime>(tray: &tauri::tray::TrayIcon<R>, event: TrayIconEvent) {
    if let TrayIconEvent::Click {
        button: MouseButton::Left,
        button_state: MouseButtonState::Up,
        position,
        ..
    } = event
    {
        toggle_tray_window(tray.app_handle(), position);
    }
}

fn toggle_tray_window<R: Runtime>(app: &AppHandle<R>, cursor: PhysicalPosition<f64>) {
    let Some(window) = app.get_webview_window(TRAY_WINDOW) else {
        return;
    };

    if window.is_visible().unwrap_or(false) {
        let _ = window.hide();
        return;
    }

    position_near_cursor(&window, cursor);
    let _ = window.show();
    let _ = window.set_focus();
    let _ = app.emit_to(TRAY_WINDOW, TRAY_REFRESH_EVENT, ());
}

fn position_near_cursor<R: Runtime>(
    window: &tauri::WebviewWindow<R>,
    cursor: PhysicalPosition<f64>,
) {
    let size = window.outer_size().ok();
    let width = size.map(|s| s.width as f64).unwrap_or(TRAY_WIDTH);
    let height = size.map(|s| s.height as f64).unwrap_or(TRAY_HEIGHT);

    let x = (cursor.x - width / 2.0).max(0.0);
    // macOS menu bar sits at the top, so drop the popup below the icon.
    // Other platforms keep the tray at the bottom, so float it above the cursor.
    let y = if cfg!(target_os = "macos") {
        cursor.y + 4.0
    } else {
        (cursor.y - height - 4.0).max(0.0)
    };

    let _ = window.set_position(PhysicalPosition::new(x, y));
}

fn watch_accounts_file<R: Runtime>(app: AppHandle<R>) {
    std::thread::spawn(move || {
        let accounts_path = match get_accounts_file() {
            Ok(path) => path,
            Err(error) => {
                eprintln!("Failed to resolve accounts file for tray: {error}");
                return;
            }
        };
        let mut last_modified = modified_at(&accounts_path);

        loop {
            std::thread::sleep(Duration::from_secs(1));
            let modified = modified_at(&accounts_path);
            if modified != last_modified {
                last_modified = modified;
                let _ = app.emit(ACCOUNTS_CHANGED_EVENT, ());
            }
        }
    });
}

fn modified_at(path: &std::path::Path) -> Option<std::time::SystemTime> {
    path.metadata()
        .and_then(|metadata| metadata.modified())
        .ok()
}
