#set document(
  title: "FlowCabal 前端美学重构计划",
  author: "FlowCabal Design Team",
)

#set page(margin: (left: 2cm, right: 2cm, top: 2.5cm, bottom: 2.5cm))

#set heading(numbering: "1.1")

= 美学愿景

= 产品定位与审美方向

== 产品语境

FlowCabal 是一个"AI 文本处理的 ComfyUI"——一个可视化的 AI 工作流编辑器。用户通过节点式界面构建复杂的文本处理流程，调用 LLM API，实时看到数据流动。

== 目标用户

+ 技术创作者：AI 研究者、开发者、提示词工程师
+ 内容创作者：需要批量处理文本的编辑、作家
+ 工作流自动化者：喜欢可视化编程、节点式 IDE 的用户

== 审美方向选择

*核心理念：* **"赛博有机主义"（Cyber-Organicism）**

结合对立的美学力量：
- **赛博朋克科技感**：数据流、节点连接、电路板般的网格
- **有机流动**：液体般的运动、柔和曲线、自然呼吸感

这种选择不是"通用 AI 美学"，而是为 FlowCabal 特定的"文本数据流动"语境量身定制。

*为什么令人难忘：*

1. 网格背景的动态粒子效果——像活着的细胞在数据流中游动
2. 节点执行时的"能量脉冲"传播——从激活点向下游节点传递光波
3. 不对称的侧边栏——可折叠的玻璃态面板，带有微妙的光泽反射
4. 连线动画——数据流动时有"数据包"在连线中穿梭，而非静态线段

---

= 当前美学问题诊断

== 审美缺失分析

=== 缺乏明确的视觉身份

当前设计是"技术功能性的"，但"美学沉默"的。用户记不住任何独特特征。

*当前问题：*
+ 深蓝色背景（`#0f0f1a`）是通用的"技术产品色"
+ 紫色渐变按钮（`linear-gradient(135deg, #6366f1, #8b5cf6)`）被过度使用
+ 没有独特的视觉节奏或图案

=== 通用化问题

*违反 skill 原则：*
+ 计划推荐 Lucide/Heroicons/Phosphor——这些都是"通用 AI 选择的图标库"
+ Emoji 图标虽然有问题，但替换为 Lucide 可能只是"一种通用替换另一种通用"
+ 没有为 FlowCabal 设计专属图标系统

=== 字体缺失

*违反 skill 原则：*
+ 没有定义任何字体系统（暗示可能使用默认的系统字体）
+ skill 明确要求："避免通用字体如 Arial 和 Inter；选择独特的、有性格的字体"
+ 缺少独特的显示字体 + 精致的正文字体搭配

=== 颜色系统的问题

*当前问题：*
+ 颜色分布均匀、胆小：`#0f0f1a` 背景 + `#1a1a2e` 次级背景 + `#2d2d44` 边框
+ 缺少"主导色配合强烈点缀色"的美学策略
+ 暗色主题默认，但亮色主题没有设计

*skill 原则：*"主导色配合强烈的点缀色胜过胆小、均匀分布的调色板"

=== 空间构图的保守性

*当前问题：*
+ 布局是对称的、可预测的
+ 左侧 260px 侧边栏 + 右侧画布——标准的 IDE 模式
+ 没有不对称性、重叠、对角线流动

*skill 原则：*"意想不到的布局、不对称、重叠、对角线流动、破坏网格的元素"

=== 动画的缺失

*当前问题：*
+ 只有基础的 hover 过渡（`transition: all 0.2s`）
+ 节点运行状态只有简单的颜色变化
+ 没有高影响力的动画时刻

*skill 原则：*"一个精心编排的页面加载，带有交错揭示，比分散的微交互更能带来愉悦"

=== 背景的平淡

*当前问题：*
+ 纯色背景 `#0f0f1a`
+ FlowEditor 有网格背景，但只是 `Background variant={BackgroundVariant.Lines}`
+ 没有深度、氛围、纹理

*skill 原则：*"创造氛围和深度而不是默认使用纯色。添加上下文效果和纹理...渐变网格、噪声纹理、几何图案、层次透明度、戏剧性阴影、装饰性边框"

---

= 重构的美学维度

= 阶段 0：美学战略（在代码重构之前）

在开始任何技术重构前，必须先定义美学愿景。

== 审美决策

=== 字体系统

*显示字体：* **"Space Grotesk 3"**（或类似风格）
- 为什么要独特：带有轻微未来感的无衬线体，字母间距独特，有"科技但友好"的性格
- 不是 Inter/Roboto——选择有记忆点的字体

*正文字体：* **"Crimson Pro"**（衬线体）或 **"IBM Plex Sans"**
- 衬线体带来"文本编辑器"的文学感
- 对比显示字体的科技感，创造层次

*代码/技术文本：* **"JetBrains Mono"**（等宽字体）
- 用于节点内显示的参数、API 端点等技术内容

*组合策略：*
- 大标题（页面标题、重要节点）：显示字体
- 正文（聊天消息、表单标签）：正文字体
- 技术文本（模型名称、参数值）：代码字体

=== 颜色系统：赛博有机调色板

*主色调（主导色）：* **"深空蓝"（Deep Space）**
- 背景主色：`#0A0E1C`（比当前 `#0f0f1a` 更深邃、更神秘）

*点缀色（强烈的记忆点）：*

1. **"神经脉冲"（Neural Pulse）**：`#00FFD5`（青绿色）
   - 用于：激活的节点、连线中的数据包、成功状态
   - 为什么：在深蓝背景上创造强烈对比，像生物发光

2. **"错误之红"（Error Red）**：`#FF2A6D`（霓虹粉红）
   - 用于：错误状态、警告、重要提示
   - 为什么：不是普通的红色，而是赛博朋克的霓虹感

3. **"思考之紫"（Thinking Purple）**：`#C074FF`（淡紫色）
   - 用于：正在处理的节点、加载状态
   - 为什么：表示 AI "思考"的状态

*层次系统：*
- 背景深色：`#0A0E1C`
- 次级背景：`#111827`（比背景稍亮）
- 表面：`#1F2937`
- 边框：`#374151`
- 文本主色：`#F9FAFB`
- 文本次色：`#9CA3AF`

*gradient meshes 背景：*
- 不是纯色，而是微妙的渐变网格
- 从 `#0A0E1C` 到 `#111827` 的对角渐变
- 叠加细的网格线，带有微弱的发光

=== 图标系统：专属设计

*问题：* Lucide/Heroicons 太通用

*解决方案：* 为 FlowCabal 设计专属图标系统

*设计原则：*
- 线条粗细：2px（比普通图标稍粗，更有存在感）
- 圆角：4px（柔和但锐利）
- 动态：支持"状态动画"（如机器人图标在"思考"时会眨眼）

*图标列表：*
1. Layout 图标：不是通用的网格图标，而是"可折叠的面板"隐喻
2. Play 图标：三角形播放符号 + 周围有"能量光环"
3. Zoom 图标：放大镜内有"数据粒子"效果
4. Theme 图标：太阳/月亮不是扁平的，而是有"光晕"效果

*实现：*
- 使用 SVG，自定义绘制
- 考虑为关键图标（如 LLM 机器人）设计独特形象

=== 空间构图：不对称与密度

*重新设计侧边栏：*

当前：左侧固定 260px 侧边栏

新设计：
- 左侧"浮动"侧边栏，默认宽度 240px
- 可拖拽调整宽度（180px - 360px）
- **不对称细节**：侧边栏右下角有"斜切"设计
- 折叠时，变成右侧浮动的"胶囊"按钮，带有半透明玻璃态

*主画布：*
- 不是纯矩形区域
- 右上角有"信息胶囊"，显示执行统计
- 左上角有"快速动作"按钮组，以对角线排列

*节点设计：*
- 当前：矩形圆角 8px
- 新设计：
  - 输入/输出节点：轻微的有机形状（不是完全矩形）
  - LLM 节点：带有"数据脉冲"的动态边框
  - 节点之间可以有轻微重叠（视觉深度）

=== 动画策略：高影响力时刻

*关键动画：*

1. **页面加载：交错揭示**
   - 导航栏从上滑入（300ms）
   - 侧边栏从左滑入（400ms，延迟 100ms）
   - 画布网格淡入（600ms，延迟 200ms）
   - 节点逐个弹出（每个 100ms，总共 1s）

2. **节点执行：能量脉冲**
   - 当节点开始执行：边框发光，颜色渐变为"思考之紫"
   - 完成时：边框闪烁一次"神经脉冲"色
   - 脉冲向下游节点传播（连线动画）

3. **连线数据流：数据包动画**
   - 不是静态线段
   - 执行时，有"数据粒子"从源头流向目标
   - 粒子是发光的"神经脉冲"色小圆点

4. **节点拖拽：物理感**
   - 拖拽时，节点轻微倾斜（5度）
   - 释放时，有"弹跳"效果
   - 连线有弹性

5. **侧边栏折叠：平滑变形**
   - 不是简单的 width transition
   - 内容淡出的同时，胶囊按钮弹出
   - 使用 `transform` 和 `opacity` 组合

*性能：*
- 使用 CSS 动画（优先）
- 复杂动画用 Svelte 5 的 `$effect` + `requestAnimationFrame`
- 避免在动画中使用 `width/height` 动画（用 `transform: scale` 代替）

=== 背景与纹理：创造氛围

*画布背景：*
- 不是纯 `#0A0E1C`
- 对角渐变网格：
  - 微妙的渐变：从 `#0A0E1C` 到 `#111827`
  - 网格线：`rgba(0, 255, 213, 0.03)`（超低透明度的"神经脉冲"色）
  - 网格间距：30px

*动态粒子效果：*
- 背景中有"数据粒子"缓慢漂动
- 粒子是极小的发光点，颜色随机："神经脉冲"或"思考之紫"
- 运动轨迹：缓慢的布朗运动
- 对性能的影响：使用 Canvas，最多 50 个粒子

*侧边栏玻璃态：*
- 背景色：`rgba(17, 24, 39, 0.85)`
- 模糊效果：`backdrop-filter: blur(12px)`
- 边框：`1px solid rgba(0, 255, 213, 0.1)`
- 当鼠标悬停在侧边栏时，边框微微发光

*节点阴影：*
- 不是普通的 `box-shadow: 0 2px 8px rgba(0,0,0,0.08)`
- 新设计：`box-shadow: 0 8px 32px rgba(0, 255, 213, 0.15)`
- 当节点激活时：阴影发光，颜色为"神经脉冲"

---

= 技术重构：支持美学愿景

阶段 1-8 的技术重构仍然必要，但必须服务于美学目标。

== 阶段 1 修改：设计系统（美学优先）

=== CSS 变量系统（包含美学决策）

*位置：* `src/lib/styles/theme.css`

```css
:root {
  /* 字体系统 */
  --font-display: 'Space Grotesk 3', system-ui, sans-serif;
  --font-body: 'Crimson Pro', Georgia, serif;
  --font-code: 'JetBrains Mono', 'Fira Code', monospace;

  /* 赛博有机调色板 */
  --bg-deep: #0A0E1C;
  --bg-secondary: #111827;
  --bg-surface: #1F2937;

  --accent-neural: #00FFD5;       /* 神经脉冲 */
  --accent-error: #FF2A6D;        /* 错误之红 */
  --accent-thinking: #C074FF;     /* 思考之紫 */

  --border: rgba(192, 116, 255, 0.2);

  /* 阴影系统 */
  --shadow-node: 0 8px 32px rgba(0, 255, 213, 0.15);
  --shadow-neon: 0 0 20px rgba(0, 255, 213, 0.3);

  /* 动画时长 */
  --duration-fast: 150ms;
  --duration-medium: 300ms;
  --duration-slow: 600ms;

  /* 缓动函数 */
  --ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);
  --ease-smooth: cubic-bezier(0.4, 0, 0.2, 1);
}

[data-theme="light"] {
  --bg-deep: #F0F4F8;
  --bg-secondary: #FFFFFF;
  --bg-surface: #E8EEF5;

  /* 亮色主题的点缀色需要调整以保持对比 */
  --accent-neural: #00B894;
  --accent-error: #E63946;
  --accent-thinking: #6C5CE7;
}
```

=== 字体导入

*位置：* `flow-write/index.html`

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@400;500;600&family=JetBrains+Mono:wght@400;500&family=Space+Grotesk+3:wght@500;600;700&display=swap" rel="stylesheet">
```

=== Tailwind 配置（匹配美学）

*位置：* `flow-write/tailwind.config.js`

```javascript
export default {
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        body: ['var(--font-body)', 'Georgia', 'serif'],
        code: ['var(--font-code)', 'monospace'],
      },
      colors: {
        neural: 'var(--accent-neural)',
        error: 'var(--accent-error)',
        thinking: 'var(--accent-thinking)',
        bg: {
          deep: 'var(--bg-deep)',
          secondary: 'var(--bg-secondary)',
          surface: 'var(--bg-surface)',
        },
      },
      boxShadow: {
        'neural': 'var(--shadow-node)',
        'neon': 'var(--shadow-neon)',
      },
      animation: {
        'pulse-neural': 'pulseNeural 2s infinite',
        'float': 'float 3s ease-in-out infinite',
      },
      keyframes: {
        pulseNeural: {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.6 },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
    },
  },
}
```

== 阶段 3 修改：组件美学

=== BaseNode.svelte（有机形状与发光）

*关键改进：*
- 使用有机形状（不是完全矩形）
- 添加"能量脉冲"边框动画
- 当节点运行时，应用 `thinking` 状态的动画

*CSS 示例：*
```css
.custom-node {
  background: var(--bg-surface);
  border: 2px solid transparent;
  border-image: linear-gradient(135deg,
    rgba(192, 116, 255, 0.3),
    rgba(192, 116, 255, 0.1)
  ) 1;
  box-shadow: var(--shadow-node);
  border-radius: 12px;
  transition: all var(--duration-medium) var(--ease-bounce);
}

.custom-node.status-running {
  animation: pulseNeural 2s infinite;
  border-image: linear-gradient(135deg,
    var(--accent-thinking),
    rgba(192, 116, 255, 0.3)
  ) 1;
  box-shadow: var(--shadow-neon);
}

.custom-node.status-completed {
  border-image: linear-gradient(135deg,
    var(--accent-neural),
    rgba(0, 255, 213, 0.3)
  ) 1;
}
```

=== FlowCanvas.svelte（粒子背景）

*新增功能：*
- 使用 Canvas 在背景渲染粒子效果
- 粒子系统类：`ParticleBackground.ts`

```typescript
// src/lib/utils/ParticleBackground.ts
export class ParticleBackground {
  private canvas: HTMLCanvasElement;
  private particles: Particle[] = [];
  private ctx: CanvasRenderingContext2D;
  private animationFrame: number;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.resize();
    this.initParticles();
    window.addEventListener('resize', () => this.resize());
    this.animate();
  }

  private resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  private initParticles() {
    for (let i = 0; i < 50; i++) {
      this.particles.push(new Particle());
    }
  }

  private animate() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.particles.forEach(p => {
      p.update();
      p.draw(this.ctx);
    });
    this.animationFrame = requestAnimationFrame(() => this.animate());
  }

  destroy() {
    cancelAnimationFrame(this.animationFrame);
    window.removeEventListener('resize', () => this.resize());
  }
}

class Particle {
  x = Math.random() * window.innerWidth;
  y = Math.random() * window.innerHeight;
  vx = (Math.random() - 0.5) * 0.5;
  vy = (Math.random() - 0.5) * 0.5;
  size = Math.random() * 2 + 1;
  color = Math.random() > 0.5
    ? 'rgba(0, 255, 213, 0.6)'
    : 'rgba(192, 116, 255, 0.6)';

  update() {
    this.x += this.vx;
    this.y += this.vy;

    // 边界反弹
    if (this.x < 0 || this.x > window.innerWidth) this.vx *= -1;
    if (this.y < 0 || this.y > window.innerHeight) this.vy *= -1;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
  }
}
```

=== LabeledEdge.svelte（数据包动画）

*新增功能：*
- 连线中有"数据包"粒子流动
- 只在工作流执行时激活

*CSS：*
```css
.edge-path {
  stroke: rgba(192, 116, 255, 0.3);
  stroke-width: 2;
  transition: stroke var(--duration-medium);
}

.edge-path.data-flowing {
  stroke: rgba(0, 255, 213, 0.6);
  animation: flowPulse 1s infinite;
}

.data-packet {
  position: absolute;
  width: 8px;
  height: 8px;
  background: var(--accent-neural);
  border-radius: 50%;
  box-shadow: 0 0 10px var(--accent-neural);
  animation: travel 2s linear infinite;
}

@keyframes flowPulse {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 0.8; }
}

@keyframes travel {
  0% { offset-distance: 0%; }
  100% { offset-distance: 100%; }
}
```

=== NodeSidebar.svelte（玻璃态与斜切设计）

*CSS：*
```css
.node-sidebar {
  background: rgba(17, 24, 39, 0.85);
  backdrop-filter: blur(12px);
  border-right: 1px solid rgba(0, 255, 213, 0.1);
  position: relative;
}

/* 斜切设计 */
.node-sidebar::after {
  content: '';
  position: absolute;
  bottom: 0;
  right: 0;
  width: 30px;
  height: 30px;
  background: linear-gradient(135deg,
    transparent 50%,
    rgba(0, 255, 213, 0.1) 50%
  );
}

.node-sidebar:hover {
  border-right-color: rgba(0, 255, 213, 0.3);
  box-shadow: inset 0 0 20px rgba(0, 255, 213, 0.05);
}
```

=== 专属图标系统

*创建自定义图标：*

不使用 Lucide，而是为 FlowCabal 设计专属图标。

*示例：LLM 机器人图标*

位置：`src/lib/components/icons/LLMBotIcon.svelte`

```svelte
<svg width="24" height="24" viewBox="0 0 24 24" fill="none">
  <!-- 独特的机器人头部设计 -->
  <path d="M6 8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8z"
        stroke="currentColor" stroke-width="2" />
  <!-- 眼睛（支持动画） -->
  <circle cx="9" cy="12" r="1.5" class:thinking={isThinking}
          style="transition: all 0.3s;" />
  <circle cx="15" cy="12" r="1.5" class:thinking={isThinking}
          style="transition: all 0.3s;" />
  <!-- 天线（有光环效果） -->
  <path d="M12 6V4M12 4a1 1 0 1 1 0-2" stroke="currentColor" stroke-width="1.5" />
  <!-- 嘴巴（动态） -->
  <path d="M9 16h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"
        class:smile={isCompleted}
        style="transition: d 0.3s;" />
</svg>

<style>
  .thinking {
    animation: blink 2s infinite;
    fill: var(--accent-thinking);
  }

  @keyframes blink {
    0%, 90%, 100% { transform: scaleY(1); }
    95% { transform: scaleY(0.1); }
  }

  .smile {
    d: path('M9 16q3 2 6 0'); /* 微笑曲线 */
  }
</style>
```

== 阶段 5 修改：UX 增强（美学体验）

=== 加载状态（有机动画）

*不是通用的旋转圆圈：*

```svelte
<!-- src/lib/components/LoadingSpinner.svelte -->
<div class="loading-container">
  <div class="pulse-ring"></div>
  <div class="pulse-ring delay-1"></div>
  <div class="pulse-ring delay-2"></div>
</div>

<style>
  .loading-container {
    position: relative;
    width: 60px;
    height: 60px;
  }

  .pulse-ring {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    border: 2px solid var(--accent-neural);
    opacity: 0;
    animation: pulse 1.5s ease-out infinite;
  }

  .pulse-ring.delay-1 {
    animation-delay: 0.5s;
  }

  .pulse-ring.delay-2 {
    animation-delay: 1s;
  }

  @keyframes pulse {
    0% {
      transform: scale(0.8);
      opacity: 0.8;
    }
    100% {
      transform: scale(1.5);
      opacity: 0;
    }
  }
</style>
```

=== Toast 通知（玻璃态卡片）

```svelte
<div class="toast toast-{variant}">
  <span class="toast-icon">{icon}</span>
  <span class="toast-message">{message}</span>
</div>

<style>
  .toast {
    background: rgba(31, 41, 55, 0.95);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(0, 255, 213, 0.2);
    border-radius: 12px;
    padding: 12px 20px;
    box-shadow: 0 8px 32px rgba(0, 255, 213, 0.15);
    animation: slideIn 0.3s var(--ease-bounce);
  }

  .toast.success {
    border-color: rgba(0, 255, 213, 0.4);
  }

  .toast.error {
    border-color: rgba(255, 42, 109, 0.4);
  }

  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
</style>
```

---

= 美学成功指标

+ 用户能在 3 秒内识别出"这是 FlowCabal"（不是其他工具）
+ 独特的"神经脉冲"色和"数据流"动画令人难忘
+ 字体系统（Space Grotesk + Crimson Pro）创造视觉层次
- 不使用 Inter/Roboto/Lucide
+ 粒子背景营造"活着的"数据流氛围
+ 节点执行动画提供"能量流动"的愉悦感
+ 亮色/暗色主题都有独特美学，不是简单反转

---

= 技术美学检查清单

在完成每个阶段后，检查：

- [ ] 颜色是否使用了"主导色 + 强点缀色"策略？
- [ ] 是否有至少一个"令人难忘的"动画时刻？
- [ ] 字体是否独特，不是 Inter/Roboto/Arial？
- [ ] 背景是否有深度/纹理，不是纯色？
- [ ] 是否有至少一个"不对称"或"打破网格"的设计元素？
- [ ] 图标是否是为 FlowCabal 专属设计的？
- [ ] 动画是否使用了 `transform` 和 `opacity`（而非 width/height）？
- [ ] 是否测试了颜色对比度（WCAG AA）？

---

= 资源与灵感

*字体选择：*
- Google Fonts: Space Grotesk, Crimson Pro, JetBrains Mono
- 替代方案: Syne, Playfair Display, JetBrains Mono NL

*美学参考：*
- Linear.app 的"线性"美学（玻璃态 + 细线条）
- Figma 的"专业但不呆板"
- ComfyUI 的"节点式"美学
- Cyberpunk 2077 的"霓虹 + 深色"

*动画参考：*
- Apple 的"流畅"过渡
- Notion 的"交错揭示"
- Linear 的"有机"滚动

---

最后更新：2025-01-21（基于 frontend-design skill 审查）
