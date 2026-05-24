<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version (Next 16+ Turbopack, React 19) has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# GUI 内特定陷阱

下面这些都是已踩过、看代码发现不了的坑。改 GUI 之前先扫一眼。

## Radix Select Value 不能塞 children

React 19 + Next 16 严格 ref 检查会让 `<SelectValue placeholder="…">{value}</SelectValue>` 抛 createRoot/portal 冲突。**只用 `placeholder`**，被选中的 `<SelectItem>` 内容会自动 mirror 上来。

## React 19 不许渲染体里调 store setter

`ContextMenuPanel` 渲染时调 `selectNode(...)` 会被 React 19 严格模式抓住 `Cannot update a component while rendering a different component`。把 setState 移到事件处理（`onNodeContextMenu` 等）或 `useEffect`。

## Next 15+ dynamic route params 是 Promise

```ts
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params  // 必须 await
  ...
}
```

## xyflow `defaultEdgeOptions` 是 fill-missing 不是 override

构造 edge 时显式 `type: 'custom'`，不要 `'default'`。defaultEdgeOptions 不会覆盖已有 type 字段。

## store edges 跟 ws.upstream 必须同步

任何修改 `ws.upstream` 的操作（block CRUD via `#updateNodeDataFromWorkspace`，或 workspace load via `workspaceToFlowData`）都必须同步重算 store.edges。只刷 nodes 不刷 edges 会让画布连线不更新。

## handle 视觉隐藏但 DOM 保留

```tsx
<Handle type="target" position={Position.Top} id="t"
  className="!opacity-0 !pointer-events-none" />
```

handle 节点必须保留（xyflow edge 路径计算需要），但视觉用 `!opacity-0` 隐藏。`nodesConnectable={false}` + 不传 `onConnect` 让用户无法拖动连线。

## FlowNode visualStatus 不读 data.status

视觉 4 态从 store 派生：
- `runningNodeId === id` → running（N1 光晕）
- `target_nodes.includes(id) && !output` → target+pending
- `target_nodes.includes(id) && output` → target+completed
- else → completed

`data.status` 字段还存在但**信息性**，不驱动视觉。
