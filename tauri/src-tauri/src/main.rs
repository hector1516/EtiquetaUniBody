#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process::{Child, Command};
use std::sync::Mutex;
use tauri::{Emitter, Manager, State, WindowEvent};
use tauri::menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder};
use tauri::tray::TrayIconBuilder;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

const BACKEND_BIN: &str = "etiqueta-backend-x86_64-pc-windows-msvc.exe";

#[cfg(target_os = "windows")]
mod job_object {
    use std::ffi::c_void;
    use std::os::windows::io::RawHandle;
    type HANDLE = *mut c_void; type BOOL = i32;
    #[repr(C)] #[allow(non_snake_case)] struct JOBOBJECT_BASIC_LIMIT_INFORMATION { per_process_user_time_limit: i64, per_job_user_time_limit: i64, limit_flags: u32, minimum_working_set_size: usize, maximum_working_set_size: usize, active_process_limit: u32, affinity: usize, priority_class: u32, scheduling_class: u32 }
    #[repr(C)] #[allow(non_snake_case)] struct IO_COUNTERS { read_operation_count: u64, write_operation_count: u64, other_operation_count: u64, read_transfer_count: u64, write_transfer_count: u64, other_transfer_count: u64 }
    #[repr(C)] #[allow(non_snake_case)] struct JOBOBJECT_EXTENDED_LIMIT_INFORMATION { basic_limit_information: JOBOBJECT_BASIC_LIMIT_INFORMATION, io_info: IO_COUNTERS, process_memory_limit: usize, job_memory_limit: usize, peak_process_memory_used: usize, peak_job_memory_used: usize }
    const JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE: u32 = 0x2000;
    const JOB_OBJECT_EXTENDED_LIMIT_INFORMATION_CLASS: i32 = 9;
    extern "system" { fn CreateJobObjectW(lpJobAttributes: *mut c_void, lpName: *const u16) -> HANDLE; fn SetInformationJobObject(hJob: HANDLE, JobObjectInformationClass: i32, lpJobObjectInformation: *const c_void, cbJobObjectInformationLength: u32) -> BOOL; fn AssignProcessToJobObject(hJob: HANDLE, hProcess: HANDLE) -> BOOL; fn CloseHandle(hObject: HANDLE) -> BOOL; }
    pub struct Job(HANDLE);
    unsafe impl Send for Job {} unsafe impl Sync for Job {}
    impl Job {
        pub fn create() -> Option<Self> { unsafe { let handle = CreateJobObjectW(std::ptr::null_mut(), std::ptr::null()); if handle.is_null() { return None; } let mut info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = std::mem::zeroed(); info.basic_limit_information.limit_flags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE; let res = SetInformationJobObject(handle, JOB_OBJECT_EXTENDED_LIMIT_INFORMATION_CLASS, &info as *const _ as *const c_void, std::mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32); if res == 0 { CloseHandle(handle); return None; } Some(Job(handle)) } }
        pub fn assign_process(&self, process_handle: RawHandle) -> bool { unsafe { AssignProcessToJobObject(self.0, process_handle as HANDLE) != 0 } }
    }
    impl Drop for Job { fn drop(&mut self) { unsafe { if !self.0.is_null() { CloseHandle(self.0); } } } }
}

struct BackendChild { child: Child, #[cfg(target_os = "windows")] _job: Option<job_object::Job> }
struct Backend(Mutex<Option<BackendChild>>);

fn backend_path(app: &tauri::AppHandle) -> Option<std::path::PathBuf> {
    use tauri::path::BaseDirectory;
    for path_str in &[format!("binaries/{BACKEND_BIN}"), BACKEND_BIN.to_string(), format!("resources/binaries/{BACKEND_BIN}")] {
        if let Ok(p) = app.path().resolve(path_str, BaseDirectory::Resource) { if p.exists() { return Some(p); } }
    }
    if let Ok(exe) = std::env::current_exe() {
        let mut dir = exe.parent().map(|p| p.to_path_buf());
        for _ in 0..6 {
            if let Some(d) = dir.clone() {
                for cand in [d.join(BACKEND_BIN), d.join(format!("binaries/{BACKEND_BIN}")), d.join(format!("resources/{BACKEND_BIN}")), d.join(format!("resources/binaries/{BACKEND_BIN}"))] {
                    if cand.exists() { return Some(cand); }
                }
                dir = d.parent().map(|p| p.to_path_buf());
            }
        }
    }
    if let Ok(cwd) = std::env::current_dir() {
        for cand in [cwd.join(BACKEND_BIN), cwd.join(format!("binaries/{BACKEND_BIN}")), cwd.join(format!("../binaries/{BACKEND_BIN}"))] {
            if cand.exists() { return Some(cand); }
        }
    }
    None
}

fn kill_backend(state: &State<Backend>) {
    let mut guard = match state.0.lock() { Ok(g) => g, Err(_) => return };
    if let Some(mut backend) = guard.take() {
        let pid = backend.child.id();
        #[cfg(target_os = "windows")] { let _ = Command::new("taskkill").args(["/F", "/T", "/PID", &pid.to_string()]).creation_flags(0x08000000).status(); }
        let _ = backend.child.kill(); let _ = backend.child.wait();
    }
}

#[tauri::command]
fn quit_app(app: tauri::AppHandle, state: State<Backend>) {
    kill_backend(&state);
    app.exit(0);
}

fn main() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(Backend(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![quit_app])
        .setup(|app| {
            // Native menu bar (Apple HIG desktop)
            let about_item = PredefinedMenuItem::about(app, Some("Acerca de EtiquetaUniBody"), None).unwrap();
            let settings_item = MenuItemBuilder::with_id("settings", "Configuración…").accelerator("CmdOrCtrl+,").build(app).unwrap();
            let quit_item = PredefinedMenuItem::quit(app, Some("Salir")).unwrap();
            let app_menu = SubmenuBuilder::new(app, "EtiquetaUniBody")
                .items(&[&about_item, &PredefinedMenuItem::separator(app).unwrap(), &settings_item, &PredefinedMenuItem::separator(app).unwrap(), &quit_item])
                .build().unwrap();

            let reload_item = MenuItemBuilder::with_id("reload", "Recargar").accelerator("CmdOrCtrl+R").build(app).unwrap();
            let fullscreen_item = MenuItemBuilder::with_id("fullscreen", "Pantalla completa").accelerator("F11").build(app).unwrap();
            let view_menu = SubmenuBuilder::new(app, "Ver")
                .items(&[&reload_item, &PredefinedMenuItem::separator(app).unwrap(), &fullscreen_item])
                .build().unwrap();

            let minimize_item = PredefinedMenuItem::minimize(app, Some("Minimizar")).unwrap();
            let maximize_item = PredefinedMenuItem::maximize(app, Some("Maximizar")).unwrap();
            let close_item = PredefinedMenuItem::close_window(app, Some("Cerrar")).unwrap();
            let window_menu = SubmenuBuilder::new(app, "Ventana")
                .items(&[&minimize_item, &maximize_item, &PredefinedMenuItem::separator(app).unwrap(), &close_item])
                .build().unwrap();

            let help_item = MenuItemBuilder::with_id("help", "Ayuda de EtiquetaUniBody").build(app).unwrap();
            let help_menu = SubmenuBuilder::new(app, "Ayuda")
                .items(&[&help_item])
                .build().unwrap();

            let menu = MenuBuilder::new(app)
                .items(&[&app_menu, &view_menu, &window_menu, &help_menu])
                .build().unwrap();
            app.set_menu(menu).unwrap();

            // System tray (Apple HIG: app lives in menu bar, close hides to tray)
            let show_item = MenuItemBuilder::with_id("tray_show", "Mostrar EtiquetaUniBody").build(app).unwrap();
            let quit_item = MenuItemBuilder::with_id("tray_quit", "Salir").build(app).unwrap();
            let tray_menu = MenuBuilder::new(app)
                .items(&[&show_item, &PredefinedMenuItem::separator(app).unwrap(), &quit_item])
                .build().unwrap();

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&tray_menu)
                .show_menu_on_left_click(true)
                .on_menu_event(|app, event| {
                    match event.id().as_ref() {
                        "tray_show" => {
                            if let Some(w) = app.get_webview_window("main") {
                                let _ = w.show();
                                let _ = w.unminimize();
                                let _ = w.set_focus();
                            }
                        }
                        "tray_quit" => {
                            let _ = app.emit("tray:quit-request", ());
                        }
                        _ => {}
                    }
                })
                .build(app)
                .unwrap();

            app.on_menu_event(|app, event| {
                match event.id().as_ref() {
                    "settings" => { let _ = app.emit("menu:navigate", "settings"); }
                    "reload" => { if let Some(w) = app.get_webview_window("main") { let _ = w.eval("window.location.reload()"); } }
                    "fullscreen" => { if let Some(w) = app.get_webview_window("main") { let _ = w.set_fullscreen(!w.is_fullscreen().unwrap_or(false)); } }
                    _ => {}
                }
            });

            #[cfg(target_os = "windows")] { let _ = Command::new("taskkill").args(["/F", "/IM", BACKEND_BIN]).creation_flags(0x08000000).status(); }
            if let Some(path) = backend_path(app.handle()) {
                let mut cmd = Command::new(&path);
                #[cfg(target_os = "windows")] cmd.creation_flags(0x08000000);
                match cmd.spawn() {
                    Ok(child) => {
                        #[cfg(target_os = "windows")] let job = { use std::os::windows::io::AsRawHandle; if let Some(job) = job_object::Job::create() { job.assign_process(child.as_raw_handle()); Some(job) } else { None } };
                        *app.state::<Backend>().0.lock().unwrap() = Some(BackendChild { child, #[cfg(target_os = "windows")] _job: job });
                    }
                    Err(e) => eprintln!("[backend] no se pudo arrancar: {e}"),
                }
            } else { eprintln!("[backend] no encontrado; arrancalo manual: uvicorn App.python.main:app"); }
            match app.get_webview_window("main") {
                Some(window) => { let _ = window.show(); let _ = window.unminimize(); let _ = window.set_focus(); }
                None => {}
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() == "main" {
                match event {
                    WindowEvent::CloseRequested { api, .. } => {
                        // Apple HIG desktop: close minimizes to tray (menu bar) instead of quitting
                        api.prevent_close();
                        let _ = window.hide();
                    }
                    WindowEvent::Destroyed => {
                        kill_backend(&window.state::<Backend>());
                    }
                    _ => {}
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("error building EtiquetaUniBody");
    app.run(|app_handle, event| match event { tauri::RunEvent::ExitRequested { .. } | tauri::RunEvent::Exit => { kill_backend(&app_handle.state::<Backend>()); } _ => {} });
}
