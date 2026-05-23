# FlowCabal GUI 视觉统一（A 期）· 设计 Spec

**日期**: 2026-05-23
**分支**: `GUI_support`
**作者**: tianzhaotao（与 Claude Opus 4.7 协作）

---

## 1 · 背景与目标

当前 GUI 视觉处于"半完工"状态。主画布、Header、memory chat 已采用新调性（paper / clay / ink 调色板 + 衬线显示字体 + 罗马数字编号 + `〔 〕` 工具引语 + `— — scene-label — —` 等约定）。但 FloatingPanel、EditorPanel、ConfigPanel、OutputsPanel、/outputs、/manuscripts、SettingsDialog 仍是裸 shadcn 默认调性（Card / Badge / lucide 图标按钮 / 默认 sans 字体）。

同一应用里"两套语言"导致明显的未完工感。

本期目标：**把所有剩余面板迁到新视觉系统，让整个 GUI 在视觉上是一体的。**

显式不在本期：
- FloatingPanel 形态变化（Dialog → 抽屉）—— 留给下期 B+D
- block 拖排 / 类型切换 / ref 内嵌编辑 —— 留给下期 B+D
- target / stale / preview / 节点级实时状态 —— 留给下期 C+E
- 节点交互模型修补（双击位置、断线同步、右键真做子节点等）—— 留给下期 B+D
- 视觉原子组件抽取（SceneLabel / HairlineBlock / 等）—— 本期 inline className，下期 B+D 视情况再抽

---

## 2 · 范围清单

### 2.1 重画（结构不动，仅换视觉）

| 路径 | 备注 |
|---|---|
| `src/components/FloatingPanel.tsx` | 仍是 shadcn Dialog 容器，但 chrome 全换。Tabs 从 3 减到 2 |
| `src/components/EditorPanel.tsx` | block list 仍存在。结构沿用，类型切换 / 拖排留下期 |
| `src/components/OutputsPanel.tsx` | pre 换为 display serif 排印 |
| `src/app/manuscripts/page.tsx` | shadcn Card 换 hairline well |
| `src/components/SettingsDialog.tsx` | 业务逻辑不动，仅迁移 chrome / 表单组件视觉 |

### 2.2 删除

- `src/app/outputs/` 整目录
- `src/components/ConfigPanel.tsx`（节点 name+ID 合并到 EditorPanel 顶部 / FloatingPanel 顶部 chrome / 底部 mono 角注）
- `src/components/Header.tsx` 中 `<NavLink href="/outputs">outputs</NavLink>` 及其两侧 `<Sep />`
- `src/store/useStore.ts` 中：
  - `pinnedOutputs: string[]` 字段
  - `togglePinOutput` action（类型 + 实现）
  - `persist` 配置中的 `pinnedOutputs` partialize 项

### 2.3 结构变化（不仅是样式）

- FloatingPanel 三个 Tab（editor / output / config）→ 两个 Tab（editor / output）。Config Tab 取消。
- 节点 label inline editable 上移到 FloatingPanel 顶部 chrome。
- 节点 ID 以 mono 微文本展示在 FloatingPanel 底部角注。

---

## 3 · 视觉令牌（已存在，不动）

`src/app/globals.css` `@theme` 区已定义。本期不新增 / 不修改令牌，仅引用。

**颜色**：`--color-paper` / `--color-paper-deep` / `--color-paper-deep2` / `--color-ink` / `--color-ink-soft` / `--color-ink-faint` / `--color-rule` / `--color-rule-soft` / `--color-clay` / `--color-clay-deep` / `--color-clay-faint` / `--color-error` / `--color-error-faint`

**字体**：`--font-display`（Noto Serif SC / Songti） / `--font-body`（PingFang SC） / `--font-mono`

**圆角**：`--radius-sm 4px` / `--radius-md 6px` / `--radius-lg 10px`

**阴影**：`--shadow-paper` / `--shadow-lift`

**动画**：`--animate-fade-in` / `--animate-slide-in` / `--animate-node-enter` / `--animate-pulse-dot`

---

## 4 · 视觉约定（既有规律，本期所有面板共同遵循）

这些不抽成组件，但所有面板都按相同模式手写：

### 4.1 scene-label

居中、mono、小号、宽 tracking、lowercase，前后各两根 mono 短划线：

```html
<div className="text-center select-none">
  <span className="font-mono text-[10.5px] text-ink-faint tracking-[0.18em] lowercase">
    <span className="text-rule mr-[18px] tracking-[-1px]">— —</span>
    settings
    <span className="text-rule ml-[18px] tracking-[-1px]">— —</span>
  </span>
</div>
```

### 4.2 hairline well

paper-deep 底色 + rule 边 + rounded-md，**不再 rounded-xl**。内部通常上下两段，中间一根 `rule-soft` 横线分隔：

```html
<div className="bg-paper-deep border border-rule rounded-md">
  <div className="px-4 py-2 border-b border-rule-soft">{/* head */}</div>
  <div className="px-4 py-3">{/* body */}</div>
</div>
```

### 4.3 meta-text

mono 10.5–11px / ink-faint / wide tracking / lowercase。用于元数据 / 角注 / 键盘提示：

```html
<span className="font-mono text-[10.5px] text-ink-faint tracking-[0.14em] lowercase">
  completed · 1,247 字
</span>
```

### 4.4 text button

无填充，纯文字。

- 主操作（clay）：`font-display italic text-[14px] text-clay hover:text-clay-deep transition-colors cursor-pointer`
- 次操作（ink-soft）：`font-display italic text-[14px] text-ink-soft hover:text-ink transition-colors cursor-pointer`
- 危险（error）：`font-display italic text-[14px] text-ink-faint hover:text-error transition-colors cursor-pointer`
- "付印"风 underline 按钮：`text-clay border-b border-clay pb-[2px] hover:text-clay-deep hover:border-clay-deep`

### 4.5 关闭按钮 `×`

`button` 元素，`font-display text-[18px] text-ink-faint hover:text-clay transition-colors leading-none cursor-pointer`，`aria-label="关闭"`。

### 4.6 Tabs（文字开关风）

不使用 shadcn TabsList background。直接文字 + `·` 分隔：

```html
<div className="flex items-baseline gap-3 font-body text-[13px]">
  <button className="text-ink relative pb-[2px]
    after:content-[''] after:absolute after:left-0 after:right-0 after:-bottom-px
    after:h-px after:bg-clay">editor</button>
  <span className="text-rule select-none">·</span>
  <button className="text-ink-faint hover:text-ink">output</button>
</div>
```

### 4.7 ref 列表 / chrome 列表 hover

paper-deep hover 背景，左侧 2px clay 竖线表示 active（见 memory chat ConversationItem）。

---

## 5 · 各面板设计

### 5.1 FloatingPanel

**Dialog 容器**
- `bg-paper border border-rule shadow-lift rounded-md`
- `max-w-[820px] max-h-[70vh] p-0 gap-0`
- 进出动画：复用 shadcn Dialog 自带 + globals 中 fade-in
- DialogTitle 保留 `sr-only`（无障碍）

**顶部 chrome（替代现 `<div className="px-4 py-2 border-b">` + TabsList）**

布局：高 56px，单行 baseline 对齐。
```
[ Roman ]  [ node label, inline editable ]      [ tab toggle ]   [ × ]
```

- 容器：`flex items-baseline gap-5 px-7 py-4 border-b border-rule-soft`
- Roman：`font-display text-[20px] text-clay leading-none`
- node label：默认 `font-display text-[16px] text-ink leading-tight`；双击进入 `<input>` 编辑态：
  - input 样式：`bg-transparent border-b border-clay outline-none font-display text-[16px] text-ink pb-0.5 w-full max-w-[280px]`
  - Enter 提交、Esc 还原（参考 `app/memory/page.tsx` ConversationItem 模式）
  - 提交调 `renameNode(nodeId, label)`
- tab toggle：`ml-auto` + § 4.6 文字开关；选项 `editor` / `output`
- 关闭 `×`：§ 4.5 同款，由 shadcn Dialog 提供。需要确保 Dialog 内置 close 按钮被替换或样式 override，使用文字 `×` 而非 lucide `X`

**内容区**
- `flex-1 overflow-y-auto px-7 py-6`
- EditorPanel / OutputsPanel 内部自带 `max-w-[680px] mx-auto`

**底部 chrome**
- `shrink-0 px-7 py-3 border-t border-rule-soft font-mono text-[10.5px] text-ink-faint tracking-wide lowercase truncate`
- 内容：`id: <nodeId>`

### 5.2 EditorPanel（内嵌于 FloatingPanel editor tab）

**容器**
- `max-w-[680px] mx-auto flex flex-col gap-12`

**两段：system prompt / user prompt**

每段结构：
```
       — — system prompt — —   (scene-label, mb-6)

       <block 1>                 (hairline well, mb-3)
       <block 2>
       ...
                + 添加段落        (text button, 居中或靠右, mt-3)
```

**block（hairline well）**
- 外框：`bg-paper-deep border border-rule rounded-md`
- 顶条：`px-4 py-2 border-b border-rule-soft flex items-baseline justify-between`
  - 左：`<阿拉伯数字> · <kind>`，`font-mono text-[11px] text-ink-faint tracking-wide lowercase`
  - 右：删除 `×`，`font-display text-[16px] leading-none text-ink-faint hover:text-error cursor-pointer`
- 文本区：`px-4 py-3`
  - `<textarea>` 裸：`block w-full bg-transparent outline-none resize-none border-0`
  - literal：`font-display text-[15px] text-ink leading-[1.65]`
  - agent-inject：`font-display italic text-[14.5px] text-ink-soft leading-[1.65]`，placeholder `向 agent 描述要注入的内容…`
  - 行为不变：`defaultValue` + `onBlur` 提交（与现状一致；编辑期间切 Tab 会 onBlur 提交，behavior 不变）
  - `style={{ fieldSizing: 'content' }}` 自适应高度（参考 memory chat 输入框）
  - 最小高度：literal 80px / agent-inject 60px

**ref block（只读展示）**
- 同 hairline well，kind 显示 `ref → <Roman>`
- 文本区内容（不可编辑）：`font-display italic text-[14.5px] text-ink-soft leading-[1.65]`
- 内容文本：`引自 <Roman> · <上游 label>`
- 删除 `×` 保留可用（删 ref 等价于断连，本期保持现状的行为：从 engine 删 ref block，触发 store 重渲，对应 edge 也消失）

**添加按钮**
- 每段底部一个：`+ 添加段落`，§ 4.4 主操作 clay 风
- 行为：添加 `{ kind: 'literal', content: '' }`（与现状一致）

### 5.3 OutputsPanel（内嵌于 FloatingPanel output tab）

**容器**
- `max-w-[680px] mx-auto`

**结构**
```
       — — output · III · 章节 · 深夜的雨 — —     (scene-label, mb-3)

       completed · 1,247 字 · 复制 ↗             (meta line, mb-8)

       深夜的雨声穿过窗棂…                        (display prose)

       接下来一段…

                       · · ·                       (scene-end, mt-12)
```

- scene-label：§ 4.1，但插入了 Roman 与 label：`output · III · 章节 · 深夜的雨`
- meta line：`flex items-baseline gap-3 font-mono text-[10.5px] text-ink-faint tracking-[0.14em] lowercase`
  - status 文字 + `·` + `<字数> 字` + `·` + 复制按钮
  - 字数复用 `FlowNode.tsx` 中 `estimateWords`（同文件导出或复制粘贴一个本地函数；本期复制粘贴更轻，B+D 期再考虑抽函数）
  - 复制按钮：§ 4.4 主操作风。点击后 300ms 内文字变 `已复制 ✓` 再还原
- 正文：`font-display text-[16px] leading-[1.7] text-ink whitespace-pre-wrap break-words`
- 空态（output null）：`text-center mt-12 font-display italic text-[14.5px] text-ink-soft` —— `— 此节点尚未付印 —`
- 场尾装饰：`text-center mt-12 font-mono text-[12px] text-ink-faint tracking-[0.6em] select-none` —— `·  ·  ·`
- 长文本滚动由外层 FloatingPanel 内容区 overflow 承接

**不再保留**：复制按钮的 lucide Copy 图标；shadcn ScrollArea 包裹（直接用 overflow-y-auto）

### 5.4 /manuscripts 页

**总体布局**
- `pt-16 pb-20 px-6 overflow-y-auto h-full bg-paper`
- 内容容器：`max-w-[720px] mx-auto`

**结构**
```
                — — manuscripts — —              (scene-label, mb-12)

                          在 vscode 中打开 ↗      (右上 absolute / 或 inline flex)

       memory/manuscripts/
       ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
         · chapter-1.md                          (file list, display 15px)
         · chapter-2.md
         · world-setting.md

       手稿目录，存放小说、剧本、世界观等参考材料。  (italic display ink-soft)
       共 3 个文件                                  (mono meta)
```

- scene-label：§ 4.1，文字 `manuscripts`
- 右上 "在 X 中打开 ↗"：复用 memory 页右上同款样式（mono 10.5px ink-faint tracking-[0.14em] lowercase）
- 路径栏：hairline well 顶条样式
- 文件列表：每行
  - `<li className="flex items-baseline gap-3 py-1">`
  - `·` 字符（clay）+ filename（display 15px ink-soft）
  - 本期**不显示字数**（保持现 API 返回 `string[]` 不变）。字数列入 §6 可选增强
- 空态：`<li className="px-4 py-6 text-center font-display italic text-[14px] text-ink-soft">— 尚无手稿，到编辑器中新建 —</li>`
- loading：mono 灰色 italic `— 加载文件列表… —`
- 简介行：`mt-8 font-display italic text-[14.5px] text-ink-soft text-center leading-[1.65]`
- 共 N 个文件：`mt-2 font-mono text-[10.5px] text-ink-faint tracking-[0.14em] lowercase text-center`

**不再保留**：FolderOpen / FileText / ExternalLink lucide 图标；shadcn Spinner（用 italic display 文字代替）；shadcn Card / Button 包裹

### 5.5 SettingsDialog

业务逻辑（编辑器配置增删改、LLM 配置增删改、表单数据流）**完全不动**。本节只描述视觉迁移。

**Dialog 容器**
- 同 § 5.1 FloatingPanel：`bg-paper border-rule shadow-lift rounded-md max-w-[720px] max-h-[80vh] p-0 gap-0`

**顶部 chrome**
- 高 56px：`px-7 py-4 border-b border-rule-soft flex items-center justify-between`
- scene-label `— — settings — —` 居中，关闭 `×` absolute 右上（与 ToolDrawer 一致）

**Tabs 区**
- 紧贴顶部 chrome 下方：`px-7 py-3 border-b border-rule-soft`
- Tabs 用 § 4.6 文字开关：`editor` / `llm`

**内容区**
- `flex-1 overflow-y-auto px-7 py-6`

**Tab: editor**
- 标题段：简单 display heading（display 16px italic）：`默认编辑器`
- 已选编辑器：以 hairline well 显示当前选中（name + command），右上 `更换 ↗` 文字按钮
- 编辑器列表（点击选中）：
  - 容器：无外框，垂直列表
  - 列表项：`px-4 py-3 cursor-pointer rounded-md transition-colors hover:bg-paper-deep`
  - 选中项：`bg-paper-deep` + 左侧 2px clay 竖线（与 memory ConversationItem 一致）
  - 内容：name（display 14.5px ink-soft，选中态 ink）+ command（mono 11px ink-faint）
- 自定义编辑器（custom list）：同上 + 右侧 `编辑` / `删除` 文字按钮
- "添加自定义编辑器" 按钮：底部 `+ 添加自定义编辑器`，§ 4.4 clay 风
- 添加 / 编辑表单（弹出式或内联展开）：暂保留现状结构，仅替换 Input/Label/Button 视觉（见下）

**Tab: llm**
- 同 editor 风格的列表项
- 每个 LLM config 项：
  - 主行：name (display 14.5px) + provider 标签 `〔 anthropic 〕`（文字风，clay 括号；替代 shadcn Badge）+ model 字符串（mono 11px ink-faint）
  - 默认配置标记：`〔 default 〕` 在 name 右侧（clay 括号 + display 13px italic）
  - 右侧操作：`设为默认` / `编辑` / `删除` 文字按钮
- 添加 / 编辑表单：
  - 字段 Label：`font-mono text-[10.5px] text-ink-faint tracking-[0.14em] lowercase mb-1.5`
  - Input（裸）：`block w-full bg-paper-deep border border-rule rounded-md px-3 py-2 font-mono text-[13px] text-ink focus:outline-none focus:border-clay transition-colors`
  - Select（shadcn）：保留 shadcn Select 组件，但 trigger 字号字体 override 为 `font-mono text-[13px]`
  - API Key 字段右侧"显示/隐藏"：文字 `显示` / `隐藏`（替代 lucide Eye/EyeOff）
  - "可选参数"展开/收起：文字 `▸ 高级参数` / `▾ 高级参数`（替代 ChevronDown/ChevronRight）—— 字号 mono 11px ink-faint tracking
- 表单按钮（保存 / 取消）：底部 right-aligned 文字按钮，"保存" clay 风、"取消" ink-soft 风

**Footer**
- 不再有 shadcn DialogFooter（视觉过重）；操作按钮直接放表单底部右侧

### 5.6 Header 调整

- 移除 `<NavLink href="/outputs">outputs</NavLink>` 及其前的 `<Sep />`
- 检查 `<Sep />` 数量保持合理（剩余 nav：memory · manuscripts · `⋯` · 付印）
- 检查移除后视觉间距是否需要 fine-tune（gap 已用 `gap-[14px]`）

### 5.7 Toast (sonner) 顺手

`src/app/layout.tsx` 中 `<Toaster>`（如果存在）增加 prop（sonner 2.0.7，`toastOptions.classNames` 支持 toast/title/description/actionButton/cancelButton/error/success 等键）：

```tsx
<Toaster
  toastOptions={{
    classNames: {
      toast: 'bg-paper border border-rule shadow-paper font-display text-[14px] text-ink',
      title: 'text-ink',
      description: 'text-ink-soft',
      actionButton: 'text-clay',
      cancelButton: 'text-ink-faint',
      error: 'border-error text-error',
      success: 'border-clay text-ink',
    },
  }}
/>
```

如 sonner 类名映射部分键失效（v2 字段被改名），按 `node_modules/sonner/dist/index.d.ts` 当前签名对应调整 —— 不阻塞主交付。

---

## 6 · 后端 / API 改动

- 无（manuscripts 字数显示属可选增强；本期不做）

如果做（可选增强）：
- `src/app/api/manuscripts/route.ts` 改为返回 `[{ name: string, words: number }]`，服务端 `Bun.file().text()` 后按 estimateWords 同口径
- 现有 `MemoryAgent`/`memory-db` 不动

---

## 7 · 测试 / 验收

**手动验收（无自动化）**
1. `bun dev` 启动开发服务器
2. 在 `localhost:3000` 检查：
   - **画布主页**：FlowNode、Header、ContextMenuPanel、ZoomReadout、LayoutButton —— 视觉不变（旁证：本期不动这些文件）
   - **节点弹窗**（点击节点）：
     - Dialog 容器是新 chrome
     - 顶部 Roman + label inline editable + tab 切换 + 关闭
     - editor tab：两段 scene-label + hairline block list + 添加按钮
     - output tab：scene-label + meta + display prose 正文
     - 底部 mono `id: xxxxx`
     - 双击 label 进入编辑、Enter 提交、Esc 还原
   - **/manuscripts**：scene-label、hairline well、文件列表、空/loading/正常三态
   - **设置弹窗**（Header ⋯ → 设置...）：
     - editor tab、llm tab 视觉对齐其余面板
     - 表单字段全替换、API key 显示/隐藏正常、高级参数折叠正常
     - LLM CRUD 全流程仍工作（增、删、改、设为默认）
   - **导航**：`outputs` 链接消失、`memory` 与 `manuscripts` 仍可达
   - 手动访问 `/outputs` 应 404（Next.js 默认）
3. 暗色模式：本期不验证暗色模式正确性，但要确保操作 dark mode 切换时不报 console 错（如果项目已有 dark mode 入口）
4. `bun run typecheck:gui` 通过
5. `bun run typecheck` 通过（不应受影响，但跑一次确认）

**回归点（应未受影响）**
- 节点 CRUD、连线、运行 dag、memory chat（流式、持久化、工具抽屉）—— 视觉迁移不应触及行为

---

## 8 · 风险与已知遗留

- **SettingsDialog 文件大**（约 500-700 行 LLM/编辑器表单），重写工作量约等于其他 4 个面板之和。需要分子任务。
- **Dialog 自带 close 按钮**：shadcn Dialog 默认带一个 `X` 在右上。需要在重画顶部 chrome 时确认是 override（passing custom close）还是接受默认并隐藏。倾向：通过给 DialogContent 加 `[&>button:last-child]:hidden` 或直接在 `DialogContent` 外置一个自定义 close 元素。具体在实现期确定。
- **字数显示**：manuscripts 字数显示属可选；本期可不做。
- **Dark mode**：globals.css 未见 `@theme dark` 变量定义。如果项目已有 dark mode（提交历史里提到过），新视觉令牌可能在 dark mode 下表现不当。本期**不修复 dark mode**，发现问题登记到下期。
- **`<HairlineBlock>` 等原子未抽**：5 个面板中将出现重复 className。下期 B+D 视情况再抽。

---

## 9 · 后续期次概览（非本期范围，仅为对齐）

- **下期 B+D**：FloatingPanel 改成右侧抽屉；节点交互模型修补（双击位置、断线 sync、右键真做子节点、复制节点）；EditorPanel 加 block 拖排 / 类型切换 / ref 内嵌编辑
- **下下期 C+E**：暴露 target_nodes / stale_nodes；run preview；运行可视化（节点级实时进度、流式输出、错误展开）
- 视觉原子组件抽取可能发生在 B+D 期（届时已积累足够重复模式）

---

## 10 · 实现节奏建议（不在本 spec 强制，留给 writing-plans 期细化）

按"安全→危险"或"独立→耦合"排序，大致：

1. 删除：/outputs 目录、ConfigPanel、Header outputs 链接、store pinnedOutputs 字段
2. /manuscripts 重画（独立、无依赖、易验证）
3. OutputsPanel 重画（独立组件、依赖小）
4. EditorPanel 重画
5. FloatingPanel chrome（与 4 联调）
6. SettingsDialog 重画（独立、最长）
7. Toast 顺手
8. typecheck + 手动验收
