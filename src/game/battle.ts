import type { Army, BattleResult, BuildingKey, GameState, UnitCat } from './types';
import {
  ALL_UNITS, BIG_DURATION, CAT_BUILDING, MONSTERS, NORMAL_DURATION, baseStats, buildingHp, isBigAttack, monsterMultipliers,
  monsterUnlockedCount, tierOf, turretStats, unitStats, BUILDINGS,
} from './config';
import { computeResDelta } from './logic';
import { buildingSprite } from './sprites';

export const WW = 1400;
export const WH = 900;
export const CX = 700;
export const CY = 430;
const MAX_ENEMIES = 80;

export const LAYOUT: Record<BuildingKey, [number, number, number]> = {
  base: [700, 430, 150],
  engineer: [700, 170, 88],
  power: [445, 215, 98],
  warehouse: [955, 215, 98],
  barracks: [380, 455, 108],
  factory: [1020, 455, 108],
  airbase: [545, 705, 112],
  lab: [855, 705, 98],
};
export const TURRET_POS: [number, number][] = [[570, 318], [830, 318], [570, 560], [830, 560]];

export interface BGun {
  atk: number;
  cd: number;
  cdLeft: number;
  range: number;
  splash: number;
  kind: string;
  shot: string;
  angle: number;
  fired: number;
  px: number;
  py: number;
  tier: number;
}

export interface BBuilding {
  id: string;
  key: BuildingKey | 'turret';
  name: string;
  level: number;
  sprite: string;
  x: number;
  y: number;
  size: number;
  r: number;
  hp: number;
  maxHp: number;
  hit: number;
  gun?: BGun;
}

export interface BEnt {
  id: number;
  side: 'ally' | 'enemy';
  type: string;
  cat: UnitCat | 'monster';
  air: boolean;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  atk: number;
  range: number;
  cd: number;
  cdLeft: number;
  speed: number;
  splash: number;
  hitsAir: boolean;
  size: number;
  rx: number;
  ry: number;
  slot: number;
  boss: boolean;
  hit: number;
  phase: number;
  shot: string;
  beam: boolean;
  star: number;
  alt: number;
  dir: number;
  atkAnim: number;
  out: boolean;
  releaseAt: number;
  ox: number;
  oy: number;
}

export interface BFx {
  id: number;
  kind: 'proj' | 'beam' | 'boom' | 'slash' | 'muzzle';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  t: number;
  max: number;
  color: string;
  r: number;
  big?: boolean;
}

export interface BattleState {
  time: number;
  duration: number;
  n: number;
  big: boolean;
  buildings: BBuilding[];
  ents: BEnt[];
  fx: BFx[];
  nextId: number;
  budget: number;
  nextType: number;
  nextBossAt: number;
  over: boolean;
  victory: boolean;
  kills: number;
  lost: Record<string, number>;
  unlocked: number;
  hpMul: number;
  atkMul: number;
  repairCdLeft: number;
  baseLevel: number;
  groundCount: number;
  airCount: number;
  events: { id: number; text: string; t: number }[];
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

function pickType(b: BattleState): number {
  let total = 0;
  for (let i = 0; i < b.unlocked; i++) total += i + 1;
  let r = Math.random() * total;
  for (let i = 0; i < b.unlocked; i++) {
    r -= i + 1;
    if (r <= 0) return i;
  }
  return b.unlocked - 1;
}

function event(b: BattleState, text: string) {
  b.events.push({ id: b.nextId++, text, t: b.time });
  if (b.events.length > 4) b.events.shift();
}

export function createBattle(gs: GameState): BattleState {
  const n = gs.attackCount + 1;
  const big = isBigAttack(n);
  const mul = monsterMultipliers(n, gs.buildings.base);
  const b: BattleState = {
    time: 0, duration: big ? BIG_DURATION : NORMAL_DURATION, n, big,
    buildings: [], ents: [], fx: [], nextId: 1, budget: 4, nextType: 0,
    nextBossAt: big ? 150 : n >= 5 ? 200 : 1e9,
    over: false, victory: false, kills: 0, lost: {},
    unlocked: monsterUnlockedCount(n, big), hpMul: mul.hp, atkMul: mul.atk,
    repairCdLeft: 0, baseLevel: gs.buildings.base, groundCount: 0, airCount: 0, events: [],
  };
  b.nextType = pickType(b);

  // 建筑
  (Object.keys(LAYOUT) as BuildingKey[]).forEach((key) => {
    const lvl = gs.buildings[key];
    if (lvl <= 0) return;
    const [x, y, size] = LAYOUT[key];
    const hp = key === 'base' ? baseStats(lvl).hp : buildingHp(lvl);
    const bd: BBuilding = {
      id: key, key, name: BUILDINGS[key].name, level: lvl, sprite: buildingSprite(key, lvl), x, y, size, r: size * 0.36, hp, maxHp: hp, hit: 0,
    };
    if (key === 'base') {
      const bs = baseStats(lvl, gs.tech.turretAtk, gs.tech.turretSpd);
      bd.gun = { atk: bs.atk, cd: bs.cd, cdLeft: 0, range: bs.range, splash: 0, kind: 'shell', shot: '#fde047', angle: 0, fired: 0, px: x, py: y - size * 0.62, tier: 0 };
    }
    b.buildings.push(bd);
  });
  gs.turrets.forEach((lvl, i) => {
    if (lvl <= 0) return;
    const [x, y] = TURRET_POS[i];
    const st = turretStats(lvl, gs.tech.turretAtk, gs.tech.turretSpd);
    const t = tierOf(lvl);
    b.buildings.push({
      id: `turret${i}`, key: 'turret', name: `炮塔${i + 1}`, level: lvl, sprite: `turret_base_t${t}`, x, y, size: 70, r: 24, hp: st.hp, maxHp: st.hp, hit: 0,
      gun: { atk: st.atk, cd: st.cd, cdLeft: Math.random() * st.cd, range: st.range, splash: st.splash, kind: st.tier.kind, shot: st.tier.shot, angle: Math.atan2(y - CY, x - CX), fired: 0, px: x, py: y - 22, tier: t },
    });
  });

  // 部队：从各自的建筑中依次出发
  const releaseTimer: Record<string, number> = {};
  const units: { id: string; star: number }[] = [];
  for (const [id, arr] of Object.entries(gs.army)) {
    if (!ALL_UNITS[id]) continue;
    arr.forEach((c, star) => {
      for (let i = 0; i < c; i++) units.push({ id, star });
    });
  }
  units.sort((a, c) => ALL_UNITS[c.id].range - ALL_UNITS[a.id].range);
  for (const { id, star } of units) {
    const u = ALL_UNITS[id];
    const st = unitStats(gs, id, star);
    const bKey = CAT_BUILDING[u.cat];
    const [bx, by, bs] = gs.buildings[bKey] > 0 ? LAYOUT[bKey] : LAYOUT.base;
    releaseTimer[bKey] = (releaseTimer[bKey] ?? 0.3) + (u.air ? 0.35 : 0.22);
    const slot = u.air ? b.airCount++ : b.groundCount++;
    b.ents.push({
      id: b.nextId++, side: 'ally', type: id, cat: u.cat, air: u.air,
      x: bx + rand(-8, 8), y: by + bs * 0.18, hp: st.hp, maxHp: st.hp, atk: st.atk, range: u.range, cd: st.cd, cdLeft: Math.random() * st.cd,
      speed: st.speed, splash: u.splash, hitsAir: true, size: u.size, rx: bx, ry: by, slot, boss: false, hit: 0, phase: Math.random() * 6,
      shot: u.shot, beam: !!u.beam, star, alt: 0, dir: 1, atkAnim: 0, out: false, releaseAt: releaseTimer[bKey], ox: rand(-14, 14), oy: rand(-14, 14),
    });
  }
  event(b, big ? '☠ 大防守开始！怪物将持续进攻 30 分钟' : '⚔ 怪物从四面八方来袭！');
  return b;
}

function rallyPoint(b: BattleState, e: BEnt): [number, number] {
  if (e.air) {
    const ring = Math.floor(e.slot / 14);
    const a = (e.slot % 14) / 14 * Math.PI * 2 + ring * 0.2 + b.time * 0.25;
    const r = 150 + ring * 45;
    return [CX + Math.cos(a) * r, CY + Math.sin(a) * r * 0.75];
  }
  const ring = Math.floor(e.slot / 22);
  const a = (e.slot % 22) / 22 * Math.PI * 2 + ring * 0.14;
  const r = 205 + ring * 38;
  return [CX + Math.cos(a) * r * 1.25, CY + Math.sin(a) * r * 0.95];
}

function spawnMonster(b: BattleState, typeIdx: number, boss = false) {
  const m = MONSTERS[typeIdx];
  const hpK = b.hpMul * (boss ? (b.big ? 8 : 4) : 1);
  const atkK = b.atkMul * (boss ? 2 : 1);
  const edge = Math.floor(Math.random() * 4);
  let x = 0;
  let y = 0;
  if (edge === 0) [x, y] = [rand(0, WW), -30];
  else if (edge === 1) [x, y] = [rand(0, WW), WH + 30];
  else if (edge === 2) [x, y] = [-30, rand(0, WH)];
  else [x, y] = [WW + 30, rand(0, WH)];
  b.ents.push({
    id: b.nextId++, side: 'enemy', type: m.id, cat: 'monster', air: false, x, y,
    hp: m.hp * hpK, maxHp: m.hp * hpK, atk: m.atk * atkK, range: m.range, cd: m.cd, cdLeft: m.cd,
    speed: m.speed * rand(0.9, 1.1), splash: m.splash, hitsAir: m.hitsAir, size: m.size * (boss ? 1.6 : 1),
    rx: 0, ry: 0, slot: 0, boss, hit: 0, phase: Math.random() * 6, shot: m.shot, beam: !!m.beam, star: 0, alt: 0,
    dir: x < CX ? 1 : -1, atkAnim: 0, out: true, releaseAt: 0, ox: rand(-18, 18), oy: rand(-18, 18),
  });
  if (boss) event(b, `👑 首领【${m.name}】出现了！`);
}

const d2 = (ax: number, ay: number, bx: number, by: number) => {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
};

function addFx(b: BattleState, render: boolean, fx: Omit<BFx, 'id'>) {
  if (!render || b.fx.length > 260) return;
  b.fx.push({ ...fx, id: b.nextId++ });
}

function shoot(b: BattleState, render: boolean, x1: number, y1: number, x2: number, y2: number, color: string, beam: boolean, splash: number, big = false) {
  if (!render) return;
  if (beam) {
    addFx(b, render, { kind: 'beam', x1, y1, x2, y2, t: 0, max: 0.18, color, r: big ? 8 : 5 });
    if (splash > 0) addFx(b, render, { kind: 'boom', x1: x2, y1: y2, x2: 0, y2: 0, t: 0, max: 0.3, color, r: splash });
    return;
  }
  const dist = d2(x1, y1, x2, y2);
  const tt = Math.max(0.06, Math.min(0.45, dist / 900));
  addFx(b, render, { kind: 'proj', x1, y1, x2, y2, t: 0, max: tt, color, r: big ? 5 : splash > 0 ? 4 : 2.5, big });
  if (splash > 0) addFx(b, render, { kind: 'boom', x1: x2, y1: y2, x2: 0, y2: 0, t: -tt, max: 0.35, color, r: splash });
}

function hitEnt(b: BattleState, atk: number, splash: number, side: 'ally' | 'enemy', target: BEnt) {
  if (splash > 0) {
    for (const e of b.ents) {
      if (e.side !== side || e.hp <= 0 || !e.out || e.air !== target.air) continue;
      if (d2(e.x, e.y, target.x, target.y) <= splash) {
        e.hp -= e === target ? atk : atk * 0.6;
        e.hit = 0.12;
      }
    }
  } else {
    target.hp -= atk;
    target.hit = 0.12;
  }
}

export function stepBattle(b: BattleState, dt: number, render = true) {
  if (b.over) return;
  b.time += dt;
  b.repairCdLeft = Math.max(0, b.repairCdLeft - dt);

  // ---------- 刷怪（四面八方） ----------
  const progress = Math.min(1, b.time / b.duration);
  const rate = (0.4 + 0.15 * Math.sqrt(b.n) + 0.03 * b.baseLevel) * (1 + 0.8 * progress) * (b.big ? 1.3 : 1);
  b.budget = Math.min(800, b.budget + rate * dt);
  let enemyCount = 0;
  for (const e of b.ents) if (e.side === 'enemy') enemyCount++;
  while (enemyCount < MAX_ENEMIES && b.budget >= MONSTERS[b.nextType].cost && b.time < b.duration - 5) {
    b.budget -= MONSTERS[b.nextType].cost;
    spawnMonster(b, b.nextType);
    enemyCount++;
    b.nextType = pickType(b);
  }
  if (b.time >= b.nextBossAt) {
    spawnMonster(b, b.unlocked - 1, true);
    b.nextBossAt += b.big ? 300 : 1e9;
  }

  const allies = b.ents.filter((e) => e.side === 'ally' && e.hp > 0 && e.out);
  const enemies = b.ents.filter((e) => e.side === 'enemy' && e.hp > 0);
  const blds = b.buildings.filter((x) => x.hp > 0);

  // ---------- 炮塔 & 主炮 ----------
  for (const bd of blds) {
    bd.hit = Math.max(0, bd.hit - dt);
    const g = bd.gun;
    if (!g) continue;
    g.fired = Math.max(0, g.fired - dt);
    g.cdLeft -= dt;
    let best: BEnt | null = null;
    let bdist = 1e9;
    for (const e of enemies) {
      if (e.hp <= 0) continue;
      const d = d2(e.x, e.y, g.px, g.py + 22);
      if (d < g.range && d < bdist) {
        bdist = d;
        best = e;
      }
    }
    if (best) {
      const want = Math.atan2(best.y - best.size * 0.4 - g.py, best.x - g.px);
      let diff = want - g.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const turn = 9 * dt;
      g.angle += Math.abs(diff) < turn ? diff : Math.sign(diff) * turn;
      if (g.cdLeft <= 0 && Math.abs(diff) < 0.5) {
        g.cdLeft = g.cd;
        g.fired = 0.12;
        hitEnt(b, g.atk, g.splash, 'enemy', best);
        const mx = g.px + Math.cos(g.angle) * (bd.key === 'turret' ? 26 : 0);
        const my = g.py + Math.sin(g.angle) * (bd.key === 'turret' ? 26 : 0);
        shoot(b, render, mx, my, best.x, best.y - best.size * 0.4, g.shot, g.kind === 'laser', g.splash, g.kind === 'missile');
        if (render && bd.key === 'turret') addFx(b, render, { kind: 'muzzle', x1: mx, y1: my, x2: 0, y2: 0, t: 0, max: 0.08, color: g.shot, r: 8 + g.tier * 2 });
      }
    }
  }

  // ---------- 我方单位 ----------
  for (const e of b.ents) {
    if (e.side !== 'ally' || e.hp <= 0) continue;
    if (!e.out) {
      if (b.time >= e.releaseAt) e.out = true;
      else continue;
    }
    e.hit = Math.max(0, e.hit - dt);
    e.atkAnim = Math.max(0, e.atkAnim - dt);
    e.cdLeft -= dt;
    e.phase += dt * 4;
    if (e.air) e.alt = Math.min(1, e.alt + dt * 0.7);
    const [rx, ry] = rallyPoint(b, e);
    e.rx = rx;
    e.ry = ry;
    let target: BEnt | null = null;
    let td = 1e9;
    for (const m of enemies) {
      if (m.hp <= 0) continue;
      const d = d2(e.x, e.y, m.x, m.y);
      if (e.air) {
        if (d < td) {
          td = d;
          target = m;
        }
      } else if (d < 320 && d2(m.x, m.y, CX, CY) < 600 && d < td) {
        td = d;
        target = m;
      }
    }
    const canAct = !e.air || e.alt > 0.6;
    if (target && canAct) {
      e.dir = target.x >= e.x ? 1 : -1;
      if (td <= e.range + target.size * 0.25) {
        if (e.cdLeft <= 0) {
          e.cdLeft = e.cd;
          e.atkAnim = 0.15;
          hitEnt(b, e.atk, e.splash, 'enemy', target);
          if (e.range < 60) addFx(b, render, { kind: 'slash', x1: target.x, y1: target.y - target.size * 0.4, x2: 0, y2: 0, t: 0, max: 0.15, color: '#fff', r: 10 });
          else shoot(b, render, e.x + e.dir * e.size * 0.3, e.y - e.size * 0.45 - (e.air ? 40 * e.alt : 0), target.x, target.y - target.size * 0.4, e.shot, e.beam, e.splash);
        }
        if (e.air) {
          e.x += Math.cos(e.phase * 0.6) * 20 * dt;
          e.y += Math.sin(e.phase * 0.6) * 14 * dt;
        }
      } else {
        const tx = target.x + e.ox;
        const ty = target.y + e.oy;
        const dx = tx - e.x;
        const dy = ty - e.y;
        const L = Math.sqrt(dx * dx + dy * dy) || 1;
        e.x += (dx / L) * e.speed * dt;
        e.y += (dy / L) * e.speed * dt;
      }
    } else {
      const dx = rx - e.x;
      const dy = ry - e.y;
      const L = Math.sqrt(dx * dx + dy * dy);
      if (L > 3) {
        const sp = e.air && e.alt < 0.6 ? e.speed * 0.5 : e.speed;
        e.x += (dx / L) * Math.min(L, sp * dt);
        e.y += (dy / L) * Math.min(L, sp * dt);
        if (Math.abs(dx) > 2) e.dir = dx > 0 ? 1 : -1;
      }
    }
    e.x = Math.max(10, Math.min(WW - 10, e.x));
    e.y = Math.max(30, Math.min(WH - 5, e.y));
  }

  // ---------- 怪物 ----------
  for (const e of enemies) {
    if (e.hp <= 0) continue;
    e.hit = Math.max(0, e.hit - dt);
    e.atkAnim = Math.max(0, e.atkAnim - dt);
    e.cdLeft -= dt;
    e.phase += dt * 5;
    let target: BEnt | null = null;
    let td = 1e9;
    const engage = Math.max(e.range, 40) + 70;
    for (const a of allies) {
      if (a.hp <= 0) continue;
      if (a.air && (!e.hitsAir || a.alt < 0.5)) continue;
      const d = d2(a.x, a.y, e.x, e.y);
      if (d <= (a.air ? e.range + 20 : engage) && d < td) {
        td = d;
        target = a;
      }
    }
    if (target) {
      e.dir = target.x >= e.x ? 1 : -1;
      if (td <= e.range + target.size * 0.25) {
        if (e.cdLeft <= 0) {
          e.cdLeft = e.cd;
          e.atkAnim = 0.2;
          hitEnt(b, e.atk, e.splash, 'ally', target);
          const ty = target.y - target.size * 0.4 - (target.air ? 40 * target.alt : 0);
          if (e.range < 60) addFx(b, render, { kind: 'slash', x1: target.x, y1: ty, x2: 0, y2: 0, t: 0, max: 0.15, color: '#fca5a5', r: 10 });
          else shoot(b, render, e.x, e.y - e.size * 0.6, target.x, ty, e.shot, e.beam, e.splash, e.boss);
        }
      } else if (!target.air) {
        const dx = target.x - e.x;
        const dy = target.y - e.y;
        const L = Math.sqrt(dx * dx + dy * dy) || 1;
        e.x += (dx / L) * e.speed * dt;
        e.y += (dy / L) * e.speed * dt;
      }
      continue;
    }
    // 攻击最近的建筑
    let bt: BBuilding | null = null;
    let bd = 1e9;
    for (const x of blds) {
      if (x.hp <= 0) continue;
      const d = d2(x.x, x.y, e.x, e.y) - x.r;
      if (d < bd) {
        bd = d;
        bt = x;
      }
    }
    if (!bt) continue;
    e.dir = bt.x >= e.x ? 1 : -1;
    if (bd <= e.range) {
      if (e.cdLeft <= 0) {
        e.cdLeft = e.cd;
        e.atkAnim = 0.2;
        bt.hp -= e.atk;
        bt.hit = 0.15;
        const hx = bt.x + (e.x - bt.x) * 0.3;
        const hy = bt.y - bt.size * 0.2 + (e.y - bt.y) * 0.2;
        if (e.range < 60) addFx(b, render, { kind: 'slash', x1: hx, y1: hy, x2: 0, y2: 0, t: 0, max: 0.15, color: '#fca5a5', r: 12 });
        else shoot(b, render, e.x, e.y - e.size * 0.6, hx, hy, e.shot, e.beam, e.splash, e.boss);
        if (bt.hp <= 0) {
          addFx(b, render, { kind: 'boom', x1: bt.x, y1: bt.y - bt.size * 0.3, x2: 0, y2: 0, t: 0, max: 0.8, color: '#f97316', r: bt.size * 0.6 });
          event(b, `💥 ${bt.name} 被摧毁了！`);
        }
      }
    } else {
      const tx = bt.x + e.ox;
      const ty = bt.y + e.oy;
      const dx = tx - e.x;
      const dy = ty - e.y;
      const L = Math.sqrt(dx * dx + dy * dy) || 1;
      e.x += (dx / L) * e.speed * dt;
      e.y += (dy / L) * e.speed * dt;
    }
  }

  // ---------- 清理 ----------
  const alive: BEnt[] = [];
  for (const e of b.ents) {
    if (e.hp > 0) alive.push(e);
    else if (e.side === 'ally') {
      b.lost[e.type] = (b.lost[e.type] ?? 0) + 1;
      addFx(b, render, { kind: 'boom', x1: e.x, y1: e.y - e.size * 0.3 - (e.air ? 40 * e.alt : 0), x2: 0, y2: 0, t: 0, max: 0.5, color: '#fb923c', r: e.size * 0.6 });
    } else {
      b.kills++;
      addFx(b, render, { kind: 'boom', x1: e.x, y1: e.y - e.size * 0.3, x2: 0, y2: 0, t: 0, max: 0.4, color: '#f87171', r: e.size * 0.5 });
      if (e.boss) event(b, '👑 首领被击败！');
    }
  }
  b.ents = alive;

  if (render) {
    for (const f of b.fx) f.t += dt;
    b.fx = b.fx.filter((f) => f.t < f.max);
  }

  const base = b.buildings.find((x) => x.key === 'base')!;
  if (base.hp <= 0) {
    base.hp = 0;
    b.over = true;
    b.victory = false;
  } else if (b.time >= b.duration) {
    b.over = true;
    b.victory = true;
  }
}

export function repairCost(b: BattleState) {
  const base = b.buildings.find((x) => x.key === 'base')!;
  const v = Math.ceil(base.maxHp * 0.5);
  return { wood: v, stone: v };
}

export function repairBase(b: BattleState) {
  for (const x of b.buildings) {
    if (x.key === 'base' || x.hp > 0) x.hp = Math.min(x.maxHp, x.hp + x.maxHp * (x.key === 'base' ? 0.25 : 0.15));
  }
  b.repairCdLeft = 60;
  event(b, '🔧 工程师紧急抢修了建筑');
}

export function quickFinish(b: BattleState) {
  let guard = 0;
  while (!b.over && guard < 30000) {
    stepBattle(b, 0.3, false);
    guard++;
  }
  b.fx = [];
}

export function surrender(b: BattleState) {
  b.over = true;
  b.victory = false;
}

export function survivors(b: BattleState): Army {
  const r: Army = {};
  for (const e of b.ents) {
    if (e.side !== 'ally' || e.hp <= 0) continue;
    if (!r[e.type]) r[e.type] = [0, 0, 0, 0, 0, 0];
    r[e.type][e.star]++;
  }
  return r;
}

export function makeResult(gs: GameState, b: BattleState, auto: boolean): BattleResult {
  return {
    victory: b.victory, big: b.big, n: b.n, kills: b.kills, lost: { ...b.lost },
    survivors: survivors(b), resDelta: computeResDelta(gs, b.victory), auto,
  };
}

export function autoResolve(gs: GameState): BattleResult {
  const b = createBattle(gs);
  quickFinish(b);
  return makeResult(gs, b, true);
}

export { NORMAL_DURATION };
