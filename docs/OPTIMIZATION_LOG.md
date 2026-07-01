# Optimization Log

详细记录每次系统级优化的「为什么、改了什么、改在哪、怎么验」。
`ITERATION_BRIEF.md` 的 History 只放一行摘要，本文件放完整内容，方便之后的 agent / 人类回溯。

按 iteration 编号倒序排列，最新在最上。

---

## §31 — Realistic GLB Weapons (2026-05-17, iter 31)

**问题（来自用户反馈）**：枪模型是程序化盒子拼出来的，再怎么细分也像 placeholder。

**搜索 + 下载**：通过 sub-agent 搜了 Poly Pizza / Quaternius 等免费 3D 模型站，选了 3 把：

| 武器槽 | 文件 | 来源 | 协议 |
|---|---|---|---|
| marksman | `sniper_quaternius.glb` | Quaternius Ultimate Guns Pack | CC0 |
| carbine | `sniper_quaternius_alt.glb` | Quaternius Ultimate Guns Pack | CC0 |
| shotgun | `kar98k.glb` | AdamKokrito on Poly Pizza | CC-BY 3.0（需署名） |

下载到 `public/assets/models/polypizza/weapons/`，未纳入 git（在 `docs/ASSETS.md` 注明）。

**接入实现**

- `createWeaponRig()` 末尾启动 `loadWeaponGlbs(root)` 异步加载。
- 加载完成后 `applyWeaponVisual()` 切换显示：GLB 容器逐个 `setEnabled(true/false)`，同时把程序化几何 `isVisible=false`。GLB 加载失败时自动 fallback 到程序化。
- 一次性写了一份 `tests/playwright/inspect-weapon.spec.ts`（用完即删）抓 console.log 输出 bounding box，确认了三个模型的原生尺寸（marksman X=7.29 Y=1.48 Z=0.46，barrel 沿 -X 轴）。

**关键的两个坑**

1. **`mesh.setParent(container)` 会保留世界变换**——会把 container 上的 rotation/scale 反向写进 mesh.local 来补偿，结果旋转/缩放完全不起作用。
2. 解决：用 **inner/outer 两层 TransformNode** 结构：
   - `outer`（容器，承载 `pos/rot/scale`）—— 直接当 `weaponGlbContainers[id]`
   - `inner`（仅承载 bounds-centering 偏移，无 rotation/scale）
   - 用 `mesh.parent = inner`（直接赋值，**不要** setParent）把 GLB 网格挂上去
3. 旋转 `rot.y = π/2` 把模型自然 -X-forward 转到 Babylon +Z-forward。

**关键文件**

- `src/app/Game.ts`：
  - 字段 `weaponGlbContainers: Partial<Record<WeaponId, TransformNode>>`、`weaponGlbLoaded`
  - 新方法 `loadWeaponGlbs(root)`
  - `applyWeaponVisual()` 分支：GLB 已加载时直接走容器 enable 切换
- `public/assets/models/polypizza/weapons/{sniper_quaternius,sniper_quaternius_alt,kar98k}.glb`
- `.gitignore` 已 cover（`public/assets/models/` 全排除）。`docs/ASSETS.md` 加了下载源说明。

**风险 / 已知局限**

- Per-weapon 的 pos/rot/scale 是手调的，对其他枪 GLB（不同 pivot/scale）要重新校准。
- Kar98k 是 CC-BY 3.0，**用了就要署名**。下面"署名"段已加。
- 武器朝向计算只用了 Babylon Y 轴旋转；若以后换的 GLB 是 +Y up 但 barrel 沿别的轴，要复用 inspect-weapon spec 重新测。

**Attribution**

- Kar98k 模型来自 **AdamKokrito**（Poly Pizza, CC-BY 3.0）。

---

## §30 — Camera Shake on Combat Events (2026-05-17, iter 30)

**问题**：开火 / 命中 / 击杀 时屏幕完全不动，反馈缺一层"重量感"。

**改了什么**

- 新增字段 `cameraShakeSeconds`、`cameraShakeAmplitude`，新增方法 `triggerCameraShake(amplitude, seconds)`。
- 在 `updatePlayerMovement()` 末尾叠加 shake 偏移到 `camera.position`：每帧 `(rand-0.5) * amplitude * (remainingSec/0.25)` 加到 x/y。
- `triggerCameraShake` 实现"取最大"叠加：多事件并发时，最强的那个胜出。
- 接入点：
  - **每发开火**：`fire()` 里按武器类型分级：shotgun 0.045 / marksman 0.028 / carbine 0.018，scope 状态下 ×0.4。
  - **击杀**：`fire()` 命中 + killed 分支：crit 0.06 / heavy 0.05 / 普通 0.035，持续 0.22s。

**关键文件**

- `src/app/Game.ts` — `updatePlayerMovement()`（shake 叠加到位置）、`triggerCameraShake()`、`fire()`（开火和击杀调用点）。

**风险**

- 持续时间用 `Math.max(remainingSec, newSec)` 而非 reset；连发时不会被重置成 0.25 重新计时，但前一次没结束时新一次的振幅可能没起作用（取 max amplitude * remaining phase）。如果需要"每次开火都振幅满血"，改成 `Math.max` 但用单独的 `currentAmp` 计算。
- 不影响 pitch/yaw，纯位置抖动；FPS 抖动派系两种风格都常见，当前是"温和派"。

---

## §29 — Movement Feel (2026-05-17, iter 29)

**问题**：移动是直接位移没有惯性，bob 太弱（0.025），没有横移倾斜。

**改了什么**

完全重写 `updatePlayerMovement()`：

1. **速度平滑**：新字段 `playerVelocity = new Vector3()`，每帧 `vel.x += (target_vx - vel.x) * dt * accelRate`，其中 `accelRate = 14`（有输入）或 `9`（松开按键，更慢减速 → 不至于像踩刹车）。
2. **步态化 bob**：
   - 频率 `movementBob += dt * (0.6 + actualSpeed * 3.6)`——静止时也有 0.6 rad/s 微呼吸；运动时按速度加速。
   - 垂直 bob = `sin(movementBob) * 0.04 * bobScale + sin(movementBob * 0.32) * 0.006`（步频 + 慢呼吸双层）。
   - 横向 bob = `sin(movementBob * 0.5) * 0.022 * bobScale`（半频，模拟一步左一步右）。
3. **横移倾斜（camera roll）**：新字段 `cameraRoll`，每帧 lerp 到 `-(vel.x / targetSpeed) * 0.04`（最大 ±2.3°），赋给 `camera.rotation.z`。
4. **保留**：移动边界（x ±3.2、z [-1.35, 1.85]）、scope 减速（1.2 vs 3.2）。

**关键文件**

- `src/app/Game.ts` — `updatePlayerMovement()`、新字段 `playerVelocity`/`cameraRoll`。

**风险 / 已知局限**

- camera.rotation.z 在某些 Babylon 版本和 PostProcess 配合时会让 vignette/scope 一起 roll，目测无问题。
- 静止呼吸 bob 是 0.6 rad/s 持续累积，长时间会让 `movementBob` 累加到大数，最终精度损失。可以模 2π 但 60fps 下 28 小时才会到 64-bit 浮点精度问题，先不管。

---

## §28 — Hit Burst Polish (2026-05-16, iter 28)

**问题（来自分析 F3）**：命中爆点已有 flash + sparks + ring，但缺一个"火药感"的烟雾尾迹，整个反馈消失得太快。

**改了什么**

`createImpact()` 扩展：

- **新增烟雾 puff**：暗灰色球（`#3c3a36` alpha 0.5），生命周期 260ms（普通）/ 380ms（暴击）。每帧用 `onBeforeRenderObservable`：
  - 缩放从 1× 长到 3.4×
  - alpha 线性下降到 0
  - y 位置上升 0.45 unit（模拟烟雾上飘）
- **闪光球**变大：0.42→0.5 / 0.85→1.0
- **闪光持续**变长：95→105 / 170→180
- **spark 数量**：7→11（普通）/ 12→18（暴击）
- **spark 散布**：0.48→0.6 / 0.9→1.1
- **spark 大小**：0.07→0.075 / 0.1→0.11
- **冲击环 thickness**：0.025→0.03，diameter 0.7→0.85 / 1.25→1.4
- **闪光颜色**统一暖白 `#fff1c8`，与 §23 tracer 同色温

**关键文件**

- `src/app/Game.ts` — `createImpact()`。

**视觉效果**

- 爆点现在有三个时间层：瞬时闪光（~100ms）→ spark 飞溅（~200ms）→ 烟雾飘散（~380ms）。
- 给视觉一个"残留印象"，玩家能看清自己打到哪里。

**风险**

- 烟雾 sphere 在面对透明水/玻璃 mesh 时可能出现 alpha 排序问题，目前没观察到。
- 每次命中创建 1 个 sphere + 1 个 material + 注册 1 个 observer——回收靠观察者自销毁，无泄漏。

---

## §27 — Enemy Healthbar Overhead (2026-05-16, iter 27)

**问题（来自分析）**：玩家不知道当前瞄准的敌人还剩多少血。target-panel 右上有文字 "HP 67%" 但视线在中央，需要侧目看。

**改了什么**

1. HUD HTML 增加 `<div class="enemy-healthbar"><span class="enemy-healthbar-fill"></span></div>`。
2. `HudRefs` 加 `enemyHealthbar`、`enemyHealthbarFill` 引用。
3. 新方法 `updateEnemyHealthbar()`：
   - 仅在 `currentAimTarget && weapon.isScoped` 时显示（避免非瞄准状态下满屏血条噪音）。
   - 用敌人世界坐标 `(enemy.x, enemy.height + 0.4, enemy.z)`（头顶上方 0.4 unit）通过 `Vector3.Project` 投影到屏幕。
   - z 在 (0, 1) 区间外则隐藏。
   - 血量比例驱动 fill 宽度 + 颜色：>60% 绿、>30% 黄、≤30% 红。
4. 在 `updateHud()` 末尾调用。
5. CSS `.enemy-healthbar`：74×5px 黑底带白边，`margin: -16px 0 0 -37px` 实现中心对齐头顶上方；`transform` 由 JS 设置；`.visible` 触发 100ms 淡入。

**关键文件**

- `src/app/Game.ts` — HUD HTML、HudRefs 接口、createHud refs、updateEnemyHealthbar、updateHud 末尾调用。
- `src/ui/styles.css` — `.enemy-healthbar`、`.enemy-healthbar-fill`、`.enemy-healthbar.visible`。

**风险 / 已知局限**

- 仅 scope 时显示——非 scope 模式下没有头顶血条。设计上是为了引导玩家用 scope；如果要随时显示，去掉 `isScoped` 条件即可。
- 头顶坐标用 `height + 0.4`；某些恐龙的 height 与实际渲染高度不完全对应（GLB 比例非 1:1），可能血条贴脸或飘高。如发现可调常量。

---

## §26 — Next Wave Indicator (2026-05-16, iter 26)

**问题（来自分析）**：玩家不知道下一波什么时候来。HUD 只有总倒计时（110s），无法预判节奏。

**改了什么**

1. HUD HTML：mission-panel 末尾加 `<span class="next-wave-label" data-hud="nextWave">All clear</span>`。
2. `HudRefs` 加 `nextWave: HTMLElement`。
3. 新方法 `updateNextWave()`：
   - 遍历 `expandedWaves`，找出 `time > elapsedSeconds && !spawnedEvents.has(index)` 中 time 最小的事件。
   - 找到：`Next: ${enemyLabel} ${ceil(time - elapsedSeconds)}s`
   - 找不到（所有事件已 spawn）：`Final hold`
   - 非 playing 阶段：清空文字
4. CSS `.next-wave-label`：mission-panel 底部，10px 字号，0.08em 间距，顶部加 1px 半透明分隔线，`text-overflow: ellipsis` 避免长名字溢出。

**关键文件**

- `src/app/Game.ts` — HUD HTML、HudRefs、createHud refs、updateNextWave、updateHud 调用。
- `src/ui/styles.css` — `.next-wave-label`。

**风险 / 已知局限**

- 每帧线性扫描 `expandedWaves`（~30 条），O(n)。可优化为指针前进，但目前性能可接受。
- 文本英文 + 1 秒粒度——若以后要做 ms 级精度需改 `Math.ceil` 为 `toFixed(1)`。

---

## §25 — Minimap Dynamic Blips (2026-05-16, iter 25)

**问题（来自分析 I5）**：minimap 只有 3 个硬编码红点（`.blip.b1/b2/b3`），与实际敌人位置无关。占视野但不提供信息。

**改了什么**

1. HUD HTML：移除硬编码的 `<b class="blip b1/b2/b3">`，替换为空容器 `<div class="minimap-blips" data-hud="minimapBlips">`。
2. `HudRefs` 加 `minimapBlips`。
3. 类字段 `minimapBlipNodes = new Map<number, HTMLElement>()`——按 enemy id 复用 DOM 节点。
4. 新方法 `updateMinimap()`：
   - 取相机位置 + yaw。
   - 对每个活敌人：
     - `dx = enemy.x - camera.x`，`dz = enemy.z - camera.z`
     - 用玩家朝向旋转：`relForward = dx*sin(yaw) + dz*cos(yaw)`、`relRight = dx*cos(yaw) - dz*sin(yaw)`
     - 像素：`mapX = relRight * 1.25`，`mapY = -relForward * 1.25`（forward → up）
     - 超出 56px 半径时按比例 clamp 到边缘
   - 复用或创建 DOM 节点，写 `transform: translate(...)`。
   - heavy 类型（trike/stego/sauropod）用 `.heavy` 变体（橙黄 + 8×8 大于普通 6×6）。
   - 死亡 / 移除的敌人对应节点删除。
5. CSS：
   - 新 `.minimap-blips` 容器（absolute inset:0, pointer-events:none）。
   - `.minimap-blip` 红色圆点；`.minimap-blip.heavy` 橙黄变体。
   - 删除老的 `.blip` 和 `.b1/.b2/.b3` 规则。

**关键文件**

- `src/app/Game.ts` — `createHud()` HTML、`HudRefs`、`minimapBlipNodes` 字段、`updateMinimap`、`updateHud()` 调用。
- `src/ui/styles.css` — `.minimap-blips`、`.minimap-blip`、`.minimap-blip.heavy`，删除老 `.blip` 规则。

**视觉效果**

- 玩家旋转时 minimap 上的敌人位置随之旋转——任何时候 minimap 顶部都是"前方"。
- 敌人接近时 blip 从外环向中心移动；超出范围 clamp 到边缘的"边缘点"。
- heavy 类型立即可辨。

**风险 / 已知局限**

- 玩家 yaw 在 Babylon 里是 Y 轴旋转弧度。Y 轴朝上，正向旋转应为绕 Y 轴逆时针——我的 sin/cos 公式 sanity 测试过两个角度，但完整四象限若发现镜像，需把 sinYaw 改成 -sinYaw。
- DOM 节点用 `transform` 写位置而不是 `left/top`——走 GPU compositor，60fps 下顺滑。
- 1.25 px/unit 的 scale 意味着小地图覆盖前后 ±36 unit；和 `enemySpawnZ=30 + attackLineZ=-6.5` 的总距离 36.5 完美匹配（不是巧合，调过）。

---

## §24 — Damp Ground Patches (2026-05-16, iter 24)

**问题（来自分析）**：地面是一整片均匀棕色，没有任何潮湿/积水/落叶等变化。参考图 01/02 的湿热环境地面有明显的湿润斑驳。

**改了什么**

- `createWetlandChannel()` 末尾增加 10 个深色 disc patch：
  - 材质 `ground-damp-patch`：`#1f1d18` 深棕黑，alpha 0.55
  - 尺寸 1.4-3.8 unit，旋转随机
  - 位置：5 对沿河道左右两侧（x=±7 to ±11），分布 z=5-48；另 2 个在玩家身后（z=-3 到 -4）
  - 略偏离实际水池避免 z-fighting
  - 所有 disc 都 `isPickable=false`

**关键文件**

- `src/app/Game.ts` — `createWetlandChannel()` 末尾，rockPositions 之前。

**风险 / 已知局限**

- 10 个 disc 是手摆，密度比真实地形低。如果以后玩家移动范围扩大，可能会显得太规律。可用 `Math.random()` 但会让画面不可复现。
- 这些 patch 在地面贴图之上，可能引起 z-fighting；通过 y=0.04（高于 ground y=0）避免。

---

## §23 — Tracer Punch (2026-05-16, iter 23)

**问题（来自分析）**：弹道 tracer 太细（0.014 unit）、太冷色（#dce9ee）、glow 不明显。射击反馈在繁忙场景里容易被忽视。

**改了什么**

`createTracer()` 全面强化：

| param | before | after |
|---|---|---|
| 普通弹 radius | 0.014 | 0.028（**×2**） |
| 暴击弹 radius | 0.025 | 0.045 |
| 普通弹颜色 | `#dce9ee`（冷灰） | `#fff1c8`（暖白黄） |
| 普通弹 emissive 倍率 | 0.82 | 1.35 |
| 暴击弹 emissive 倍率 | 1.45 | 1.95 |
| 普通弹 alpha | 0.45 | 0.62 |
| 暴击弹 alpha | 0.74 | 0.85 |
| `Lines` color 强度 | `tracerIntensity` | `tracerIntensity × 1.4` |
| **新增** outer halo tube | — | 普通 r=0.075 / 暴击 r=0.11，alpha 0.18 / 0.32，比 core 早 30ms 消失 |

**关键文件**

- `src/app/Game.ts` — `createTracer()`。

**视觉效果**

- core beam 厚 + 暖色 = 更像"曳光弹"而不是"激光指针"。
- 外圈 halo 短暂出现，给了"弹丸 + 余焰"的双层感觉。
- 暴击弹 visually 区分更强（黄色 + 大半径 + 高 alpha）。

**风险 / 已知局限**

- 每次射击创建 3 个 mesh（line + beam + halo）+ 2 个 material（`tracer-beam-*` 和 `tracer-halo-*`）。射速快的 carbine（0.14s 间隔）会高频创建/dispose。性能上可接受但浪费内存——下一轮可以池化材质。
- halo 半径在密集场景里可能轻微遮挡背后元素；alpha 已经低（0.18-0.32），实际不容易看出。

---

## §22 — Damage Number Popups (2026-05-16, iter 22)

**问题（来自分析 F3）**：命中后只有屏幕中央的 hit-marker，没有伤害数字，玩家不知道"打了多少"或者"这一发是不是暴击"。

**改了什么**

1. HUD HTML：在 `createHud()` innerHTML 里 `damage-flash` / `threat-edge` 后面加 `<div class="damage-pop-layer" data-hud="damagePops">`。
2. HudRefs 类型加 `damagePops: HTMLElement`，`createHud()` return 里加 `damagePops: get("damagePops")`。
3. 新方法 `spawnDamagePop(worldPos, damage, isCritical)`：
   - 用 `Vector3.Project(worldPos, Matrix.Identity(), scene.getTransformMatrix(), camera.viewport.toGlobal(rect.width, rect.height))` 投影到屏幕。
   - 检查 `screen.z` ∈ (0, 1)；不在则不弹（点在相机背后）。
   - 创建 `<span class="damage-pop">` 或 `.crit`，文本 `${damage}` 或 `${damage}!`。
   - `requestAnimationFrame` 后加 `.rise` class 触发 CSS transition（位移 -260% / -320% + 透明度 0）。
   - 900ms 后 `remove()`。
4. `fire()` 命中分支里调用 `this.spawnDamagePop(end, result.damage, isCritical)`。
5. CSS 增加 `.damage-pop-layer`、`.damage-pop`、`.damage-pop.crit`、`.damage-pop.rise`：
   - 普通 18px 白色，crit 26px 金色 + 多层 glow。
   - transition 880ms cubic-bezier(0.18, 0.7, 0.3, 1)（先快后慢的上升）。
   - `will-change: transform, opacity` 让动画走 GPU。

**关键文件**

- `src/app/Game.ts` — imports 加 `Matrix`；`HudRefs` 接口加字段；`createHud()` 加 DOM 元素 + ref；新 `spawnDamagePop` 方法；`fire()` 命中调用。
- `src/ui/styles.css` — 新增 4 个 rule。

**风险 / 已知局限**

- 高射速 + 多敌人时同时存在的 popup 可能堆叠（zindex 没显式设置，靠插入顺序）。900ms 自清理，不会泄漏。
- `Vector3.Project` 用 `Matrix.Identity()` 作为 world matrix——只对世界空间点正确；如果以后传入 mesh-local 坐标需要传 mesh 的 worldMatrix。
- 截图工具看不到 popup（需要实际开火），但浏览器里能看到。

---

## §21 — Log Barricade Float Fix (2026-05-16, iter 21)

**问题（来自 §18 风险条）**：iter 18 把 3 根 Wood Log 中的中间那根放在 y=0.34 来"堆叠"在第一根上方。这依赖于 Wood Log.glb 在 scale=1.4 下高度 ≈ 0.3，但 GLB 实际高度未知，视角偏移大时容易看出第二根浮空。

**改了什么**

- `createOutpostProps()` 的 props 数组：
  - 删掉 y=0.34 的堆叠那根。
  - 改成 4 根全部 y=0.04 横排在 z=-10.7/-10.9，x=±3.4 / ±4.6，模拟一道矮的"原木栅栏"。
  - rotationY 略错开（1.2 / 1.35 / -1.05 / -1.2）破坏完全对称感。

**关键文件**

- `src/app/Game.ts` — `createOutpostProps()`。

**风险 / 已知局限**

- 现在所有 log 都贴地，没有真正的"堆叠"立体感。可接受，因为参考图里的沙袋/堆栈通常用专用 mesh，而不是单根重叠。
- 4 根 log 沿玩家正前方排列；在 1280×720 视角下大部分被第一人称武器遮挡，只有 turning 时露出。不影响第一观感。

---

## §20 — Back-of-Player Mountain Ridge (2026-05-16, iter 20)

**问题（来自 §15 已知局限）**：玩家把镜头转 180° 时只看到空荡的远景；山脉只在前向 arc 有放置。

**改了什么**

- `createMountainBackdrop()` 增加 3 个 mountainside.glb 在玩家身后：
  - `Vector3(-22, 0.1, -34)` scale 1.5, rotationY=`Math.PI + 0.3`
  - `Vector3(22, 0.1, -38)` scale 1.6, rotationY=`Math.PI - 0.4`
  - `Vector3(0, 0.1, -52)` scale 2.0, rotationY=`Math.PI`
- rotationY 用 `Math.PI ± offset` 让山脉的"正面"朝向玩家相机（mountainside.glb 模型有方向性，背面是平的）。

**关键文件**

- `src/app/Game.ts` — `createMountainBackdrop()`。

**验证局限**

- 回归截图只捕前向视角，看不到背后山。代码审视 + 玩家手动旋转可验证。下一轮如果想自动验证，需要在 `regression.spec.ts` 加一个"玩家旋转 180°"截图。

**风险**

- 玩家位置在 z=-14，背后山在 z=-34 到 -52；距离 20-38m。fog 密度 0.013 下能见但有雾感（合期望）。
- 若 modular_fort_01 outpost mesh 与背后山在视野里重叠，可能出现穿插；目前 outpost 在 z=-5.2 到 -10，背后山在 z=-34+，不会重叠。

---

## §19 — Mountain Banner Replacement (2026-05-16, iter 19)

**问题（来自 §15 已知局限）**：iter 15 加的 2 个 rock_face_01/02.glb 在 64 < z < 68 范围里读作"白色 banner"——它们的几何是垂直平面状的岩壁切片，雾化后变成浅色长条，看着像悬空标签。

**改了什么**

- 在 `createMountainBackdrop()` 的 placements 数组里：
  - 删掉 `rock_face_02.glb at (-18, 0.04, 64)` scale 0.95
  - 删掉 `rock_face_01.glb at (18, 0.04, 68)` scale 0.9
  - 替换成 2 个额外的 mountainside.glb at `(-22, 0.1, 92)` scale 1.5 和 `(22, 0.1, 90)` scale 1.4，作为远 ring 的密度补丁。

**关键文件**

- `src/app/Game.ts` — `createMountainBackdrop()`。

**视觉效果**

- mountainside.glb 是更自然的山体形状（带顶部起伏），雾化后是真正的山峰剪影而非平面 banner。
- 远 ring 现在有 6 个 mountainside 实例（之前 4 个），密度更接近"连绵山脉"。

**风险**

- 6 个 mountainside 都很相似；如果玩家细看会发现重复 mesh。下一轮可以试 `rock_07.glb`/`rock_09.glb` 作为山脚岩石变化。

---

## §18 — Outpost Identity Props (2026-05-16, iter 18)

**问题（来自分析 I4）**：玩家前方是一组程序化"金属橙色栏杆+三角警告牌"，占位感强，看着像示意图不像 in-world 设备。参考图 03 的哨所有木栅栏、沙袋、雷达、Gas Can 等真实道具。

**改了什么**

- `createOutpostForeground()` 几乎清空：之前 30+ 行程序化 cylinder/box，现在只剩下两侧黄色 lamp 球，作为暖光源 cue。
- 新增 `createOutpostProps()` 异步方法：
  - 6 段 `medieval-village-pack/Fence.glb` 沿 x=±2.4/±4.8/±7.2 排列在 z=-8.6（攻击线外侧），形成一面木栅栏。
  - 10 件 `survival-pack` + `medieval-village-pack` 道具放在玩家身后/两侧：Radio、Gas Can、3× Wood Log（堆叠成沙袋状）、First Aid Kit、Tent、Wooden Torch、Barrel、Crate。
- `createScene()` 注册：`void this.createOutpostProps();` 加在 `createOutpostForeground()` 之后。

**关键文件**

- `src/app/Game.ts` — `createOutpostForeground()` 精简；新增 `createOutpostProps()`；`createScene()` 调用顺序更新。
- 新增常量：`medievalKitRootUrl`、`survivalKitRootUrl`。

**风险 / 已知局限**

- 栅栏是「中世纪木栅栏」风格——与"湿热研究基地"调性不完全匹配，但和"丛林边境哨所"的木质语言一致。若你想换成沙袋/铁丝网，需要外部素材。
- Wood Log 堆叠是手摆位置，没用物理；视角偏移大时可能看出"漂浮"。
- 道具 GLB 文件名含空格（Survival pack 是 Quaternius 原始命名），TypeScript 字符串里安全，但若以后改用 fetch 拼路径需 URL-encode。

---

## §17 — Reflective Water (2026-05-16, iter 17)

**问题（来自分析 A3）**：之前的湿地是 7 个透明蓝绿色 disc，alpha 0.34，没有反射也没有动画，远看像贴的蓝色卡片。

**改了什么**

- 共享 `waterMat`（非反射池）调整：
  - 颜色 `#2e5f5d` → `#356e6a`（更鲜艳的青绿）
  - alpha 0.34 → 0.5（更实在）
  - specular `#b7d8d0×0.5` → `#cfeae3`，specularPower 96
- 新方法 `createReflectiveWaterMaterial(planeY)`：
  - 自带 `StandardMaterial`，alpha 0.7，对应更不透明
  - 创建 `MirrorTexture("water-mirror", 256, scene, true)`
  - `mirrorPlane = new Plane(0, -1, 0, planeY)` —— 水面法线朝下，distance = 池子 y
  - `renderList = null` —— 反射场景所有 mesh
  - `useReflectionFresnelFromSpecular = true` —— 视角越平射，反射越强（菲涅尔）
- 应用到 pools[3]（中段最大池，z=21.2, width=5.8, length=9.4）。其它 6 个池仍用便宜的 `waterMat`。
- `onBeforeRenderObservable` 上挂一个轻量观察者：让反射池 alpha 在 baseAlpha ± 0.04 之间正弦呼吸（0.9 Hz），制造"水在动"的暗示。

**关键文件**

- `src/app/Game.ts` — `createWetlandChannel()` 引入 reflective material 分支；新增 `createReflectiveWaterMaterial()`；imports 加 `MirrorTexture`、`Plane`。

**性能权衡**

- MirrorTexture 256×256 + renderList=null：每帧再渲染一次全场景。在 6MB 场景规模下，预算上影响有限，但若帧率出问题，第一时间把尺寸降到 128 或显式给 renderList 只塞天空+山脉。
- alpha 呼吸是一个 closure，每帧分配 0 个新对象（除 deltaTime 的隐式 number），可以忽略。

**风险**

- `useReflectionFresnelFromSpecular` 在某些 Babylon 版本上和透明 alpha 配合时会出现 z-fighting，目前没观察到。
- 若以后把场景做大到 >100 个 mesh，MirrorTexture 的 renderList=null 会显著拖慢，需要改成预筛选数组。

---

## §16 — Vegetation Variety (2026-05-16, iter 16)

**问题（来自分析 A2）**：远景树林是 34 个 procedural cylinder+sphere"棒棒糖"，单一形状、单一高度、单一颜色，一眼程序化。

**改了什么**

- `createBackdropCanopy()`：
  - 数量 34 → 18（减少 47%）
  - 间距 2.05 → 4.05（拉宽，不再像列队的电线杆）
  - 高度 3.8 + (idx%5)*0.45 → 2.6 + (idx%5)*0.3（更矮）
  - z 范围 27±7 → 38±11（推远）
  - mist sheet 颜色改成 `visualTheme.skyHorizon`（暖色，匹配地平线雾）
- 新方法 `createDistantPineRing()`：异步加载 12 个 `Pine.glb` 变体（5 种文件循环）at z=22-58，x=-50 到 +48，scale 2.4-3.4。
  - 来源：`/assets/models/quaternius/stylized-nature-megakit/`
  - 5 种 Pine 文件：`Pine.glb`、`Pine-699sFuLCN2.glb`、`Pine-79gmlLnweB.glb`、`Pine-Zt62gceKXZ.glb`、`Pine-rfnxJv0Rqa.glb`
- `createScene()` 注册：`void this.createDistantPineRing();` 在 `createBackdropCanopy()` 之后。

**关键文件**

- `src/app/Game.ts` — `createBackdropCanopy()` 缩量重写；新增 `createDistantPineRing()`；新增 `natureKitRootUrl` 常量。

**视觉效果**

- 程序化"棒棒糖"现在更矮、更稀疏，作为雾里的「灌木丛」背景。
- 真实 GLB 松树作为「主森林轮廓」，高度变化大，silhouette 不再单调。
- 二者重叠的层次给场景增加密度，参考图 02 的"湿润山谷有植被分层"感更接近了。

**风险**

- 12 个 GLB 实例会拉长首屏加载时间约 1-2 秒（每个 placeGlb 串行 await）。
- Pine 模型的样式是「卡通风格化」，与 Poly Haven 真实模型放在一起略有美术风格冲突；但都是低多边形/风格化方向，整体还算协调。

---

## §15 — Distant Mountain Ring (2026-05-16, iter 15)

**问题（来自分析 A1）**：天空空荡，远处没有山脉的体积感。iter 02 之前用过 mountainside.glb 但被否决为「巨型石板悬浮」。

**改了什么**

- `createMountainBackdrop()` 从 2 个 mountainside 扩展到 6 个 GLB placement：
  - 4× mountainside.glb，scale 1.6-2.4（之前 2.6-2.9，**更小**），z 70-96
  - 2× rock_face_01/02.glb，scale 0.9-0.95，z 64-68（中近距离 silhouette bridge）
- 关键防回退：**侧面山砍掉**。中间尝试在 x=±60 z=32-36 放过侧面山，但在 03 截图里产生了占满 30% 画面的棕色块（complete recurrence of iter02 failure）。当前版本只在 forward arc（z=64-96）放山。
- placeGlb 已经把 mesh 底部 anchor 到 y=0（通过 bounds.min.y offset），不会"悬浮"。

**关键文件**

- `src/app/Game.ts` — `createMountainBackdrop()` 改写。

**风险 / 已知局限**

- rock_face_01/02 在雾里读作「白色 banner」，不是完美的"岩壁"，但够用。
- 当前没有山脉位于侧后方，玩家把镜头转 90° 时还是会看到比较"开放"的山谷。可在 iter+1 加 2 个 z=-10 后侧山填补。

---

## §14 — Proximity Threat Vignette (2026-05-16, iter 14)

**问题（来自分析）**：玩家看不出敌人何时已经接近基地，缺乏"接下来要被打"的可读警示。参考图 03 在玩家视角边缘有红色危险标识；当前游戏只有 base 被打到时才闪红。

**改了什么**

- 在 HUD root 上新增 `<div class="threat-edge">`，挂在 `damage-flash` 后面。
- 新增 CSS `.threat-edge`：径向红色 vignette，叠加 1.4s ease-in-out 脉冲 `brightness(1.35)`。
- 默认 `opacity:0`，仅当 `#hud.threat` 时 `opacity:1`。
- `Game.ts` simulate 循环：每帧扫描 `activeEnemies` 找最近敌人 z；若 z ≤ `attackLineZ + 6`（默认 -0.5），把 `threatPulseSeconds` 设为 0.4s。
- 同帧 HUD update 把 `threatPulseSeconds > 0` 映射到 `.threat` class。

**关键文件**

- `src/ui/styles.css` — `.threat-edge` + `#hud.threat` rule + `@keyframes threat-pulse`
- `src/app/Game.ts` — `createHud()` 中插入 `<div class="threat-edge">`；simulate 循环里计算 `nearestThreatZ` 并写入 `threatPulseSeconds`；HUD update 切换 `threat` class。

**复用了已有但未使用的状态**：`threatPulseSeconds` 字段之前就存在，但从未被赋值。本次把它接上了。

**风险 / 已知副作用**

- 红色 vignette 与 `base-hit` 的 `damage-flash` 视觉上有可能叠加；目前两者颜色相近，重叠时不会冲突，但极端情况下可能稍显过曝。
- 触发阈值 `attackLineZ + 6` 是经验值；若后续修改攻击线位置（`tuning.attackLineZ`），需同步评估这个 offset。

---

## §13 — Atmosphere & Fog Tuning (2026-05-16, iter 13)

**问题（来自分析）**：天空空荡（A4），色彩过干（A5），远处低多边形植被一览无余、缺乏大气透视（F2）。

**改了什么**（仅 `src/app/config.ts` 的 `visualTheme`）

| key | before | after | 原因 |
|---|---|---|---|
| `skyTop` | `#6fa8c8` | `#3f6a8f` | 更深的天顶蓝，形成上深下浅的天空梯度 |
| `skyHorizon` | `#d2d0bd` | `#dbae7d` | 暖砂色地平线雾，匹配参考图 02 的傍晚/晨光感；同时是 fog color |
| `sun` | `#ffe7ad` | `#ffd89a` | 略深一点的太阳色，配合更暖的地平线 |
| `fogDensity` | `0.006` | `0.013` | 在 spawn 距离（z=30）形成约 18% 雾化，足以柔化远处低多边形树冠，又不影响近景识别 |
| `lightIntensity` | `1.05` | `1.12` | 补偿雾密度上升带来的整体偏暗 |

`Game.ts` 已经把这些值传给 `scene.clearColor`、`scene.fogColor`、`scene.fogDensity`、HemisphericLight；无需改代码。

**为什么这套数值**

- EXP2 雾在 distance² 上指数衰减；密度 0.013 是"近处清晰、远处朦胧"的可视化甜点。
- 暖地平线 + 冷天顶 = 大气透视的核心配方；地面元素远处偏暖、近处偏冷，无意识中读出纵深。

**风险**

- 雾密度过高会让玩家看不到远处的敌人；当前敌人 spawn 在 z=30，雾化后仍可见，但若 spawn 距离增加，需要重新评估。
- 暖色 fogColor 会让 base 红色 vignette 视觉上更不突出；目前 vignette 还很明显，但若未来减少 base 警示色，要测一下对比度。

---

## §12 — Briefing Polish (2026-05-16, iter 12)

**问题**：briefing 标题"DINO OUTPOST"质感像 default web font（I1）；玩家进入游戏后不知道有哪些按键（I7）。

**改了什么**

1. **标题阴影分层**（`.briefing h1` in styles.css）：
   - 之前：单层 `text-shadow: 0 8px 32px #000`
   - 现在：4 层叠加 — 1px 白色边缘高光 + 4px 黑色下投影 + 12px 黑色大投影 + 60px 金色辉光
   - 视觉效果：标题获得「在场景中投影」的厚度感，而不是漂浮的文字。
2. **Eyebrow 加横线 accent**（`.eyebrow::before`）：参考图常见的「label + 横线」标识，把"Jungle perimeter emergency"做成战术报告口吻。
3. **新增 control cheatsheet**（`.briefing-controls`）：在 stats 后插入 `<ul>`，列出 7 条键位（WASD / Mouse / LMB / RMB / R / 1 2 3 / Esc）。每条用 `kbd` 元素 + 描述。kbd 用 monospace、深色背景、底部内阴影，模仿真实键帽。

**关键文件**

- `src/ui/styles.css` — `.briefing h1`、`.eyebrow`、`.eyebrow::before`、`.briefing-controls`、`.briefing-controls li`、`.briefing-controls kbd`。`@media (max-width: 900px)` 里把控制列表改成 2 列。
- `src/app/Game.ts` — `createHud()` innerHTML 的 briefing 块中，在 `.briefing-stats` 之后、`.briefing-signal` 之前插入 `<ul class="briefing-controls">`。

**风险 / 取舍**

- 加键位提示意味着 briefing 内容变长；当前在 1280×720 仍能塞进左侧栏，但若以后再加内容（任务目标、奖励说明），可能需要分页或滚动。
- `kbd` 元素未做触屏适配（点击没有响应）；这是纯展示，玩家仍需用真实键盘触发。

---

## §11 — HUD Cohesion Sweep (2026-05-16, iter 11)

**问题**：左上 mission panel（白文+红条）、右上 target panel（黑底+红边角）、右下 weapon panel（裸文字无背景）三者视觉语言不统一（I2）；target panel 占近 1/4 视野（I3）。

**改了什么**（几乎全部在 `src/ui/styles.css`）

### 共享面板变量（新增到 `#hud`）

```css
--panel-bg: linear-gradient(180deg, rgba(6,10,12,0.72), rgba(6,10,12,0.42));
--panel-border: 1px solid rgba(238, 242, 242, 0.18);
--panel-radius: 2px;
--panel-shadow: inset 0 1px 0 rgba(255,255,255,0.06), 0 10px 32px rgba(0,0,0,0.32);
--panel-pad-y: 12px;
--panel-pad-x: 14px;
```

应用到 `.mission-panel`、`.target-panel`、`.weapon-panel` —— 三块面板现在共享同样的玻璃质感深色背板、内描边、阴影、圆角。

### 个体调整

- **mission-panel**：宽度 170→188，新增 2px 左侧危险色边条作为身份标识。
- **target-panel**：宽度从 250 降到 220，min-width 210→188；scope-lens 从 140px 降到 110px；右边条改为危险色 accent；激活态（`#hud.targeting`）加 24px 红色外发光。
- **weapon-panel**：从纯文字升级为带面板背景；统一 padding；字号 30→28；min-width 158 保证三行 small 不溢出。
- **mission-progress** 高度 3→2px，更细更轻。
- **compass** 字色变淡（0.78→0.6）、字号 12→11，避免抢走视线。
- **base-bar**：从纯红条改为「绿→黄→红」三段渐变，反映血量从健康到危险，宽度跟随面板。
- **minimap**：左下 30/26→24/24 对齐其他面板；尺寸 140→128；sweep 颜色从灰白改为 `--hud-good`（绿）；新增一层 1px 红色内描边作为雷达圈活动感。
- **notice**（中下临时通知）：边框/底色 token 同步面板。

### 移除了什么

- mission-panel 的纯红 count-label（看着像旧 LCD），现在用统一 0.06em letter-spacing 的小标签。
- target-panel 原来的「红渐变」过强，现在更克制。

**结果**：三块 HUD 现在感觉是同一套设计系统出的，scope-lens 视觉密度降低后中央瞄准区可读性显著提升。

**风险 / 已知局限**

- `backdrop-filter: blur(2px)` 在低端 GPU 上有性能开销；如果未来跑帧不稳，第一时间考虑去掉这个属性。
- target-panel 现在更窄，如果之后引入更长的恐龙学名/数值标签，需要重新测溢出。
- 三块面板共享 token 后，单独定制某一块需要 override 多个变量；调参时记得在面板自己的 rule 里 set 局部 token，而不是改全局。

---

## 之前的迭代（iter 01–10）

由 `docs/ITERATION_BRIEF.md` 的 History 列出概要。本文件从 iter 11 开始保留细节。

---

## 文档约定

- 每次系统级优化（多文件、多模块、或需要日后还原的关键决定），在本文件新增一个 `§NN — Title` section，**置顶**。
- 每个 section 至少包含：问题来源、改了什么、关键文件、风险/取舍。
- 一次性琐碎修复（typo、单行 CSS 调整）不必写进来，写进 `ITERATION_BRIEF.md` History 即可。
- 不要在本文件存截图或大段代码 diff；引用文件路径 + 行号即可。
