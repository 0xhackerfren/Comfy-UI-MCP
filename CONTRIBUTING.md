# Contributing to ComfyUI MCP Server

Thanks for your interest in contributing! Here's how to get started.

## Development Setup

1. Fork and clone the repository
2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file from the example:

```bash
cp .env.example .env
```

4. Build the project:

```bash
npm run build
```

5. Use watch mode for development:

```bash
npm run dev
```

## Project Structure

```
src/
  index.ts              # Server entry point and tool routing
  comfyui-client.ts     # HTTP/WebSocket client for ComfyUI
  config.ts             # Environment configuration
  types.ts              # TypeScript interfaces
  schemas.ts            # Zod validation schemas
  utils.ts              # Shared utilities
  node-cache.ts         # Cached node definitions
  workflow-builder.ts   # In-memory workflow graph builder
  workflow-store.ts     # JSON workflow persistence
  pipeline.ts           # Multi-step pipeline orchestrator
  tools/
    discovery.ts        # Node and model discovery tools
    workflow.ts         # Workflow building tools
    generation.ts       # Execution and pipeline tools
    assets.ts           # File upload/download tools
    queue.ts            # Queue management tools
    system.ts           # System info and memory tools
    advanced.ts         # Advanced tools (multi-LoRA, batch, presets, video, music, shorts)
  templates/
    index.ts            # Template registry
    txt2img.ts          # Text-to-image template
    ...                 # Other workflow templates
  resources/
    index.ts            # MCP resource definitions
  prompts/
    index.ts            # MCP prompt definitions
```

## Making Changes

1. Create a feature branch from `main`
2. Make your changes with clear, focused commits
3. Ensure `npm run build` passes without errors
4. Run `npm test` to verify tests pass
5. Open a pull request

## Adding a New Tool

1. Add the tool definition to the appropriate file in `src/tools/`
   - For advanced/complex tools, use `src/tools/advanced.ts` (schemas are defined locally with Zod)
   - For simpler CRUD tools, use the category-specific file and add schemas to `src/schemas.ts`
2. Add a Zod validation schema (locally in `advanced.ts` or in `src/schemas.ts`)
3. Add the tool name to the appropriate `Set` in `src/index.ts` (e.g. `ADVANCED_TOOLS`, `GENERATION_TOOLS`)
4. Add the handler case in the corresponding `handle*Tool` function
5. Update the README tools table

## Adding a New Template

1. Create `src/templates/your-template.ts` with a `create*Workflow` function
2. Add it to `TEMPLATE_LIST` and the switch statement in `src/templates/index.ts`
3. Update the README templates table

## Code Style

- TypeScript strict mode is enabled
- Use ES module imports (`.js` extension in import paths)
- Validate tool arguments with Zod schemas
- Return `isError: true` for user-facing errors

## Reporting Issues

Please include:
- Your ComfyUI version
- Node.js version
- MCP client (Cursor, Claude Desktop, etc.)
- Steps to reproduce
- Relevant error messages
