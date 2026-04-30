import { WorkflowBuilder } from "../workflow-builder.js";

export interface AceStep15Params {
  model?: string;
  tags: string;
  lyrics?: string;
  duration?: number;
  bpm?: number;
  language?: string;
  keyscale?: string;
  timesignature?: string;
  seed?: number;
  steps?: number;
  cfg?: number;
  sampler_name?: string;
  scheduler?: string;
  filename_prefix?: string;
}

export function createAceStep15Workflow(builder: WorkflowBuilder, params: AceStep15Params): string {
  const {
    model = "ace_step_1.5_turbo_aio.safetensors",
    tags,
    lyrics = "",
    duration = 30.0,
    bpm = 120,
    language = "en",
    keyscale = "C major",
    timesignature = "4",
    seed = Math.floor(Math.random() * 2 ** 32),
    steps = 8,
    cfg = 2.0,
    sampler_name = "euler",
    scheduler = "simple",
    filename_prefix = "audio/ComfyUI_ace",
  } = params;

  const workflow = builder.createWorkflow("ace_step_1_5");

  // Checkpoint loads MODEL + CLIP + VAE from AIO
  builder.addNode(workflow.id, "CheckpointLoaderSimple", { ckpt_name: model }, "1");

  // ACE Step 1.5 text encoder with full musical control
  builder.addNode(workflow.id, "TextEncodeAceStepAudio1.5", {
    tags,
    lyrics,
    seed,
    bpm,
    duration,
    timesignature,
    language,
    keyscale,
    generate_audio_codes: true,
    cfg_scale: cfg,
    temperature: 0.85,
    top_p: 0.9,
    top_k: 0,
    min_p: 0,
  }, "2");

  // Empty latent audio for the target duration
  builder.addNode(workflow.id, "EmptyAceStep1.5LatentAudio", {
    seconds: duration,
    batch_size: 1,
  }, "3");

  // KSampler - cfg=1 because guidance is handled by cfg_scale in the text encoder
  builder.addNode(workflow.id, "KSampler", {
    seed,
    steps,
    cfg: 1.0,
    sampler_name,
    scheduler,
    denoise: 1.0,
  }, "4");

  // VAE Decode Audio
  builder.addNode(workflow.id, "VAEDecodeAudio", {}, "5");

  // Save Audio as FLAC
  builder.addNode(workflow.id, "SaveAudio", { filename_prefix }, "6");

  // Connections
  builder.connectNodes(workflow.id, "1", 1, "2", "clip");
  builder.connectNodes(workflow.id, "2", 0, "4", "positive");
  // ACE Step uses same conditioning for negative (guidance handled by cfg_scale inside TextEncoder)
  builder.connectNodes(workflow.id, "2", 0, "4", "negative");
  builder.connectNodes(workflow.id, "1", 0, "4", "model");
  builder.connectNodes(workflow.id, "3", 0, "4", "latent_image");
  builder.connectNodes(workflow.id, "4", 0, "5", "samples");
  builder.connectNodes(workflow.id, "1", 2, "5", "vae");
  builder.connectNodes(workflow.id, "5", 0, "6", "audio");

  return workflow.id;
}
