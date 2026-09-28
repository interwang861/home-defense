import type { BuildingKey, GameState, ResKey } from '../game/types';
import { BUILDINGS, RES_INFO, RES_KEYS, TURRET_UNLOCK, gatherRate, houseCapacity, maxHouses, tierOf } from '../game/config';
import { findTask, isResUnlocked } from '../game/logic';
import { RES_NODE, Sprite, TurretSprite, buildingSprite } from '../game/sprites';
import { cn } from '../utils/cn';

export type Selection =
  | { kind: 'building'; key: BuildingKey }
  | { kind: 'house'; id: number }
  | { kind: 'turret'; idx: number }
  | { kind: 'resource'; key: ResKey }
  | { kind: 'newhouse' };

const BPOS: Record<BuildingKey, [number, number, number]> = {
  engineer: [50, 10, 74],
  power: [28, 15, 80],
  warehouse: [72, 15, 80],
  base: [50, 41, 118],
  barracks: [24, 44, 86],
  factory: [76, 44, 86],
  airbase: [34, 67, 90],
  lab: [66, 67, 82],
};
const TPOS: [number, number][] = [[37, 28], [63, 28], [37, 55], [63, 55]];

const RPOS: Record<ResKey, [number, number]> = {
  wood: [7, 17],
  stone: [7, 50],
  iron: [7, 83],
  gold: [93, 27],
  oil: [93, 72],
};

const HOUSE_SLOTS: [number, number][] = [
  [22, 84], [33, 84], [44, 84], [56, 84], [67, 84], [78, 84],
  [22, 96], [33, 96], [44, 96], [56, 96], [67, 96], [78, 96],
];

function isSel(sel: Selection | null, s: Selection) {
  if (!sel || sel.kind !== s.kind) return false;
  if (sel.kind === 'building' && s.kind === 'building') return sel.key === s.key;
  if (sel.kind === 'house' && s.kind === 'house') return sel.id === s.id;
  if (sel.kind === 'turret' && s.kind === 'turret') return sel.idx === s.idx;
  if (sel.kind === 'resource' && s.kind === 'resource') return sel.key === s.key;
  return sel.kind === 'newhouse';
}

function TaskBar({ remaining, total }: { remaining: number; total: number }) {
  const p = Math.max(0, Math.min(100, (1 - remaining / total) * 100));
  return (
    <div className="mt-0.5 h-1.5 w-16 overflow-hidden rounded-full bg-black/60">
      <div className="h-full bg-amber-400" style={{ width: `${p}%` }} />
    </div>
  );
}

const TIER_NAME = ['木造', '石砌', '砖堡', '钢铁', '科技', '传奇'];
const TIER_COLOR = ['text-amber-200', 'text-stone-200', 'text-orange-300', 'text-teal-300', 'text-sky-300', 'text-fuchsia-300'];

export function Village({ s, sel, onSelect }: { s: GameState; sel: Selection | null; onSelect: (x: Selection) => void }) {
  const mh = maxHouses(s.buildings.base);
  const btn = 'absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center rounded-xl p-1 transition hover:bg-white/10';
  return (
    <div className="relative w-full overflow-hidden rounded-2xl border-4 border-emerald-900/70 shadow-2xl" style={{ aspectRatio: '16 / 12' }}>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,#4d9a4a_0%,#3f8a3d_45%,#2f6e31_100%)]" />
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 160 120" preserveAspectRatio="none">
        <defs>
          <pattern id="grass" width="8" height="8" patternUnits="userSpaceOnUse">
            <path d="M1 7 l1 -2 l1 2 M5 4 l1 -2 l1 2" stroke="#5fae5a" strokeWidth="0.4" fill="none" />
          </pattern>
        </defs>
        <rect width="160" height="120" fill="url(#grass)" opacity="0.6" />
        <g stroke="#c7a36b" strokeWidth="3" opacity="0.5" strokeLinecap="round">
          <path d="M80 50 L12 20 M80 50 L12 60 M80 50 L12 100 M80 50 L148 32 M80 50 L148 86 M80 50 L80 92" />
          <path d="M30 101 H130 M30 116 H130" strokeWidth="2.4" />
        </g>
        <ellipse cx="80" cy="50" rx="24" ry="19" fill="none" stroke="#a8a29e" strokeWidth="1.2" strokeDasharray="2 1.5" opacity="0.8" />
      </svg>

      {RES_KEYS.map((k) => {
        const [x, y] = RPOS[k];
        const locked = !isResUnlocked(s, k);
        const workers = s.residents.filter((p) => p.job === k);
        const rate = workers.reduce((a, p) => a + gatherRate(s, k, p.level), 0);
        const me: Selection = { kind: 'resource', key: k };
        return (
          <button key={k} onClick={() => onSelect(me)} className={cn(btn, isSel(sel, me) && 'bg-white/15 ring-2 ring-amber-300')} style={{ left: `${x}%`, top: `${y}%` }}>
            <div className={cn('relative flex', locked && 'opacity-50 grayscale')}>
              <Sprite id={RES_NODE[k]} size={40} />
              <Sprite id={RES_NODE[k]} size={30} className="-ml-3 mt-3" />
              {workers.slice(0, 4).map((p, i) => (
                <Sprite key={p.id} id="worker" size={16} className="dig absolute" style={{ left: 2 + i * 12, bottom: -4, animationDelay: `${i * 0.2}s` }} />
              ))}
            </div>
            <div className="mt-0.5 whitespace-nowrap rounded bg-black/55 px-1 text-[10px] font-semibold text-white">
              {RES_INFO[k].zone} {locked ? `🔒${RES_INFO[k].unlockBase}级` : `👷${workers.length} +${rate.toFixed(2)}/s`}
            </div>
          </button>
        );
      })}

      {(Object.keys(BPOS) as BuildingKey[]).map((key) => {
        const [x, y, size] = BPOS[key];
        const lvl = s.buildings[key];
        const def = BUILDINGS[key];
        const locked = s.buildings.base < def.unlockBase;
        const task = findTask(s, { kind: 'building', key });
        const me: Selection = { kind: 'building', key };
        const t = tierOf(lvl, def.max);
        return (
          <button key={key} onClick={() => onSelect(me)} className={cn(btn, isSel(sel, me) && 'bg-white/15 ring-2 ring-amber-300')} style={{ left: `${x}%`, top: `${y}%` }}>
            <div className={cn('relative', (locked || lvl === 0) && 'opacity-45 grayscale', task && 'building-work')}>
              <Sprite id={buildingSprite(key, Math.max(1, lvl))} size={size * 0.62} className="sm:hidden" />
              <Sprite id={buildingSprite(key, Math.max(1, lvl))} size={size} className="hidden sm:block" />
              {task && <span className="absolute -right-1 -top-1 text-base">🔨</span>}
            </div>
            <div className="whitespace-nowrap rounded bg-black/60 px-1.5 text-[11px] font-bold text-white">
              {def.name} {locked ? `🔒` : lvl === 0 ? '未建造' : <span className="text-amber-300">Lv.{lvl}</span>}
              {lvl > 0 && <span className={cn('ml-1 text-[9px]', TIER_COLOR[t])}>{TIER_NAME[t]}</span>}
            </div>
            {task && <TaskBar remaining={task.remaining} total={task.total} />}
          </button>
        );
      })}

      {TPOS.map(([x, y], i) => {
        const lvl = s.turrets[i];
        const locked = s.buildings.base < TURRET_UNLOCK[i];
        const task = findTask(s, { kind: 'turret', idx: i });
        const me: Selection = { kind: 'turret', idx: i };
        return (
          <button key={i} onClick={() => onSelect(me)} className={cn(btn, 'p-0.5', isSel(sel, me) && 'bg-white/15 ring-2 ring-amber-300')} style={{ left: `${x}%`, top: `${y}%` }}>
            <div className={cn('relative', (locked || lvl === 0) && 'opacity-45 grayscale', task && 'building-work')}>
              <TurretSprite level={lvl} size={44} angle={x < 50 ? (y < 40 ? -135 : 135) : y < 40 ? -45 : 45} />
              {task && <span className="absolute -right-1 -top-1 text-sm">🔨</span>}
            </div>
            <div className="whitespace-nowrap rounded bg-black/60 px-1 text-[10px] font-bold text-white">
              炮塔{i + 1} {locked ? `🔒${TURRET_UNLOCK[i]}` : lvl === 0 ? '未建' : <span className="text-amber-300">Lv.{lvl}</span>}
            </div>
            {task && <TaskBar remaining={task.remaining} total={task.total} />}
          </button>
        );
      })}

      {HOUSE_SLOTS.map(([x, y], i) => {
        const h = s.houses[i];
        if (h) {
          const task = findTask(s, { kind: 'house', id: h.id });
          const me: Selection = { kind: 'house', id: h.id };
          return (
            <button key={h.id} onClick={() => onSelect(me)} className={cn(btn, 'rounded-lg p-0.5', isSel(sel, me) && 'bg-white/15 ring-2 ring-amber-300')} style={{ left: `${x}%`, top: `${y}%` }}>
              <div className={cn('relative', task && 'building-work')}>
                <Sprite id={buildingSprite('house', h.level)} size={40} />
              </div>
              <div className="whitespace-nowrap rounded bg-black/60 px-1 text-[10px] font-semibold text-white">
                {h.level === 0 ? '建造中' : <>Lv.{h.level} 🏠{houseCapacity(h.level)}</>}
              </div>
              {task && <TaskBar remaining={task.remaining} total={task.total} />}
            </button>
          );
        }
        if (i === s.houses.length && i < mh) {
          const me: Selection = { kind: 'newhouse' };
          return (
            <button
              key={`slot${i}`}
              onClick={() => onSelect(me)}
              className={cn('absolute flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-lg border-2 border-dashed border-amber-200/70 bg-black/20 text-2xl text-amber-100 hover:bg-black/35', isSel(sel, me) && 'ring-2 ring-amber-300')}
              style={{ left: `${x}%`, top: `${y}%` }}
              title="建造新房屋"
            >
              +
            </button>
          );
        }
        return <div key={`slot${i}`} className="absolute h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-md border border-dashed border-white/15 bg-black/10" style={{ left: `${x}%`, top: `${y}%` }} />;
      })}
    </div>
  );
}
