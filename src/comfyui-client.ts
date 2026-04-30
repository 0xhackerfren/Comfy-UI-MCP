import { EventEmitter } from "node:events";
import WebSocket from "ws";
import {
  ComfyUINodeInfo,
  ComfyUIQueueState,
  ComfyUISystemStats,
  ComfyUIHistoryEntry,
  PromptRequest,
  PromptResponse,
  UploadImageResult,
  WSMessage,
  JobResult,
  ComfyUIJob,
  ComfyUIJobList,
  ModelFileInfo,
  NodeOutputs,
} from "./types.js";
import { generateId, buildQueryString, sleep } from "./utils.js";
import { readFileSync } from "node:fs";
import { basename, extname } from "node:path";

function getMimeType(filename: string): string {
  const ext = extname(filename).toLowerCase();
  const mimeMap: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".bmp": "image/bmp",
    ".tiff": "image/tiff",
    ".tif": "image/tiff",
    ".wav": "audio/wav",
    ".mp3": "audio/mpeg",
    ".flac": "audio/flac",
    ".ogg": "audio/ogg",
    ".m4a": "audio/mp4",
    ".aac": "audio/aac",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".avi": "video/x-msvideo",
    ".mov": "video/quicktime",
    ".mkv": "video/x-matroska",
  };
  return mimeMap[ext] || "application/octet-stream";
}

export class ComfyUIClient extends EventEmitter {
  private baseUrl: string;
  private wsUrl: string;
  private clientId: string;
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private connected = false;
  private jobResults: Map<string, JobResult> = new Map();

  constructor(baseUrl?: string) {
    super();
    this.on("error", () => {});
    this.baseUrl = (baseUrl || process.env.COMFYUI_URL || "http://127.0.0.1:8188").replace(/\/$/, "");
    this.wsUrl = this.baseUrl.replace(/^http/, "ws") + "/ws";
    this.clientId = generateId();
  }

  getClientId(): string {
    return this.clientId;
  }

  async connect(): Promise<void> {
    await this.connectWebSocket();
  }

  private connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = `${this.wsUrl}?clientId=${this.clientId}`;
      this.ws = new WebSocket(url);
      let settled = false;

      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          this.ws?.close();
          reject(new Error("WebSocket connection timeout"));
        }
      }, 10000);

      this.ws.on("open", () => {
        clearTimeout(timeout);
        if (!settled) {
          settled = true;
          this.connected = true;
          this.emit("connected");
          resolve();
        }
      });

      this.ws.on("message", (data: WebSocket.Data) => {
        try {
          if (typeof data === "string" || (data instanceof Buffer && data[0] === 0x7b)) {
            const msg: WSMessage = JSON.parse(data.toString());
            this.handleMessage(msg);
          }
        } catch {
          // Binary message (preview image), skip
        }
      });

      this.ws.on("close", () => {
        this.connected = false;
        this.emit("disconnected");
        if (!settled) {
          settled = true;
          reject(new Error("WebSocket closed before connecting"));
        } else {
          this.scheduleReconnect();
        }
      });

      this.ws.on("error", (err) => {
        clearTimeout(timeout);
        if (!settled) {
          settled = true;
          reject(err);
        }
      });
    });
  }

  private handleMessage(msg: WSMessage): void {
    this.emit("message", msg);

    switch (msg.type) {
      case "executing": {
        const promptId = msg.data.prompt_id as string | undefined;
        if (promptId) {
          if (msg.data.node === null) {
            const existing = this.jobResults.get(promptId);
            if (existing && existing.status === "running") {
              existing.status = "completed";
            }
            this.emit("job_complete", promptId);
          } else {
            const existing = this.jobResults.get(promptId);
            if (existing) {
              existing.status = "running";
            }
            this.emit("executing_node", promptId, msg.data.node);
          }
        }
        break;
      }
      case "progress": {
        const promptId = msg.data.prompt_id as string | undefined;
        if (promptId) {
          const existing = this.jobResults.get(promptId);
          if (existing) {
            existing.progress = {
              value: msg.data.value as number,
              max: msg.data.max as number,
            };
          }
          this.emit("progress", promptId, msg.data.value, msg.data.max);
        }
        break;
      }
      case "progress_text": {
        const promptId = msg.data.prompt_id as string | undefined;
        if (promptId) {
          const existing = this.jobResults.get(promptId);
          if (existing) {
            existing.progress_text = msg.data.text as string;
          }
          this.emit("progress_text", promptId, msg.data.text);
        }
        break;
      }
      case "executed": {
        const promptId = msg.data.prompt_id as string | undefined;
        if (promptId && msg.data.output) {
          const existing = this.jobResults.get(promptId);
          if (existing) {
            if (!existing.outputs) existing.outputs = {};
            const nodeId = msg.data.node as string;
            existing.outputs[nodeId] = msg.data.output as NodeOutputs;
          }
        }
        break;
      }
      case "execution_start": {
        const promptId = msg.data.prompt_id as string | undefined;
        if (promptId) {
          const existing = this.jobResults.get(promptId);
          if (existing) {
            existing.status = "running";
          }
          this.emit("execution_start", promptId);
        }
        break;
      }
      case "execution_success": {
        const promptId = msg.data.prompt_id as string | undefined;
        if (promptId) {
          const existing = this.jobResults.get(promptId);
          if (existing) {
            existing.status = "completed";
          }
          this.emit("execution_success", promptId);
        }
        break;
      }
      case "execution_error": {
        const promptId = msg.data.prompt_id as string | undefined;
        if (promptId) {
          const existing = this.jobResults.get(promptId);
          if (existing) {
            existing.status = "error";
            existing.error = (msg.data.exception_message as string) || "Execution error";
          }
          this.emit("job_error", promptId, msg.data);
        }
        break;
      }
      case "execution_interrupted": {
        const promptId = msg.data.prompt_id as string | undefined;
        if (promptId) {
          const existing = this.jobResults.get(promptId);
          if (existing) {
            existing.status = "interrupted";
          }
          this.emit("job_interrupted", promptId);
        }
        break;
      }
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      try {
        await this.connectWebSocket();
      } catch {
        this.scheduleReconnect();
      }
    }, 5000);
  }

  async disconnect(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  // --- REST API Methods ---

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, options);
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`ComfyUI API error ${response.status}: ${text || response.statusText}`);
    }
    return response.json() as Promise<T>;
  }

  private async requestRaw(path: string, options?: RequestInit): Promise<Response> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, options);
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`ComfyUI API error ${response.status}: ${text || response.statusText}`);
    }
    return response;
  }

  async isReachable(): Promise<boolean> {
    try {
      await this.request<unknown>("/api/system_stats");
      return true;
    } catch {
      return false;
    }
  }

  async getSystemStats(): Promise<ComfyUISystemStats> {
    return this.request<ComfyUISystemStats>("/api/system_stats");
  }

  async getFeatures(): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>("/api/features");
  }

  async getObjectInfo(): Promise<Record<string, ComfyUINodeInfo>> {
    return this.request<Record<string, ComfyUINodeInfo>>("/api/object_info");
  }

  async getNodeInfo(nodeClass: string): Promise<ComfyUINodeInfo | null> {
    try {
      const result = await this.request<Record<string, ComfyUINodeInfo>>(`/api/object_info/${encodeURIComponent(nodeClass)}`);
      return result[nodeClass] || null;
    } catch {
      return null;
    }
  }

  async getModels(folder: string): Promise<string[]> {
    try {
      return await this.request<string[]>(`/api/models/${encodeURIComponent(folder)}`);
    } catch {
      return [];
    }
  }

  async getModelFolders(): Promise<string[]> {
    return this.request<string[]>("/api/models");
  }

  async getModelsDetailed(folder: string): Promise<ModelFileInfo[]> {
    try {
      const result = await this.request<ModelFileInfo[]>(`/api/experiment/models/${encodeURIComponent(folder)}`);
      return result;
    } catch {
      return [];
    }
  }

  async getEmbeddings(): Promise<string[]> {
    return this.request<string[]>("/api/embeddings");
  }

  async getViewMetadata(folderName: string, filename: string): Promise<Record<string, unknown>> {
    const qs = buildQueryString({ filename });
    return this.request<Record<string, unknown>>(`/api/view_metadata/${encodeURIComponent(folderName)}${qs}`);
  }

  async queuePrompt(request: PromptRequest): Promise<PromptResponse> {
    const body = {
      ...request,
      client_id: this.clientId,
    };
    const result = await this.request<PromptResponse>("/api/prompt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (result.prompt_id && !result.error) {
      this.jobResults.set(result.prompt_id, {
        prompt_id: result.prompt_id,
        status: "queued",
      });
    }

    return result;
  }

  async getQueue(): Promise<ComfyUIQueueState> {
    return this.request<ComfyUIQueueState>("/api/queue");
  }

  async deleteFromQueue(promptIds: string[]): Promise<void> {
    await this.request<unknown>("/api/queue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ delete: promptIds }),
    });
  }

  async clearQueue(): Promise<void> {
    await this.request<unknown>("/api/queue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clear: true }),
    });
  }

  async interrupt(promptId?: string): Promise<void> {
    const body = promptId ? { prompt_id: promptId } : {};
    await this.request<unknown>("/api/interrupt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  async freeMemory(options: { unload_models?: boolean; free_memory?: boolean }): Promise<void> {
    await this.request<unknown>("/api/free", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(options),
    });
  }

  async getHistory(maxItems?: number, offset?: number): Promise<Record<string, ComfyUIHistoryEntry>> {
    const qs = buildQueryString({ max_items: maxItems, offset });
    return this.request<Record<string, ComfyUIHistoryEntry>>(`/api/history${qs}`);
  }

  async getHistoryEntry(promptId: string): Promise<ComfyUIHistoryEntry | null> {
    try {
      const result = await this.request<Record<string, ComfyUIHistoryEntry>>(`/api/history/${encodeURIComponent(promptId)}`);
      return result[promptId] || null;
    } catch {
      return null;
    }
  }

  // --- Jobs API (modern) ---

  async getJobs(limit?: number, offset?: number): Promise<ComfyUIJobList> {
    const qs = buildQueryString({ limit, offset });
    try {
      return await this.request<ComfyUIJobList>(`/api/jobs${qs}`);
    } catch {
      return { jobs: [] };
    }
  }

  async getJob(jobId: string): Promise<ComfyUIJob | null> {
    try {
      return await this.request<ComfyUIJob>(`/api/jobs/${encodeURIComponent(jobId)}`);
    } catch {
      return null;
    }
  }

  // --- File System ---

  async listFiles(type: "output" | "input" | "temp", subfolder?: string): Promise<string[]> {
    const qs = buildQueryString({ subfolder });
    try {
      const result = await this.request<string[] | { files: string[] }>(`/internal/files/${type}${qs}`);
      if (Array.isArray(result)) return result;
      return result.files || [];
    } catch {
      return [];
    }
  }

  async getFolderPaths(): Promise<Record<string, string[]>> {
    try {
      return await this.request<Record<string, string[]>>("/internal/folder_paths");
    } catch {
      return {};
    }
  }

  // --- Upload ---

  async uploadImage(
    filePathOrBuffer: string | Buffer,
    filename?: string,
    options?: { subfolder?: string; type?: string; overwrite?: boolean }
  ): Promise<UploadImageResult> {
    let buffer: Buffer;
    let uploadFilename: string;

    if (typeof filePathOrBuffer === "string") {
      buffer = readFileSync(filePathOrBuffer);
      uploadFilename = filename || basename(filePathOrBuffer);
    } else {
      buffer = filePathOrBuffer;
      uploadFilename = filename || `upload_${Date.now()}.png`;
    }

    const mimeType = getMimeType(uploadFilename);
    const boundary = `----FormBoundary${Date.now()}`;
    const parts: Buffer[] = [];

    const addField = (name: string, value: string) => {
      parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
    };

    parts.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="${uploadFilename}"\r\nContent-Type: ${mimeType}\r\n\r\n`
      )
    );
    parts.push(buffer);
    parts.push(Buffer.from("\r\n"));

    if (options?.subfolder) addField("subfolder", options.subfolder);
    if (options?.type) addField("type", options.type);
    if (options?.overwrite) addField("overwrite", "true");

    parts.push(Buffer.from(`--${boundary}--\r\n`));

    const body = Buffer.concat(parts);

    return this.request<UploadImageResult>("/api/upload/image", {
      method: "POST",
      headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
      body,
    });
  }

  async uploadMask(
    filePathOrBuffer: string | Buffer,
    originalRef: string,
    filename?: string,
    options?: { subfolder?: string; overwrite?: boolean }
  ): Promise<UploadImageResult> {
    let buffer: Buffer;
    let uploadFilename: string;

    if (typeof filePathOrBuffer === "string") {
      buffer = readFileSync(filePathOrBuffer);
      uploadFilename = filename || basename(filePathOrBuffer);
    } else {
      buffer = filePathOrBuffer;
      uploadFilename = filename || `mask_${Date.now()}.png`;
    }

    const mimeType = getMimeType(uploadFilename);
    const boundary = `----FormBoundary${Date.now()}`;
    const parts: Buffer[] = [];

    const addField = (name: string, value: string) => {
      parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
    };

    parts.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="${uploadFilename}"\r\nContent-Type: ${mimeType}\r\n\r\n`
      )
    );
    parts.push(buffer);
    parts.push(Buffer.from("\r\n"));

    addField("original_ref", originalRef);
    if (options?.subfolder) addField("subfolder", options.subfolder);
    if (options?.overwrite) addField("overwrite", "true");

    parts.push(Buffer.from(`--${boundary}--\r\n`));

    const body = Buffer.concat(parts);

    return this.request<UploadImageResult>("/api/upload/mask", {
      method: "POST",
      headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
      body,
    });
  }

  async viewImage(
    filename: string,
    options?: { subfolder?: string; type?: string; preview?: string; channel?: string }
  ): Promise<Buffer> {
    const qs = buildQueryString({
      filename,
      subfolder: options?.subfolder,
      type: options?.type || "output",
      preview: options?.preview,
      channel: options?.channel,
    });
    const response = await this.requestRaw(`/api/view${qs}`);
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  // --- Job Tracking ---

  trackJob(promptId: string): void {
    if (!this.jobResults.has(promptId)) {
      this.jobResults.set(promptId, { prompt_id: promptId, status: "queued" });
    }
  }

  getJobResult(promptId: string): JobResult | undefined {
    return this.jobResults.get(promptId);
  }

  async waitForJob(promptId: string, timeoutMs = 300000): Promise<JobResult> {
    const startTime = Date.now();

    if (!this.jobResults.has(promptId)) {
      this.jobResults.set(promptId, { prompt_id: promptId, status: "queued" });
    }

    while (Date.now() - startTime < timeoutMs) {
      const result = this.jobResults.get(promptId);
      if (result && (result.status === "completed" || result.status === "error" || result.status === "interrupted")) {
        const history = await this.getHistoryEntry(promptId);
        if (history?.outputs) {
          result.outputs = history.outputs;
        }
        return result;
      }
      await sleep(500);
    }

    return {
      prompt_id: promptId,
      status: "unknown",
      error: `Timeout after ${timeoutMs}ms`,
    };
  }
}
