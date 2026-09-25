import type { BattleResult, GameState, Job, LogEntry, Res, ResKey, TechKey, UnitCat, UpgradeTarget } from './types';
import {
  ALL_UNITS, ATTACK_INTERVAL, BUILDINGS, CAT_BUILDING, CAT_NAME, CAT_UNITS, HOUSE_DEF, LOSE_RATE, MAX_STAR, RESIDENT_MAX_LEVEL,
  RES_INFO, RES_KEYS, SAVE_KEY, TECHS, TECH_MAX, TURRET_DEF, TURRET_UNLOCK, WIN_RATE, advanceCostPer, advanceTime, engineerCount,
  gatherRate, isBigAttack, maxHouses, popCap, randomName, recruitCost, researchCost, researchTime, residentExpNeed,
  residentTrainCost, totalCapacity, unitUnlockLevel, upgradeCostFor, upgradeTimeFor, warehouseCap, type TargetDef,
} from './config';

export const zeroRes = (): Res => ({ wood: 0, stone: 0, iron: 0, gold: 0, oil: 0 });
const emptyStars = () => [0, 0, 0, 0, 0, 0];

export function newGame(): GameState {
  return {
    version: 2,
    gameTime: 8 * 3600,
    res: { wood: 600, stone: 500, iron: 0, gold: 0, oil: 0 },
    buildings: { base: 1, power: 1, warehouse: 1, barracks: 0, factory: 0, airbase: 0, engineer: 1, lab: 0 },
    turrets: [1, 0, 0, 0],
    houses: [{ id: 1, level: 1 }, { id: 2, level: 1 }],
    residents: [
      { id: 3, name: randomName(), level: 1, exp: 0, job: 'wood' },
      { id: 4, name: randomName(), level: 1, exp: 0, job: 'stone' },
    ],
    tasks: [],
    army: {},
    trainQ: { inf: [], veh: [], air: [] },
    advQ: { inf: null, veh: null, air: null },
    tech: { atk: 0, hp: 0, speed: 0, train: 0, cost: 0, build: 0, turretAtk: 0, turretSpd: 0 },
    research: null,
    nextAttackAt: 8 * 3600 + ATTACK_INTERVAL,
    attackCount: 0,
    timeScale: 1,
    difficulty: 1,
    log: [{ id: 5, t: 8 * 3600, text: '欢迎来到家园保卫战！派遣居民采集资源，升级建筑，训练部队抵御怪物吧。', kind: 'info' }],
    stats: { wins: 0, losses: 0, kills: 0 },
    nextId: 10,
    lastSaved: Date.now(),
  };
}

export function saveGame(s: GameState) {
  s.lastSaved = Date.now();
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as GameState;
    if (!s || s.version !== 2) return null;
    return s;
  } catch {
    return null;
  }
}

export function addLog(s: GameState, text: string, kind: LogEntry['kind'] = 'info') {
  s.log.unshift({ id: s.nextId++, t: s.gameTime, text, kind });
  if (s.log.length > 150) s.log.length = 150;
}

export const cap = (s: GameState) => warehouseCap(s.buildings.warehouse);

export function canAfford(res: Res, cost: Partial<Res>): boolean {
  return RES_KEYS.every((k) => (cost[k] ?? 0) <= res[k] + 1e-9);
}
export function exceedsCap(s: GameState, cost: Partial<Res>): boolean {
  const c = cap(s);
  return RES_KEYS.some((k) => (cost[k] ?? 0) > c);
}
export function pay(res: Res, cost: Partial<Res>) {
  RES_KEYS.forEach((k) => (res[k] -= cost[k] ?? 0));
}
function mulCost(cost: Partial<Res>, n: number): Res {
  const r = zeroRes();
  RES_KEYS.forEach((k) => (r[k] = Math.ceil((cost[k] ?? 0) * n)));
  return r;
}

export function gatherRates(s: GameState): Res {
  const r = zeroRes();
  for (const p of s.residents) if (p.job !== 'idle') r[p.job] += gatherRate(s, p.job, p.level);
  return r;
}

export const isResUnlocked = (s: GameState, k: ResKey) => s.buildings.base >= RES_INFO[k].unlockBase;

export function armyStars(s: GameState, id: string): number[] {
  if (!s.army[id]) s.army[id] = emptyStars();
  return s.army[id];
}
export const unitTotal = (s: GameState, id: string) => (s.army[id] ?? []).reduce((a, b) => a + b, 0);

// ================= 目标（建筑/房屋/炮塔） =================
export function targetName(s: GameState, t: UpgradeTarget): string {
  if (t.kind === 'building') return BUILDINGS[t.key].name;
  if (t.kind === 'turret') return `炮塔${t.idx + 1}`;
  const id = t.id;
  return `房屋#${s.houses.findIndex((h) => h.id === id) + 1}`;
}

export function targetInfo(s: GameState, target: UpgradeTarget) {
  let def: TargetDef;
  let level: number;
  let unlockBase: number;
  let extraMul = 1;
  if (target.kind === 'building') {
    def = BUILDINGS[target.key];
    level = s.buildings[target.key];
    unlockBase = def.unlockBase;
  } else if (target.kind === 'turret') {
    def = TURRET_DEF;
    level = s.turrets[target.idx];
    unlockBase = TURRET_UNLOCK[target.idx];
  } else {
    def = HOUSE_DEF;
    const id = target.id;
    const idx = s.houses.findIndex((h) => h.id === id);
    level = s.houses[idx]?.level ?? 0;
    unlockBase = 1;
    if (level === 0) extraMul = 1 + idx * 0.8;
  }
  const maxByBase = target.kind === 'building' && target.key === 'base' ? def.max : Math.min(def.max, s.buildings.base);
  const T = level + 1;
  return {
    def, name: def.name, level, max: def.max, maxByBase, unlockBase,
    cost: upgradeCostFor(def, T, s.tech.cost, extraMul),
    time: upgradeTimeFor(def, T, s.tech.build),
  };
}

export function sameTarget(a: UpgradeTarget, b: UpgradeTarget) {
  if (a.kind === 'building' && b.kind === 'building') return a.key === b.key;
  if (a.kind === 'house' && b.kind === 'house') return a.id === b.id;
  if (a.kind === 'turret' && b.kind === 'turret') return a.idx === b.idx;
  return false;
}
export const findTask = (s: GameState, t: UpgradeTarget) => s.tasks.find((x) => sameTarget(x.target, t));

export function upgradeBlock(s: GameState, target: UpgradeTarget): string | null {
  const info = targetInfo(s, target);
  if (findTask(s, target)) return '正在升级中';
  if (s.buildings.base < info.unlockBase) return `需要主基地 ${info.unlockBase} 级解锁`;
  if (info.level >= info.max) return '已达到满级';
  if (info.level >= info.maxByBase) return '需先升级主基地';
  if (s.tasks.length >= engineerCount(s.buildings.engineer)) return '没有空闲的工程师';
  if (exceedsCap(s, info.cost)) return '仓库容量不足，请升级仓库';
  if (!canAfford(s.res, info.cost)) return '资源不足';
  return null;
}

export function startUpgrade(s: GameState, target: UpgradeTarget): string | void {
  const b = upgradeBlock(s, target);
  if (b) return b;
  const info = targetInfo(s, target);
  pay(s.res, info.cost);
  s.tasks.push({ id: s.nextId++, target, remaining: info.time, total: info.time, toLevel: info.level + 1 });
}

export function newHouseInfo(s: GameState) {
  const idx = s.houses.length;
  return {
    cost: upgradeCostFor(HOUSE_DEF, 1, s.tech.cost, 1 + idx * 0.8),
    time: upgradeTimeFor(HOUSE_DEF, 1, s.tech.build),
  };
}

export function buildHouse(s: GameState): string | void {
  if (s.houses.length >= maxHouses(s.buildings.base)) return '房屋数量已达上限，升级主基地可建造更多';
  if (s.tasks.length >= engineerCount(s.buildings.engineer)) return '没有空闲的工程师';
  const { cost, time } = newHouseInfo(s);
  if (!canAfford(s.res, cost)) return '资源不足';
  pay(s.res, cost);
  const h = { id: s.nextId++, level: 0 };
  s.houses.push(h);
  s.tasks.push({ id: s.nextId++, target: { kind: 'house', id: h.id }, remaining: time, total: time, toLevel: 1 });
}

export const speedUpCost = (remaining: number) => Math.ceil(remaining * 0.4);

// ================= 时间推进 =================
export function tick(s: GameState, dt: number) {
  if (dt <= 0) return;
  s.gameTime += dt;
  const c = cap(s);
  const rates = gatherRates(s);
  RES_KEYS.forEach((k) => {
    if (s.res[k] < c) s.res[k] = Math.min(c, s.res[k] + rates[k] * dt);
  });

  // 居民经验：采集量 ÷ 基础速率
  for (const p of s.residents) {
    if (p.job === 'idle' || p.level >= RESIDENT_MAX_LEVEL) continue;
    p.exp += (gatherRate(s, p.job, p.level) / RES_INFO[p.job].rate) * dt;
    while (p.level < RESIDENT_MAX_LEVEL && p.exp >= residentExpNeed(p.level)) {
      p.exp -= residentExpNeed(p.level);
      p.level++;
      addLog(s, `居民 ${p.name} 升到了 ${p.level} 级，采集速度 +${p.level - 1}%`, 'good');
    }
    if (p.level >= RESIDENT_MAX_LEVEL) p.exp = 0;
  }

  // 建造
  for (const t of s.tasks) t.remaining -= dt;
  const done = s.tasks.filter((t) => t.remaining <= 0);
  if (done.length) {
    s.tasks = s.tasks.filter((t) => t.remaining > 0);
    for (const t of done) {
      const tg = t.target;
      if (tg.kind === 'building') s.buildings[tg.key] = t.toLevel;
      else if (tg.kind === 'turret') s.turrets[tg.idx] = t.toLevel;
      else {
        const h = s.houses.find((x) => x.id === tg.id);
        if (h) h.level = t.toLevel;
      }
      const tierUp = t.toLevel % 10 === 0 ? '（外形进化！）' : '';
      addLog(s, t.toLevel === 1 && tg.kind === 'house' ? '新的居民房屋建造完成！' : `${targetName(s, tg)} 升级到 ${t.toLevel} 级${tierUp}`, 'good');
    }
  }

  // 生产 & 进阶
  (['inf', 'veh', 'air'] as UnitCat[]).forEach((cat) => {
    let left = dt;
    const q = s.trainQ[cat];
    while (q.length && left > 0) {
      const t = q[0];
      const use = Math.min(left, t.remaining);
      t.remaining -= use;
      left -= use;
      if (t.remaining <= 1e-6) {
        q.shift();
        armyStars(s, t.unit)[0] += t.count;
        addLog(s, `${ALL_UNITS[t.unit].name} ×${t.count} 训练完成`, 'good');
      }
    }
    const a = s.advQ[cat];
    if (a) {
      a.remaining -= dt;
      if (a.remaining <= 0) {
        const arr = armyStars(s, a.unit);
        const n = Math.min(a.count, arr[a.fromStar]);
        arr[a.fromStar] -= n;
        arr[a.fromStar + 1] += n;
        s.advQ[cat] = null;
        addLog(s, `${ALL_UNITS[a.unit].name} ×${n} 进阶到 ${'★'.repeat(a.fromStar + 1)}`, 'good');
      }
    }
  });

  // 研究
  if (s.research) {
    s.research.remaining -= dt;
    if (s.research.remaining <= 0) {
      const r = s.research;
      s.tech[r.tech] = r.toLevel;
      s.research = null;
      addLog(s, `科技【${TECHS.find((t) => t.key === r.tech)!.name}】研发到 ${r.toLevel} 级`, 'good');
    }
  }
}

export function speedUpTask(s: GameState, kind: 'build' | 'train' | 'adv' | 'research', id: number | UnitCat): string | void {
  let remaining = 0;
  if (kind === 'build') remaining = s.tasks.find((t) => t.id === id)?.remaining ?? 0;
  else if (kind === 'train') remaining = s.trainQ[id as UnitCat][0]?.remaining ?? 0;
  else if (kind === 'adv') remaining = s.advQ[id as UnitCat]?.remaining ?? 0;
  else remaining = s.research?.remaining ?? 0;
  if (remaining <= 0) return;
  const g = speedUpCost(remaining);
  if (s.res.gold < g) return `需要 ${g} 金矿`;
  s.res.gold -= g;
  if (kind === 'build') s.tasks.find((t) => t.id === id)!.remaining = 0.0001;
  else if (kind === 'train') s.trainQ[id as UnitCat][0].remaining = 0.0001;
  else if (kind === 'adv') s.advQ[id as UnitCat]!.remaining = 0.0001;
  else s.research!.remaining = 0.0001;
  const gt = s.gameTime;
  tick(s, 0.0002);
  s.gameTime = gt;
}

// ================= 居民 =================
export function recruit(s: GameState): string | void {
  if (s.residents.length >= totalCapacity(s)) return '房屋空间不足，请建造或升级居民房屋';
  const cost = recruitCost(s.residents.length);
  if (!canAfford(s.res, cost)) return '资源不足';
  pay(s.res, cost);
  const p = { id: s.nextId++, name: randomName(), level: 1, exp: 0, job: 'idle' as Job };
  s.residents.push(p);
  addLog(s, `新居民 ${p.name} 搬进了家园`, 'good');
}

export function setJob(s: GameState, id: number, job: Job): string | void {
  if (job !== 'idle' && !isResUnlocked(s, job)) return `需要主基地 ${RES_INFO[job].unlockBase} 级才能开采${RES_INFO[job].name}`;
  const p = s.residents.find((x) => x.id === id);
  if (p) p.job = job;
}

export function assignOne(s: GameState, job: ResKey): string | void {
  if (!isResUnlocked(s, job)) return `需要主基地 ${RES_INFO[job].unlockBase} 级才能开采${RES_INFO[job].name}`;
  const idle = s.residents.filter((p) => p.job === 'idle').sort((a, b) => b.level - a.level)[0];
  if (!idle) return '没有空闲的居民';
  idle.job = job;
}

export function unassignOne(s: GameState, job: ResKey): string | void {
  const w = s.residents.filter((p) => p.job === job).sort((a, b) => a.level - b.level)[0];
  if (!w) return '该资源点没有居民';
  w.job = 'idle';
}

export function trainResident(s: GameState, id: number): string | void {
  const p = s.residents.find((x) => x.id === id);
  if (!p) return;
  if (p.level >= RESIDENT_MAX_LEVEL) return '已满级';
  if (s.buildings.base < RES_INFO.gold.unlockBase) return '需要主基地 6 级（解锁金矿）才能培训';
  const cost = residentTrainCost(p.level);
  if (!canAfford(s.res, cost)) return '金矿不足';
  pay(s.res, cost);
  p.level++;
  p.exp = 0;
  addLog(s, `居民 ${p.name} 培训后升到 ${p.level} 级`, 'good');
}

// ================= 军队 =================
export function armyPop(s: GameState, cat: UnitCat, includeQueue = true) {
  let n = 0;
  for (const u of CAT_UNITS[cat]) n += unitTotal(s, u.id) * u.pop;
  if (includeQueue) for (const t of s.trainQ[cat]) n += t.count * ALL_UNITS[t.unit].pop;
  return n;
}

export function unitAvailable(s: GameState, id: string): boolean {
  const u = ALL_UNITS[id];
  const list = CAT_UNITS[u.cat];
  return s.buildings[CAT_BUILDING[u.cat]] >= unitUnlockLevel(list.findIndex((x) => x.id === id));
}

export const trainTimePer = (s: GameState, id: string) => Math.max(1, ALL_UNITS[id].time * (1 - 0.03 * s.tech.train));

export function trainUnit(s: GameState, id: string, count: number): string | void {
  const u = ALL_UNITS[id];
  if (!unitAvailable(s, id)) return '兵种尚未解锁';
  if (s.trainQ[u.cat].length >= 5) return '生产队列已满（最多 5 批）';
  const capP = popCap(u.cat, s.buildings[CAT_BUILDING[u.cat]]);
  const n = Math.min(count, Math.floor((capP - armyPop(s, u.cat)) / u.pop));
  if (n <= 0) return '部队编制已满';
  const cost = mulCost(u.cost, n);
  if (!canAfford(s.res, cost)) return '资源不足';
  pay(s.res, cost);
  const total = trainTimePer(s, id) * n;
  s.trainQ[u.cat].push({ id: s.nextId++, unit: id, count: n, remaining: total, total });
}

export function cancelTrain(s: GameState, cat: UnitCat, taskId: number) {
  const q = s.trainQ[cat];
  const i = q.findIndex((t) => t.id === taskId);
  if (i < 0) return;
  const t = q[i];
  const refund = mulCost(ALL_UNITS[t.unit].cost, t.count * 0.8);
  RES_KEYS.forEach((k) => (s.res[k] += refund[k]));
  q.splice(i, 1);
}

export function dismissUnit(s: GameState, id: string, star: number) {
  const arr = armyStars(s, id);
  if (arr[star] > 0) arr[star]--;
}

export function advanceInfo(id: string, fromStar: number, count: number) {
  const u = ALL_UNITS[id];
  return { cost: mulCost(advanceCostPer(u, fromStar + 1), count), time: advanceTime(u.cat, fromStar + 1) };
}

export function startAdvance(s: GameState, id: string, fromStar: number, count: number): string | void {
  const u = ALL_UNITS[id];
  if (fromStar >= MAX_STAR) return '已达最高 5 阶';
  if (s.advQ[u.cat]) return `${CAT_NAME[u.cat]}进阶槽正在使用中`;
  const have = armyStars(s, id)[fromStar];
  if (count <= 0 || have < count) return '单位数量不足';
  const { cost, time } = advanceInfo(id, fromStar, count);
  if (!canAfford(s.res, cost)) return '资源不足';
  pay(s.res, cost);
  s.advQ[u.cat] = { id: s.nextId++, unit: id, fromStar, count, remaining: time, total: time };
}

// ================= 科技 =================
export const techCap = (s: GameState) => Math.min(TECH_MAX, Math.floor(s.buildings.lab / 2));

export function researchBlock(s: GameState, key: TechKey): string | null {
  const t = TECHS.find((x) => x.key === key)!;
  const lvl = s.tech[key];
  if (s.buildings.lab <= 0) return '需要建造作战实验室';
  if (s.research) return '实验室正在研发中';
  if (lvl >= TECH_MAX) return '已满级';
  if (lvl >= techCap(s)) return `需实验室 ${(lvl + 1) * 2} 级`;
  const c = researchCost(t, lvl + 1);
  if (exceedsCap(s, c)) return '仓库容量不足';
  if (!canAfford(s.res, c)) return '资源不足';
  return null;
}

export function startResearch(s: GameState, key: TechKey): string | void {
  const b = researchBlock(s, key);
  if (b) return b;
  const t = TECHS.find((x) => x.key === key)!;
  const lvl = s.tech[key];
  pay(s.res, researchCost(t, lvl + 1));
  const time = researchTime(lvl + 1);
  s.research = { tech: key, toLevel: lvl + 1, remaining: time, total: time };
}

// ================= 战斗结算 =================
export function applyBattle(s: GameState, r: BattleResult) {
  s.army = r.survivors;
  const c = cap(s);
  RES_KEYS.forEach((k) => {
    s.res[k] = Math.max(0, Math.min(Math.max(c, s.res[k]), s.res[k] + r.resDelta[k]));
  });
  s.stats.kills += r.kills;
  if (r.victory) s.stats.wins++;
  else s.stats.losses++;
  const lostN = Object.values(r.lost).reduce((a, b) => a + b, 0);
  addLog(
    s,
    `第 ${r.n} 次${r.big ? '大' : ''}防守${r.victory ? '胜利' : '失败'}！击杀 ${r.kills} 只怪物，损失 ${lostN} 个单位，资源${r.victory ? '+6%' : '-5%'}${r.auto ? '（自动结算）' : ''}`,
    r.victory ? 'battle' : 'bad',
  );
  s.attackCount = r.n;
  s.nextAttackAt += ATTACK_INTERVAL;
}

export function computeResDelta(s: GameState, victory: boolean): Res {
  const d = zeroRes();
  RES_KEYS.forEach((k) => (d[k] = Math.floor(s.res[k] * (victory ? WIN_RATE : -LOSE_RATE))));
  return d;
}

export function nextAttackInfo(s: GameState) {
  const n = s.attackCount + 1;
  return { n, big: isBigAttack(n), remaining: Math.max(0, s.nextAttackAt - s.gameTime) };
}
