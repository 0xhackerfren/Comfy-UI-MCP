import { ComfyUIClient } from "../comfyui-client.js";
import { NodeCache } from "../node-cache.js";
import { WorkflowBuilder } from "../workflow-builder.js";
import { PromptNode } from "../types.js";
import { TEMPLATE_LIST } from "../templates/index.js";
import { readFileSync } from "node:fs";
import { validateArgs, CreateWorkflowSchema, AddNodeSchema, ConnectNodesSchema, SetNodeInputSchema, WorkflowIdSchema, LoadWorkflowSchema, UseTemplateSchema } from "../schemas.js";

export function getWorkflowToolDefinitions() {
  const templateNames = TEMPLATE_LIST.map((t) => t.name);
  return [
    {
      name: "comfy_create_workflow",
      description:
        "Create a new empty workflow. Returns a workflow_id that you use with other workflow tools to add nodes and connections. Always start here when building a workflow programmatically.",
      inputSchema: {
        type: "object" as const,
        properties: {
          name: { type: "string", description: "Optional name for the workflow" },
        },
      },
    },
    {
      name: "comfy_add_node",
      description:
        "Add a node to an existing workflow. Use comfy_get_node_info first to understand the node's inputs/outputs. Literal input values can be set directly here; connections to other nodes are made with comfy_connect_nodes.",
      inputSchema: {
        type: "object" as const,
        properties: {
          workflow_id: { type: "string", description: "The workflow ID returned by comfy_create_workflow" },
          class_type: { type: "string", description: "The node class name (e.g. 'CheckpointLoaderSimple', 'KSampler', 'SaveAudio')" },
          inputs: { type: "object", description: "Literal input values to set on the node. Do NOT include connections here." },
          node_id: { type: "string", description: "Optional custom node ID. If omitted, auto-increments." },
        },
        required: ["workflow_id", "class_type"],
      },
    },
    {
      name: "comfy_connect_nodes",
      description:
        "Connect an output slot of one node to an input of another node. This creates a data flow link. Use comfy_get_node_info to see available output slots (by index) and input names.",
      inputSchema: {
        type: "object" as const,
        properties: {
          workflow_id: { type: "string", description: "The workflow ID" },
          from_node: { type: "string", description: "Source node ID (the node providing data)" },
          from_output_slot: { type: "number", description: "Output slot index on the source node (0-based)" },
          to_node: { type: "string", description: "Target node ID (the node receiving data)" },
          to_input_name: { type: "string", description: "Input name on the target node (e.g. 'model', 'clip', 'positive', 'audio')" },
        },
        required: ["workflow_id", "from_node", "from_output_slot", "to_node", "to_input_name"],
      },
    },
    {
      name: "comfy_set_node_input",
      description:
        "Set or update a literal input value on a node. Use this to change parameters like seed, steps, cfg, dimensions, filenames, or text prompts.",
      inputSchema: {
        type: "object" as const,
        properties: {
          workflow_id: { type: "string", description: "The workflow ID" },
          node_id: { type: "string", description: "The node ID to modify" },
          input_name: { type: "string", description: "Input parameter name" },
          value: { description: "The value to set (string, number, boolean, or object)" },
        },
        required: ["workflow_id", "node_id", "input_name", "value"],
      },
    },
    {
      name: "comfy_validate_workflow",
      description:
        "Validate a workflow before execution. Checks that all required inputs are connected/set, node classes exist, there are no cycles, and at least one output node exists.",
      inputSchema: {
        type: "object" as const,
        properties: {
          workflow_id: { type: "string", description: "The workflow ID to validate" },
        },
        required: ["workflow_id"],
      },
    },
    {
      name: "comfy_get_workflow",
      description:
        "Get the current state of a workflow including all nodes, their inputs, and connections. Useful for reviewing what has been built so far.",
      inputSchema: {
        type: "object" as const,
        properties: {
          workflow_id: { type: "string", description: "The workflow ID" },
        },
        required: ["workflow_id"],
      },
    },
    {
      name: "comfy_load_workflow",
      description:
        "Load a workflow from a JSON string (ComfyUI API format) or a file path. The JSON should be in the prompt/API format with node IDs as keys. Returns a workflow_id for further manipulation.",
      inputSchema: {
        type: "object" as const,
        properties: {
          json: { type: "string", description: "Workflow JSON string in ComfyUI API prompt format" },
          file_path: { type: "string", description: "Path to a workflow JSON file" },
          name: { type: "string", description: "Optional name for the loaded workflow" },
        },
      },
    },
    {
      name: "comfy_list_workflow_templates",
      description:
        "List all available built-in workflow templates. Templates provide pre-built workflows for common generation tasks including image, audio, and video generation.",
      inputSchema: {
        type: "object" as const,
        properties: {},
      },
    },
    {
      name: "comfy_use_template",
      description:
        "Generate a workflow from a built-in template with the given parameters. Returns a workflow_id that can be immediately executed or further modified. Templates: " + templateNames.join(", "),
      inputSchema: {
        type: "object" as const,
        properties: {
          template: {
            type: "string",
            description: "Template name",
            enum: templateNames,
          },
          params: {
            type: "object",
            description: "Template parameters. Required params vary by template: txt2img/img2img/sdxl/flux need 'prompt'; ace_step_1_5 needs 'tags'; wan_flf_video needs 'start_image'+'end_image'+'prompt'; upscale needs 'image'. Common optional: model, width, height, steps, cfg, seed.",
          },
        },
        required: ["template", "params"],
      },
    },
  ];
}

export async function handleWorkflowTool(
  toolName: string,
  args: Record<string, unknown>,
  _client: ComfyUIClient,
  nodeCache: NodeCache,
  workflowBuilder: WorkflowBuilder,
  templateHandler: (template: string, params: Record<string, unknown>) => string
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  switch (toolName) {
    case "comfy_create_workflow": {
      const v = validateArgs(CreateWorkflowSchema, args);
      if (!v.success) return { content: [{ type: "text", text: v.error }], isError: true };
      try {
        const workflow = workflowBuilder.createWorkflow(v.data.name);
        return {
          content: [{ type: "text", text: JSON.stringify({ workflow_id: workflow.id, name: workflow.name, message: "Empty workflow created. Use comfy_add_node to add nodes." }, null, 2) }],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${(err as Error).message}` }], isError: true };
      }
    }

    case "comfy_add_node": {
      const v = validateArgs(AddNodeSchema, args);
      if (!v.success) return { content: [{ type: "text", text: v.error }], isError: true };
      try {
        const node = workflowBuilder.addNode(v.data.workflow_id, v.data.class_type, v.data.inputs, v.data.node_id);
        return {
          content: [{ type: "text", text: JSON.stringify({ node_id: node.id, class_type: node.class_type, inputs: node.inputs, message: "Node added successfully." }, null, 2) }],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error adding node: ${(err as Error).message}` }], isError: true };
      }
    }

    case "comfy_connect_nodes": {
      const v = validateArgs(ConnectNodesSchema, args);
      if (!v.success) return { content: [{ type: "text", text: v.error }], isError: true };
      try {
        const conn = workflowBuilder.connectNodes(v.data.workflow_id, v.data.from_node, v.data.from_output_slot, v.data.to_node, v.data.to_input_name);
        return {
          content: [{ type: "text", text: JSON.stringify({ ...conn, message: "Connection created successfully." }, null, 2) }],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error connecting nodes: ${(err as Error).message}` }], isError: true };
      }
    }

    case "comfy_set_node_input": {
      const v = validateArgs(SetNodeInputSchema, args);
      if (!v.success) return { content: [{ type: "text", text: v.error }], isError: true };
      try {
        workflowBuilder.setNodeInput(v.data.workflow_id, v.data.node_id, v.data.input_name, v.data.value);
        return {
          content: [{ type: "text", text: JSON.stringify({ node_id: v.data.node_id, input_name: v.data.input_name, value: v.data.value, message: "Input set successfully." }, null, 2) }],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error setting input: ${(err as Error).message}` }], isError: true };
      }
    }

    case "comfy_validate_workflow": {
      const v = validateArgs(WorkflowIdSchema, args);
      if (!v.success) return { content: [{ type: "text", text: v.error }], isError: true };
      try {
        const result = await workflowBuilder.validate(v.data.workflow_id);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }], isError: !result.valid };
      } catch (err) {
        return { content: [{ type: "text", text: `Error validating: ${(err as Error).message}` }], isError: true };
      }
    }

    case "comfy_get_workflow": {
      const v = validateArgs(WorkflowIdSchema, args);
      if (!v.success) return { content: [{ type: "text", text: v.error }], isError: true };
      try {
        const summary = workflowBuilder.getWorkflowSummary(v.data.workflow_id);
        if (!summary) {
          return { content: [{ type: "text", text: `Workflow ${v.data.workflow_id} not found` }], isError: true };
        }
        return { content: [{ type: "text", text: JSON.stringify(summary, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${(err as Error).message}` }], isError: true };
      }
    }

    case "comfy_load_workflow": {
      const v = validateArgs(LoadWorkflowSchema, args);
      if (!v.success) return { content: [{ type: "text", text: v.error }], isError: true };
      try {
        let promptJson: Record<string, PromptNode>;
        if (v.data.json) {
          promptJson = JSON.parse(v.data.json);
        } else {
          const content = readFileSync(v.data.file_path!, "utf-8");
          promptJson = JSON.parse(content);
        }

        const workflow = workflowBuilder.loadFromPrompt(promptJson, v.data.name);
        return {
          content: [{ type: "text", text: JSON.stringify({ workflow_id: workflow.id, name: workflow.name, node_count: workflow.nodes.size, connection_count: workflow.connections.length }, null, 2) }],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error loading workflow: ${(err as Error).message}` }], isError: true };
      }
    }

    case "comfy_list_workflow_templates": {
      return { content: [{ type: "text", text: JSON.stringify({ templates: TEMPLATE_LIST }, null, 2) }] };
    }

    case "comfy_use_template": {
      const v = validateArgs(UseTemplateSchema, args);
      if (!v.success) return { content: [{ type: "text", text: v.error }], isError: true };
      try {
        const workflowId = templateHandler(v.data.template, v.data.params || {});
        const summary = workflowBuilder.getWorkflowSummary(workflowId);
        return {
          content: [{ type: "text", text: JSON.stringify({ workflow_id: workflowId, ...summary, message: "Template workflow created. Use comfy_run_workflow to execute." }, null, 2) }],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error creating template: ${(err as Error).message}` }], isError: true };
      }
    }

    default:
      return { content: [{ type: "text", text: `Unknown workflow tool: ${toolName}` }], isError: true };
  }
}
