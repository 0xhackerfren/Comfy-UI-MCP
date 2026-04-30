import { ComfyUIClient } from "../comfyui-client.js";
import { writeFileSync } from "node:fs";
import { resolve, extname } from "node:path";
import { validateArgs, UploadImageSchema, GetImageSchema, ListOutputsSchema, ViewImageSchema, UploadMaskSchema, GetMediaSchema, UploadAudioSchema } from "../schemas.js";

export function getAssetToolDefinitions() {
  return [
    {
      name: "comfy_upload_image",
      description:
        "Upload an image to ComfyUI's input folder so it can be used in workflows (e.g., with LoadImage node). Accepts a local file path or base64-encoded image data.",
      inputSchema: {
        type: "object" as const,
        properties: {
          file_path: { type: "string", description: "Absolute path to a local image file to upload" },
          base64: { type: "string", description: "Base64-encoded image data (alternative to file_path)" },
          filename: { type: "string", description: "Filename to save as in ComfyUI (optional, derived from file_path if not provided)" },
          subfolder: { type: "string", description: "Subfolder within the input directory" },
          overwrite: { type: "boolean", description: "Whether to overwrite if file already exists (default: false)" },
        },
      },
    },
    {
      name: "comfy_upload_mask",
      description:
        "Upload a mask image to ComfyUI for inpainting. The mask is applied as alpha to the referenced original image.",
      inputSchema: {
        type: "object" as const,
        properties: {
          file_path: { type: "string", description: "Absolute path to a mask image file" },
          base64: { type: "string", description: "Base64-encoded mask image data" },
          original_ref: { type: "string", description: "Reference to the original image this mask applies to (filename in input folder)" },
          filename: { type: "string", description: "Filename for the mask (optional)" },
          subfolder: { type: "string", description: "Subfolder within the input directory" },
          overwrite: { type: "boolean", description: "Whether to overwrite if file already exists" },
        },
        required: ["original_ref"],
      },
    },
    {
      name: "comfy_upload_audio",
      description:
        "Upload an audio file to ComfyUI's input folder for use in audio/TTS workflows. Supports wav, mp3, flac, ogg formats.",
      inputSchema: {
        type: "object" as const,
        properties: {
          file_path: { type: "string", description: "Absolute path to a local audio file" },
          base64: { type: "string", description: "Base64-encoded audio data" },
          filename: { type: "string", description: "Filename to save as (optional)" },
          subfolder: { type: "string", description: "Subfolder within the input directory" },
          overwrite: { type: "boolean", description: "Whether to overwrite if file already exists" },
        },
      },
    },
    {
      name: "comfy_get_image",
      description:
        "Retrieve a generated image from ComfyUI. Can return base64 data or save to a local file path. Use the filename from job outputs.",
      inputSchema: {
        type: "object" as const,
        properties: {
          filename: { type: "string", description: "The image filename (from execution output)" },
          subfolder: { type: "string", description: "Subfolder path (usually empty for output images)" },
          type: { type: "string", description: "File location: 'output' (default), 'input', or 'temp'", enum: ["output", "input", "temp"] },
          save_to: { type: "string", description: "Local file path to save the image to. If omitted, returns base64." },
        },
        required: ["filename"],
      },
    },
    {
      name: "comfy_get_audio",
      description:
        "Retrieve a generated audio file from ComfyUI. Can save to a local path or return metadata. Use the filename from job outputs (audio key).",
      inputSchema: {
        type: "object" as const,
        properties: {
          filename: { type: "string", description: "The audio filename (from execution output, e.g. 'audio_00001_.flac')" },
          subfolder: { type: "string", description: "Subfolder path" },
          type: { type: "string", description: "File location: 'output' (default), 'input', or 'temp'", enum: ["output", "input", "temp"] },
          save_to: { type: "string", description: "Local file path to save the audio to. Required for audio files." },
        },
        required: ["filename"],
      },
    },
    {
      name: "comfy_get_video",
      description:
        "Retrieve a generated video file from ComfyUI. Must save to a local path. Use the filename from job outputs (gifs/videos key).",
      inputSchema: {
        type: "object" as const,
        properties: {
          filename: { type: "string", description: "The video filename (from execution output)" },
          subfolder: { type: "string", description: "Subfolder path" },
          type: { type: "string", description: "File location: 'output' (default), 'input', or 'temp'", enum: ["output", "input", "temp"] },
          save_to: { type: "string", description: "Local file path to save the video to. Required for video files." },
        },
        required: ["filename"],
      },
    },
    {
      name: "comfy_list_outputs",
      description:
        "List recent output files from ComfyUI history, including images, audio, and video. Returns filenames organized by job.",
      inputSchema: {
        type: "object" as const,
        properties: {
          subfolder: { type: "string", description: "Subfolder to filter (optional)" },
          limit: { type: "number", description: "Maximum number of history entries to scan (default: 20)" },
        },
      },
    },
    {
      name: "comfy_view_image",
      description:
        "Get an image as base64-encoded data for inline viewing. Returns the image content suitable for display. Use for verifying generation results.",
      inputSchema: {
        type: "object" as const,
        properties: {
          filename: { type: "string", description: "The image filename" },
          type: { type: "string", description: "File type: 'output' (default), 'input', 'temp'", enum: ["output", "input", "temp"] },
          subfolder: { type: "string", description: "Subfolder path" },
        },
        required: ["filename"],
      },
    },
  ];
}

export async function handleAssetTool(
  toolName: string,
  args: Record<string, unknown>,
  client: ComfyUIClient
): Promise<{ content: Array<{ type: string; text?: string; data?: string; mimeType?: string }>; isError?: boolean }> {
  switch (toolName) {
    case "comfy_upload_image": {
      const v = validateArgs(UploadImageSchema, args);
      if (!v.success) return { content: [{ type: "text", text: v.error }], isError: true };
      try {
        let buffer: Buffer | string;
        if (v.data.file_path) {
          buffer = v.data.file_path;
        } else {
          buffer = Buffer.from(v.data.base64!, "base64");
        }

        const result = await client.uploadImage(buffer, v.data.filename, {
          subfolder: v.data.subfolder,
          overwrite: v.data.overwrite,
        });

        return {
          content: [{ type: "text", text: JSON.stringify({ ...result, message: `Image uploaded as "${result.name}". Use this filename in LoadImage nodes.` }, null, 2) }],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error uploading image: ${(err as Error).message}` }], isError: true };
      }
    }

    case "comfy_upload_mask": {
      const v = validateArgs(UploadMaskSchema, args);
      if (!v.success) return { content: [{ type: "text", text: v.error }], isError: true };
      try {
        let buffer: Buffer | string;
        if (v.data.file_path) {
          buffer = v.data.file_path;
        } else {
          buffer = Buffer.from(v.data.base64!, "base64");
        }

        const result = await client.uploadMask(buffer, v.data.original_ref, v.data.filename, {
          subfolder: v.data.subfolder,
          overwrite: v.data.overwrite,
        });

        return {
          content: [{ type: "text", text: JSON.stringify({ ...result, message: `Mask uploaded as "${result.name}" for original "${v.data.original_ref}".` }, null, 2) }],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error uploading mask: ${(err as Error).message}` }], isError: true };
      }
    }

    case "comfy_upload_audio": {
      const v = validateArgs(UploadAudioSchema, args);
      if (!v.success) return { content: [{ type: "text", text: v.error }], isError: true };
      try {
        let buffer: Buffer | string;
        if (v.data.file_path) {
          buffer = v.data.file_path;
        } else {
          buffer = Buffer.from(v.data.base64!, "base64");
        }

        const result = await client.uploadImage(buffer, v.data.filename, {
          subfolder: v.data.subfolder,
          overwrite: v.data.overwrite,
        });

        return {
          content: [{ type: "text", text: JSON.stringify({ ...result, message: `Audio uploaded as "${result.name}". Use this filename in LoadAudio nodes.` }, null, 2) }],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error uploading audio: ${(err as Error).message}` }], isError: true };
      }
    }

    case "comfy_get_image": {
      const v = validateArgs(GetImageSchema, args);
      if (!v.success) return { content: [{ type: "text", text: v.error }], isError: true };
      try {
        const imageBuffer = await client.viewImage(v.data.filename, { type: v.data.type, subfolder: v.data.subfolder });

        if (v.data.save_to) {
          const fullPath = resolve(v.data.save_to);
          writeFileSync(fullPath, imageBuffer);
          return {
            content: [{ type: "text", text: JSON.stringify({ saved_to: fullPath, size_bytes: imageBuffer.length }, null, 2) }],
          };
        }

        const base64 = imageBuffer.toString("base64");
        const ext = extname(v.data.filename).slice(1).toLowerCase();
        const mimeType = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "webp" ? "image/webp" : "image/png";

        return { content: [{ type: "image", data: base64, mimeType }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error getting image: ${(err as Error).message}` }], isError: true };
      }
    }

    case "comfy_get_audio": {
      const v = validateArgs(GetMediaSchema, args);
      if (!v.success) return { content: [{ type: "text", text: v.error }], isError: true };
      try {
        const audioBuffer = await client.viewImage(v.data.filename, { type: v.data.type, subfolder: v.data.subfolder });

        if (v.data.save_to) {
          const fullPath = resolve(v.data.save_to);
          writeFileSync(fullPath, audioBuffer);
          return {
            content: [{ type: "text", text: JSON.stringify({ saved_to: fullPath, size_bytes: audioBuffer.length, filename: v.data.filename }, null, 2) }],
          };
        }

        return {
          content: [{ type: "text", text: JSON.stringify({ filename: v.data.filename, size_bytes: audioBuffer.length, message: "Audio file retrieved. Use save_to parameter to save to disk." }, null, 2) }],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error getting audio: ${(err as Error).message}` }], isError: true };
      }
    }

    case "comfy_get_video": {
      const v = validateArgs(GetMediaSchema, args);
      if (!v.success) return { content: [{ type: "text", text: v.error }], isError: true };
      try {
        const videoBuffer = await client.viewImage(v.data.filename, { type: v.data.type, subfolder: v.data.subfolder });

        if (v.data.save_to) {
          const fullPath = resolve(v.data.save_to);
          writeFileSync(fullPath, videoBuffer);
          return {
            content: [{ type: "text", text: JSON.stringify({ saved_to: fullPath, size_bytes: videoBuffer.length, filename: v.data.filename }, null, 2) }],
          };
        }

        return {
          content: [{ type: "text", text: JSON.stringify({ filename: v.data.filename, size_bytes: videoBuffer.length, message: "Video file retrieved. Use save_to parameter to save to disk." }, null, 2) }],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error getting video: ${(err as Error).message}` }], isError: true };
      }
    }

    case "comfy_list_outputs": {
      const v = validateArgs(ListOutputsSchema, args);
      if (!v.success) return { content: [{ type: "text", text: v.error }], isError: true };
      try {
        const history = await client.getHistory(v.data.limit || 20);
        const outputs: Array<{ prompt_id: string; type: string; filename: string; subfolder: string; media_type: string }> = [];

        for (const [promptId, entry] of Object.entries(history)) {
          if (entry.outputs) {
            for (const [_, output] of Object.entries(entry.outputs)) {
              if (output.images) {
                for (const img of output.images) {
                  outputs.push({ prompt_id: promptId, ...img, media_type: "image" });
                }
              }
              if (output.audio) {
                for (const aud of output.audio) {
                  outputs.push({ prompt_id: promptId, ...aud, media_type: "audio" });
                }
              }
              if (output.gifs) {
                for (const gif of output.gifs) {
                  outputs.push({ prompt_id: promptId, ...gif, media_type: "video" });
                }
              }
              if (output.videos) {
                for (const vid of output.videos) {
                  outputs.push({ prompt_id: promptId, ...vid, media_type: "video" });
                }
              }
            }
          }
        }

        return {
          content: [{ type: "text", text: JSON.stringify({ count: outputs.length, outputs }, null, 2) }],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error listing outputs: ${(err as Error).message}` }], isError: true };
      }
    }

    case "comfy_view_image": {
      const v = validateArgs(ViewImageSchema, args);
      if (!v.success) return { content: [{ type: "text", text: v.error }], isError: true };
      try {
        const imageBuffer = await client.viewImage(v.data.filename, { type: v.data.type, subfolder: v.data.subfolder });
        const base64 = imageBuffer.toString("base64");
        const ext = extname(v.data.filename).slice(1).toLowerCase();
        const mimeType = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "webp" ? "image/webp" : "image/png";

        return { content: [{ type: "image", data: base64, mimeType }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error viewing image: ${(err as Error).message}` }], isError: true };
      }
    }

    default:
      return { content: [{ type: "text", text: `Unknown asset tool: ${toolName}` }], isError: true };
  }
}
