import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListResourceTemplatesRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { ComfyUIClient } from "../comfyui-client.js";
import { NodeCache } from "../node-cache.js";

export function registerResources(server: Server, client: ComfyUIClient, nodeCache: NodeCache): void {
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: [
        {
          uri: "comfy://system",
          name: "ComfyUI System Info",
          description: "Current system stats including GPU, VRAM, and version info",
          mimeType: "application/json",
        },
        {
          uri: "comfy://nodes",
          name: "ComfyUI Node Catalog",
          description: "Complete list of all available node classes and their categories",
          mimeType: "application/json",
        },
      ],
    };
  });

  server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => {
    return {
      resourceTemplates: [
        {
          uriTemplate: "comfy://models/{folder}",
          name: "Model Files",
          description: "List model files for a given folder type (checkpoints, loras, vae, controlnet, etc.)",
          mimeType: "application/json",
        },
        {
          uriTemplate: "comfy://history/{prompt_id}",
          name: "Job History",
          description: "Execution result for a specific job by prompt_id",
          mimeType: "application/json",
        },
      ],
    };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const uri = request.params.uri;

    if (uri === "comfy://system") {
      try {
        const stats = await client.getSystemStats();
        return {
          contents: [
            {
              uri,
              mimeType: "application/json",
              text: JSON.stringify(stats, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          contents: [
            {
              uri,
              mimeType: "application/json",
              text: JSON.stringify({ error: `ComfyUI not reachable: ${(err as Error).message}` }),
            },
          ],
        };
      }
    }

    if (uri === "comfy://nodes") {
      try {
        const nodes = await nodeCache.getAllNodes();
        const summary = Object.entries(nodes).map(([name, info]) => ({
          name,
          display_name: info.display_name,
          category: info.category,
          output_node: info.output_node,
          inputs: Object.keys(info.input?.required || {}),
          outputs: info.output,
        }));
        return {
          contents: [
            {
              uri,
              mimeType: "application/json",
              text: JSON.stringify({ count: summary.length, nodes: summary }, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          contents: [
            {
              uri,
              mimeType: "application/json",
              text: JSON.stringify({ error: (err as Error).message }),
            },
          ],
        };
      }
    }

    const modelsMatch = uri.match(/^comfy:\/\/models\/(.+)$/);
    if (modelsMatch) {
      const folder = modelsMatch[1];
      try {
        const models = await client.getModels(folder);
        return {
          contents: [
            {
              uri,
              mimeType: "application/json",
              text: JSON.stringify({ folder, count: models.length, models }, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          contents: [
            {
              uri,
              mimeType: "application/json",
              text: JSON.stringify({ error: (err as Error).message }),
            },
          ],
        };
      }
    }

    const historyMatch = uri.match(/^comfy:\/\/history\/(.+)$/);
    if (historyMatch) {
      const promptId = historyMatch[1];
      try {
        const entry = await client.getHistoryEntry(promptId);
        return {
          contents: [
            {
              uri,
              mimeType: "application/json",
              text: JSON.stringify(entry || { error: "Not found" }, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          contents: [
            {
              uri,
              mimeType: "application/json",
              text: JSON.stringify({ error: (err as Error).message }),
            },
          ],
        };
      }
    }

    throw new Error(`Unknown resource URI: ${uri}`);
  });
}
