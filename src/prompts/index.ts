import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

export function registerPrompts(server: Server): void {
  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return {
      prompts: [
        {
          name: "comfy_txt2img",
          description: "Generate an image from a text description using Stable Diffusion",
          arguments: [
            { name: "prompt", description: "Text description of the image to generate", required: true },
            { name: "model", description: "Checkpoint model name", required: false },
            { name: "negative_prompt", description: "Things to avoid in the image", required: false },
            { name: "width", description: "Image width (default: 512)", required: false },
            { name: "height", description: "Image height (default: 512)", required: false },
          ],
        },
        {
          name: "comfy_img2img",
          description: "Transform an existing image using a text prompt",
          arguments: [
            { name: "image", description: "Input image filename (must be uploaded first)", required: true },
            { name: "prompt", description: "Text description for transformation", required: true },
            { name: "denoise", description: "Denoising strength 0.0-1.0 (default: 0.75)", required: false },
          ],
        },
        {
          name: "comfy_inpainting",
          description: "Edit specific regions of an image using a mask and text prompt",
          arguments: [
            { name: "image", description: "Source image filename", required: true },
            { name: "mask", description: "Mask image filename (white = regenerate)", required: true },
            { name: "prompt", description: "What to generate in the masked area", required: true },
          ],
        },
        {
          name: "comfy_upscale",
          description: "Upscale an image using an AI upscaling model",
          arguments: [
            { name: "image", description: "Image filename to upscale", required: true },
            { name: "upscale_model", description: "Upscale model name", required: false },
          ],
        },
        {
          name: "comfy_controlnet",
          description: "Generate an image guided by a control image (edges, depth, pose)",
          arguments: [
            { name: "prompt", description: "Text description", required: true },
            { name: "control_image", description: "Control/guide image filename", required: true },
            { name: "controlnet_model", description: "ControlNet model name", required: true },
          ],
        },
        {
          name: "comfy_lora",
          description: "Generate with LoRA style/concept customization",
          arguments: [
            { name: "prompt", description: "Text description", required: true },
            { name: "lora_name", description: "LoRA model filename", required: true },
            { name: "lora_strength", description: "LoRA strength (default: 1.0)", required: false },
          ],
        },
        {
          name: "comfy_stable_audio",
          description: "Generate audio (music or sound effects) from a text description using Stable Audio",
          arguments: [
            { name: "prompt", description: "Description of the audio to generate (e.g. 'upbeat electronic music with synths')", required: true },
            { name: "seconds_total", description: "Length of audio in seconds (default: 30)", required: false },
            { name: "model", description: "Stable Audio checkpoint name", required: false },
          ],
        },
        {
          name: "comfy_wan_video",
          description: "Generate video from text or an image using Wan video models",
          arguments: [
            { name: "prompt", description: "Text description of the video scene", required: true },
            { name: "start_image", description: "Optional starting image for image-to-video", required: false },
            { name: "length", description: "Number of frames (default: 81, about 3 seconds at 24fps)", required: false },
          ],
        },
        {
          name: "comfy_ace_step_music",
          description: "Generate music locally using ACE Step 1.5 (MIT licensed, 50+ languages, commercial-grade)",
          arguments: [
            { name: "tags", description: "Genre/mood/instrument tags (e.g. 'cinematic, orchestral, epic')", required: true },
            { name: "lyrics", description: "Optional song lyrics (50+ languages)", required: false },
            { name: "duration", description: "Duration in seconds (default: 30)", required: false },
            { name: "bpm", description: "Beats per minute (default: 120)", required: false },
          ],
        },
        {
          name: "comfy_keyframe_short",
          description: "Create a complete AI short video from scene descriptions with keyframe transitions and background music",
          arguments: [
            { name: "scenes", description: "Comma-separated scene descriptions for keyframe images", required: true },
            { name: "music_tags", description: "Music genre/mood tags (e.g. 'cinematic, epic, orchestral')", required: true },
            { name: "duration", description: "Target duration in seconds (default: 30)", required: false },
          ],
        },
      ],
    };
  });

  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    const builders: Record<string, (a: Record<string, string>) => string> = {
      comfy_txt2img: buildTxt2ImgInstructions,
      comfy_img2img: buildImg2ImgInstructions,
      comfy_inpainting: buildInpaintingInstructions,
      comfy_upscale: buildUpscaleInstructions,
      comfy_controlnet: buildControlNetInstructions,
      comfy_lora: buildLoraInstructions,
      comfy_stable_audio: buildStableAudioInstructions,
      comfy_wan_video: buildWanVideoInstructions,
      comfy_ace_step_music: buildAceStepMusicInstructions,
      comfy_keyframe_short: buildKeyframeShortInstructions,
    };

    const builder = builders[name];
    if (!builder) {
      throw new Error(`Unknown prompt: ${name}`);
    }

    return {
      messages: [
        {
          role: "user",
          content: { type: "text", text: builder(args || {}) },
        },
      ],
    };
  });
}

function buildTxt2ImgInstructions(args: Record<string, string>): string {
  return `Generate an image using ComfyUI:

Prompt: ${args.prompt || "[user will provide]"}
${args.negative_prompt ? `Negative prompt: ${args.negative_prompt}` : ""}
${args.model ? `Model: ${args.model}` : "Use default available checkpoint"}
${args.width ? `Width: ${args.width}` : ""}
${args.height ? `Height: ${args.height}` : ""}

Steps:
1. Use comfy_list_models(folder="checkpoints") to find available models
2. Use comfy_use_template(template="txt2img", params={...}) or template="sdxl"/"flux" for modern models
3. Use comfy_run_workflow(workflow_id=..., wait=true) to generate
4. Use comfy_get_image to retrieve the result`;
}

function buildImg2ImgInstructions(args: Record<string, string>): string {
  return `Transform an image using ComfyUI img2img:

Image: ${args.image || "[must upload first with comfy_upload_image]"}
Prompt: ${args.prompt || "[user will provide]"}
${args.denoise ? `Denoise: ${args.denoise}` : "Denoise: 0.75"}

Steps:
1. Upload the source image with comfy_upload_image if needed
2. Use comfy_use_template(template="img2img", params={image, prompt, denoise, ...})
3. Execute with comfy_run_workflow(workflow_id=..., wait=true)
4. Retrieve result with comfy_get_image`;
}

function buildInpaintingInstructions(args: Record<string, string>): string {
  return `Inpaint regions of an image:

Image: ${args.image || "[source image]"}
Mask: ${args.mask || "[mask image - white = regenerate]"}
Prompt: ${args.prompt || "[what to generate]"}

Steps:
1. Upload source image and mask with comfy_upload_image
2. Use comfy_use_template(template="inpainting", params={image, mask, prompt})
3. Execute with comfy_run_workflow
4. Retrieve result`;
}

function buildUpscaleInstructions(args: Record<string, string>): string {
  return `Upscale an image:

Image: ${args.image || "[image to upscale]"}
${args.upscale_model ? `Model: ${args.upscale_model}` : ""}

Steps:
1. Use comfy_list_models(folder="upscale_models") to check available upscalers
2. Use comfy_use_template(template="upscale", params={image, upscale_model})
3. Execute and retrieve`;
}

function buildControlNetInstructions(args: Record<string, string>): string {
  return `Generate with ControlNet:

Prompt: ${args.prompt || "[description]"}
Control image: ${args.control_image || "[guide image]"}
ControlNet: ${args.controlnet_model || "[must specify]"}

Steps:
1. Upload control image, list controlnet models
2. Use comfy_use_template(template="controlnet", params={...})
3. Execute and retrieve`;
}

function buildLoraInstructions(args: Record<string, string>): string {
  return `Generate with LoRA:

Prompt: ${args.prompt || "[description]"}
LoRA: ${args.lora_name || "[must specify]"}
${args.lora_strength ? `Strength: ${args.lora_strength}` : ""}

Steps:
1. Use comfy_list_models(folder="loras") to find LoRAs
2. Use comfy_use_template(template="lora", params={lora_name, prompt})
3. Execute and retrieve`;
}

function buildStableAudioInstructions(args: Record<string, string>): string {
  return `Generate audio using Stable Audio:

Prompt: ${args.prompt || "[describe the audio - music genre, instruments, mood, sound effects]"}
Duration: ${args.seconds_total || "30"} seconds
${args.model ? `Model: ${args.model}` : "Model: stable_audio_open_1.0.safetensors (or available stable audio checkpoint)"}

Steps:
1. Use comfy_list_models(folder="checkpoints") and look for stable audio models
2. Use comfy_use_template(template="stable_audio", params={prompt, seconds_total, model})
3. Execute with comfy_run_workflow(workflow_id=..., wait=true)
4. Use comfy_get_audio(filename=..., save_to="path") to save the generated audio`;
}

function buildWanVideoInstructions(args: Record<string, string>): string {
  return `Generate video using Wan:

Prompt: ${args.prompt || "[describe the video scene, motion, and content]"}
${args.start_image ? `Start image: ${args.start_image} (image-to-video mode)` : "Mode: text-to-video"}
Length: ${args.length || "81"} frames

Steps:
1. Use comfy_list_models(folder="diffusion_models") to find Wan UNet models
2. If doing image-to-video, upload start image with comfy_upload_image
3. Use comfy_use_template(template="wan_video", params={prompt, start_image, length})
4. Execute with comfy_run_workflow (this may take several minutes)
5. Use comfy_get_video(filename=..., save_to="path") to save the video`;
}

function buildAceStepMusicInstructions(args: Record<string, string>): string {
  return `Generate music locally using ACE Step 1.5:

Tags: ${args.tags || "[genre, mood, instruments - e.g. 'cinematic, orchestral, epic, strings']"}
${args.lyrics ? `Lyrics: ${args.lyrics}` : "No lyrics (instrumental)"}
Duration: ${args.duration || "30"} seconds
BPM: ${args.bpm || "120"}

Steps:
1. Use comfy_generate_music(tags="${args.tags || "cinematic, epic"}", duration=${args.duration || 30}, bpm=${args.bpm || 120})
2. Wait for completion (typically under 10s for 30s of audio)
3. Use comfy_get_audio to retrieve the generated music file

Model: ace_step_1.5_turbo_aio.safetensors (MIT licensed, local, 4B params)
Supports: 50+ languages for lyrics, 1000+ instruments/styles, up to 10 minutes`;
}

function buildKeyframeShortInstructions(args: Record<string, string>): string {
  const scenes = args.scenes || "scene 1, scene 2, scene 3";
  return `Create a complete AI short video:

Scenes: ${scenes}
Music: ${args.music_tags || "cinematic, epic"}
Duration: ${args.duration || "30"}s

Use comfy_create_short for the automated pipeline, or manually:

Step 1 - Generate keyframe images:
  For each scene, use comfy_use_template(template="txt2img", params={prompt, width:832, height:480})
  Run each with comfy_run_workflow

Step 2 - Generate video transitions:
  For each adjacent pair, use comfy_keyframe_video(start_image, end_image, prompt)
  Each transition creates ~5s of video (81 frames at 16fps)

Step 3 - Generate music:
  Use comfy_generate_music(tags="${args.music_tags || "cinematic, epic"}", duration=...)

Step 4 - Combine:
  Use a custom workflow with CreateVideo (images + audio) -> SaveVideo nodes

The comfy_create_short tool automates all 4 steps with VRAM management.`;
}
