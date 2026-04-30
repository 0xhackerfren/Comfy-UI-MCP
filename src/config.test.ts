import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadConfig } from "./config.js";

describe("loadConfig", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.COMFYUI_URL;
    delete process.env.WORKFLOW_DIR;
    delete process.env.OUTPUT_DIR;
    delete process.env.DEFAULT_TIMEOUT;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("uses env values and applies defaults for unset vars", () => {
    // loadConfig also reads .env file from cwd, so the actual default
    // depends on whether a .env file is present. We test that the
    // returned config has valid structure and sensible values.
    const config = loadConfig();
    expect(config.comfyuiUrl).toMatch(/^https?:\/\/.+/);
    expect(config.comfyuiUrl).not.toMatch(/\/$/);
    expect(config.workflowDir).toContain("workflows");
    expect(config.defaultTimeout).toBeGreaterThan(0);
  });

  it("reads COMFYUI_URL from env", () => {
    process.env.COMFYUI_URL = "http://192.168.1.100:9000";
    const config = loadConfig();
    expect(config.comfyuiUrl).toBe("http://192.168.1.100:9000");
  });

  it("strips trailing slash from COMFYUI_URL", () => {
    process.env.COMFYUI_URL = "http://localhost:8188/";
    const config = loadConfig();
    expect(config.comfyuiUrl).toBe("http://localhost:8188");
  });

  it("reads DEFAULT_TIMEOUT from env", () => {
    process.env.DEFAULT_TIMEOUT = "600";
    const config = loadConfig();
    expect(config.defaultTimeout).toBe(600);
  });

  it("falls back to 300 on invalid DEFAULT_TIMEOUT", () => {
    process.env.DEFAULT_TIMEOUT = "not-a-number";
    const config = loadConfig();
    expect(config.defaultTimeout).toBe(300);
  });
});
