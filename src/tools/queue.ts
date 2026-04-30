import { ComfyUIClient } from "../comfyui-client.js";
import { validateArgs, CancelJobSchema, GetHistorySchema } from "../schemas.js";
import { NodeOutputs } from "../types.js";

export function getQueueToolDefinitions() {
  return [
    {
      name: "comfy_get_queue",
      description:
        "Get the current ComfyUI queue state showing running and pending jobs. Use this to check if ComfyUI is busy before submitting new work.",
      inputSchema: {
        type: "object" as const,
        properties: {},
      },
    },
    {
      name: "comfy_cancel_job",
      description:
        "Cancel a specific queued or running job by its prompt_id. If the job is currently executing, it will be interrupted.",
      inputSchema: {
        type: "object" as const,
        properties: {
          prompt_id: { type: "string", description: "The prompt_id of the job to cancel" },
        },
        required: ["prompt_id"],
      },
    },
    {
      name: "comfy_clear_queue",
      description:
        "Clear all pending jobs from the ComfyUI queue. Does NOT stop the currently running job (use comfy_interrupt for that).",
      inputSchema: {
        type: "object" as const,
        properties: {},
      },
    },
    {
      name: "comfy_get_history",
      description:
        "Get execution history showing past jobs and their results. Each entry includes outputs (images, audio, video filenames) and completion status.",
      inputSchema: {
        type: "object" as const,
        properties: {
          limit: { type: "number", description: "Maximum number of history entries to return (default: 10)" },
          offset: { type: "number", description: "Offset for pagination" },
        },
      },
    },
  ];
}

export async function handleQueueTool(
  toolName: string,
  args: Record<string, unknown>,
  client: ComfyUIClient
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  switch (toolName) {
    case "comfy_get_queue": {
      try {
        const queue = await client.getQueue();
        const running = queue.queue_running?.length || 0;
        const pending = queue.queue_pending?.length || 0;

        const summary: Record<string, unknown> = {
          running_count: running,
          pending_count: pending,
          total: running + pending,
        };

        if (running > 0) {
          summary.running_jobs = queue.queue_running.map((item) => ({ prompt_id: item[1] }));
        }
        if (pending > 0) {
          summary.pending_jobs = queue.queue_pending.slice(0, 10).map((item) => ({ prompt_id: item[1] }));
        }

        return { content: [{ type: "text", text: JSON.stringify(summary, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error getting queue: ${(err as Error).message}` }], isError: true };
      }
    }

    case "comfy_cancel_job": {
      const v = validateArgs(CancelJobSchema, args);
      if (!v.success) return { content: [{ type: "text", text: v.error }], isError: true };
      try {
        await client.interrupt(v.data.prompt_id);
        await client.deleteFromQueue([v.data.prompt_id]);
        return {
          content: [{ type: "text", text: JSON.stringify({ prompt_id: v.data.prompt_id, message: "Job cancelled/interrupted." }, null, 2) }],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error cancelling job: ${(err as Error).message}` }], isError: true };
      }
    }

    case "comfy_clear_queue": {
      try {
        await client.clearQueue();
        return {
          content: [{ type: "text", text: JSON.stringify({ message: "Queue cleared. All pending jobs removed." }, null, 2) }],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error clearing queue: ${(err as Error).message}` }], isError: true };
      }
    }

    case "comfy_get_history": {
      const v = validateArgs(GetHistorySchema, args);
      if (!v.success) return { content: [{ type: "text", text: v.error }], isError: true };
      const limit = v.data.limit || 10;
      try {
        const history = await client.getHistory(limit, v.data.offset);
        const entries = Object.entries(history).map(([promptId, entry]) => {
          const media: Array<{ media_type: string; filename: string; subfolder: string; location: string }> = [];
          if (entry.outputs) {
            for (const output of Object.values(entry.outputs)) {
              const nodeOut = output as NodeOutputs;
              if (nodeOut.images) {
                for (const img of nodeOut.images) media.push({ media_type: "image", filename: img.filename, subfolder: img.subfolder, location: img.type });
              }
              if (nodeOut.audio) {
                for (const aud of nodeOut.audio) media.push({ media_type: "audio", filename: aud.filename, subfolder: aud.subfolder, location: aud.type });
              }
              if (nodeOut.gifs) {
                for (const gif of nodeOut.gifs) media.push({ media_type: "video", filename: gif.filename, subfolder: gif.subfolder, location: gif.type });
              }
              if (nodeOut.videos) {
                for (const vid of nodeOut.videos) media.push({ media_type: "video", filename: vid.filename, subfolder: vid.subfolder, location: vid.type });
              }
            }
          }
          return {
            prompt_id: promptId,
            status: entry.status?.status_str || (entry.status?.completed ? "completed" : "unknown"),
            outputs: media,
          };
        });

        return {
          content: [{ type: "text", text: JSON.stringify({ count: entries.length, entries }, null, 2) }],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error getting history: ${(err as Error).message}` }], isError: true };
      }
    }

    default:
      return { content: [{ type: "text", text: `Unknown queue tool: ${toolName}` }], isError: true };
  }
}
