# GUI LLM 配置升级 设计稿

> gui 当前 LLM 配置只暴露 9 个字段、硬编码 `'default'` key、缺 `providerOptions`、缺切换 active 的入口。本期把 `~/.config/flowcabal/llm-configs.json` 升级成 envelope（带 active 指针），SettingsDialog 加 providerOptions JSON textarea 和「设为活跃」按钮，openai-compatible 选中时自动填 DeepSeek V4 预设。**只动 gui + engine 的文件层，不动 cli**，cli 编译会坏，按用户决定不修。

## 目标

- gui 不再把 `'default'` 当 magic key；运行哪个 LLM config 由文件里的 `active` 字段决定
- 暴露 `providerOptions`，让用户能配 DeepSeek thinking / Anthropic thinking budget / OpenAI reasoning_effort 等 provider 专有钩子
- 选 `openai-compatible` 时把表单一键填好 DeepSeek V4-Pro thinking max 预设
- 删 active config 时静默补位，不打断用户

## 本期范围

### 包含

- **envelope schema 升级**：`~/.config/flowcabal/llm-configs.json` 从 `Record<name, LlmConfig>` 改为 `{ active: string, configs: Record<name, LlmConfig> }`，无迁移
- **engine 文件层重命名**：删 `readLlmConfigs / writeLlmConfigs`，新增 `readLlmFile / writeLlmFile / getActiveLlmConfig`
- **API 路由改造**：`GET /api/llm-configs` 多返 `active`；新增 `PATCH /api/llm-configs` 切 active；`POST/DELETE` 处理首条自动设 active、删 active 补位；`run-all` 和 `memory/chat` 改用 `getActiveLlmConfig()`
- **SettingsDialog 列表**：移除 `(default)` tag，给 active 行加 clay 竖线 + 〔 active 〕标记，每条非 active 行加「设为活跃」按钮
- **SettingsDialog 表单**：高级参数折叠区加 providerOptions JSON textarea + 校验；provider 选 `openai-compatible` 时空字段自动填 DeepSeek 预设
- **engine 测试**：`paths.test.ts` 覆盖 `readLlmFile / writeLlmFile / getActiveLlmConfig` 三个新函数

### 不含（推后期）

- cli 兼容修复（编译破，不修）
- Header / RunButton 的全局 active 选择器（用户只在 Settings 里切）
- useStore 加 active 字段（用不上）
- 按节点指定 LLM、连通性测试、token usage 记账、从 env 读 apiKey、模型 datalist（这些是上一轮汇报里的「新增建议」，本期一概不做）
- 自动迁移旧 `Record<name, LlmConfig>` 文件（用户明确无现有用户，硬切）

## 砍掉的旧设计

`'default'` 这个 magic key 之前由 cli 的 `llmSetDefault` 维护（拷贝目标 config 到 key `'default'`），gui 三个消费点（`api/engine/run-all/route.ts:6`、`api/memory/chat/route.ts:23`、SettingsDialog 列表里的 `(default)` tag）都靠这个约定。

问题：
1. **拷贝不是引用**：cli `llmSetDefault('foo')` 后改 `configs.foo` 不会反映到 `configs.default`
2. **gui 无法切换**：gui 没暴露 set-default 入口，用户只能去 cli 切
3. **语义混淆**：`default` 既是 key 名又是「当前活跃」的概念，多一份就多一份失同步风险

本期方案：
- envelope 里加显式 `active: string` 指针
- gui 直接读写 `active`，无需拷贝 config
- `default` 完全不再特殊（如果用户碰巧把某个 config 命名为 `default`，那就只是个普通名字）

## 架构总览

```
packages/engine/src/
  schema.ts            ← 加 LlmFileSchema；删 LlmConfigsFileSchema
  types.ts             ← 加 LlmFile = z.infer<typeof LlmFileSchema>
  paths.ts             ← 删 read/writeLlmConfigs；加 readLlmFile / writeLlmFile / getActiveLlmConfig
  index.ts             ← export 调整

packages/apps/gui/src/
  app/api/llm-configs/route.ts            ← GET 返 envelope；POST 处理首条自动 active；PATCH 切 active
  app/api/llm-configs/[name]/route.ts     ← DELETE 处理删 active 补位
  app/api/engine/run-all/route.ts         ← 改用 getActiveLlmConfig
  app/api/memory/chat/route.ts            ← 改用 getActiveLlmConfig
  components/SettingsDialog.tsx           ← 列表项 + 表单两块改造
```

cli 不动。`packages/cli/src/commands/llm.ts` 和 `commands/run.ts` 会编译失败，本期不修。

## 数据结构

### `LlmFile`（新）

```ts
// engine/src/schema.ts
export const LlmFileSchema = z.object({
  active: z.string(),                                       // 空串表示「无活跃」
  configs: z.record(z.string(), LlmConfigSchema),
})

// engine/src/types.ts
export type LlmFile = z.infer<typeof LlmFileSchema>
```

`LlmConfigSchema` / `LlmProviderSchema` 不动；`LlmConfigsFileSchema` 删除。

### `~/.config/flowcabal/llm-configs.json` 示例

```json
{
  "active": "deepseek",
  "configs": {
    "deepseek": {
      "provider": "openai-compatible",
      "baseURL": "https://api.deepseek.com",
      "apiKey": "sk-xxx",
      "model": "deepseek-v4-pro",
      "maxTokens": 384000,
      "providerOptions": {
        "deepseek": {
          "thinking": { "type": "enabled" },
          "reasoning_effort": "max"
        }
      }
    }
  }
}
```

## engine 文件层

```ts
// engine/src/paths.ts

export function readLlmFile(): LlmFile {
  ensureDir(GLOBAL_CONFIG_DIR)
  if (!existsSync(LLM_CONFIGS_FILE)) return { active: '', configs: {} }
  try {
    const content = readFileSync(LLM_CONFIGS_FILE, 'utf-8')
    return LlmFileSchema.parse(JSON.parse(content))
  } catch {
    // parse 失败视为空 envelope；不抛错让 UI 卡死
    return { active: '', configs: {} }
  }
}

export function writeLlmFile(file: LlmFile): void {
  ensureDir(GLOBAL_CONFIG_DIR)
  const validated = LlmFileSchema.parse(file)
  writeFileSync(LLM_CONFIGS_FILE, JSON.stringify(validated, null, 2), 'utf-8')
}

export function getActiveLlmConfig(): LlmConfig | null {
  const file = readLlmFile()
  if (!file.active) return null
  return file.configs[file.active] ?? null
}
```

**parse 失败静默退化为空** 是为了 UI 永远能开起来；不假设文件一定合法。

## API 路由

### `GET /api/llm-configs`

返 `{ active, configs }`。

### `POST /api/llm-configs`

Body `{ name, config }`。
- 写入 `configs[name] = config`
- **如果当前 active 为空**（首次添加 / 之前删干净了），active 自动设为这个 name

### `DELETE /api/llm-configs/[name]`

- 删 `configs[name]`
- 如果删的就是 active，把 active 设为 `Object.keys(configs).sort()[0] ?? ''`

### `PATCH /api/llm-configs`（新）

Body `{ active: name }`。
- 若 `name` 不在 `configs` 里 → 400 `{ error: 'config not found' }`
- 否则把 envelope 的 `active` 改成 `name`，写盘

放在同一个 `route.ts` 文件里和 GET/POST 并列。**不**新建 `active` 子路径 —— 那会和 `[name]` 动态路由抢路径，让任何叫 `active` 的 config 无法被 DELETE。

### `POST /api/engine/run-all` / `POST /api/memory/chat`

把 `readLlmConfigs()['default']` 改成 `getActiveLlmConfig()`。

```ts
const config = getActiveLlmConfig()
if (!config) {
  return new Response(JSON.stringify({ error: '请先在 settings 选择活跃 LLM' }), {
    status: 400, headers: { 'Content-Type': 'application/json' },
  })
}
```

## SettingsDialog 改造

### 列表（`llmMode === 'list'`）

替换原 `(default)` tag：
- 行整体：`active === name` 时左侧加 clay 竖线（`border-l-2 border-clay`），padding 微调避免视觉跳
- 名字右边：原 `(default)` 替换为 `〔 active 〕`（用现有 `text-clay`「〔」「〕」+ `text-ink-soft` 内容的现有样式）
- 行内按钮顺序：「设为活跃」（仅非 active 行显示）、「编辑」、「删除」
- 「设为活跃」点击 → `fetch('/api/llm-configs', { method: 'PATCH', body: JSON.stringify({ active: name }) })` → 成功后 `fetchLlmConfigs()` 刷新
- 「删除」不二次确认，直接 DELETE → 刷新（active 补位由后端处理）

### 表单（`llmMode === 'add' | 'edit'`）

**provider 切换自动填 DeepSeek**

```ts
const DEEPSEEK_PRESET = {
  baseURL: 'https://api.deepseek.com',
  model: 'deepseek-v4-pro',
  maxTokens: '384000',
  providerOptions: JSON.stringify({
    deepseek: {
      thinking: { type: 'enabled' },
      reasoning_effort: 'max',
    },
  }, null, 2),
}

const onProviderChange = (v: string) => {
  setLlmForm(p => {
    if (v !== 'openai-compatible') return { ...p, provider: v }
    return {
      ...p,
      provider: v,
      baseURL: p.baseURL || DEEPSEEK_PRESET.baseURL,
      model: p.model || DEEPSEEK_PRESET.model,
      maxTokens: p.maxTokens || DEEPSEEK_PRESET.maxTokens,
      providerOptions: p.providerOptions || DEEPSEEK_PRESET.providerOptions,
    }
  })
}
```

**已填字段不覆盖**（避免误伤已有配置）。

**providerOptions textarea**

放在「高级参数」折叠区底部，独占两列：

```tsx
<div className="col-span-2">
  <FieldLabel muted>provider options (JSON)</FieldLabel>
  <textarea
    rows={5}
    value={llmForm.providerOptions}
    onChange={e => setLlmForm(p => ({ ...p, providerOptions: e.target.value }))}
    onBlur={validateProviderOptions}
    placeholder='{"deepseek":{"thinking":{"type":"enabled"}}}'
    className={`${inputCls} resize-y leading-relaxed`}
  />
  {providerOptionsError && (
    <p className="mt-1.5 font-mono text-[10.5px] text-error">{providerOptionsError}</p>
  )}
</div>
```

`validateProviderOptions` 在失焦时跑 `JSON.parse`，失败时设 `providerOptionsError`。`formValid` 计算式由 `name.trim() && apiKey.trim() && model.trim()` 改为 `... && !providerOptionsError`（textarea 为空不算错）。

**前端只校验 JSON 合法性，不校验结构**（不要求是 `Record<string, Record<string, JsonValue>>`）。结构校验交给后端 zod —— `writeLlmFile` 跑 `LlmFileSchema.parse` 会拒非法 providerOptions 抛 500，前端用现有 fetch catch + sonner toast 兜底显示。这样把校验入口收敛在 schema 一处。

`LlmFormData` 新增字段，`EMPTY_FORM` 同步加 `providerOptions: ''`：

```ts
interface LlmFormData {
  // ... 原有字段
  providerOptions: string  // 空串 = 不带；非空必须是合法 JSON object
}
```

`formToConfig`：

```ts
if (data.providerOptions.trim()) {
  try {
    config.providerOptions = JSON.parse(data.providerOptions)
  } catch {
    // 校验已在 onBlur 拦住，这里理论上不会到
  }
}
```

`startEdit` 读取现有 config：

```ts
providerOptions: cfg.providerOptions
  ? JSON.stringify(cfg.providerOptions, null, 2)
  : '',
```

`showAdvanced` 触发条件增加 `!!cfg.providerOptions`（编辑现有有 providerOptions 的 config 时高级区默认展开）。

## 错误与边界

| 场景 | 行为 |
|---|---|
| envelope 文件不存在 / parse 失败 | `readLlmFile` 返空 envelope，UI 显示「暂无 LLM 配置」 |
| 添加首条 config | 后端自动把 active 设为这条 |
| 删 active，configs 还有剩 | 后端按 `Object.keys(configs).sort()[0]` 补位 |
| 删完最后一个 | active = '' |
| 跑 DAG 时 active = '' 或 configs[active] 缺 | API 返 400「请先在 settings 选择活跃 LLM」；前端 toast |
| providerOptions textarea 非合法 JSON | 红字 inline 错误，「保存」按钮 disabled |
| openai-compatible 已有字段切回再切来 | 自动填只填空字段，不覆盖 |
| 改 active config 的字段 | 直接生效，下次跑就用新值（不需要重新「设为活跃」） |

## 测试

### engine（自动）

`packages/engine/src/paths.test.ts`（新建或扩展）覆盖：

1. `readLlmFile()` 文件不存在 → `{ active: '', configs: {} }`
2. `readLlmFile()` 文件存在但 JSON 损坏 → `{ active: '', configs: {} }`
3. `readLlmFile()` 文件合法 → 正确 parse
4. `writeLlmFile()` envelope 缺 `active` 字段 → 抛 zod 错
5. `writeLlmFile()` envelope 合法 → 写入磁盘后再 read 得到同样 envelope
6. `getActiveLlmConfig()` envelope 为空 → null
7. `getActiveLlmConfig()` active 字段指向不存在的 key → null
8. `getActiveLlmConfig()` 命中 → 返对应 config

测试用临时目录隔离全局 `LLM_CONFIGS_FILE` 路径，避免污染开发者真实配置。

### gui（人工）

按下顺序走一遍：

1. 删除 `~/.config/flowcabal/llm-configs.json`，刷新 settings → LLM tab 显「暂无 LLM 配置」
2. 加一条 name=`ds`、provider=`openai-compatible`：选 provider 后字段自动填 deepseek 预设，输入 apiKey 后保存 → 列表里 `ds` 有 〔 active 〕 + 左侧 clay 竖线
3. 加第二条 name=`oa`、provider=`openai`、apiKey 任意、model=`gpt-4o`，保存 → 列表里 `ds` 仍是 active；`oa` 行有「设为活跃」按钮
4. 点 `oa` 的「设为活跃」→ 立即变 active；`ds` 行的「设为活跃」按钮出现
5. 删 `ds`（非 active）→ 静默；`oa` 仍 active
6. 删 `oa`（active）→ 列表空，「暂无 LLM 配置」
7. 重建 `ds`，去画布按运行按钮 → 走 `ds`（DeepSeek V4-Pro thinking max）
8. 删光所有 config 后按运行 → toast「请先在 settings 选择活跃 LLM」
9. 编辑 `ds`，把 providerOptions textarea 改成 `{not json`，离开焦点 → 红字提示，保存按钮灰
10. providerOptions 改成 `{"deepseek":{"reasoning_effort":"high"}}` 保存 → 重新打开编辑器，high 模式被正确回显

## 实施顺序

1. engine schema / types / paths（含测试）
2. API 路由 4 处（先 GET/POST/PATCH 合并改 + DELETE，再 run-all / memory chat）
3. SettingsDialog 列表（active 标记 + 设为活跃按钮）
4. SettingsDialog 表单（providerOptions textarea + deepseek 预设钩子）
5. 端到端人工走一遍上面 10 步
