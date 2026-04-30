import { WorkflowBuilder } from "../workflow-builder.js";

export interface InpaintingParams {
  model?: string;
  image: string;
  mask: string;
  prompt: string;
  negative_prompt?: string;
  steps?: number;
  cfg?: number;
  seed?: number;
  sampler_name?: string;
  scheduler?: string;
  denoise?: number;
}

export function createInpaintingWorkflow(builder: WorkflowBuilder, params: InpaintingParams): string {
  const {
    model = "v1-5-pruned-emaonly.safetensors",
    image,
    mask,
    prompt,
    negative_prompt = "",
    steps = 20,
    cfg = 7.0,
    seed = Math.floor(Math.random() * 2 ** 32),
    sampler_name = "euler",
    scheduler = "normal",
    denoise = 1.0,
  } = params;

  const workflow = builder.createWorkflow("inpainting");

  builder.addNode(workflow.id, "CheckpointLoaderSimple", { ckpt_name: model }, "1");
  builder.addNode(workflow.id, "CLIPTextEncode", { text: prompt }, "2");
  builder.addNode(workflow.id, "CLIPTextEncode", { text: negative_prompt }, "3");
  builder.addNode(workflow.id, "LoadImage", { image }, "4");
  builder.addNode(workflow.id, "LoadImage", { image: mask }, "5");
  builder.addNode(workflow.id, "VAEEncodeForInpaint", { grow_mask_by: 6 }, "6");
  builder.addNode(workflow.id, "KSampler", {
    seed,
    steps,
    cfg,
    sampler_name,
    scheduler,
    denoise,
  }, "7");
  builder.addNode(workflow.id, "VAEDecode", {}, "8");
  builder.addNode(workflow.id, "SaveImage", { filename_prefix: "ComfyUI_inpaint" }, "9");

  // Checkpoint outputs
  builder.connectNodes(workflow.id, "1", 1, "2", "clip");
  builder.connectNodes(workflow.id, "1", 1, "3", "clip");
  builder.connectNodes(workflow.id, "1", 0, "7", "model");
  builder.connectNodes(workflow.id, "1", 2, "6", "vae");
  // LoadImage (source) -> VAEEncodeForInpaint pixels
  builder.connectNodes(workflow.id, "4", 0, "6", "pixels");
  // LoadImage (mask) -> VAEEncodeForInpaint mask
  builder.connectNodes(workflow.id, "5", 0, "6", "mask");
  // VAEEncodeForInpaint -> KSampler latent
  builder.connectNodes(workflow.id, "6", 0, "7", "latent_image");
  // Prompts -> KSampler
  builder.connectNodes(workflow.id, "2", 0, "7", "positive");
  builder.connectNodes(workflow.id, "3", 0, "7", "negative");
  // KSampler -> VAEDecode -> SaveImage
  builder.connectNodes(workflow.id, "7", 0, "8", "samples");
  builder.connectNodes(workflow.id, "1", 2, "8", "vae");
  builder.connectNodes(workflow.id, "8", 0, "9", "images");

  return workflow.id;
}
