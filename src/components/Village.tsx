import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from 'react';
import type { BuildingKey, GameState, ResKey } from '../game/types';
import { BUILDINGS, RES_INFO, RES_KEYS, TURRET_UNLOCK, gatherRate, houseCapacity, maxHouses, tierName } from '../game/config';
import { findTask, isResUnlocked } from '../game/logic';
import { RES_NODE, Sprite, TurretSprite, buildingSprite } from '../game/sprites';
import { clockParts } from './ui';
import { cn } from '../utils/cn';

export type Selection =
  | { kind: 'building'; key: BuildingKey }
  | { kind: 'house'; id: number }
  | { kind: 'turret'; idx: number }
  | { kind: 'resource'; key: ResKey }
  | { kind: 'newhouse' };

/** 世界尺寸固定，视口小于世界时靠拖动浏览 */
const W = 1800;
const H = 1460;
const MIN_K = 0.22;
const MAX_K = 1.6;

interface NodePos {
  x: number;
  y: number;
  size: number;
}

const BPOS: Record<BuildingKey, NodePos> = {
  engineer: { x: 900, y: 285, size: 132 },
  power: { x: 520, y: 380, size: 152 },
  warehouse: { x: 1280, y: 380, size: 152 },
  base: { x: 900, y: 645, size: 218 },
  barracks: { x: 415, y: 705, size: 168 },
  factory: { x: 1385, y: 705, size: 168 },
  airbase: { x: 615, y: 1010, size: 178 },
  lab: { x: 1185, y: 1010, size: 152 },
};

const TPOS: NodePos[] = [
  { x: 706, y: 472, size: 98 },
  { x: 1094, y: 472, size: 98 },
  { x: 706, y: 818, size: 98 },
  { x: 1094, y: 818, size: 98 },
];

const RPOS: Record<ResKey, NodePos> = {
  wood: { x: 178, y: 215, size: 134 },
  stone: { x: 168, y: 665, size: 134 },
  iron: { x: 188, y: 1125, size: 134 },
  gold: { x: 1628, y: 300, size: 134 },
  oil: { x: 1622, y: 905, size: 134 },
};

const HOUSE_X = [480, 640, 800, 960, 1120, 1280];
const HSLOTS: NodePos[] = [
  ...HOUSE_X.map((x) => ({ x, y: 1262, size: 104 })),
  ...HOUSE_X.map((x) => ({ x, y: 1378, size: 104 })),
];

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
interface View {
  x: number;
  y: number;
  k: number;
}

function clampView(v: View, cw: number, ch: number): View {
  const k = clamp(v.k, MIN_K, MAX_K);
  const ww = W * k;
  const hh = H * k;
  const m = 80;
  const x = ww <= cw ? (cw - ww) / 2 : clamp(v.x, cw - ww - m, m);
  const y = hh <= ch ? (ch - hh) / 2 : clamp(v.y, ch - hh - m, m);
  return { x, y, k };
}

function initialView(cw: number, ch: number): View {
  // 手机上不缩到能看全，而是给一个能看清建筑的倍率，让玩家自己拖动探索
  const k = cw < 760 ? clamp(cw / 600, 0.52, 1) : Math.min(cw / W, ch / H) * 0.98;
  return clampView({ x: cw / 2 - BPOS.base.x * k, y: ch / 2 - BPOS.base.y * k, k }, cw, ch);
}

/** 按真实钟点给地图打光，让家园有昼夜变化 */
function dayTint(hour: number) {
  if (hour < 5) return { night: 0.66, warm: 0, warmColor: '#1e3a8a', label: '深夜' };
  if (hour < 7) return { night: 0.34, warm: 0.3, warmColor: '#f0a868', label: '黎明' };
  if (hour < 9) return { night: 0.06, warm: 0.24, warmColor: '#ffd9a0', label: '清晨' };
  if (hour < 16) return { night: 0, warm: 0, warmColor: '#ffffff', label: '白昼' };
  if (hour < 18) return { night: 0.05, warm: 0.28, warmColor: '#ffbe73', label: '午后' };
  if (hour < 20) return { night: 0.22, warm: 0.42, warmColor: '#e2703a', label: '黄昏' };
  return { night: 0.52, warm: 0.1, warmColor: '#7c6bd6', label: '夜晚' };
}

function TaskBar({ remaining, total, scale }: { remaining: number; total: number; scale: number }) {
  const p = clamp(1 - remaining / total, 0, 1) * 100;
  return (
    <div className="mt-1 h-2 w-24 overflow-hidden rounded-full bg-black/70 ring-1 ring-white/15" style={{ transform: `scale(${scale})`, transformOrigin: 'top center' }}>
      <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-300 transition-[width] duration-300" style={{ width: `${p}%` }} />
    </div>
  );
}

function Label({ children, scale, tone = 'default' }: { children: ReactNode; scale: number; tone?: 'default' | 'locked' }) {
  return (
    <div
      className={cn(
        'pointer-events-none absolute left-1/2 top-full mt-1 whitespace-nowrap rounded-md bg-slate-950/80 px-2 py-0.5 text-[15px] font-bold text-white shadow-lg ring-1 backdrop-blur-sm',
        tone === 'locked' ? 'text-slate-400 ring-white/10' : 'ring-white/20',
      )}
      style={{ transform: `translate(-50%, 0) scale(${scale})`, transformOrigin: 'top center' }}
    >
      {children}
    </div>
  );
}

export function Village({ s, sel, onSelect }: { s: GameState; sel: Selection | null; onSelect: (x: Selection) => void }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const sizeRef = useRef({ w: 0, h: 0 });
  const inited = useRef(false);
  const suppressTap = useRef(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef({
    mode: 'none' as 'none' | 'pan' | 'pinch',
    sx: 0, sy: 0, tx: 0, ty: 0, k0: 1,
    dist: 0, mx: 0, my: 0,
    lx: 0, ly: 0, lt: 0, vx: 0, vy: 0,
  });
  const raf = useRef(0);
  const [view, setView] = useState<View>({ x: 0, y: 0, k: 0.6 });
  const viewRef = useRef(view);
  viewRef.current = view;
  const [hint, setHint] = useState(true);

  const applyView = useCallback((v: View) => {
    const { w, h } = sizeRef.current;
    setView(clampView(v, w, h));
  }, []);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (r.width < 2) return;
      sizeRef.current = { w: r.width, h: r.height };
      if (!inited.current) {
        inited.current = true;
        setView(initialView(r.width, r.height));
      } else {
        setView((v) => clampView(v, r.width, r.height));
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setHint(false), 6000);
    return () => clearTimeout(t);
  }, []);

  const zoomAt = useCallback(
    (px: number, py: number, factor: number) => {
      setView((v) => {
        const k = clamp(v.k * factor, MIN_K, MAX_K);
        const r = k / v.k;
        return clampView({ x: px - (px - v.x) * r, y: py - (py - v.y) * r, k }, sizeRef.current.w, sizeRef.current.h);
      });
    },
    [],
  );

  const stopInertia = () => {
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = 0;
  };

  const startInertia = useCallback(() => {
    const g = gesture.current;
    if (Math.hypot(g.vx, g.vy) < 0.25) return;
    let vx = g.vx;
    let vy = g.vy;
    const step = () => {
      vx *= 0.93;
      vy *= 0.93;
      if (Math.hypot(vx, vy) < 0.08) {
        raf.current = 0;
        return;
      }
      setView((v) => clampView({ ...v, x: v.x + vx, y: v.y + vy }, sizeRef.current.w, sizeRef.current.h));
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
  }, []);

  const local = (e: { clientX: number; clientY: number }) => {
    const r = wrapRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  // 单指不抢占指针捕获，否则建筑按钮收不到 pointerup，点不动；
  // 触屏本身有隐式捕获，鼠标拖出边界的情况由 window 监听兜底。
  const onPointerDown = (e: RPointerEvent) => {
    stopInertia();
    suppressTap.current = false;
    setHint(false);
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    const g = gesture.current;
    g.vx = 0;
    g.vy = 0;
    g.lt = performance.now();
    g.tx = viewRef.current.x;
    g.ty = viewRef.current.y;
    g.k0 = viewRef.current.k;
    g.lx = p.x;
    g.ly = p.y;
    if (pointers.current.size === 1) {
      g.mode = 'pan';
      g.sx = p.x;
      g.sy = p.y;
    } else if (pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      g.mode = 'pinch';
      g.dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      g.mx = (a.x + b.x) / 2;
      g.my = (a.y + b.y) / 2;
      // 双指缩放时才捕获，保证两根手指移出容器也能继续缩放
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* 忽略 */
      }
    }
  };

  const onPointerMove = (e: RPointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    const g = gesture.current;
    if (g.mode === 'pan' && pointers.current.size === 1) {
      const dx = p.x - g.sx;
      const dy = p.y - g.sy;
      if (Math.hypot(dx, dy) > 7) suppressTap.current = true;
      const now = performance.now();
      const dt = Math.max(8, now - g.lt);
      g.vx = ((p.x - g.lx) / dt) * 16;
      g.vy = ((p.y - g.ly) / dt) * 16;
      g.lx = p.x;
      g.ly = p.y;
      g.lt = now;
      applyView({ x: g.tx + dx, y: g.ty + dy, k: viewRef.current.k });
    } else if (g.mode === 'pinch' && pointers.current.size >= 2) {
      suppressTap.current = true;
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      // 保持手势开始时中点下方的那块世界坐标不动
      const k = clamp((dist / g.dist) * g.k0, MIN_K, MAX_K);
      applyView({
        x: mid.x - ((g.mx - g.tx) / g.k0) * k,
        y: mid.y - ((g.my - g.ty) / g.k0) * k,
        k,
      });
    }
  };

  const endPointer = (e: RPointerEvent) => {
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (pointers.current.size === 0) {
      g.mode = 'none';
      startInertia();
    } else if (pointers.current.size === 1) {
      const only = [...pointers.current.values()][0];
      g.mode = 'pan';
      g.sx = only.x;
      g.sy = only.y;
      g.lx = only.x;
      g.ly = only.y;
      g.lt = performance.now();
      g.vx = 0;
      g.vy = 0;
      g.tx = viewRef.current.x;
      g.ty = viewRef.current.y;
      g.k0 = viewRef.current.k;
    }
  };

  useEffect(() => () => stopInertia(), []);

  // 鼠标在容器外松开时也要正常结束手势
  useEffect(() => {
    const up = () => {
      if (pointers.current.size === 0) return;
      pointers.current.clear();
      gesture.current.mode = 'none';
      startInertia();
    };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, []);

  // 用原生非被动监听，滚轮缩放时不带动页面滚动
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onW = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAt(e.clientX - r.left, e.clientY - r.top, e.deltaY < 0 ? 1.12 : 1 / 1.12);
    };
    el.addEventListener('wheel', onW, { passive: false });
    return () => el.removeEventListener('wheel', onW);
  }, [zoomAt]);

  const tap = (x: Selection) => () => {
    if (suppressTap.current) return;
    onSelect(x);
  };

  // 标签反向缩放，缩到全景也看得清，放大到最近也不会糊成一片
  const ls = clamp(1 / view.k, 0.72, 1.9);
  const mh = maxHouses(s.buildings.base);
  const tint = dayTint(Number(clockParts(s.gameTime).hh));

  // 小地图视口矩形
  const vp = {
    x: -view.x / view.k,
    y: -view.y / view.k,
    w: sizeRef.current.w / view.k,
    h: sizeRef.current.h / view.k,
  };

  const jumpTo = (wx: number, wy: number) => {
    const { w, h } = sizeRef.current;
    applyView({ x: w / 2 - wx * view.k, y: h / 2 - wy * view.k, k: view.k });
  };

  const roads: [number, number][] = [
    [BPOS.engineer.x, BPOS.engineer.y], [BPOS.power.x, BPOS.power.y], [BPOS.warehouse.x, BPOS.warehouse.y],
    [BPOS.barracks.x, BPOS.barracks.y], [BPOS.factory.x, BPOS.factory.y], [BPOS.airbase.x, BPOS.airbase.y],
    [BPOS.lab.x, BPOS.lab.y],
    ...(Object.keys(RPOS) as ResKey[]).map((k) => [RPOS[k].x, RPOS[k].y] as [number, number]),
    ...HSLOTS.slice(0, 6).map((p) => [p.x, p.y] as [number, number]),
  ];

  return (
    <div
      ref={wrapRef}
      className="relative h-[clamp(400px,64vh,860px)] w-full touch-none select-none overflow-hidden rounded-2xl border-4 border-emerald-950/80 bg-emerald-950 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.9)]"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
    >
      {/* ---------- 世界 ---------- */}
      <div
        className="absolute left-0 top-0 origin-top-left will-change-transform"
        style={{ width: W, height: H, transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.k})` }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_44%,#5aa854_0%,#47913f_38%,#357a34_68%,#255c2a_100%)]" />
        <svg className="absolute inset-0" width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
          <defs>
            <pattern id="v-grass" width="34" height="34" patternUnits="userSpaceOnUse">
              <path d="M6 28 l2 -7 l2 7 M22 16 l2 -7 l2 7" stroke="#6cb863" strokeWidth="1.6" fill="none" opacity="0.5" />
            </pattern>
            <radialGradient id="v-glow" cx="50%" cy="44%" r="42%">
              <stop offset="0" stopColor="#ffe9a8" stopOpacity="0.22" />
              <stop offset="1" stopColor="#ffe9a8" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width={W} height={H} fill="url(#v-grass)" />
          <rect width={W} height={H} fill="url(#v-glow)" />
          {/* 道路 */}
          <g stroke="#c9a26b" strokeWidth="30" strokeLinecap="round" opacity="0.55" fill="none">
            {roads.map(([x, y], i) => (
              <path key={i} d={`M${BPOS.base.x} ${BPOS.base.y} Q${(BPOS.base.x + x) / 2 + (y - BPOS.base.y) * 0.12} ${(BPOS.base.y + y) / 2 - (x - BPOS.base.x) * 0.12} ${x} ${y}`} />
            ))}
          </g>
          <g stroke="#e8cf9f" strokeWidth="3" strokeLinecap="round" strokeDasharray="22 20" opacity="0.5" fill="none">
            {roads.map(([x, y], i) => (
              <path key={i} d={`M${BPOS.base.x} ${BPOS.base.y} Q${(BPOS.base.x + x) / 2 + (y - BPOS.base.y) * 0.12} ${(BPOS.base.y + y) / 2 - (x - BPOS.base.x) * 0.12} ${x} ${y}`} />
            ))}
          </g>
          {/* 基地围墙 */}
          <ellipse cx={BPOS.base.x} cy={BPOS.base.y + 20} rx="300" ry="250" fill="none" stroke="#a8a29e" strokeWidth="14" opacity="0.55" strokeDasharray="46 16" />
          <ellipse cx={BPOS.base.x} cy={BPOS.base.y + 20} rx="300" ry="250" fill="#00000010" />
        </svg>

        {/* ---------- 资源点 ---------- */}
        {RES_KEYS.map((k) => {
          const p = RPOS[k];
          const locked = !isResUnlocked(s, k);
          const workers = s.residents.filter((r) => r.job === k);
          const rate = workers.reduce((a, r) => a + gatherRate(s, k, r.level), 0);
          const me: Selection = { kind: 'resource', key: k };
          const on = sel?.kind === 'resource' && sel.key === k;
          return (
            <button
              key={k}
              onPointerUp={tap(me)}
              className={cn('group absolute -translate-x-1/2 -translate-y-1/2 transition-transform duration-200', on && 'z-20')}
              style={{ left: p.x, top: p.y, width: p.size, height: p.size }}
            >
              <span className={cn('absolute inset-0 rounded-2xl transition-all duration-200', on ? 'bg-amber-300/20 ring-4 ring-amber-300' : 'group-active:bg-white/10')} />
              <span className={cn('relative flex h-full w-full items-center justify-center', locked && 'opacity-45 grayscale')}>
                <Sprite id={RES_NODE[k]} size={p.size * 0.62} className="drop-shadow-lg" />
                <Sprite id={RES_NODE[k]} size={p.size * 0.46} className="-ml-6 mt-5 drop-shadow-lg" />
                {workers.slice(0, 4).map((r, i) => (
                  <Sprite
                    key={r.id}
                    id="worker"
                    size={p.size * 0.22}
                    className="dig absolute drop-shadow"
                    style={{ left: p.size * 0.1 + i * p.size * 0.2, bottom: -p.size * 0.06, animationDelay: `${i * 0.18}s` }}
                  />
                ))}
              </span>
              <Label scale={ls} tone={locked ? 'locked' : 'default'}>
                {RES_INFO[k].zone}
                {locked ? (
                  <span className="ml-1 text-slate-400">🔒{RES_INFO[k].unlockBase}级</span>
                ) : (
                  <span className="ml-1 font-normal text-emerald-300">👷{workers.length} · +{rate.toFixed(2)}/s</span>
                )}
              </Label>
            </button>
          );
        })}

        {/* ---------- 建筑 ---------- */}
        {(Object.keys(BPOS) as BuildingKey[]).map((key) => {
          const p = BPOS[key];
          const lvl = s.buildings[key];
          const def = BUILDINGS[key];
          const locked = s.buildings.base < def.unlockBase;
          const task = findTask(s, { kind: 'building', key });
          const me: Selection = { kind: 'building', key };
          const on = sel?.kind === 'building' && sel.key === key;
          return (
            <button
              key={key}
              onPointerUp={tap(me)}
              className={cn('group absolute -translate-x-1/2 -translate-y-1/2 transition-transform duration-200', on && 'z-20')}
              style={{ left: p.x, top: p.y, width: p.size, height: p.size }}
            >
              <span className={cn('absolute inset-0 rounded-2xl transition-all duration-200', on ? 'bg-amber-300/20 ring-4 ring-amber-300' : 'group-active:bg-white/10')} />
              {on && <span className="ring-pulse absolute -inset-3 rounded-3xl border-2 border-amber-300/60" />}
              <span className={cn('relative flex h-full w-full items-center justify-center', (locked || lvl === 0) && 'opacity-40 grayscale', task && 'building-work')}>
                <Sprite id={buildingSprite(key, Math.max(1, lvl))} size={p.size} className="drop-shadow-[0_10px_12px_rgba(0,0,0,0.45)]" />
                {task && <span className="absolute -right-2 -top-2 text-4xl drop-shadow">🔨</span>}
              </span>
              <Label scale={ls} tone={locked ? 'locked' : 'default'}>
                {lvl > 0 && !locked ? tierName(key, lvl) : def.name}
                {locked ? (
                  <span className="ml-1 text-slate-400">🔒{def.unlockBase}级</span>
                ) : lvl === 0 ? (
                  <span className="ml-1 font-normal text-slate-400">未建造</span>
                ) : (
                  <span className="ml-1.5 rounded bg-amber-400/20 px-1 py-px text-[13px] font-black tabular-nums text-amber-300 ring-1 ring-amber-400/30">
                    Lv.{lvl}
                  </span>
                )}
              </Label>
              {task && (
                <div className="absolute left-1/2 top-full mt-11 -translate-x-1/2">
                  <TaskBar remaining={task.remaining} total={task.total} scale={ls} />
                </div>
              )}
            </button>
          );
        })}

        {/* ---------- 炮塔 ---------- */}
        {TPOS.map((p, i) => {
          const lvl = s.turrets[i];
          const locked = s.buildings.base < TURRET_UNLOCK[i];
          const task = findTask(s, { kind: 'turret', idx: i });
          const me: Selection = { kind: 'turret', idx: i };
          const on = sel?.kind === 'turret' && sel.idx === i;
          return (
            <button
              key={i}
              onPointerUp={tap(me)}
              className={cn('group absolute -translate-x-1/2 -translate-y-1/2 transition-transform duration-200', on && 'z-20')}
              style={{ left: p.x, top: p.y, width: p.size, height: p.size }}
            >
              <span className={cn('absolute inset-0 rounded-2xl transition-all duration-200', on ? 'bg-amber-300/20 ring-4 ring-amber-300' : 'group-active:bg-white/10')} />
              <span className={cn('relative flex h-full w-full items-center justify-center', (locked || lvl === 0) && 'opacity-40 grayscale', task && 'building-work')}>
                <TurretSprite level={lvl} size={p.size} angle={p.x < BPOS.base.x ? (p.y < BPOS.base.y ? -135 : 135) : p.y < BPOS.base.y ? -45 : 45} />
              </span>
              <Label scale={ls} tone={locked ? 'locked' : 'default'}>
                炮塔{i + 1}
                {locked ? (
                  <span className="ml-1 text-slate-400">🔒{TURRET_UNLOCK[i]}级</span>
                ) : lvl === 0 ? (
                  <span className="ml-1 font-normal text-slate-400">未建</span>
                ) : (
                  <span className="ml-1 text-amber-300">Lv.{lvl}</span>
                )}
              </Label>
              {task && (
                <div className="absolute left-1/2 top-full mt-11 -translate-x-1/2">
                  <TaskBar remaining={task.remaining} total={task.total} scale={ls} />
                </div>
              )}
            </button>
          );
        })}

        {/* ---------- 房屋 ---------- */}
        {HSLOTS.map((p, i) => {
          const h = s.houses[i];
          if (h) {
            const task = findTask(s, { kind: 'house', id: h.id });
            const me: Selection = { kind: 'house', id: h.id };
            const on = sel?.kind === 'house' && sel.id === h.id;
            return (
              <button
                key={h.id}
                onPointerUp={tap(me)}
                className={cn('group absolute -translate-x-1/2 -translate-y-1/2 transition-transform duration-200', on && 'z-20')}
                style={{ left: p.x, top: p.y, width: p.size, height: p.size }}
              >
                <span className={cn('absolute inset-0 rounded-2xl transition-all duration-200', on ? 'bg-amber-300/20 ring-4 ring-amber-300' : 'group-active:bg-white/10')} />
                <span className={cn('relative flex h-full w-full items-center justify-center', task && 'building-work')}>
                  <Sprite id={buildingSprite('house', h.level)} size={p.size} className="drop-shadow-[0_8px_10px_rgba(0,0,0,0.4)]" />
                </span>
                <Label scale={ls}>
                  {h.level === 0 ? (
                    <span className="text-slate-300">建造中</span>
                  ) : (
                    <>
                      Lv.{h.level} <span className="ml-0.5 font-normal text-emerald-300">🏠{houseCapacity(h.level)}</span>
                    </>
                  )}
                </Label>
                {task && (
                  <div className="absolute left-1/2 top-full mt-11 -translate-x-1/2">
                    <TaskBar remaining={task.remaining} total={task.total} scale={ls} />
                  </div>
                )}
              </button>
            );
          }
          if (i === s.houses.length && i < mh) {
            const me: Selection = { kind: 'newhouse' };
            const on = sel?.kind === 'newhouse';
            return (
              <button
                key={`slot${i}`}
                onPointerUp={tap(me)}
                className={cn(
                  'absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-2xl border-4 border-dashed text-6xl font-black transition-all duration-200',
                  on ? 'border-amber-300 bg-amber-300/20 text-amber-200' : 'border-amber-100/50 bg-black/25 text-amber-100/80 active:scale-95',
                )}
                style={{ left: p.x, top: p.y, width: p.size * 0.82, height: p.size * 0.82 }}
              >
                +
                <Label scale={ls}>建造房屋</Label>
              </button>
            );
          }
          return (
            <div
              key={`slot${i}`}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-xl border-2 border-dashed border-white/12 bg-black/10"
              style={{ left: p.x, top: p.y, width: p.size * 0.7, height: p.size * 0.7 }}
              title={i < mh ? '' : `主基地 ${(i - 1) * 5} 级解锁`}
            />
          );
        })}
      </div>

      {/* ---------- 屏幕空间叠加层 ---------- */}
      <div className="cloud-drift pointer-events-none absolute inset-0 opacity-[0.14] mix-blend-multiply" />
      <div className="pointer-events-none absolute inset-0 mix-blend-multiply transition-colors duration-[2000ms]" style={{ background: '#0b1026', opacity: tint.night }} />
      <div className="pointer-events-none absolute inset-0 mix-blend-soft-light transition-colors duration-[2000ms]" style={{ background: tint.warmColor, opacity: tint.warm }} />
      <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_120px_40px_rgba(0,0,0,0.55)]" />

      {/* 提示 */}
      <div
        className={cn(
          'pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-slate-950/80 px-4 py-1.5 text-xs font-semibold text-amber-100 ring-1 ring-white/15 backdrop-blur transition-all duration-500',
          hint ? 'translate-y-0 opacity-100' : '-translate-y-3 opacity-0',
        )}
      >
        👆 拖动查看家园 · 双指缩放 · 点击建筑升级
      </div>

      {/* 时段 */}
      <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-slate-950/70 px-2.5 py-1 text-[11px] font-bold text-slate-200 ring-1 ring-white/10 backdrop-blur">
        <span className="text-sm">{tint.night > 0.3 ? '🌙' : tint.warm > 0.2 ? '🌇' : '☀️'}</span>
        {tint.label}
      </div>

      {/* 缩放控制 */}
      <div className="absolute bottom-3 left-3 flex flex-col gap-1.5">
        {[
          { t: '＋', fn: () => zoomAt(sizeRef.current.w / 2, sizeRef.current.h / 2, 1.3), title: '放大' },
          { t: '－', fn: () => zoomAt(sizeRef.current.w / 2, sizeRef.current.h / 2, 1 / 1.3), title: '缩小' },
          {
            t: '⤢',
            fn: () => applyView({ x: 0, y: 0, k: Math.min(sizeRef.current.w / W, sizeRef.current.h / H) * 0.98 }),
            title: '全景',
          },
          { t: '⌂', fn: () => jumpTo(BPOS.base.x, BPOS.base.y), title: '回到主基地' },
        ].map((b) => (
          <button
            key={b.t}
            title={b.title}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={b.fn}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900/85 text-base font-bold text-amber-200 ring-1 ring-white/15 backdrop-blur transition-all hover:bg-slate-800 hover:text-amber-100 active:scale-90"
          >
            {b.t}
          </button>
        ))}
      </div>

      {/* 小地图 */}
      <div className="absolute bottom-3 right-3 w-[104px] overflow-hidden rounded-lg bg-slate-950/80 p-1 ring-1 ring-white/15 backdrop-blur sm:w-[132px]">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full cursor-pointer"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            jumpTo(((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H);
          }}
        >
          <rect width={W} height={H} rx="40" fill="#2f6e31" />
          {roads.map(([x, y], i) => (
            <line key={i} x1={BPOS.base.x} y1={BPOS.base.y} x2={x} y2={y} stroke="#c9a26b" strokeWidth="16" opacity="0.6" />
          ))}
          {(Object.keys(BPOS) as BuildingKey[]).map((k) => (
            <circle key={k} cx={BPOS[k].x} cy={BPOS[k].y} r={k === 'base' ? 62 : 40} fill={k === 'base' ? '#fbbf24' : '#93c5fd'} />
          ))}
          {TPOS.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r="26" fill="#f87171" />
          ))}
          {RES_KEYS.map((k) => (
            <circle key={k} cx={RPOS[k].x} cy={RPOS[k].y} r="34" fill={RES_INFO[k].color} />
          ))}
          {HSLOTS.slice(0, mh).map((p, i) => (
            <rect key={i} x={p.x - 34} y={p.y - 34} width="68" height="68" rx="12" fill={s.houses[i] ? '#fde68a' : '#ffffff22'} />
          ))}
          <rect x={vp.x} y={vp.y} width={vp.w} height={vp.h} fill="#ffffff18" stroke="#fff" strokeWidth="14" rx="20" />
        </svg>
      </div>
    </div>
  );
}
