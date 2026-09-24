import type { BuildingKey, Cost, GameState, Res, ResKey, TechKey, UnitCat } from './types';

export const SAVE_KEY = 'homeland-defense-save-v2';
export const ATTACK_INTERVAL = 12 * 3600;
export const NORMAL_DURATION = 5 * 60;
export const BIG_DURATION = 30 * 60;
export const BIG_EVERY = 14; // 7 天 = 14 次进攻
export const WIN_RATE = 0.06;
export const LOSE_RATE = 0.05;
export const MAX_STAR = 5;
export const STAR_BONUS = 0.2;

export const RES_KEYS: ResKey[] = ['wood', 'stone', 'iron', 'gold', 'oil'];

export const RES_INFO: Record<ResKey, { name: string; color: string; rate: number; unlockBase: number; zone: string; minT: number }> = {
  wood: { name: '木材', color: '#b45309', rate: 1.0, unlockBase: 1, zone: '树林', minT: 1 },
  stone: { name: '石头', color: '#78716c', rate: 0.8, unlockBase: 1, zone: '采石场', minT: 1 },
  iron: { name: '铁矿', color: '#64748b', rate: 0.5, unlockBase: 3, zone: '铁矿山', minT: 4 },
  gold: { name: '金矿', color: '#eab308', rate: 0.35, unlockBase: 6, zone: '金矿洞', minT: 7 },
  oil: { name: '石油', color: '#334155', rate: 0.25, unlockBase: 10, zone: '油田', minT: 11 },
};

// ================= 升级时间曲线 =================
// 主基地：升到 10 级 1 小时，20 级 12 小时，30 级 240 小时，40 级 960 小时，50 级 2800 小时
const H = 3600;
const TIME_ANCHORS: [number, number][] = [
  [1, 10], [2, 30], [5, 300], [10, 1 * H], [20, 12 * H], [30, 240 * H], [40, 960 * H], [50, 2800 * H],
];

/** 升到目标等级 T 所需的主基地基准时间（秒） */
export function baseTime(T: number): number {
  if (T <= TIME_ANCHORS[0][0]) return TIME_ANCHORS[0][1];
  for (let i = 1; i < TIME_ANCHORS.length; i++) {
    const [t1, v1] = TIME_ANCHORS[i];
    const [t0, v0] = TIME_ANCHORS[i - 1];
    if (T <= t1) {
      const f = (T - t0) / (t1 - t0);
      return Math.exp(Math.log(v0) + (Math.log(v1) - Math.log(v0)) * f);
    }
  }
  return TIME_ANCHORS[TIME_ANCHORS.length - 1][1];
}

/** 预估主基地 L 级时每秒总资源收入（用于推算合理的升级消耗） */
export function expectedIncome(L: number): number {
  const R = Math.min(48, 2 + 0.9 * L);
  return R * 0.58 * (1 + 0.02 * L) * 1.1;
}

/** 升到目标等级 T 的主基地资源总消耗 */
export function costTotal(T: number): number {
  return baseTime(T) * expectedIncome(Math.max(1, T - 1)) * 0.22 + 250 * Math.pow(1.25, T);
}

export function makeCost(total: number, weights: Res, T: number): Res {
  const keys = RES_KEYS.filter((k) => T >= RES_INFO[k].minT && weights[k] > 0);
  const sum = keys.reduce((a, k) => a + weights[k], 0) || 1;
  const r: Res = { wood: 0, stone: 0, iron: 0, gold: 0, oil: 0 };
  keys.forEach((k) => (r[k] = Math.ceil((total * weights[k]) / sum)));
  return r;
}

// ================= 建筑定义 =================
export interface TargetDef {
  name: string;
  max: number;
  unlockBase: number;
  weights: Res;
  costMul: number;
  red: [number, number]; // 相对主基地CD的减少比例区间
  desc: string;
}

const W = (wood: number, stone: number, iron: number, gold: number, oil: number): Res => ({ wood, stone, iron, gold, oil });

export const BUILDINGS: Record<BuildingKey, TargetDef> = {
  base: {
    name: '主基地', max: 50, unlockBase: 0, weights: W(0.32, 0.28, 0.18, 0.12, 0.1), costMul: 1, red: [0, 0],
    desc: '家园核心。决定其他建筑等级上限、战斗中基地生命与主炮火力，每级提升采集效率 2%。基地被摧毁即防守失败。',
  },
  power: {
    name: '发电厂', max: 50, unlockBase: 1, weights: W(0.25, 0.3, 0.25, 0.1, 0.1), costMul: 0.6, red: [0.1, 0.15],
    desc: '为全部建筑供电。电力不足时居民采集效率下降。',
  },
  warehouse: {
    name: '仓库', max: 50, unlockBase: 1, weights: W(0.35, 0.35, 0.15, 0.1, 0.05), costMul: 0.55, red: [0.1, 0.14],
    desc: '决定每种资源的存储上限。请保持仓库等级跟上主基地，否则存不下升级所需资源。',
  },
  barracks: {
    name: '兵营', max: 50, unlockBase: 2, weights: W(0.3, 0.3, 0.25, 0.1, 0.05), costMul: 0.6, red: [0.08, 0.14],
    desc: '训练步兵。每 5 级解锁一个新兵种，每级提升步兵属性 2% 与编制上限。',
  },
  factory: {
    name: '战车工厂', max: 50, unlockBase: 5, weights: W(0.1, 0.2, 0.4, 0.15, 0.15), costMul: 0.7, red: [0.08, 0.14],
    desc: '生产战车。每 5 级解锁一种新战车，每级提升战车属性 2% 与编制上限。',
  },
  airbase: {
    name: '空军基地', max: 50, unlockBase: 10, weights: W(0.1, 0.2, 0.3, 0.15, 0.25), costMul: 0.75, red: [0.06, 0.16],
    desc: '训练空军。每 5 级解锁一个新机种，每级提升空军属性 2% 与编制上限。',
  },
  engineer: {
    name: '工程师房屋', max: 30, unlockBase: 1, weights: W(0.35, 0.3, 0.15, 0.15, 0.05), costMul: 0.5, red: [0.09, 0.16],
    desc: '工程师负责建造升级。初始 1 名工程师，15 级 2 名，30 级 3 名。',
  },
  lab: {
    name: '作战实验室', max: 40, unlockBase: 8, weights: W(0.15, 0.2, 0.25, 0.25, 0.15), costMul: 0.7, red: [0.1, 0.15],
    desc: '研发科技：提升部队攻击、生命、速度，缩短生产CD，降低建筑消耗与CD，强化炮塔。科技等级上限 = 实验室等级 ÷ 2。',
  },
};

export const HOUSE_DEF: TargetDef = {
  name: '居民房屋', max: 40, unlockBase: 1, weights: W(0.4, 0.35, 0.1, 0.1, 0.05), costMul: 0.35, red: [0.18, 0.3],
  desc: '居民居住的房屋。初始可住 1 人，每 10 级增加 1 人，最多 4 人。',
};

export const TURRET_UNLOCK = [1, 3, 6, 9];
export const TURRET_DEF: TargetDef = {
  name: '防御炮塔', max: 50, unlockBase: 1, weights: W(0.15, 0.35, 0.3, 0.1, 0.1), costMul: 0.45, red: [0.12, 0.18],
  desc: '分布在基地四周的防御炮塔，自动攻击靠近的怪物。每 10 级进化一次外形与武器。',
};

export function redAt(def: TargetDef, T: number): number {
  const f = def.max > 1 ? Math.min(1, Math.max(0, (T - 1) / (def.max - 1))) : 0;
  return def.red[0] + (def.red[1] - def.red[0]) * f;
}

export function upgradeTimeFor(def: TargetDef, T: number, techBuild: number): number {
  return Math.max(5, Math.round(baseTime(T) * (1 - redAt(def, T)) * (1 - 0.015 * techBuild)));
}

export function upgradeCostFor(def: TargetDef, T: number, techCost: number, extraMul = 1): Res {
  const total = costTotal(T) * def.costMul * (1 - redAt(def, T)) * (1 - 0.015 * techCost) * extraMul;
  return makeCost(total, def.weights, T);
}

export function tierOf(level: number, max = 50): number {
  return Math.min(Math.floor(max / 10), Math.floor(level / 10), 5);
}

// ================= 仓库/电力/房屋 =================
export function warehouseCap(level: number): number {
  return Math.max(2500, Math.floor(0.4 * costTotal(Math.min(50, level + 2)) * (level >= 49 ? 1.5 : 1)));
}

export function powerSupply(s: GameState): number {
  return 12 + 30 * s.buildings.power;
}

export function powerDemand(s: GameState): number {
  const b = s.buildings;
  const houses = s.houses.reduce((a, h) => a + h.level, 0);
  const tur = s.turrets.reduce((a, t) => a + t, 0);
  return b.base * 3 + b.warehouse * 1.5 + b.barracks * 2 + b.factory * 2 + b.airbase * 3 + b.engineer * 1.5 + b.lab * 2.5 + tur * 1 + houses * 0.5;
}

export function powerEfficiency(s: GameState): number {
  const sup = powerSupply(s);
  const dem = powerDemand(s);
  if (sup >= dem) return 1;
  return Math.max(0.3, sup / dem);
}

export function houseCapacity(level: number): number {
  if (level <= 0) return 0;
  return Math.min(4, 1 + Math.floor(level / 10));
}

export function totalCapacity(s: GameState): number {
  return s.houses.reduce((a, h) => a + houseCapacity(h.level), 0);
}

export function maxHouses(baseLevel: number): number {
  return Math.min(12, 2 + Math.floor(baseLevel / 5));
}

export function engineerCount(level: number): number {
  return 1 + (level >= 15 ? 1 : 0) + (level >= 30 ? 1 : 0);
}

// ================= 居民 =================
export const RESIDENT_MAX_LEVEL = 20;

export function recruitCost(n: number): Res {
  const w = Math.ceil(60 * Math.pow(n + 1, 1.8));
  return { wood: w, stone: Math.ceil(w * 0.6), iron: 0, gold: 0, oil: 0 };
}

/** 居民升级所需经验。经验 = 采集的资源量 ÷ 该资源基础速率（稀有资源经验更高） */
export function residentExpNeed(level: number): number {
  return Math.floor(600 * Math.pow(level, 2.3));
}

export function residentTrainCost(level: number): Res {
  return { wood: 0, stone: 0, iron: 0, gold: Math.ceil(residentExpNeed(level) * 0.18), oil: 0 };
}

export function residentBonus(level: number) {
  return 1 + 0.01 * (level - 1);
}

export function gatherRate(s: GameState, job: ResKey, level: number): number {
  return RES_INFO[job].rate * residentBonus(level) * (1 + 0.02 * (s.buildings.base - 1)) * powerEfficiency(s);
}

// ================= 科技 =================
export interface TechDef {
  key: TechKey;
  name: string;
  per: number;
  unit: string;
  desc: string;
  weights: Res;
}
export const TECH_MAX = 20;
export const TECHS: TechDef[] = [
  { key: 'atk', name: '部队攻击', per: 4, unit: '%', desc: '所有战斗单位攻击力', weights: W(0.1, 0.1, 0.35, 0.3, 0.15) },
  { key: 'hp', name: '部队护甲', per: 4, unit: '%', desc: '所有战斗单位生命值', weights: W(0.15, 0.25, 0.3, 0.2, 0.1) },
  { key: 'speed', name: '机动作战', per: 3, unit: '%', desc: '单位移动速度 +3%/级，攻击速度 +2%/级', weights: W(0.1, 0.1, 0.25, 0.25, 0.3) },
  { key: 'train', name: '生产加速', per: 3, unit: '%', desc: '士兵/战车/飞机生产时间减少', weights: W(0.2, 0.2, 0.25, 0.2, 0.15) },
  { key: 'cost', name: '建造节约', per: 1.5, unit: '%', desc: '建筑升级资源消耗减少', weights: W(0.25, 0.25, 0.2, 0.2, 0.1) },
  { key: 'build', name: '建造加速', per: 1.5, unit: '%', desc: '建筑升级时间减少', weights: W(0.2, 0.2, 0.25, 0.25, 0.1) },
  { key: 'turretAtk', name: '炮塔火力', per: 5, unit: '%', desc: '炮塔与主基地主炮攻击力', weights: W(0.1, 0.25, 0.35, 0.2, 0.1) },
  { key: 'turretSpd', name: '炮塔装填', per: 3, unit: '%', desc: '炮塔与主基地主炮攻击速度', weights: W(0.1, 0.2, 0.3, 0.2, 0.2) },
];

export function researchTime(toLevel: number) {
  return Math.max(60, Math.round(baseTime(toLevel * 2) * 0.35));
}
export function researchCost(t: TechDef, toLevel: number): Res {
  return makeCost(costTotal(toLevel * 2) * 0.5, t.weights, Math.max(7, toLevel * 2));
}

// ================= 兵种 =================
export interface UnitDef {
  id: string;
  name: string;
  cat: UnitCat;
  air: boolean;
  hp: number;
  atk: number;
  range: number;
  cd: number;
  speed: number;
  splash: number;
  pop: number;
  time: number;
  cost: Cost;
  desc: string;
  size: number;
  shot: string;
  beam?: boolean;
}

type UD = Omit<UnitDef, 'cat' | 'air' | 'time'>;
const mk = (cat: UnitCat, list: UD[]): UnitDef[] =>
  list.map((u, i) => ({
    ...u,
    cat,
    air: cat === 'air',
    time: Math.round(10 * Math.pow(i + 1, 1.6) * (cat === 'veh' ? 1.25 : cat === 'air' ? 1.35 : 1)),
  }));

export const INF_UNITS = mk('inf', [
  { id: 'militia', name: '民兵', hp: 70, atk: 8, range: 24, cd: 1, speed: 55, splash: 0, pop: 1, cost: { wood: 40, stone: 15 }, desc: '廉价的近战肉盾', size: 32, shot: '#fbbf24' },
  { id: 'archer', name: '弓箭手', hp: 50, atk: 11, range: 150, cd: 1.2, speed: 50, splash: 0, pop: 1, cost: { wood: 80, stone: 15 }, desc: '远程射击', size: 32, shot: '#a3e635' },
  { id: 'spearman', name: '长枪兵', hp: 150, atk: 18, range: 34, cd: 1, speed: 50, splash: 0, pop: 2, cost: { wood: 120, stone: 60, iron: 30 }, desc: '攻守兼备的近战', size: 34, shot: '#fde68a' },
  { id: 'shield', name: '盾卫', hp: 420, atk: 12, range: 26, cd: 1, speed: 40, splash: 0, pop: 2, cost: { stone: 200, iron: 90 }, desc: '厚重护盾，吸收伤害', size: 36, shot: '#93c5fd' },
  { id: 'musketeer', name: '火枪手', hp: 100, atk: 32, range: 180, cd: 1.3, speed: 45, splash: 0, pop: 2, cost: { wood: 120, iron: 150, gold: 25 }, desc: '高伤害远程', size: 34, shot: '#fca5a5' },
  { id: 'flamer', name: '火焰兵', hp: 200, atk: 20, range: 80, cd: 0.5, speed: 45, splash: 45, pop: 3, cost: { iron: 250, gold: 50, oil: 60 }, desc: '近距离范围灼烧', size: 36, shot: '#f97316' },
  { id: 'sniper', name: '狙击手', hp: 90, atk: 120, range: 300, cd: 2.5, speed: 40, splash: 0, pop: 3, cost: { iron: 300, gold: 160 }, desc: '超远距离高爆发', size: 34, shot: '#e0f2fe' },
  { id: 'gunner', name: '机枪兵', hp: 260, atk: 14, range: 190, cd: 0.2, speed: 42, splash: 0, pop: 4, cost: { iron: 500, gold: 200, oil: 100 }, desc: '持续火力压制', size: 36, shot: '#fde047' },
  { id: 'bazooka', name: '火箭兵', hp: 320, atk: 120, range: 230, cd: 2.2, speed: 42, splash: 40, pop: 4, cost: { iron: 900, gold: 350, oil: 300 }, desc: '肩扛火箭筒，范围爆破', size: 36, shot: '#fb923c' },
  { id: 'exo', name: '外骨骼战士', hp: 1600, atk: 65, range: 190, cd: 0.5, speed: 48, splash: 0, pop: 6, cost: { iron: 2000, gold: 800, oil: 700 }, desc: '动力装甲精英步兵', size: 42, shot: '#22d3ee', beam: true },
]);

export const VEH_UNITS = mk('veh', [
  { id: 'jeep', name: '吉普车', hp: 260, atk: 16, range: 150, cd: 0.6, speed: 90, splash: 0, pop: 2, cost: { wood: 150, stone: 60, iron: 150 }, desc: '高速机枪吉普', size: 44, shot: '#fde047' },
  { id: 'apc', name: '装甲车', hp: 650, atk: 28, range: 160, cd: 0.8, speed: 70, splash: 0, pop: 3, cost: { wood: 120, stone: 150, iron: 350 }, desc: '坚固的轮式装甲', size: 46, shot: '#fde68a' },
  { id: 'rocket', name: '火箭炮车', hp: 420, atk: 75, range: 290, cd: 2.5, speed: 60, splash: 55, pop: 3, cost: { iron: 450, gold: 80, oil: 120 }, desc: '远程火箭齐射', size: 46, shot: '#fb923c' },
  { id: 'ltank', name: '轻型坦克', hp: 1100, atk: 90, range: 200, cd: 1.6, speed: 60, splash: 30, pop: 4, cost: { iron: 700, gold: 150, oil: 200 }, desc: '灵活的主力坦克', size: 50, shot: '#fb923c' },
  { id: 'flametank', name: '喷火战车', hp: 1400, atk: 36, range: 95, cd: 0.4, speed: 55, splash: 55, pop: 4, cost: { iron: 900, gold: 200, oil: 400 }, desc: '近距离烈焰横扫', size: 50, shot: '#f97316' },
  { id: 'artillery', name: '自行火炮', hp: 850, atk: 230, range: 350, cd: 3, speed: 45, splash: 75, pop: 5, cost: { iron: 1200, gold: 350, oil: 450 }, desc: '超远程重炮轰击', size: 52, shot: '#ef4444' },
  { id: 'htank', name: '重型坦克', hp: 2800, atk: 180, range: 230, cd: 2, speed: 40, splash: 50, pop: 6, cost: { iron: 1800, gold: 500, oil: 700 }, desc: '厚重装甲的钢铁巨兽', size: 56, shot: '#fb923c' },
  { id: 'missile', name: '导弹战车', hp: 1700, atk: 400, range: 370, cd: 3.2, speed: 45, splash: 65, pop: 6, cost: { iron: 2200, gold: 800, oil: 900 }, desc: '精确制导导弹', size: 54, shot: '#f43f5e' },
  { id: 'lasertank', name: '激光坦克', hp: 3400, atk: 140, range: 270, cd: 0.6, speed: 48, splash: 20, pop: 8, cost: { iron: 3000, gold: 1200, oil: 1200 }, desc: '持续激光灼烧', size: 56, shot: '#22d3ee', beam: true },
  { id: 'mammoth', name: '猛犸坦克', hp: 7500, atk: 340, range: 270, cd: 1.6, speed: 32, splash: 70, pop: 12, cost: { iron: 5500, gold: 2200, oil: 2500 }, desc: '双管巨炮终极战车', size: 66, shot: '#fb7185' },
]);

export const AIR_UNITS = mk('air', [
  { id: 'scout', name: '侦察机', hp: 120, atk: 14, range: 160, cd: 1, speed: 110, splash: 0, pop: 1, cost: { wood: 200, iron: 150, oil: 80 }, desc: '轻型空中支援', size: 40, shot: '#fef08a' },
  { id: 'heli', name: '直升机', hp: 260, atk: 22, range: 170, cd: 0.8, speed: 80, splash: 0, pop: 2, cost: { iron: 380, gold: 80, oil: 200 }, desc: '灵活的火力平台', size: 46, shot: '#fde047' },
  { id: 'fighter', name: '战斗机', hp: 300, atk: 45, range: 200, cd: 0.9, speed: 150, splash: 0, pop: 2, cost: { iron: 600, gold: 160, oil: 300 }, desc: '高速空中打击', size: 48, shot: '#fca5a5' },
  { id: 'gunship', name: '武装直升机', hp: 600, atk: 18, range: 200, cd: 0.2, speed: 75, splash: 0, pop: 3, cost: { iron: 850, gold: 260, oil: 450 }, desc: '机炮持续扫射', size: 50, shot: '#fbbf24' },
  { id: 'bomber', name: '轰炸机', hp: 700, atk: 160, range: 140, cd: 2.5, speed: 70, splash: 70, pop: 4, cost: { iron: 1200, gold: 400, oil: 700 }, desc: '大范围地毯式轰炸', size: 56, shot: '#f97316' },
  { id: 'drones', name: '无人机群', hp: 500, atk: 30, range: 180, cd: 0.4, speed: 120, splash: 20, pop: 4, cost: { iron: 1400, gold: 600, oil: 600 }, desc: '蜂群作战', size: 50, shot: '#a5f3fc' },
  { id: 'stealth', name: '隐形战机', hp: 900, atk: 180, range: 260, cd: 1.4, speed: 160, splash: 30, pop: 5, cost: { iron: 2000, gold: 850, oil: 1000 }, desc: '难以被锁定的精准打击', size: 54, shot: '#c4b5fd' },
  { id: 'gunboat', name: '空中炮艇', hp: 2200, atk: 70, range: 260, cd: 0.35, speed: 55, splash: 25, pop: 7, cost: { iron: 3000, gold: 1200, oil: 1500 }, desc: '空中移动炮台', size: 64, shot: '#fb7185' },
  { id: 'strategic', name: '战略轰炸机', hp: 2600, atk: 450, range: 180, cd: 3, speed: 60, splash: 110, pop: 8, cost: { iron: 4200, gold: 1700, oil: 2400 }, desc: '毁灭性战略轰炸', size: 68, shot: '#ef4444' },
  { id: 'carrier', name: '天穹母舰', hp: 7000, atk: 160, range: 300, cd: 0.5, speed: 40, splash: 50, pop: 14, cost: { iron: 8500, gold: 3700, oil: 5000 }, desc: '终极空中要塞', size: 84, shot: '#38bdf8', beam: true },
]);

export const CAT_UNITS: Record<UnitCat, UnitDef[]> = { inf: INF_UNITS, veh: VEH_UNITS, air: AIR_UNITS };
export const CAT_BUILDING: Record<UnitCat, BuildingKey> = { inf: 'barracks', veh: 'factory', air: 'airbase' };
export const CAT_NAME: Record<UnitCat, string> = { inf: '步兵', veh: '战车', air: '空军' };
export const ALL_UNITS: Record<string, UnitDef> = Object.fromEntries([...INF_UNITS, ...VEH_UNITS, ...AIR_UNITS].map((u) => [u.id, u]));

export function unitUnlockLevel(index: number): number {
  return index === 0 ? 1 : index * 5;
}

export function popCap(cat: UnitCat, lvl: number): number {
  if (lvl <= 0) return 0;
  if (cat === 'inf') return 5 + 3 * lvl;
  if (cat === 'veh') return 4 + 2 * lvl;
  return 3 + 2 * lvl;
}

// ================= 进阶 =================
/** 步兵进阶CD（分钟）：1阶20分钟，2阶1小时10分，3阶2小时40分，4阶3小时50分，5阶5小时10分 */
export const INF_ADV_MIN = [20, 70, 160, 230, 310];

export function advanceTime(cat: UnitCat, toStar: number): number {
  const base = INF_ADV_MIN[toStar - 1] * 60;
  const f = (toStar - 1) / 4;
  if (cat === 'veh') return Math.round(base * (1 + 0.08 + 0.04 * f)); // +8%~12%
  if (cat === 'air') return Math.round(base * (1 + 0.06 + 0.09 * f)); // +6%~15%
  return base;
}

export function advanceCostPer(u: UnitDef, toStar: number): Res {
  const r: Res = { wood: 0, stone: 0, iron: 0, gold: 0, oil: 0 };
  RES_KEYS.forEach((k) => (r[k] = Math.ceil((u.cost[k] ?? 0) * toStar * 1.5)));
  r.gold += 20 * toStar * toStar;
  return r;
}

// ================= 战斗数值 =================
export function unitStats(s: GameState, id: string, star: number) {
  const u = ALL_UNITS[id];
  const lvl = s.buildings[CAT_BUILDING[u.cat]];
  const m = (1 + 0.02 * lvl) * (1 + STAR_BONUS * star);
  return {
    hp: u.hp * m * (1 + 0.04 * s.tech.hp),
    atk: u.atk * m * (1 + 0.04 * s.tech.atk),
    speed: u.speed * (1 + 0.03 * s.tech.speed),
    cd: u.cd / (1 + 0.02 * s.tech.speed),
  };
}

export function baseStats(level: number, techAtk = 0, techSpd = 0) {
  const cd = 0.8 / (1 + 0.03 * techSpd);
  return {
    hp: 1500 + 400 * level + 40 * level * level,
    atk: 15 * Math.pow(1.09, level) * 0.8 * (1 + 0.05 * techAtk),
    cd,
    range: 300,
  };
}

export function buildingHp(level: number) {
  return 500 + 180 * level + 12 * level * level;
}

export const TURRET_TIERS = [
  { name: '木制箭塔', cd: 1.0, splash: 0, mul: 1, shot: '#fde68a', kind: 'arrow' },
  { name: '加农炮塔', cd: 1.5, splash: 35, mul: 1.1, shot: '#f97316', kind: 'shell' },
  { name: '双管炮塔', cd: 0.75, splash: 25, mul: 1.15, shot: '#fb923c', kind: 'shell' },
  { name: '加特林塔', cd: 0.18, splash: 0, mul: 1.2, shot: '#fde047', kind: 'bullet' },
  { name: '导弹塔', cd: 2.2, splash: 80, mul: 1.35, shot: '#ef4444', kind: 'missile' },
  { name: '激光塔', cd: 0.5, splash: 20, mul: 1.5, shot: '#22d3ee', kind: 'laser' },
] as const;

export function turretStats(level: number, techAtk = 0, techSpd = 0) {
  const tier = TURRET_TIERS[tierOf(level)];
  const dps = 10 * Math.pow(1.09, level) * tier.mul * (1 + 0.05 * techAtk);
  const cd = tier.cd / (1 + 0.03 * techSpd);
  return { tier, atk: dps * tier.cd, cd, dps: dps * (1 + 0.03 * techSpd), range: 230 + 3 * level, splash: tier.splash, hp: 400 + 150 * level + 10 * level * level };
}

// ================= 怪物 =================
export interface MonsterDef {
  id: string;
  name: string;
  hp: number;
  atk: number;
  speed: number;
  range: number;
  cd: number;
  splash: number;
  hitsAir: boolean;
  cost: number;
  size: number;
  desc: string;
  shot: string;
  beam?: boolean;
}

export const MONSTERS: MonsterDef[] = [
  { id: 'goblin', name: '哥布林', hp: 40, atk: 5, speed: 42, range: 20, cd: 1, splash: 0, hitsAir: false, cost: 2.5, size: 32, desc: '成群结队的小怪，弱小但数量多', shot: '#84cc16' },
  { id: 'dog', name: '野狗', hp: 35, atk: 6, speed: 85, range: 18, cd: 0.8, splash: 0, hitsAir: false, cost: 2.5, size: 34, desc: '速度很快，会迅速冲到基地', shot: '#a16207' },
  { id: 'wolf', name: '野狼', hp: 85, atk: 11, speed: 75, range: 20, cd: 0.9, splash: 0, hitsAir: false, cost: 5, size: 40, desc: '凶猛迅捷的掠食者', shot: '#9ca3af' },
  { id: 'bison', name: '野牛', hp: 320, atk: 20, speed: 38, range: 24, cd: 1.4, splash: 20, hitsAir: false, cost: 12, size: 52, desc: '皮糙肉厚，冲撞造成范围伤害', shot: '#78350f' },
  { id: 'boar', name: '野猪', hp: 240, atk: 26, speed: 62, range: 22, cd: 1.1, splash: 0, hitsAir: false, cost: 12, size: 46, desc: '獠牙锋利，冲锋迅猛', shot: '#57534e' },
  { id: 'gorilla', name: '暴怒猩猩', hp: 700, atk: 40, speed: 48, range: 130, cd: 1.6, splash: 25, hitsAir: true, cost: 30, size: 56, desc: '投掷巨石，可攻击空中单位', shot: '#a8a29e' },
  { id: 'zombie', name: '丧尸', hp: 520, atk: 28, speed: 36, range: 20, cd: 1, splash: 0, hitsAir: false, cost: 20, size: 42, desc: '不知疼痛，缓慢而坚韧', shot: '#65a30d' },
  { id: 'jiangshi', name: '僵尸', hp: 1000, atk: 50, speed: 52, range: 22, cd: 1.2, splash: 0, hitsAir: false, cost: 40, size: 44, desc: '清朝僵尸，蹦跳前进，力大无穷', shot: '#facc15' },
  { id: 'ultraman', name: '假奥特曼', hp: 4500, atk: 140, speed: 40, range: 175, cd: 2, splash: 55, hitsAir: true, cost: 180, size: 70, desc: '山寨光之巨人，发射范围光线', shot: '#fde047', beam: true },
  { id: 'spider', name: '蜘蛛机器人', hp: 1800, atk: 30, speed: 56, range: 165, cd: 0.35, splash: 0, hitsAir: true, cost: 110, size: 58, desc: '机械蜘蛛，高速激光可打击空中', shot: '#f43f5e', beam: true },
  { id: 'terminator', name: '终结者', hp: 5200, atk: 85, speed: 38, range: 225, cd: 0.45, splash: 0, hitsAir: true, cost: 260, size: 56, desc: '来自未来的杀戮机器', shot: '#ef4444' },
];

export function monsterUnlockAttack(index: number): number {
  return index * 2 + 1;
}
export function isBigAttack(n: number): boolean {
  return n % BIG_EVERY === 0;
}
export function monsterUnlockedCount(n: number, big: boolean): number {
  return Math.min(MONSTERS.length, 1 + Math.floor((n - 1) / 2) + (big ? 2 : 0));
}
export function monsterMultipliers(n: number, baseLevel: number) {
  const k = n - 1;
  return {
    hp: (1 + 0.03 * k) * Math.pow(1.07, baseLevel - 1),
    atk: (1 + 0.02 * k) * Math.pow(1.05, baseLevel - 1),
  };
}

// ================= 名字 =================
const SURNAMES = '李王张刘陈杨赵黄周吴徐孙胡朱高林何郭马罗梁宋郑谢韩唐冯于董萧程曹袁邓许傅沈曾彭吕苏卢蒋蔡贾丁魏薛叶阎余潘杜戴夏钟汪田任姜范方石姚谭廖邹熊金陆郝孔白崔康毛邱秦江史顾侯邵孟龙万段雷钱汤尹黎易常武乔贺赖龚文';
const GIVEN = ['大壮', '小明', '铁柱', '翠花', '二狗', '春花', '建国', '秀英', '志强', '桂芳', '石头', '招娣', '国庆', '美丽', '大山', '小红', '富贵', '玉兰', '金宝', '阿福', '海燕', '长生', '红梅', '满仓'];
export function randomName(): string {
  return SURNAMES[Math.floor(Math.random() * SURNAMES.length)] + GIVEN[Math.floor(Math.random() * GIVEN.length)];
}
