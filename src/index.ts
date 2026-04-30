#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { ComfyUIClient } from "./comfyui-client.js";
import { NodeCache } from "./node-cache.js";
import { WorkflowBuilder } from "./workflow-builder.js";
import { WorkflowStore } from "./workflow-store.js";
import { PipelineOrchestrator } from "./pipeline.js";
import { loadConfig } from "./config.js";
import { getDiscoveryToolDefinitions, handleDiscoveryTool } from "./tools/discovery.js";
import { getWorkflowToolDefinitions, handleWorkflowTool } from "./tools/workflow.js";
import { getGenerationToolDefinitions, handleGenerationTool } from "./tools/generation.js";
import { getAssetToolDefinitions, handleAssetTool } from "./tools/assets.js";
import { getQueueToolDefinitions, handleQueueTool } from "./tools/queue.js";
import { getSystemToolDefinitions, handleSystemTool } from "./tools/system.js";
import { getAdvancedToolDefinitions, handleAdvancedTool } from "./tools/advanced.js";
import { registerResources } from "./resources/index.js";
import { registerPrompts } from "./prompts/index.js";
import { createTemplateHandler } from "./templates/index.js";

const DISCOVERY_TOOLS = new Set([
  "comfy_list_nodes", "comfy_get_node_info", "comfy_list_models",
  "comfy_list_models_detailed", "comfy_get_model_metadata",
  "comfy_list_embeddings", "comfy_search_nodes",
]);

const WORKFLOW_TOOLS = new Set([
  "comfy_create_workflow", "comfy_add_node", "comfy_connect_nodes",
  "comfy_set_node_input", "comfy_validate_workflow", "comfy_get_workflow",
  "comfy_load_workflow", "comfy_list_workflow_templates", "comfy_use_template",
]);

const GENERATION_TOOLS = new Set([
  "comfy_run_workflow", "comfy_run_prompt", "comfy_get_job_status", "comfy_wait_for_job",
  "comfy_save_workflow", "comfy_list_saved_workflows", "comfy_delete_saved_workflow",
  "comfy_create_pipeline", "comfy_add_pipeline_step", "comfy_run_pipeline", "comfy_get_pipeline_status",
]);

const ASSET_TOOLS = new Set([
  "comfy_upload_image", "comfy_upload_mask", "comfy_upload_audio",
  "comfy_get_image", "comfy_get_audio", "comfy_get_video",
  "comfy_list_outputs", "comfy_view_image",
]);

const QUEUE_TOOLS = new Set(["comfy_get_queue", "comfy_cancel_job", "comfy_clear_queue", "comfy_get_history"]);

const SYSTEM_TOOLS = new Set([
  "comfy_system_stats", "comfy_free_memory", "comfy_interrupt",
  "comfy_list_files", "comfy_get_folder_paths",
  "comfy_list_jobs", "comfy_get_job",
]);

const ADVANCED_TOOLS = new Set([
  "comfy_stack_loras", "comfy_download_model", "comfy_batch_generate",
  "comfy_clone_workflow", "comfy_save_preset", "comfy_list_presets",
  "comfy_apply_preset", "comfy_sampler_sweep",
  "comfy_generate_music", "comfy_keyframe_video", "comfy_create_short",
]);

async function main() {
  const config = loadConfig();

  const client = new ComfyUIClient(config.comfyuiUrl);
  const nodeCache = new NodeCache(client);
  const workflowBuilder = new WorkflowBuilder(nodeCache);
  const workflowStore = new WorkflowStore(config.workflowDir);
  const templateHandler = createTemplateHandler(workflowBuilder);
  const pipelineOrchestrator = new PipelineOrchestrator(client, workflowBuilder, workflowStore, templateHandler);

  const server = new Server(
    {
      name: "comfyui-mcp-server",
      version: "2.0.0",
    },
    {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        ...getDiscoveryToolDefinitions(),
        ...getWorkflowToolDefinitions(),
        ...getGenerationToolDefinitions(),
        ...getAssetToolDefinitions(),
        ...getQueueToolDefinitions(),
        ...getSystemToolDefinitions(),
        ...getAdvancedToolDefinitions(),
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const toolArgs = (args || {}) as Record<string, unknown>;

    // Ensure WebSocket is connected for execution-related tools
    if ((GENERATION_TOOLS.has(name) || ADVANCED_TOOLS.has(name)) && !client.isConnected()) {
      try {
        await client.connect();
      } catch {
        // Continue without WS - polling will still work via REST
      }
    }

    if (DISCOVERY_TOOLS.has(name)) {
      return handleDiscoveryTool(name, toolArgs, client, nodeCache);
    }

    if (WORKFLOW_TOOLS.has(name)) {
      return handleWorkflowTool(name, toolArgs, client, nodeCache, workflowBuilder, templateHandler);
    }

    if (GENERATION_TOOLS.has(name)) {
      return handleGenerationTool(name, toolArgs, client, workflowBuilder, workflowStore, pipelineOrchestrator, config.defaultTimeout);
    }

    if (ASSET_TOOLS.has(name)) {
      return handleAssetTool(name, toolArgs, client);
    }

    if (QUEUE_TOOLS.has(name)) {
      return handleQueueTool(name, toolArgs, client);
    }

    if (SYSTEM_TOOLS.has(name)) {
      return handleSystemTool(name, toolArgs, client);
    }

    if (ADVANCED_TOOLS.has(name)) {
      return handleAdvancedTool(name, toolArgs, client, workflowBuilder, workflowStore, templateHandler, config.defaultTimeout);
    }

    return {
      content: [{ type: "text", text: `Unknown tool: ${name}` }],
      isError: true,
    };
  });

  registerResources(server, client, nodeCache);
  registerPrompts(server);

  // Try to connect WebSocket (non-blocking)
  try {
    await client.connect();
  } catch {
    // ComfyUI might not be running yet
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  process.stderr.write(`Fatal error: ${err.message}\n`);
  process.exit(1);
});
