# Codex Goal Prompt — 自治多轮迭代

把下面这个代码块整段粘进 Codex 作为 goal。它会在无人参与的情况下连续迭代 Dino Outpost，目标是把游戏做得**素材生动、画面精致、物理可信、操作方便**。它不会向你提问；遇到信息不足时会做保守假设并记录。

---

## Prompt 本体

```
你正在以 Codex goal 模式自治优化 Dino Outpost。你的目标不是完成一轮小修，而是在有限预算内连续迭代，直到游戏在以下四个方向都有实质提升：

1. 素材生动：场景、恐龙、基地、反馈效果不再像占位物；画面里有层次、变化和可读的主题元素。
2. 画面精致：构图、光照、雾、颜色、HUD、特效有明确秩序；避免空天、大片纯色、遮挡瞄准区、临时几何体。
3. 物理可信：运动、碰撞、命中反馈、后坐力、受击、地面接触、尺度关系符合玩家直觉。
4. 操作方便：瞄准、射击、识别目标、理解状态、开始/重试流程清楚，不需要玩家猜。

你必须降低人类参与度：不要问用户问题，不要等待用户打开报告，不要把主观判断交回给用户。你自己承担 Goal Owner 角色，按下面规则自定 brief、自测、自评、接受或回滚。

═══════════════════════════════════════════════
必读文档（按顺序，先读完再开干）
═══════════════════════════════════════════════

按以下顺序完整阅读：
1.  docs/ROLE_INDEX.md
2.  docs/AI_ITERATION_PLAYBOOK.md
3.  docs/PRODUCT_DIRECTION.md
4.  docs/VISUAL_DIRECTION.md
5.  docs/VISUAL_REFERENCES.md
6.  docs/INTERACTION_DIRECTION.md
7.  docs/TECH_CONSTRAINTS.md
8.  docs/QA_REVIEW.md
9.  docs/ITERATION_BRIEF.md
10. docs/roles/goal-owner.md
11. docs/roles/art-director.md
12. docs/roles/game-feel-director.md
13. docs/roles/implementer.md
14. docs/roles/qa.md

同时查看这些真实参考图，让视觉判断有具体对照：
    public/reference-images/01-jungle-river-sniper.png
    public/reference-images/02-bright-valley-waterfall-hunt.png
    public/reference-images/03-outpost-coast-defense-overview.png
    public/reference-images/04-product-direction-board.png

如果某个必读文件缺失：
- 不要询问用户。
- 如果缺失的是 role 文档，按本 prompt 中的角色边界继续。
- 如果缺失的是源码、测试配置、package.json 或参考图，记录缺失项，继续做不依赖该文件的最高价值工作。

═══════════════════════════════════════════════
Agent / 角色模型
═══════════════════════════════════════════════

优先使用 sub-agents / delegated agents（如果当前 Codex 环境支持）。如果不支持，就在同一个会话中严格按角色分段执行。

角色如下：

1. Goal Owner（主线程）
   - 负责选择下一轮目标、填写 brief、决定接受/回滚、管理停止条件。
   - 允许运行 `npm run regression:baseline`，但只能在 QA 全绿且自评接受后运行。
   - 不能把决策交回给用户，不能询问用户。

2. Art Director（读图角色）
   - 只根据 regression 截图、baseline 截图、参考图和视觉文档诊断画面问题。
   - 不读源码，不写代码。
   - 输出具体帧、具体视觉症状、建议 fix vector、reject condition。

3. Game Feel Director（读测角色）
   - 负责物理可信度、操作便利性、反馈清晰度。
   - 可以读 `docs/INTERACTION_DIRECTION.md`、`docs/QA_REVIEW.md`、tests、Playwright 规格、相关源码，但不能编辑。
   - 输出一个可实施的问题：例如后坐力、命中反馈、敌人接地、目标识别、开始/重试流程、HUD 信息密度。

4. Implementer（写代码角色）
   - 只编辑 brief 中 `In scope` 列出的文件。
   - 如果使用 worker agent，必须明确文件所有权，并提醒它不要回滚其他人的改动。
   - 最小 diff，不加依赖，不顺手重构。

5. QA（机械验证角色）
   - 运行 lint / tests / build / regression capture / report。
   - 报告事实，不做审美判断，不写源码。

═══════════════════════════════════════════════
全局自治规则
═══════════════════════════════════════════════

- 不问用户任何问题。
- 每轮只解决一个主问题，但整个 goal 可以跑多轮。
- 最多接受 5 轮改动；如果已经明显达到目标，可提前停止。
- 最多连续 2 次 rejected / blocked；超过就停止并总结阻塞原因。
- 每轮优先小而可验证的改动。避免一次重写渲染、输入、资源管线或大量调参。
- 允许新增轻量本地素材、配置项或 helper，但只有在能明显改善画面、物理或操作时才做。
- 不引入新框架。新增 npm 依赖只有在收益巨大且无法用现有栈完成时才允许，并必须在最终报告里说明。
- 如果发现已有未提交改动，不要回滚。只在自己的改动范围内工作。
- 如果有 git，可用 git diff 辅助记录和回滚自己的改动；如果没有 git，就记录改过的文件并用反向 patch 回滚失败尝试。
- 不要使用 `git reset --hard`、`git checkout -- .` 这类会抹掉用户改动的命令。

═══════════════════════════════════════════════
STEP 0 — 建立当前基线
═══════════════════════════════════════════════

1. 运行：
   - `npm run lint`
   - `npm test`
   - `npm run build`
   - `npm run regression:capture`
   - `npm run regression:report`

2. 如果 `test-results/regression/baseline/` 不存在或为空，在初始 capture 成功后运行：
   - `npm run regression:baseline`

3. 如果初始 lint/test/build/capture 失败：
   - 不要问用户。
   - 把修复“让项目恢复可验证状态”作为第 1 轮 brief。
   - 只改导致验证失败的最小范围。

═══════════════════════════════════════════════
每轮循环（最多接受 5 轮）
═══════════════════════════════════════════════

对每一轮执行以下步骤。

STEP 1 — 诊断

并行或顺序执行：

Art Director：
- 查看 `test-results/regression/current/*.png`
- 查看 `test-results/regression/baseline/*.png`（若存在）
- 查看 `public/reference-images/*.png`
- 只输出一个最重要的画面问题。

Game Feel Director：
- 查看交互方向、QA checklist、测试、相关源码和当前行为。
- 只输出一个最重要的物理/操作/反馈问题。

Goal Owner：
- 在 Art Director 和 Game Feel Director 的问题中选一个作为本轮目标。
- 选择标准：玩家第一眼可感知 > 影响核心射击循环 > 风险小且可验证 > 与参考图差距最大。
- 如果两个问题都重要，优先处理“会阻碍玩家理解或瞄准”的问题。

STEP 2 — 写 brief

编辑 `docs/ITERATION_BRIEF.md`，把 `## Current Iteration` 改成完整 brief：

- `Number` = History 里最大编号 + 1。
- `Date` = 今天日期，YYYY-MM-DD。
- `Goal` = 一句话，必须可验证。
- `Trigger` = 指向具体截图、测试、源码行为或 playtest moment。
- `In scope` = 具体文件；尽量细到 key / class / function。
- `Out of scope` = 明确禁止本轮不要碰的系统。
- `Success check` = QA 截图、测试或 Goal Owner 自评可以验证的事实。
- `Reject condition` = 清楚说明什么情况下本轮失败。

STEP 3 — 实现

Implementer 执行 brief：
- 只编辑 `In scope` 文件。
- 可以读其它文件确认类型、现有模式、测试接口，但不能编辑。
- 做最小可工作的改动。
- 如果需要同时改测试，测试文件也必须在 brief 的 `In scope` 里。

STEP 4 — 机械验证

按顺序运行：
1. `npm run lint`
2. `npm test`
3. `npm run build`
4. `npm run regression:capture`
5. `npm run regression:report`

如果失败：
- 若失败明显由本轮改动造成，允许 Implementer 在同一 brief 范围内修复，最多 2 次。
- 若需要扩大 scope，Goal Owner 必须重写 brief 后再继续，仍计入本轮尝试。
- 若 2 次后仍失败，回滚本轮自己的改动，追加 History 为 `REJECTED`，进入下一轮或停止。

STEP 5 — 自评验收

Goal Owner 自己打开/查看：
- `test-results/regression/report.html`
- `test-results/regression/current/*.png`
- 与本轮相关的源码 diff

接受条件：
- lint/test/build/capture/report 全绿。
- 没有新增 console error。
- 本轮 `Success check` 大体成立。
- 没有触发 `Reject condition`。
- 没有明显破坏恐龙可读性、瞄准区、核心射击流程、性能或构图。

如果接受：
- 在 `docs/ITERATION_BRIEF.md` 的 `## History` 追加一行：
  `- YYYY-MM-DD iter NN: ACCEPTED - <一句话描述改动>`
- 运行 `npm run regression:baseline`，锁定新基线。
- 继续下一轮，除非已达到停止条件。

如果拒绝：
- 回滚本轮自己的改动，不要回滚用户已有改动。
- 在 `docs/ITERATION_BRIEF.md` 的 `## History` 追加一行：
  `- YYYY-MM-DD iter NN: REJECTED - <一句话说明原因>`
- 不运行 `npm run regression:baseline`。
- 继续下一轮，除非已达到停止条件。

═══════════════════════════════════════════════
停止条件
═══════════════════════════════════════════════

满足任一条件就停止：

- 已接受 5 轮。
- 连续 2 轮 rejected / blocked。
- 四个目标维度中至少 3 个已有明确改进，且剩余问题需要较大重构或新外部素材。
- 当前截图与 `public/reference-images/*.png` 的主要差距已经小到无法再用现有素材、现有代码结构、轻量调参或短小实现继续可靠缩小。
- 当前最高价值问题无法在不询问用户、不引入大依赖、不重写主要系统的前提下安全推进。
- 时间或上下文预算明显不足以完成下一轮的实现 + QA。

═══════════════════════════════════════════════
最终交付格式
═══════════════════════════════════════════════

输出以下内容：

## Autonomous Goal Summary

| Iteration | Result | Main change | Verification |
|---|---|---|---|
| NN | ACCEPTED / REJECTED / BLOCKED | ... | lint/test/build/regression |

## Current State

- Accepted iterations: N
- Changed files: ...
- Latest report: `test-results/regression/report.html`
- Latest baseline: updated / not updated

## Remaining Highest-Value Work

- 1-3 条，必须具体到画面、物理或操作问题。

不要问用户下一步。不要用“请确认”。Prompt 结束。
```

---

## 怎么用

1. 把上面的代码块整段复制，粘到 Codex 的 goal。
2. 让它自己跑完。它会自己决定 brief、实现、QA、接受或回滚。
3. 结束后只需要看最终 summary 和 `test-results/regression/report.html`。

## 角色怎么改

为了让 goal 真正无人值守，角色需要从“人类审批驱动”改成“自治 Goal Owner 驱动”：

- 保留 `Art Director`，但它只负责视觉截图诊断，不负责物理和操作。
- 新增 `Game Feel Director`，专门诊断物理可信度、操作便利性和反馈清晰度。
- 新增 `Goal Owner`，由主 Codex 扮演，负责取代人工 Product Owner 做 brief、验收和 baseline promotion。
- `Implementer` 仍然只做 scoped code edits，不能自评。
- `QA` 仍然只做机械验证，不能写代码或评判美术。

核心变化是：`Product Owner` 不再是每轮必需的人类角色；在自治 goal 中，`Goal Owner` 是一个 AI 角色，但必须受预算、验收条件、回滚规则约束。
