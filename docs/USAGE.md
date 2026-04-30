# Usage Guide

## Quick Start

### 1. Install

```bash
git clone https://github.com/0xhackerfren/Comfy-UI-MCP.git
cd Comfy-UI-MCP
npm install
npm run build
```

### 2. Configure

Create a `.env` file (copy from `.env.example`):

```env
COMFYUI_URL=http://127.0.0.1:8188
WORKFLOW_DIR=./workflows
DEFAULT_TIMEOUT=300
```

### 3. Register with your MCP client

Add to your MCP client configuration (e.g. `~/.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "comfyui": {
      "command": "node",
      "args": ["path/to/comfyui-mcp-server/dist/index.js"]
    }
  }
}
```

### 4. First Generation

```
Use comfy_use_template with template "txt2img" and params { "prompt": "a beautiful sunset over mountains" }
Then use comfy_run_workflow to execute it.
```

That's it! The server handles workflow creation, queuing, and result retrieval automatically.

---

## Tool Categories

### Core Generation Tools

These tools handle direct image/video/audio generation using built-in templates.

#### `comfy_use_template` - Template-based generation

Create a workflow from a built-in template with parameters:

```json
{
  "template": "txt2img",
  "params": {
    "prompt": "a cyberpunk cityscape at night, neon lights, rain",
    "negative_prompt": "blurry, low quality",
    "width": 768,
    "height": 512,
    "steps": 25,
    "cfg": 7.5,
    "seed": 42
  }
}
```

Then execute with `comfy_run_workflow` (passing the returned `workflow_id`).

#### `comfy_run_prompt` - Raw workflow execution

For advanced users who want to run a raw ComfyUI API prompt (node graph):

```json
{
  "prompt": {
    "1": { "class_type": "CheckpointLoaderSimple", "inputs": { "ckpt_name": "sd_xl_base_1.0.safetensors" } },
    "2": { "class_type": "CLIPTextEncode", "inputs": { "text": "hello world", "clip": ["1", 1] } }
  }
}
```

### Workflow Management

#### `comfy_create_workflow` + `comfy_add_node` - Interactive workflow building

Build workflows step-by-step for complex custom pipelines:

```json
{
  "name": "my_custom_pipeline"
}
```

Then add nodes with `comfy_add_node`:

```json
{
  "workflow_id": "abc123",
  "class_type": "CheckpointLoaderSimple",
  "inputs": { "ckpt_name": "mymodel.safetensors" }
}
```

Wire them together with `comfy_connect_nodes` and set inputs with `comfy_set_node_input`.

#### `comfy_save_workflow` / `comfy_load_workflow`

Save and load workflow JSON files for reuse:

```json
{
  "workflow_id": "abc123",
  "filename": "my_pipeline.json"
}
```

### Advanced Generation Tools

#### `comfy_stack_loras` - Multi-LoRA generation

Stack multiple LoRAs with independent strengths:

```json
{
  "model": "sd_xl_base_1.0.safetensors",
  "loras": [
    { "name": "style_anime.safetensors", "strength_model": 0.8, "strength_clip": 0.8 },
    { "name": "detail_enhancer.safetensors", "strength_model": 0.5, "strength_clip": 0.5 },
    { "name": "lighting_dramatic.safetensors", "strength_model": 0.6, "strength_clip": 0.4 }
  ],
  "prompt": "anime girl in dramatic lighting, highly detailed",
  "width": 1024,
  "height": 1024,
  "steps": 30
}
```

#### `comfy_batch_generate` - Parallel variations

Generate multiple images with different parameters in one call:

```json
{
  "template": "txt2img",
  "base_params": {
    "prompt": "a cat wearing a hat",
    "width": 512,
    "height": 512,
    "steps": 20
  },
  "variations": [
    { "seed": 1, "cfg": 5 },
    { "seed": 2, "cfg": 7 },
    { "seed": 3, "cfg": 9 },
    { "seed": 4, "cfg": 12 }
  ]
}
```

#### `comfy_sampler_sweep` - Find optimal settings

Test different samplers/schedulers/steps automatically:

```json
{
  "template": "txt2img",
  "params": { "prompt": "landscape painting", "seed": 42 },
  "samplers": ["euler", "euler_ancestral", "dpmpp_2m"],
  "schedulers": ["normal", "karras"],
  "steps_range": [15, 20, 30]
}
```

#### `comfy_download_model` - Install models

Download models from HuggingFace or CivitAI:

```json
{
  "url": "https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0/resolve/main/sd_xl_base_1.0.safetensors",
  "filename": "sd_xl_base_1.0.safetensors",
  "folder": "checkpoints"
}
```

### Music & Audio

#### `comfy_generate_music` - ACE Step 1.5

Generate music with genre tags, lyrics, BPM, and key control:

```json
{
  "tags": "cinematic, orchestral, epic, dramatic, strings, brass",
  "lyrics": "[verse]\nThrough the mountains we will rise\n[chorus]\nAbove the clouds we fly",
  "duration": 60,
  "bpm": 140,
  "keyscale": "D minor",
  "steps": 8,
  "cfg": 2.0
}
```

### Video Generation

#### `comfy_keyframe_video` - Frame-to-frame transitions

Create smooth video transitions between two images:

```json
{
  "start_image": "scene_start.png",
  "end_image": "scene_end.png",
  "prompt": "camera slowly panning across a landscape, clouds moving",
  "width": 832,
  "height": 480,
  "length": 81,
  "steps": 20
}
```

#### `comfy_create_short` - Full video pipeline

Create a complete short video with visuals and music:

**Keyframe mode** (generates images, then transitions between them):

```json
{
  "scenes": [
    { "prompt": "sunrise over calm ocean, golden light" },
    { "prompt": "dolphins jumping in crystal clear water" },
    { "prompt": "sunset with dramatic orange and purple sky" }
  ],
  "mode": "keyframe",
  "music_tags": "ambient, peaceful, piano, strings",
  "duration": 30,
  "width": 832,
  "height": 480
}
```

**T2V mode** (generates video clips directly from text):

```json
{
  "scenes": [
    { "prompt": "a rocket launching into space, fire and smoke" },
    { "prompt": "earth seen from orbit, clouds swirling" },
    { "prompt": "astronaut floating in zero gravity" }
  ],
  "mode": "t2v",
  "music_tags": "electronic, epic, cinematic, synth",
  "duration": 30
}
```

### Presets

Save and reuse your favorite generation settings.

**Save a preset** (via `comfy_save_preset`):

```json
{
  "name": "my_anime_style",
  "template": "txt2img",
  "params": { "model": "animagine.safetensors", "steps": 28, "cfg": 7, "sampler_name": "euler_ancestral" }
}
```

**Apply it later with overrides** (via `comfy_apply_preset`):

```json
{
  "preset_name": "my_anime_style",
  "overrides": { "prompt": "new character design" }
}
```

---

## Templates Reference

| Template | Use Case | Key Parameters |
|----------|----------|----------------|
| `txt2img` | Text to image | prompt, model, width, height, steps, cfg, seed |
| `img2img` | Image transformation | image, prompt, denoise |
| `inpainting` | Selective editing | image, mask, prompt |
| `upscale` | Super-resolution | image, model |
| `controlnet` | Guided generation | control_image, controlnet_model, prompt |
| `lora` | Style/concept LoRA | lora_name, prompt, strength |
| `sdxl` | SDXL generation | prompt (1024x1024 default) |
| `flux` | Flux architecture | prompt |
| `stable_audio` | Audio generation | prompt, duration |
| `wan_video` | Wan i2v/t2v | prompt, start_image, length |
| `ltxv_video` | LTX-Video | prompt, length |
| `ace_step_1_5` | Music generation | tags, lyrics, duration, bpm |
| `wan_flf_video` | Frame transitions | start_image, end_image, prompt |
| `wan_t2v` | Wan text-to-video | prompt, length |

---

## Pipeline Tutorial: Creating a Short Video

This walkthrough demonstrates the full `comfy_create_short` pipeline.

### Step 1: Plan your scenes

Think of your short as a storyboard. Each scene becomes either a keyframe image (keyframe mode) or a direct video clip (t2v mode).

For a 15-second short at 16fps with 81 frames per segment (~5s each), you need 4 scenes to create 3 transitions.

### Step 2: Choose your mode

- **Keyframe mode**: Better visual quality for each frame, smooth transitions. Uses more VRAM (loads image model + video model sequentially). Best for artistic/cinematic content.
- **T2V mode**: Faster, more dynamic motion. Single model load per clip. Best for action/motion-heavy content.

### Step 3: Describe your music

ACE Step 1.5 uses tags for genre/mood/instruments. The more specific, the better:

```
"cinematic, orchestral, epic, dramatic, strings, brass, timpani, choir"
```

Optional lyrics follow a `[section]` format:
```
[intro]\n(instrumental)\n[verse]\nLyrics here\n[chorus]\nHook here
```

### Step 4: Execute

```json
{
  "scenes": [
    { "prompt": "vast desert landscape, golden sand dunes, dramatic sky, cinematic 4k" },
    { "prompt": "ancient temple ruins emerging from sand, mysterious lighting" },
    { "prompt": "explorer discovering glowing artifact inside temple" },
    { "prompt": "massive sandstorm approaching, dramatic clouds, epic scale" }
  ],
  "mode": "keyframe",
  "music_tags": "cinematic, adventure, orchestral, drums, strings, epic",
  "music_bpm": 130,
  "duration": 15,
  "width": 832,
  "height": 480,
  "frames_per_transition": 81,
  "video_steps": 20,
  "seed": 12345
}
```

### Step 5: Review output

The tool returns:
- Status of each generation step
- File paths for all intermediate outputs (keyframes, transitions, music)
- The final combined MP4 path (if ffmpeg is available)
- Timing and seed information for reproducibility

### Tips for better results

1. **Use descriptive prompts**: Include style keywords (cinematic, 4k, dramatic lighting)
2. **Consistent style across scenes**: Keep similar quality/style words in all prompts
3. **Appropriate negative prompts**: "blurry, low quality, distorted" helps
4. **Seed control**: Set a base seed for reproducibility, iterate from there
5. **VRAM management**: The pipeline automatically frees memory between steps. If you have <8GB VRAM, reduce `frames_per_transition` to 49 or 33
6. **Duration matching**: `frames_per_transition / 16 * (scenes - 1)` = total video seconds

---

## MCP Resources

The server exposes read-only resources for inspection:

**Static resources:**
- `comfy://system` - System stats including GPU, VRAM, and version info
- `comfy://nodes` - Complete node catalog with categories

**Template resources** (replace `{folder}` / `{prompt_id}` with actual values):
- `comfy://models/{folder}` - List models for a folder type (e.g. `comfy://models/checkpoints`, `comfy://models/loras`)
- `comfy://history/{prompt_id}` - Execution result for a specific job
