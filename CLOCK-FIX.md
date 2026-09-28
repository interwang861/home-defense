# 时间修改补丁（只涉及 3 个文件）

需求：流速不影响时钟。开启 3600x 时，顶部日期钟点仍按真实时间走，进攻日程也不提前。

依赖：`src/game/config.ts` 里的 `realGameSeconds()` 和 `src/game/types.ts` 里的 `clockOffset?: number`
（上一轮「时钟对齐真实时间」时已加入，这里不再重复）。

---

## 1. `src/game/logic.ts` —— 核心改动

### 1.1 `tick()`（约 191~202 行）

原来会把加速档位多跑的时间累加进 `clockOffset`，导致时钟跟着变快。

```diff
- /**
-  * 时钟跟随真实时间推进（+ 加速档位额外推快的部分），生产则按 dt 结算。
-  * realDt 是真实经过的秒数；1x 下 dt === realDt，时钟偏移量恒为 0，
-  * 因此所有设备在同一时刻显示的日期钟点完全一致。
-  */
- export function tick(s: GameState, dt: number, realDt = dt) {
-   if (dt <= 0) return;
-   s.clockOffset = (s.clockOffset ?? 0) + Math.max(0, dt - realDt);
-   const t = realGameSeconds() + s.clockOffset;
-   if (t > s.gameTime) s.gameTime = t;
-   tickProduction(s, dt);
- }
+ /**
+  * 时钟只跟随真实时间，加速档位只加快产出与建造，不影响日期钟点和进攻日程。
+  * dt 是「产出用的时间」（= 真实秒数 × 流速），时钟则始终取真实时间。
+  */
+ export function tick(s: GameState, dt: number) {
+   if (dt <= 0) return;
+   const t = realGameSeconds() + (s.clockOffset ?? 0);
+   // 只往前不回退：设备时钟被改小时不会让游戏时间倒流
+   if (t > s.gameTime) s.gameTime = t;
+   tickProduction(s, dt);
+ }
```

要点：删掉 `realDt` 参数和 `clockOffset` 的累加。`clockOffset` 字段保留但恒为 0，只为兼容旧存档。

---

## 2. `src/App.tsx`

### 2.1 主循环（约 118~122 行）

```diff
       if (phaseRef.current === 'idle') {
-        const dt = real * g.timeScale;
-        const toAtk = g.nextAttackAt - g.gameTime;
-        if (dt >= toAtk) {
-          tick(g, Math.max(0, toAtk));
-          changePhase('alert');
-        } else {
-          tick(g, dt);
-        }
+        // 流速只放大产出用的 dt，时钟仍按真实时间走
+        tick(g, real * g.timeScale);
+        if (g.gameTime >= g.nextAttackAt) changePhase('alert');
       }
```

### 2.2 读档迁移（约 64~75 行）

把历史遗留的偏移量清零；时钟若已被推到真实时间之后就拉回来。

```diff
     if (loaded) {
       if (!SCALES.includes(loaded.timeScale)) loaded.timeScale = 1;
-      // 老存档：时钟是各设备自行累加的，这里统一对齐到真实时间
-      if (loaded.clockOffset === undefined) {
-        loaded.clockOffset = 0;
-        loaded.gameTime = realGameSeconds();
-        scheduleNextAttack(loaded);
-      }
-      if (loaded.nextIsBig === undefined) scheduleNextAttack(loaded);
+      // 流速不再推动时钟：把历史遗留的偏移量清零，
+      // 时钟若已被推到真实时间之前就拉回来，各设备显示才会一致
+      loaded.clockOffset = 0;
+      const rt = realGameSeconds();
+      if (loaded.gameTime > rt || loaded.nextIsBig === undefined) {
+        loaded.gameTime = Math.min(loaded.gameTime, rt);
+        scheduleNextAttack(loaded);
+      }
       offlineRef.current = processOffline(loaded);
       gsRef.current = loaded;
```

注意顺序：必须在 `processOffline(loaded)` **之前**执行，否则离线补算会因为时钟已被拉平而算不出间隔。

---

## 3. `src/components/TopBar.tsx`

纯文案，避免界面继续声称「流速会推动时钟」。

### 3.1 时钟那一行（约 31~41 行）

```diff
             <div
               className="flex items-center gap-1.5 text-[11px] text-slate-400"
-              title="时钟跟随本机真实时间，所有设备同一时刻显示一致。加速档位会把时钟额外往前推。"
+              title="时钟跟随本机真实时间，所有设备同一时刻显示一致，加速档位不会影响它"
             >
```

### 3.2 加速控件（约 79~85 行）

```diff
           <div
             className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/80 p-1"
-            title="1x 与时钟同步。调高会同时加快产出并把游戏时钟往前推，进攻也会提前到来"
+            title="只加快采集、建造、训练与研发的进度，不影响时钟，也不会让进攻提前"
           >
-            <span className="px-1 text-[10px] text-slate-400">流速</span>
+            <span className="px-1 text-[10px] text-slate-400">加速</span>
```

### 3.3 底部玩法提示（`src/App.tsx`，约 211 行）

```diff
-            胜利获得当前资源 6%，失败损失 5%。右上角可调整时间流速快速体验。
+            胜利获得当前资源 6%，失败损失 5%。右上角的加速档位只加快采集与建造，时钟和进攻日程始终跟随真实时间。
```

---

## 验证

改完后开 3600x：

- 资源、建造队列、训练、研发飞速推进
- 顶部「第 N 天 周X HH:MM」仍按真实时间一秒一秒走
- 进攻仍在真实的中午 12:10 / 周日 20:00 到来

`npm run build` 通过，产物 `dist/index.html` 约 405 KB。
