import { z } from "zod";

// Discovery tool schemas
export const ListNodesSchema = z.object({
  category: z.string().optional(),
  search: z.string().optional(),
  limit: z.number().int().min(1).max(500).optional(),
});

export const GetNodeInfoSchema = z.object({
  node_class: z.string().min(1),
});

export const ListModelsSchema = z.object({
  folder: z.string().min(1),
});

export const SearchNodesSchema = z.object({
  query: z.string().min(1),
  limit: z.number().int().min(1).max(100).optional(),
});

// Workflow tool schemas
export const CreateWorkflowSchema = z.object({
  name: z.string().optional(),
});

export const AddNodeSchema = z.object({
  workflow_id: z.string().min(1),
  class_type: z.string().min(1),
  inputs: z.record(z.unknown()).optional(),
  node_id: z.string().optional(),
});

export const ConnectNodesSchema = z.object({
  workflow_id: z.string().min(1),
  from_node: z.string().min(1),
  from_output_slot: z.number().int().min(0),
  to_node: z.string().min(1),
  to_input_name: z.string().min(1),
});

export const SetNodeInputSchema = z.object({
  workflow_id: z.string().min(1),
  node_id: z.string().min(1),
  input_name: z.string().min(1),
  value: z.unknown(),
});

export const WorkflowIdSchema = z.object({
  workflow_id: z.string().min(1),
});

export const LoadWorkflowSchema = z.object({
  json: z.string().optional(),
  file_path: z.string().optional(),
  name: z.string().optional(),
}).refine((data) => data.json || data.file_path, {
  message: "Either json or file_path is required",
});

export const UseTemplateSchema = z.object({
  template: z.string().min(1),
  params: z.record(z.unknown()).optional().default({}),
});

// Generation tool schemas
export const RunWorkflowSchema = z.object({
  workflow_id: z.string().min(1),
  wait: z.boolean().optional().default(true),
  timeout: z.number().min(1).optional(),
});

export const RunPromptSchema = z.object({
  prompt: z.record(z.unknown()),
  wait: z.boolean().optional().default(true),
  timeout: z.number().min(1).optional(),
});

export const PromptIdSchema = z.object({
  prompt_id: z.string().min(1),
});

export const WaitForJobSchema = z.object({
  prompt_id: z.string().min(1),
  timeout: z.number().min(1).optional(),
});

// Asset tool schemas
export const UploadImageSchema = z.object({
  file_path: z.string().optional(),
  base64: z.string().optional(),
  filename: z.string().optional(),
  subfolder: z.string().optional(),
  overwrite: z.boolean().optional(),
}).refine((data) => data.file_path || data.base64, {
  message: "Either file_path or base64 is required",
});

export const GetImageSchema = z.object({
  filename: z.string().min(1),
  subfolder: z.string().optional(),
  type: z.enum(["output", "input", "temp"]).optional().default("output"),
  save_to: z.string().optional(),
});

export const ListOutputsSchema = z.object({
  subfolder: z.string().optional(),
  limit: z.number().int().min(1).max(200).optional(),
});

export const ViewImageSchema = z.object({
  filename: z.string().min(1),
  type: z.enum(["output", "input", "temp"]).optional().default("output"),
  subfolder: z.string().optional(),
});

// Queue tool schemas
export const CancelJobSchema = z.object({
  prompt_id: z.string().min(1),
});

export const GetHistorySchema = z.object({
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).optional(),
});

// System tool schemas
export const FreeMemorySchema = z.object({
  unload_models: z.boolean().optional().default(true),
  free_memory: z.boolean().optional().default(true),
});

// Model metadata schema
export const GetModelMetadataSchema = z.object({
  folder: z.string().min(1),
  filename: z.string().min(1),
});

export const ListModelsDetailedSchema = z.object({
  folder: z.string().min(1),
});

// File system schemas
export const ListFilesSchema = z.object({
  type: z.enum(["output", "input", "temp"]),
  subfolder: z.string().optional(),
});

// Jobs API schemas
export const ListJobsSchema = z.object({
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).optional(),
});

export const GetJobSchema = z.object({
  job_id: z.string().min(1),
});

// Mask upload schema
export const UploadMaskSchema = z.object({
  file_path: z.string().optional(),
  base64: z.string().optional(),
  filename: z.string().optional(),
  original_ref: z.string().min(1),
  subfolder: z.string().optional(),
  overwrite: z.boolean().optional(),
}).refine((data) => data.file_path || data.base64, {
  message: "Either file_path or base64 is required",
});

// Audio/video retrieval schemas
export const GetMediaSchema = z.object({
  filename: z.string().min(1),
  subfolder: z.string().optional(),
  type: z.enum(["output", "input", "temp"]).optional().default("output"),
  save_to: z.string().optional(),
});

// Upload audio schema
export const UploadAudioSchema = z.object({
  file_path: z.string().optional(),
  base64: z.string().optional(),
  filename: z.string().optional(),
  subfolder: z.string().optional(),
  overwrite: z.boolean().optional(),
}).refine((data) => data.file_path || data.base64, {
  message: "Either file_path or base64 is required",
});

// Pipeline schemas
export const CreatePipelineSchema = z.object({
  name: z.string().min(1),
});

export const AddPipelineStepSchema = z.object({
  pipeline_id: z.string().min(1),
  step_id: z.string().optional(),
  name: z.string().optional(),
  workflow_id: z.string().optional(),
  template: z.string().optional(),
  template_params: z.record(z.unknown()).optional(),
  inputs_from: z.record(z.object({
    step_id: z.string().min(1),
    output_key: z.string().min(1),
    media_type: z.string().optional(),
  })).optional(),
  config: z.record(z.unknown()).optional(),
}).refine((data) => data.workflow_id || data.template, {
  message: "Either workflow_id or template is required",
});

export const RunPipelineSchema = z.object({
  pipeline_id: z.string().min(1),
  timeout_per_step: z.number().min(1).optional(),
});

export const PipelineIdSchema = z.object({
  pipeline_id: z.string().min(1),
});

// Workflow persistence schemas
export const SaveWorkflowSchema = z.object({
  workflow_id: z.string().min(1),
});

export const DeleteSavedWorkflowSchema = z.object({
  workflow_id: z.string().min(1),
});

// Validation helper
export function validateArgs<T>(schema: z.ZodType<T>, args: Record<string, unknown>): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(args);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const issues = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
  return { success: false, error: `Validation failed: ${issues}` };
}
