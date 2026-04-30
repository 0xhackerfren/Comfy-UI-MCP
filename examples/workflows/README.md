# Example Workflows

These are ComfyUI API-format workflow JSONs that can be loaded and executed via the MCP server.

## Usage

Load and run any workflow using `comfy_run_prompt`:

```json
{
  "tool": "comfy_run_prompt",
  "args": {
    "prompt": <contents of any .json file here>
  }
}
```

Or load from disk using `comfy_load_workflow` if saved to your workflow directory.

## Workflows

| File | Description | Models Needed |
|------|-------------|---------------|
| `wan22_text_to_video.json` | Pure text-to-video with Wan 2.2 | Wan t2v fp8, UMT5, Wan VAE |
| `wan22_first_last_frame.json` | Keyframe video transition (FLF) | Wan i2v fp8, UMT5, Wan VAE |
| `wan22_image_to_video.json` | Animate a reference image | Wan i2v fp8, UMT5, Wan VAE, CLIP Vision H |
| `ace_step_music.json` | Music generation with lyrics | ACE Step 1.5 Turbo AIO |
| `video_with_soundtrack.json` | Combine video frames + audio | None (uses pre-made files) |
| `sd15_hires_fix.json` | Two-pass upscale for SD1.5 | Any SD1.5 checkpoint |
| `multi_lora_style_blend.json` | Three chained LoRAs | SD1.5 checkpoint + 3 LoRAs |
| `audio_processing_chain.json` | Trim + concatenate audio | Pre-made audio files |

## Customization

Each workflow uses placeholder values you should customize:

- **Model names**: Replace with models you have installed
- **Image filenames**: Replace `start_frame.png`, etc. with your uploaded images
- **Audio filenames**: Replace `clip_a.flac`, etc. with your audio files
- **Prompts**: Change text prompts to your desired content
- **Seeds**: Change seed values for different results

## Notes

- All workflows use the ComfyUI API format (node ID as key, `class_type` + `inputs`)
- The `_meta` top-level key is informational metadata - **strip it before submitting** to the ComfyUI API (or use `comfy_run_prompt` which handles this automatically)
- The `_comment` / `_note` fields at node level (outside `inputs`) are ignored by ComfyUI
- Input references use the format `["node_id", output_index]`
- Files referenced by `LoadImage`/`LoadAudio` must be in ComfyUI's `input/` folder
