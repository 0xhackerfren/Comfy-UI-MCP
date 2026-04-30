import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { Workflow, WorkflowNode, WorkflowConnection, PromptNode } from "./types.js";

interface SerializedWorkflow {
  id: string;
  name: string;
  nodes: Record<string, WorkflowNode>;
  connections: WorkflowConnection[];
  nextNodeId: number;
  created_at: string;
  updated_at: string;
}

export class WorkflowStore {
  private dir: string;

  constructor(workflowDir: string) {
    this.dir = resolve(workflowDir);
    if (!existsSync(this.dir)) {
      mkdirSync(this.dir, { recursive: true });
    }
  }

  private filePath(id: string): string {
    const safeId = id.replace(/[^a-zA-Z0-9_-]/g, "_");
    return join(this.dir, `${safeId}.json`);
  }

  save(workflow: Workflow): void {
    const serialized: SerializedWorkflow = {
      id: workflow.id,
      name: workflow.name,
      nodes: Object.fromEntries(workflow.nodes),
      connections: workflow.connections,
      nextNodeId: workflow.nextNodeId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const existing = this.loadRaw(workflow.id);
    if (existing) {
      serialized.created_at = existing.created_at;
    }

    writeFileSync(this.filePath(workflow.id), JSON.stringify(serialized, null, 2), "utf-8");
  }

  private loadRaw(id: string): SerializedWorkflow | null {
    const path = this.filePath(id);
    if (!existsSync(path)) return null;
    try {
      return JSON.parse(readFileSync(path, "utf-8")) as SerializedWorkflow;
    } catch {
      return null;
    }
  }

  load(id: string): Workflow | null {
    const raw = this.loadRaw(id);
    if (!raw) return null;

    return {
      id: raw.id,
      name: raw.name,
      nodes: new Map(Object.entries(raw.nodes)),
      connections: raw.connections,
      nextNodeId: raw.nextNodeId,
    };
  }

  delete(id: string): boolean {
    const path = this.filePath(id);
    if (!existsSync(path)) return false;
    unlinkSync(path);
    return true;
  }

  list(): Array<{ id: string; name: string; created_at: string; updated_at: string; node_count: number }> {
    if (!existsSync(this.dir)) return [];

    const files = readdirSync(this.dir).filter((f) => f.endsWith(".json"));
    const results: Array<{ id: string; name: string; created_at: string; updated_at: string; node_count: number }> = [];

    for (const file of files) {
      try {
        const content = JSON.parse(readFileSync(join(this.dir, file), "utf-8")) as SerializedWorkflow;
        results.push({
          id: content.id,
          name: content.name,
          created_at: content.created_at,
          updated_at: content.updated_at,
          node_count: Object.keys(content.nodes).length,
        });
      } catch {
        // Skip invalid files
      }
    }

    return results.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }

  // --- Presets ---

  private presetsDir(): string {
    const dir = join(this.dir, "presets");
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  async savePreset(preset: { name: string; description: string; template: string; params: Record<string, unknown>; created_at: string }): Promise<void> {
    const safeName = preset.name.replace(/[^a-zA-Z0-9_-]/g, "_");
    const path = join(this.presetsDir(), `${safeName}.json`);
    writeFileSync(path, JSON.stringify(preset, null, 2), "utf-8");
  }

  async getPreset(name: string): Promise<{ name: string; description: string; template: string; params: Record<string, unknown>; created_at: string } | null> {
    const safeName = name.replace(/[^a-zA-Z0-9_-]/g, "_");
    const path = join(this.presetsDir(), `${safeName}.json`);
    if (!existsSync(path)) return null;
    try {
      return JSON.parse(readFileSync(path, "utf-8"));
    } catch {
      return null;
    }
  }

  async listPresets(): Promise<Array<{ name: string; description: string; template: string; params: Record<string, unknown>; created_at: string }>> {
    const dir = this.presetsDir();
    const files = readdirSync(dir).filter(f => f.endsWith(".json"));
    const presets = [];
    for (const file of files) {
      try {
        const content = JSON.parse(readFileSync(join(dir, file), "utf-8"));
        presets.push(content);
      } catch {
        // Skip invalid
      }
    }
    return presets.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
  }

  exportAsPrompt(id: string): Record<string, PromptNode> | null {
    const workflow = this.load(id);
    if (!workflow) return null;

    const prompt: Record<string, PromptNode> = {};
    for (const [nodeId, node] of workflow.nodes) {
      const inputs: Record<string, unknown> = { ...node.inputs };
      for (const conn of workflow.connections) {
        if (conn.to_node === nodeId) {
          inputs[conn.to_input_name] = [conn.from_node, conn.from_output_slot];
        }
      }
      prompt[nodeId] = {
        class_type: node.class_type,
        inputs,
        _meta: node.meta,
      };
    }
    return prompt;
  }
}
