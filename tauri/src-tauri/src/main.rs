#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process::{Child, Command};
use std::sync::Mutex;
use tauri::{Manager, State, WindowEvent};

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

fn main() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(Backend(Mutex::new(None)))
        .setup(|app| {
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
        .on_window_event(|window, event| { if window.label() == "main" && matches!(event, WindowEvent::Destroyed) { kill_backend(&window.state::<Backend>()); } })
        .build(tauri::generate_context!())
        .expect("error building EtiquetaUniBody");
    app.run(|app_handle, event| match event { tauri::RunEvent::ExitRequested { .. } | tauri::RunEvent::Exit => { kill_backend(&app_handle.state::<Backend>()); } _ => {} });
}
