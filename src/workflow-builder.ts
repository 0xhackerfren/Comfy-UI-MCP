import { Workflow, WorkflowNode, WorkflowConnection, PromptNode } from "./types.js";
import { generateId } from "./utils.js";
import { NodeCache } from "./node-cache.js";

export class WorkflowBuilder {
  private workflows: Map<string, Workflow> = new Map();
  private nodeCache: NodeCache;

  constructor(nodeCache: NodeCache) {
    this.nodeCache = nodeCache;
  }

  createWorkflow(name?: string): Workflow {
    const workflow: Workflow = {
      id: generateId(),
      name: name || `workflow_${Date.now()}`,
      nodes: new Map(),
      connections: [],
      nextNodeId: 1,
    };
    this.workflows.set(workflow.id, workflow);
    return workflow;
  }

  getWorkflow(workflowId: string): Workflow | undefined {
    return this.workflows.get(workflowId);
  }

  deleteWorkflow(workflowId: string): boolean {
    return this.workflows.delete(workflowId);
  }

  addNode(workflowId: string, classType: string, inputs?: Record<string, unknown>, nodeId?: string): WorkflowNode {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) throw new Error(`Workflow ${workflowId} not found`);

    const id = nodeId || String(workflow.nextNodeId++);
    if (workflow.nodes.has(id)) {
      throw new Error(`Node ID ${id} already exists in workflow`);
    }

    const node: WorkflowNode = {
      id,
      class_type: classType,
      inputs: inputs || {},
    };

    workflow.nodes.set(id, node);
    return node;
  }

  removeNode(workflowId: string, nodeId: string): boolean {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) throw new Error(`Workflow ${workflowId} not found`);

    workflow.connections = workflow.connections.filter(
      (c) => c.from_node !== nodeId && c.to_node !== nodeId
    );

    return workflow.nodes.delete(nodeId);
  }

  connectNodes(
    workflowId: string,
    fromNode: string,
    fromOutputSlot: number,
    toNode: string,
    toInputName: string
  ): WorkflowConnection {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) throw new Error(`Workflow ${workflowId} not found`);

    if (!workflow.nodes.has(fromNode)) {
      throw new Error(`Source node ${fromNode} not found`);
    }
    if (!workflow.nodes.has(toNode)) {
      throw new Error(`Target node ${toNode} not found`);
    }

    // Remove any existing connection to this input
    workflow.connections = workflow.connections.filter(
      (c) => !(c.to_node === toNode && c.to_input_name === toInputName)
    );

    const connection: WorkflowConnection = {
      from_node: fromNode,
      from_output_slot: fromOutputSlot,
      to_node: toNode,
      to_input_name: toInputName,
    };

    workflow.connections.push(connection);
    return connection;
  }

  setNodeInput(workflowId: string, nodeId: string, inputName: string, value: unknown): void {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) throw new Error(`Workflow ${workflowId} not found`);

    const node = workflow.nodes.get(nodeId);
    if (!node) throw new Error(`Node ${nodeId} not found`);

    node.inputs[inputName] = value;
  }

  async validate(workflowId: string): Promise<{ valid: boolean; errors: string[] }> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return { valid: false, errors: ["Workflow not found"] };

    const errors: string[] = [];

    if (workflow.nodes.size === 0) {
      errors.push("Workflow has no nodes");
      return { valid: false, errors };
    }

    // Check each node exists in registry and has required inputs
    for (const [nodeId, node] of workflow.nodes) {
      const nodeInfo = await this.nodeCache.getNode(node.class_type);
      if (!nodeInfo) {
        errors.push(`Node ${nodeId}: Unknown class_type "${node.class_type}"`);
        continue;
      }

      // Check required inputs
      if (nodeInfo.input?.required) {
        for (const inputName of Object.keys(nodeInfo.input.required)) {
          const hasLiteral = node.inputs[inputName] !== undefined;
          const hasConnection = workflow.connections.some(
            (c) => c.to_node === nodeId && c.to_input_name === inputName
          );
          if (!hasLiteral && !hasConnection) {
            errors.push(`Node ${nodeId} (${node.class_type}): Missing required input "${inputName}"`);
          }
        }
      }
    }

    // Check for at least one output node
    let hasOutputNode = false;
    for (const [_, node] of workflow.nodes) {
      const nodeInfo = await this.nodeCache.getNode(node.class_type);
      if (nodeInfo?.output_node) {
        hasOutputNode = true;
        break;
      }
    }
    if (!hasOutputNode) {
      errors.push("Workflow has no output node (e.g., SaveImage, PreviewImage)");
    }

    // Check connections reference valid nodes
    for (const conn of workflow.connections) {
      if (!workflow.nodes.has(conn.from_node)) {
        errors.push(`Connection references non-existent source node ${conn.from_node}`);
      }
      if (!workflow.nodes.has(conn.to_node)) {
        errors.push(`Connection references non-existent target node ${conn.to_node}`);
      }
    }

    // Simple cycle detection using DFS
    const visited = new Set<string>();
    const inStack = new Set<string>();

    const hasCycle = (nodeId: string): boolean => {
      visited.add(nodeId);
      inStack.add(nodeId);

      const outgoing = workflow.connections.filter((c) => c.from_node === nodeId);
      for (const conn of outgoing) {
        if (!visited.has(conn.to_node)) {
          if (hasCycle(conn.to_node)) return true;
        } else if (inStack.has(conn.to_node)) {
          return true;
        }
      }

      inStack.delete(nodeId);
      return false;
    };

    for (const nodeId of workflow.nodes.keys()) {
      if (!visited.has(nodeId)) {
        if (hasCycle(nodeId)) {
          errors.push("Workflow contains a cycle");
          break;
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  toPrompt(workflowId: string): Record<string, PromptNode> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) throw new Error(`Workflow ${workflowId} not found`);

    const prompt: Record<string, PromptNode> = {};

    for (const [nodeId, node] of workflow.nodes) {
      const inputs: Record<string, unknown> = { ...node.inputs };

      // Apply connections as link references [source_node_id, output_slot]
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

  loadFromPrompt(promptJson: Record<string, PromptNode>, name?: string): Workflow {
    const workflow = this.createWorkflow(name);

    // First pass: create nodes with literal inputs
    for (const [nodeId, promptNode] of Object.entries(promptJson)) {
      const literalInputs: Record<string, unknown> = {};

      for (const [inputName, value] of Object.entries(promptNode.inputs)) {
        if (!isLink(value)) {
          literalInputs[inputName] = value;
        }
      }

      const node: WorkflowNode = {
        id: nodeId,
        class_type: promptNode.class_type,
        inputs: literalInputs,
        meta: promptNode._meta,
      };
      workflow.nodes.set(nodeId, node);

      const numId = parseInt(nodeId, 10);
      if (!isNaN(numId) && numId >= workflow.nextNodeId) {
        workflow.nextNodeId = numId + 1;
      }
    }

    // Second pass: create connections from link references
    for (const [nodeId, promptNode] of Object.entries(promptJson)) {
      for (const [inputName, value] of Object.entries(promptNode.inputs)) {
        if (isLink(value)) {
          const [sourceNodeId, outputSlot] = value as [string, number];
          workflow.connections.push({
            from_node: String(sourceNodeId),
            from_output_slot: outputSlot,
            to_node: nodeId,
            to_input_name: inputName,
          });
        }
      }
    }

    return workflow;
  }

  getWorkflowSummary(workflowId: string): Record<string, unknown> | null {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return null;

    const nodes: Record<string, unknown>[] = [];
    for (const [id, node] of workflow.nodes) {
      nodes.push({ id, class_type: node.class_type, inputs: node.inputs });
    }

    return {
      id: workflow.id,
      name: workflow.name,
      node_count: workflow.nodes.size,
      connection_count: workflow.connections.length,
      nodes,
      connections: workflow.connections,
    };
  }
}

function isLink(value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  if (value.length !== 2) return false;
  if (typeof value[0] !== "string") return false;
  if (typeof value[1] !== "number") return false;
  return true;
}
