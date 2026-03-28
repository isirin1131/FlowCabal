import { join } from "path";
import { homedir } from "os";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { LlmConfig, NodeDef, Workflow, Workspace } from "./types.js";
import { LlmConfigsFileSchema, WorkflowSchema, WorkspaceSchema } from "./schema.js";

// 全局配置目录
export const GLOBAL_CONFIG_DIR = join(homedir(), ".config", "flowcabal");
export const LLM_CONFIGS_FILE = join(GLOBAL_CONFIG_DIR, "llm-configs.json");
export const WORKFLOWS_DIR = join(GLOBAL_CONFIG_DIR, "workflows");

// 项目目录
export function getMemoryDir(projectDir: string): string {
  return join(projectDir, "memory");
}

export function getCacheDir(projectDir: string): string {
  return join(projectDir, ".cache");
}

export function getWorkspaceDir(projectDir: string, workspaceId: string): string {
  return join(getCacheDir(projectDir), workspaceId);
}

export function getWorkspaceNodesFile(projectDir: string, workspaceId: string): string {
  return join(getWorkspaceDir(projectDir, workspaceId), "nodes.json");
}

export function getNodeOutputFile(projectDir: string, workspaceId: string, nodeId: string): string {
  return join(getWorkspaceDir(projectDir, workspaceId), "outputs", `${nodeId}.json`);
}

// 工具函数
function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

// 全局配置读写
export function readLlmConfigs(): Record<string, LlmConfig> {
  ensureDir(GLOBAL_CONFIG_DIR);
  if (!existsSync(LLM_CONFIGS_FILE)) return {};
  
  const content = readFileSync(LLM_CONFIGS_FILE, "utf-8");
  const parsed = JSON.parse(content);
  return LlmConfigsFileSchema.parse(parsed);
}

export function writeLlmConfigs(configs: Record<string, LlmConfig>): void {
  ensureDir(GLOBAL_CONFIG_DIR);
  const validated = LlmConfigsFileSchema.parse(configs);
  const content = JSON.stringify(validated, null, 2);
  writeFileSync(LLM_CONFIGS_FILE, content, "utf-8");
}

// Workflow读写
export function readWorkflow(id: string): Workflow | null {
  ensureDir(WORKFLOWS_DIR);
  const workflowFile = join(WORKFLOWS_DIR, `${id}.json`);
  if (!existsSync(workflowFile)) return null;
  
  const content = readFileSync(workflowFile, "utf-8");
  const parsed = JSON.parse(content);
  return WorkflowSchema.parse(parsed);
}

export function writeWorkflow(workflow: Workflow): void {
  ensureDir(WORKFLOWS_DIR);
  const workflowFile = join(WORKFLOWS_DIR, `${workflow.name}.json`);
  const validated = WorkflowSchema.parse(workflow);
  const content = JSON.stringify(validated, null, 2);
  writeFileSync(workflowFile, content, "utf-8");
}

// Workspace 数据读写
function workspaceToJson(workspace: Workspace): object {
  return {
    id: workspace.id,
    name: workspace.name,
    nodes: workspace.nodes,
    outputs: Object.fromEntries(workspace.outputs),
    upstream: Object.fromEntries(workspace.upstream),
    downstream: Object.fromEntries(workspace.downstream),
    target_nodes: workspace.target_nodes,
    stale_nodes: workspace.stale_nodes,
  };
}

function jsonToWorkspace(data: any): Workspace {
  const parsed = WorkspaceSchema.parse(data);
  return {
    id: parsed.id,
    name: parsed.name,
    nodes: parsed.nodes,
    outputs: new Map(Object.entries(parsed.outputs)),
    upstream: new Map(Object.entries(parsed.upstream)),
    downstream: new Map(Object.entries(parsed.downstream)),
    target_nodes: parsed.target_nodes,
    stale_nodes: parsed.stale_nodes,
  };
}

export function readWorkspace(projectDir: string, workspaceId: string): Workspace | null {
  const nodesFile = getWorkspaceNodesFile(projectDir, workspaceId);
  if (!existsSync(nodesFile)) return null;
  
  const content = readFileSync(nodesFile, "utf-8");
  return jsonToWorkspace(JSON.parse(content));
}

export function writeWorkspace(projectDir: string, workspaceId: string, workspace: Workspace): void {
  const nodesFile = getWorkspaceNodesFile(projectDir, workspaceId);
  ensureDir(join(nodesFile, ".."));
  const content = JSON.stringify(workspaceToJson(workspace), null, 2);
  writeFileSync(nodesFile, content, "utf-8");
}

// Agent记忆路径
export function memoryPath(projectDir: string): string {
  return getMemoryDir(projectDir);
}

export function memoryIndexPath(projectDir: string): string {
  return join(memoryPath(projectDir), "index.md");
}

export const MEMORY_SEED_FILES = ["voice.md"];
export const MEMORY_SEED_DIRS = ["characters", "world", "manuscripts"];
