#[cfg(target_os = "macos")]
#[tauri::command]
pub async fn pick_screen_color(app: tauri::AppHandle) -> Result<Option<[f64; 3]>, String> {
    use block2::RcBlock;
    use objc2_app_kit::{NSColor, NSColorSampler, NSColorSpace};
    use std::cell::RefCell;

    let (sender, receiver) = tokio::sync::oneshot::channel();
    app.run_on_main_thread(move || {
        let sender = RefCell::new(Some(sender));
        let handler = RcBlock::new(move |color: *mut NSColor| {
            // AppKit calls this block on the main thread with a valid color, or nil on Escape.
            let sampled = unsafe { color.as_ref() }
                .and_then(|color| color.colorUsingColorSpace(&NSColorSpace::sRGBColorSpace()))
                .map(|color| {
                    [
                        color.redComponent().clamp(0.0, 1.0),
                        color.greenComponent().clamp(0.0, 1.0),
                        color.blueComponent().clamp(0.0, 1.0),
                    ]
                });
            if let Some(sender) = sender.borrow_mut().take() {
                let _ = sender.send(sampled);
            }
        });
        // AppKit retains the sampler and copies its handler until the session ends.
        unsafe { NSColorSampler::new().showSamplerWithSelectionHandler(&handler) };
    })
    .map_err(|_| "Could not open the screen color sampler.".to_string())?;
    receiver
        .await
        .map_err(|_| "The screen color sampler closed unexpectedly.".to_string())
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
pub async fn pick_screen_color() -> Result<Option<[f64; 3]>, String> {
    Err("Screen color sampling is unavailable on this platform.".to_string())
}
