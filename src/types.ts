export interface ComfyUINodeInput {
  required?: Record<string, [string | string[], Record<string, unknown>?]>;
  optional?: Record<string, [string | string[], Record<string, unknown>?]>;
  hidden?: Record<string, unknown>;
}

export interface ComfyUINodeInfo {
  input: ComfyUINodeInput;
  input_order?: Record<string, string[]>;
  output: string[];
  output_is_list: boolean[];
  output_name: string[];
  name: string;
  display_name: string;
  description: string;
  python_module: string;
  category: string;
  output_node: boolean;
  deprecated?: boolean;
  experimental?: boolean;
}

export interface ComfyUISystemStats {
  system: {
    os: string;
    python_version: string;
    embedded_python: boolean;
    comfyui_version?: string;
  };
  devices: Array<{
    name: string;
    type: string;
    index: number;
    vram_total: number;
    vram_free: number;
    torch_vram_total: number;
    torch_vram_free: number;
  }>;
}

export interface ComfyUIQueueState {
  queue_running: Array<[number, string, Record<string, unknown>, Record<string, unknown>]>;
  queue_pending: Array<[number, string, Record<string, unknown>, Record<string, unknown>]>;
}

export interface OutputMedia {
  filename: string;
  subfolder: string;
  type: string;
}

export interface NodeOutputs {
  images?: OutputMedia[];
  audio?: OutputMedia[];
  gifs?: OutputMedia[];
  videos?: OutputMedia[];
  text?: string[];
  [key: string]: unknown;
}

export interface ComfyUIHistoryEntry {
  prompt: [number, string, Record<string, unknown>, Record<string, unknown>];
  outputs: Record<string, NodeOutputs>;
  status?: { status_str: string; completed: boolean };
}

export interface PromptRequest {
  prompt: Record<string, PromptNode>;
  client_id?: string;
  extra_data?: Record<string, unknown>;
  prompt_id?: string;
  front?: boolean;
}

export interface PromptNode {
  class_type: string;
  inputs: Record<string, unknown>;
  _meta?: { title?: string };
}

export interface PromptResponse {
  prompt_id: string;
  number: number;
  node_errors?: Record<string, unknown>;
  error?: { type: string; message: string; details: string; extra_info: Record<string, unknown> };
}

export interface WSMessage {
  type: string;
  data: Record<string, unknown>;
}

export interface JobResult {
  prompt_id: string;
  status: "running" | "completed" | "error" | "interrupted" | "queued" | "unknown";
  outputs?: Record<string, NodeOutputs>;
  error?: string;
  progress?: { value: number; max: number };
  progress_text?: string;
}

export interface WorkflowNode {
  id: string;
  class_type: string;
  inputs: Record<string, unknown>;
  meta?: { title?: string };
}

export interface WorkflowConnection {
  from_node: string;
  from_output_slot: number;
  to_node: string;
  to_input_name: string;
}

export interface Workflow {
  id: string;
  name: string;
  nodes: Map<string, WorkflowNode>;
  connections: WorkflowConnection[];
  nextNodeId: number;
}

export interface UploadImageResult {
  name: string;
  subfolder: string;
  type: string;
}

// Jobs API types (modern replacement for history)
export interface ComfyUIJob {
  id: string;
  prompt_id: string;
  status: string;
  created_at?: string;
  started_at?: string;
  completed_at?: string;
  outputs?: Record<string, NodeOutputs>;
  error?: string;
}

export interface ComfyUIJobList {
  jobs: ComfyUIJob[];
  total?: number;
}

// Rich model info from /api/experiment/models
export interface ModelFileInfo {
  name: string;
  path: string;
  size?: number;
  modified?: number;
}

// Pipeline types
export interface PipelineStep {
  id: string;
  name?: string;
  workflow_id?: string;
  template?: string;
  template_params?: Record<string, unknown>;
  inputs_from?: Record<string, { step_id: string; output_key: string; media_type?: string }>;
  config?: Record<string, unknown>;
}

export interface Pipeline {
  id: string;
  name: string;
  steps: PipelineStep[];
  status: "idle" | "running" | "completed" | "error";
  current_step?: string;
  results: Record<string, JobResult>;
  error?: string;
}

// Config types
export interface ServerConfig {
  comfyuiUrl: string;
  workflowDir: string;
  outputDir?: string;
  defaultTimeout: number;
}
