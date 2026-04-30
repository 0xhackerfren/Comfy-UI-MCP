import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ServerConfig } from "./types.js";

function loadEnvFile(): void {
  const candidates = [
    resolve(process.cwd(), ".env"),
    resolve(dirname(fileURLToPath(import.meta.url)), "..", ".env"),
  ];

  for (const envPath of candidates) {
    if (existsSync(envPath)) {
      const content = readFileSync(envPath, "utf-8");
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        let value = trimmed.slice(eqIdx + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
      break;
    }
  }
}

export function loadConfig(): ServerConfig {
  loadEnvFile();

  const comfyuiUrl = (process.env.COMFYUI_URL || "http://127.0.0.1:8188").replace(/\/$/, "");
  const workflowDir = process.env.WORKFLOW_DIR || resolve(process.cwd(), "workflows");
  const outputDir = process.env.OUTPUT_DIR || undefined;
  const defaultTimeout = parseInt(process.env.DEFAULT_TIMEOUT || "300", 10) || 300;

  return { comfyuiUrl, workflowDir, outputDir, defaultTimeout };
}
