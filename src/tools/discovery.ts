import { ComfyUIClient } from "../comfyui-client.js";
import { NodeCache } from "../node-cache.js";
import { validateArgs, ListNodesSchema, GetNodeInfoSchema, ListModelsSchema, SearchNodesSchema, GetModelMetadataSchema, ListModelsDetailedSchema } from "../schemas.js";

export function getDiscoveryToolDefinitions() {
  return [
    {
      name: "comfy_list_nodes",
      description:
        "List all available ComfyUI node classes. Use category or search to filter results. Returns node name, display name, and category for each match.",
      inputSchema: {
        type: "object" as const,
        properties: {
          category: {
            type: "string",
            description: "Filter by category (partial match, case-insensitive). E.g. 'loaders', 'sampling', 'conditioning', 'audio', 'video'",
          },
          search: {
            type: "string",
            description: "Search term to filter nodes by name, display name, or description",
          },
          limit: {
            type: "number",
            description: "Maximum number of results to return (default: 50)",
          },
        },
      },
    },
    {
      name: "comfy_get_node_info",
      description:
        "Get detailed information about a specific ComfyUI node class including all inputs (required/optional with types and constraints), outputs, category, and whether it is an output node. Essential for understanding how to wire nodes together.",
      inputSchema: {
        type: "object" as const,
        properties: {
          node_class: {
            type: "string",
            description: "The exact node class name (e.g. 'KSampler', 'CheckpointLoaderSimple', 'CLIPTextEncode', 'SaveAudio')",
          },
        },
        required: ["node_class"],
      },
    },
    {
      name: "comfy_list_models",
      description:
        "List available model files for a given model type folder. Common folders: checkpoints, loras, vae, controlnet, upscale_models, embeddings, clip, clip_vision, diffusion_models, audio_encoders",
      inputSchema: {
        type: "object" as const,
        properties: {
          folder: {
            type: "string",
            description: "Model folder type (e.g. 'checkpoints', 'loras', 'vae', 'controlnet', 'upscale_models', 'audio_encoders')",
          },
        },
        required: ["folder"],
      },
    },
    {
      name: "comfy_list_models_detailed",
      description:
        "List models with rich information including file sizes, modification dates, and full paths. More detailed than comfy_list_models.",
      inputSchema: {
        type: "object" as const,
        properties: {
          folder: {
            type: "string",
            description: "Model folder type (e.g. 'checkpoints', 'loras', 'vae')",
          },
        },
        required: ["folder"],
      },
    },
    {
      name: "comfy_get_model_metadata",
      description:
        "Read embedded metadata from a .safetensors model file. Returns training info, trigger words, base model, and other metadata stored in the file header.",
      inputSchema: {
        type: "object" as const,
        properties: {
          folder: {
            type: "string",
            description: "Model folder type (e.g. 'checkpoints', 'loras')",
          },
          filename: {
            type: "string",
            description: "Model filename including extension (e.g. 'my_model.safetensors')",
          },
        },
        required: ["folder", "filename"],
      },
    },
    {
      name: "comfy_list_embeddings",
      description: "List all available text embedding files that can be used in prompts with the embedding:name syntax",
      inputSchema: {
        type: "object" as const,
        properties: {},
      },
    },
    {
      name: "comfy_search_nodes",
      description:
        "Search for ComfyUI nodes by a query term. Searches across node names, display names, descriptions, and categories. Returns ranked results with relevance scoring.",
      inputSchema: {
        type: "object" as const,
        properties: {
          query: {
            type: "string",
            description: "Search query (e.g. 'sampler', 'load checkpoint', 'encode text', 'save audio', 'video')",
          },
          limit: {
            type: "number",
            description: "Maximum results to return (default: 20)",
          },
        },
        required: ["query"],
      },
    },
  ];
}

export async function handleDiscoveryTool(
  toolName: string,
  args: Record<string, unknown>,
  client: ComfyUIClient,
  nodeCache: NodeCache
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  switch (toolName) {
    case "comfy_list_nodes": {
      const v = validateArgs(ListNodesSchema, args);
      if (!v.success) return { content: [{ type: "text", text: v.error }], isError: true };
      try {
        const results = await nodeCache.listNodes({
          category: v.data.category,
          search: v.data.search,
          limit: v.data.limit,
        });
        return {
          content: [{ type: "text", text: JSON.stringify({ count: results.length, nodes: results }, null, 2) }],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error listing nodes: ${(err as Error).message}` }], isError: true };
      }
    }

    case "comfy_get_node_info": {
      const v = validateArgs(GetNodeInfoSchema, args);
      if (!v.success) return { content: [{ type: "text", text: v.error }], isError: true };
      try {
        const info = await nodeCache.getNode(v.data.node_class);
        if (!info) {
          return {
            content: [{ type: "text", text: `Node class "${v.data.node_class}" not found. Use comfy_search_nodes to find available nodes.` }],
            isError: true,
          };
        }

        const formatted: Record<string, unknown> = {
          name: info.name,
          display_name: info.display_name,
          description: info.description,
          category: info.category,
          output_node: info.output_node,
          deprecated: info.deprecated,
          inputs: {
            required: formatInputs(info.input?.required),
            optional: formatInputs(info.input?.optional),
          },
          outputs: info.output?.map((type, i) => ({
            slot: i,
            type,
            name: info.output_name?.[i] || type,
          })),
        };

        return { content: [{ type: "text", text: JSON.stringify(formatted, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error getting node info: ${(err as Error).message}` }], isError: true };
      }
    }

    case "comfy_list_models": {
      const v = validateArgs(ListModelsSchema, args);
      if (!v.success) return { content: [{ type: "text", text: v.error }], isError: true };
      try {
        const models = await client.getModels(v.data.folder);
        return {
          content: [{ type: "text", text: JSON.stringify({ folder: v.data.folder, count: models.length, models }, null, 2) }],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error listing models: ${(err as Error).message}` }], isError: true };
      }
    }

    case "comfy_list_models_detailed": {
      const v = validateArgs(ListModelsDetailedSchema, args);
      if (!v.success) return { content: [{ type: "text", text: v.error }], isError: true };
      try {
        const models = await client.getModelsDetailed(v.data.folder);
        const formatted = models.map((m) => ({
          ...m,
          size_mb: m.size ? Math.round(m.size / 1024 / 1024) : undefined,
          modified_date: m.modified ? new Date(m.modified * 1000).toISOString() : undefined,
        }));
        return {
          content: [{ type: "text", text: JSON.stringify({ folder: v.data.folder, count: formatted.length, models: formatted }, null, 2) }],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error listing detailed models: ${(err as Error).message}` }], isError: true };
      }
    }

    case "comfy_get_model_metadata": {
      const v = validateArgs(GetModelMetadataSchema, args);
      if (!v.success) return { content: [{ type: "text", text: v.error }], isError: true };
      try {
        const metadata = await client.getViewMetadata(v.data.folder, v.data.filename);
        return {
          content: [{ type: "text", text: JSON.stringify({ folder: v.data.folder, filename: v.data.filename, metadata }, null, 2) }],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error getting metadata: ${(err as Error).message}` }], isError: true };
      }
    }

    case "comfy_list_embeddings": {
      try {
        const embeddings = await client.getEmbeddings();
        return {
          content: [{ type: "text", text: JSON.stringify({ count: embeddings.length, embeddings }, null, 2) }],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error listing embeddings: ${(err as Error).message}` }], isError: true };
      }
    }

    case "comfy_search_nodes": {
      const v = validateArgs(SearchNodesSchema, args);
      if (!v.success) return { content: [{ type: "text", text: v.error }], isError: true };
      try {
        const results = await nodeCache.searchNodes(v.data.query, v.data.limit);
        return {
          content: [{ type: "text", text: JSON.stringify({ query: v.data.query, count: results.length, results }, null, 2) }],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error searching nodes: ${(err as Error).message}` }], isError: true };
      }
    }

    default:
      return { content: [{ type: "text", text: `Unknown discovery tool: ${toolName}` }], isError: true };
  }
}

function formatInputs(inputs?: Record<string, [string | string[], Record<string, unknown>?]>): Record<string, unknown> | undefined {
  if (!inputs) return undefined;

  const formatted: Record<string, unknown> = {};
  for (const [name, spec] of Object.entries(inputs)) {
    const [typeSpec, options] = spec;
    if (Array.isArray(typeSpec) && typeSpec.every((t) => typeof t === "string")) {
      formatted[name] = { type: "COMBO", options: typeSpec, ...(options || {}) };
    } else {
      formatted[name] = { type: typeSpec, ...(options || {}) };
    }
  }
  return formatted;
}
