import { WorkflowBuilder } from "../workflow-builder.js";

export interface UpscaleParams {
  image: string;
  upscale_model?: string;
}

export function createUpscaleWorkflow(builder: WorkflowBuilder, params: UpscaleParams): string {
  const {
    image,
    upscale_model = "RealESRGAN_x4plus.pth",
  } = params;

  const workflow = builder.createWorkflow("upscale");

  builder.addNode(workflow.id, "LoadImage", { image }, "1");
  builder.addNode(workflow.id, "UpscaleModelLoader", { model_name: upscale_model }, "2");
  builder.addNode(workflow.id, "ImageUpscaleWithModel", {}, "3");
  builder.addNode(workflow.id, "SaveImage", { filename_prefix: "ComfyUI_upscale" }, "4");

  // LoadImage -> ImageUpscaleWithModel
  builder.connectNodes(workflow.id, "1", 0, "3", "image");
  // UpscaleModelLoader -> ImageUpscaleWithModel
  builder.connectNodes(workflow.id, "2", 0, "3", "upscale_model");
  // ImageUpscaleWithModel -> SaveImage
  builder.connectNodes(workflow.id, "3", 0, "4", "images");

  return workflow.id;
}
