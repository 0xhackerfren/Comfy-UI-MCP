import { WorkflowBuilder } from "../workflow-builder.js";
import { createTxt2ImgWorkflow } from "./txt2img.js";
import { createImg2ImgWorkflow } from "./img2img.js";
import { createInpaintingWorkflow } from "./inpainting.js";
import { createUpscaleWorkflow } from "./upscale.js";
import { createControlNetWorkflow } from "./controlnet.js";
import { createLoraWorkflow } from "./lora.js";
import { createStableAudioWorkflow } from "./stable-audio.js";
import { createFluxWorkflow } from "./flux.js";
import { createSDXLWorkflow } from "./sdxl.js";
import { createWanVideoWorkflow } from "./video-wan.js";
import { createLTXVWorkflow } from "./video-ltxv.js";
import { createAceStep15Workflow } from "./ace-step-1-5.js";
import { createWanFLFVideoWorkflow } from "./wan-flf-video.js";
import { createWanT2VWorkflow } from "./wan-t2v.js";

export const TEMPLATE_LIST = [
  { name: "txt2img", description: "Text-to-image generation with checkpoint, CLIP encoding, KSampler, and VAE decode (SD1.5 default)" },
  { name: "img2img", description: "Image-to-image transformation with configurable denoise strength" },
  { name: "inpainting", description: "Inpainting with mask support for editing specific image regions" },
  { name: "upscale", description: "Image upscaling using an upscale model (RealESRGAN, etc.)" },
  { name: "controlnet", description: "ControlNet-guided generation (canny, depth, pose, etc.)" },
  { name: "lora", description: "LoRA-enhanced generation for style/concept customization" },
  { name: "sdxl", description: "SDXL text-to-image at 1024x1024 with full SDXL pipeline" },
  { name: "flux", description: "Flux text-to-image using DualCLIPLoader + UNETLoader (modern architecture)" },
  { name: "stable_audio", description: "Stable Audio text-to-audio generation for music and sound effects" },
  { name: "wan_video", description: "Wan video generation (text-to-video or image-to-video with CLIP vision)" },
  { name: "ltxv_video", description: "LTX-Video text-to-video generation" },
  { name: "ace_step_1_5", description: "ACE Step 1.5 music generation with lyrics, tags, BPM, and key control (local, MIT licensed)" },
  { name: "wan_flf_video", description: "Wan 2.2 first-last-frame video interpolation for keyframe transitions (no clip_vision needed)" },
  { name: "wan_t2v", description: "Wan 2.2 text-to-video generation (no input image needed, pure text prompt to video)" },
];

export function createTemplateHandler(builder: WorkflowBuilder) {
  return function handleTemplate(template: string, params: Record<string, unknown>): string {
    switch (template) {
      case "txt2img":
        if (!params.prompt) throw new Error("txt2img requires 'prompt' parameter");
        return createTxt2ImgWorkflow(builder, params as any);

      case "img2img":
        if (!params.image) throw new Error("img2img requires 'image' parameter (uploaded filename)");
        if (!params.prompt) throw new Error("img2img requires 'prompt' parameter");
        return createImg2ImgWorkflow(builder, params as any);

      case "inpainting":
        if (!params.image) throw new Error("inpainting requires 'image' parameter");
        if (!params.mask) throw new Error("inpainting requires 'mask' parameter");
        if (!params.prompt) throw new Error("inpainting requires 'prompt' parameter");
        return createInpaintingWorkflow(builder, params as any);

      case "upscale":
        if (!params.image) throw new Error("upscale requires 'image' parameter");
        return createUpscaleWorkflow(builder, params as any);

      case "controlnet":
        if (!params.controlnet_model) throw new Error("controlnet requires 'controlnet_model' parameter");
        if (!params.control_image) throw new Error("controlnet requires 'control_image' parameter");
        if (!params.prompt) throw new Error("controlnet requires 'prompt' parameter");
        return createControlNetWorkflow(builder, params as any);

      case "lora":
        if (!params.lora_name) throw new Error("lora requires 'lora_name' parameter");
        if (!params.prompt) throw new Error("lora requires 'prompt' parameter");
        return createLoraWorkflow(builder, params as any);

      case "sdxl":
        if (!params.prompt) throw new Error("sdxl requires 'prompt' parameter");
        return createSDXLWorkflow(builder, params as any);

      case "flux":
        if (!params.prompt) throw new Error("flux requires 'prompt' parameter");
        return createFluxWorkflow(builder, params as any);

      case "stable_audio":
        if (!params.prompt) throw new Error("stable_audio requires 'prompt' parameter");
        return createStableAudioWorkflow(builder, params as any);

      case "wan_video":
        if (!params.prompt) throw new Error("wan_video requires 'prompt' parameter");
        return createWanVideoWorkflow(builder, params as any);

      case "ltxv_video":
        if (!params.prompt) throw new Error("ltxv_video requires 'prompt' parameter");
        return createLTXVWorkflow(builder, params as any);

      case "ace_step_1_5":
        if (!params.tags) throw new Error("ace_step_1_5 requires 'tags' parameter (genre/mood/instruments)");
        return createAceStep15Workflow(builder, params as any);

      case "wan_flf_video":
        if (!params.prompt) throw new Error("wan_flf_video requires 'prompt' parameter");
        if (!params.start_image) throw new Error("wan_flf_video requires 'start_image' parameter");
        if (!params.end_image) throw new Error("wan_flf_video requires 'end_image' parameter");
        return createWanFLFVideoWorkflow(builder, params as any);

      case "wan_t2v":
        if (!params.prompt) throw new Error("wan_t2v requires 'prompt' parameter");
        return createWanT2VWorkflow(builder, params as any);

      default:
        throw new Error(`Unknown template: "${template}". Available: ${TEMPLATE_LIST.map((t) => t.name).join(", ")}`);
    }
  };
}
