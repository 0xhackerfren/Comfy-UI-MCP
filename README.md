<p align="center">
  <h1 align="center">ComfyUI MCP Server</h1>
  <p align="center">
    <strong>Give AI assistants full control over ComfyUI through natural language.</strong>
  </p>
  <p align="center">
    <a href="https://github.com/0xhackerfren/Comfy-UI-MCP/actions/workflows/ci.yml"><img src="https://github.com/0xhackerfren/Comfy-UI-MCP/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
    <a href="https://www.npmjs.com/package/comfyui-mcp-server"><img src="https://img.shields.io/npm/v/comfyui-mcp-server.svg" alt="npm version"></a>
    <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT"></a>
    <a href="https://www.npmjs.com/package/comfyui-mcp-server"><img src="https://img.shields.io/npm/dm/comfyui-mcp-server.svg" alt="npm downloads"></a>
    <a href="https://nodejs.org/"><img src="https://img.shields.io/node/v/comfyui-mcp-server.svg" alt="node version"></a>
  </p>
</p>

---

A comprehensive [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server that gives AI assistants (Cursor, Claude Desktop, etc.) full programmatic access to [ComfyUI](https://github.com/comfyanonymous/ComfyUI). Build workflows, generate images/audio/video, manage models, and orchestrate multi-step pipelines - all through conversation.

## Why?

ComfyUI is powerful but complex. This MCP server lets you skip the node graph UI entirely and control everything through your AI assistant:

- **"Generate a portrait in anime style with dramatic lighting"** - the assistant picks the right template, model, and parameters
- **"Create a 30-second video with background music"** - orchestrates keyframe generation, video transitions, music, and ffmpeg muxing automatically
- **"Download the latest SDXL model and generate a comparison grid"** - handles model management, batch generation, and parameter sweeps

No more drag-and-drop nodes. Just describe what you want.

## Features

| Category | Highlights |
|----------|-----------|
| **57 MCP Tools** | Complete coverage across 7 categories |
| **14 Templates** | txt2img, SDXL, Flux, ControlNet, LoRA, Wan video, ACE Step music, and more |
| **Pipeline Engine** | Chain workflows, pass outputs between steps, create full video shorts |
| **Real-time Tracking** | WebSocket-based progress monitoring with live updates |
| **Model Management** | Browse, download, and organize checkpoints/LoRAs/VAEs |
| **Multi-modal** | Images, video (Wan 2.2, LTX-Video), audio (ACE Step 1.5, Stable Audio) |

## Quick Start

### 1. Install

```bash
npm install -g comfyui-mcp-server
```

Or use without installing:

```bash
npx comfyui-mcp-server
```

### 2. Configure your MCP client

<details>
<summary><strong>Cursor</strong></summary>

Add to `~/.cursor/mcp.json` or your workspace `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "comfyui": {
      "command": "npx",
      "args": ["-y", "comfyui-mcp-server"],
      "env": {
        "COMFYUI_URL": "http://127.0.0.1:8188"
      }
    }
  }
}
```

</details>

<details>
<summary><strong>Claude Desktop</strong></summary>

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "comfyui": {
      "command": "npx",
      "args": ["-y", "comfyui-mcp-server"],
      "env": {
        "COMFYUI_URL": "http://127.0.0.1:8188"
      }
    }
  }
}
```

</details>

<details>
<summary><strong>From source (any MCP client)</strong></summary>

```bash
git clone https://github.com/0xhackerfren/Comfy-UI-MCP.git
cd Comfy-UI-MCP
npm install
npm run build
```

Then point your MCP client at:

```json
{
  "mcpServers": {
    "comfyui": {
      "command": "node",
      "args": ["/path/to/Comfy-UI-MCP/dist/index.js"],
      "env": {
        "COMFYUI_URL": "http://127.0.0.1:8188"
      }
    }
  }
}
```

</details>

### 3. Start generating

Once configured, just talk to your AI assistant:

> "Generate a cinematic landscape at sunset, 768x512, high quality"

The assistant handles template selection, parameter tuning, workflow execution, and result retrieval.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `COMFYUI_URL` | `http://127.0.0.1:8188` | ComfyUI server URL |
| `WORKFLOW_DIR` | `./workflows` | Directory for saved workflows |
| `DEFAULT_TIMEOUT` | `300` | Job timeout in seconds |

See [`.env.example`](.env.example) for all options.

## Tool Reference

<details>
<summary><strong>Discovery (7 tools)</strong> - Explore nodes, models, and capabilities</summary>

| Tool | Description |
|------|-------------|
| `comfy_list_nodes` | List available node classes with optional category/search filter |
| `comfy_get_node_info` | Get detailed node info (inputs, outputs, types) |
| `comfy_list_models` | List model files by folder (checkpoints, loras, vae, etc.) |
| `comfy_list_models_detailed` | List models with file sizes and paths |
| `comfy_get_model_metadata` | Read metadata from .safetensors model files |
| `comfy_list_embeddings` | List available text embeddings |
| `comfy_search_nodes` | Search nodes by name, category, or description |

</details>

<details>
<summary><strong>Workflow Building (9 tools)</strong> - Create node graphs programmatically</summary>

| Tool | Description |
|------|-------------|
| `comfy_create_workflow` | Create a new empty workflow |
| `comfy_add_node` | Add a node to a workflow |
| `comfy_connect_nodes` | Connect output of one node to input of another |
| `comfy_set_node_input` | Set a literal value on a node input |
| `comfy_validate_workflow` | Validate workflow before execution |
| `comfy_get_workflow` | Get the current state of a workflow |
| `comfy_load_workflow` | Load a workflow from a JSON file |
| `comfy_list_workflow_templates` | List available built-in templates |
| `comfy_use_template` | Create a workflow from a template with parameters |

</details>

<details>
<summary><strong>Generation & Pipelines (11 tools)</strong> - Execute and orchestrate</summary>

| Tool | Description |
|------|-------------|
| `comfy_run_workflow` | Execute a workflow (sync or async) |
| `comfy_run_prompt` | Submit raw ComfyUI API prompt JSON |
| `comfy_get_job_status` | Check job status and progress |
| `comfy_wait_for_job` | Block until a job completes |
| `comfy_save_workflow` | Persist a workflow to disk |
| `comfy_list_saved_workflows` | List saved workflows |
| `comfy_delete_saved_workflow` | Delete a saved workflow |
| `comfy_create_pipeline` | Create a multi-step pipeline |
| `comfy_add_pipeline_step` | Add a step to a pipeline |
| `comfy_run_pipeline` | Execute a full pipeline |
| `comfy_get_pipeline_status` | Check pipeline execution status |

</details>

<details>
<summary><strong>Asset Management (8 tools)</strong> - Upload/download media files</summary>

| Tool | Description |
|------|-------------|
| `comfy_upload_image` | Upload an image to ComfyUI input folder |
| `comfy_upload_mask` | Upload a mask for inpainting |
| `comfy_upload_audio` | Upload audio for audio workflows |
| `comfy_get_image` | Download a generated image (base64 or save to file) |
| `comfy_get_audio` | Download generated audio |
| `comfy_get_video` | Download generated video |
| `comfy_list_outputs` | List files in output/input/temp directories |
| `comfy_view_image` | Get image as base64 for inline display |

</details>

<details>
<summary><strong>Queue Management (4 tools)</strong> - Monitor and control jobs</summary>

| Tool | Description |
|------|-------------|
| `comfy_get_queue` | View running and pending jobs |
| `comfy_cancel_job` | Cancel a specific job |
| `comfy_clear_queue` | Clear all pending jobs |
| `comfy_get_history` | View execution history with results |

</details>

<details>
<summary><strong>System (7 tools)</strong> - Server health and configuration</summary>

| Tool | Description |
|------|-------------|
| `comfy_system_stats` | Get GPU, VRAM, and system info |
| `comfy_free_memory` | Free VRAM by unloading models |
| `comfy_interrupt` | Stop the currently running generation |
| `comfy_list_files` | List files in ComfyUI directories |
| `comfy_get_folder_paths` | Get configured folder paths |
| `comfy_list_jobs` | List jobs (modern jobs API) |
| `comfy_get_job` | Get details of a specific job |

</details>

<details>
<summary><strong>Advanced (11 tools)</strong> - Power user features</summary>

| Tool | Description |
|------|-------------|
| `comfy_stack_loras` | Generate with multiple LoRAs stacked (up to 10) |
| `comfy_download_model` | Download models from HuggingFace/CivitAI URLs |
| `comfy_batch_generate` | Generate multiple images with parameter variations |
| `comfy_clone_workflow` | Deep-copy a workflow with optional overrides |
| `comfy_save_preset` | Save template + params as a reusable preset |
| `comfy_list_presets` | List all saved presets |
| `comfy_apply_preset` | Apply a preset and generate immediately |
| `comfy_sampler_sweep` | Sweep samplers/schedulers/steps/CFG for comparison |
| `comfy_generate_music` | Generate music locally via ACE Step 1.5 (tags, lyrics, BPM, key) |
| `comfy_keyframe_video` | Create video transitions between keyframe images (Wan 2.2 FLF) |
| `comfy_create_short` | Full short video pipeline: keyframes + transitions + music + combine |

</details>

## Built-in Templates

| Template | Use Case | Key Parameters |
|----------|----------|----------------|
| `txt2img` | Text-to-image (SD 1.5) | prompt, width, height, steps, cfg, seed |
| `img2img` | Image transformation | image, prompt, denoise |
| `inpainting` | Mask-based editing | image, mask, prompt |
| `upscale` | Super-resolution | image, model |
| `controlnet` | Guided generation | control_image, controlnet_model, prompt |
| `lora` | LoRA-enhanced generation | lora_name, prompt, strength |
| `sdxl` | SDXL (1024x1024) | prompt |
| `flux` | Flux architecture | prompt |
| `stable_audio` | Audio generation | prompt, duration |
| `wan_video` | Wan image-to-video | prompt, start_image, length |
| `wan_t2v` | Wan text-to-video | prompt, length |
| `wan_flf_video` | First-last-frame interpolation | start_image, end_image, prompt |
| `ltxv_video` | LTX-Video | prompt, length |
| `ace_step_1_5` | Music generation (MIT, 50+ languages) | tags, lyrics, duration, bpm |

## Architecture

```
MCP Client (Cursor / Claude / etc.)
    |
    | stdio (JSON-RPC)
    v
+---------------------+
| ComfyUI MCP Server  |
|---------------------|
| WorkflowBuilder     |  In-memory graph construction
| WorkflowStore       |  JSON persistence to disk
| TemplateHandler     |  Pre-built workflow recipes
| PipelineOrchestrator|  Multi-step execution
| NodeCache           |  TTL-cached node definitions
+---------------------+
    |
    | HTTP REST + WebSocket
    v
+---------------------+
| ComfyUI Server      |
|---------------------|
| GPU Inference       |  Image / Audio / Video generation
+---------------------+
```

## MCP Resources

Read-only data endpoints your AI assistant can query:

| URI | Description |
|-----|-------------|
| `comfy://system` | System stats and GPU capabilities |
| `comfy://nodes` | Full node catalog |
| `comfy://models/{folder}` | Models in a specific folder |
| `comfy://history/{prompt_id}` | Execution history for a job |

## Documentation

| Resource | Description |
|----------|-------------|
| **[Usage Guide](docs/USAGE.md)** | Tool examples, template reference, pipeline tutorial |
| **[Troubleshooting](docs/TROUBLESHOOTING.md)** | Common errors, VRAM tips, debugging |
| **[Models Reference](docs/MODELS.md)** | Required models, download URLs, compatibility matrix |
| **[Example Workflows](examples/workflows/)** | 8 ready-to-run workflow JSONs |
| **[Contributing](CONTRIBUTING.md)** | Development setup and guidelines |
| **[Changelog](CHANGELOG.md)** | Version history |

## Security

This MCP server is designed for **local/trusted environments**. By design, it can:

- Read/write files on the local filesystem (workflows, models, outputs)
- Download files from arbitrary URLs (`comfy_download_model`)
- Execute shell commands (`ffmpeg` for video muxing)
- Send arbitrary node graphs to ComfyUI for GPU execution

These capabilities are intentional for a local creative tool. **Do not** expose this server to untrusted networks or callers without additional sandboxing and access controls.

## Development

```bash
npm install       # Install dependencies
npm run build     # Compile TypeScript
npm run dev       # Watch mode (rebuild on changes)
npm run lint      # Type-check without emitting
npm test          # Run test suite
```

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, project structure, and guidelines.

## License

[MIT](LICENSE) - Use it however you want.
