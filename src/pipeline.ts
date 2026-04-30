import { ComfyUIClient } from "./comfyui-client.js";
import { WorkflowBuilder } from "./workflow-builder.js";
import { WorkflowStore } from "./workflow-store.js";
import { Pipeline, PipelineStep, JobResult, NodeOutputs, OutputMedia } from "./types.js";
import { generateId } from "./utils.js";

export class PipelineOrchestrator {
  private pipelines: Map<string, Pipeline> = new Map();
  private client: ComfyUIClient;
  private workflowBuilder: WorkflowBuilder;
  private workflowStore: WorkflowStore;
  private templateHandler: (template: string, params: Record<string, unknown>) => string;

  constructor(
    client: ComfyUIClient,
    workflowBuilder: WorkflowBuilder,
    workflowStore: WorkflowStore,
    templateHandler: (template: string, params: Record<string, unknown>) => string
  ) {
    this.client = client;
    this.workflowBuilder = workflowBuilder;
    this.workflowStore = workflowStore;
    this.templateHandler = templateHandler;
  }

  createPipeline(name: string): Pipeline {
    const pipeline: Pipeline = {
      id: generateId(),
      name,
      steps: [],
      status: "idle",
      results: {},
    };
    this.pipelines.set(pipeline.id, pipeline);
    return pipeline;
  }

  getPipeline(pipelineId: string): Pipeline | undefined {
    return this.pipelines.get(pipelineId);
  }

  addStep(pipelineId: string, step: Omit<PipelineStep, "id"> & { id?: string }): PipelineStep {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) throw new Error(`Pipeline ${pipelineId} not found`);
    if (pipeline.status === "running") throw new Error("Cannot modify a running pipeline");

    const fullStep: PipelineStep = {
      id: step.id || generateId(),
      name: step.name,
      workflow_id: step.workflow_id,
      template: step.template,
      template_params: step.template_params,
      inputs_from: step.inputs_from,
      config: step.config,
    };

    pipeline.steps.push(fullStep);
    return fullStep;
  }

  async runPipeline(pipelineId: string, timeoutPerStep = 300000): Promise<Pipeline> {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) throw new Error(`Pipeline ${pipelineId} not found`);
    if (pipeline.steps.length === 0) throw new Error("Pipeline has no steps");

    pipeline.status = "running";
    pipeline.results = {};
    pipeline.error = undefined;

    try {
      for (const step of pipeline.steps) {
        pipeline.current_step = step.id;

        const workflowId = await this.prepareStepWorkflow(step, pipeline);
        const prompt = this.workflowBuilder.toPrompt(workflowId);
        const response = await this.client.queuePrompt({ prompt });

        if (response.error) {
          pipeline.status = "error";
          pipeline.error = `Step "${step.name || step.id}" failed to queue: ${response.error.message}`;
          pipeline.results[step.id] = {
            prompt_id: response.prompt_id || "",
            status: "error",
            error: response.error.message,
          };
          return pipeline;
        }

        const result = await this.client.waitForJob(response.prompt_id, timeoutPerStep);
        pipeline.results[step.id] = result;

        if (result.status === "error") {
          pipeline.status = "error";
          pipeline.error = `Step "${step.name || step.id}" execution failed: ${result.error}`;
          return pipeline;
        }

        if (result.status === "interrupted") {
          pipeline.status = "error";
          pipeline.error = `Step "${step.name || step.id}" was interrupted`;
          return pipeline;
        }

        // Clean up the temporary workflow
        this.workflowBuilder.deleteWorkflow(workflowId);
      }

      pipeline.status = "completed";
      pipeline.current_step = undefined;
    } catch (err) {
      pipeline.status = "error";
      pipeline.error = `Pipeline execution error: ${(err as Error).message}`;
    }

    return pipeline;
  }

  private async prepareStepWorkflow(step: PipelineStep, pipeline: Pipeline): Promise<string> {
    let workflowId: string;

    if (step.template) {
      const params = { ...(step.template_params || {}) };
      // Resolve inputs_from references into the template params
      if (step.inputs_from) {
        for (const [paramName, ref] of Object.entries(step.inputs_from)) {
          const resolved = this.resolveOutputRef(ref, pipeline);
          if (resolved) {
            params[paramName] = resolved;
          }
        }
      }
      workflowId = this.templateHandler(step.template, params);
    } else if (step.workflow_id) {
      // Load from store or use existing in-memory workflow
      let workflow = this.workflowBuilder.getWorkflow(step.workflow_id);
      if (!workflow) {
        workflow = this.workflowStore.load(step.workflow_id) || undefined;
        if (workflow) {
          // Re-register it in the builder
          const prompt = this.workflowStore.exportAsPrompt(step.workflow_id);
          if (prompt) {
            const loaded = this.workflowBuilder.loadFromPrompt(prompt, workflow.name);
            workflowId = loaded.id;
          } else {
            throw new Error(`Cannot export workflow ${step.workflow_id} as prompt`);
          }
        } else {
          throw new Error(`Workflow ${step.workflow_id} not found in memory or on disk`);
        }
      } else {
        workflowId = step.workflow_id;
      }

      // Apply config overrides
      if (step.config) {
        for (const [key, value] of Object.entries(step.config)) {
          const [nodeId, inputName] = key.split(".");
          if (nodeId && inputName) {
            try {
              this.workflowBuilder.setNodeInput(workflowId!, nodeId, inputName, value);
            } catch {
              // Node/input might not exist, skip
            }
          }
        }
      }

      // Resolve inputs_from references into workflow node inputs
      if (step.inputs_from) {
        for (const [target, ref] of Object.entries(step.inputs_from)) {
          const resolved = this.resolveOutputRef(ref, pipeline);
          if (resolved) {
            const [nodeId, inputName] = target.split(".");
            if (nodeId && inputName) {
              try {
                this.workflowBuilder.setNodeInput(workflowId!, nodeId, inputName, resolved);
              } catch {
                // Skip if node/input doesn't exist
              }
            }
          }
        }
      }
    } else {
      throw new Error(`Step "${step.id}" has neither template nor workflow_id`);
    }

    return workflowId!;
  }

  private resolveOutputRef(
    ref: { step_id: string; output_key: string; media_type?: string },
    pipeline: Pipeline
  ): string | undefined {
    const stepResult = pipeline.results[ref.step_id];
    if (!stepResult?.outputs) return undefined;

    // Search through all node outputs for the media
    for (const [_, nodeOutput] of Object.entries(stepResult.outputs)) {
      const outputs = nodeOutput as NodeOutputs;
      const mediaType = ref.media_type || "image";

      let mediaList: OutputMedia[] | undefined;
      if (mediaType === "image" && outputs.images?.length) {
        mediaList = outputs.images;
      } else if (mediaType === "audio" && outputs.audio?.length) {
        mediaList = outputs.audio;
      } else if (mediaType === "video") {
        mediaList = outputs.videos?.length ? outputs.videos : outputs.gifs;
      }

      if (mediaList && mediaList.length > 0) {
        const idx = parseInt(ref.output_key, 10);
        const media = isNaN(idx) ? mediaList[0] : mediaList[idx] || mediaList[0];
        return media.filename;
      }

      // Check text outputs
      if (mediaType === "text" && outputs.text?.length) {
        const idx = parseInt(ref.output_key, 10);
        return isNaN(idx) ? outputs.text[0] : outputs.text[idx] || outputs.text[0];
      }
    }

    return undefined;
  }

  getPipelineSummary(pipelineId: string): Record<string, unknown> | null {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) return null;

    return {
      id: pipeline.id,
      name: pipeline.name,
      status: pipeline.status,
      current_step: pipeline.current_step,
      step_count: pipeline.steps.length,
      steps: pipeline.steps.map((s) => ({
        id: s.id,
        name: s.name,
        template: s.template,
        workflow_id: s.workflow_id,
        status: pipeline.results[s.id]?.status || "pending",
      })),
      error: pipeline.error,
      results: pipeline.results,
    };
  }

  deletePipeline(pipelineId: string): boolean {
    return this.pipelines.delete(pipelineId);
  }
}
