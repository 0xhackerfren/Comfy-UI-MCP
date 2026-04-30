import { WorkflowBuilder } from "../workflow-builder.js";

export interface WanT2VParams {
  diffusion_model?: string;
  text_encoder?: string;
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

export function createWanT2VWorkflow(builder: WorkflowBuilder, params: WanT2VParams): string {
  const {
    diffusion_model = "wan2.2_t2v_high_noise_14B_fp8_scaled.safetensors",
    text_encoder = "umt5_xxl_fp8_e4m3fn_scaled.safetensors",
    vae_model = "wan_2.1_vae.safetensors",
    prompt,
    negative_prompt = "",
    width = 832,
    height = 480,
    length = 81,
    steps = 20,
    cfg = 6.0,
    seed = Math.floor(Math.random() * 2 ** 32),
    sampler_name = "uni_pc_bh2",
    scheduler = "simple",
    filename_prefix = "video/ComfyUI_t2v",
  } = params;

  const workflow = builder.createWorkflow("wan_t2v");

  builder.addNode(workflow.id, "UNETLoader", { unet_name: diffusion_model, weight_dtype: "default" }, "1");
  builder.addNode(workflow.id, "CLIPLoader", { clip_name: text_encoder, type: "wan" }, "2");
  builder.addNode(workflow.id, "VAELoader", { vae_name: vae_model }, "3");

  builder.addNode(workflow.id, "CLIPTextEncode", { text: prompt }, "4");
  builder.addNode(workflow.id, "CLIPTextEncode", { text: negative_prompt }, "5");
  builder.connectNodes(workflow.id, "2", 0, "4", "clip");
  builder.connectNodes(workflow.id, "2", 0, "5", "clip");

  builder.addNode(workflow.id, "EmptySD3LatentImage", { width, height, batch_size: length }, "6");

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

  builder.addNode(workflow.id, "VAEDecode", {}, "8");
  builder.connectNodes(workflow.id, "7", 0, "8", "samples");
  builder.connectNodes(workflow.id, "3", 0, "8", "vae");

  builder.addNode(workflow.id, "CreateVideo", { fps: 16.0 }, "12");
  builder.connectNodes(workflow.id, "8", 0, "12", "images");
  builder.addNode(workflow.id, "SaveVideo", { filename_prefix, format: "auto", codec: "auto" }, "9");
  builder.connectNodes(workflow.id, "12", 0, "9", "video");

  return workflow.id;
}
