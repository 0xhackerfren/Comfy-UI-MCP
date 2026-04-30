import { WorkflowBuilder } from "../workflow-builder.js";

export interface ControlNetParams {
  model?: string;
  controlnet_model: string;
  control_image: string;
  prompt: string;
  negative_prompt?: string;
  width?: number;
  height?: number;
  steps?: number;
  cfg?: number;
  seed?: number;
  sampler_name?: string;
  scheduler?: string;
  controlnet_strength?: number;
}

export function createControlNetWorkflow(builder: WorkflowBuilder, params: ControlNetParams): string {
  const {
    model = "v1-5-pruned-emaonly.safetensors",
    controlnet_model,
    control_image,
    prompt,
    negative_prompt = "",
    width = 512,
    height = 512,
    steps = 20,
    cfg = 7.0,
    seed = Math.floor(Math.random() * 2 ** 32),
    sampler_name = "euler",
    scheduler = "normal",
    controlnet_strength = 1.0,
  } = params;

  const workflow = builder.createWorkflow("controlnet");

  builder.addNode(workflow.id, "CheckpointLoaderSimple", { ckpt_name: model }, "1");
  builder.addNode(workflow.id, "CLIPTextEncode", { text: prompt }, "2");
  builder.addNode(workflow.id, "CLIPTextEncode", { text: negative_prompt }, "3");
  builder.addNode(workflow.id, "EmptyLatentImage", { width, height, batch_size: 1 }, "4");
  builder.addNode(workflow.id, "ControlNetLoader", { control_net_name: controlnet_model }, "5");
  builder.addNode(workflow.id, "LoadImage", { image: control_image }, "6");
  builder.addNode(workflow.id, "ControlNetApplyAdvanced", { strength: controlnet_strength, start_percent: 0.0, end_percent: 1.0 }, "7");
  builder.addNode(workflow.id, "KSampler", {
    seed,
    steps,
    cfg,
    sampler_name,
    scheduler,
    denoise: 1.0,
  }, "8");
  builder.addNode(workflow.id, "VAEDecode", {}, "9");
  builder.addNode(workflow.id, "SaveImage", { filename_prefix: "ComfyUI_controlnet" }, "10");

  // Checkpoint -> CLIP -> text encoders
  builder.connectNodes(workflow.id, "1", 1, "2", "clip");
  builder.connectNodes(workflow.id, "1", 1, "3", "clip");
  // Positive conditioning -> ControlNetApply
  builder.connectNodes(workflow.id, "2", 0, "7", "positive");
  // Negative conditioning -> ControlNetApply
  builder.connectNodes(workflow.id, "3", 0, "7", "negative");
  // ControlNet model -> ControlNetApply
  builder.connectNodes(workflow.id, "5", 0, "7", "control_net");
  // Control image -> ControlNetApply
  builder.connectNodes(workflow.id, "6", 0, "7", "image");
  // ControlNetApply positive -> KSampler
  builder.connectNodes(workflow.id, "7", 0, "8", "positive");
  // ControlNetApply negative -> KSampler
  builder.connectNodes(workflow.id, "7", 1, "8", "negative");
  // Checkpoint model -> KSampler
  builder.connectNodes(workflow.id, "1", 0, "8", "model");
  // Empty latent -> KSampler
  builder.connectNodes(workflow.id, "4", 0, "8", "latent_image");
  // KSampler -> VAEDecode -> SaveImage
  builder.connectNodes(workflow.id, "8", 0, "9", "samples");
  builder.connectNodes(workflow.id, "1", 2, "9", "vae");
  builder.connectNodes(workflow.id, "9", 0, "10", "images");

  return workflow.id;
}
