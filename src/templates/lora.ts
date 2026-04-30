import { WorkflowBuilder } from "../workflow-builder.js";

export interface LoraParams {
  model?: string;
  lora_name: string;
  lora_strength?: number;
  clip_strength?: number;
  prompt: string;
  negative_prompt?: string;
  width?: number;
  height?: number;
  steps?: number;
  cfg?: number;
  seed?: number;
  sampler_name?: string;
  scheduler?: string;
}

export function createLoraWorkflow(builder: WorkflowBuilder, params: LoraParams): string {
  const {
    model = "v1-5-pruned-emaonly.safetensors",
    lora_name,
    lora_strength = 1.0,
    clip_strength = 1.0,
    prompt,
    negative_prompt = "",
    width = 512,
    height = 512,
    steps = 20,
    cfg = 7.0,
    seed = Math.floor(Math.random() * 2 ** 32),
    sampler_name = "euler",
    scheduler = "normal",
  } = params;

  const workflow = builder.createWorkflow("lora");

  builder.addNode(workflow.id, "CheckpointLoaderSimple", { ckpt_name: model }, "1");
  builder.addNode(workflow.id, "LoraLoader", {
    lora_name,
    strength_model: lora_strength,
    strength_clip: clip_strength,
  }, "2");
  builder.addNode(workflow.id, "CLIPTextEncode", { text: prompt }, "3");
  builder.addNode(workflow.id, "CLIPTextEncode", { text: negative_prompt }, "4");
  builder.addNode(workflow.id, "EmptyLatentImage", { width, height, batch_size: 1 }, "5");
  builder.addNode(workflow.id, "KSampler", {
    seed,
    steps,
    cfg,
    sampler_name,
    scheduler,
    denoise: 1.0,
  }, "6");
  builder.addNode(workflow.id, "VAEDecode", {}, "7");
  builder.addNode(workflow.id, "SaveImage", { filename_prefix: "ComfyUI_lora" }, "8");

  // Checkpoint -> LoraLoader (model + clip)
  builder.connectNodes(workflow.id, "1", 0, "2", "model");
  builder.connectNodes(workflow.id, "1", 1, "2", "clip");
  // LoraLoader outputs: MODEL(0), CLIP(1)
  builder.connectNodes(workflow.id, "2", 1, "3", "clip");
  builder.connectNodes(workflow.id, "2", 1, "4", "clip");
  // LoraLoader model -> KSampler
  builder.connectNodes(workflow.id, "2", 0, "6", "model");
  // Prompts -> KSampler
  builder.connectNodes(workflow.id, "3", 0, "6", "positive");
  builder.connectNodes(workflow.id, "4", 0, "6", "negative");
  // EmptyLatent -> KSampler
  builder.connectNodes(workflow.id, "5", 0, "6", "latent_image");
  // KSampler -> VAEDecode -> SaveImage
  builder.connectNodes(workflow.id, "6", 0, "7", "samples");
  builder.connectNodes(workflow.id, "1", 2, "7", "vae");
  builder.connectNodes(workflow.id, "7", 0, "8", "images");

  return workflow.id;
}
