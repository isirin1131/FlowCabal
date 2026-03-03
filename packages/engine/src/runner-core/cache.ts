import { mkdir, readFile, writeFile } from "fs/promises";
import { dirname } from "path";
import {
  workspaceMetaPath,
  workspaceNodesPath,
} from "../paths.js";
import { WorkspaceMetaSchema } from "../schema.js";
import { newId } from "../id.js";
import type {
  WorkspaceMeta,
  NodeDef,
} from "../types.js";
import { z } from "zod";

// ── JSON helpers（state.ts 也使用） ──

export async function readJson<T>(path: string, schema: z.ZodType<T>): Promise<T | null> {
  try {
    const raw = await readFile(path, "utf-8");
    return schema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function writeJson(path: string, data: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(data, null, 2), "utf-8");
}

// ── Workspace 生命周期 ──

export async function createWorkspace(
  rootDir: string,
  projectId: string,
): Promise<string> {
  const id = newId();
  const meta: WorkspaceMeta = {
    projectId,
    createdAt: new Date().toISOString(),
  };
  await writeJson(workspaceMetaPath(rootDir, id), meta);
  return id;
}

export async function readWorkspaceMeta(
  rootDir: string,
  workspaceId: string,
): Promise<WorkspaceMeta | null> {
  return readJson(workspaceMetaPath(rootDir, workspaceId), WorkspaceMetaSchema);
}

// ── Workspace 节点写入 ──

export async function writeWorkspaceNodes(
  rootDir: string,
  workspaceId: string,
  nodes: NodeDef[],
): Promise<void> {
  await writeJson(workspaceNodesPath(rootDir, workspaceId), nodes);
}
