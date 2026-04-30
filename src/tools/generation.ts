import { ComfyUIClient } from "../comfyui-client.js";
import { WorkflowBuilder } from "../workflow-builder.js";
import { WorkflowStore } from "../workflow-store.js";
import { PipelineOrchestrator } from "../pipeline.js";
import { validateArgs, RunWorkflowSchema, RunPromptSchema, PromptIdSchema, WaitForJobSchema, SaveWorkflowSchema, DeleteSavedWorkflowSchema, CreatePipelineSchema, AddPipelineStepSchema, RunPipelineSchema, PipelineIdSchema } from "../schemas.js";

export function getGenerationToolDefinitions() {
  return [
    {
      name: "comfy_run_workflow",
      description:
        "Submit a workflow for execution on ComfyUI. If wait=true, blocks until the job completes and returns results including output filenames (images, audio, video). If wait=false, returns immediately with a prompt_id for polling.",
      inputSchema: {
        type: "object" as const,
        properties: {
          workflow_id: { type: "string", description: "The workflow ID to execute (from comfy_create_workflow or comfy_use_template)" },
          wait: { type: "boolean", description: "If true, wait for completion before returning (default: true). Set to false for async execution." },
          timeout: { type: "number", description: "Timeout in seconds when wait=true (default: 300)" },
        },
        required: ["workflow_id"],
      },
    },
    {
      name: "comfy_run_prompt",
      description:
        "Submit a raw ComfyUI API prompt JSON directly for execution. Use this when you have a pre-built prompt graph. The JSON should be an object with string node IDs as keys and {class_type, inputs} as values.",
      inputSchema: {
        type: "object" as const,
        properties: {
          prompt: { type: "object", description: "Raw ComfyUI prompt graph object (node_id -> {class_type, inputs})" },
          wait: { type: "boolean", description: "If true, wait for completion (default: true)" },
          timeout: { type: "number", description: "Timeout in seconds when wait=true (default: 300)" },
        },
        required: ["prompt"],
      },
    },
    {
      name: "comfy_get_job_status",
      description:
        "Check the status of a submitted job. Returns current status (queued/running/completed/error/interrupted), progress info, and output data if completed.",
      inputSchema: {
        type: "object" as const,
        properties: {
          prompt_id: { type: "string", description: "The prompt_id returned by comfy_run_workflow or comfy_run_prompt" },
        },
        required: ["prompt_id"],
      },
    },
    {
      name: "comfy_wait_for_job",
      description:
        "Block until a previously submitted job completes. Returns the full results including output images/audio/video files. Use after comfy_run_workflow with wait=false.",
      inputSchema: {
        type: "object" as const,
        properties: {
          prompt_id: { type: "string", description: "The prompt_id to wait for" },
          timeout: { type: "number", description: "Timeout in seconds (default: 300)" },
        },
        required: ["prompt_id"],
      },
    },
    {
      name: "comfy_save_workflow",
      description:
        "Persist a workflow to disk so it survives server restarts. The workflow can be loaded later by its ID.",
      inputSchema: {
        type: "object" as const,
        properties: {
          workflow_id: { type: "string", description: "The workflow ID to save" },
        },
        required: ["workflow_id"],
      },
    },
    {
      name: "comfy_list_saved_workflows",
      description:
        "List all workflows that have been saved to disk. Returns IDs, names, creation dates, and node counts.",
      inputSchema: {
        type: "object" as const,
        properties: {},
      },
    },
    {
      name: "comfy_delete_saved_workflow",
      description:
        "Delete a saved workflow from disk.",
      inputSchema: {
        type: "object" as const,
        properties: {
          workflow_id: { type: "string", description: "The workflow ID to delete from disk" },
        },
        required: ["workflow_id"],
      },
    },
    {
      name: "comfy_create_pipeline",
      description:
        "Create a multi-step pipeline that chains multiple workflows together. Steps execute in order, and outputs from earlier steps can feed into later ones. Ideal for complex generation chains like: generate script -> generate audio -> generate video.",
      inputSchema: {
        type: "object" as const,
        properties: {
          name: { type: "string", description: "A descriptive name for the pipeline" },
        },
        required: ["name"],
      },
    },
    {
      name: "comfy_add_pipeline_step",
      description:
        "Add a step to an existing pipeline. Each step references either a workflow_id or a template name. Use inputs_from to wire outputs of previous steps as inputs to this step.",
      inputSchema: {
        type: "object" as const,
        properties: {
          pipeline_id: { type: "string", description: "The pipeline ID" },
          step_id: { type: "string", description: "Optional custom step ID" },
          name: { type: "string", description: "Descriptive name for this step" },
          workflow_id: { type: "string", description: "Existing workflow ID to use for this step" },
          template: { type: "string", description: "Template name to use (alternative to workflow_id)" },
          template_params: { type: "object", description: "Parameters for the template" },
          inputs_from: {
            type: "object",
            description: "Map of input parameter names to output references from prior steps. For templates: {param_name: {step_id, output_key, media_type}}. For workflows: {'node_id.input_name': {step_id, output_key, media_type}}.",
          },
          config: {
            type: "object",
            description: "Config overrides in 'node_id.input_name': value format (for workflow_id steps only)",
          },
        },
        required: ["pipeline_id"],
      },
    },
    {
      name: "comfy_run_pipeline",
      description:
        "Execute a pipeline, running all steps in sequence. Each step waits for completion before the next begins. Returns full results for all steps.",
      inputSchema: {
        type: "object" as const,
        properties: {
          pipeline_id: { type: "string", description: "The pipeline ID to execute" },
          timeout_per_step: { type: "number", description: "Timeout in seconds for each step (default: 300)" },
        },
        required: ["pipeline_id"],
      },
    },
    {
      name: "comfy_get_pipeline_status",
      description:
        "Get the current status of a pipeline including step-by-step progress and results.",
      inputSchema: {
        type: "object" as const,
        properties: {
          pipeline_id: { type: "string", description: "The pipeline ID" },
        },
        required: ["pipeline_id"],
      },
    },
  ];
}

export async function handleGenerationTool(
  toolName: string,
  args: Record<string, unknown>,
  client: ComfyUIClient,
  workflowBuilder: WorkflowBuilder,
  workflowStore: WorkflowStore,
  pipelineOrchestrator: PipelineOrchestrator,
  defaultTimeout: number
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  switch (toolName) {
    case "comfy_run_workflow": {
      const v = validateArgs(RunWorkflowSchema, args);
      if (!v.success) return { content: [{ type: "text", text: v.error }], isError: true };
      const timeoutSec = v.data.timeout || defaultTimeout;

      try {
        const prompt = workflowBuilder.toPrompt(v.data.workflow_id);
        const response = await client.queuePrompt({ prompt });

        if (response.error) {
          return {
            content: [{ type: "text", text: JSON.stringify({ error: response.error, node_errors: response.node_errors }, null, 2) }],
            isError: true,
          };
        }

        if (!v.data.wait) {
          return {
            content: [{ type: "text", text: JSON.stringify({ prompt_id: response.prompt_id, status: "queued", message: "Job queued. Use comfy_get_job_status or comfy_wait_for_job to monitor." }, null, 2) }],
          };
        }

        const result = await client.waitForJob(response.prompt_id, timeoutSec * 1000);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          isError: result.status === "error",
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error executing workflow: ${(err as Error).message}` }], isError: true };
      }
    }

    case "comfy_run_prompt": {
      const v = validateArgs(RunPromptSchema, args);
      if (!v.success) return { content: [{ type: "text", text: v.error }], isError: true };
      const timeoutSec = v.data.timeout || defaultTimeout;

      try {
        const response = await client.queuePrompt({ prompt: v.data.prompt as any });

        if (response.error) {
          return {
            content: [{ type: "text", text: JSON.stringify({ error: response.error, node_errors: response.node_errors }, null, 2) }],
            isError: true,
          };
        }

        if (!v.data.wait) {
          return {
            content: [{ type: "text", text: JSON.stringify({ prompt_id: response.prompt_id, status: "queued", message: "Job queued successfully." }, null, 2) }],
          };
        }

        const result = await client.waitForJob(response.prompt_id, timeoutSec * 1000);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          isError: result.status === "error",
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error executing prompt: ${(err as Error).message}` }], isError: true };
      }
    }

    case "comfy_get_job_status": {
      const v = validateArgs(PromptIdSchema, args);
      if (!v.success) return { content: [{ type: "text", text: v.error }], isError: true };
      try {
        let result = client.getJobResult(v.data.prompt_id);

        if (!result) {
          const history = await client.getHistoryEntry(v.data.prompt_id);
          if (history) {
            result = {
              prompt_id: v.data.prompt_id,
              status: history.status?.completed ? "completed" : "running",
              outputs: history.outputs,
            };
          } else {
            result = { prompt_id: v.data.prompt_id, status: "unknown" };
          }
        }

        if (result.status === "completed" && !result.outputs) {
          const history = await client.getHistoryEntry(v.data.prompt_id);
          if (history?.outputs) {
            result.outputs = history.outputs;
          }
        }

        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error checking job: ${(err as Error).message}` }], isError: true };
      }
    }

    case "comfy_wait_for_job": {
      const v = validateArgs(WaitForJobSchema, args);
      if (!v.success) return { content: [{ type: "text", text: v.error }], isError: true };
      const timeoutSec = v.data.timeout || defaultTimeout;

      try {
        client.trackJob(v.data.prompt_id);
        const result = await client.waitForJob(v.data.prompt_id, timeoutSec * 1000);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          isError: result.status === "error",
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error waiting for job: ${(err as Error).message}` }], isError: true };
      }
    }

    case "comfy_save_workflow": {
      const v = validateArgs(SaveWorkflowSchema, args);
      if (!v.success) return { content: [{ type: "text", text: v.error }], isError: true };
      try {
        const workflow = workflowBuilder.getWorkflow(v.data.workflow_id);
        if (!workflow) {
          return { content: [{ type: "text", text: `Workflow ${v.data.workflow_id} not found in memory` }], isError: true };
        }
        workflowStore.save(workflow);
        return {
          content: [{ type: "text", text: JSON.stringify({ workflow_id: workflow.id, name: workflow.name, message: "Workflow saved to disk." }, null, 2) }],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error saving workflow: ${(err as Error).message}` }], isError: true };
      }
    }

    case "comfy_list_saved_workflows": {
      try {
        const workflows = workflowStore.list();
        return {
          content: [{ type: "text", text: JSON.stringify({ count: workflows.length, workflows }, null, 2) }],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error listing workflows: ${(err as Error).message}` }], isError: true };
      }
    }

    case "comfy_delete_saved_workflow": {
      const v = validateArgs(DeleteSavedWorkflowSchema, args);
      if (!v.success) return { content: [{ type: "text", text: v.error }], isError: true };
      try {
        const deleted = workflowStore.delete(v.data.workflow_id);
        if (!deleted) {
          return { content: [{ type: "text", text: `Workflow ${v.data.workflow_id} not found on disk` }], isError: true };
        }
        return {
          content: [{ type: "text", text: JSON.stringify({ workflow_id: v.data.workflow_id, message: "Workflow deleted from disk." }, null, 2) }],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error deleting workflow: ${(err as Error).message}` }], isError: true };
      }
    }

    case "comfy_create_pipeline": {
      const v = validateArgs(CreatePipelineSchema, args);
      if (!v.success) return { content: [{ type: "text", text: v.error }], isError: true };
      try {
        const pipeline = pipelineOrchestrator.createPipeline(v.data.name);
        return {
          content: [{ type: "text", text: JSON.stringify({ pipeline_id: pipeline.id, name: pipeline.name, message: "Pipeline created. Use comfy_add_pipeline_step to add steps." }, null, 2) }],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error creating pipeline: ${(err as Error).message}` }], isError: true };
      }
    }

    case "comfy_add_pipeline_step": {
      const v = validateArgs(AddPipelineStepSchema, args);
      if (!v.success) return { content: [{ type: "text", text: v.error }], isError: true };
      try {
        const step = pipelineOrchestrator.addStep(v.data.pipeline_id, {
          id: v.data.step_id,
          name: v.data.name,
          workflow_id: v.data.workflow_id,
          template: v.data.template,
          template_params: v.data.template_params,
          inputs_from: v.data.inputs_from,
          config: v.data.config,
        });
        return {
          content: [{ type: "text", text: JSON.stringify({ step_id: step.id, name: step.name, message: "Step added to pipeline." }, null, 2) }],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error adding step: ${(err as Error).message}` }], isError: true };
      }
    }

    case "comfy_run_pipeline": {
      const v = validateArgs(RunPipelineSchema, args);
      if (!v.success) return { content: [{ type: "text", text: v.error }], isError: true };
      try {
        const timeoutPerStep = (v.data.timeout_per_step || defaultTimeout) * 1000;
        const result = await pipelineOrchestrator.runPipeline(v.data.pipeline_id, timeoutPerStep);
        const summary = pipelineOrchestrator.getPipelineSummary(v.data.pipeline_id);
        return {
          content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
          isError: result.status === "error",
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error running pipeline: ${(err as Error).message}` }], isError: true };
      }
    }

    case "comfy_get_pipeline_status": {
      const v = validateArgs(PipelineIdSchema, args);
      if (!v.success) return { content: [{ type: "text", text: v.error }], isError: true };
      try {
        const summary = pipelineOrchestrator.getPipelineSummary(v.data.pipeline_id);
        if (!summary) {
          return { content: [{ type: "text", text: `Pipeline ${v.data.pipeline_id} not found` }], isError: true };
        }
        return { content: [{ type: "text", text: JSON.stringify(summary, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error getting pipeline status: ${(err as Error).message}` }], isError: true };
      }
    }

    default:
      return { content: [{ type: "text", text: `Unknown generation tool: ${toolName}` }], isError: true };
  }
}
