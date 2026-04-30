import { WorkflowBuilder } from "../workflow-builder.js";

export interface SDXLParams {
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

export function createSDXLWorkflow(builder: WorkflowBuilder, params: SDXLParams): string {
  const {
    model = "sd_xl_base_1.0.safetensors",
    prompt,
    negative_prompt = "",
    width = 1024,
    height = 1024,
    steps = 25,
    cfg = 7.0,
    seed = Math.floor(Math.random() * 2 ** 32),
    sampler_name = "euler",
    scheduler = "normal",
    batch_size = 1,
    filename_prefix = "ComfyUI_sdxl",
  } = params;

  const workflow = builder.createWorkflow("sdxl");

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

  // Checkpoint -> CLIP -> prompts
  builder.connectNodes(workflow.id, "1", 1, "2", "clip");
  builder.connectNodes(workflow.id, "1", 1, "3", "clip");
  // Checkpoint model -> KSampler
  builder.connectNodes(workflow.id, "1", 0, "5", "model");
  // Prompts -> KSampler
  builder.connectNodes(workflow.id, "2", 0, "5", "positive");
  builder.connectNodes(workflow.id, "3", 0, "5", "negative");
  // EmptyLatent -> KSampler
  builder.connectNodes(workflow.id, "4", 0, "5", "latent_image");
  // KSampler -> VAEDecode -> Save
  builder.connectNodes(workflow.id, "5", 0, "6", "samples");
  builder.connectNodes(workflow.id, "1", 2, "6", "vae");
  builder.connectNodes(workflow.id, "6", 0, "7", "images");

  return workflow.id;
}
