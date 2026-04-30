# Models Reference

## Required Models by Template

### Core Templates (work with any SD1.5 checkpoint)

| Template | Model Type | Default | Notes |
|----------|-----------|---------|-------|
| `txt2img` | Checkpoint | `v1-5-pruned-emaonly.safetensors` | Any SD1.5 checkpoint works |
| `img2img` | Checkpoint | `v1-5-pruned-emaonly.safetensors` | Same as txt2img |
| `inpainting` | Checkpoint | `v1-5-pruned-emaonly.safetensors` | Inpainting-specific models work better |
| `upscale` | Upscale Model | `RealESRGAN_x4plus.pth` | Goes in `models/upscale_models/` |
| `controlnet` | Checkpoint + ControlNet | Varies | Requires matching ControlNet model |
| `lora` | Checkpoint + LoRA | Varies | LoRA must match base model architecture |

### SDXL Template

| Model Type | Default | Folder | Size |
|-----------|---------|--------|------|
| Checkpoint | `sd_xl_base_1.0.safetensors` | `models/checkpoints/` | ~6.9 GB |

### Flux Template

| Model Type | Default | Folder | Size |
|-----------|---------|--------|------|
| UNET | `flux1-dev.safetensors` | `models/diffusion_models/` | ~12 GB |
| CLIP (dual) | `t5xxl_fp8_e4m3fn.safetensors` + `clip_l.safetensors` | `models/clip/` | ~5 GB + 250 MB |
| VAE | `ae.safetensors` | `models/vae/` | ~300 MB |

### Wan 2.2 Video Templates (`wan_video`, `wan_flf_video`, `wan_t2v`)

| Model Type | Default | Folder | Size |
|-----------|---------|--------|------|
| Diffusion Model (i2v) | `wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors` | `models/diffusion_models/` | ~14 GB |
| Diffusion Model (t2v) | `wan2.2_t2v_high_noise_14B_fp8_scaled.safetensors` | `models/diffusion_models/` | ~14 GB |
| Text Encoder | `umt5_xxl_fp8_e4m3fn_scaled.safetensors` | `models/clip/` | ~5 GB |
| VAE | `wan_2.1_vae.safetensors` | `models/vae/` | ~300 MB |
| CLIP Vision (wan_video only) | `clip_vision_h.safetensors` | `models/clip_vision/` | ~3.5 GB |

**Note:** `wan_flf_video` and `wan_t2v` do NOT require CLIP Vision.

### ACE Step 1.5 Music Template

| Model Type | Default | Folder | Size |
|-----------|---------|--------|------|
| Checkpoint (AIO) | `ace_step_1.5_turbo_aio.safetensors` | `models/checkpoints/` | ~5 GB |

### Stable Audio Template

| Model Type | Default | Folder | Size |
|-----------|---------|--------|------|
| Checkpoint | `stable_audio_open_1.0.safetensors` | `models/checkpoints/` | ~2.7 GB |

---

## Download URLs

### Stable Diffusion 1.5

| Model | URL |
|-------|-----|
| v1-5-pruned-emaonly | https://huggingface.co/stable-diffusion-v1-5/stable-diffusion-v1-5/resolve/main/v1-5-pruned-emaonly.safetensors |

### SDXL

| Model | URL |
|-------|-----|
| sd_xl_base_1.0 | https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0/resolve/main/sd_xl_base_1.0.safetensors |
| sd_xl_refiner_1.0 | https://huggingface.co/stabilityai/stable-diffusion-xl-refiner-1.0/resolve/main/sd_xl_refiner_1.0.safetensors |

### Wan 2.2

| Model | URL |
|-------|-----|
| wan2.2_i2v_high_noise_14B_fp8 | https://huggingface.co/Comfy-Org/Wan_2.2_ComfyUI_repackaged/resolve/main/split_files/diffusion_models/wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors |
| wan2.2_t2v_high_noise_14B_fp8 | https://huggingface.co/Comfy-Org/Wan_2.2_ComfyUI_repackaged/resolve/main/split_files/diffusion_models/wan2.2_t2v_high_noise_14B_fp8_scaled.safetensors |
| umt5_xxl_fp8_e4m3fn_scaled | https://huggingface.co/Comfy-Org/Wan_2.2_ComfyUI_repackaged/resolve/main/split_files/text_encoders/umt5_xxl_fp8_e4m3fn_scaled.safetensors |
| wan_2.1_vae | https://huggingface.co/Comfy-Org/Wan_2.2_ComfyUI_repackaged/resolve/main/split_files/vae/wan_2.1_vae.safetensors |
| clip_vision_h | https://huggingface.co/Comfy-Org/Wan_2.2_ComfyUI_repackaged/resolve/main/split_files/clip_vision/clip_vision_h.safetensors |

### ACE Step 1.5

| Model | URL |
|-------|-----|
| ace_step_1.5_turbo_aio | https://huggingface.co/ACE-Step/ACE-Step-v1.5-turbo-AIO/resolve/main/ace_step_1.5_turbo_aio.safetensors |

### Flux

| Model | URL |
|-------|-----|
| flux1-dev | https://huggingface.co/black-forest-labs/FLUX.1-dev/resolve/main/flux1-dev.safetensors |
| t5xxl_fp8_e4m3fn | https://huggingface.co/comfyanonymous/flux_text_encoders/resolve/main/t5xxl_fp8_e4m3fn.safetensors |
| clip_l | https://huggingface.co/comfyanonymous/flux_text_encoders/resolve/main/clip_l.safetensors |
| ae (VAE) | https://huggingface.co/black-forest-labs/FLUX.1-dev/resolve/main/ae.safetensors |

### Stable Audio

| Model | URL |
|-------|-----|
| stable_audio_open_1.0 | https://huggingface.co/stabilityai/stable-audio-open-1.0/resolve/main/model.safetensors |

### Upscale Models

| Model | URL |
|-------|-----|
| RealESRGAN_x4plus | https://huggingface.co/ai-forever/Real-ESRGAN/resolve/main/RealESRGAN_x4plus.pth |
| 4x-UltraSharp | https://huggingface.co/Kim2091/UltraSharp/resolve/main/4x-UltraSharp.pth |

---

## Compatibility Matrix

### Architecture Compatibility

| Base Model | Compatible LoRAs | Compatible VAE | Compatible ControlNets |
|-----------|-----------------|----------------|----------------------|
| SD 1.5 | SD 1.5 LoRAs | SD 1.5 VAE (or built-in) | SD 1.5 ControlNets |
| SDXL | SDXL LoRAs | SDXL VAE | SDXL ControlNets |
| Flux | Flux LoRAs | Flux VAE (ae.safetensors) | N/A |
| Wan 2.2 | Wan LoRAs (LightX2V, etc.) | wan_2.1_vae | N/A |

### fp8 vs bf16/fp16 Quality

| Precision | VRAM Usage | Quality | Speed |
|-----------|-----------|---------|-------|
| bf16 | Full (14-28 GB) | Best | Baseline |
| fp16 | Full (14-28 GB) | Very Good | Same as bf16 |
| fp8_e4m3fn | Half (~7-14 GB) | Good (minor loss) | Slightly faster |
| fp8_scaled | Half (~7-14 GB) | Good (optimized) | Slightly faster |

**Recommendation:** Use fp8_scaled models for consumer GPUs (8-16 GB VRAM). The quality difference is minimal for most use cases.

---

## Quick Install via MCP

You can download models directly through the MCP server:

```json
// Download Wan 2.2 i2v model
{
  "tool": "comfy_download_model",
  "args": {
    "url": "https://huggingface.co/Comfy-Org/Wan_2.2_ComfyUI_repackaged/resolve/main/split_files/diffusion_models/wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors",
    "filename": "wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors",
    "folder": "diffusion_models"
  }
}
```

```json
// Download ACE Step 1.5
{
  "tool": "comfy_download_model",
  "args": {
    "url": "https://huggingface.co/ACE-Step/ACE-Step-v1.5-turbo-AIO/resolve/main/ace_step_1.5_turbo_aio.safetensors",
    "filename": "ace_step_1.5_turbo_aio.safetensors",
    "folder": "checkpoints"
  }
}
```

---

## Minimum Requirements per Template

| Template | Min VRAM | Min Disk | Notes |
|----------|----------|----------|-------|
| `txt2img` (SD1.5) | 4 GB | 4 GB | Most consumer GPUs |
| `sdxl` | 8 GB | 7 GB | RTX 3060+ recommended |
| `flux` | 12 GB | 18 GB | RTX 4080+ recommended |
| `wan_flf_video` (fp8) | 12 GB | 20 GB | RTX 4070+ recommended |
| `wan_t2v` (fp8) | 12 GB | 20 GB | RTX 4070+ recommended |
| `ltxv_video` | 10 GB | 8 GB | RTX 3080+ recommended |
| `ace_step_1_5` | 6 GB | 5 GB | Most consumer GPUs |
| `stable_audio` | 6 GB | 3 GB | Most consumer GPUs |
| `comfy_create_short` | 12 GB | 25 GB | Needs video + audio models |
