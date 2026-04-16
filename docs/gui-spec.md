# FlowCabal GUI Specification

## 1. Overview

FlowCabal GUI 是 FlowCabal 引擎的 Web 可视化界面，用于创建和管理 AI 辅助小说写作工作流。

## 2. 技术栈

- **Framework**: Next.js (App Router)
- **Graph UI**: xyflow (@xyflow/react)
- **State Management**: Zustand
- **Styling**: Tailwind CSS + shadcn/ui
- **Schema Validation**: Zod
- **Build Tool**: Bun

## 3. 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                      Next.js WebApp                         │
├─────────────────────────────────────────────────────────────┤
│              Header (Logo + WS + Outputs)                   │
├─────────────────────────────────────────────────────────────┤
│                    xyflow Canvas                       │
│                              ┌─────────────────┐          │
│                              │  [▶ Run]        │  ← 画布右上角浮动     │
│                              └─────────────────┘          │
│                    [浮动面板]                       │
└─────────────────────────────────────────────────────────────┘
```

**设计原则**：
- Run 按钮仅在 Workspace 打开时显示（画布右上角浮动）
- Header 只保留 Logo + WS 切换 + Outputs

**Pinned Outputs 页面**：
- 用户固定关注的 outputs
- 运行完/更新时高亮提示

## 4. 页面结构

### 4.1 主页面布局

```
┌─────────────────────────────────────────────────────────────┐
│  Header: Logo | [WS ▼] | [+ New] | [Outputs] | [Memory] | [Manuscripts]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                   xyflow Canvas                             │
│                               ┌───────────────────┐          │
│                               │  ▶ Run           │          │
│                               └───────────────────┘          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**设计原则**：
- 单栏布局，最大化画布空间
- Run 按钮仅在 Workspace 打开时显示（画布右上角浮动）
- 所有功能通过 Header 访问，无需切换到 CLI

### 4.2 顶部 Header

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  🌀 FlowCabal  │ [workspace-1 ▼] │ [+ New] │ [Outputs] │ [Memory] │ [Manuscripts]        │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**Workspace 切换下拉**：显示所有 Workspace，点击切换

**功能按钮**：
- **Outputs**：Pinned Outputs 页面
- **Memory**：Memory 对话/管理页面
- **Manuscripts**：手稿管理页面（上传/编辑）

### 4.3 Pinned Outputs 页面

独立页面/面板，显示用户关注的 outputs：

```
┌────────────────────────────────────────────────────────────────┐
│  Pinned Outputs                                      [x]  │
├────────────────────────────────────────────────────────────────┤
│  [+ Add Output]                                              │
├────────────────────────────────────────────────────────────────┤
│  ⭐ Outline Writer                                     [x] │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ [generated outline...]                                 │  │
│  │                                         [📋] [👁]   │  │
│  └────────────────────────────────────────────────────────────┘  │
├────────────────────────────────────────────────────────────────┤
│  ⭐ Chapter 1                                          [x] │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ [generated chapter content...]                          │  │
│  │                                         [📋] [👁]   │  │
│  └────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

**Add Output** 方式：
- 从节点列表选择
- 或右键节点 → "固定 output"

**更新时**：高亮 + 通知

## 5. UI 组件设计

### 5.1 自定义节点 (xyflow)

```
┌─────────────────────────┐
│  📝 Node Label     [⋮]  │ ← 浮动按钮
├─────────────────────────┤
│ system: 2 blocks        │ ← 显示块数量
│ user: 3 blocks          │
├─────────────────────────┤
│ ● pending / ⚠ stale     │ ← 状态指示器
│ ✓ completed / ✗ error   │
└─────────────────────────┘
```

**节点状态颜色**:
- pending: gray (`#6b7280`)
- stale: amber (`#f59e0b`)
- completed: emerald (`#10b981`)
- error: red (`#ef4444`)

**选中态**: 蓝色边框 + 阴影

### 5.2 浮动面板 (选中节点时)

节点选中时从底部浮出：
```
┌──────────────────────────────────────────────────────────┐
│ [Editor ▼] │ [Outputs ▼] │ [Config ▼]                  │
├─────────────────────────────────────────────────────────────────┤
│  Tab: Editor                                    [✕]   │
│ ─── System Prompt ────────────────────────── [+ Add Block]      │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ 1. Literal         [Ref ▼]  [Inject ▼]  [🗑]         │ │
│ │ ┌────────────────────────────────────────────┐        │ │
│ │ │ (textarea)                               │        │ │
│ │ └────────────────────────────────────────────┘        │ │
│ └──────────────────────────────────────────────────────┘ │
│ ─── User Prompt ────────────────────────── [+ Add Block]   │
│ ...                                                     │
└──────────────────────────────────────────────────────────┘
```

**Block 类型选择** (下拉菜单):
- Literal (纯文本)
- Ref (引用节点输出)
- Agent Inject (动态注入)

### 5.3 浮动面板 (Outputs Tab)

保留此面板显示所有节点的 output（可选），用户可自由管理 pinned outputs：

```
┌──────────────────────────────────────────────────────────┐
│ [Editor] │ [All Outputs] │ [Config]                       │
├──────────────────────────────────────────────────────────┤
│  All Outputs                [+ Pin to Page] [Clear] [✕]  │
├──────────────────────────────────────────────────────────┤
│ ▼ Outline Writer               12:30  [⭐] [📋] [👁]      │
│ ▼ Chapter 1                  12:31  [⭐] [📋] [👁]       │
│ ▼ Chapter 2                  12:32  [⭐] [📋] [👁]      │
└──────────────────────────────────────────────────────────┘
```

**[⭐] 点击后将此 output 固定到 Pinned Outputs 页面

### 5.4 浮动面板 (Config Tab)

```
┌──────────────────────────────────────────────────────────┐
│ [Editor] │ [Outputs] │ [Config ▼]                          │
├──────────────────────────────────────────────────────────┤
│  LLM Configuration                         [✕]          │
├──────────────────────────────────────────────────────────┤
│ Provider: [OpenAI ▼]                                 │
│ Model:    [gpt-4o ▼]                                 │
│ API Key:  [••••••••••••••••]                         │
│ ────────────────────────────────────────────────────── │
│ [+ Add Config]                                        │
├──────────────────────────────────────────────────────────┤
│ ▼ Default                                            │
│   Temperature: [0.7]    Max Tokens: [4096]            │
└──────────────────────────────────────────────────────────┘
```

### 5.5 右键菜单 + 快捷按钮

**节点右键菜单**:
- 添加子节点
- 删除节点
- 复制

**Canvas 空白处**:
- 双击：添加节点
- 右键：快捷菜单

## 6. Zustand Store 设计

```typescript
interface GuiState {
  // 多个 Workspace 并行
  workspaces: Map<string, Workspace>
  activeWorkspaceId: string | null
  
  // UI 状态
  selectedNodeId: string | null
  floatingPanel: { type: 'editor' | 'outputs' | 'config'; nodeId?: string } | null
  isRunning: boolean
  
  // pinned outputs
  pinnedOutputs: string[]

  // Run 按钮
  showRunButton: boolean // Workspace 打开时显示
  
  // LLM 配置
  llmConfigs: LlmConfig[]
  defaultLlmConfig: string | null
  
  // Actions
  loadWorkspaces(): Promise<void>
  createWorkspace(name: string): Promise<Workspace>
  switchWorkspace(id: string): void
  closeWorkspace(id: string): void

  // Pinned Outputs
  pinOutput(nodeId: string): void
  unpinOutput(nodeId: string): void
  
  // 节点操作
  addNode(wsId: string, label: string): void
  removeNode(wsId: string, nodeId: string): void
  renameNode(wsId: string, nodeId: string, label: string): void
  selectNode(nodeId: string | null): void
  
  // Block 操作
  addBlock(wsId: string, nodeId: string, block: TextBlock, isSystem: boolean): void
  updateBlock(wsId: string, nodeId: string, isSystem: boolean, index: number, block: TextBlock): void
  removeBlock(wsId: string, nodeId: string, isSystem: boolean, index: number): void
  
  // 运行
  runAll(wsId: string): Promise<void>
  
  // LLM
  addLlmConfig(config: LlmConfig): void
  setDefaultLlmConfig(name: string): void
}
```

### 6.1 多 Workspace 并行

```
┌─────────────────────────────────────────────────────┐
│  [workspace-1 ▼] [+ New]                         │
│  当前: ws-1                                       │
└─────────────────────────────────────────────────────┘
```

- 每个 Workspace 独立存储
- 切换时加载对应图

## 7. API 设计

### 7.1 Workspace API

```
GET  /api/workspaces
     Response: { workspaces: WorkspaceMeta[] }

GET  /api/workspaces/:id
     Response: { workspace: Workspace }

POST /api/workspaces
     Body: { name: string }
     Response: { workspace: Workspace }

PUT  /api/workspaces/:id
     Body: { workspace: Workspace }
     Response: { success: boolean }

DELETE /api/workspaces/:id
     Response: { success: boolean }
```

### 7.2 Engine API Endpoints

```
POST /api/engine/run-all
  Body: { workspace: Workspace, config: LlmConfig }
  Response: { executed: string[], outputs: Record<string, string> }

POST /api/engine/validate
  Body: { workspace: Workspace }
  Response: { valid: boolean, errors: string[] }
```

### 7.3 LLM Config API

```
GET  /api/llm-configs
     Response: { configs: LlmConfig[] }

POST /api/llm-configs
     Body: LlmConfig
     Response: { success: boolean }

DELETE /api/llm-configs/:name
     Response: { success: boolean }
```

## 8. 数据模型映射

### 8.1 Workspace ↔ xyflow

```
Engine Workspace          xyflow Node/Edge
─────────────────────────────────────────
nodes[id]        →       nodes[id] (custom node)
upstream[nodeId]→       edges[source: refNode, target: nodeId]
downstream[nodeId]→     (双向关系，只需存一次)
outputs[nodeId] →       node.data.output
stale_nodes      →      node.data.status = 'stale'
target_nodes    →      (内部状态)
```

### 8.2 自定义 Node Data

```typescript
interface FlowNodeData {
  label: string
  systemPrompt: TextBlock[]
  userPrompt: TextBlock[]
  status: 'pending' | 'stale' | 'completed' | 'error'
  output?: string
}
```

## 9. 自动布局

使用 dagre 布局算法:

1. 读取所有节点和边
2. 计算层级拓扑布局
3. 应用到 xyflow viewport

**布局配置**:
- direction: 'TB' (top-to-bottom)
- nodeSep: 80
- rankSep: 100

## 10. 持久化策略

### 10.1 本地开发
- localStorage 缓存活跃 Workspace
- 支持导出/导入 JSON

### 10.2 生产环境
- 文件系统存储 (`workspaces/*.json`)

## 11. 多 Workspace 并行设计

### 11.1 架构

```
┌────────────────────────────────────────────┐
│ Zustand: workspaces Map<id, Workspace>   │
│           activeId: string                │
├────────────────────────────────────────────┤
│ 多个 Workspace 独立加载到 Engine         │
│ 运行时隔离，避免状态污染                 │
└────────────────────────────────────────────┘
```

### 11.2 切换逻辑

1. 切换时：保存当前 WS → 从 API 加载新 WS
2. 用户选择关注的 output 后，运行完/更新时 Header 自动高亮显示

## 12. 实现阶段

| Phase | 任务 | 优先级 |
|-------|------|--------|
| 1 | Next.js + shadcn/ui 基础搭建 | P0 |
| 2 | API routes (Engine + Workspace) | P0 |
| 3 | Zustand store (多 WS 并行) | P0 |
| 4 | xyflow 集成 + 自定义节点 | P0 |
| 5 | 节点 CRUD 操作 | P0 |
| 6 | 浮动面板 (Editor/Outputs/Config) | P0 |
| 7 | 多 Workspace 切换 + 并行运行 | P0 |
| 8 | 自动布局 (dagre) | P2 |
| 9 | Workspace 持久化 | P1 |

## 12. 后续可扩展功能

- 节点模板预设
- 历史记录 (undo/redo)
- 导出为 Markdown/PDF
- 多人协作 (预留接口)
