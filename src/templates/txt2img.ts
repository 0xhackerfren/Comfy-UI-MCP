import { WorkflowBuilder } from "../workflow-builder.js";

export interface Txt2ImgParams {
  model?: string;
  prompt: string;
  negative_prompt?: string;
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

export function createTxt2ImgWorkflow(builder: WorkflowBuilder, params: Txt2ImgParams): string {
  const {
    model = "v1-5-pruned-emaonly.safetensors",
    prompt,
    negative_prompt = "",
    width = 512,
    height = 512,
    steps = 20,
    cfg = 7.0,
    seed = Math.floor(Math.random() * 2 ** 32),
    sampler_name = "euler",
    scheduler = "normal",
    batch_size = 1,
    filename_prefix = "ComfyUI",
  } = params;

  const workflow = builder.createWorkflow("txt2img");

  builder.addNode(workflow.id, "CheckpointLoaderSimple", { ckpt_name: model }, "1");
  builder.addNode(workflow.id, "CLIPTextEncode", { text: prompt }, "2");
  builder.addNode(workflow.id, "CLIPTextEncode", { text: negative_prompt }, "3");
  builder.addNode(workflow.id, "EmptyLatentImage", { width, height, batch_size }, "4");
  builder.addNode(workflow.id, "KSampler", {
    seed,
    steps,
    cfg,
    sampler_name,
    scheduler,
    denoise: 1.0,
  }, "5");
  builder.addNode(workflow.id, "VAEDecode", {}, "6");
  builder.addNode(workflow.id, "SaveImage", { filename_prefix }, "7");

  // CheckpointLoader -> CLIP -> positive prompt
  builder.connectNodes(workflow.id, "1", 1, "2", "clip");
  // CheckpointLoader -> CLIP -> negative prompt
  builder.connectNodes(workflow.id, "1", 1, "3", "clip");
  // CheckpointLoader -> model -> KSampler
  builder.connectNodes(workflow.id, "1", 0, "5", "model");
  // Positive prompt -> KSampler
  builder.connectNodes(workflow.id, "2", 0, "5", "positive");
  // Negative prompt -> KSampler
  builder.connectNodes(workflow.id, "3", 0, "5", "negative");
  // Empty latent -> KSampler
  builder.connectNodes(workflow.id, "4", 0, "5", "latent_image");
  // KSampler -> VAEDecode
  builder.connectNodes(workflow.id, "5", 0, "6", "samples");
  // CheckpointLoader -> VAE -> VAEDecode
  builder.connectNodes(workflow.id, "1", 2, "6", "vae");
  // VAEDecode -> SaveImage
  builder.connectNodes(workflow.id, "6", 0, "7", "images");

  return workflow.id;
}
