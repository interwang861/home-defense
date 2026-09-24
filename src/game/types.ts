export type ResKey = 'wood' | 'stone' | 'iron' | 'gold' | 'oil';
export type Res = Record<ResKey, number>;
export type Cost = Partial<Res>;

export type BuildingKey = 'base' | 'power' | 'warehouse' | 'barracks' | 'factory' | 'airbase' | 'engineer' | 'lab';
export type UnitCat = 'inf' | 'veh' | 'air';
export type TechKey = 'atk' | 'hp' | 'speed' | 'train' | 'cost' | 'build' | 'turretAtk' | 'turretSpd';
export type Job = ResKey | 'idle';

export interface House {
  id: number;
  level: number;
}

export interface Resident {
  id: number;
  name: string;
  level: number;
  exp: number;
  job: Job;
}

export type UpgradeTarget =
  | { kind: 'building'; key: BuildingKey }
  | { kind: 'house'; id: number }
  | { kind: 'turret'; idx: number };

export interface UpgradeTask {
  id: number;
  target: UpgradeTarget;
  remaining: number;
  total: number;
  toLevel: number;
}

export interface TrainTask {
  id: number;
  unit: string;
  count: number;
  remaining: number;
  total: number;
}

export interface AdvTask {
  id: number;
  unit: string;
  fromStar: number;
  count: number;
  remaining: number;
  total: number;
}

export interface ResearchTask {
  tech: TechKey;
  toLevel: number;
  remaining: number;
  total: number;
}

export interface LogEntry {
  id: number;
  t: number;
  text: string;
  kind: 'info' | 'good' | 'bad' | 'battle';
}

/** 军队：每个兵种按星级(0~5)记录数量 */
export type Army = Record<string, number[]>;

export interface GameState {
  version: number;
  gameTime: number;
  res: Res;
  buildings: Record<BuildingKey, number>;
  turrets: number[];
  houses: House[];
  residents: Resident[];
  tasks: UpgradeTask[];
  army: Army;
  trainQ: Record<UnitCat, TrainTask[]>;
  advQ: Record<UnitCat, AdvTask | null>;
  tech: Record<TechKey, number>;
  research: ResearchTask | null;
  nextAttackAt: number;
  attackCount: number;
  timeScale: number;
  log: LogEntry[];
  stats: { wins: number; losses: number; kills: number };
  nextId: number;
  lastSaved: number;
}

export interface BattleResult {
  victory: boolean;
  big: boolean;
  n: number;
  kills: number;
  lost: Record<string, number>;
  survivors: Army;
  resDelta: Res;
  auto: boolean;
}
