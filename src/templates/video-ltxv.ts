import { WorkflowBuilder } from "../workflow-builder.js";

export interface LTXVParams {
  unet_model?: string;
  clip_model?: string;
  vae_model?: string;
  prompt: string;
  negative_prompt?: string;
  width?: number;
  height?: number;
  length?: number;
  steps?: number;
  cfg?: number;
  seed?: number;
  sampler_name?: string;
  scheduler?: string;
  filename_prefix?: string;
}

export function createLTXVWorkflow(builder: WorkflowBuilder, params: LTXVParams): string {
  const {
    unet_model = "ltx-video-2b-v0.9.5.safetensors",
    clip_model = "t5xxl_fp16.safetensors",
    vae_model = "ltxv_vae.safetensors",
    prompt,
    negative_prompt = "",
    width = 768,
    height = 512,
    length = 97,
    steps = 30,
    cfg = 3.0,
    seed = Math.floor(Math.random() * 2 ** 32),
    sampler_name = "euler",
    scheduler = "simple",
    filename_prefix = "video/ComfyUI_ltxv",
  } = params;

  const workflow = builder.createWorkflow("ltxv_video");

  // Model loading
  builder.addNode(workflow.id, "UNETLoader", { unet_name: unet_model, weight_dtype: "default" }, "1");
  builder.addNode(workflow.id, "CLIPLoader", { clip_name: clip_model, type: "ltxv" }, "2");
  builder.addNode(workflow.id, "VAELoader", { vae_name: vae_model }, "3");

  // Text encoding
  builder.addNode(workflow.id, "CLIPTextEncode", { text: prompt }, "4");
  builder.addNode(workflow.id, "CLIPTextEncode", { text: negative_prompt }, "5");
  builder.connectNodes(workflow.id, "2", 0, "4", "clip");
  builder.connectNodes(workflow.id, "2", 0, "5", "clip");

  // Empty latent for video
  builder.addNode(workflow.id, "EmptyLatentImage", { width, height, batch_size: length }, "6");

  // KSampler
  builder.addNode(workflow.id, "KSampler", {
    seed,
    steps,
    cfg,
    sampler_name,
    scheduler,
    denoise: 1.0,
  }, "7");
  builder.connectNodes(workflow.id, "1", 0, "7", "model");
  builder.connectNodes(workflow.id, "4", 0, "7", "positive");
  builder.connectNodes(workflow.id, "5", 0, "7", "negative");
  builder.connectNodes(workflow.id, "6", 0, "7", "latent_image");

  // VAE Decode
  builder.addNode(workflow.id, "VAEDecode", {}, "8");
  builder.connectNodes(workflow.id, "7", 0, "8", "samples");
  builder.connectNodes(workflow.id, "3", 0, "8", "vae");

  // Save video
  builder.addNode(workflow.id, "SaveVideo", { filename_prefix, format: "video/h264-mp4" }, "9");
  builder.connectNodes(workflow.id, "8", 0, "9", "images");

  return workflow.id;
}
