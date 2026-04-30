import { execSync } from "child_process";
import { readFileSync, writeFileSync, mkdirSync, unlinkSync, rmSync, existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { ComfyUIClient } from "../comfyui-client.js";
import { WorkflowBuilder } from "../workflow-builder.js";
import { WorkflowStore } from "../workflow-store.js";
import { validateArgs } from "../schemas.js";
import { z } from "zod";

// --- Schemas ---

const GenerateMusicSchema = z.object({
  tags: z.string().min(1),
  lyrics: z.string().optional().default(""),
  duration: z.number().min(1).max(600).optional().default(30),
  bpm: z.number().int().min(10).max(300).optional().default(120),
  language: z.string().optional().default("en"),
  keyscale: z.string().optional().default("C major"),
  timesignature: z.string().optional().default("4"),
  model: z.string().optional(),
  seed: z.number().int().optional(),
  steps: z.number().int().min(1).max(100).optional().default(8),
  cfg: z.number().min(0).max(30).optional().default(2.0),
  wait: z.boolean().optional().default(true),
  timeout: z.number().min(1).optional(),
});

const KeyframeVideoSchema = z.object({
  start_image: z.string().min(1),
  end_image: z.string().min(1),
  prompt: z.string().min(1),
  negative_prompt: z.string().optional().default(""),
  diffusion_model: z.string().optional(),
  width: z.number().int().min(16).max(4096).optional().default(832),
  height: z.number().int().min(16).max(4096).optional().default(480),
  length: z.number().int().min(1).max(1024).optional().default(81),
  steps: z.number().int().min(1).max(150).optional().default(20),
  cfg: z.number().min(0).max(30).optional().default(6.0),
  seed: z.number().int().optional(),
  wait: z.boolean().optional().default(true),
  timeout: z.number().min(1).optional(),
});

const CreateShortSchema = z.object({
  scenes: z.array(z.object({
    prompt: z.string().min(1),
    negative_prompt: z.string().optional().default(""),
  })).min(2).max(12),
  mode: z.enum(["keyframe", "t2v"]).optional().default("keyframe"),
  music_tags: z.string().min(1),
  music_lyrics: z.string().optional().default(""),
  duration: z.number().min(5).max(120).optional().default(30),
  image_model: z.string().optional(),
  video_model: z.string().optional(),
  width: z.number().int().optional().default(832),
  height: z.number().int().optional().default(480),
  frames_per_transition: z.number().int().optional().default(81),
  video_steps: z.number().int().optional().default(20),
  video_cfg: z.number().optional().default(6.0),
  music_bpm: z.number().int().optional().default(120),
  seed: z.number().int().optional(),
  timeout: z.number().min(1).optional().default(600),
});

const StackLorasSchema = z.object({
  model: z.string().optional(),
  loras: z.array(z.object({
    name: z.string().min(1),
    strength_model: z.number().min(-10).max(10).optional().default(1.0),
    strength_clip: z.number().min(-10).max(10).optional().default(1.0),
  })).min(1).max(10),
  prompt: z.string().min(1),
  negative_prompt: z.string().optional().default(""),
  width: z.number().int().min(64).max(4096).optional().default(512),
  height: z.number().int().min(64).max(4096).optional().default(512),
  steps: z.number().int().min(1).max(150).optional().default(20),
  cfg: z.number().min(0).max(30).optional().default(7),
  seed: z.number().int().optional(),
  sampler_name: z.string().optional().default("euler"),
  scheduler: z.string().optional().default("normal"),
  wait: z.boolean().optional().default(true),
  timeout: z.number().min(1).optional(),
});

const DownloadModelSchema = z.object({
  url: z.string().url(),
  filename: z.string().min(1),
  folder: z.string().min(1),
  overwrite: z.boolean().optional().default(false),
});

const BatchGenerateSchema = z.object({
  template: z.string().min(1),
  base_params: z.record(z.unknown()),
  variations: z.array(z.record(z.unknown())).min(1).max(20),
  wait: z.boolean().optional().default(true),
  timeout: z.number().min(1).optional(),
});

const CloneWorkflowSchema = z.object({
  workflow_id: z.string().min(1),
  name: z.string().optional(),
  overrides: z.record(z.unknown()).optional(),
});

const SavePresetSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().default(""),
  template: z.string().min(1),
  params: z.record(z.unknown()),
});

const ApplyPresetSchema = z.object({
  preset_name: z.string().min(1),
  overrides: z.record(z.unknown()).optional(),
  wait: z.boolean().optional().default(true),
  timeout: z.number().min(1).optional(),
});

const SamplerSweepSchema = z.object({
  template: z.string().optional().default("txt2img"),
  params: z.record(z.unknown()),
  samplers: z.array(z.string()).optional(),
  schedulers: z.array(z.string()).optional(),
  steps_range: z.array(z.number().int()).optional(),
  cfg_range: z.array(z.number()).optional(),
  wait: z.boolean().optional().default(true),
  timeout: z.number().min(1).optional(),
});

// --- Tool Definitions ---

export function getAdvancedToolDefinitions() {
  return [
    {
      name: "comfy_generate_music",
      description:
        "Generate music locally using ACE Step 1.5 (4B param, MIT licensed). Supports genre tags, lyrics in 50+ languages, BPM, key/scale, and duration up to 10 minutes. Generates commercial-grade quality music on consumer GPUs.",
      inputSchema: {
        type: "object" as const,
        properties: {
          tags: { type: "string", description: "Genre/mood/instrument tags (e.g. 'cinematic, orchestral, epic, dramatic, strings, brass')" },
          lyrics: { type: "string", description: "Optional song lyrics (50+ languages supported)" },
          duration: { type: "number", description: "Duration in seconds (default: 30, max: 600)" },
          bpm: { type: "number", description: "Beats per minute (default: 120, range: 10-300)" },
          language: { type: "string", description: "Lyrics language code (default: 'en')" },
          keyscale: { type: "string", description: "Musical key (e.g. 'C major', 'A minor', default: 'C major')" },
          timesignature: { type: "string", description: "Time signature: '2', '3', '4', or '6' (default: '4')" },
          model: { type: "string", description: "ACE Step checkpoint (default: ace_step_1.5_turbo_aio.safetensors)" },
          seed: { type: "number", description: "Random seed (omit for random)" },
          steps: { type: "number", description: "Diffusion steps (default: 8 for turbo)" },
          cfg: { type: "number", description: "CFG scale (default: 2.0)" },
          wait: { type: "boolean", description: "Wait for completion (default: true)" },
          timeout: { type: "number", description: "Timeout in seconds" },
        },
        required: ["tags"],
      },
    },
    {
      name: "comfy_keyframe_video",
      description:
        "Generate a video transition between two keyframe images using Wan 2.2 First-Last-Frame interpolation. Creates smooth 5-second transitions at 16fps (81 frames). No clip_vision model needed. Ideal for creating shorts from generated keyframes.",
      inputSchema: {
        type: "object" as const,
        properties: {
          start_image: { type: "string", description: "Start frame image filename (must be in ComfyUI input/ folder)" },
          end_image: { type: "string", description: "End frame image filename (must be in ComfyUI input/ folder)" },
          prompt: { type: "string", description: "Description of the transition/motion" },
          negative_prompt: { type: "string", description: "Negative prompt" },
          diffusion_model: { type: "string", description: "Wan model (default: wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors)" },
          width: { type: "number", description: "Video width (default: 832, must be multiple of 16)" },
          height: { type: "number", description: "Video height (default: 480, must be multiple of 16)" },
          length: { type: "number", description: "Frame count (default: 81 = ~5s at 16fps, must be multiple of 4 + 1)" },
          steps: { type: "number", description: "Sampling steps (default: 20)" },
          cfg: { type: "number", description: "CFG scale (default: 6.0)" },
          seed: { type: "number", description: "Random seed (omit for random)" },
          wait: { type: "boolean", description: "Wait for completion (default: true)" },
          timeout: { type: "number", description: "Timeout in seconds" },
        },
        required: ["start_image", "end_image", "prompt"],
      },
    },
    {
      name: "comfy_create_short",
      description:
        "Create a complete short video (up to 120s) with AI-generated visuals and music. Two modes: 'keyframe' generates images then transitions between them using Wan 2.2 FLF; 't2v' generates video clips directly from text. Both end with ACE Step 1.5 music and ffmpeg mux into a final MP4 with audio. Runs sequentially for VRAM management.",
      inputSchema: {
        type: "object" as const,
        properties: {
          scenes: {
            type: "array",
            description: "Array of scene descriptions [{prompt, negative_prompt?}]. In keyframe mode: adjacent pairs become transitions. In t2v mode: each scene becomes a standalone video clip.",
            items: {
              type: "object",
              properties: {
                prompt: { type: "string", description: "Scene description" },
                negative_prompt: { type: "string", description: "Negative prompt" },
              },
              required: ["prompt"],
            },
          },
          mode: { type: "string", description: "Generation mode: 'keyframe' (image->FLF transitions) or 't2v' (direct text-to-video per scene). Default: 'keyframe'" },
          music_tags: { type: "string", description: "Music genre/mood tags (e.g. 'cinematic, epic, orchestral')" },
          music_lyrics: { type: "string", description: "Optional lyrics for the music track" },
          duration: { type: "number", description: "Target duration in seconds (default: 30)" },
          image_model: { type: "string", description: "Checkpoint for keyframe images in keyframe mode (default: first available)" },
          video_model: { type: "string", description: "Wan model for video generation (default varies by mode)" },
          width: { type: "number", description: "Video width (default: 832)" },
          height: { type: "number", description: "Video height (default: 480)" },
          frames_per_transition: { type: "number", description: "Frames per video segment (default: 81 = ~5s at 16fps)" },
          video_steps: { type: "number", description: "Sampling steps for video (default: 20)" },
          video_cfg: { type: "number", description: "CFG for video generation (default: 6.0)" },
          music_bpm: { type: "number", description: "Music BPM (default: 120)" },
          seed: { type: "number", description: "Base seed (omit for random)" },
          timeout: { type: "number", description: "Total timeout in seconds (default: 600)" },
        },
        required: ["scenes", "music_tags"],
      },
    },
    {
      name: "comfy_stack_loras",
      description:
        "Generate an image with multiple LoRAs stacked together. Each LoRA has independent model and CLIP strength. Chains LoraLoader nodes in sequence for proper multi-LoRA composition. Builds and immediately executes the workflow.",
      inputSchema: {
        type: "object" as const,
        properties: {
          model: { type: "string", description: "Checkpoint model name (default: first available)" },
          loras: {
            type: "array",
            description: "Array of LoRA configs: [{name, strength_model?, strength_clip?}]. Max 10 LoRAs.",
            items: {
              type: "object",
              properties: {
                name: { type: "string", description: "LoRA filename (e.g. 'my_lora.safetensors')" },
                strength_model: { type: "number", description: "Model strength (default: 1.0, range: -10 to 10)" },
                strength_clip: { type: "number", description: "CLIP strength (default: 1.0, range: -10 to 10)" },
              },
              required: ["name"],
            },
          },
          prompt: { type: "string", description: "Positive prompt text" },
          negative_prompt: { type: "string", description: "Negative prompt text" },
          width: { type: "number", description: "Image width (default: 512)" },
          height: { type: "number", description: "Image height (default: 512)" },
          steps: { type: "number", description: "Sampling steps (default: 20)" },
          cfg: { type: "number", description: "CFG scale (default: 7)" },
          seed: { type: "number", description: "Random seed (omit for random)" },
          sampler_name: { type: "string", description: "Sampler name (default: euler)" },
          scheduler: { type: "string", description: "Scheduler (default: normal)" },
          wait: { type: "boolean", description: "Wait for completion (default: true)" },
          timeout: { type: "number", description: "Timeout in seconds" },
        },
        required: ["loras", "prompt"],
      },
    },
    {
      name: "comfy_download_model",
      description:
        "Download a model file from a URL (CivitAI, HuggingFace, or direct link) into a ComfyUI model folder. Supports checkpoints, LoRAs, VAEs, ControlNets, upscale models, and embeddings. Shows download progress.",
      inputSchema: {
        type: "object" as const,
        properties: {
          url: { type: "string", description: "Direct download URL for the model file" },
          filename: { type: "string", description: "Filename to save as (e.g. 'my_model.safetensors')" },
          folder: { type: "string", description: "Target folder: checkpoints, loras, vae, controlnet, upscale_models, embeddings, clip, etc." },
          overwrite: { type: "boolean", description: "Overwrite if file already exists (default: false)" },
        },
        required: ["url", "filename", "folder"],
      },
    },
    {
      name: "comfy_batch_generate",
      description:
        "Generate multiple images from a template with different parameter variations. Perfect for prompt exploration, seed sweeps, or testing different models. Returns all results together.",
      inputSchema: {
        type: "object" as const,
        properties: {
          template: { type: "string", description: "Template name (e.g. 'txt2img', 'sdxl', 'flux')" },
          base_params: { type: "object", description: "Base parameters applied to all variations (prompt, model, steps, etc.)" },
          variations: {
            type: "array",
            description: "Array of parameter overrides for each variation. Each item overrides base_params.",
            items: { type: "object" },
          },
          wait: { type: "boolean", description: "Wait for all to complete (default: true)" },
          timeout: { type: "number", description: "Timeout per job in seconds" },
        },
        required: ["template", "base_params", "variations"],
      },
    },
    {
      name: "comfy_clone_workflow",
      description:
        "Clone an existing workflow with optional parameter overrides. Useful for creating variations of a workflow without rebuilding from scratch. Supports overriding any node input using 'node_id.input_name' format.",
      inputSchema: {
        type: "object" as const,
        properties: {
          workflow_id: { type: "string", description: "Source workflow ID to clone" },
          name: { type: "string", description: "Name for the cloned workflow" },
          overrides: {
            type: "object",
            description: "Parameter overrides in 'node_id.input_name': value format (e.g. {'5.seed': 42, '2.text': 'new prompt'})",
          },
        },
        required: ["workflow_id"],
      },
    },
    {
      name: "comfy_save_preset",
      description:
        "Save a named preset (template + parameters) for quick reuse. Presets persist to disk and can be applied later with comfy_apply_preset. Great for saving your favorite generation settings.",
      inputSchema: {
        type: "object" as const,
        properties: {
          name: { type: "string", description: "Unique preset name (e.g. 'my_portrait_style', 'landscape_4k')" },
          description: { type: "string", description: "Human-readable description of what this preset does" },
          template: { type: "string", description: "Template name this preset uses (e.g. 'txt2img', 'lora')" },
          params: { type: "object", description: "Full parameter set for the template" },
        },
        required: ["name", "template", "params"],
      },
    },
    {
      name: "comfy_list_presets",
      description:
        "List all saved presets. Shows name, description, template, and key parameters for each preset.",
      inputSchema: {
        type: "object" as const,
        properties: {},
      },
    },
    {
      name: "comfy_apply_preset",
      description:
        "Apply a saved preset to generate an image immediately. Optionally override specific parameters. Combines preset recall with one-shot execution.",
      inputSchema: {
        type: "object" as const,
        properties: {
          preset_name: { type: "string", description: "Name of the preset to apply" },
          overrides: { type: "object", description: "Parameter overrides to apply on top of the preset (e.g. change prompt or seed)" },
          wait: { type: "boolean", description: "Wait for completion (default: true)" },
          timeout: { type: "number", description: "Timeout in seconds" },
        },
        required: ["preset_name"],
      },
    },
    {
      name: "comfy_sampler_sweep",
      description:
        "Run a parameter sweep across samplers, schedulers, step counts, or CFG values to compare results. Generates one image for each combination and returns all results for comparison.",
      inputSchema: {
        type: "object" as const,
        properties: {
          template: { type: "string", description: "Template to use (default: txt2img)" },
          params: { type: "object", description: "Base parameters (prompt, model, etc.)" },
          samplers: {
            type: "array",
            description: "Samplers to test (e.g. ['euler', 'euler_ancestral', 'dpmpp_2m'])",
            items: { type: "string" },
          },
          schedulers: {
            type: "array",
            description: "Schedulers to test (e.g. ['normal', 'karras', 'sgm_uniform'])",
            items: { type: "string" },
          },
          steps_range: {
            type: "array",
            description: "Step counts to test (e.g. [10, 20, 30])",
            items: { type: "number" },
          },
          cfg_range: {
            type: "array",
            description: "CFG values to test (e.g. [3, 5, 7, 10])",
            items: { type: "number" },
          },
          wait: { type: "boolean", description: "Wait for all to complete (default: true)" },
          timeout: { type: "number", description: "Timeout per job in seconds" },
        },
        required: ["params"],
      },
    },
  ];
}

// --- Handlers ---

export async function handleAdvancedTool(
  toolName: string,
  args: Record<string, unknown>,
  client: ComfyUIClient,
  workflowBuilder: WorkflowBuilder,
  workflowStore: WorkflowStore,
  templateHandler: (template: string, params: Record<string, unknown>) => string,
  defaultTimeout: number
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  switch (toolName) {
    case "comfy_stack_loras": {
      const v = validateArgs(StackLorasSchema, args);
      if (!v.success) return { content: [{ type: "text", text: v.error }], isError: true };

      try {
        const {
          model, loras, prompt, negative_prompt, width, height,
          steps, cfg, seed, sampler_name, scheduler, wait, timeout,
        } = v.data;
        const actualSeed = seed ?? Math.floor(Math.random() * 2 ** 32);
        const timeoutMs = (timeout || defaultTimeout) * 1000;

        const workflow = workflowBuilder.createWorkflow("multi_lora");
        const wid = workflow.id;

        // Node 1: Checkpoint loader
        workflowBuilder.addNode(wid, "CheckpointLoaderSimple", {
          ckpt_name: model || "v1-5-pruned-emaonly.safetensors",
        }, "1");

        // Chain LoRA loaders: each takes model+clip from previous
        let prevModelNode = "1";
        let prevModelSlot = 0;
        let prevClipNode = "1";
        let prevClipSlot = 1;

        for (let i = 0; i < loras.length; i++) {
          const loraNodeId = String(10 + i);
          workflowBuilder.addNode(wid, "LoraLoader", {
            lora_name: loras[i].name,
            strength_model: loras[i].strength_model,
            strength_clip: loras[i].strength_clip,
          }, loraNodeId);

          workflowBuilder.connectNodes(wid, prevModelNode, prevModelSlot, loraNodeId, "model");
          workflowBuilder.connectNodes(wid, prevClipNode, prevClipSlot, loraNodeId, "clip");

          prevModelNode = loraNodeId;
          prevModelSlot = 0;
          prevClipNode = loraNodeId;
          prevClipSlot = 1;
        }

        // CLIP text encode nodes
        workflowBuilder.addNode(wid, "CLIPTextEncode", { text: prompt }, "50");
        workflowBuilder.addNode(wid, "CLIPTextEncode", { text: negative_prompt }, "51");
        workflowBuilder.connectNodes(wid, prevClipNode, prevClipSlot, "50", "clip");
        workflowBuilder.connectNodes(wid, prevClipNode, prevClipSlot, "51", "clip");

        // Latent + KSampler
        workflowBuilder.addNode(wid, "EmptyLatentImage", { width, height, batch_size: 1 }, "60");
        workflowBuilder.addNode(wid, "KSampler", {
          seed: actualSeed, steps, cfg, sampler_name, scheduler, denoise: 1.0,
        }, "70");

        workflowBuilder.connectNodes(wid, prevModelNode, prevModelSlot, "70", "model");
        workflowBuilder.connectNodes(wid, "50", 0, "70", "positive");
        workflowBuilder.connectNodes(wid, "51", 0, "70", "negative");
        workflowBuilder.connectNodes(wid, "60", 0, "70", "latent_image");

        // VAE Decode + Save
        workflowBuilder.addNode(wid, "VAEDecode", {}, "80");
        workflowBuilder.addNode(wid, "SaveImage", { filename_prefix: "ComfyUI_multiLora" }, "90");

        workflowBuilder.connectNodes(wid, "70", 0, "80", "samples");
        workflowBuilder.connectNodes(wid, "1", 2, "80", "vae");
        workflowBuilder.connectNodes(wid, "80", 0, "90", "images");

        // Execute
        const promptGraph = workflowBuilder.toPrompt(wid);
        const response = await client.queuePrompt({ prompt: promptGraph });

        if (response.error) {
          return {
            content: [{ type: "text", text: JSON.stringify({ error: response.error, node_errors: response.node_errors }, null, 2) }],
            isError: true,
          };
        }

        if (!wait) {
          return {
            content: [{ type: "text", text: JSON.stringify({
              prompt_id: response.prompt_id,
              workflow_id: wid,
              lora_count: loras.length,
              loras: loras.map(l => l.name),
              status: "queued",
            }, null, 2) }],
          };
        }

        const result = await client.waitForJob(response.prompt_id, timeoutMs);
        return {
          content: [{ type: "text", text: JSON.stringify({
            ...result,
            workflow_id: wid,
            lora_count: loras.length,
            loras: loras.map(l => `${l.name} (model:${l.strength_model}, clip:${l.strength_clip})`),
            seed: actualSeed,
          }, null, 2) }],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${(err as Error).message}` }], isError: true };
      }
    }

    case "comfy_download_model": {
      const v = validateArgs(DownloadModelSchema, args);
      if (!v.success) return { content: [{ type: "text", text: v.error }], isError: true };

      try {
        const { url, filename, folder, overwrite } = v.data;

        // Check if model already exists
        const existingModels = await client.getModels(folder);
        if (existingModels.includes(filename) && !overwrite) {
          return {
            content: [{ type: "text", text: JSON.stringify({
              status: "skipped",
              message: `Model "${filename}" already exists in ${folder}. Set overwrite=true to replace.`,
            }, null, 2) }],
          };
        }

        // Get folder paths to find the actual directory
        const paths = await client.getFolderPaths();
        const folderPaths = paths[folder];
        if (!folderPaths || folderPaths.length === 0) {
          return {
            content: [{ type: "text", text: `Unknown model folder: "${folder}". Use comfy_get_folder_paths to see available folders.` }],
            isError: true,
          };
        }

        const targetDir = folderPaths[0];

        // Download using fetch with streaming
        const response = await fetch(url, { redirect: "follow" });
        if (!response.ok) {
          return {
            content: [{ type: "text", text: `Download failed: HTTP ${response.status} ${response.statusText}` }],
            isError: true,
          };
        }

        const contentLength = response.headers.get("content-length");
        const sizeMB = contentLength ? (parseInt(contentLength) / 1024 / 1024).toFixed(1) : "unknown";

        // Stream to file
        const { createWriteStream } = await import("node:fs");
        const { Readable } = await import("node:stream");
        const { pipeline } = await import("node:stream/promises");
        const { resolve: pathResolve } = await import("node:path");

        const resolvedPath = pathResolve(targetDir, filename);
        const fileStream = createWriteStream(resolvedPath);
        const body = response.body;

        if (!body) {
          return { content: [{ type: "text", text: "Download failed: No response body" }], isError: true };
        }

        await pipeline(Readable.fromWeb(body as any), fileStream);

        return {
          content: [{ type: "text", text: JSON.stringify({
            status: "completed",
            filename,
            folder,
            path: resolvedPath,
            size_mb: sizeMB,
            message: `Model downloaded successfully. It should now appear in comfy_list_models for folder "${folder}".`,
          }, null, 2) }],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Download error: ${(err as Error).message}` }], isError: true };
      }
    }

    case "comfy_batch_generate": {
      const v = validateArgs(BatchGenerateSchema, args);
      if (!v.success) return { content: [{ type: "text", text: v.error }], isError: true };

      try {
        const { template, base_params, variations, wait, timeout } = v.data;
        const timeoutMs = (timeout || defaultTimeout) * 1000;
        const jobs: Array<{ variation_index: number; prompt_id: string; params: Record<string, unknown> }> = [];

        for (let i = 0; i < variations.length; i++) {
          const mergedParams = { ...base_params, ...variations[i] };

          // If no seed specified per-variation, generate unique ones
          if (!mergedParams.seed && !base_params.seed) {
            mergedParams.seed = Math.floor(Math.random() * 2 ** 32);
          }

          const workflowId = templateHandler(template, mergedParams);
          const promptGraph = workflowBuilder.toPrompt(workflowId);
          const response = await client.queuePrompt({ prompt: promptGraph });

          if (response.error) {
            jobs.push({ variation_index: i, prompt_id: "", params: mergedParams });
          } else {
            jobs.push({ variation_index: i, prompt_id: response.prompt_id, params: mergedParams });
          }

          // Clean up in-memory workflow
          workflowBuilder.deleteWorkflow(workflowId);
        }

        if (!wait) {
          return {
            content: [{ type: "text", text: JSON.stringify({
              status: "queued",
              total_jobs: jobs.length,
              jobs: jobs.map(j => ({ index: j.variation_index, prompt_id: j.prompt_id })),
            }, null, 2) }],
          };
        }

        // Wait for all jobs
        const results = [];
        for (const job of jobs) {
          if (!job.prompt_id) {
            results.push({ index: job.variation_index, status: "error", error: "Failed to queue" });
            continue;
          }
          const result = await client.waitForJob(job.prompt_id, timeoutMs);
          results.push({
            index: job.variation_index,
            prompt_id: job.prompt_id,
            status: result.status,
            outputs: result.outputs,
            params_used: job.params,
          });
        }

        return {
          content: [{ type: "text", text: JSON.stringify({
            status: "completed",
            template,
            total: results.length,
            successful: results.filter(r => r.status === "completed").length,
            results,
          }, null, 2) }],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Batch error: ${(err as Error).message}` }], isError: true };
      }
    }

    case "comfy_clone_workflow": {
      const v = validateArgs(CloneWorkflowSchema, args);
      if (!v.success) return { content: [{ type: "text", text: v.error }], isError: true };

      try {
        const source = workflowBuilder.getWorkflow(v.data.workflow_id);
        if (!source) {
          return { content: [{ type: "text", text: `Workflow ${v.data.workflow_id} not found` }], isError: true };
        }

        // Export to prompt and reimport to create a deep copy
        const promptGraph = workflowBuilder.toPrompt(v.data.workflow_id);
        const cloned = workflowBuilder.loadFromPrompt(promptGraph, v.data.name || `${source.name}_clone`);

        // Apply overrides in "node_id.input_name" format
        if (v.data.overrides) {
          for (const [key, value] of Object.entries(v.data.overrides)) {
            const dotIdx = key.indexOf(".");
            if (dotIdx === -1) continue;
            const nodeId = key.slice(0, dotIdx);
            const inputName = key.slice(dotIdx + 1);
            try {
              workflowBuilder.setNodeInput(cloned.id, nodeId, inputName, value);
            } catch {
              // Node might not exist, skip silently
            }
          }
        }

        const summary = workflowBuilder.getWorkflowSummary(cloned.id);
        return {
          content: [{ type: "text", text: JSON.stringify({
            ...summary,
            message: "Workflow cloned. Use comfy_run_workflow to execute.",
          }, null, 2) }],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Clone error: ${(err as Error).message}` }], isError: true };
      }
    }

    case "comfy_save_preset": {
      const v = validateArgs(SavePresetSchema, args);
      if (!v.success) return { content: [{ type: "text", text: v.error }], isError: true };

      try {
        const preset = {
          name: v.data.name,
          description: v.data.description || "",
          template: v.data.template,
          params: v.data.params,
          created_at: new Date().toISOString(),
        };

        await workflowStore.savePreset(preset);

        return {
          content: [{ type: "text", text: JSON.stringify({
            status: "saved",
            name: preset.name,
            template: preset.template,
            message: `Preset "${preset.name}" saved. Use comfy_apply_preset to generate with it.`,
          }, null, 2) }],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${(err as Error).message}` }], isError: true };
      }
    }

    case "comfy_list_presets": {
      try {
        const presets = await workflowStore.listPresets();
        return {
          content: [{ type: "text", text: JSON.stringify({
            count: presets.length,
            presets: presets.map(p => ({
              name: p.name,
              description: p.description,
              template: p.template,
              created_at: p.created_at,
              params_summary: Object.keys(p.params).join(", "),
            })),
          }, null, 2) }],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${(err as Error).message}` }], isError: true };
      }
    }

    case "comfy_apply_preset": {
      const v = validateArgs(ApplyPresetSchema, args);
      if (!v.success) return { content: [{ type: "text", text: v.error }], isError: true };

      try {
        const preset = await workflowStore.getPreset(v.data.preset_name);
        if (!preset) {
          return { content: [{ type: "text", text: `Preset "${v.data.preset_name}" not found` }], isError: true };
        }

        const mergedParams = { ...preset.params, ...(v.data.overrides || {}) };
        const timeoutMs = (v.data.timeout || defaultTimeout) * 1000;

        const workflowId = templateHandler(preset.template, mergedParams);
        const promptGraph = workflowBuilder.toPrompt(workflowId);
        const response = await client.queuePrompt({ prompt: promptGraph });
        workflowBuilder.deleteWorkflow(workflowId);

        if (response.error) {
          return {
            content: [{ type: "text", text: JSON.stringify({ error: response.error, node_errors: response.node_errors }, null, 2) }],
            isError: true,
          };
        }

        if (!v.data.wait) {
          return {
            content: [{ type: "text", text: JSON.stringify({
              prompt_id: response.prompt_id,
              preset: preset.name,
              template: preset.template,
              status: "queued",
            }, null, 2) }],
          };
        }

        const result = await client.waitForJob(response.prompt_id, timeoutMs);
        return {
          content: [{ type: "text", text: JSON.stringify({
            ...result,
            preset: preset.name,
            template: preset.template,
          }, null, 2) }],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${(err as Error).message}` }], isError: true };
      }
    }

    case "comfy_sampler_sweep": {
      const v = validateArgs(SamplerSweepSchema, args);
      if (!v.success) return { content: [{ type: "text", text: v.error }], isError: true };

      try {
        const { template, params, samplers, schedulers, steps_range, cfg_range, wait, timeout } = v.data;
        const timeoutMs = (timeout || defaultTimeout) * 1000;

        // Build combinations
        const combos: Array<{ sampler_name?: string; scheduler?: string; steps?: number; cfg?: number }> = [];

        const samplerList = samplers || [params.sampler_name as string || "euler"];
        const schedulerList = schedulers || [params.scheduler as string || "normal"];
        const stepsList = steps_range || [params.steps as number || 20];
        const cfgList = cfg_range || [params.cfg as number || 7];

        for (const s of samplerList) {
          for (const sch of schedulerList) {
            for (const st of stepsList) {
              for (const c of cfgList) {
                combos.push({ sampler_name: s, scheduler: sch, steps: st, cfg: c });
              }
            }
          }
        }

        if (combos.length > 50) {
          return {
            content: [{ type: "text", text: `Too many combinations (${combos.length}). Max 50. Reduce parameter ranges.` }],
            isError: true,
          };
        }

        // Use same seed for fair comparison
        const baseSeed = (params.seed as number) || Math.floor(Math.random() * 2 ** 32);
        const templateName = template || "txt2img";

        const jobs: Array<{ combo: typeof combos[0]; prompt_id: string }> = [];
        for (const combo of combos) {
          const mergedParams = { ...params, ...combo, seed: baseSeed };
          const workflowId = templateHandler(templateName, mergedParams);
          const promptGraph = workflowBuilder.toPrompt(workflowId);
          const response = await client.queuePrompt({ prompt: promptGraph });
          workflowBuilder.deleteWorkflow(workflowId);

          if (response.prompt_id && !response.error) {
            jobs.push({ combo, prompt_id: response.prompt_id });
          }
        }

        if (!wait) {
          return {
            content: [{ type: "text", text: JSON.stringify({
              status: "queued",
              seed: baseSeed,
              total_combinations: jobs.length,
              jobs: jobs.map(j => ({ ...j.combo, prompt_id: j.prompt_id })),
            }, null, 2) }],
          };
        }

        const results = [];
        for (const job of jobs) {
          const result = await client.waitForJob(job.prompt_id, timeoutMs);
          results.push({
            ...job.combo,
            prompt_id: job.prompt_id,
            status: result.status,
            outputs: result.outputs,
          });
        }

        return {
          content: [{ type: "text", text: JSON.stringify({
            status: "completed",
            seed: baseSeed,
            total: results.length,
            successful: results.filter(r => r.status === "completed").length,
            results,
          }, null, 2) }],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Sweep error: ${(err as Error).message}` }], isError: true };
      }
    }

    case "comfy_generate_music": {
      const v = validateArgs(GenerateMusicSchema, args);
      if (!v.success) return { content: [{ type: "text", text: v.error }], isError: true };

      try {
        const { tags, lyrics, duration, bpm, language, keyscale, timesignature, model, seed, steps, cfg, wait, timeout } = v.data;
        const actualSeed = seed ?? Math.floor(Math.random() * 2 ** 32);
        const timeoutMs = (timeout || defaultTimeout) * 1000;

        const workflowId = templateHandler("ace_step_1_5", {
          tags,
          lyrics,
          duration,
          bpm,
          language,
          keyscale,
          timesignature,
          model: model || "ace_step_1.5_turbo_aio.safetensors",
          seed: actualSeed,
          steps,
          cfg,
        });

        const promptGraph = workflowBuilder.toPrompt(workflowId);
        const response = await client.queuePrompt({ prompt: promptGraph });
        workflowBuilder.deleteWorkflow(workflowId);

        if (response.error) {
          return {
            content: [{ type: "text", text: JSON.stringify({ error: response.error, node_errors: response.node_errors }, null, 2) }],
            isError: true,
          };
        }

        if (!wait) {
          return {
            content: [{ type: "text", text: JSON.stringify({
              prompt_id: response.prompt_id,
              status: "queued",
              tags,
              duration,
              bpm,
              seed: actualSeed,
            }, null, 2) }],
          };
        }

        const result = await client.waitForJob(response.prompt_id, timeoutMs);
        return {
          content: [{ type: "text", text: JSON.stringify({
            ...result,
            tags,
            duration,
            bpm,
            keyscale,
            seed: actualSeed,
          }, null, 2) }],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Music generation error: ${(err as Error).message}` }], isError: true };
      }
    }

    case "comfy_keyframe_video": {
      const v = validateArgs(KeyframeVideoSchema, args);
      if (!v.success) return { content: [{ type: "text", text: v.error }], isError: true };

      try {
        const { start_image, end_image, prompt, negative_prompt, diffusion_model, width, height, steps, cfg, seed, wait, timeout } = v.data;
        const frameCount = v.data.length ?? 81;
        const actualSeed = seed ?? Math.floor(Math.random() * 2 ** 32);
        const timeoutMs = (timeout || defaultTimeout) * 1000;

        const workflowId = templateHandler("wan_flf_video", {
          start_image,
          end_image,
          prompt,
          negative_prompt,
          diffusion_model: diffusion_model || "wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors",
          width,
          height,
          length: frameCount,
          steps,
          cfg,
          seed: actualSeed,
        });

        const promptGraph = workflowBuilder.toPrompt(workflowId);
        const response = await client.queuePrompt({ prompt: promptGraph });
        workflowBuilder.deleteWorkflow(workflowId);

        if (response.error) {
          return {
            content: [{ type: "text", text: JSON.stringify({ error: response.error, node_errors: response.node_errors }, null, 2) }],
            isError: true,
          };
        }

        if (!wait) {
          return {
            content: [{ type: "text", text: JSON.stringify({
              prompt_id: response.prompt_id,
              status: "queued",
              start_image,
              end_image,
              frames: frameCount,
              seed: actualSeed,
            }, null, 2) }],
          };
        }

        const result = await client.waitForJob(response.prompt_id, timeoutMs);
        return {
          content: [{ type: "text", text: JSON.stringify({
            ...result,
            start_image,
            end_image,
            frames: frameCount,
            duration_seconds: frameCount / 16,
            seed: actualSeed,
          }, null, 2) }],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Keyframe video error: ${(err as Error).message}` }], isError: true };
      }
    }

    case "comfy_create_short": {
      const v = validateArgs(CreateShortSchema, args);
      if (!v.success) return { content: [{ type: "text", text: v.error }], isError: true };

      try {
        const {
          scenes, mode, music_tags, music_lyrics, duration, image_model, video_model,
          width, height, frames_per_transition, video_steps, video_cfg, music_bpm, seed, timeout,
        } = v.data;

        const baseSeed = seed ?? Math.floor(Math.random() * 2 ** 32);
        const timeoutMs = (timeout ?? 600) * 1000;
        const framesPerTrans = frames_per_transition ?? 81;
        const targetDuration = duration ?? 30;
        const pipelineMode = mode ?? "keyframe";
        const perJobTimeout = Math.floor(timeoutMs / (scenes.length + 2));
        const results: {
          step: string;
          status: string;
          prompt_id?: string;
          outputs?: unknown;
          error?: unknown;
        }[] = [];

        const videoOutputs: string[] = [];

        if (pipelineMode === "keyframe") {
          // --- KEYFRAME MODE: Generate images then FLF transitions ---

          const keyframeImages: string[] = [];
          for (let i = 0; i < scenes.length; i++) {
            const scene = scenes[i];
            const imgSeed = baseSeed + i;

            const wfId = templateHandler("txt2img", {
              prompt: scene.prompt,
              negative_prompt: scene.negative_prompt || "",
              model: image_model,
              width,
              height,
              seed: imgSeed,
              steps: 20,
              cfg: 7,
              filename_prefix: `short/keyframe_${i}`,
            });

            const promptGraph = workflowBuilder.toPrompt(wfId);
            const response = await client.queuePrompt({ prompt: promptGraph });
            workflowBuilder.deleteWorkflow(wfId);

            if (response.error) {
              results.push({ step: `keyframe_${i}`, status: "error", error: JSON.stringify(response.error) });
              continue;
            }

            const jobResult = await client.waitForJob(response.prompt_id, perJobTimeout);
            results.push({ step: `keyframe_${i}`, status: jobResult.status, prompt_id: response.prompt_id, outputs: jobResult.outputs });

            if (jobResult.outputs) {
              const outputs = jobResult.outputs as Record<string, { images?: Array<{ filename: string; subfolder?: string }> }>;
              for (const nodeOutput of Object.values(outputs)) {
                if (nodeOutput.images && nodeOutput.images.length > 0) {
                  keyframeImages.push(nodeOutput.images[0].filename);
                  break;
                }
              }
            }
          }

          try { await client.freeMemory({ unload_models: true, free_memory: true }); } catch { /* non-critical */ }

          if (keyframeImages.length >= 2) {
            for (let i = 0; i < keyframeImages.length - 1; i++) {
              const transitionPrompt = `${scenes[i].prompt} transitioning to ${scenes[i + 1].prompt}`;
              const vidSeed = baseSeed + 1000 + i;

              const wfId = templateHandler("wan_flf_video", {
                start_image: keyframeImages[i],
                end_image: keyframeImages[i + 1],
                prompt: transitionPrompt,
                negative_prompt: "blurry, distorted, low quality",
                diffusion_model: video_model || "wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors",
                width,
                height,
                length: framesPerTrans,
                steps: video_steps,
                cfg: video_cfg,
                seed: vidSeed,
                filename_prefix: `short/transition_${i}`,
              });

              const promptGraph = workflowBuilder.toPrompt(wfId);
              const response = await client.queuePrompt({ prompt: promptGraph });
              workflowBuilder.deleteWorkflow(wfId);

              if (response.error) {
                results.push({ step: `transition_${i}`, status: "error", error: JSON.stringify(response.error) });
                continue;
              }

              const jobResult = await client.waitForJob(response.prompt_id, perJobTimeout);
              results.push({ step: `transition_${i}`, status: jobResult.status, prompt_id: response.prompt_id, outputs: jobResult.outputs });

              if (jobResult.outputs) {
                const outputs = jobResult.outputs as Record<string, { videos?: Array<{ filename: string; subfolder?: string }> }>;
                for (const nodeOutput of Object.values(outputs)) {
                  if (nodeOutput.videos && nodeOutput.videos.length > 0) {
                    videoOutputs.push(nodeOutput.videos[0].filename);
                    break;
                  }
                }
              }
            }
          }
        } else {
          // --- T2V MODE: Generate video clips directly from text ---

          for (let i = 0; i < scenes.length; i++) {
            const scene = scenes[i];
            const vidSeed = baseSeed + 1000 + i;

            const wfId = templateHandler("wan_t2v", {
              prompt: scene.prompt,
              negative_prompt: scene.negative_prompt || "blurry, distorted, low quality",
              diffusion_model: video_model || "wan2.2_t2v_high_noise_14B_fp8_scaled.safetensors",
              width,
              height,
              length: framesPerTrans,
              steps: video_steps,
              cfg: video_cfg,
              seed: vidSeed,
              filename_prefix: `short/scene_${i}`,
            });

            const promptGraph = workflowBuilder.toPrompt(wfId);
            const response = await client.queuePrompt({ prompt: promptGraph });
            workflowBuilder.deleteWorkflow(wfId);

            if (response.error) {
              results.push({ step: `scene_${i}`, status: "error", error: JSON.stringify(response.error) });
              continue;
            }

            const jobResult = await client.waitForJob(response.prompt_id, perJobTimeout);
            results.push({ step: `scene_${i}`, status: jobResult.status, prompt_id: response.prompt_id, outputs: jobResult.outputs });

            if (jobResult.outputs) {
              const outputs = jobResult.outputs as Record<string, { videos?: Array<{ filename: string; subfolder?: string }> }>;
              for (const nodeOutput of Object.values(outputs)) {
                if (nodeOutput.videos && nodeOutput.videos.length > 0) {
                  videoOutputs.push(nodeOutput.videos[0].filename);
                  break;
                }
              }
            }

            try { await client.freeMemory({ unload_models: true, free_memory: true }); } catch { /* non-critical */ }
          }
        }

        // Free memory before audio generation
        try { await client.freeMemory({ unload_models: true, free_memory: true }); } catch { /* non-critical */ }

        // --- Step 3: Generate background music ---
        const totalVideoSeconds = videoOutputs.length * (framesPerTrans / 16);
        const musicDuration = Math.min(targetDuration, Math.max(totalVideoSeconds, 10));
        let audioFilename = "";

        const musicWorkflowId = templateHandler("ace_step_1_5", {
          tags: music_tags,
          lyrics: music_lyrics,
          duration: musicDuration,
          bpm: music_bpm,
          seed: baseSeed + 9000,
          steps: 8,
          cfg: 2.0,
        });

        const musicPromptGraph = workflowBuilder.toPrompt(musicWorkflowId);
        const musicResponse = await client.queuePrompt({ prompt: musicPromptGraph });
        workflowBuilder.deleteWorkflow(musicWorkflowId);

        if (musicResponse.error) {
          results.push({ step: "music", status: "error", error: JSON.stringify(musicResponse.error) });
        } else {
          const musicResult = await client.waitForJob(musicResponse.prompt_id, perJobTimeout);
          results.push({ step: "music", status: musicResult.status, prompt_id: musicResponse.prompt_id, outputs: musicResult.outputs });

          if (musicResult.outputs) {
            const outputs = musicResult.outputs as Record<string, { audio?: Array<{ filename: string; subfolder?: string }> }>;
            for (const nodeOutput of Object.values(outputs)) {
              if (nodeOutput.audio && nodeOutput.audio.length > 0) {
                audioFilename = nodeOutput.audio[0].filename;
                break;
              }
            }
          }
        }

        // --- Step 4: Combine video + audio with ffmpeg ---
        let finalOutput = "";
        let muxStatus = "skipped";

        if (videoOutputs.length > 0 && audioFilename) {
          try {
            const tempDir = join(tmpdir(), `comfy_short_${baseSeed}`);
            mkdirSync(tempDir, { recursive: true });

            const localVideos: string[] = [];
            for (let i = 0; i < videoOutputs.length; i++) {
              const videoBuffer = await client.viewImage(videoOutputs[i], { type: "output", subfolder: "short" });
              const localPath = join(tempDir, `segment_${i}.mp4`);
              writeFileSync(localPath, videoBuffer);
              localVideos.push(localPath);
            }

            const audioBuffer = await client.viewImage(audioFilename, { type: "output", subfolder: "audio" });
            const localAudio = join(tempDir, "music.flac");
            writeFileSync(localAudio, audioBuffer);

            const concatList = join(tempDir, "filelist.txt");
            const listContent = localVideos.map(p => `file '${p.replace(/\\/g, "/")}'`).join("\n");
            writeFileSync(concatList, listContent);

            const outputPath = join(tempDir, "final_short.mp4");

            const ffmpegCmd = localVideos.length === 1
              ? `ffmpeg -y -i "${localVideos[0]}" -i "${localAudio}" -c:v copy -c:a aac -shortest "${outputPath}"`
              : `ffmpeg -y -f concat -safe 0 -i "${concatList}" -i "${localAudio}" -c:v copy -c:a aac -shortest "${outputPath}"`;

            execSync(ffmpegCmd, { stdio: "pipe", timeout: 60000 });

            if (existsSync(outputPath)) {
              const finalBuffer = readFileSync(outputPath);
              await client.uploadImage(finalBuffer, "final_short.mp4", { subfolder: "short", type: "output", overwrite: true });
              finalOutput = "short/final_short.mp4";
              muxStatus = "completed";
            }

            for (const f of localVideos) { try { unlinkSync(f); } catch { /* cleanup */ } }
            try { unlinkSync(localAudio); } catch { /* cleanup */ }
            try { unlinkSync(concatList); } catch { /* cleanup */ }
            try { unlinkSync(outputPath); } catch { /* cleanup */ }
            try { rmSync(tempDir, { recursive: true, force: true }); } catch { /* cleanup */ }
          } catch (muxErr) {
            muxStatus = `failed: ${(muxErr as Error).message}`;
          }
        }

        // --- Summary ---
        const successful = results.filter(r => r.status === "completed").length;
        return {
          content: [{ type: "text", text: JSON.stringify({
            status: successful === results.length && muxStatus === "completed" ? "completed" : "partial",
            mode: pipelineMode,
            total_steps: results.length,
            successful,
            video_segments: videoOutputs.length,
            music_generated: results.some(r => r.step === "music" && r.status === "completed"),
            mux_status: muxStatus,
            final_output: finalOutput || undefined,
            video_files: videoOutputs,
            audio_file: audioFilename || undefined,
            target_duration_seconds: musicDuration,
            actual_video_seconds: totalVideoSeconds,
            base_seed: baseSeed,
            results,
          }, null, 2) }],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Short creation error: ${(err as Error).message}` }], isError: true };
      }
    }

    default:
      return { content: [{ type: "text", text: `Unknown advanced tool: ${toolName}` }], isError: true };
  }
}
