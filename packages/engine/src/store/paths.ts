import { join } from "path";

/** Resolve paths relative to project root */
export function storePath(rootDir: string): string {
  return join(rootDir, "store");
}

export function constraintsPath(rootDir: string): string {
  return join(storePath(rootDir), "constraints");
}

export function statePath(rootDir: string): string {
  return join(storePath(rootDir), "state");
}

export function manuscriptsPath(rootDir: string): string {
  return join(rootDir, "manuscripts");
}

export function indexPath(rootDir: string): string {
  return join(storePath(rootDir), "index.md");
}

export function configPath(rootDir: string): string {
  return join(rootDir, "flowcabal.json");
}

/** Store subdirectories to initialize */
export const STORE_DIRS = [
  "constraints/characters",
  "constraints/world-rules",
  "constraints/plot",
  "state/timeline",
  "state/character-status",
] as const;
