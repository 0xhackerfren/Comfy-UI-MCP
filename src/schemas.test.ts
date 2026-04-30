import { describe, it, expect } from "vitest";
import {
  validateArgs,
  ListNodesSchema,
  GetNodeInfoSchema,
  ListModelsSchema,
  RunWorkflowSchema,
  CreateWorkflowSchema,
  UploadImageSchema,
  ListFilesSchema,
  CancelJobSchema,
  FreeMemorySchema,
} from "./schemas.js";

describe("validateArgs", () => {
  it("returns success with valid data", () => {
    const result = validateArgs(GetNodeInfoSchema, { node_class: "KSampler" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.node_class).toBe("KSampler");
    }
  });

  it("returns error for missing required fields", () => {
    const result = validateArgs(GetNodeInfoSchema, {});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Validation failed");
    }
  });

  it("returns error for invalid types", () => {
    const result = validateArgs(ListNodesSchema, { limit: "not-a-number" });
    expect(result.success).toBe(false);
  });
});

describe("ListNodesSchema", () => {
  it("accepts empty object", () => {
    const result = validateArgs(ListNodesSchema, {});
    expect(result.success).toBe(true);
  });

  it("accepts category filter", () => {
    const result = validateArgs(ListNodesSchema, { category: "sampling" });
    expect(result.success).toBe(true);
  });

  it("rejects limit over 500", () => {
    const result = validateArgs(ListNodesSchema, { limit: 501 });
    expect(result.success).toBe(false);
  });
});

describe("ListModelsSchema", () => {
  it("requires folder", () => {
    const result = validateArgs(ListModelsSchema, {});
    expect(result.success).toBe(false);
  });

  it("rejects empty folder", () => {
    const result = validateArgs(ListModelsSchema, { folder: "" });
    expect(result.success).toBe(false);
  });

  it("accepts valid folder", () => {
    const result = validateArgs(ListModelsSchema, { folder: "checkpoints" });
    expect(result.success).toBe(true);
  });
});

describe("RunWorkflowSchema", () => {
  it("requires workflow_id", () => {
    const result = validateArgs(RunWorkflowSchema, {});
    expect(result.success).toBe(false);
  });

  it("defaults wait to true", () => {
    const result = validateArgs(RunWorkflowSchema, { workflow_id: "abc" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.wait).toBe(true);
    }
  });
});

describe("CreateWorkflowSchema", () => {
  it("accepts empty object", () => {
    const result = validateArgs(CreateWorkflowSchema, {});
    expect(result.success).toBe(true);
  });

  it("accepts optional name", () => {
    const result = validateArgs(CreateWorkflowSchema, { name: "my-workflow" });
    expect(result.success).toBe(true);
  });
});

describe("UploadImageSchema", () => {
  it("requires file_path or base64", () => {
    const result = validateArgs(UploadImageSchema, {});
    expect(result.success).toBe(false);
  });

  it("accepts file_path", () => {
    const result = validateArgs(UploadImageSchema, { file_path: "/tmp/img.png" });
    expect(result.success).toBe(true);
  });

  it("accepts base64", () => {
    const result = validateArgs(UploadImageSchema, { base64: "iVBORw0KGgo..." });
    expect(result.success).toBe(true);
  });
});

describe("ListFilesSchema", () => {
  it("requires type", () => {
    const result = validateArgs(ListFilesSchema, {});
    expect(result.success).toBe(false);
  });

  it("accepts valid type", () => {
    const result = validateArgs(ListFilesSchema, { type: "output" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid type", () => {
    const result = validateArgs(ListFilesSchema, { type: "invalid" });
    expect(result.success).toBe(false);
  });
});

describe("CancelJobSchema", () => {
  it("requires prompt_id", () => {
    const result = validateArgs(CancelJobSchema, {});
    expect(result.success).toBe(false);
  });
});

describe("FreeMemorySchema", () => {
  it("defaults both options to true", () => {
    const result = validateArgs(FreeMemorySchema, {});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.unload_models).toBe(true);
      expect(result.data.free_memory).toBe(true);
    }
  });
});
