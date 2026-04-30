import { WorkflowBuilder } from "../workflow-builder.js";

export interface StableAudioParams {
  model?: string;
  prompt: string;
  negative_prompt?: string;
  seconds_start?: number;
  seconds_total?: number;
  steps?: number;
  cfg?: number;
  seed?: number;
  sampler_name?: string;
  scheduler?: string;
  filename_prefix?: string;
}

export function createStableAudioWorkflow(builder: WorkflowBuilder, params: StableAudioParams): string {
  const {
    model = "stable_audio_open_1.0.safetensors",
    prompt,
    negative_prompt = "",
    seconds_start = 0.0,
    seconds_total = 30.0,
    steps = 100,
    cfg = 7.0,
    seed = Math.floor(Math.random() * 2 ** 32),
    sampler_name = "dpmpp_3m_sde",
    scheduler = "sgm_uniform",
    filename_prefix = "audio/ComfyUI",
  } = params;

  const workflow = builder.createWorkflow("stable_audio");

  builder.addNode(workflow.id, "CheckpointLoaderSimple", { ckpt_name: model }, "1");
  builder.addNode(workflow.id, "CLIPTextEncode", { text: prompt }, "2");
  builder.addNode(workflow.id, "CLIPTextEncode", { text: negative_prompt }, "3");
  builder.addNode(workflow.id, "ConditioningStableAudio", {
    seconds_start,
    seconds_total,
  }, "4");
  builder.addNode(workflow.id, "EmptyLatentAudio", { seconds: seconds_total, batch_size: 1 }, "5");
  builder.addNode(workflow.id, "KSampler", {
    seed,
    steps,
    cfg,
    sampler_name,
    scheduler,
    denoise: 1.0,
  }, "6");
  builder.addNode(workflow.id, "VAEDecodeAudio", {}, "7");
  builder.addNode(workflow.id, "SaveAudio", { filename_prefix }, "8");

  // Checkpoint -> CLIP for text encoding
  builder.connectNodes(workflow.id, "1", 1, "2", "clip");
  builder.connectNodes(workflow.id, "1", 1, "3", "clip");
  // Text encodes -> ConditioningStableAudio
  builder.connectNodes(workflow.id, "2", 0, "4", "positive");
  builder.connectNodes(workflow.id, "3", 0, "4", "negative");
  // ConditioningStableAudio outputs -> KSampler
  builder.connectNodes(workflow.id, "4", 0, "6", "positive");
  builder.connectNodes(workflow.id, "4", 1, "6", "negative");
  // Checkpoint model -> KSampler
  builder.connectNodes(workflow.id, "1", 0, "6", "model");
  // EmptyLatentAudio -> KSampler
  builder.connectNodes(workflow.id, "5", 0, "6", "latent_image");
  // KSampler -> VAEDecodeAudio
  builder.connectNodes(workflow.id, "6", 0, "7", "samples");
  builder.connectNodes(workflow.id, "1", 2, "7", "vae");
  // VAEDecodeAudio -> SaveAudio
  builder.connectNodes(workflow.id, "7", 0, "8", "audio");

  return workflow.id;
}
