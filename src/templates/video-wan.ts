import { WorkflowBuilder } from "../workflow-builder.js";

export interface WanVideoParams {
  unet_model?: string;
  clip_model?: string;
  vae_model?: string;
  clip_vision_model?: string;
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
  start_image?: string;
  filename_prefix?: string;
}

export function createWanVideoWorkflow(builder: WorkflowBuilder, params: WanVideoParams): string {
  const {
    unet_model = "wan2.1_i2v_720p_14s_bf16.safetensors",
    clip_model = "umt5_xxl_fp8_e4m3fn.safetensors",
    vae_model = "wan_2.1_vae.safetensors",
    clip_vision_model = "clip_vision_h.safetensors",
    prompt,
    negative_prompt = "",
    width = 832,
    height = 480,
    length = 81,
    steps = 30,
    cfg = 6.0,
    seed = Math.floor(Math.random() * 2 ** 32),
    sampler_name = "uni_pc_bh2",
    scheduler = "simple",
    start_image,
    filename_prefix = "video/ComfyUI_wan",
  } = params;

  const workflow = builder.createWorkflow("wan_video");

  // Model loaders
  builder.addNode(workflow.id, "UNETLoader", { unet_name: unet_model, weight_dtype: "default" }, "1");
  builder.addNode(workflow.id, "CLIPLoader", { clip_name: clip_model, type: "wan" }, "2");
  builder.addNode(workflow.id, "VAELoader", { vae_name: vae_model }, "3");

  // Text encoding
  builder.addNode(workflow.id, "CLIPTextEncode", { text: prompt }, "4");
  builder.addNode(workflow.id, "CLIPTextEncode", { text: negative_prompt }, "5");
  builder.connectNodes(workflow.id, "2", 0, "4", "clip");
  builder.connectNodes(workflow.id, "2", 0, "5", "clip");

  // WanImageToVideo conditioning
  const wanInputs: Record<string, unknown> = { width, height, length, batch_size: 1 };
  builder.addNode(workflow.id, "WanImageToVideo", wanInputs, "6");
  builder.connectNodes(workflow.id, "4", 0, "6", "positive");
  builder.connectNodes(workflow.id, "5", 0, "6", "negative");
  builder.connectNodes(workflow.id, "3", 0, "6", "vae");

  // Optional start image for image-to-video
  if (start_image) {
    builder.addNode(workflow.id, "LoadImage", { image: start_image }, "10");
    builder.connectNodes(workflow.id, "10", 0, "6", "start_image");
    // CLIP Vision for image conditioning
    builder.addNode(workflow.id, "CLIPVisionLoader", { clip_name: clip_vision_model }, "11");
    builder.addNode(workflow.id, "CLIPVisionEncode", {}, "12");
    builder.connectNodes(workflow.id, "11", 0, "12", "clip_vision");
    builder.connectNodes(workflow.id, "10", 0, "12", "image");
    builder.connectNodes(workflow.id, "12", 0, "6", "clip_vision_output");
  }

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
  builder.connectNodes(workflow.id, "6", 0, "7", "positive");
  builder.connectNodes(workflow.id, "6", 1, "7", "negative");
  builder.connectNodes(workflow.id, "6", 2, "7", "latent_image");

  // VAE Decode
  builder.addNode(workflow.id, "VAEDecode", {}, "8");
  builder.connectNodes(workflow.id, "7", 0, "8", "samples");
  builder.connectNodes(workflow.id, "3", 0, "8", "vae");

  // Save Video
  builder.addNode(workflow.id, "SaveVideo", { filename_prefix, format: "video/h264-mp4" }, "9");
  builder.connectNodes(workflow.id, "8", 0, "9", "images");

  return workflow.id;
}
