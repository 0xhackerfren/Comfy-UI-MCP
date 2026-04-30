import { WorkflowBuilder } from "../workflow-builder.js";

export interface FluxParams {
  unet_model?: string;
  clip_model1?: string;
  clip_model2?: string;
  vae_model?: string;
  prompt: string;
  width?: number;
  height?: number;
  steps?: number;
  cfg?: number;
  seed?: number;
  sampler_name?: string;
  scheduler?: string;
  batch_size?: number;
  filename_prefix?: string;
}

export function createFluxWorkflow(builder: WorkflowBuilder, params: FluxParams): string {
  const {
    unet_model = "flux1-dev.safetensors",
    clip_model1 = "clip_l.safetensors",
    clip_model2 = "t5xxl_fp16.safetensors",
    vae_model = "ae.safetensors",
    prompt,
    width = 1024,
    height = 1024,
    steps = 20,
    cfg = 1.0,
    seed = Math.floor(Math.random() * 2 ** 32),
    sampler_name = "euler",
    scheduler = "simple",
    batch_size = 1,
    filename_prefix = "ComfyUI_flux",
  } = params;

  const workflow = builder.createWorkflow("flux");

  builder.addNode(workflow.id, "UNETLoader", { unet_name: unet_model, weight_dtype: "default" }, "1");
  builder.addNode(workflow.id, "DualCLIPLoader", {
    clip_name1: clip_model1,
    clip_name2: clip_model2,
    type: "flux",
  }, "2");
  builder.addNode(workflow.id, "VAELoader", { vae_name: vae_model }, "3");
  builder.addNode(workflow.id, "CLIPTextEncode", { text: prompt }, "4");
  builder.addNode(workflow.id, "EmptyLatentImage", { width, height, batch_size }, "5");
  builder.addNode(workflow.id, "KSampler", {
    seed,
    steps,
    cfg,
    sampler_name,
    scheduler,
    denoise: 1.0,
  }, "6");
  builder.addNode(workflow.id, "VAEDecode", {}, "7");
  builder.addNode(workflow.id, "SaveImage", { filename_prefix }, "8");

  // UNETLoader -> KSampler model
  builder.connectNodes(workflow.id, "1", 0, "6", "model");
  // DualCLIPLoader -> CLIPTextEncode
  builder.connectNodes(workflow.id, "2", 0, "4", "clip");
  // CLIPTextEncode -> KSampler positive (Flux uses guidance in the prompt itself)
  builder.connectNodes(workflow.id, "4", 0, "6", "positive");
  // Empty conditioning for negative (Flux typically doesn't use negative)
  builder.addNode(workflow.id, "CLIPTextEncode", { text: "" }, "9");
  builder.connectNodes(workflow.id, "2", 0, "9", "clip");
  builder.connectNodes(workflow.id, "9", 0, "6", "negative");
  // EmptyLatentImage -> KSampler
  builder.connectNodes(workflow.id, "5", 0, "6", "latent_image");
  // KSampler -> VAEDecode
  builder.connectNodes(workflow.id, "6", 0, "7", "samples");
  // VAELoader -> VAEDecode
  builder.connectNodes(workflow.id, "3", 0, "7", "vae");
  // VAEDecode -> SaveImage
  builder.connectNodes(workflow.id, "7", 0, "8", "images");

  return workflow.id;
}
