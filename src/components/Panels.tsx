import type { ReactElement } from 'react';
import type { GameState, Job, ResKey, UpgradeTarget } from '../game/types';
import {
  BUILDINGS, CAT_UNITS, HOUSE_DEF, MONSTERS, RESIDENT_MAX_LEVEL, RES_INFO, RES_KEYS, TURRET_DEF, TURRET_TIERS, TURRET_UNLOCK,
  baseStats, buildingHp, engineerCount, gatherRate, houseCapacity, maxHouses, monsterMultipliers, monsterUnlockAttack, popCap,
  powerSupply, recruitCost, redAt, residentBonus, residentExpNeed, residentTrainCost, tierOf, totalCapacity, turretStats,
  unitUnlockLevel, warehouseCap, type UnitDef,
} from '../game/config';
import {
  assignOne, buildHouse, canAfford, findTask, isResUnlocked, newHouseInfo, recruit, setJob, speedUpCost, speedUpTask,
  startUpgrade, targetInfo, techCap, trainResident, unassignOne, upgradeBlock,
} from '../game/logic';
import { RES_ICON, RES_NODE, Sprite, TurretSprite, buildingSprite } from '../game/sprites';
import type { Selection } from './Village';
import { Bar, Btn, CostView, fmt, fmtClock, fmtDur } from './ui';
import { cn } from '../utils/cn';

export type Act = (fn: (s: GameState) => string | void) => void;

const TIER_NAME = ['木造', '石砌', '砖堡', '钢铁', '科技', '传奇'];

export function Stat({ label, now, next }: { label: string; now: string | number; next?: string | number }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded bg-slate-900/50 px-2 py-1 text-xs">
      <span className="shrink-0 text-slate-400">{label}</span>
      <span className="text-right font-semibold text-slate-100">
        {now}
        {next !== undefined && next !== now && <span className="text-emerald-400"> → {next}</span>}
      </span>
    </div>
  );
}

function UpgradeBox({ s, target, act }: { s: GameState; target: UpgradeTarget; act: Act }) {
  const info = targetInfo(s, target);
  const task = findTask(s, target);
  if (task) {
    const g = speedUpCost(task.remaining);
    return (
      <div className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-950/30 p-2">
        <div className="flex justify-between text-xs text-amber-200">
          <span>🔨 升级到 Lv.{task.toLevel}</span>
          <span>剩余 {fmtDur(task.remaining)}</span>
        </div>
        <Bar value={task.total - task.remaining} max={task.total} color="bg-amber-400" />
        <Btn variant="gold" className="w-full" disabled={s.res.gold < g} onClick={() => act((d) => speedUpTask(d, 'build', task.id))}>
          立即完成（{fmt(g)} 金矿）
        </Btn>
      </div>
    );
  }
  if (info.level >= info.max) return <div className="rounded-lg bg-emerald-900/40 p-2 text-center text-sm font-bold text-emerald-300">★ 已满级 ★</div>;
  const block = upgradeBlock(s, target);
  const red = redAt(info.def, info.level + 1);
  return (
    <div className="space-y-2 rounded-lg border border-slate-600/60 bg-slate-900/40 p-2">
      <div className="flex items-center justify-between text-xs text-slate-300">
        <span>{info.level === 0 ? '建造费用' : `升级到 Lv.${info.level + 1}`}</span>
        <span>
          ⏱ {fmtDur(info.time)}
          {red > 0 && <span className="ml-1 text-emerald-400">(较主基地 -{(red * 100).toFixed(1)}%)</span>}
        </span>
      </div>
      <CostView cost={info.cost} res={s.res} />
      {(info.level + 1) % 10 === 0 && <div className="text-[11px] text-fuchsia-300">✨ 升到 Lv.{info.level + 1} 后外形进化为【{TIER_NAME[Math.min(5, (info.level + 1) / 10)]}】</div>}
      <Btn className="w-full" disabled={!!block} onClick={() => act((d) => startUpgrade(d, target))}>
        {block ?? (info.level === 0 ? '建造' : '升级')}
      </Btn>
    </div>
  );
}

function TierStrip({ id, level, max, turret }: { id: string; level: number; max: number; turret?: boolean }) {
  const tiers = Math.floor(max / 10) + 1;
  const cur = tierOf(level, max);
  return (
    <div>
      <div className="mb-1 text-[11px] text-slate-400">外形进化（每 10 级一次）</div>
      <div className="flex gap-1 overflow-x-auto">
        {Array.from({ length: Math.min(6, tiers) }).map((_, t) => (
          <div key={t} className={cn('flex flex-col items-center rounded p-0.5', t === cur ? 'bg-amber-500/25 ring-1 ring-amber-400' : 'bg-slate-900/50', t > cur && 'opacity-50')}>
            {turret ? <TurretSprite level={Math.max(1, t * 10)} size={34} /> : <Sprite id={id === 'house' ? `house_t${t}` : `${id}_t${t}`} size={34} />}
            <span className="text-[9px] text-slate-300">Lv{t === 0 ? 1 : t * 10}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function UnitMini({ u, unlocked, need }: { u: UnitDef; unlocked: boolean; need: number }) {
  return (
    <div className={cn('flex flex-col items-center rounded bg-slate-900/50 p-1', !unlocked && 'opacity-40 grayscale')} title={unlocked ? u.name : `${need}级解锁`}>
      <Sprite id={u.id} size={28} />
      <span className="text-[9px] text-slate-300">{unlocked ? u.name : `Lv${need}`}</span>
    </div>
  );
}

export function DetailPanel({ s, sel, act }: { s: GameState; sel: Selection | null; act: Act }) {
  if (!sel) return <div className="p-4 text-center text-sm text-slate-400">点击地图上的建筑或资源点查看详情</div>;
  if (sel.kind === 'resource') return <ResourceDetail s={s} k={sel.key} act={act} />;

  if (sel.kind === 'newhouse') {
    const { cost, time } = newHouseInfo(s);
    const full = s.houses.length >= maxHouses(s.buildings.base);
    const busy = s.tasks.length >= engineerCount(s.buildings.engineer);
    return (
      <div className="space-y-3 p-3">
        <div className="flex items-center gap-3">
          <Sprite id="house_site" size={64} />
          <div>
            <h3 className="text-lg font-bold text-white">建造新房屋</h3>
            <p className="text-xs text-slate-400">房屋 {s.houses.length}/{maxHouses(s.buildings.base)}（主基地每 5 级 +1 栋，最多 12 栋）</p>
          </div>
        </div>
        <p className="text-xs text-slate-300">{HOUSE_DEF.desc}</p>
        <div className="flex justify-between text-xs text-slate-300">
          <CostView cost={cost} res={s.res} />
          <span>⏱ {fmtDur(time)}</span>
        </div>
        <Btn className="w-full" disabled={full || busy || !canAfford(s.res, cost)} onClick={() => act((d) => buildHouse(d))}>
          {full ? '已达上限' : busy ? '工程师忙碌' : '开始建造'}
        </Btn>
      </div>
    );
  }

  if (sel.kind === 'house') {
    const h = s.houses.find((x) => x.id === sel.id);
    if (!h) return null;
    const next = Math.min(h.level + 1, HOUSE_DEF.max);
    return (
      <div className="space-y-3 p-3">
        <div className="flex items-center gap-3">
          <Sprite id={buildingSprite('house', h.level)} size={64} />
          <div>
            <h3 className="text-lg font-bold text-white">居民房屋 #{s.houses.indexOf(h) + 1}</h3>
            <p className="text-sm text-amber-300">Lv.{h.level} / {HOUSE_DEF.max}</p>
          </div>
        </div>
        <p className="text-xs text-slate-300">{HOUSE_DEF.desc}</p>
        <div className="space-y-1">
          <Stat label="可居住人数" now={houseCapacity(h.level)} next={houseCapacity(next)} />
          <Stat label="家园总容量" now={`${s.residents.length}/${totalCapacity(s)}`} />
          <Stat label="下次扩容" now={h.level >= 30 ? '已达最大 4 人' : `Lv.${(Math.floor(h.level / 10) + 1) * 10}`} />
        </div>
        <TierStrip id="house" level={h.level} max={HOUSE_DEF.max} />
        <UpgradeBox s={s} target={{ kind: 'house', id: h.id }} act={act} />
      </div>
    );
  }

  if (sel.kind === 'turret') {
    const i = sel.idx;
    const lvl = s.turrets[i];
    const locked = s.buildings.base < TURRET_UNLOCK[i];
    const cur = turretStats(Math.max(1, lvl), s.tech.turretAtk, s.tech.turretSpd);
    const nx = turretStats(Math.min(TURRET_DEF.max, lvl + 1), s.tech.turretAtk, s.tech.turretSpd);
    const nextTierLvl = (tierOf(lvl) + 1) * 10;
    return (
      <div className="space-y-3 p-3">
        <div className="flex items-center gap-3">
          <TurretSprite level={lvl} size={64} />
          <div>
            <h3 className="text-lg font-bold text-white">炮塔 {i + 1} · {cur.tier.name}</h3>
            <p className="text-sm text-amber-300">{locked ? `🔒 主基地 ${TURRET_UNLOCK[i]} 级解锁` : `Lv.${lvl} / ${TURRET_DEF.max}`}</p>
          </div>
        </div>
        <p className="text-xs text-slate-300">{TURRET_DEF.desc}</p>
        <div className="space-y-1">
          <Stat label="武器" now={cur.tier.name} next={lvl > 0 ? nx.tier.name : undefined} />
          <Stat label="每秒伤害" now={fmt(cur.dps)} next={fmt(nx.dps)} />
          <Stat label="单发伤害" now={fmt(cur.atk)} next={fmt(nx.atk)} />
          <Stat label="攻击间隔" now={`${cur.cd.toFixed(2)}秒`} />
          <Stat label="射程" now={cur.range} next={nx.range} />
          <Stat label="范围伤害" now={cur.splash || '无'} />
          <Stat label="耐久" now={fmt(cur.hp)} next={fmt(nx.hp)} />
          {nextTierLvl <= 50 && <Stat label="下次进化" now={`Lv.${nextTierLvl} → ${TURRET_TIERS[Math.min(5, nextTierLvl / 10)].name}`} />}
        </div>
        <TierStrip id="turret" level={lvl} max={50} turret />
        <UpgradeBox s={s} target={{ kind: 'turret', idx: i }} act={act} />
      </div>
    );
  }

  const key = sel.key;
  const def = BUILDINGS[key];
  const lvl = s.buildings[key];
  const nl = Math.min(lvl + 1, def.max);
  const stats: ReactElement[] = [];
  if (key === 'base') {
    const a = baseStats(lvl, s.tech.turretAtk, s.tech.turretSpd);
    const b = baseStats(nl, s.tech.turretAtk, s.tech.turretSpd);
    stats.push(
      <Stat key="hp" label="基地生命" now={fmt(a.hp)} next={fmt(b.hp)} />,
      <Stat key="atk" label="主炮攻击" now={fmt(a.atk)} next={fmt(b.atk)} />,
      <Stat key="g" label="采集加成" now={`+${(lvl - 1) * 2}%`} next={`+${(nl - 1) * 2}%`} />,
      <Stat key="h" label="房屋数量上限" now={maxHouses(lvl)} next={maxHouses(nl)} />,
      <Stat key="c" label="其他建筑等级上限" now={lvl} next={nl} />,
    );
  } else {
    stats.push(<Stat key="bhp" label="建筑耐久" now={fmt(buildingHp(lvl))} next={fmt(buildingHp(nl))} />);
  }
  if (key === 'power') stats.push(<Stat key="p" label="电力供应" now={powerSupply(s)} next={12 + 30 * nl} />);
  if (key === 'warehouse') stats.push(<Stat key="w" label="每种资源上限" now={fmt(warehouseCap(lvl))} next={fmt(warehouseCap(nl))} />);
  if (key === 'engineer') stats.push(<Stat key="e" label="工程师数量" now={engineerCount(lvl)} next={engineerCount(nl)} />);
  if (key === 'lab') stats.push(<Stat key="l" label="科技等级上限" now={techCap(s)} next={Math.min(20, Math.floor(nl / 2))} />, <Stat key="r" label="研发状态" now={s.research ? `研发中 ${fmtDur(s.research.remaining)}` : '空闲'} />);
  if (key === 'barracks' || key === 'factory' || key === 'airbase') {
    const cat = key === 'barracks' ? 'inf' : key === 'factory' ? 'veh' : 'air';
    const list = CAT_UNITS[cat];
    const unlocked = list.filter((_, i) => lvl >= unitUnlockLevel(i)).length;
    const nextUnlock = list.findIndex((_, i) => lvl < unitUnlockLevel(i));
    stats.push(
      <Stat key="u" label="已解锁" now={`${unlocked}/${list.length}`} />,
      <Stat key="p" label="编制上限" now={popCap(cat, lvl)} next={popCap(cat, nl)} />,
      <Stat key="b" label="单位属性加成" now={`+${lvl * 2}%`} next={`+${nl * 2}%`} />,
    );
    if (nextUnlock >= 0) stats.push(<Stat key="n" label="下一单位" now={`${list[nextUnlock].name}（Lv.${unitUnlockLevel(nextUnlock)}）`} />);
    stats.push(
      <div key="grid" className="grid grid-cols-5 gap-1 pt-1">
        {list.map((u, i) => (
          <UnitMini key={u.id} u={u} unlocked={lvl >= unitUnlockLevel(i)} need={unitUnlockLevel(i)} />
        ))}
      </div>,
    );
  }
  const locked = s.buildings.base < def.unlockBase;
  return (
    <div className="space-y-3 p-3">
      <div className="flex items-center gap-3">
        <Sprite id={buildingSprite(key, Math.max(1, lvl))} size={64} className={cn(lvl === 0 && 'opacity-50 grayscale')} />
        <div>
          <h3 className="text-lg font-bold text-white">{def.name}</h3>
          <p className="text-sm text-amber-300">{locked ? `🔒 主基地 ${def.unlockBase} 级解锁` : `Lv.${lvl} / ${def.max}`}</p>
          {def.red[1] > 0 && <p className="text-[10px] text-slate-400">升级CD较主基地减少 {def.red[0] * 100}%~{def.red[1] * 100}%</p>}
        </div>
      </div>
      <p className="text-xs text-slate-300">{def.desc}</p>
      <div className="space-y-1">{stats}</div>
      <TierStrip id={key} level={lvl} max={def.max} />
      <UpgradeBox s={s} target={{ kind: 'building', key }} act={act} />
    </div>
  );
}

function ResourceDetail({ s, k, act }: { s: GameState; k: ResKey; act: Act }) {
  const info = RES_INFO[k];
  const locked = !isResUnlocked(s, k);
  const workers = s.residents.filter((p) => p.job === k);
  const idle = s.residents.filter((p) => p.job === 'idle').length;
  const rate = workers.reduce((a, p) => a + gatherRate(s, k, p.level), 0);
  return (
    <div className="space-y-3 p-3">
      <div className="flex items-center gap-3">
        <Sprite id={RES_NODE[k]} size={64} />
        <div>
          <h3 className="text-lg font-bold text-white">{info.zone}</h3>
          <p className="flex items-center gap-1 text-sm text-slate-300">
            产出 <Sprite id={RES_ICON[k]} size={16} /> {info.name}
          </p>
        </div>
      </div>
      {locked ? (
        <div className="rounded-lg bg-slate-900/60 p-3 text-center text-sm text-slate-300">🔒 主基地 {info.unlockBase} 级解锁</div>
      ) : (
        <>
          <div className="space-y-1">
            <Stat label="基础采集速度" now={`${info.rate}/秒·人`} />
            <Stat label="采集居民" now={workers.length} />
            <Stat label="总产量" now={`${rate.toFixed(3)}/秒（${fmt(rate * 3600)}/小时）`} />
            <Stat label="空闲居民" now={idle} />
          </div>
          <div className="flex gap-2">
            <Btn variant="green" className="flex-1" disabled={idle === 0} onClick={() => act((d) => assignOne(d, k))}>+ 派遣居民</Btn>
            <Btn variant="ghost" className="flex-1" disabled={workers.length === 0} onClick={() => act((d) => unassignOne(d, k))}>- 撤回居民</Btn>
          </div>
          <div className="max-h-48 space-y-1 overflow-auto">
            {workers.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded bg-slate-900/50 px-2 py-1 text-xs">
                <span className="text-slate-200">👷 {p.name} Lv.{p.level}</span>
                <span className="text-amber-300">{gatherRate(s, k, p.level).toFixed(3)}/s（+{p.level - 1}%）</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function EngineerQueue({ s }: { s: GameState }) {
  const n = engineerCount(s.buildings.engineer);
  return (
    <div className="flex flex-wrap gap-1.5">
      {Array.from({ length: n }).map((_, i) => {
        const t = s.tasks[i];
        let name = '';
        if (t) {
          const tg = t.target;
          name = tg.kind === 'building' ? BUILDINGS[tg.key].name : tg.kind === 'turret' ? `炮塔${tg.idx + 1}` : `房屋#${s.houses.findIndex((h) => h.id === tg.id) + 1}`;
        }
        return (
          <div key={i} className={cn('min-w-[120px] flex-1 rounded-lg border px-2 py-1 text-xs', t ? 'border-amber-500/50 bg-amber-950/30' : 'border-slate-700 bg-slate-800/60')}>
            <div className="flex justify-between">
              <span className="font-semibold text-slate-200">🛠 工程师{i + 1}</span>
              <span className={t ? 'text-amber-300' : 'text-emerald-400'}>{t ? fmtDur(t.remaining) : '空闲'}</span>
            </div>
            {t && (
              <>
                <div className="truncate text-slate-400">{name} → Lv.{t.toLevel}</div>
                <Bar value={t.total - t.remaining} max={t.total} color="bg-amber-400" className="h-1" />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

const JOB_OPTS: Job[] = ['idle', ...RES_KEYS];

export function ResidentsPanel({ s, act }: { s: GameState; act: Act }) {
  const capN = totalCapacity(s);
  const cost = recruitCost(s.residents.length);
  const canTrain = s.buildings.base >= RES_INFO.gold.unlockBase;
  return (
    <div className="space-y-2 p-3">
      <div>
        <h3 className="font-bold text-white">居民 {s.residents.length}/{capN}</h3>
        <p className="text-[11px] text-slate-400">
          居民满级 {RESIDENT_MAX_LEVEL}，每级采集 +1%。经验按采集到的资源量计算（稀有资源经验按比例折算），也可消耗金矿培训。
        </p>
      </div>
      <div className="rounded-lg border border-slate-600/60 bg-slate-900/40 p-2">
        <div className="mb-1 flex items-center justify-between text-xs text-slate-300">
          <span>招募新居民</span>
          <CostView cost={cost} res={s.res} />
        </div>
        <Btn variant="green" className="w-full" disabled={s.residents.length >= capN || !canAfford(s.res, cost)} onClick={() => act((d) => recruit(d))}>
          {s.residents.length >= capN ? '房屋已满（升级/建造房屋）' : '招募'}
        </Btn>
      </div>
      <div className="max-h-[440px] space-y-1.5 overflow-auto pr-1">
        {s.residents.map((p) => {
          const need = residentExpNeed(p.level);
          const tc = residentTrainCost(p.level);
          const max = p.level >= RESIDENT_MAX_LEVEL;
          const rate = p.job !== 'idle' ? gatherRate(s, p.job, p.level) : 0;
          const expRate = p.job !== 'idle' ? rate / RES_INFO[p.job].rate : 0;
          return (
            <div key={p.id} className="rounded-lg bg-slate-900/50 p-2">
              <div className="flex items-center gap-2">
                <Sprite id="worker" size={28} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-white">{p.name}</span>
                    <span className="text-amber-300">
                      Lv.{p.level}
                      {max && ' MAX'} · 采集+{((residentBonus(p.level) - 1) * 100).toFixed(0)}%
                    </span>
                  </div>
                  <Bar value={max ? 1 : p.exp} max={max ? 1 : need} color="bg-sky-500" className="mt-1 h-1" />
                  <div className="mt-0.5 flex justify-between text-[10px] text-slate-400">
                    <span>{max ? '已满级' : `经验 ${fmt(p.exp)}/${fmt(need)}`}</span>
                    <span>
                      {p.job === 'idle' ? '空闲中' : `${rate.toFixed(3)}/s`}
                      {!max && expRate > 0 && ` · 约${fmtDur((need - p.exp) / expRate)}升级`}
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-1.5 flex items-center gap-1.5">
                <select value={p.job} onChange={(e) => act((d) => setJob(d, p.id, e.target.value as Job))} className="flex-1 rounded border border-slate-600 bg-slate-800 px-1 py-1 text-xs text-white">
                  {JOB_OPTS.map((j) => (
                    <option key={j} value={j} disabled={j !== 'idle' && !isResUnlocked(s, j)}>
                      {j === 'idle' ? '💤 空闲' : `${RES_INFO[j].zone}·${RES_INFO[j].name}${!isResUnlocked(s, j) ? '(未解锁)' : ''}`}
                    </option>
                  ))}
                </select>
                {!max && (
                  <Btn variant="gold" className="px-2 py-1 text-xs" disabled={!canTrain || !canAfford(s.res, tc)} title={canTrain ? `培训消耗 ${tc.gold} 金矿` : '主基地 6 级解锁'} onClick={() => act((d) => trainResident(d, p.id))}>
                    培训 {fmt(tc.gold)}金
                  </Btn>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function BestiaryPanel({ s }: { s: GameState }) {
  const n = s.attackCount + 1;
  const mul = monsterMultipliers(n, s.buildings.base);
  return (
    <div className="space-y-1.5 p-3">
      <p className="text-[11px] text-slate-400">
        下一波（第 {n} 次）怪物强度：生命 ×{mul.hp.toFixed(2)}，攻击 ×{mul.atk.toFixed(2)}（随进攻次数与主基地等级增长）。怪物会从四面八方进攻，优先攻击附近的部队，其次是最近的建筑。
      </p>
      <div className="max-h-[520px] space-y-1.5 overflow-auto pr-1">
        {MONSTERS.map((m, i) => {
          const at = monsterUnlockAttack(i);
          const seen = n >= at;
          return (
            <div key={m.id} className="flex items-center gap-2 rounded-lg bg-slate-900/50 p-2">
              <Sprite id={m.id} size={44} className={cn(!seen && 'opacity-60 brightness-0')} />
              <div className="min-w-0 flex-1">
                <div className="flex justify-between">
                  <span className="text-sm font-bold text-white">{seen ? m.name : '???'}</span>
                  <span className="text-[10px] text-rose-300">第 {at} 次进攻出现</span>
                </div>
                <div className="text-[10px] text-slate-400">
                  ❤{fmt(m.hp * mul.hp)} ⚔{fmt(m.atk * mul.atk)} 速度{m.speed} 射程{m.range} {m.hitsAir && <span className="text-sky-300">· 可对空</span>}
                </div>
                <div className="text-[10px] text-slate-500">{seen ? m.desc : '尚未遭遇'}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function LogPanel({ s }: { s: GameState }) {
  return (
    <div className="max-h-[560px] space-y-1 overflow-auto p-3">
      {s.log.map((l) => (
        <div
          key={l.id}
          className={cn(
            'rounded px-2 py-1 text-xs',
            l.kind === 'good' && 'bg-emerald-900/30 text-emerald-200',
            l.kind === 'bad' && 'bg-rose-900/40 text-rose-200',
            l.kind === 'battle' && 'bg-amber-900/40 text-amber-200',
            l.kind === 'info' && 'bg-slate-900/50 text-slate-300',
          )}
        >
          <span className="mr-1 text-[10px] text-slate-500">{fmtClock(l.t)}</span>
          {l.text}
        </div>
      ))}
    </div>
  );
}
