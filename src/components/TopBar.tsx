import type { GameState } from '../game/types';
import { RES_INFO, RES_KEYS, powerDemand, powerSupply } from '../game/config';
import { cap, gatherRates, isResUnlocked, nextAttackInfo } from '../game/logic';
import { RES_ICON, Sprite } from '../game/sprites';
import { Btn, fmt, fmtClock, fmtDur } from './ui';
import { cn } from '../utils/cn';

const SCALES = [1, 60, 600, 3600, 36000];
const scaleLabel = (v: number) => (v >= 1000 ? `${v / 1000}k` : `${v}`) + 'x';

export function TopBar({
  s, onScale, onAttackNow, onReset,
}: {
  s: GameState;
  onScale: (v: number) => void;
  onAttackNow: () => void;
  onReset: () => void;
}) {
  const c = cap(s);
  const rates = gatherRates(s);
  const sup = powerSupply(s);
  const dem = powerDemand(s);
  const atk = nextAttackInfo(s);
  const urgent = atk.remaining < 3600;
  return (
    <header className="sticky top-0 z-30 border-b border-slate-700/60 bg-slate-900/90 backdrop-blur">
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2">
        <div className="flex items-center gap-2">
          <Sprite id="base" size={34} />
          <div>
            <h1 className="text-lg font-black tracking-wide text-amber-300 leading-none">家园保卫战</h1>
            <div className="text-[11px] text-slate-400">{fmtClock(s.gameTime)} · 胜 {s.stats.wins} / 负 {s.stats.losses}</div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {RES_KEYS.map((k) => {
            const locked = !isResUnlocked(s, k);
            const full = s.res[k] >= c;
            return (
              <div
                key={k}
                title={locked ? `主基地 ${RES_INFO[k].unlockBase} 级解锁` : RES_INFO[k].name}
                className={cn('flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-2 py-1', locked && 'opacity-40')}
              >
                <Sprite id={RES_ICON[k]} size={20} />
                <div className="leading-tight">
                  <div className={cn('text-sm font-bold tabular-nums', full ? 'text-amber-300' : 'text-white')}>
                    {fmt(s.res[k])}
                    <span className="text-[10px] font-normal text-slate-400">/{fmt(c)}</span>
                  </div>
                  <div className="text-[10px] text-emerald-400 tabular-nums">+{rates[k] >= 100 ? fmt(rates[k]) : rates[k].toFixed(2)}/秒</div>
                </div>
              </div>
            );
          })}
          <div className={cn('flex items-center gap-1.5 rounded-lg border px-2 py-1', sup >= dem ? 'border-slate-700 bg-slate-800/80' : 'border-red-500 bg-red-950/60')} title="电力 供应/需求">
            <Sprite id="ic-power" size={20} />
            <div className="leading-tight">
              <div className={cn('text-sm font-bold tabular-nums', sup >= dem ? 'text-yellow-300' : 'text-red-400')}>
                {Math.floor(sup)}/{Math.floor(dem)}
              </div>
              <div className="text-[10px] text-slate-400">{sup >= dem ? '电力充足' : '电力不足!'}</div>
            </div>
          </div>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div
            className={cn(
              'rounded-lg border px-3 py-1 text-center',
              atk.big ? 'border-fuchsia-500 bg-fuchsia-950/60' : urgent ? 'border-red-500 bg-red-950/50 animate-pulse' : 'border-slate-700 bg-slate-800/80',
            )}
          >
            <div className="text-[10px] text-slate-300">
              第 {atk.n} 次{atk.big ? <b className="text-fuchsia-300">大防守</b> : '怪物进攻'}倒计时
            </div>
            <div className="text-sm font-bold tabular-nums text-rose-300">{fmtDur(atk.remaining)}</div>
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/80 p-1" title="时间流速（方便体验，1x 为真实时间）">
            <span className="px-1 text-[10px] text-slate-400">流速</span>
            {SCALES.map((v) => (
              <button
                key={v}
                onClick={() => onScale(v)}
                className={cn('rounded px-1.5 py-0.5 text-xs font-bold', s.timeScale === v ? 'bg-amber-500 text-amber-950' : 'text-slate-300 hover:bg-slate-700')}
              >
                {scaleLabel(v)}
              </button>
            ))}
          </div>
          <Btn variant="danger" onClick={onAttackNow} title="立即迎接下一波怪物">
            ⚔ 立即迎战
          </Btn>
          <Btn variant="ghost" onClick={onReset} title="清除存档重新开始">
            重置
          </Btn>
        </div>
      </div>
    </header>
  );
}
