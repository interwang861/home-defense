import type { ReactNode } from 'react';
import type { Cost, Res } from '../game/types';
import { RES_INFO, RES_KEYS } from '../game/config';
import { RES_ICON, Sprite } from '../game/sprites';
import { cn } from '../utils/cn';

export function fmt(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (a >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (a >= 1e4) return (n / 1e3).toFixed(1) + 'K';
  return Math.floor(n).toString();
}

export function fmtDur(sec: number): string {
  sec = Math.max(0, Math.ceil(sec));
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (d > 0) return `${d}天${h}时${m}分`;
  if (h > 0) return `${h}时${m}分${s}秒`;
  if (m > 0) return `${m}分${s}秒`;
  return `${s}秒`;
}

export function fmtClock(gameTime: number): string {
  const day = Math.floor(gameTime / 86400) + 1;
  const h = Math.floor((gameTime % 86400) / 3600);
  const m = Math.floor((gameTime % 3600) / 60);
  return `第${day}天 ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function CostView({ cost, res, className }: { cost: Cost; res?: Res; className?: string }) {
  const keys = RES_KEYS.filter((k) => (cost[k] ?? 0) > 0);
  if (!keys.length) return <span className="text-xs text-slate-400">免费</span>;
  return (
    <div className={cn('flex flex-wrap gap-x-2 gap-y-1', className)}>
      {keys.map((k) => {
        const lack = res ? res[k] < (cost[k] ?? 0) : false;
        return (
          <span key={k} className={cn('flex items-center gap-0.5 text-xs font-medium', lack ? 'text-red-400' : 'text-slate-200')} title={RES_INFO[k].name}>
            <Sprite id={RES_ICON[k]} size={14} />
            {fmt(cost[k] ?? 0)}
          </span>
        );
      })}
    </div>
  );
}

export function Btn({
  children, onClick, disabled, variant = 'primary', className, title,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'ghost' | 'danger' | 'gold' | 'green';
  className?: string;
  title?: string;
}) {
  const styles = {
    primary: 'bg-sky-600 hover:bg-sky-500 text-white border-sky-400/40',
    ghost: 'bg-slate-700/70 hover:bg-slate-600 text-slate-100 border-slate-500/40',
    danger: 'bg-rose-600 hover:bg-rose-500 text-white border-rose-400/40',
    gold: 'bg-amber-500 hover:bg-amber-400 text-amber-950 border-amber-300/60',
    green: 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400/40',
  }[variant];
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'rounded-lg border px-3 py-1.5 text-sm font-semibold shadow transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100',
        styles,
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Bar({ value, max, color = 'bg-emerald-500', className }: { value: number; max: number; color?: string; className?: string }) {
  const p = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-slate-900/70', className)}>
      <div className={cn('h-full rounded-full transition-[width] duration-200', color)} style={{ width: `${p}%` }} />
    </div>
  );
}
