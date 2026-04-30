# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.0] - 2026-04-30

### Added

- ACE Step 1.5 music generation template (`ace_step_1_5`) with full control over tags, lyrics, BPM, key, and duration
- Wan 2.2 First-Last-Frame video template (`wan_flf_video`) for keyframe-based video transitions
- Wan 2.2 Text-to-Video template (`wan_t2v`) for direct prompt-to-video generation
- `comfy_generate_music` tool for simplified local music generation via ACE Step 1.5
- `comfy_keyframe_video` tool for generating smooth video transitions between two images
- `comfy_create_short` orchestrator tool for creating complete short videos with AI-generated visuals and music
- Two modes for `comfy_create_short`: "keyframe" (image->FLF transitions) and "t2v" (direct text-to-video)
- ffmpeg-based video+audio mux step in `comfy_create_short` for final combined MP4 output
- Sequential VRAM management in multi-modal pipelines (free memory between image/video/audio steps)
- Comprehensive documentation: `docs/USAGE.md`, `docs/TROUBLESHOOTING.md`, `docs/MODELS.md`
- 8 example workflow JSONs in `examples/workflows/` covering t2v, FLF, music, mux, hires fix, multi-LoRA, i2v, and audio chains

### Fixed

- `txt2img` template now properly passes `filename_prefix` parameter (was hardcoded to "ComfyUI")
- `comfy_apply_preset` memory leak (workflow not deleted after queuing)
- ACE Step 1.5 template: corrected KSampler cfg to 1.0 (guidance handled by TextEncoder cfg_scale)
- `package.json` version synced with CHANGELOG (was stuck at 2.0.0)

## [2.0.0] - 2026-04-30

### Added

- 57 MCP tools across 7 categories (discovery, workflow, generation, assets, queue, system, advanced)
- Programmatic workflow builder with node graph construction
- 13 built-in templates: txt2img, img2img, inpainting, upscale, controlnet, lora, sdxl, flux, stable_audio, wan_video, ltxv_video, ace_step_1_5, wan_flf_video
- Pipeline orchestration for chaining multiple workflows
- WebSocket-based real-time job progress tracking
- MCP resources for system info, nodes, models, and history
- MCP prompts for guided workflow creation
- Support for image, audio, and video generation
- Model discovery with metadata reading from .safetensors files
- Base64 and file-based asset upload/download
- Queue management and job cancellation
- System stats and VRAM management
- Advanced tools: multi-LoRA stacking, model downloading, batch generation, workflow cloning, presets, sampler sweeps
