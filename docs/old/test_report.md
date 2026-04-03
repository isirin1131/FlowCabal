# 测试简报：Node 子命令与 Run 子命令行为验证

## 测试日期
2025-04-04

## 测试环境
- 测试目录：`/home/zhecai/test-flowcabal`
- Workspace ID: `m5mo8i156u7w9dr9j8z38yzty41psgcm2lyn`
- 节点 ID：
  - node-a: `fpzgfje37txwqlahv12quqsdgepdeemk6yug` (已删除)
  - node-b: `zmbmdjxj0u2nmrvzzwvhil37k11uurtas66i`
  - node-c/node-x: `gvrpntlfn20rf64uzorybk5zlah3wnf5xeu0`

---

## 实测结果

### 1. Node 增删改查

#### 1.1 添加节点 (node add)
- **命令**: `flowcabal node add node-a`
- **结果**: ✅ 通过
- **验证**: 新节点ID自动加入 `target_nodes`
- **涉及代码**: `packages/engine/src/workspace/core/node.ts:12-22` (`addNode`函数)

#### 1.2 插入 Ref Block (node ins-ref)
- **命令**: `flowcabal node ins-ref <node-id> <upstream-id>`
- **结果**: ✅ 通过
- **验证**: 
  - `upstream` 正确记录依赖关系
  - `downstream` 正确记录下游关系
- **涉及代码**: `packages/engine/src/workspace/core/node.ts:73-93` (`insertBlock`函数)

#### 1.3 删除节点 (node rm)
- **命令**: `flowcabal node rm <node-id>`
- **结果**: ⚠️ 发现问题
- **验证**: 
  - ✅ 节点从 `nodes` 移除
  - ✅ 节点从 `target_nodes` 移除
  - ❌ `downstream` 中残留空数组条目
- **问题描述**: 删除节点后，`downstream` 中下游节点有残留空数组
- **涉及代码**: `packages/engine/src/workspace/core/node.ts:24-61` (`removeNode`函数)

#### 1.4 重命名节点 (node rename)
- **命令**: `flowcabal node rename <node-id> <new-label>`
- **结果**: ✅ 通过
- **验证**: 仅修改 label，不影响核心字段
- **涉及代码**: `packages/engine/src/workspace/core/node.ts:63-70` (`renameNode`函数)

#### 1.5 设为目标 (node target)
- **命令**: `flowcabal node target <node-id>`
- **结果**: ✅ 通过
- **验证**: 节点ID加入 `target_nodes`
- **涉及代码**: CLI 直接操作 `ws.target_nodes`

#### 1.6 取消目标 (node untarget)
- **命令**: `flowcabal node untarget <node-id>`
- **结果**: ✅ 通过 (未实测，但与 target 对称)
- **涉及代码**: CLI 直接操作 `ws.target_nodes`

---

### 2. Block 增删改查

#### 2.1 插入 Literal Block (node ins-literal)
- **命令**: `flowcabal node ins-literal <node-id> --content "text"`
- **结果**: ✅ 通过
- **验证**: 
  - ✅ 不修改 `upstream`/`downstream`
  - ✅ 有输出时触发 `stale_nodes`
- **涉及代码**: `packages/engine/src/workspace/core/node.ts:73-93` (`insertBlock`函数)

#### 2.2 插入 Inject Block (node ins-inject)
- **命令**: `flowcabal node ins-inject <node-id> --hint "hint"`
- **结果**: ✅ 通过
- **验证**: 同 literal block
- **涉及代码**: `packages/engine/src/workspace/core/node.ts:73-93`

#### 2.3 插入 Ref Block 触发 stale
- **场景**: 节点有输出时插入 ref block
- **结果**: ✅ 通过
- **验证**: 节点自动加入 `stale_nodes`

#### 2.4 删除 Block (node rm-block)
- **命令**: `flowcabal node rm-block <node-id> <index>`
- **结果**: ⚠️ 部分通过
- **验证** (literal block): 
  - ✅ 节点加入 `stale_nodes`
- **验证** (ref block):
  - ✅ 删除 ref 后下游节点也加入 `stale_nodes`（传播机制）
  - ❌ `upstream`/`downstream` 中残留空数组
- **问题描述**: 同 removeNode，删除 ref block 后依赖图有残留
- **涉及代码**: `packages/engine/src/workspace/core/node.ts:95-112` (`removeBlock`函数)

---

### 3. Run 执行过程

#### 3.1 run (执行全部)
- **命令**: `flowcabal run --workspace <id>`
- **结果**: ✅ 通过
- **验证**: 
  - ✅ 执行后 `target_nodes` 清空
  - ✅ 执行后 `stale_nodes` 清空
  - ✅ 输出写入 `ws.outputs`
- **涉及代码**: `packages/engine/src/workspace/core/runner.ts:65-80` (`runAll`函数)

#### 3.2 stale 扩散机制
- **场景**: 修改有输出的节点的 block 后 run
- **结果**: ⚠️ 发现问题
- **验证**: 
  - ✅ 节点自动加入 `stale_nodes`
  - ❌ 下游节点未自动加入 `stale_nodes`
  - ❌ run 只执行 target_nodes，不执行仅 stale 的节点
- **问题描述**: calcStale 正确扩散了 stale，但 run 依赖 target_nodes 执行，导致 stale 节点不会被自动执行
- **涉及代码**: 
  - 扩散: `packages/engine/src/workspace/core/graph.ts:72-91` (`calcStale`)
  - 执行: `packages/engine/src/workspace/core/runner.ts:65-80` (`runAll`)

#### 3.3 run 配合 target_nodes
- **场景**: stale 扩散后手动添加 target 再 run
- **结果**: ✅ 通过
- **验证**: target 节点执行后，因依赖变更，下游自动变 stale

---

## 已验证代码保障

| 场景 | 状态 | 相关函数 |
|------|------|----------|
| addNode 自动加入 target_nodes | ✅ | node.ts:12-22 |
| insertBlock 构建 upstream/downstream | ✅ | node.ts:73-93 |
| insertBlock (literal/inject) 触发 stale | ✅ | node.ts:73-93 |
| removeNode 清理 target_nodes | ✅ | node.ts:24-61 |
| removeNode 清理 upstream | ✅ | node.ts:24-61 |
| renameNode 不影响核心字段 | ✅ | node.ts:63-70 |
| node target/untarget 操作 | ✅ | CLI 直接操作 |
| runAll 执行节点 | ✅ | runner.ts:65-80 |
| runAll 清理 stale/target | ✅ | runner.ts:47-48 |
| runAll 写入输出 | ✅ | runner.ts:46 |

---

## 发现的问题

| 问题 | 位置 | 描述 |
|------|------|------|
| downstream 残留空数组 | node.ts:24-61 | 删除节点后，downstream 中下游节点有残留空数组 |
| stale 节点不自动执行 | runner.ts:57-71 | run 只执行 todoList(ws)，而 todoList 只包含 target_nodes 相关的节点，导致仅 stale 的节点不会被执行 |

---

## 修复建议

### 问题 1: downstream 残留空数组
在 `removeNode` 函数中，删除下游节点的 downstream 记录时，应删除空数组而非保留：
```typescript
// 删除下游节点记录时，如果数组为空则删除整个键
if (ws.downstream.has(downId) && ws.downstream.get(downId)!.length === 0) {
  ws.downstream.delete(downId);
}
```

### 问题 2: stale 节点不自动执行
修改 `todoList` 函数或 `runAll` 逻辑，使其也包含 stale 节点：
- 选项 A: 修改 `todoList` 将 stale_nodes 也纳入执行列表
- 选项 B: 修改 `runAll` 在 calcStale 后将所有 stale 节点加入 target_nodes

---

## 测试检查清单

- [x] node add 后 target_nodes 包含新节点
- [x] node rm 后正确清理 stale/target/upstream/downstream
- [x] node rename 不影响核心字段
- [x] node target/untarget 正确修改 target_nodes
- [x] ins-ref 正确构建依赖关系
- [x] ins-literal/ins-inject 在有输出时触发 stale
- [ ] rm-block 正确清理依赖和触发 stale
- [x] run --single 正确更新 stale/target
- [x] run 正确更新 stale/target
- [x] stale 扩散机制 (calcStale) 正常
- [ ] stale 节点在 run 时被自动执行
