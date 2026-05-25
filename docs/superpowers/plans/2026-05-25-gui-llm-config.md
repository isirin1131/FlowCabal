# GUI LLM 配置升级 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `~/.config/flowcabal/llm-configs.json` 从 `Record<name, LlmConfig>` 升级为 `{ active, configs }` envelope；GUI 暴露 `providerOptions` JSON textarea；provider 选 `openai-compatible` 时自动填 DeepSeek V4-Pro thinking max 预设；SettingsDialog 内加「设为活跃」按钮，砍掉 `'default'` magic key。

**Architecture:** Engine 文件层重命名为 `readLlmFile / writeLlmFile / getActiveLlmConfig`（三者都接受可选 `filePath` 参数便于测试隔离）。GUI 三个 API 路由（GET/POST/DELETE + 新增 PATCH）操作 envelope。SettingsDialog 改列表项与表单。CLI 编译会 fail —— 改根 `package.json` 的 `typecheck` 脚本去掉 cli 部分，cli 文件本身不动。

**Tech Stack:** Bun + TypeScript (`bun:test` 内置 test runner), Zod 3.x (schema 校验), Next 16 Turbopack + React 19 (GUI), sonner (toast)。

参考 spec：`docs/superpowers/specs/2026-05-25-gui-llm-config-design.md`。

---

## File Structure

**修改文件**：

| 文件 | 改动概述 |
|---|---|
| `packages/engine/src/schema.ts` | 加 `LlmFileSchema`；删 `LlmConfigsFileSchema` |
| `packages/engine/src/types.ts` | 加 `LlmFile = z.infer<typeof LlmFileSchema>` |
| `packages/engine/src/paths.ts` | 删 `readLlmConfigs / writeLlmConfigs`；加 `readLlmFile / writeLlmFile / getActiveLlmConfig`，三者都接受可选 `filePath` 参数 |
| `packages/apps/gui/src/app/api/llm-configs/route.ts` | GET 返 envelope；POST 处理首条自动 active；新增 PATCH 切 active |
| `packages/apps/gui/src/app/api/llm-configs/[name]/route.ts` | DELETE 处理删 active 补位 |
| `packages/apps/gui/src/app/api/engine/run-all/route.ts` | 改用 `getActiveLlmConfig()` |
| `packages/apps/gui/src/app/api/memory/chat/route.ts` | 改用 `getActiveLlmConfig()` |
| `packages/apps/gui/src/components/SettingsDialog.tsx` | 列表项加 active 标记 + 设为活跃按钮；表单加 providerOptions textarea 与 DeepSeek 预设钩子 |
| `package.json`（根） | `typecheck` 脚本去掉 cli 部分（cli 编译已知会 fail） |

**新建文件**：

| 文件 | 责任 |
|---|---|
| `packages/engine/src/paths.test.ts` | `readLlmFile / writeLlmFile / getActiveLlmConfig` 单测 |

**不动**：

- `packages/engine/src/llm/generate.ts`、`provider.ts`（LlmConfig 本身没动）
- `packages/cli/`（任何文件都不动，编译失败由 typecheck 脚本去掉 cli 部分规避）
- `packages/apps/gui/src/components/Header.tsx`、`RunButton.tsx`、`store/useStore.ts`（YAGNI）
- `packages/apps/gui/src/app/api/memory/chat/route.ts` 的 stream 处理（只换 config 来源）

---

## CLI 状态说明

删 `readLlmConfigs / writeLlmConfigs` 后，cli 的 `commands/llm.ts:1`、`commands/run.ts:1` 编译失败。本期处理：

- 不动 cli 任何文件
- 改根 `package.json` 的 `typecheck` 脚本去掉 cli 部分（具体见 Task 1 Step 8）
- cli 后续是恢复还是删除，留到下一期单独决定

---

## Task 1: Engine schema / types / paths 升级（含 TDD 测试）

**Files:**
- Modify: `packages/engine/src/schema.ts:69`
- Modify: `packages/engine/src/types.ts`（末尾）
- Modify: `packages/engine/src/paths.ts:81-95`
- Create: `packages/engine/src/paths.test.ts`

- [ ] **Step 1: 写失败的 paths.test.ts（测三个新函数）**

新建 `packages/engine/src/paths.test.ts`：

```typescript
import { test, expect, describe, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { readLlmFile, writeLlmFile, getActiveLlmConfig } from './paths';
import type { LlmConfig, LlmFile } from './types';

describe('paths/llm-file', () => {
  let dir: string;
  let file: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'fc-paths-'));
    file = join(dir, 'llm-configs.json');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  const sampleConfig: LlmConfig = {
    provider: 'openai',
    apiKey: 'sk-test',
    model: 'gpt-4o',
  };

  test('readLlmFile: 文件不存在返回空 envelope', () => {
    expect(readLlmFile(file)).toEqual({ active: '', configs: {} });
  });

  test('readLlmFile: 文件 JSON 损坏返回空 envelope', () => {
    writeFileSync(file, '{not json', 'utf-8');
    expect(readLlmFile(file)).toEqual({ active: '', configs: {} });
  });

  test('readLlmFile: 合法 envelope 正确 parse', () => {
    const env: LlmFile = { active: 'foo', configs: { foo: sampleConfig } };
    writeFileSync(file, JSON.stringify(env), 'utf-8');
    expect(readLlmFile(file)).toEqual(env);
  });

  test('writeLlmFile: 缺 active 字段抛 zod 错', () => {
    expect(() =>
      writeLlmFile({ configs: {} } as any, file)
    ).toThrow();
  });

  test('writeLlmFile: 写完再读得到同样 envelope', () => {
    const env: LlmFile = { active: 'foo', configs: { foo: sampleConfig } };
    writeLlmFile(env, file);
    expect(readLlmFile(file)).toEqual(env);
  });

  test('getActiveLlmConfig: 空 envelope 返 null', () => {
    expect(getActiveLlmConfig(file)).toBeNull();
  });

  test('getActiveLlmConfig: active 指向不存在的 key 返 null', () => {
    writeLlmFile({ active: 'ghost', configs: { foo: sampleConfig } }, file);
    expect(getActiveLlmConfig(file)).toBeNull();
  });

  test('getActiveLlmConfig: 命中返对应 config', () => {
    writeLlmFile({ active: 'foo', configs: { foo: sampleConfig } }, file);
    expect(getActiveLlmConfig(file)).toEqual(sampleConfig);
  });
});
```

- [ ] **Step 2: 跑测试，确认 fail**

Run: `cd packages/engine && bun test src/paths.test.ts`
Expected: 所有 test fail，因 `readLlmFile / writeLlmFile / getActiveLlmConfig` 还不存在（import error）以及 `LlmFile` 类型不存在。

- [ ] **Step 3: schema.ts 加 LlmFileSchema**

打开 `packages/engine/src/schema.ts`，删除最后一行 `LlmConfigsFileSchema`，加入：

```typescript
export const LlmFileSchema = z.object({
  active: z.string(),
  configs: z.record(z.string(), LlmConfigSchema),
});
```

`schema.ts` 末尾应为：

```typescript
export const LlmFileSchema = z.object({
  active: z.string(),
  configs: z.record(z.string(), LlmConfigSchema),
});
```

- [ ] **Step 4: types.ts 加 LlmFile 类型**

打开 `packages/engine/src/types.ts`，末尾加：

```typescript
export interface LlmFile {
  active: string;
  configs: Record<string, LlmConfig>;
}
```

（不用 `z.infer<...>` 是为了和文件里其它 type 保持 interface 风格一致。）

- [ ] **Step 5: paths.ts 替换 read/writeLlmConfigs 为新三函数**

打开 `packages/engine/src/paths.ts`。

- 改 line 4 的 import：

```typescript
import { LlmConfig, LlmFile, Workflow, Workspace } from "./types.js";
```

- 改 line 5 的 import：

```typescript
import { LlmFileSchema, WorkflowSchema, WorkspaceSchema } from "./schema.js";
```

- 替换 line 80-95 的旧 `readLlmConfigs / writeLlmConfigs` 整段为：

```typescript
// 全局 LLM 文件读写
export function readLlmFile(filePath: string = LLM_CONFIGS_FILE): LlmFile {
  ensureDir(GLOBAL_CONFIG_DIR);
  if (!existsSync(filePath)) return { active: '', configs: {} };
  try {
    const content = readFileSync(filePath, "utf-8");
    return LlmFileSchema.parse(JSON.parse(content));
  } catch {
    return { active: '', configs: {} };
  }
}

export function writeLlmFile(file: LlmFile, filePath: string = LLM_CONFIGS_FILE): void {
  ensureDir(GLOBAL_CONFIG_DIR);
  const validated = LlmFileSchema.parse(file);
  writeFileSync(filePath, JSON.stringify(validated, null, 2), "utf-8");
}

export function getActiveLlmConfig(filePath: string = LLM_CONFIGS_FILE): LlmConfig | null {
  const file = readLlmFile(filePath);
  if (!file.active) return null;
  return file.configs[file.active] ?? null;
}
```

注意：函数签名加可选 `filePath` 参数只为测试隔离 —— 生产代码调 `readLlmFile()` 时不传，仍走 `LLM_CONFIGS_FILE`。

- [ ] **Step 6: 跑测试，确认 pass**

Run: `cd packages/engine && bun test src/paths.test.ts`
Expected: 8 tests pass。

- [ ] **Step 7: typecheck（仅 engine）**

Run: `cd packages/engine && bunx tsc --noEmit`
Expected: 无错误。

- [ ] **Step 8: 改根 package.json typecheck 脚本排除 cli**

打开 `package.json`，把 `typecheck` 改为：

```json
"typecheck": "bunx tsc --noEmit -p packages/engine/tsconfig.json"
```

（去掉了 `&& bunx tsc --noEmit -p packages/cli/tsconfig.json`。原因：本期把 engine 的 LLM API 升级为 envelope，cli 调用 `readLlmConfigs/writeLlmConfigs` 失效，cli 编译失败，本期不修复 cli。）

- [ ] **Step 9: 跑根 typecheck 确认通过**

Run: `bun run typecheck`
Expected: 通过（只跑 engine 那条）。

- [ ] **Step 10: Commit**

```bash
git add packages/engine/src/schema.ts packages/engine/src/types.ts packages/engine/src/paths.ts packages/engine/src/paths.test.ts package.json
git commit -m "$(cat <<'EOF'
feat(engine): llm-configs.json 升级为 envelope { active, configs }

- 新 readLlmFile / writeLlmFile / getActiveLlmConfig（带可选 filePath）
- 删 readLlmConfigs / writeLlmConfigs（破坏性，cli 失效）
- 加 paths.test.ts 8 用例
- 根 typecheck 排除 cli（本期明确不修 cli）

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: GUI API 路由 —— llm-configs（GET / POST / PATCH / DELETE）

**Files:**
- Modify: `packages/apps/gui/src/app/api/llm-configs/route.ts`
- Modify: `packages/apps/gui/src/app/api/llm-configs/[name]/route.ts`

- [ ] **Step 1: 改写 `/api/llm-configs/route.ts`**

整文件替换为：

```typescript
import { NextResponse } from 'next/server'
import { readLlmFile, writeLlmFile } from '@flowcabal/engine'

export async function GET() {
  const file = readLlmFile()
  return NextResponse.json({ active: file.active, configs: file.configs })
}

export async function POST(request: Request) {
  const { name, config } = await request.json()
  const file = readLlmFile()
  file.configs[name] = config
  if (!file.active) file.active = name  // 首条自动 active
  writeLlmFile(file)
  return NextResponse.json({ success: true })
}

export async function PATCH(request: Request) {
  const { active } = await request.json()
  const file = readLlmFile()
  if (!file.configs[active]) {
    return NextResponse.json({ error: 'config not found' }, { status: 400 })
  }
  file.active = active
  writeLlmFile(file)
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 2: 改写 `/api/llm-configs/[name]/route.ts`**

整文件替换为：

```typescript
import { NextResponse } from 'next/server'
import { readLlmFile, writeLlmFile } from '@flowcabal/engine'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params
  const file = readLlmFile()
  delete file.configs[name]
  if (file.active === name) {
    file.active = Object.keys(file.configs).sort()[0] ?? ''
  }
  writeLlmFile(file)
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 3: GUI typecheck**

Run: `bun run typecheck:gui`
Expected: 无错误。

- [ ] **Step 4: 启动 dev server，cURL 验证 4 个动词**

启动：`bun run dev`（保持运行）

打开新终端，按顺序跑：

```bash
# 1. 清空文件确保 fresh
rm -f ~/.config/flowcabal/llm-configs.json

# 2. GET 应返空 envelope
curl -s http://localhost:3000/api/llm-configs | jq .
# Expected: {"active":"","configs":{}}

# 3. POST 第一条，应自动 active
curl -s -X POST http://localhost:3000/api/llm-configs \
  -H 'Content-Type: application/json' \
  -d '{"name":"foo","config":{"provider":"openai","apiKey":"sk-test","model":"gpt-4o"}}' | jq .
# Expected: {"success":true}
curl -s http://localhost:3000/api/llm-configs | jq .
# Expected: active=foo, configs.foo 存在

# 4. POST 第二条，不抢 active
curl -s -X POST http://localhost:3000/api/llm-configs \
  -H 'Content-Type: application/json' \
  -d '{"name":"bar","config":{"provider":"anthropic","apiKey":"sk-test2","model":"claude-opus-4-7"}}' | jq .
curl -s http://localhost:3000/api/llm-configs | jq .
# Expected: active=foo（不变）

# 5. PATCH 切 active
curl -s -X PATCH http://localhost:3000/api/llm-configs \
  -H 'Content-Type: application/json' \
  -d '{"active":"bar"}' | jq .
curl -s http://localhost:3000/api/llm-configs | jq .
# Expected: active=bar

# 6. PATCH 到不存在的 name
curl -s -X PATCH http://localhost:3000/api/llm-configs \
  -H 'Content-Type: application/json' \
  -d '{"active":"ghost"}' -w "\nHTTP %{http_code}\n"
# Expected: {"error":"config not found"}, HTTP 400

# 7. DELETE 当前 active
curl -s -X DELETE http://localhost:3000/api/llm-configs/bar | jq .
curl -s http://localhost:3000/api/llm-configs | jq .
# Expected: active 自动补位到 foo

# 8. DELETE 最后一条
curl -s -X DELETE http://localhost:3000/api/llm-configs/foo | jq .
curl -s http://localhost:3000/api/llm-configs | jq .
# Expected: active="", configs={}
```

确认每一步符合 Expected 后继续。

- [ ] **Step 5: Commit**

```bash
git add packages/apps/gui/src/app/api/llm-configs/route.ts packages/apps/gui/src/app/api/llm-configs/[name]/route.ts
git commit -m "$(cat <<'EOF'
feat(gui/api): llm-configs 路由对接 envelope

- GET 返 { active, configs }
- POST 处理首条自动 active
- PATCH 切 active（不在 configs 返 400）
- DELETE active 后自动补位（按名字字母序）

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: GUI API 路由 —— run-all / memory chat 切换到 getActiveLlmConfig

**Files:**
- Modify: `packages/apps/gui/src/app/api/engine/run-all/route.ts:6`
- Modify: `packages/apps/gui/src/app/api/memory/chat/route.ts:23`

- [ ] **Step 1: 改 run-all/route.ts**

打开 `packages/apps/gui/src/app/api/engine/run-all/route.ts`。

- 改 line 1 import：

```typescript
import { readWorkspace, writeWorkspace, runAllDataflow, getActiveLlmConfig } from '@flowcabal/engine'
```

- 改 line 6-12（从 `const config = readLlmConfigs()['default']` 到 if 块结束）为：

```typescript
const config = getActiveLlmConfig()
if (!config) {
  return new Response(JSON.stringify({ error: '请先在 settings 选择活跃 LLM' }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  })
}
```

- [ ] **Step 2: 改 memory/chat/route.ts**

打开 `packages/apps/gui/src/app/api/memory/chat/route.ts`。

读 line 1 现有 import，把 `readLlmConfigs` 替换为 `getActiveLlmConfig`：

```typescript
import { conversationalMemoryAgentStream, getActiveLlmConfig, type MemoryStreamChunk } from '@flowcabal/engine'
```

找到 line 23 附近的 `const configs = readLlmConfigs()` 这一段，整体替换成（保持后续错误返回风格不变）：

```typescript
const config = getActiveLlmConfig()
if (!config) {
  return new Response(JSON.stringify({ error: '请先在 settings 选择活跃 LLM' }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  })
}
```

如果 line 23 后续代码引用过 `configs['default']` 之类，把它替换为 `config`。

- [ ] **Step 3: 完整读一遍 memory/chat/route.ts 确认无遗漏的 readLlmConfigs 引用**

Run: `grep -n "readLlmConfigs\|configs\[" packages/apps/gui/src/app/api/memory/chat/route.ts`
Expected: 空。

如果还有引用，修干净。

- [ ] **Step 4: GUI typecheck**

Run: `bun run typecheck:gui`
Expected: 无错误。

- [ ] **Step 5: 手工验证两个路由**

（dev server 应仍在跑。先用 cURL 准备 envelope：）

```bash
# 备一条 config（apiKey 用真实的，否则后续跑 DAG 会 401）
curl -s -X POST http://localhost:3000/api/llm-configs \
  -H 'Content-Type: application/json' \
  -d '{"name":"foo","config":{"provider":"openai","apiKey":"sk-...","model":"gpt-4o"}}'

# 删掉这条让 active 变空
curl -s -X DELETE http://localhost:3000/api/llm-configs/foo

# 调 run-all 应返 400
curl -s -X POST http://localhost:3000/api/engine/run-all \
  -H 'Content-Type: application/json' \
  -d '{"workspaceId":"any"}' -w "\nHTTP %{http_code}\n"
# Expected: {"error":"请先在 settings 选择活跃 LLM"}, HTTP 400
```

memory chat 同理（POST 到 `/api/memory/chat`，参考现有 body 结构）。

- [ ] **Step 6: Commit**

```bash
git add packages/apps/gui/src/app/api/engine/run-all/route.ts packages/apps/gui/src/app/api/memory/chat/route.ts
git commit -m "$(cat <<'EOF'
feat(gui/api): run-all + memory chat 用 getActiveLlmConfig 替换硬编码 'default'

active 为空或 config 缺失时返 400 中文错误，前端 sonner toast 兜底显示。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: SettingsDialog 列表改造（active 标记 + 设为活跃按钮）

**Files:**
- Modify: `packages/apps/gui/src/components/SettingsDialog.tsx`

- [ ] **Step 1: state 加 active 字段**

`SettingsDialog.tsx` line 150 附近的 `llmConfigs` state 改为存整个 envelope。

把：
```tsx
const [llmConfigs, setLlmConfigs] = useState<Record<string, LlmConfig> | null>(null)
```
改为：
```tsx
const [llmActive, setLlmActive] = useState<string>('')
const [llmConfigs, setLlmConfigs] = useState<Record<string, LlmConfig> | null>(null)
```

- [ ] **Step 2: fetchLlmConfigs 同时更新 active**

`fetchLlmConfigs`（line 161-174）里：

```tsx
const fetchLlmConfigs = async () => {
  setLlmLoading(true)
  try {
    const res = await fetch('/api/llm-configs')
    if (res.ok) {
      const data = await res.json()
      setLlmActive(data.active ?? '')
      setLlmConfigs(data.configs)
    }
  } catch {
    // ignore
  } finally {
    setLlmLoading(false)
  }
}
```

- [ ] **Step 3: 加 setActiveLlmConfig handler**

在 `deleteLlmConfig`（line 244）下面加：

```tsx
const setActiveLlmConfig = async (name: string) => {
  try {
    await fetch('/api/llm-configs', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: name }),
    })
    await fetchLlmConfigs()
  } catch {
    // ignore
  }
}
```

- [ ] **Step 4: 列表项改造**

找到 line 379-422 的 `<ul>...<li>...</li></ul>`，整段替换为：

```tsx
<ul className="flex flex-col">
  {Object.entries(llmConfigs).map(([name, cfg]) => {
    const isActive = llmActive === name
    return (
      <li
        key={name}
        className={[
          'py-3 border-b border-rule-soft last:border-b-0 flex items-baseline gap-3',
          isActive ? 'pl-[6px] border-l-2 border-clay -ml-[8px]' : 'px-2',
        ].join(' ')}
      >
        <span className="font-display text-[14.5px] text-ink shrink-0">
          {name}
        </span>
        {isActive && (
          <span className="font-display italic text-[12.5px] shrink-0">
            <span className="text-clay">〔</span>
            <span className="text-ink-soft mx-0.5">active</span>
            <span className="text-clay">〕</span>
          </span>
        )}
        <span className="font-display italic text-[12.5px] shrink-0">
          <span className="text-clay">〔</span>
          <span className="text-ink-soft mx-0.5">
            {PROVIDER_LABELS[cfg.provider] || cfg.provider}
          </span>
          <span className="text-clay">〕</span>
        </span>
        <span className="font-mono text-[11px] text-ink-faint truncate flex-1 min-w-0">
          {cfg.model}
        </span>
        {!isActive && (
          <button
            type="button"
            onClick={() => setActiveLlmConfig(name)}
            className={`${textBtnInk} shrink-0`}
          >
            设为活跃
          </button>
        )}
        <button
          type="button"
          onClick={() => startEdit(name)}
          className={`${textBtnInk} shrink-0`}
        >
          编辑
        </button>
        <button
          type="button"
          onClick={() => deleteLlmConfig(name)}
          disabled={llmDeleting === name}
          className={`${textBtnError} shrink-0`}
        >
          {llmDeleting === name ? '删除中…' : '删除'}
        </button>
      </li>
    )
  })}
</ul>
```

注意：active 行加 `border-l-2 border-clay` + 用 `-ml-[8px]` 抵消左 padding 改变，避免视觉跳行。

- [ ] **Step 5: 浏览器手工验证**

dev server 仍在跑（或重启）。

1. 打开 GUI，点设置图标 → settings 弹窗 → llm tab
2. 删除 `~/.config/flowcabal/llm-configs.json`，关弹窗再开（重新 fetch）→ 显「暂无 LLM 配置」
3. 关弹窗，用 cURL 加两条 config（foo / bar，apiKey 任意）
4. 重开 settings → 看到 foo（active）+ bar；foo 行左侧有 clay 竖线 + 〔 active 〕；bar 行有「设为活跃」按钮
5. 点 bar 的「设为活跃」→ 立即切，foo 行的「设为活跃」按钮出现
6. 删除 bar（active）→ foo 自动变 active
7. 删除 foo（最后一条）→ 「暂无 LLM 配置」

- [ ] **Step 6: Commit**

```bash
git add packages/apps/gui/src/components/SettingsDialog.tsx
git commit -m "$(cat <<'EOF'
feat(gui/settings): LLM 列表加 active 标记 + 设为活跃按钮

- 移除 (default) tag，替换为 active 行左 clay 竖线 + 〔 active 〕
- 非 active 行加「设为活跃」按钮，点击 PATCH /api/llm-configs
- envelope { active, configs } 直接从 GET 拉回填 state

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: SettingsDialog 表单改造（providerOptions textarea + DeepSeek 预设）

**Files:**
- Modify: `packages/apps/gui/src/components/SettingsDialog.tsx`

- [ ] **Step 1: LlmFormData / EMPTY_FORM 加 providerOptions 字段**

找到 line 38-49 的 `LlmFormData` interface，最末尾加：

```ts
interface LlmFormData {
  name: string
  provider: string
  baseURL: string
  apiKey: string
  model: string
  temperature: string
  maxTokens: string
  topP: string
  frequencyPenalty: string
  presencePenalty: string
  providerOptions: string
}
```

找到 line 51-62 的 `EMPTY_FORM`，最末尾加：

```ts
const EMPTY_FORM: LlmFormData = {
  name: '',
  provider: 'openai',
  baseURL: '',
  apiKey: '',
  model: '',
  temperature: '',
  maxTokens: '',
  topP: '',
  frequencyPenalty: '',
  presencePenalty: '',
  providerOptions: '',
}
```

- [ ] **Step 2: 加 DEEPSEEK_PRESET 常量**

在 `EMPTY_FORM` 下面加：

```ts
const DEEPSEEK_PRESET = {
  baseURL: 'https://api.deepseek.com',
  model: 'deepseek-v4-pro',
  maxTokens: '384000',
  providerOptions: JSON.stringify(
    {
      deepseek: {
        thinking: { type: 'enabled' },
        reasoning_effort: 'max',
      },
    },
    null,
    2,
  ),
}
```

- [ ] **Step 3: formToConfig 加 providerOptions 解析**

找到 line 64-82 的 `formToConfig`，在 `return config` 前加入：

```ts
if (data.providerOptions.trim()) {
  try {
    config.providerOptions = JSON.parse(data.providerOptions)
  } catch {
    // 校验已在 onBlur 拦住，这里理论上不会到
  }
}
```

完整版（替换 line 64-82）：

```ts
function formToConfig(data: LlmFormData): LlmConfig {
  const config: LlmConfig = {
    provider: data.provider as LlmConfig['provider'],
    apiKey: data.apiKey.trim(),
    model: data.model.trim(),
  }
  if (data.baseURL.trim()) config.baseURL = data.baseURL.trim()
  const t = parseFloat(data.temperature)
  if (!isNaN(t)) config.temperature = t
  const mt = parseInt(data.maxTokens, 10)
  if (!isNaN(mt)) config.maxTokens = mt
  const tp = parseFloat(data.topP)
  if (!isNaN(tp)) config.topP = tp
  const fp = parseFloat(data.frequencyPenalty)
  if (!isNaN(fp)) config.frequencyPenalty = fp
  const pp = parseFloat(data.presencePenalty)
  if (!isNaN(pp)) config.presencePenalty = pp
  if (data.providerOptions.trim()) {
    try {
      config.providerOptions = JSON.parse(data.providerOptions)
    } catch {
      // 校验已在 onBlur 拦住，理论上不会到
    }
  }
  return config
}
```

- [ ] **Step 4: 加 providerOptionsError state + onProviderChange handler**

找到 line 157 附近的 `const [showPasswordEdited, setShowPasswordEdited] = useState(false)`，下面加：

```tsx
const [providerOptionsError, setProviderOptionsError] = useState<string | null>(null)
```

在 `cancelForm`（line 218 附近）下面加：

```tsx
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

const validateProviderOptions = () => {
  if (!llmForm.providerOptions.trim()) {
    setProviderOptionsError(null)
    return
  }
  try {
    JSON.parse(llmForm.providerOptions)
    setProviderOptionsError(null)
  } catch (e) {
    setProviderOptionsError(e instanceof Error ? e.message : 'JSON 解析失败')
  }
}
```

- [ ] **Step 5: startEdit 回显 providerOptions + showAdvanced 触发条件**

找到 line 196-216 的 `startEdit`，把里面的两段改造：

把：
```tsx
setLlmForm({
  name,
  provider: cfg.provider,
  baseURL: cfg.baseURL || '',
  apiKey: cfg.apiKey,
  model: cfg.model,
  temperature: cfg.temperature?.toString() || '',
  maxTokens: cfg.maxTokens?.toString() || '',
  topP: cfg.topP?.toString() || '',
  frequencyPenalty: cfg.frequencyPenalty?.toString() || '',
  presencePenalty: cfg.presencePenalty?.toString() || '',
})
```
改为：
```tsx
setLlmForm({
  name,
  provider: cfg.provider,
  baseURL: cfg.baseURL || '',
  apiKey: cfg.apiKey,
  model: cfg.model,
  temperature: cfg.temperature?.toString() || '',
  maxTokens: cfg.maxTokens?.toString() || '',
  topP: cfg.topP?.toString() || '',
  frequencyPenalty: cfg.frequencyPenalty?.toString() || '',
  presencePenalty: cfg.presencePenalty?.toString() || '',
  providerOptions: cfg.providerOptions
    ? JSON.stringify(cfg.providerOptions, null, 2)
    : '',
})
```

把：
```tsx
setShowAdvanced(!!(cfg.topP || cfg.frequencyPenalty || cfg.presencePenalty))
```
改为：
```tsx
setShowAdvanced(!!(cfg.topP || cfg.frequencyPenalty || cfg.presencePenalty || cfg.providerOptions))
```

- [ ] **Step 6: startAdd 重置 providerOptionsError**

找到 line 188-194 的 `startAdd`，最后加一行 `setProviderOptionsError(null)`：

```tsx
const startAdd = () => {
  setLlmForm(EMPTY_FORM)
  setShowPassword(true)
  setShowPasswordEdited(false)
  setShowAdvanced(false)
  setProviderOptionsError(null)
  setLlmMode('add')
}
```

`startEdit` 末尾也加：
```tsx
setProviderOptionsError(null)
```

- [ ] **Step 7: 表单 provider Select 用 onProviderChange**

找到 line 457-469 的 `<Select value={llmForm.provider} onValueChange=...>`，把 `onValueChange` 改为：

```tsx
<Select
  value={llmForm.provider}
  onValueChange={onProviderChange}
>
```

- [ ] **Step 8: 高级参数折叠区加 providerOptions textarea**

找到 line 555-597 的 `{showAdvanced && (<div className="grid grid-cols-2 gap-4">...）...）}`，在最后一个 `<div>`（Presence Penalty）后面、`</div>` 闭包前加：

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
    <p className="mt-1.5 font-mono text-[10.5px] text-error">
      {providerOptionsError}
    </p>
  )}
</div>
```

完整高级区结构：

```tsx
{showAdvanced && (
  <div className="grid grid-cols-2 gap-4">
    <div>
      <FieldLabel muted>Top P</FieldLabel>
      {/* ...原有 input... */}
    </div>
    <div>
      <FieldLabel muted>Frequency Penalty</FieldLabel>
      {/* ...原有 input... */}
    </div>
    <div>
      <FieldLabel muted>Presence Penalty</FieldLabel>
      {/* ...原有 input... */}
    </div>
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
        <p className="mt-1.5 font-mono text-[10.5px] text-error">
          {providerOptionsError}
        </p>
      )}
    </div>
  </div>
)}
```

- [ ] **Step 9: formValid 加 providerOptionsError 因子**

找到 line 260：

```tsx
const formValid = llmForm.name.trim() && llmForm.apiKey.trim() && llmForm.model.trim()
```

改为：

```tsx
const formValid =
  llmForm.name.trim() &&
  llmForm.apiKey.trim() &&
  llmForm.model.trim() &&
  !providerOptionsError
```

- [ ] **Step 10: GUI typecheck**

Run: `bun run typecheck:gui`
Expected: 无错误。

- [ ] **Step 11: 浏览器手工验证**

dev server 仍在跑（或重启）。

1. 开 settings → llm tab → 「+ 添加配置」
2. provider 下拉切到 `OpenAI Compatible` → baseURL/model/maxTokens 立即填上预设；展开「高级参数」→ provider options textarea 内已有完整的 deepseek JSON
3. 输入 name=`ds`、apiKey=`sk-test`，保存 → 列表里 `ds` 〔 active 〕
4. 编辑 `ds`：高级参数区默认展开（因有 providerOptions），textarea 显示原 JSON
5. 把 providerOptions textarea 改成 `{not json` → 离焦后红字错误，保存按钮变灰
6. 改回合法 JSON `{"deepseek":{"reasoning_effort":"high"}}` 离焦 → 红字消失，保存按钮恢复
7. 保存 → 关闭弹窗后再打开编辑 `ds`，textarea 应该回显 high 模式（不是 max）
8. 新增一条 provider=`OpenAI`、name=`oa`、apiKey=任意、model=`gpt-4o` → 切到该表单时不会触发 deepseek 自动填（baseURL 留空、maxTokens 留空、providerOptions 留空）

- [ ] **Step 12: Commit**

```bash
git add packages/apps/gui/src/components/SettingsDialog.tsx
git commit -m "$(cat <<'EOF'
feat(gui/settings): providerOptions JSON textarea + openai-compatible DeepSeek 预设

- LlmFormData 加 providerOptions string 字段
- onBlur JSON.parse 校验，失败时红字 inline + 禁用保存
- provider 切到 openai-compatible 时空字段自动填 DeepSeek V4-Pro thinking max
- 编辑现有 config 时回显 providerOptions JSON 缩进
- showAdvanced 默认展开条件加 providerOptions

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: 端到端人工验证

**Files:** 无（验证步骤）

- [ ] **Step 1: 准备干净环境**

```bash
rm -f ~/.config/flowcabal/llm-configs.json
```

确保 dev server 在跑（`bun run dev`）。

- [ ] **Step 2: 走 spec 测试章节里 10 步人工验证**

参考 spec `docs/superpowers/specs/2026-05-25-gui-llm-config-design.md` 「测试 / gui（人工）」一节的 10 步：

1. 删 envelope 文件，刷新 settings → 「暂无 LLM 配置」
2. 加 `ds` provider=openai-compatible：自动填 deepseek 预设，输入 apiKey 后保存 → `ds` 〔 active 〕+ 左侧 clay 竖线
3. 加 `oa` provider=openai、apiKey=任意、model=gpt-4o → `ds` 仍 active；`oa` 行有「设为活跃」
4. 点 `oa` 「设为活跃」→ 立即切，`ds` 行的「设为活跃」按钮出现
5. 删 `ds`（非 active） → 静默；`oa` 仍 active
6. 删 `oa`（active） → 「暂无 LLM 配置」
7. 重建 `ds`（真实 apiKey），画布按运行按钮 → DAG 跑起来（model=deepseek-v4-pro thinking max）
8. 删光所有 config 后按运行 → sonner toast 显「运行失败：请先在 settings 选择活跃 LLM」
9. 编辑 `ds` providerOptions 改成 `{not json` 离焦 → 红字提示，保存按钮灰
10. providerOptions 改为 `{"deepseek":{"reasoning_effort":"high"}}` 保存 → 重新打开编辑，high 模式回显

任一步与 expected 不符则 stop 并 debug。

- [ ] **Step 3: 全套 typecheck 通过**

Run: `bun run typecheck`
Expected: 通过（engine 单独）。

Run: `bun run typecheck:gui`
Expected: 通过。

- [ ] **Step 4: engine 单测通过**

Run: `cd packages/engine && bun test`
Expected: 所有测试通过（含 paths.test.ts 的 8 个新用例）。

- [ ] **Step 5: 无新增遗留**

Run: `git status`
Expected: clean。

Run: `grep -rn "readLlmConfigs\|writeLlmConfigs" packages/engine/src packages/apps/gui/src`
Expected: 空（cli 里仍有，预期不动）。

Run: `grep -rn "configs\['default'\]\|configs\[\"default\"\]" packages/apps/gui/src`
Expected: 空。

如有遗漏 grep 命中，回到对应 Task 修。

---

## Self-Review

### Spec 覆盖

- envelope schema 升级 → Task 1 ✓
- engine 文件层重命名 + 测试 → Task 1 ✓
- API GET/POST/PATCH/DELETE 改造 → Task 2 ✓
- API run-all / memory chat 切 getActiveLlmConfig → Task 3 ✓
- SettingsDialog 列表（active 标记 + 设为活跃）→ Task 4 ✓
- SettingsDialog 表单（providerOptions + deepseek 预设）→ Task 5 ✓
- 错误与边界表（envelope 不存在、首条自动 active、删 active 补位、删完空、API 400 toast、JSON 非法禁用保存、openai-compatible 不覆盖已填、改 active 字段直接生效）→ Task 1-5 各对应一处或多处 ✓
- engine 自动测试 8 用例 → Task 1 ✓
- gui 人工 10 步 → Task 6 ✓
- cli 不动但 typecheck 不能挂 → Task 1 Step 8 把 cli 移出根 typecheck ✓

### Placeholder 扫描

无 TBD / TODO / 「适当处理」。所有 code 步骤都给了具体代码块。所有命令都给了 expected。

### 类型一致性

- `LlmFile` 在 schema.ts / types.ts / paths.ts / paths.test.ts / API 路由全程同名同结构 ✓
- `readLlmFile / writeLlmFile / getActiveLlmConfig` 在 plan 中始终统一签名（含可选 filePath）✓
- `LlmFormData.providerOptions: string` 与 `LlmConfig.providerOptions: Record<string, Record<string, JsonValue>>` 的边界由 `formToConfig` 的 JSON.parse 跨越，且空串 → 字段省略，与 spec 一致 ✓
- `setActiveLlmConfig` handler 名字在 Task 4 Step 3 引入，在 Step 4 列表项 onClick 处使用 ✓
- `DEEPSEEK_PRESET` 在 Task 5 Step 2 定义、Step 4 `onProviderChange` 内使用 ✓

无类型 / 命名漂移。
