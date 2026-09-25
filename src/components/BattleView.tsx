import { memo, useEffect, useReducer, useRef, useState, type ReactElement } from 'react';
import type { BattleResult, GameState } from '../game/types';
import {
  CX, CY, WH, WW, quickFinish, repairCost, stepBattle, surrender, type BattleState, type BBuilding, type BEnt, type BFx,
} from '../game/battle';
import { ALL_UNITS, BIG_DURATION, MONSTERS, NORMAL_DURATION, RES_INFO, RES_KEYS, isBigAttack, monsterUnlockedCount } from '../game/config';
import { canAfford } from '../game/logic';
import { RES_ICON, Sprite } from '../game/sprites';
import { getVolume, initAudio, isMuted, setMuted, setVolume } from '../game/sound';
import { Bar, Btn, CostView, fmt, fmtDur } from './ui';
import { cn } from '../utils/cn';

const SPEEDS = [1, 2, 4, 8, 16];

function HpBar({ x, y, w, p, color, h = 4 }: { x: number; y: number; w: number; p: number; color: string; h?: number }) {
  return (
    <g>
      <rect x={x - w / 2 - 1} y={y - 1} width={w + 2} height={h + 2} rx="1.5" fill="#000b" />
      <rect x={x - w / 2} y={y} width={Math.max(0, w * p)} height={h} rx="1" fill={color} />
    </g>
  );
}

const Background = memo(function Background({ big }: { big: boolean }) {
  const trees: [number, number][] = [];
  for (let i = 0; i < 46; i++) {
    const a = (i * 137.5 * Math.PI) / 180;
    const x = CX + Math.cos(a) * (560 + ((i * 53) % 120));
    const y = CY + Math.sin(a) * (380 + ((i * 31) % 80));
    if (x > 20 && x < WW - 20 && y > 20 && y < WH - 10) trees.push([x, y]);
  }
  return (
    <g>
      <defs>
        <radialGradient id="bg-grass" cx="50%" cy="48%" r="70%">
          <stop offset="0" stopColor={big ? '#5b6b3a' : '#5fa35a'} />
          <stop offset="0.7" stopColor={big ? '#3f4a2a' : '#3f8a3d'} />
          <stop offset="1" stopColor={big ? '#231a14' : '#27562a'} />
        </radialGradient>
        <radialGradient id="bg-portal">
          <stop offset="0" stopColor="#000" />
          <stop offset="0.5" stopColor={big ? '#86198f' : '#7f1d1d'} stopOpacity="0.9" />
          <stop offset="1" stopColor="#7f1d1d" stopOpacity="0" />
        </radialGradient>
        <pattern id="bg-tex" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M5 35 l2 -5 l2 5 M25 15 l2 -5 l2 5" stroke="#ffffff18" strokeWidth="1.2" fill="none" />
        </pattern>
      </defs>
      <rect width={WW} height={WH} fill="url(#bg-grass)" />
      <rect width={WW} height={WH} fill="url(#bg-tex)" />
      <g stroke="#b99561" strokeWidth="46" opacity="0.45" strokeLinecap="round">
        <line x1={CX} y1={CY} x2={CX} y2={-20} />
        <line x1={CX} y1={CY} x2={CX} y2={WH + 20} />
        <line x1={CX} y1={CY} x2={-20} y2={CY} />
        <line x1={CX} y1={CY} x2={WW + 20} y2={CY} />
        <line x1={CX} y1={CY} x2={-20} y2={-20} strokeWidth="30" />
        <line x1={CX} y1={CY} x2={WW + 20} y2={WH + 20} strokeWidth="30" />
        <line x1={CX} y1={CY} x2={WW + 20} y2={-20} strokeWidth="30" />
        <line x1={CX} y1={CY} x2={-20} y2={WH + 20} strokeWidth="30" />
      </g>
      <ellipse cx={CX} cy={CY + 20} rx="420" ry="330" fill="none" stroke="#b99561" strokeWidth="26" opacity="0.35" />
      <ellipse cx={CX} cy={CY + 20} rx="200" ry="160" fill="#c7a36b" opacity="0.25" />
      {trees.map(([x, y], i) => (
        <use key={i} href="#spr-tree" x={x - 22} y={y - 40} width="44" height="44" opacity="0.9" />
      ))}
      {[[CX, 0], [CX, WH], [0, CY], [WW, CY], [0, 0], [WW, 0], [0, WH], [WW, WH]].map(([x, y], i) => (
        <ellipse key={i} cx={x} cy={y} rx="90" ry="70" fill="url(#bg-portal)" className="portal" />
      ))}
    </g>
  );
});

function BuildingView({ b }: { b: BBuilding }) {
  const dead = b.hp <= 0;
  const p = b.hp / b.maxHp;
  const top = b.y - b.size * 0.69;
  const flt = dead ? 'grayscale(1) brightness(0.35)' : b.hit > 0 ? 'brightness(1.8) saturate(0.6)' : undefined;
  const g = b.gun;
  return (
    <g>
      {b.key === 'turret' ? (
        <g style={flt ? { filter: flt } : undefined}>
          <use href={`#spr-${b.sprite}`} x={b.x - 35} y={b.y - 55} width="70" height="70" />
          {g && !dead && (
            <g transform={`rotate(${(g.angle * 180) / Math.PI} ${g.px} ${g.py})`}>
              <use href={`#spr-turret_gun_t${g.tier}`} x={g.px - 35 - g.fired * 40} y={g.py - 35} width="70" height="70" />
            </g>
          )}
        </g>
      ) : (
        <use href={`#spr-${b.sprite}`} x={b.x - b.size / 2} y={top} width={b.size} height={b.size} style={flt ? { filter: flt } : undefined} />
      )}
      {b.key === 'base' && g && g.fired > 0 && <circle cx={g.px} cy={g.py} r="9" fill="#fde047" opacity="0.8" />}
      {dead ? (
        <g className="smoke">
          <circle cx={b.x - 10} cy={b.y - b.size * 0.4} r="12" fill="#44403c" opacity="0.6" />
          <circle cx={b.x + 8} cy={b.y - b.size * 0.55} r="9" fill="#57534e" opacity="0.5" />
          <circle cx={b.x} cy={b.y - b.size * 0.3} r="6" fill="#f97316" opacity="0.6" />
        </g>
      ) : null}
      <HpBar x={b.x} y={(b.key === 'turret' ? b.y - 62 : top - 8)} w={b.key === 'base' ? 110 : b.key === 'turret' ? 50 : 70} h={b.key === 'base' ? 6 : 4} p={Math.max(0, p)} color={p > 0.5 ? '#22c55e' : p > 0.25 ? '#eab308' : '#ef4444'} />
      <text x={b.x} y={(b.key === 'turret' ? b.y - 66 : top - 11)} textAnchor="middle" fontSize="10" fontWeight="bold" fill="#fff" stroke="#000" strokeWidth="2.5" paintOrder="stroke">
        {b.name} Lv.{b.level}
      </text>
    </g>
  );
}

function EntView({ e }: { e: BEnt }) {
  const s = e.size * (e.air ? 0.6 + 0.4 * e.alt : 1);
  let bob = 0;
  if (e.type === 'jiangshi') bob = -Math.abs(Math.sin(e.phase * 0.8)) * 10;
  else if (!e.air) bob = Math.sin(e.phase * 2) * 1.2;
  const lift = e.air ? 45 * e.alt + Math.sin(e.phase * 0.7) * 3 : 0;
  const flip = e.side === 'enemy' ? e.dir > 0 : e.dir < 0;
  const lunge = e.atkAnim > 0 ? (e.side === 'enemy' ? -1 : 1) * (flip ? -1 : 1) * 4 : 0;
  const hpP = Math.max(0, e.hp / e.maxHp);
  const y0 = e.y + bob - lift;
  return (
    <g>
      {e.air && <ellipse cx={e.x} cy={e.y} rx={s * 0.35} ry={s * 0.1} fill="#0005" />}
      <g transform={`translate(${e.x.toFixed(1)},${y0.toFixed(1)}) scale(${flip ? -1 : 1},1)`}>
        {!e.air && <ellipse cx="0" cy="-1" rx={s * 0.3} ry={s * 0.07} fill="#0004" />}
        <use href={`#spr-${e.type}`} x={-s / 2 + lunge} y={-s} width={s} height={s} style={e.hit > 0 ? { filter: 'brightness(2.2) saturate(0.3)' } : undefined} />
      </g>
      {e.boss && (
        <text x={e.x} y={y0 - s - 12} textAnchor="middle" fontSize="12" fontWeight="bold" fill="#f0abfc" stroke="#000" strokeWidth="2" paintOrder="stroke">
          👑首领
        </text>
      )}
      <HpBar x={e.x} y={y0 - s - 5} w={Math.max(18, s * 0.6)} h={3} p={hpP} color={e.side === 'ally' ? '#22c55e' : '#ef4444'} />
      {e.star > 0 && (
        <text x={e.x} y={y0 - s - 7} textAnchor="middle" fontSize="8" fill="#fde047" stroke="#000" strokeWidth="1.5" paintOrder="stroke">
          {'★'.repeat(e.star)}
        </text>
      )}
    </g>
  );
}

function FxView({ f }: { f: BFx }) {
  if (f.t < 0) return null;
  const k = f.t / f.max;
  const o = 1 - k;
  if (f.kind === 'proj') {
    const x = f.x1 + (f.x2 - f.x1) * k;
    const y = f.y1 + (f.y2 - f.y1) * k;
    const tx = f.x1 + (f.x2 - f.x1) * Math.max(0, k - 0.18);
    const ty = f.y1 + (f.y2 - f.y1) * Math.max(0, k - 0.18);
    return (
      <g>
        <line x1={tx} y1={ty} x2={x} y2={y} stroke={f.color} strokeWidth={f.r * 0.9} opacity="0.5" strokeLinecap="round" />
        <circle cx={x} cy={y} r={f.r} fill={f.color} />
        {f.big && <circle cx={x} cy={y} r={f.r * 2} fill={f.color} opacity="0.3" />}
      </g>
    );
  }
  if (f.kind === 'beam')
    return (
      <g opacity={o}>
        <line x1={f.x1} y1={f.y1} x2={f.x2} y2={f.y2} stroke={f.color} strokeWidth={f.r * 1.6} opacity="0.35" strokeLinecap="round" />
        <line x1={f.x1} y1={f.y1} x2={f.x2} y2={f.y2} stroke="#fff" strokeWidth={f.r * 0.4} strokeLinecap="round" />
      </g>
    );
  if (f.kind === 'muzzle') return <circle cx={f.x1} cy={f.y1} r={f.r * (1 - k * 0.5)} fill={f.color} opacity={o} />;
  if (f.kind === 'slash')
    return (
      <g opacity={o} stroke={f.color} strokeWidth="2.5" strokeLinecap="round">
        <line x1={f.x1 - f.r} y1={f.y1 - f.r} x2={f.x1 + f.r} y2={f.y1 + f.r} />
        <line x1={f.x1 + f.r} y1={f.y1 - f.r} x2={f.x1 - f.r} y2={f.y1 + f.r} />
      </g>
    );
  return (
    <g>
      <circle cx={f.x1} cy={f.y1} r={Math.max(3, f.r * (0.3 + k * 0.9))} fill={f.color} opacity={o * 0.55} />
      <circle cx={f.x1} cy={f.y1} r={Math.max(2, f.r * (0.15 + k * 0.5))} fill="#fff7c2" opacity={o * 0.6} />
    </g>
  );
}

export function BattleView({
  battle, gs, onRepair, onDone,
}: {
  battle: BattleState;
  gs: GameState;
  onRepair: (b: BattleState) => string | void;
  onDone: (b: BattleState) => void;
}) {
  const bRef = useRef(battle);
  const [speed, setSpeed] = useState(1);
  const [paused, setPaused] = useState(false);
  const [msg, setMsg] = useState('');
  const [vol, setVol] = useState(getVolume());
  const [mute, setMute] = useState(isMuted());
  const speedRef = useRef(1);
  const pausedRef = useRef(false);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const [, force] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  // 进入战斗即初始化音频（此时必定来自玩家点击，浏览器允许出声）
  useEffect(() => {
    initAudio();
  }, []);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let reported = false;
    const loop = (now: number) => {
      const dtReal = Math.min(0.1, (now - last) / 1000);
      last = now;
      const b = bRef.current;
      if (!pausedRef.current && !b.over) {
        let t = dtReal * speedRef.current;
        while (t > 0 && !b.over) {
          const st = Math.min(0.05, t);
          stepBattle(b, st, true);
          t -= st;
        }
      }
      if (b.over && !reported) {
        reported = true;
        setTimeout(() => doneRef.current(b), 1500);
      }
      force();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const b = bRef.current;
  const base = b.buildings.find((x) => x.key === 'base')!;
  const allies = b.ents.filter((e) => e.side === 'ally');
  const out = allies.filter((e) => e.out).length;
  const enemies = b.ents.filter((e) => e.side === 'enemy');
  const rc = repairCost(b);

  type Item = { y: number; k: string; node: ReactElement };
  const items: Item[] = [];
  for (const bd of b.buildings) items.push({ y: bd.y, k: bd.id, node: <BuildingView key={bd.id} b={bd} /> });
  for (const e of b.ents) if (e.out && !e.air) items.push({ y: e.y, k: `e${e.id}`, node: <EntView key={e.id} e={e} /> });
  items.sort((a, c) => a.y - c.y);
  const airs = b.ents.filter((e) => e.out && e.air).sort((a, c) => a.y - c.y);

  const doRepair = () => {
    if (b.repairCdLeft > 0) return;
    const r = onRepair(b);
    if (typeof r === 'string') {
      setMsg(r);
      setTimeout(() => setMsg(''), 1500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-700 bg-slate-900 px-3 py-2">
        <div>
          <div className={cn('text-lg font-black', b.big ? 'text-fuchsia-300' : 'text-rose-300')}>⚔ 第 {b.n} 次{b.big ? '大防守' : '防守战'}</div>
          <div className="text-xs text-slate-400">守住主基地 {fmtDur(b.duration)} 即获胜</div>
        </div>
        <div className="min-w-[150px] flex-1">
          <div className="flex justify-between text-xs text-slate-300">
            <span>剩余时间</span>
            <span className="font-bold tabular-nums text-amber-300">{fmtDur(b.duration - b.time)}</span>
          </div>
          <Bar value={b.time} max={b.duration} color="bg-amber-400" />
        </div>
        <div className="min-w-[170px] flex-1">
          <div className="flex justify-between text-xs text-slate-300">
            <span>🏰 主基地生命</span>
            <span className="font-bold tabular-nums">{fmt(base.hp)}/{fmt(base.maxHp)}</span>
          </div>
          <Bar value={base.hp} max={base.maxHp} color={base.hp / base.maxHp > 0.35 ? 'bg-emerald-500' : 'bg-red-500'} />
        </div>
        <div className="flex gap-3 text-xs text-slate-300">
          <span>我方 <b className="text-emerald-400">{out}</b>{allies.length > out && <span className="text-slate-500">(+{allies.length - out}出动中)</span>}</span>
          <span>敌方 <b className="text-rose-400">{enemies.length}</b></span>
          <span>击杀 <b className="text-amber-300">{b.kills}</b></span>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-1">
        <svg viewBox={`0 0 ${WW} ${WH}`} className="h-full w-full rounded-lg border-2 border-slate-700" preserveAspectRatio="xMidYMid meet">
          <Background big={b.big} />
          {items.map((it) => it.node)}
          {airs.map((e) => (
            <EntView key={e.id} e={e} />
          ))}
          {b.fx.map((f) => (
            <FxView key={f.id} f={f} />
          ))}
          {b.over && (
            <g>
              <rect width={WW} height={WH} fill="#000a" />
              <text x={WW / 2} y={WH / 2} textAnchor="middle" fontSize="80" fontWeight="900" fill={b.victory ? '#fde047' : '#f87171'} stroke="#000" strokeWidth="3" paintOrder="stroke">
                {b.victory ? '防守成功！' : '防守失败…'}
              </text>
            </g>
          )}
        </svg>
        <div className="pointer-events-none absolute left-3 top-3 space-y-1">
          {b.events.slice(-4).map((ev) => (
            <div key={ev.id} className="toast-in rounded bg-black/60 px-2 py-1 text-xs font-semibold text-amber-100">
              {ev.text}
            </div>
          ))}
        </div>
        {paused && !b.over && <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-5xl font-black text-white/80">暂停中</div>}
        {msg && <div className="absolute left-1/2 top-6 -translate-x-1/2 rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white shadow">{msg}</div>}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-slate-700 bg-slate-900 px-3 py-2">
        <div className="flex items-center gap-1 rounded-lg bg-slate-800 p-1">
          <span className="px-1 text-xs text-slate-400">速度</span>
          {SPEEDS.map((v) => (
            <button key={v} onClick={() => setSpeed(v)} className={cn('rounded px-2 py-0.5 text-xs font-bold', speed === v ? 'bg-amber-500 text-amber-950' : 'text-slate-300 hover:bg-slate-700')}>
              {v}x
            </button>
          ))}
        </div>
        <Btn variant="ghost" onClick={() => setPaused((p) => !p)} disabled={b.over}>
          {paused ? '▶ 继续' : '⏸ 暂停'}
        </Btn>
        <div className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-2 py-1" title="战斗音效音量">
          <button
            onClick={() => {
              const m = !mute;
              setMute(m);
              setMuted(m);
              if (!m) initAudio();
            }}
            className="text-base leading-none"
          >
            {mute || vol === 0 ? '🔇' : '🔊'}
          </button>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(vol * 100)}
            onChange={(e) => {
              const v = Number(e.target.value) / 100;
              setVol(v);
              setVolume(v);
              if (v > 0 && mute) {
                setMute(false);
                setMuted(false);
              }
              initAudio();
            }}
            className="w-20 accent-amber-400"
          />
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-slate-800 px-2 py-1">
          <Btn variant="green" onClick={doRepair} disabled={b.over || b.repairCdLeft > 0 || !canAfford(gs.res, rc)} className="py-1">
            🔧 抢修建筑 {b.repairCdLeft > 0 ? `(${Math.ceil(b.repairCdLeft)}s)` : ''}
          </Btn>
          <CostView cost={rc} res={gs.res} />
        </div>
        <div className="ml-auto flex gap-2">
          <Btn variant="primary" disabled={b.over} onClick={() => { quickFinish(b); force(); }}>
            ⏩ 快速结算
          </Btn>
          <Btn variant="danger" disabled={b.over} onClick={() => { if (confirm('确定放弃防守吗？将判定为失败并损失 5% 资源。')) surrender(b); }}>
            🏳 放弃
          </Btn>
        </div>
      </div>
    </div>
  );
}

export function AttackAlert({ gs, onFight, onAuto }: { gs: GameState; onFight: () => void; onAuto: () => void }) {
  const n = gs.attackCount + 1;
  const big = isBigAttack(n);
  const unlocked = monsterUnlockedCount(n, big);
  const armyList = Object.entries(gs.army).map(([id, arr]) => [id, arr.reduce((a, c) => a + c, 0)] as const).filter(([, c]) => c > 0);
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4">
      <div className={cn('w-full max-w-lg rounded-2xl border-2 bg-slate-900 p-5 shadow-2xl', big ? 'border-fuchsia-500' : 'border-rose-500')}>
        <div className="text-center">
          <div className="text-4xl">{big ? '☠️' : '⚠️'}</div>
          <h2 className={cn('mt-1 text-2xl font-black', big ? 'text-fuchsia-300' : 'text-rose-300')}>{big ? '大防守来袭！' : '怪物来袭！'}</h2>
          <p className="mt-1 text-sm text-slate-300">
            第 {n} 次进攻 · 需要坚守 {fmtDur(big ? BIG_DURATION : NORMAL_DURATION)}
            {big && '，怪物将持续猛攻并伴有首领！'}
          </p>
        </div>
        <div className="mt-4">
          <div className="mb-1 text-xs font-bold text-slate-400">可能出现的怪物</div>
          <div className="flex flex-wrap gap-1">
            {MONSTERS.slice(0, unlocked).map((m) => (
              <div key={m.id} className="flex flex-col items-center rounded bg-slate-800 p-1" title={m.desc}>
                <Sprite id={m.id} size={36} />
                <span className="text-[10px] text-slate-300">{m.name}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-3">
          <div className="mb-1 text-xs font-bold text-slate-400">我方部队</div>
          {armyList.length === 0 ? (
            <div className="rounded bg-slate-800 p-2 text-xs text-amber-300">没有任何部队！只能依靠炮塔和主基地主炮防守。</div>
          ) : (
            <div className="flex flex-wrap gap-1">
              {armyList.map(([id, c]) => (
                <div key={id} className="flex items-center gap-1 rounded bg-slate-800 px-1.5 py-0.5 text-xs text-slate-200">
                  <Sprite id={id} size={22} />
                  {ALL_UNITS[id]?.name} ×{c}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="mt-3 rounded-lg bg-slate-800/70 p-2 text-xs text-slate-300">
          胜利：获得当前资源 <b className="text-emerald-400">+6%</b>　失败：损失当前资源 <b className="text-rose-400">-5%</b>
        </div>
        <div className="mt-4 flex gap-2">
          <Btn variant="danger" className="flex-1 py-2.5 text-base" onClick={onFight}>⚔ 亲自指挥</Btn>
          <Btn variant="ghost" className="flex-1 py-2.5 text-base" onClick={onAuto}>⏩ 自动结算</Btn>
        </div>
      </div>
    </div>
  );
}

export function ResultModal({ r, onClose }: { r: BattleResult; onClose: () => void }) {
  const lost = Object.entries(r.lost).filter(([, c]) => c > 0);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
      <div className={cn('w-full max-w-md rounded-2xl border-2 bg-slate-900 p-5 text-center shadow-2xl', r.victory ? 'border-amber-400' : 'border-rose-600')}>
        <div className="text-5xl">{r.victory ? '🏆' : '💀'}</div>
        <h2 className={cn('mt-1 text-2xl font-black', r.victory ? 'text-amber-300' : 'text-rose-400')}>{r.victory ? '防守胜利！' : '防守失败'}</h2>
        <p className="text-sm text-slate-400">第 {r.n} 次{r.big ? '大防守' : '防守'} · 击杀 {r.kills} 只怪物</p>
        <div className="mt-3 grid grid-cols-5 gap-1">
          {RES_KEYS.map((k) => (
            <div key={k} className="rounded bg-slate-800 p-1">
              <Sprite id={RES_ICON[k]} size={18} className="mx-auto" />
              <div className={cn('text-xs font-bold', r.resDelta[k] >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
                {r.resDelta[k] >= 0 ? '+' : ''}
                {fmt(r.resDelta[k])}
              </div>
              <div className="text-[9px] text-slate-500">{RES_INFO[k].name}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 text-left">
          <div className="mb-1 text-xs font-bold text-slate-400">部队损失</div>
          {lost.length === 0 ? (
            <div className="text-xs text-emerald-400">无损失</div>
          ) : (
            <div className="flex flex-wrap gap-1">
              {lost.map(([id, c]) => (
                <div key={id} className="flex items-center gap-1 rounded bg-rose-950/50 px-1.5 py-0.5 text-xs text-rose-200">
                  <Sprite id={id} size={20} />
                  {ALL_UNITS[id]?.name} -{c}
                </div>
              ))}
            </div>
          )}
        </div>
        <Btn variant={r.victory ? 'gold' : 'primary'} className="mt-4 w-full py-2.5" onClick={onClose}>返回家园</Btn>
      </div>
    </div>
  );
}
