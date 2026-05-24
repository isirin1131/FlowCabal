# FlowCabal Agent Guide

**Current Focus**: FlowCabal GUI — Next.js 应用使用 @xyflow/react 构建 DAG 编辑器。

---

## Quick Start

```bash
bun dev              # 启动 GUI 开发服务器 (http://localhost:3000)
bun run typecheck    # 验证 engine + cli 代码
bun run typecheck:gui # 验证 GUI 代码
```

---

## 迭代历史（最新优先）

| 日期 | 内容 | spec | plan |
|------|------|------|------|
| 2026-05-24 | **B+C+D+E 期**：节点 4 态视觉、双尺度 stream（节点级 + token 级）、连线只读化、EditorPanel ref picker、RunButton dag 进度 | [spec](docs/superpowers/specs/2026-05-24-bcde-node-interaction.md) | [plan](docs/superpowers/plans/2026-05-24-bcde-node-interaction.md) |
| 2026-05-23 | **A 期**：视觉统一（paper / clay / ink + Source Serif），所有面板迁到新调性 | [spec](docs/superpowers/specs/2026-05-23-gui-visual-unification-design.md) | [plan](docs/superpowers/plans/2026-05-23-gui-visual-unification.md) |

下期议题（已在 BCDE spec 留接入点）：
- stale 视觉 + tooltip + 「加入 target 重跑」
- error 视觉 + runtimeErrors + runAll catch
- 「移出 target」入口 + 草稿态
- 键盘整层（方向 / Tab / Enter / Esc / cmd+R / Backspace 同步）
- 复制粘贴 / undo/redo

---

## GUI 开发指南

所有 GUI 相关规范详见：

| 文档 | 用途 |
|------|------|
| `docs/GUI_DEVELOPMENT_ZH.md` | 开发指南（中文，含完整代码和模式） |

**必读章节**：
- [项目初始化](#docs/GUI_DEVELOPMENT_ZH.md#1-项目初始化) — 技术栈和安装
- [shadcn 关键规则](#docs/GUI_DEVELOPMENT_ZH.md#3-ui-组件) — 样式、表单、组件
- [xyflow 集成](#docs/GUI_DEVELOPMENT_ZH.md#4-xyflow-集成) — Canvas 和自定义节点
- [状态管理](#docs/GUI_DEVELOPMENT_ZH.md#7-状态管理) — Zustand class-based actions

---

## 项目内已知陷阱

下面是这个 codebase 里**看代码完全发现不了 / 改某处会触发别处**的几条不变性，写代码或 review 时先扫一眼。

### dagre layout 必须给 edge 传 `{}` label

`packages/apps/gui/src/lib/engine-to-flow.ts` 里的 `getLayoutedElements` —— dagre 0.8.5 的 `g.setEdge(s, t)` 不传第三个 label 参数会让 layout 阶段崩 `undefined.points`。必须 `setEdge(s, t, {})`。**workspace 没 ref 时 edges 空数组不触发**，加 ref 后立刻死，整个 createNode / 自动排版都连锁失败。

### `#updateNodeDataFromWorkspace` 必须同步重算 edges

`packages/apps/gui/src/store/useStore.ts` 的 `#updateNodeDataFromWorkspace`（被 block CRUD 4 处调用）必须从 `updatedWs.upstream` 重新生成 store.edges。**只刷 nodes 不刷 edges** 会导致加 ref block 后画布不渲染新连线。

### CustomEdge 的 type 字段要显式设 `'custom'`

xyflow 的 `<ReactFlow defaultEdgeOptions={{ type: 'custom' }}>` 是 **fill-missing 不是 override**。所以 `workspaceToFlowData` 在构造 edge 时必须显式写 `type: 'custom'`，写成 `'default'` 会让 CustomEdge 完全不生效。

### 连线只读化的契约

- 节点上的 xyflow `<Handle>` 仍存在以保持 edge 路径计算，但视觉用 `!opacity-0 !pointer-events-none` 完全隐藏
- `nodesConnectable={false}` + 不传 `onConnect`：用户无法拖出连线
- `ref` 创建唯一入口是 **EditorPanel 的「+ 添加段落 → 引用上游」picker**；不要在任何 canvas 交互里建 ref block
- ref block 创建后只读：要换上游就删了重加，避免 `insertBlock` 的 `oldRef` 路径复杂化

### 节点视觉是 4 态派生，不读 `data.status`

`FlowNode.tsx` 里 `visualStatus` 从三个来源派生：`runningNodeId === id`（store）+ `activeWorkspace.target_nodes.includes(id)` + `!!data.output`。`data.status` 字段还在但是**信息性，不驱动视觉**。下期接 stale / error 时新增 store.runtimeErrors map 同维度派生。

### 流式协议 = NDJSON 不是 SSE

`/api/engine/run-all` 返回 `Content-Type: application/x-ndjson`，客户端用 `fetch + response.body.getReader() + TextDecoder` 解析行。**不用 EventSource**（不支持 POST body）。engine 的 `runAllStream` 是 async generator，旧 `runAll` 必须保留不动（CLI 还在用）。

---

## Skills

加载以下 skills 获取详细模式：

| Skill | 触发场景 |
|-------|----------|
| **shadcn** | 使用 shadcn/ui 组件、表单、布局 |
| **xyflow-react** | DAG 编辑器、节点类型、性能优化 |
| **zustand** | 状态管理、actions、slices |
| **vercel-react-best-practices** | 性能优化（waterfalls、bundle、memo） |
| **vercel-react-view-transitions** | 页面动画、共享元素 |
| **tailwind-design-system** | Tailwind v4 主题、设计系统 |
| **web-design-guidelines** | 可访问性、用户体验 |

---

## 项目结构

```
packages/
├── engine/           # Core engine (workspace, nodes, LLM, runner)
├── cli/              # CLI 工具（用 engine 旧 sync API）
└── apps/
    └── gui/          # Next.js GUI 应用
```

---

## Engine 参考

Engine API 可通过 `@flowcabal/engine` 导入：

```typescript
import { Workspace, TextBlock, NodeEvent, runAllStream } from '@flowcabal/engine'
```

详细类型定义见 `packages/engine/src/types.ts`。`runAllStream` 在 `packages/engine/src/workspace/core/runner.ts`，与旧 `runAll` / `runSingle` 并列。
