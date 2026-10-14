# Blender assets for OpenPencil

Apply this guidance when using Blender through an external tool. Choose settings for the requested look and intended placement, without requiring a brief or approval of routine rendering choices.

## Choose the rendering engine

- For stylized, cartoon-like, toy-like or illustrative scenes, start with Eevee and enable its ray tracing when supported. Do not default to Cycles for simple asset generation. Inspect lighting, reflections, shadows and silhouettes at the intended display size before increasing render cost.
- Use Cycles when the requested result needs its lighting or material fidelity. Select an available GPU backend, enable the compatible GPU device, and set the scene to GPU Compute. Choosing Cycles alone does not enable GPU rendering.
- Inspect the running Blender version and actual device availability before changing settings. On supported Apple hardware, use Metal; elsewhere choose a supported backend for the detected GPU. Verify the effective backend, enabled device and scene device setting before the final render. Do not assume a property name or GPU backend exists in every Blender version.
- Do not silently fall back to a long CPU Cycles render. If GPU rendering is unavailable or fails, use Eevee when it can satisfy the requested look; otherwise explain the limitation before starting an expensive CPU render. Do not save global Blender preferences or change unrelated scenes to configure this task.

## Render final assets at 2×

- Determine the image's intended size in OpenPencil layout pixels first. Render final assets at twice that width and twice that height, rounded up to whole pixels. For example, a 600 × 400 image area needs a 1200 × 800 render, while its OpenPencil frame remains 600 × 400.
- Use actual render resolution, not an upscaled smaller image. Set output resolution percentage to 100% after setting the doubled dimensions, use square pixels, and check that a leftover render region or crop does not reduce the intended output. Canvas zoom does not change the target resolution.
- If the final placement grows, render again at the appropriate 2× dimensions. Lower-resolution previews are useful during iteration, but keep them clearly identified and separate from the final file. Never import a preview as the finished asset.
- Keep iteration inexpensive: preview camera, composition, materials and lighting before the final render. Use supported denoising and adaptive sampling where appropriate, and increase samples or scene complexity only to fix a visible issue. Do not launch overlapping renders or repeatedly rerender an unchanged scene.

## Deliver and verify the original

Save the final render as PNG, with alpha when the asset needs transparency, inside the import tool's allowed directory. Verify the file's actual dimensions, format and successful completion; a filename or render-start response is not proof of a finished render. If an import size limit is exceeded, try lossless PNG compression or explain the limit rather than silently reducing the 2× resolution.

Use `import_image` with the final file path and target frame ID. Preserve the intended logical frame size, children and scrim fills. Do not pass a screenshot, thumbnail, viewport capture or compressed model-vision preview as the final render. Check the source receipt and placed result. Briefly report the engine, GPU backend when applicable, final pixel dimensions and any unresolved limitation.
