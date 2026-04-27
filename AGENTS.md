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
├── engine/           # Core engine (workspace, nodes, LLM)
├── cli/              # CLI 工具
└── apps/
    └── gui/          # Next.js GUI 应用 (进行中)
```

---

## Engine 参考

Engine API 可通过 `@flowcabal/engine` 导入：

```typescript
import { Workspace, TextBlock } from '@flowcabal/engine'
```

详细类型定义见 `packages/engine/src/types.ts`。
