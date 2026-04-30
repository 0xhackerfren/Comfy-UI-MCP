import { WorkflowBuilder } from "../workflow-builder.js";

export interface WanFLFVideoParams {
  diffusion_model?: string;
  text_encoder?: string;
  vae_model?: string;
  prompt: string;
  negative_prompt?: string;
  start_image: string;
  end_image: string;
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

export function createWanFLFVideoWorkflow(builder: WorkflowBuilder, params: WanFLFVideoParams): string {
  const {
    diffusion_model = "wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors",
    text_encoder = "umt5_xxl_fp8_e4m3fn_scaled.safetensors",
    vae_model = "wan_2.1_vae.safetensors",
    prompt,
    negative_prompt = "",
    start_image,
    end_image,
    width = 832,
    height = 480,
    length = 81,
    steps = 20,
    cfg = 6.0,
    seed = Math.floor(Math.random() * 2 ** 32),
    sampler_name = "uni_pc_bh2",
    scheduler = "simple",
    filename_prefix = "video/ComfyUI_flf",
  } = params;

  const workflow = builder.createWorkflow("wan_flf_video");

  // Model loaders
  builder.addNode(workflow.id, "UNETLoader", { unet_name: diffusion_model, weight_dtype: "default" }, "1");
  builder.addNode(workflow.id, "CLIPLoader", { clip_name: text_encoder, type: "wan" }, "2");
  builder.addNode(workflow.id, "VAELoader", { vae_name: vae_model }, "3");

  // Text encoding
  builder.addNode(workflow.id, "CLIPTextEncode", { text: prompt }, "4");
  builder.addNode(workflow.id, "CLIPTextEncode", { text: negative_prompt }, "5");
  builder.connectNodes(workflow.id, "2", 0, "4", "clip");
  builder.connectNodes(workflow.id, "2", 0, "5", "clip");

  // Load start and end images
  builder.addNode(workflow.id, "LoadImage", { image: start_image }, "10");
  builder.addNode(workflow.id, "LoadImage", { image: end_image }, "11");

  // WanFirstLastFrameToVideo conditioning
  builder.addNode(workflow.id, "WanFirstLastFrameToVideo", {
    width,
    height,
    length,
    batch_size: 1,
  }, "6");
  builder.connectNodes(workflow.id, "4", 0, "6", "positive");
  builder.connectNodes(workflow.id, "5", 0, "6", "negative");
  builder.connectNodes(workflow.id, "3", 0, "6", "vae");
  builder.connectNodes(workflow.id, "10", 0, "6", "start_image");
  builder.connectNodes(workflow.id, "11", 0, "6", "end_image");

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

  // Save as video
  builder.addNode(workflow.id, "SaveVideo", { filename_prefix, format: "auto", codec: "auto" }, "9");
  builder.addNode(workflow.id, "CreateVideo", { fps: 16.0 }, "12");
  builder.connectNodes(workflow.id, "8", 0, "12", "images");
  builder.connectNodes(workflow.id, "12", 0, "9", "video");

  return workflow.id;
}
