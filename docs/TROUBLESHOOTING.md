# Troubleshooting Guide

## Common Errors

### "Node not found" / Unknown class_type

**Symptom:** ComfyUI rejects a workflow with errors like `"class_type 'WanFirstLastFrameToVideo' not found"`.

**Cause:** The workflow uses a node that requires custom nodes not installed in your ComfyUI instance.

**Fix:**
1. Check which custom nodes are needed (see [MODELS.md](./MODELS.md) for requirements per template)
2. Install missing custom nodes via ComfyUI Manager or manually:
   - Wan 2.2 nodes: Built into ComfyUI core (version 0.3.x+)
   - ACE Step 1.5 nodes: Install via ComfyUI Manager (search "ACE Step")
   - VideoHelperSuite: Only needed for advanced video manipulation

**Templates and their node requirements:**
| Template | Required Nodes |
|----------|---------------|
| `txt2img`, `img2img`, `inpainting`, `upscale` | Core ComfyUI only |
| `sdxl`, `flux` | Core ComfyUI only |
| `wan_video`, `wan_flf_video`, `wan_t2v` | ComfyUI 0.3+ (Wan nodes are built-in) |
| `ace_step_1_5` | ACE Step custom nodes |
| `stable_audio` | Stable Audio custom nodes |
| `controlnet` | Core ComfyUI only |

### WebSocket Connection Failed

**Symptom:** `"WebSocket connection to ws://127.0.0.1:8188/ws failed"` or timeout errors.

**Fixes:**
1. Verify ComfyUI is running: `curl http://127.0.0.1:8188/api/system_stats`
2. Check the port in your `.env` matches ComfyUI's actual port
3. If ComfyUI is on a different machine, ensure the URL includes the correct host
4. Check firewall rules if connecting across network
5. ComfyUI must be started with `--listen 0.0.0.0` for remote access

### "Prompt execution error" / Node errors

**Symptom:** Workflow queues but fails during execution.

**Common causes:**
- **Missing model file**: The checkpoint/LoRA/VAE referenced doesn't exist on disk
- **Wrong model name**: Filenames are case-sensitive on Linux
- **Incompatible model**: Using an SD1.5 LoRA with an SDXL checkpoint
- **Out of VRAM**: Model + generation exceeds available GPU memory

**Debugging steps:**
1. Use `comfy_system_stats` to check available VRAM
2. Use `comfy_list_models` to verify model filenames
3. Check the `node_errors` field in the error response for specific node failures
4. Use `comfy_get_history` to see detailed execution logs

### "Unexpected end of JSON input" on freeMemory

**Symptom:** Non-critical error when calling `comfy_free_memory`.

**Cause:** ComfyUI's `/api/free` endpoint returns an empty response that can't be parsed as JSON.

**Impact:** None - the memory is still freed successfully. This is a cosmetic error.

---

## VRAM Management

### Understanding VRAM Usage

| Operation | Approximate VRAM |
|-----------|-----------------|
| SD1.5 image generation (512x512) | ~4 GB |
| SDXL image generation (1024x1024) | ~8 GB |
| Wan 2.2 video (832x480, 81 frames, fp8) | ~12-16 GB |
| ACE Step 1.5 music (30s) | ~6 GB |
| Flux image generation | ~10-16 GB |

### Tips for Consumer GPUs (8-12 GB)

1. **Use fp8 models**: Wan 2.2 fp8 models use roughly half the VRAM of bf16 versions
2. **Sequential pipeline**: `comfy_create_short` already runs steps sequentially with `freeMemory` between them
3. **Reduce frame count**: Lower `frames_per_transition` from 81 to 49 or 33
4. **Reduce resolution**: 640x384 instead of 832x480 for video
5. **Use `comfy_free_memory`** before heavy operations: `{ "unload_models": true, "free_memory": true }`
6. **Close other applications** using the GPU during generation

### Tips for High-VRAM GPUs (24+ GB)

1. You can increase `frames_per_transition` to 129 or higher for longer clips
2. Use bf16 models instead of fp8 for better quality
3. Higher resolution video (1280x720) becomes feasible
4. Multiple LoRAs with full precision

### Monitoring VRAM

Use `comfy_system_stats` to check current VRAM state:
```json
// Response includes:
{
  "devices": [{
    "name": "NVIDIA GeForce RTX 4090",
    "vram_total": 25757220864,
    "vram_free": 18000000000,
    "torch_vram_total": 25757220864,
    "torch_vram_free": 18000000000
  }]
}
```

---

## Model Issues

### Model Not Appearing in List

**Possible causes:**
1. File not in the correct subfolder (checkpoints go in `models/checkpoints/`, LoRAs in `models/loras/`, etc.)
2. File extension not recognized (must be `.safetensors`, `.ckpt`, `.pt`, or `.pth`)
3. ComfyUI needs restart to detect new files (use `comfy_list_models` with `force_refresh: true`)
4. Symlinks may not be followed on some OS configurations

### Model Download Failures

When using `comfy_download_model`:
1. **CivitAI**: Ensure the URL is a direct download link (not the model page)
2. **HuggingFace**: Use the `/resolve/main/` URL format, not the web UI URL
3. **Large files**: Downloads may timeout; increase the timeout or download manually
4. **Disk space**: Ensure sufficient free space (models range from 2-20 GB)

---

## Pipeline-Specific Issues

### `comfy_create_short` produces no final MP4

**Possible causes:**
1. **ffmpeg not installed**: The mux step requires ffmpeg. Install it:
   - Windows: `winget install ffmpeg` or download from ffmpeg.org
   - Linux: `sudo apt install ffmpeg`
   - macOS: `brew install ffmpeg`
2. **Video segments failed**: Check the `results` array for failed steps
3. **Audio generation failed**: Music step may have errored (check ACE Step model is installed)

**Workaround if ffmpeg is unavailable:**
The tool still returns individual video segment paths and the audio file path. You can combine them manually with any video editor or with ffmpeg later:
```bash
ffmpeg -f concat -safe 0 -i filelist.txt -i music.flac -c:v copy -c:a aac -shortest final.mp4
```

### Keyframe images look bad

**Tips for better keyframes:**
1. Use a high-quality SD1.5 or SDXL model (not the default pruned model)
2. Add quality keywords: "masterpiece, best quality, highly detailed, 4k"
3. Use appropriate negative prompts: "worst quality, low quality, blurry, deformed"
4. Increase steps to 30+ for more refined images
5. Try different CFG values (7-12 for most models)

### Video transitions are jerky/low quality

1. Increase `video_steps` from 20 to 30-40
2. Ensure keyframe images have similar composition/style
3. Use a prompt that describes the motion, not just the static scene
4. Try the LightX2V LoRA for faster 4-step generation (with appropriate model)

---

## Server Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `COMFYUI_URL` | `http://127.0.0.1:8188` | ComfyUI API endpoint |
| `WORKFLOW_DIR` | `./workflows` | Directory for saved workflows |
| `DEFAULT_TIMEOUT` | `300` | Default job timeout in seconds |

### Performance Tuning

- **Timeout**: Increase `DEFAULT_TIMEOUT` for video generation (300s may not be enough for Wan 2.2)
- **Workflow directory**: Use an SSD for faster workflow save/load
- **Connection**: If ComfyUI is on the same machine, always use `127.0.0.1` (not `localhost`) to avoid DNS lookup delays
