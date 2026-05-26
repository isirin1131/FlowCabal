declare module '*.tar' {
  const path: string;
  export default path;
}

// Node 22 stable，但 @types/node 20 还没默认声明这个模块
declare module 'node:sea' {
  export function isSea(): boolean;
  export function getAsset(key: string): ArrayBuffer;
  export function getAsset(key: string, encoding: string): string;
  export function getAssetAsBlob(key: string, options?: { type?: string }): Blob;
  export function getRawAsset(key: string): ArrayBuffer;
}
