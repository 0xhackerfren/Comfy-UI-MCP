import { ComfyUIClient } from "./comfyui-client.js";
import { ComfyUINodeInfo } from "./types.js";

interface CachedNodeData {
  nodes: Record<string, ComfyUINodeInfo>;
  categories: Map<string, string[]>;
  timestamp: number;
}

export class NodeCache {
  private client: ComfyUIClient;
  private cache: CachedNodeData | null = null;
  private ttlMs: number;
  private fetchPromise: Promise<CachedNodeData> | null = null;

  constructor(client: ComfyUIClient, ttlMs = 300000) {
    this.client = client;
    this.ttlMs = ttlMs;
  }

  private isExpired(): boolean {
    if (!this.cache) return true;
    return Date.now() - this.cache.timestamp > this.ttlMs;
  }

  async refresh(): Promise<void> {
    this.cache = null;
    await this.getData();
  }

  private async fetchData(): Promise<CachedNodeData> {
    const nodes = await this.client.getObjectInfo();
    const categories = new Map<string, string[]>();

    for (const [name, info] of Object.entries(nodes)) {
      const category = info.category || "uncategorized";
      const existing = categories.get(category) || [];
      existing.push(name);
      categories.set(category, existing);
    }

    return { nodes, categories, timestamp: Date.now() };
  }

  private async getData(): Promise<CachedNodeData> {
    if (this.cache && !this.isExpired()) {
      return this.cache;
    }

    if (this.fetchPromise) {
      return this.fetchPromise;
    }

    this.fetchPromise = this.fetchData().then((data) => {
      this.cache = data;
      this.fetchPromise = null;
      return data;
    }).catch((err) => {
      this.fetchPromise = null;
      throw err;
    });

    return this.fetchPromise;
  }

  async getNode(className: string): Promise<ComfyUINodeInfo | null> {
    const data = await this.getData();
    return data.nodes[className] || null;
  }

  async getAllNodes(): Promise<Record<string, ComfyUINodeInfo>> {
    const data = await this.getData();
    return data.nodes;
  }

  async getCategories(): Promise<string[]> {
    const data = await this.getData();
    return Array.from(data.categories.keys()).sort();
  }

  async getNodesByCategory(category: string): Promise<string[]> {
    const data = await this.getData();
    return data.categories.get(category) || [];
  }

  async searchNodes(query: string, limit = 20): Promise<Array<{ name: string; display_name: string; category: string; description: string }>> {
    const data = await this.getData();
    const lowerQuery = query.toLowerCase();
    const results: Array<{ name: string; display_name: string; category: string; description: string; score: number }> = [];

    for (const [name, info] of Object.entries(data.nodes)) {
      let score = 0;
      const lowerName = name.toLowerCase();
      const lowerDisplay = (info.display_name || "").toLowerCase();
      const lowerDesc = (info.description || "").toLowerCase();
      const lowerCategory = (info.category || "").toLowerCase();

      if (lowerName === lowerQuery) score += 100;
      else if (lowerName.includes(lowerQuery)) score += 50;

      if (lowerDisplay === lowerQuery) score += 80;
      else if (lowerDisplay.includes(lowerQuery)) score += 40;

      if (lowerDesc.includes(lowerQuery)) score += 20;
      if (lowerCategory.includes(lowerQuery)) score += 10;

      if (score > 0) {
        results.push({
          name,
          display_name: info.display_name || name,
          category: info.category || "uncategorized",
          description: info.description || "",
          score,
        });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit).map(({ score: _, ...rest }) => rest);
  }

  async listNodes(options?: { category?: string; search?: string; limit?: number }): Promise<Array<{ name: string; display_name: string; category: string }>> {
    const data = await this.getData();
    let entries = Object.entries(data.nodes);

    if (options?.category) {
      const cat = options.category.toLowerCase();
      entries = entries.filter(([_, info]) => (info.category || "").toLowerCase().includes(cat));
    }

    if (options?.search) {
      const search = options.search.toLowerCase();
      entries = entries.filter(([name, info]) =>
        name.toLowerCase().includes(search) ||
        (info.display_name || "").toLowerCase().includes(search) ||
        (info.description || "").toLowerCase().includes(search)
      );
    }

    const limit = options?.limit || 50;
    return entries.slice(0, limit).map(([name, info]) => ({
      name,
      display_name: info.display_name || name,
      category: info.category || "uncategorized",
    }));
  }
}
