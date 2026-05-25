# 右键 toggle target + Output markdown 渲染 设计稿

> 本期解两个独立的小痒：(1) 节点右键当前因 `selectNode` 副作用把编辑器开起来了，把右键改成纯粹的 toggle target（加进 / 移出），与 ContextMenuPanel 解耦；(2) 节点 output 区当前是 `whitespace-pre-wrap` 纯文本，复用 memory 的 `<Prose>` markdown 渲染，**不带** drop cap。同时把 `<Prose>` 抽成公共组件，memory 一并切到 import。

## 目标

- 节点右键 = toggle target（不在 target 加入；在 target 移出）。**不开编辑器**，**不弹菜单**，**不改选中状态**
- DAG 跑步中（`dagProgress !== null`）右键被拦下，toast 提示
- 删除节点入口从 ContextMenuPanel 迁到 FloatingPanel 底栏
- pane 空白处右键仍弹「添加节点」单项菜单（双击空白不能加节点，保留这条入口）
- output 区与 memory 共用 `<Prose>` markdown 渲染，drop cap 通过 `first` prop 控制

## 本期范围

### 包含

- **Canvas.tsx**：`onNodeContextMenu` 改为 toggle 直发；`ContextMenuPanel` 精简到只剩 pane 分支
- **store/useStore.ts**：加 `toggleTarget` action（`addToTarget` 保持不变，向后兼容 StaleTooltipBody / ErrorTooltipBody）
- **API `POST /api/workspaces/[id]/target`**：可选字段 `op: 'add' | 'toggle'`，默认 `'add'` 保留兼容
- **FloatingPanel.tsx**：底栏加「删除节点」按钮
- **components/Prose.tsx**（新文件）：从 memory/page.tsx 抽出 `<Prose>`
- **memory/page.tsx**：删 inline `Prose`，改 import
- **OutputsPanel.tsx**：running 态正文 + completed 态正文用 `<Prose>` 替换 `whitespace-pre-wrap` 纯文本

### 不含（推后期）

- 多选右键 batch toggle（项目还没做多选视觉，YAGNI）
- 右键 toggle 的视觉过场动画
- output 区的 markdown 安全沙箱定制（react-markdown 默认禁 raw html 已经够用）
- output markdown 内嵌的代码块语法高亮（用 `.fc-prose pre` 现有 mono 样式即可，未来要 hljs 单独议）
- 删除节点的二次确认（与项目现有 delete 一致省略）

## 砍掉的旧设计

`Canvas.tsx` 现在的 `onNodeContextMenu`：

```ts
const onNodeContextMenu = useCallback((event, node) => {
  event.preventDefault()
  if (!selectedNodeIds.has(node.id)) selectNode(node.id)  // ← 副作用开编辑器
  setContextMenu({ x, y, nodeId: node.id })               // ← 但 Dialog 之上的 mousedown 立刻关掉菜单
}, ...)
```

问题：
1. `selectNode(node.id)` 的副作用是 `floatingPanelOpen=true` → 用户看到编辑器弹出来
2. 紧接着 `setContextMenu` 的菜单因为 Dialog 的 backdrop 抢走 mousedown，**几乎从不可见**

用户实测："这个菜单实际上是没有弹出的"。本期把 onNodeContextMenu 改成不调 `selectNode` / 不调 `setContextMenu`，直接 toggle target。菜单的「重命名 / 删除 / 加入 target」三项功能下落到：

- 重命名：FloatingPanel 顶栏（双击节点名 → 已存在）
- 删除：FloatingPanel 底栏新增「删除节点」按钮（本期新增）
- 加入 target：右键即 toggle（本期新增）

## 架构总览

```
packages/apps/gui/src/
  components/
    Canvas.tsx                  ← onNodeContextMenu 改 toggle；ContextMenuPanel 删 node 分支
    FloatingPanel.tsx           ← 底栏加「删除节点」按钮
    Prose.tsx                   ← 新建。从 memory/page.tsx 抽 <Prose>
    OutputsPanel.tsx            ← running + completed 正文用 <Prose>
  app/
    memory/page.tsx             ← 删 inline Prose，改 import
    api/workspaces/[id]/target/route.ts  ← POST 加 op?: 'add'|'toggle'
  store/
    useStore.ts                 ← 加 internal_toggleTarget + toggleTarget wrapper
```

## API 改造

### `POST /api/workspaces/[id]/target`

Body schema：

```ts
{ nodeId: string; op?: 'add' | 'toggle' }
```

- `op === 'toggle'`：在 target 内则移出，不在则加入
- `op === 'add'` 或缺省：保留旧 add 语义（已存在则跳过）

`op` 缺省时走 add 是为了 **不动 `addToTarget`** —— `StaleTooltipBody` / `ErrorTooltipBody` 的「加入 target 重跑」按钮链路完全等同。

完整 handler：

```ts
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: workspaceId } = await params
  const { nodeId, op } = await request.json() as { nodeId: string; op?: 'add' | 'toggle' }
  const projectDir = process.cwd()
  const workspace = readWorkspace(projectDir, workspaceId)
  if (!workspace) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  }
  const has = workspace.target_nodes.includes(nodeId)
  if (op === 'toggle') {
    if (has) workspace.target_nodes = workspace.target_nodes.filter(id => id !== nodeId)
    else workspace.target_nodes.push(nodeId)
  } else {
    if (!has) workspace.target_nodes.push(nodeId)
  }
  writeWorkspace(projectDir, workspaceId, workspace)
  return NextResponse.json({ workspace: workspaceToRecord(workspace) })
}
```

## store 改造

`useStore.ts`：

在 `WorkspaceActions` 里加 `internal_toggleTarget`（模仿现有 `internal_addToTarget`）：

```ts
internal_toggleTarget = async (nodeId: string) => {
  const ws = this.#get().activeWorkspace
  if (!ws) return
  const wasInTarget = ws.target_nodes.includes(nodeId)
  try {
    const res = await fetch(`/api/workspaces/${ws.id}/target`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nodeId, op: 'toggle' }),
    })
    const data = await res.json()
    if (data.workspace) {
      const updatedWs = recordToWorkspace(data.workspace)
      this.#set((s: any) => ({
        workspaces: s.workspaces.map((w: Workspace) => w.id === updatedWs.id ? updatedWs : w),
        activeWorkspace: updatedWs,
        nodes: s.nodes.map((n: any) => syncNodeDataFromWorkspace(n, updatedWs)),
      }))
      toast.success(wasInTarget ? '已移出运行目标' : '已加入运行目标')
    }
  } catch {
    toast.error('操作失败')
  }
}
```

`wasInTarget` 在 fetch 前快照本地状态决定 toast 文案 —— 后端 response 只回最新 ws，不再回 op 结果。

`GuiState` interface 加签名：

```ts
toggleTarget: (nodeId: string) => Promise<void>
```

`useStore` factory 末尾 wrapper：

```ts
toggleTarget: (nodeId: string) => actions.internal_toggleTarget(nodeId),
```

加在 `addToTarget: (nodeId) => actions.internal_addToTarget(nodeId)` 那行下面。

`addToTarget` / `internal_addToTarget` 不动。

## Canvas.tsx 改造

### `onNodeContextMenu` 重写

```tsx
const dagProgress = useStore((s) => s.dagProgress)
const toggleTarget = useStore((s) => s.toggleTarget)

const onNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
  event.preventDefault()
  if (dagProgress !== null) {
    toast.warning('运行中无法修改 target')
    return
  }
  toggleTarget(node.id)
}, [dagProgress, toggleTarget])
```

加 `import { toast } from 'sonner'`（项目里 `Header.tsx` / store 都已用）。

**不再**：
- `selectNode(node.id)` —— 编辑器不开
- `setContextMenu({ x, y, nodeId: node.id })` —— 节点右键不出菜单
- 同步 selectedNodeIds —— 选中状态不变

### `onPaneContextMenu` 不动

仍 `setContextMenu({ x, y, nodeId: null })`，pane 右键继续弹 ContextMenuPanel。

### `ContextMenuPanel` 精简

删 `selectedIds` 参数；删 `selectNode` / `addToTarget` / `activeWorkspace` 三个订阅；删 `nodeId !== null` 整段分支。最终：

```tsx
function ContextMenuPanel({ x, y, nodeId, onClose }: {
  x: number
  y: number
  nodeId: string | null
  onClose: () => void
}) {
  const createNode = useStore((s) => s.createNode)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as HTMLElement)) onClose()
    }
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [onClose])

  if (nodeId !== null) return null  // 节点不再走菜单

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-[180px] bg-paper border border-rule rounded-md shadow-lift py-1 animate-slide-in font-body text-[13px]"
      style={{ left: x, top: y }}
    >
      <button
        className="w-full text-left px-3 py-1.5 cursor-pointer transition-colors duration-150 hover:bg-clay-faint text-ink hover:text-clay-deep"
        onClick={() => { createNode(`节点 ${nanoid(4)}`); onClose() }}
      >
        添加节点
      </button>
    </div>
  )
}
```

`<ContextMenuPanel>` 调用处去掉 `selectedIds={selectedNodeIds}` prop。

`nodeId !== null` 时 return null 是兜底；理论上节点路径不再 setContextMenu，到不了这里。但保留挡板防回归。

## FloatingPanel.tsx 改造

底栏当前（line 147-149）：

```tsx
<div className="shrink-0 px-7 py-3 border-t border-rule-soft font-mono text-[10.5px] text-ink-faint tracking-wide lowercase truncate">
  id: {nodeId || '—'}
</div>
```

改为 flex 两段：

```tsx
<div className="shrink-0 px-7 py-3 border-t border-rule-soft flex items-center justify-between">
  <span className="font-mono text-[10.5px] text-ink-faint tracking-wide lowercase truncate">
    id: {nodeId || '—'}
  </span>
  {nodeId && (
    <button
      type="button"
      onClick={() => {
        deleteNode(nodeId)
        onOpenChange(false)
      }}
      className="font-display italic text-[12.5px] text-error hover:opacity-80 transition-opacity cursor-pointer shrink-0 ml-3"
    >
      删除节点
    </button>
  )}
</div>
```

import 增 `deleteNode`：

```tsx
const deleteNode = useStore((s) => s.deleteNode)
```

加在文件顶部已有 `const renameNode = useStore((s) => s.renameNode)` 下面。

不弹二次确认 —— 与项目现有 delete 一致（SettingsDialog 删 LLM config / memory 删对话用 `window.confirm` 是 IDB 内容不可恢复才加；节点删走 engine 旧 sync API，已有 stale-tracker 处理下游，不另加确认）。

## Prose 抽取

### 新文件 `packages/apps/gui/src/components/Prose.tsx`

```tsx
'use client'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export function Prose({ children, first }: { children: string; first?: boolean }) {
  return (
    <div className={`fc-prose font-display text-[16px] leading-[1.7] text-ink ${first ? 'fc-prose-first' : ''}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {children}
      </ReactMarkdown>
    </div>
  )
}
```

字符级 1:1 平移自 memory/page.tsx:32-40。`fc-prose` / `fc-prose-first` CSS 在 globals.css:224-355 已存在，不动。

### `memory/page.tsx` 改造

删 line 32-40 的 `function Prose`。

import block 末尾加：

```tsx
import { Prose } from '@/components/Prose'
```

删除原 `import ReactMarkdown from 'react-markdown'` 和 `import remarkGfm from 'remark-gfm'`（不再直接用）。

其他不动 —— `<Prose key={seg.key} first={isFirstText}>{seg.text}</Prose>` 调用点保留，drop cap 仍按 `first={isFirstText}` 控制（每条助手消息第一段 `true`）。

## OutputsPanel.tsx 改造

引入 `import { Prose } from './Prose'`。

### running 态（line 76-78）

```tsx
// before
<div className="font-display text-[16px] leading-[1.7] text-ink whitespace-pre-wrap break-words">
  {runningChunks}
</div>

// after
<Prose>{runningChunks}</Prose>
```

### completed 态（line 121-123）

```tsx
// before
<div className="font-display text-[16px] leading-[1.7] text-ink whitespace-pre-wrap break-words">
  {output}
</div>

// after
<Prose>{output}</Prose>
```

**不传 `first` prop** → 没有 `fc-prose-first` → 没有 drop cap。用户需求 "无需做首字放大" 满足。

外层 `font-display text-[16px] leading-[1.7] text-ink` 与原 div 完全相同（`<Prose>` 复制了同样的 className），字号 / 行高 / 颜色不变；新增的是 `fc-prose` 提供的 markdown 排版规则（标题 / 列表 / code / blockquote / table）。

`break-words` 行为：`<Prose>` 不带 `break-words`。超长 URL 不换行的极端情况 YAGNI 不处理；如发现明显问题可在后续微调（加到 `.fc-prose` CSS 或 Prose className）。

「— 正在生成 —」/「— 此节点尚未付印 —」/ 字数 / 复制按钮 / 居中提示等其他 UI 不动。

## 错误与边界

| 场景 | 行为 |
|---|---|
| 右键节点时 `dagProgress !== null` | `toast.warning('运行中无法修改 target')`；不调 API，不改 state |
| 右键节点时单 node 流但 `dagProgress === null` | 不会出现（项目当前只有 `runAll` 路径，dag-start 必设 dagProgress）；如出现按 `dagProgress` 兜底允许 toggle |
| `toggleTarget` API 网络异常 | catch → `toast.error('操作失败')`；本地 ws 状态不变 |
| `toggleTarget` 后端返 404 | `data.workspace` undefined → 不更新 state；toast.error 不触发，但 toast.success 也不触发（静默失败）。此分支与 `addToTarget` 现有行为一致 |
| 删除节点按钮点击时 `nodeId === null` | 按钮被 `nodeId && (...)` 守住不渲染 |
| 删除节点后下游 ref 报错 | 走 engine `removeNode` + stale-tracker 旧路径，与 ContextMenuPanel 之前的 deleteNode 调用完全等同 |
| markdown 流到一半含不完整 `<` 或未闭合标记 | react-markdown 默认按文本渲染或忽略，与 memory 一致 |
| markdown 内嵌 raw HTML / script | react-markdown 默认禁用 raw html；安全无虑 |
| pane 空白右键 | 不变，仍弹 ContextMenuPanel 单项「添加节点」 |
| memory `<Prose>` 渲染 | first prop 仍按 `isFirstText` 传，drop cap 行为不变 |
| StaleTooltipBody / ErrorTooltipBody 的「加入 target 重跑」 | 仍调 `addToTarget` → API 默认 op='add'，行为完全等同 |
| 多选右键 | 当前不实现，只 toggle 被右键节点。多选状态不变（不消除也不扩展） |

## 测试

### engine 单测

本期不动 engine 文件层，跳过。

### GUI 人工

按下顺序走：

1. 右键一个未在 target 的节点 → 顶描边变 `clay-deep`，状态文字 "待运行" 或 "待重跑"（取决于是否有 output）；toast "已加入运行目标"
2. 再次右键同节点 → 顶描边变回 `rule`（默认 1px），状态文字 "completed"；toast "已移出运行目标"
3. 多次连续右键同节点 → 状态在加入 / 移出之间正确翻转
4. 右键节点时编辑器**不**打开 —— FloatingPanel 状态 `floatingPanelOpen` 保持不变
5. shift+左键 选中 3 个节点后右键其中一个 → 只 toggle 被右键那个，另外两个仍选中且 target 状态不变
6. 点 RunButton 开始跑 DAG，跑步中右键任意节点 → toast.warning "运行中无法修改 target"，无视觉变化
7. DAG 跑完后右键节点 → 正常 toggle
8. StaleTooltipBody（节点带 ✱ 时悬停）「加入 target 重跑」 → 仍把节点加进 target
9. ErrorTooltipBody（节点带 "● 上次失败" 时悬停）「加入 target 重跑」 → 仍把节点加进 target
10. 左键节点 → FloatingPanel 打开，editor tab 内容正常；底栏 mono `id: xxx` 右侧出现红色 "删除节点" 链接
11. 点「删除节点」 → 节点消失，FloatingPanel 关闭，下游引用 block 处理走旧路径
12. 节点 output 含 `# 标题` / `**bold**` / `- list` / 行内 `` `code` `` / ``` ```code block``` ``` → 完成态正确渲染 markdown
13. 跑某节点时切到 output tab → partial markdown 实时渲染（与 memory 同体感）
14. memory 对话页 → 第一段仍带 56px clay drop cap，其他段无；样式与改前一致
15. 空白处右键 → 弹「添加节点」单项菜单，点击建节点
16. 空白处右键后按 Esc 或点别处 → 菜单关闭
17. `bun run typecheck:gui` pass

## 实施顺序

1. API `POST /api/workspaces/[id]/target` 加 op 字段（手工 cURL 验证 add / toggle 两条路径）
2. store `internal_toggleTarget` + `toggleTarget` wrapper
3. Canvas `onNodeContextMenu` 改写 + ContextMenuPanel 精简
4. FloatingPanel 底栏「删除节点」
5. Prose 抽到 components/Prose.tsx + memory/page.tsx 改 import
6. OutputsPanel 用 `<Prose>` 替换 running / completed 正文
7. typecheck:gui + 人工 17 步

每步独立 commit。
