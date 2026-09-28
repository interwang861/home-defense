import type { GameState } from '../game/types';
import { BUILDINGS, TECHS, TECH_MAX, researchCost, researchTime } from '../game/config';
import { researchBlock, speedUpCost, speedUpTask, startResearch, techCap } from '../game/logic';
import { Sprite, buildingSprite } from '../game/sprites';
import type { Act } from './Panels';
import { Bar, Btn, CostView, fmt, fmtDur } from './ui';
import { cn } from '../utils/cn';

const ICON: Record<string, string> = {
  atk: '⚔️', hp: '🛡️', speed: '💨', train: '🏭', cost: '💰', build: '🏗️', turretAtk: '🎯', turretSpd: '🔄',
};

export function TechPanel({ s, act }: { s: GameState; act: Act }) {
  const lab = s.buildings.lab;
  const r = s.research;
  return (
    <div className="space-y-2 p-3">
      <div className="flex items-center gap-3">
        <Sprite id={buildingSprite('lab', Math.max(1, lab))} size={52} className={cn(lab === 0 && 'opacity-50 grayscale')} />
        <div>
          <h3 className="font-bold text-white">作战实验室 {lab > 0 ? `Lv.${lab}` : '（未建造）'}</h3>
          <p className="text-[11px] text-slate-400">
            {lab > 0 ? `当前科技等级上限 ${techCap(s)}/${TECH_MAX}（实验室等级 ÷ 2）` : `主基地 ${BUILDINGS.lab.unlockBase} 级后可在地图上建造作战实验室`}
          </p>
        </div>
      </div>
      {r && (
        <div className="space-y-1 rounded-lg border border-emerald-500/40 bg-emerald-950/30 p-2 text-xs">
          <div className="flex justify-between text-emerald-200">
            <span>
              🔬 研发中：{TECHS.find((t) => t.key === r.tech)!.name} → Lv.{r.toLevel}
            </span>
            <span>{fmtDur(r.remaining)}</span>
          </div>
          <Bar value={r.total - r.remaining} max={r.total} color="bg-emerald-400" />
          <Btn variant="gold" className="w-full py-0.5 text-[11px]" disabled={s.res.gold < speedUpCost(r.remaining)} onClick={() => act((d) => speedUpTask(d, 'research', 0))}>
            立即完成（{fmt(speedUpCost(r.remaining))} 金矿）
          </Btn>
        </div>
      )}
      <div className="max-h-[540px] space-y-1.5 overflow-auto pr-1">
        {TECHS.map((t) => {
          const lvl = s.tech[t.key];
          const block = researchBlock(s, t.key);
          const full = lvl >= TECH_MAX;
          return (
            <div key={t.key} className="rounded-lg bg-slate-900/50 p-2">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800 text-xl">{ICON[t.key]}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between">
                    <span className="text-sm font-bold text-white">{t.name}</span>
                    <span className="text-xs text-amber-300">
                      Lv.{lvl}/{TECH_MAX}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {t.desc}：当前 <b className="text-emerald-300">{t.key === 'train' || t.key === 'cost' || t.key === 'build' ? '-' : '+'}{(t.per * lvl).toFixed(1)}{t.unit}</b>
                    {!full && <span className="text-slate-500"> → {(t.per * (lvl + 1)).toFixed(1)}{t.unit}</span>}
                  </div>
                  <Bar value={lvl} max={TECH_MAX} color="bg-emerald-500" className="mt-1 h-1" />
                </div>
              </div>
              {!full && (
                <div className="mt-1.5 flex items-center gap-1.5">
                  <CostView cost={researchCost(t, lvl + 1)} res={s.res} className="flex-1" />
                  <span className="text-[10px] text-slate-400">⏱{fmtDur(researchTime(lvl + 1))}</span>
                  <Btn variant="green" className="px-2 py-0.5 text-xs" disabled={!!block} onClick={() => act((d) => startResearch(d, t.key))}>
                    {block && block !== '资源不足' ? block : '研发'}
                  </Btn>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
