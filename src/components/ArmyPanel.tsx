import { useState } from 'react';
import type { GameState, UnitCat } from '../game/types';
import { ALL_UNITS, CAT_BUILDING, CAT_NAME, CAT_UNITS, MAX_STAR, STAR_BONUS, advanceTime, popCap, unitStats, unitUnlockLevel, BUILDINGS, type UnitDef } from '../game/config';
import {
  advanceInfo, armyPop, canAfford, cancelTrain, dismissUnit, speedUpCost, speedUpTask, startAdvance, trainTimePer, trainUnit,
  unitAvailable, unitTotal,
} from '../game/logic';
import { Sprite } from '../game/sprites';
import type { Act } from './Panels';
import { Bar, Btn, CostView, fmt, fmtDur } from './ui';
import { cn } from '../utils/cn';

const Stars = ({ n, className }: { n: number; className?: string }) => (
  <span className={cn('text-amber-300', className)}>{n > 0 ? '★'.repeat(n) : '☆'}</span>
);

function AdvanceBox({ s, u, act }: { s: GameState; u: UnitDef; act: Act }) {
  const arr = s.army[u.id] ?? [0, 0, 0, 0, 0, 0];
  const firstStar = arr.findIndex((c, i) => c > 0 && i < MAX_STAR);
  const [from, setFrom] = useState(Math.max(0, firstStar));
  const have = arr[from] ?? 0;
  const [count, setCount] = useState(have);
  const n = Math.min(Math.max(1, count), have);
  const busy = s.advQ[u.cat];
  if (firstStar < 0) return <div className="rounded bg-slate-950/50 p-2 text-[11px] text-slate-400">没有可进阶的单位（已全部满阶或尚未拥有）</div>;
  const { cost, time } = advanceInfo(u.id, from, n);
  return (
    <div className="space-y-1.5 rounded-lg border border-fuchsia-500/30 bg-fuchsia-950/20 p-2">
      <div className="text-[11px] text-fuchsia-200">进阶：只对【当前已拥有】的单位生效，新生产的单位需要重新进阶。每阶 +{STAR_BONUS * 100}% 生命与攻击。</div>
      <div className="flex flex-wrap gap-1">
        {arr.slice(0, MAX_STAR).map((c, i) => (
          <button
            key={i}
            disabled={c === 0}
            onClick={() => {
              setFrom(i);
              setCount(c);
            }}
            className={cn('rounded px-1.5 py-0.5 text-[11px] disabled:opacity-30', from === i ? 'bg-fuchsia-600 text-white' : 'bg-slate-800 text-slate-300')}
          >
            {i}阶→{i + 1}阶 ({c})
          </button>
        ))}
      </div>
      {have > 0 && (
        <>
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <span>数量</span>
            <input type="range" min={1} max={have} value={n} onChange={(e) => setCount(Number(e.target.value))} className="flex-1 accent-fuchsia-500" />
            <span className="w-14 text-right font-bold text-white">
              {n}/{have}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <CostView cost={cost} res={s.res} />
            <span className="text-slate-300">⏱ {fmtDur(time)}</span>
          </div>
          <Btn variant="primary" className="w-full bg-fuchsia-600 hover:bg-fuchsia-500" disabled={!!busy || !canAfford(s.res, cost)} onClick={() => act((d) => startAdvance(d, u.id, from, n))}>
            {busy ? `${CAT_NAME[u.cat]}进阶槽使用中` : `进阶 ${n} 个到 ${'★'.repeat(from + 1)}`}
          </Btn>
        </>
      )}
    </div>
  );
}

function UnitRow({ s, u, idx, act, open, onToggle }: { s: GameState; u: UnitDef; idx: number; act: Act; open: boolean; onToggle: () => void }) {
  const avail = unitAvailable(s, u.id);
  const need = unitUnlockLevel(idx);
  const total = unitTotal(s, u.id);
  const arr = s.army[u.id] ?? [0, 0, 0, 0, 0, 0];
  const st = unitStats(s, u.id, 0);
  const per = trainTimePer(s, u.id);
  return (
    <div className={cn('rounded-lg bg-slate-900/50 p-2', !avail && 'opacity-50')}>
      <div className="flex items-center gap-2">
        <Sprite id={u.id} size={42} className={cn(!avail && 'grayscale')} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-white">{u.name}</span>
            <span className="text-xs text-slate-300">
              拥有 <b className="text-amber-300">{total}</b>
            </span>
          </div>
          <div className="text-[10px] text-slate-400">
            ❤{fmt(st.hp)} ⚔{fmt(st.atk)} 射程{u.range} {u.splash ? `范围${u.splash} ` : ''}编制{u.pop} ⏱{fmtDur(per)}/个
          </div>
          <div className="text-[10px] text-slate-500">{u.desc}</div>
        </div>
      </div>
      {avail ? (
        <>
          {total > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {arr.map((c, i) =>
                c > 0 ? (
                  <span key={i} className="flex items-center gap-0.5 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-200">
                    <Stars n={i} /> ×{c}
                    <button className="ml-0.5 text-slate-500 hover:text-rose-400" title="解散一个" onClick={() => act((d) => dismissUnit(d, u.id, i))}>
                      ✕
                    </button>
                  </span>
                ) : null,
              )}
            </div>
          )}
          <div className="mt-1.5 flex items-center gap-1">
            <CostView cost={u.cost} className="flex-1" res={s.res} />
            {[1, 5, 10].map((n) => (
              <Btn key={n} className="px-2 py-0.5 text-xs" onClick={() => act((d) => trainUnit(d, u.id, n))}>
                +{n}
              </Btn>
            ))}
            <Btn variant="ghost" className={cn('px-2 py-0.5 text-xs', open && 'bg-fuchsia-700')} onClick={onToggle} title="进阶">
              ★进阶
            </Btn>
          </div>
          {open && (
            <div className="mt-1.5">
              <AdvanceBox s={s} u={u} act={act} />
            </div>
          )}
        </>
      ) : (
        <div className="mt-1 text-[11px] text-slate-400">🔒 {BUILDINGS[CAT_BUILDING[u.cat]].name} {need} 级解锁</div>
      )}
    </div>
  );
}

export function ArmyPanel({ s, act }: { s: GameState; act: Act }) {
  const [cat, setCat] = useState<UnitCat>('inf');
  const [open, setOpen] = useState<string | null>(null);
  const list = CAT_UNITS[cat];
  const bKey = CAT_BUILDING[cat];
  const lvl = s.buildings[bKey];
  const capP = popCap(cat, lvl);
  const used = armyPop(s, cat);
  const q = s.trainQ[cat];
  const adv = s.advQ[cat];
  return (
    <div className="space-y-2 p-3">
      <div className="flex gap-1 rounded-lg bg-slate-900/60 p-1">
        {(['inf', 'veh', 'air'] as UnitCat[]).map((c) => (
          <button key={c} onClick={() => setCat(c)} className={cn('flex-1 rounded-md py-1 text-sm font-bold', cat === c ? 'bg-sky-600 text-white' : 'text-slate-300')}>
            {c === 'inf' ? '🛡 步兵' : c === 'veh' ? '🚜 战车' : '✈ 空军'}
            {(s.trainQ[c].length > 0 || s.advQ[c]) && <span className="ml-1 text-[10px] text-amber-300">●</span>}
          </button>
        ))}
      </div>
      {lvl === 0 ? (
        <div className="rounded-lg bg-slate-900/60 p-4 text-center text-sm text-slate-300">
          需要先建造{BUILDINGS[bKey].name}（主基地 {BUILDINGS[bKey].unlockBase} 级解锁）
        </div>
      ) : (
        <>
          <div>
            <div className="flex justify-between text-xs text-slate-300">
              <span>
                {BUILDINGS[bKey].name} Lv.{lvl} · 编制（含生产中）
              </span>
              <span className="font-bold">
                {used}/{capP}
              </span>
            </div>
            <Bar value={used} max={capP} color="bg-sky-500" />
          </div>

          {q.length > 0 && (
            <div className="space-y-1 rounded-lg border border-sky-600/40 bg-sky-950/30 p-2">
              <div className="text-xs font-bold text-sky-200">生产队列 {q.length}/5</div>
              {q.map((t, i) => (
                <div key={t.id} className="flex items-center gap-2 text-xs">
                  <Sprite id={t.unit} size={22} />
                  <div className="flex-1">
                    <div className="flex justify-between text-slate-200">
                      <span>
                        {ALL_UNITS[t.unit].name} ×{t.count}
                      </span>
                      <span className="text-sky-300">{i === 0 ? fmtDur(t.remaining) : '等待中'}</span>
                    </div>
                    {i === 0 && <Bar value={t.total - t.remaining} max={t.total} color="bg-sky-400" className="h-1" />}
                  </div>
                  {i === 0 && (
                    <Btn variant="gold" className="px-1.5 py-0.5 text-[10px]" disabled={s.res.gold < speedUpCost(t.remaining)} onClick={() => act((d) => speedUpTask(d, 'train', cat))}>
                      加速{fmt(speedUpCost(t.remaining))}金
                    </Btn>
                  )}
                  <button className="text-slate-500 hover:text-rose-400" title="取消（返还80%）" onClick={() => act((d) => cancelTrain(d, cat, t.id))}>
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {adv && (
            <div className="space-y-1 rounded-lg border border-fuchsia-500/40 bg-fuchsia-950/30 p-2 text-xs">
              <div className="flex items-center gap-2">
                <Sprite id={adv.unit} size={22} />
                <span className="flex-1 text-fuchsia-100">
                  进阶中：{ALL_UNITS[adv.unit].name} ×{adv.count} <Stars n={adv.fromStar} /> → <Stars n={adv.fromStar + 1} />
                </span>
                <span className="text-fuchsia-300">{fmtDur(adv.remaining)}</span>
              </div>
              <Bar value={adv.total - adv.remaining} max={adv.total} color="bg-fuchsia-500" className="h-1" />
              <Btn variant="gold" className="w-full py-0.5 text-[11px]" disabled={s.res.gold < speedUpCost(adv.remaining)} onClick={() => act((d) => speedUpTask(d, 'adv', cat))}>
                立即完成（{fmt(speedUpCost(adv.remaining))} 金矿）
              </Btn>
            </div>
          )}

          <div className="rounded bg-slate-900/40 p-1.5 text-[10px] text-slate-400">
            进阶CD：{[1, 2, 3, 4, 5].map((k) => `${k}阶 ${fmtDur(advanceTime(cat, k))}`).join(' · ')}
          </div>

          <div className="max-h-[520px] space-y-1.5 overflow-auto pr-1">
            {list.map((u, i) => (
              <UnitRow key={u.id} s={s} u={u} idx={i} act={act} open={open === u.id} onToggle={() => setOpen(open === u.id ? null : u.id)} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
