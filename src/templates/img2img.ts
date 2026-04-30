import { WorkflowBuilder } from "../workflow-builder.js";

export interface Img2ImgParams {
  model?: string;
  image: string;
  prompt: string;
  negative_prompt?: string;
  steps?: number;
  cfg?: number;
  seed?: number;
  sampler_name?: string;
  scheduler?: string;
  denoise?: number;
}

export function createImg2ImgWorkflow(builder: WorkflowBuilder, params: Img2ImgParams): string {
  const {
    model = "v1-5-pruned-emaonly.safetensors",
    image,
    prompt,
    negative_prompt = "",
    steps = 20,
    cfg = 7.0,
    seed = Math.floor(Math.random() * 2 ** 32),
    sampler_name = "euler",
    scheduler = "normal",
    denoise = 0.75,
  } = params;

  const workflow = builder.createWorkflow("img2img");

  builder.addNode(workflow.id, "CheckpointLoaderSimple", { ckpt_name: model }, "1");
  builder.addNode(workflow.id, "CLIPTextEncode", { text: prompt }, "2");
  builder.addNode(workflow.id, "CLIPTextEncode", { text: negative_prompt }, "3");
  builder.addNode(workflow.id, "LoadImage", { image }, "4");
  builder.addNode(workflow.id, "VAEEncode", {}, "5");
  builder.addNode(workflow.id, "KSampler", {
    seed,
    steps,
    cfg,
    sampler_name,
    scheduler,
    denoise,
  }, "6");
  builder.addNode(workflow.id, "VAEDecode", {}, "7");
  builder.addNode(workflow.id, "SaveImage", { filename_prefix: "ComfyUI_img2img" }, "8");

  // CheckpointLoader outputs: MODEL(0), CLIP(1), VAE(2)
  builder.connectNodes(workflow.id, "1", 1, "2", "clip");
  builder.connectNodes(workflow.id, "1", 1, "3", "clip");
  builder.connectNodes(workflow.id, "1", 0, "6", "model");
  // LoadImage -> VAEEncode
  builder.connectNodes(workflow.id, "4", 0, "5", "pixels");
  builder.connectNodes(workflow.id, "1", 2, "5", "vae");
  // VAEEncode -> KSampler latent
  builder.connectNodes(workflow.id, "5", 0, "6", "latent_image");
  // Prompts -> KSampler
  builder.connectNodes(workflow.id, "2", 0, "6", "positive");
  builder.connectNodes(workflow.id, "3", 0, "6", "negative");
  // KSampler -> VAEDecode -> SaveImage
  builder.connectNodes(workflow.id, "6", 0, "7", "samples");
  builder.connectNodes(workflow.id, "1", 2, "7", "vae");
  builder.connectNodes(workflow.id, "7", 0, "8", "images");

  return workflow.id;
}
