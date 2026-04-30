import { ComfyUIClient } from "../comfyui-client.js";
import { validateArgs, FreeMemorySchema, ListFilesSchema, ListJobsSchema, GetJobSchema } from "../schemas.js";

export function getSystemToolDefinitions() {
  return [
    {
      name: "comfy_system_stats",
      description:
        "Get ComfyUI system information including GPU device details, VRAM usage (total/free), Python version, and ComfyUI version. Use this to verify ComfyUI is running and check available resources.",
      inputSchema: {
        type: "object" as const,
        properties: {},
      },
    },
    {
      name: "comfy_free_memory",
      description:
        "Free GPU VRAM by unloading models and/or clearing memory caches. Use when you need to load a different model or are running low on VRAM.",
      inputSchema: {
        type: "object" as const,
        properties: {
          unload_models: {
            type: "boolean",
            description: "Unload all loaded models from VRAM (default: true)",
          },
          free_memory: {
            type: "boolean",
            description: "Run garbage collection and free cached memory (default: true)",
          },
        },
      },
    },
    {
      name: "comfy_interrupt",
      description:
        "Interrupt/stop the currently executing generation. The job will be marked as interrupted.",
      inputSchema: {
        type: "object" as const,
        properties: {},
      },
    },
    {
      name: "comfy_list_files",
      description:
        "List files in a ComfyUI directory (output, input, or temp). Returns actual filenames on disk. Use this to find generated images, audio, and video files.",
      inputSchema: {
        type: "object" as const,
        properties: {
          type: {
            type: "string",
            description: "Directory type: 'output' (generated files), 'input' (uploaded files), or 'temp' (temporary files)",
            enum: ["output", "input", "temp"],
          },
          subfolder: {
            type: "string",
            description: "Optional subfolder within the directory",
          },
        },
        required: ["type"],
      },
    },
    {
      name: "comfy_get_folder_paths",
      description:
        "Get all configured folder paths in ComfyUI. Shows where models, outputs, inputs, and other resources are stored on disk. Useful for understanding the file layout.",
      inputSchema: {
        type: "object" as const,
        properties: {},
      },
    },
    {
      name: "comfy_list_jobs",
      description:
        "List recent jobs using the modern Jobs API. Returns job status, timestamps, and output information. More structured than comfy_get_history.",
      inputSchema: {
        type: "object" as const,
        properties: {
          limit: {
            type: "number",
            description: "Maximum number of jobs to return (default: 20)",
          },
          offset: {
            type: "number",
            description: "Offset for pagination",
          },
        },
      },
    },
    {
      name: "comfy_get_job",
      description:
        "Get detailed information about a specific job including normalized outputs (images, audio, video, text). Uses the modern Jobs API.",
      inputSchema: {
        type: "object" as const,
        properties: {
          job_id: {
            type: "string",
            description: "The job/prompt ID to look up",
          },
        },
        required: ["job_id"],
      },
    },
  ];
}

export async function handleSystemTool(
  toolName: string,
  args: Record<string, unknown>,
  client: ComfyUIClient
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  switch (toolName) {
    case "comfy_system_stats": {
      try {
        const stats = await client.getSystemStats();
        const formatted: Record<string, unknown> = {
          system: stats.system,
          devices: stats.devices.map((d) => ({
            name: d.name,
            type: d.type,
            vram_total_mb: Math.round(d.vram_total / 1024 / 1024),
            vram_free_mb: Math.round(d.vram_free / 1024 / 1024),
            vram_used_mb: Math.round((d.vram_total - d.vram_free) / 1024 / 1024),
            vram_usage_percent: Math.round(((d.vram_total - d.vram_free) / d.vram_total) * 100),
          })),
          status: "online",
        };
        return { content: [{ type: "text", text: JSON.stringify(formatted, null, 2) }] };
      } catch (err) {
        return {
          content: [{ type: "text", text: JSON.stringify({ status: "offline", error: `ComfyUI not reachable: ${(err as Error).message}` }, null, 2) }],
          isError: true,
        };
      }
    }

    case "comfy_free_memory": {
      const v = validateArgs(FreeMemorySchema, args);
      if (!v.success) return { content: [{ type: "text", text: v.error }], isError: true };
      try {
        await client.freeMemory({ unload_models: v.data.unload_models, free_memory: v.data.free_memory });
        return {
          content: [{ type: "text", text: JSON.stringify({ message: "Memory freed.", unload_models: v.data.unload_models, free_memory: v.data.free_memory }, null, 2) }],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error freeing memory: ${(err as Error).message}` }], isError: true };
      }
    }

    case "comfy_interrupt": {
      try {
        await client.interrupt();
        return { content: [{ type: "text", text: JSON.stringify({ message: "Execution interrupted." }, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error interrupting: ${(err as Error).message}` }], isError: true };
      }
    }

    case "comfy_list_files": {
      const v = validateArgs(ListFilesSchema, args);
      if (!v.success) return { content: [{ type: "text", text: v.error }], isError: true };
      try {
        const files = await client.listFiles(v.data.type, v.data.subfolder);
        return {
          content: [{ type: "text", text: JSON.stringify({ type: v.data.type, subfolder: v.data.subfolder || "", count: files.length, files }, null, 2) }],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error listing files: ${(err as Error).message}` }], isError: true };
      }
    }

    case "comfy_get_folder_paths": {
      try {
        const paths = await client.getFolderPaths();
        return { content: [{ type: "text", text: JSON.stringify(paths, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error getting folder paths: ${(err as Error).message}` }], isError: true };
      }
    }

    case "comfy_list_jobs": {
      const v = validateArgs(ListJobsSchema, args);
      if (!v.success) return { content: [{ type: "text", text: v.error }], isError: true };
      try {
        const result = await client.getJobs(v.data.limit, v.data.offset);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error listing jobs: ${(err as Error).message}` }], isError: true };
      }
    }

    case "comfy_get_job": {
      const v = validateArgs(GetJobSchema, args);
      if (!v.success) return { content: [{ type: "text", text: v.error }], isError: true };
      try {
        const job = await client.getJob(v.data.job_id);
        if (!job) {
          return { content: [{ type: "text", text: `Job "${v.data.job_id}" not found` }], isError: true };
        }
        return { content: [{ type: "text", text: JSON.stringify(job, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error getting job: ${(err as Error).message}` }], isError: true };
      }
    }

    default:
      return { content: [{ type: "text", text: `Unknown system tool: ${toolName}` }], isError: true };
  }
}
