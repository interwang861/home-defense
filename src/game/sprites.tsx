import type { CSSProperties, ReactNode } from 'react';
import { BUILDINGS, HOUSE_DEF, tierOf } from './config';
import type { BuildingKey } from './types';

/**
 * ============ 素材替换说明 ============
 * 所有素材都是 SVG <symbol>（viewBox 0 0 64 64）。在 SPRITE_IMAGES 中填写 id → 图片地址 即可替换：
 *   goblin: '/images/goblin.png',
 *   base_t0: '/images/base_lv1-9.png',  base_t1: '/images/base_lv10-19.png' ...
 * 建筑 id 规则：{建筑}_t{阶段}，阶段 = floor(等级/10)，0~5（如 base_t0 ~ base_t5、house_t0 ~ house_t4）
 * 炮塔：turret_base_t0~5（底座）+ turret_gun_t0~5（炮管，以(32,32)为旋转中心，朝右）
 * 怪物默认朝左，我方单位默认朝右。图片放 public/images/ 目录，建议 1:1 透明 PNG。
 */
export const SPRITE_IMAGES: Record<string, string> = {
  // goblin: '/images/goblin.png',
};

const SH = <ellipse cx="32" cy="60" rx="14" ry="3" fill="#00000040" />;
const BSH = <ellipse cx="32" cy="60" rx="30" ry="3.5" fill="#00000045" />;

// ======================= 步兵模板 =======================
function soldier(o: { body: string; legs: string; skin?: string; head?: ReactNode; weapon?: ReactNode; back?: ReactNode; front?: ReactNode }) {
  const skin = o.skin ?? '#f5c9a0';
  return (
    <g>
      {SH}
      {o.back}
      <rect x="25" y="46" width="6" height="13" rx="2" fill={o.legs} />
      <rect x="33" y="46" width="6" height="13" rx="2" fill={o.legs} />
      <rect x="23" y="30" width="18" height="19" rx="5" fill={o.body} />
      <rect x="23" y="44" width="18" height="3" fill="#00000030" />
      <circle cx="32" cy="22" r="9" fill={skin} />
      <circle cx="36" cy="21" r="1.4" fill="#1f2937" />
      {o.head}
      {o.weapon}
      <circle cx="40" cy="39" r="3.2" fill={skin} />
      {o.front}
    </g>
  );
}

// ======================= 战车模板 =======================
function tracks(x: number, w: number, y = 46, h = 12) {
  const n = Math.max(3, Math.round(w / 10));
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={h / 2} fill="#27272a" />
      {Array.from({ length: n }).map((_, i) => (
        <circle key={i} cx={x + h / 2 + (i * (w - h)) / (n - 1)} cy={y + h / 2} r={h / 2 - 2} fill="#71717a" stroke="#3f3f46" />
      ))}
    </g>
  );
}
function wheels(xs: number[], y = 52, r = 6) {
  return xs.map((x) => (
    <g key={x}>
      <circle cx={x} cy={y} r={r} fill="#1c1917" />
      <circle cx={x} cy={y} r={r * 0.45} fill="#a8a29e" />
    </g>
  ));
}
const VSH = <ellipse cx="32" cy="60" rx="28" ry="3.5" fill="#00000040" />;

// ======================= 建筑调色板（每10级一换） =======================
interface Pal { wall: string; wall2: string; roof: string; trim: string; win: string; accent: string; door: string }
const PAL: Pal[] = [
  { wall: '#b07b3f', wall2: '#7c4a1e', roof: '#6b3e14', trim: '#fde68a', win: '#fef3c7', accent: '#65a30d', door: '#451a03' }, // 木
  { wall: '#b5aca3', wall2: '#78716c', roof: '#b91c1c', trim: '#e7e5e4', win: '#7dd3fc', accent: '#dc2626', door: '#44403c' }, // 石
  { wall: '#c2410c', wall2: '#7c2d12', roof: '#1e40af', trim: '#fed7aa', win: '#bae6fd', accent: '#2563eb', door: '#431407' }, // 砖
  { wall: '#64748b', wall2: '#334155', roof: '#0f766e', trim: '#cbd5e1', win: '#67e8f9', accent: '#14b8a6', door: '#1e293b' }, // 钢
  { wall: '#e2e8f0', wall2: '#94a3b8', roof: '#0284c7', trim: '#38bdf8', win: '#22d3ee', accent: '#0ea5e9', door: '#0f172a' }, // 科技
  { wall: '#3730a3', wall2: '#1e1b4b', roof: '#a21caf', trim: '#fbbf24', win: '#f0abfc', accent: '#fbbf24', door: '#0c0a1f' }, // 传奇
];

function tierGlow(t: number, p: Pal) {
  if (t < 4) return null;
  return (
    <g>
      <ellipse cx="32" cy="58" rx="31" ry="6" fill={p.accent} opacity="0.35" />
      {t >= 5 && <ellipse cx="32" cy="36" rx="34" ry="30" fill="none" stroke={p.accent} strokeWidth="1" opacity="0.5" strokeDasharray="3 3" />}
    </g>
  );
}
function flag(x: number, y: number, c: string) {
  return (
    <g>
      <line x1={x} y1={y} x2={x} y2={y - 14} stroke="#44403c" strokeWidth="1.2" />
      <path d={`M${x} ${y - 14} h9 l-3 3 l3 3 h-9z`} fill={c} />
    </g>
  );
}
function star5(cx: number, cy: number, r: number, c: string) {
  const pts = Array.from({ length: 10 })
    .map((_, i) => {
      const a = (Math.PI / 5) * i - Math.PI / 2;
      const rr = i % 2 ? r * 0.45 : r;
      return `${cx + Math.cos(a) * rr},${cy + Math.sin(a) * rr}`;
    })
    .join(' ');
  return <polygon points={pts} fill={c} stroke="#92400e" strokeWidth="0.5" />;
}

const EMBLEM: Record<string, (p: Pal) => ReactNode> = {
  power: () => <path d="M1 -6 L-4 1 H0 L-2 6 L4 -1 H0 L2 -6z" fill="#facc15" stroke="#a16207" strokeWidth="0.6" />,
  warehouse: (p) => (
    <g>
      <rect x="-4.5" y="-4.5" width="9" height="9" fill="#ca8a04" stroke={p.wall2} />
      <path d="M-4.5 -4.5 L4.5 4.5 M4.5 -4.5 L-4.5 4.5" stroke={p.wall2} strokeWidth="0.8" />
    </g>
  ),
  barracks: () => (
    <g stroke="#e5e7eb" strokeWidth="1.8" strokeLinecap="round">
      <path d="M-5 -5 L5 5 M5 -5 L-5 5" />
      <path d="M-5 3 l2 2 M5 3 l-2 2" stroke="#92400e" />
    </g>
  ),
  factory: () => (
    <g>
      {[0, 45, 90, 135].map((a) => (
        <rect key={a} x="-1.2" y="-6" width="2.4" height="12" fill="#52525b" transform={`rotate(${a})`} />
      ))}
      <circle r="3.8" fill="#71717a" />
      <circle r="1.5" fill="#e4e4e7" />
    </g>
  ),
  engineer: () => (
    <g>
      <path d="M-5 5 L2 -2" stroke="#52525b" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M1 -5 a3.5 3.5 0 1 0 4 4 l-2 -0.5 l-1.5 -1.5z" fill="#52525b" />
    </g>
  ),
  lab: () => (
    <g>
      <path d="M-2 -6 h4 v4 l4 7 h-12 l4 -7z" fill="#a5f3fc" stroke="#0e7490" strokeWidth="0.8" />
      <path d="M-4.5 2.5 h9 l1.5 2.5 h-12z" fill="#22c55e" />
    </g>
  ),
};

/** 通用建筑模板：墙体/屋顶/侧塔随阶段变化 */
function structure(t: number, p: Pal, emblem: ReactNode, extra?: ReactNode, back?: ReactNode) {
  const top = 30 - Math.min(t, 3) * 3;
  return (
    <g>
      {BSH}
      {tierGlow(t, p)}
      {back}
      {t >= 2 && (
        <g>
          <rect x="44" y={top - 10} width="15" height={69 - top} fill={p.wall2} />
          {[0, 1, 2].map((i) => (
            <rect key={i} x="47" y={top - 2 + i * 9} width="5" height="5" fill={p.win} opacity="0.85" />
          ))}
          {t >= 4 ? (
            <path d={`M44 ${top - 10} A7.5 7 0 0 1 59 ${top - 10}Z`} fill={p.roof} />
          ) : (
            <path d={`M42 ${top - 9} L51.5 ${top - 20} L61 ${top - 9}Z`} fill={p.roof} />
          )}
        </g>
      )}
      <rect x="5" y={top} width="42" height={59 - top} fill={p.wall} />
      {t === 0 && [0, 1, 2, 3].map((i) => <line key={i} x1="5" x2="47" y1={top + 6 + i * 7} y2={top + 6 + i * 7} stroke={p.wall2} strokeWidth="0.8" />)}
      {t === 1 && [0, 1, 2].map((i) => <path key={i} d={`M5 ${top + 8 + i * 8} H47 M${14 + (i % 2) * 8} ${top + i * 8} v8 M${34 + (i % 2) * 6} ${top + i * 8} v8`} stroke={p.wall2} strokeWidth="0.7" />)}
      {t === 2 && [0, 1, 2, 3, 4].map((i) => <line key={i} x1="5" x2="47" y1={top + 5 + i * 6} y2={top + 5 + i * 6} stroke={p.wall2} strokeWidth="0.5" strokeDasharray="4 1" />)}
      {t >= 3 && <rect x="5" y={top} width="42" height="3" fill={p.trim} />}
      <rect x="5" y="55" width="42" height="4" fill={p.wall2} />
      {t <= 2 && <path d={`M1 ${top + 2} L26 ${top - 17} L51 ${top + 2}Z`} fill={p.roof} stroke={p.wall2} strokeWidth="1" />}
      {t === 0 && [0, 1, 2].map((i) => <line key={i} x1={10 + i * 8} y1={top} x2={20 + i * 3} y2={top - 10} stroke="#00000030" />)}
      {t === 3 && (
        <g>
          <rect x="3" y={top - 5} width="46" height="6" fill={p.roof} />
          <line x1="40" y1={top - 5} x2="40" y2={top - 18} stroke="#94a3b8" strokeWidth="1.2" />
          <circle cx="40" cy={top - 19} r="1.8" fill="#ef4444" />
        </g>
      )}
      {t >= 4 && (
        <g>
          <path d={`M7 ${top} A19 17 0 0 1 45 ${top}Z`} fill={p.roof} />
          <path d={`M12 ${top - 6} A15 10 0 0 1 40 ${top - 6}`} stroke={p.trim} strokeWidth="1.5" fill="none" />
        </g>
      )}
      {t >= 5 && (
        <g>
          <line x1="26" y1={top - 17} x2="26" y2={top - 26} stroke={p.trim} strokeWidth="1.5" />
          {star5(26, top - 29, 4, p.trim)}
        </g>
      )}
      <rect x="10" y={top + 5} width="7" height="7" fill={p.win} stroke={p.wall2} strokeWidth="0.8" />
      <rect x="35" y={top + 5} width="7" height="7" fill={p.win} stroke={p.wall2} strokeWidth="0.8" />
      <rect x="20" y="47" width="12" height="12" rx={t >= 3 ? 1 : 6} fill={p.door} />
      <g transform={`translate(26 ${top + 9})`}>
        <circle r="6.5" fill={p.trim} stroke={p.wall2} strokeWidth="1" />
        {emblem}
      </g>
      {t >= 2 && t < 5 && flag(8, top - 1, p.accent)}
      {extra}
    </g>
  );
}

function baseSprite(t: number, p: Pal) {
  const kt = 14 - t * 2;
  const towerTop = 20 - (t >= 2 ? 5 : 0) - (t >= 4 ? 3 : 0);
  return (
    <g>
      {BSH}
      {tierGlow(t, p)}
      <rect x="8" y="30" width="48" height="29" fill={p.wall} />
      <path d="M8 30 h48" stroke={p.wall2} strokeWidth="2" />
      {[1, 7, 13, 19, 25, 31, 37, 43, 49].map((x) => <rect key={x} x={8 + x * 0.95} y="26" width="3.5" height="4" fill={p.wall} />)}
      {[0, 48].map((x) => (
        <g key={x}>
          <rect x={x + 1} y={towerTop} width="15" height={59 - towerTop} fill={p.wall2} />
          <rect x={x + 5} y={towerTop + 8} width="5" height="7" rx="2.5" fill={p.win} />
          {t === 0 && <path d={`M${x + 1} ${towerTop} v-4 h3 v4 h3 v-4 h3 v4 h3 v-4 h3 v4`} fill={p.wall2} />}
          {t >= 1 && t <= 3 && <path d={`M${x - 1} ${towerTop} L${x + 8.5} ${towerTop - 13} L${x + 18} ${towerTop}Z`} fill={p.roof} />}
          {t >= 4 && <path d={`M${x + 1} ${towerTop} A7.5 8 0 0 1 ${x + 16} ${towerTop}Z`} fill={p.roof} />}
        </g>
      ))}
      <rect x="21" y={kt} width="22" height={32 - kt} fill={p.wall} stroke={p.wall2} strokeWidth="0.8" />
      {t >= 3 && <rect x="21" y={kt + 6} width="22" height="2" fill={p.trim} />}
      {t <= 2 && <path d={`M18 ${kt} L32 ${kt - 13} L46 ${kt}Z`} fill={p.roof} />}
      {t === 3 && (
        <g>
          <rect x="19" y={kt - 4} width="26" height="5" fill={p.roof} />
          <line x1="32" y1={kt - 4} x2="32" y2={kt - 16} stroke="#94a3b8" strokeWidth="1.5" />
          <circle cx="32" cy={kt - 17} r="2" fill="#ef4444" />
        </g>
      )}
      {t >= 4 && <path d={`M21 ${kt} A11 12 0 0 1 43 ${kt}Z`} fill={p.roof} stroke={p.trim} strokeWidth="1" />}
      {t >= 5 && star5(32, kt - 16, 5, p.trim)}
      <rect x="28.5" y={kt + 10} width="7" height="8" rx="3.5" fill={p.win} />
      <path d="M25 59 v-11 a7 7 0 0 1 14 0 v11z" fill={p.door} />
      {t >= 1 && <path d="M25 59 v-11 a7 7 0 0 1 14 0 v11" fill="none" stroke={p.trim} strokeWidth="1" />}
      {flag(56, towerTop - (t >= 1 && t <= 3 ? 12 : 3), p.accent)}
      {t >= 2 && flag(4, towerTop - (t <= 3 ? 12 : 3), p.accent)}
      {t >= 4 && <ellipse cx="32" cy="36" rx="34" ry="32" fill={p.accent} opacity="0.08" stroke={p.accent} strokeOpacity="0.4" />}
    </g>
  );
}

function airbaseSprite(t: number, p: Pal) {
  return (
    <g>
      {BSH}
      {tierGlow(t, p)}
      <rect x="0" y="54" width="64" height="6" fill="#52525b" />
      <path d="M4 56 h56" stroke="#fde047" strokeWidth="0.8" strokeDasharray="4 3" />
      {t >= 3 && [6, 20, 34, 48, 60].map((x) => <circle key={x} cx={x} cy="58.5" r="1.1" fill="#22d3ee" />)}
      {t >= 4 && <path d="M30 54 V44 Q40 32 50 44 V54z" fill={p.wall2} />}
      <path d="M2 55 V40 Q20 16 38 40 V55z" fill={p.wall} stroke={p.wall2} strokeWidth="1" />
      <path d="M8 55 V43 Q20 27 32 43 V55z" fill={p.door} />
      <path d="M13 46 l12 -2 l4 2 l-4 2z" fill="#f1f5f9" />
      {t === 0 && <path d="M2 40 Q20 16 38 40" stroke={p.wall2} strokeWidth="2" fill="none" />}
      <rect x="44" y={22 - t * 2} width="8" height={33 + t * 2} fill={p.wall2} />
      <rect x="40" y={14 - t * 2} width="16" height="9" rx="2" fill={p.roof} />
      <rect x="42" y={16 - t * 2} width="12" height="4" fill={p.win} />
      <line x1="48" y1={14 - t * 2} x2="48" y2={6 - t * 2} stroke="#475569" strokeWidth="1.5" />
      <circle cx="48" cy={6 - t * 2} r="2" fill="#ef4444" />
      {t >= 2 && (
        <g transform={`translate(58 ${30 - t})`}>
          <line x1="0" y1="0" x2="0" y2="10" stroke="#475569" strokeWidth="1.5" />
          <path d="M-5 -3 A6 4 0 0 0 5 1" fill={p.trim} stroke="#475569" strokeWidth="0.8" />
        </g>
      )}
      {t >= 1 && flag(4, 40, p.accent)}
      {t >= 5 && star5(20, 18, 4, p.trim)}
    </g>
  );
}

function houseSprite(t: number, p: Pal) {
  const top = t >= 2 ? 20 : 32;
  return (
    <g>
      <ellipse cx="32" cy="60" rx="26" ry="3" fill="#00000040" />
      {tierGlow(t, p)}
      <rect x="10" y={top} width="44" height={59 - top} fill={p.wall} />
      {t === 0 && [0, 1, 2].map((i) => <line key={i} x1="10" x2="54" y1={top + 7 + i * 7} y2={top + 7 + i * 7} stroke={p.wall2} strokeWidth="0.8" />)}
      {t <= 2 ? (
        <path d={`M4 ${top + 2} L32 ${top - 20} L60 ${top + 2}Z`} fill={p.roof} stroke={p.wall2} strokeWidth="1" />
      ) : (
        <g>
          <rect x="7" y={top - 5} width="50" height="6" fill={p.roof} />
          {t >= 4 && <path d={`M14 ${top - 5} l4 -6 h14 l-4 6z M34 ${top - 5} l4 -6 h14 l-4 6z`} fill="#1e3a8a" stroke="#93c5fd" strokeWidth="0.5" />}
        </g>
      )}
      {t === 0 && <path d={`M10 ${top - 2} l6 -6 M20 ${top - 8} l6 -6 M40 ${top - 8} l6 6`} stroke="#fde68a" strokeWidth="1" />}
      {t >= 1 && t <= 2 && <rect x="44" y={top - 16} width="6" height="12" fill={p.wall2} />}
      {t >= 2 && (
        <g>
          <rect x="15" y={top + 5} width="9" height="8" fill={p.win} stroke={p.wall2} />
          <rect x="40" y={top + 5} width="9" height="8" fill={p.win} stroke={p.wall2} />
          <rect x="27" y={top + 5} width="9" height="8" fill={p.win} stroke={p.wall2} />
          <line x1="10" x2="54" y1={top + 17} y2={top + 17} stroke={p.wall2} />
        </g>
      )}
      <rect x="27" y="44" width="10" height="15" rx="1" fill={p.door} />
      <rect x="14" y="40" width="9" height="9" fill={p.win} stroke={p.wall2} strokeWidth="1.2" />
      <rect x="41" y="40" width="9" height="9" fill={p.win} stroke={p.wall2} strokeWidth="1.2" />
      {t >= 3 && <rect x="10" y="55" width="44" height="4" fill={p.wall2} />}
    </g>
  );
}

// ======================= 炮塔 =======================
function turretBase(t: number) {
  const p = PAL[t];
  if (t === 0)
    return (
      <g>
        <ellipse cx="32" cy="60" rx="18" ry="3" fill="#00000045" />
        <path d="M18 60 L24 32 M46 60 L40 32 M20 50 L44 40 M44 50 L20 40" stroke="#7c4a1e" strokeWidth="3" />
        <rect x="14" y="27" width="36" height="7" rx="1" fill="#a16207" stroke="#78350f" />
      </g>
    );
  return (
    <g>
      <ellipse cx="32" cy="60" rx="20" ry="3.5" fill="#00000045" />
      {t >= 4 && <ellipse cx="32" cy="58" rx="22" ry="5" fill={p.accent} opacity="0.4" />}
      <path d={`M${t >= 3 ? 12 : 16} 58 L${t >= 3 ? 14 : 18} 32 H${t >= 3 ? 50 : 46} L${t >= 3 ? 52 : 48} 58Z`} fill={p.wall} stroke={p.wall2} strokeWidth="1.2" />
      {t === 1 && [0, 1, 2].map((i) => <line key={i} x1="17" x2="47" y1={38 + i * 7} y2={38 + i * 7} stroke={p.wall2} strokeWidth="0.7" />)}
      {t === 2 && <path d="M16 32 v-4 h5 v4 h5 v-4 h5 v4 h5 v-4 h5 v4 h5 v-4 h3 v4" fill={p.wall} stroke={p.wall2} strokeWidth="0.8" />}
      {t === 3 && <path d="M13 50 h38 v4 h-38z" fill="#facc15" />}
      {t === 3 && [16, 24, 32, 40, 48].map((x) => <path key={x} d={`M${x} 50 l3 4 h-3 l-3 -4z`} fill="#111" />)}
      {t >= 4 && <rect x="14" y="44" width="36" height="3" fill={p.trim} />}
      <ellipse cx="32" cy="32" rx={t >= 3 ? 19 : 16} ry="6" fill={p.wall2} />
      {t >= 5 && (
        <g>
          <path d="M10 58 L6 40 L14 46z M54 58 L58 40 L50 46z" fill="#c084fc" opacity="0.8" />
          {star5(32, 50, 4, p.trim)}
        </g>
      )}
    </g>
  );
}
function turretGun(t: number) {
  const p = PAL[t];
  switch (t) {
    case 0:
      return (
        <g>
          <path d="M36 16 Q46 32 36 48" stroke="#78350f" strokeWidth="3" fill="none" />
          <line x1="36" y1="16" x2="30" y2="32" stroke="#e5e7eb" strokeWidth="0.8" />
          <line x1="36" y1="48" x2="30" y2="32" stroke="#e5e7eb" strokeWidth="0.8" />
          <rect x="22" y="30" width="22" height="4" fill="#92400e" />
          <line x1="28" y1="32" x2="56" y2="32" stroke="#57534e" strokeWidth="1.5" />
          <polygon points="56,29 61,32 56,35" fill="#9ca3af" />
        </g>
      );
    case 1:
      return (
        <g>
          <rect x="30" y="28" width="26" height="8" rx="2" fill="#3f3f46" />
          <rect x="53" y="27" width="5" height="10" rx="1" fill="#27272a" />
          <circle cx="32" cy="32" r="10" fill={p.wall2} stroke="#27272a" />
        </g>
      );
    case 2:
      return (
        <g>
          <rect x="30" y="24" width="27" height="6" rx="2" fill="#3f3f46" />
          <rect x="30" y="34" width="27" height="6" rx="2" fill="#3f3f46" />
          <rect x="21" y="21" width="20" height="22" rx="4" fill={p.wall2} stroke="#27272a" />
          <circle cx="29" cy="32" r="3" fill={p.trim} />
        </g>
      );
    case 3:
      return (
        <g>
          {[27, 30, 33, 36].map((y) => <rect key={y} x="36" y={y} width="22" height="2" fill="#27272a" />)}
          <rect x="54" y="26" width="4" height="13" fill="#52525b" />
          <rect x="20" y="22" width="20" height="20" rx="3" fill={p.wall} stroke={p.wall2} />
          <rect x="24" y="26" width="8" height="12" fill="#facc15" />
          <path d="M24 38 h8" stroke="#111" strokeWidth="1.5" strokeDasharray="2 2" />
        </g>
      );
    case 4:
      return (
        <g>
          <rect x="18" y="20" width="30" height="24" rx="3" fill={p.wall} stroke={p.wall2} strokeWidth="1.5" />
          {[23, 29, 35, 41].map((y) => (
            <g key={y}>
              <rect x="44" y={y - 2} width="10" height="4" fill="#e5e7eb" />
              <polygon points={`54,${y - 2} 59,${y} 54,${y + 2}`} fill="#ef4444" />
            </g>
          ))}
          <rect x="22" y="24" width="8" height="16" fill={p.accent} opacity="0.6" />
        </g>
      );
    default:
      return (
        <g>
          <path d="M20 24 L46 28 L58 32 L46 36 L20 40 Z" fill={p.wall} stroke={p.trim} strokeWidth="1.2" />
          <circle cx="30" cy="32" r="8" fill={p.wall2} stroke={p.trim} />
          <circle cx="30" cy="32" r="3.5" fill="#22d3ee" />
          <polygon points="52,29 60,32 52,35" fill="#67e8f9" />
          <circle cx="58" cy="32" r="3" fill="#a5f3fc" opacity="0.8" />
        </g>
      );
  }
}

// ======================= 所有精灵 =======================
const S: Record<string, ReactNode> = {
  // ---------- 怪物（朝左） ----------
  goblin: (
    <g>
      {SH}
      <rect x="25" y="50" width="5" height="9" rx="2" fill="#3f6212" />
      <rect x="34" y="50" width="5" height="9" rx="2" fill="#3f6212" />
      <path d="M22 36 h20 l2 16 h-24z" fill="#7c4a1e" />
      <circle cx="32" cy="26" r="12" fill="#65a30d" />
      <polygon points="21,24 5,15 21,31" fill="#65a30d" />
      <polygon points="43,24 59,15 43,31" fill="#65a30d" />
      <circle cx="26" cy="24" r="3.4" fill="#fef08a" />
      <circle cx="25" cy="24" r="1.6" fill="#000" />
      <circle cx="36" cy="24" r="3.4" fill="#fef08a" />
      <circle cx="35" cy="24" r="1.6" fill="#000" />
      <path d="M24 31 q7 4 13 0" stroke="#1a2e05" strokeWidth="2" fill="none" />
      <rect x="9" y="26" width="5" height="24" rx="2" fill="#78350f" transform="rotate(-25 12 38)" />
      <circle cx="9" cy="27" r="5" fill="#92400e" />
      <circle cx="18" cy="43" r="3.5" fill="#65a30d" />
    </g>
  ),
  dog: (
    <g>
      {SH}
      <rect x="16" y="42" width="5" height="16" rx="2" fill="#78350f" />
      <rect x="24" y="42" width="5" height="16" rx="2" fill="#92400e" />
      <rect x="40" y="42" width="5" height="16" rx="2" fill="#78350f" />
      <rect x="47" y="42" width="5" height="16" rx="2" fill="#92400e" />
      <ellipse cx="34" cy="38" rx="20" ry="9" fill="#a16207" />
      <path d="M52 34 q10 -6 8 -14" stroke="#a16207" strokeWidth="4" fill="none" strokeLinecap="round" />
      <circle cx="16" cy="28" r="9" fill="#a16207" />
      <ellipse cx="8" cy="31" rx="6" ry="4" fill="#ca8a04" />
      <circle cx="3" cy="30" r="2" fill="#1c1917" />
      <polygon points="17,21 24,12 23,24" fill="#78350f" />
      <circle cx="14" cy="26" r="1.8" fill="#dc2626" />
      <path d="M4 34 l8 1" stroke="#fff" strokeWidth="1.5" />
    </g>
  ),
  wolf: (
    <g>
      {SH}
      <rect x="15" y="42" width="5" height="17" rx="2" fill="#4b5563" />
      <rect x="23" y="42" width="5" height="17" rx="2" fill="#6b7280" />
      <rect x="41" y="42" width="5" height="17" rx="2" fill="#4b5563" />
      <rect x="48" y="42" width="5" height="17" rx="2" fill="#6b7280" />
      <path d="M52 36 q12 0 10 12 q-6 -6 -12 -4z" fill="#6b7280" />
      <ellipse cx="34" cy="37" rx="21" ry="10" fill="#6b7280" />
      <path d="M22 30 q12 -8 26 0" fill="#4b5563" />
      <path d="M8 28 L20 20 L28 30 L24 38 L4 34z" fill="#9ca3af" />
      <polygon points="18,21 20,8 25,22" fill="#4b5563" />
      <polygon points="23,23 28,11 29,26" fill="#6b7280" />
      <path d="M2 33 L14 35" stroke="#fff" strokeWidth="1.5" />
      <circle cx="14" cy="26" r="2" fill="#facc15" />
      <circle cx="3" cy="31" r="1.8" fill="#111" />
    </g>
  ),
  bison: (
    <g>
      {SH}
      <rect x="14" y="44" width="7" height="15" rx="2" fill="#292524" />
      <rect x="24" y="44" width="7" height="15" rx="2" fill="#44403c" />
      <rect x="42" y="44" width="7" height="15" rx="2" fill="#292524" />
      <rect x="51" y="44" width="7" height="15" rx="2" fill="#44403c" />
      <ellipse cx="38" cy="38" rx="22" ry="12" fill="#57331b" />
      <path d="M10 42 Q10 18 30 16 Q40 18 38 34 Q30 48 10 42z" fill="#3b2412" />
      <ellipse cx="12" cy="36" rx="9" ry="8" fill="#44403c" />
      <path d="M14 26 q-10 -2 -10 -12 q4 6 12 6" fill="#e7e5e4" />
      <path d="M22 26 q4 -8 12 -8 q-6 4 -8 10" fill="#e7e5e4" />
      <circle cx="12" cy="31" r="2" fill="#ef4444" />
      <circle cx="6" cy="39" r="1.3" fill="#000" />
    </g>
  ),
  boar: (
    <g>
      {SH}
      <rect x="16" y="44" width="5" height="15" rx="2" fill="#292524" />
      <rect x="24" y="44" width="5" height="15" rx="2" fill="#44403c" />
      <rect x="40" y="44" width="5" height="15" rx="2" fill="#292524" />
      <rect x="47" y="44" width="5" height="15" rx="2" fill="#44403c" />
      <ellipse cx="34" cy="38" rx="21" ry="12" fill="#57534e" />
      <path d="M18 28 l3 -6 l3 6 l3 -7 l3 7 l3 -7 l3 7 l3 -6 l3 6" fill="#292524" />
      <path d="M4 34 Q8 22 22 26 L24 44 Q10 46 4 40z" fill="#78716c" />
      <ellipse cx="5" cy="37" rx="4" ry="5" fill="#fda4af" />
      <path d="M10 40 q-6 -2 -6 -10" stroke="#fef3c7" strokeWidth="3" fill="none" strokeLinecap="round" />
      <circle cx="14" cy="30" r="2" fill="#dc2626" />
      <polygon points="18,26 22,16 24,27" fill="#44403c" />
    </g>
  ),
  gorilla: (
    <g>
      {SH}
      <ellipse cx="22" cy="56" rx="7" ry="4" fill="#1c1917" />
      <ellipse cx="42" cy="56" rx="7" ry="4" fill="#1c1917" />
      <path d="M14 30 Q32 14 50 30 L52 52 Q32 58 12 52z" fill="#292524" />
      <ellipse cx="32" cy="40" rx="11" ry="10" fill="#57534e" />
      <path d="M14 30 Q4 40 6 54" stroke="#292524" strokeWidth="9" fill="none" strokeLinecap="round" />
      <path d="M50 30 Q60 40 58 54" stroke="#292524" strokeWidth="9" fill="none" strokeLinecap="round" />
      <circle cx="6" cy="55" r="6" fill="#1c1917" />
      <circle cx="58" cy="55" r="6" fill="#1c1917" />
      <circle cx="30" cy="18" r="11" fill="#292524" />
      <ellipse cx="28" cy="22" rx="8" ry="6" fill="#78716c" />
      <path d="M20 13 l8 3 M38 13 l-6 3" stroke="#000" strokeWidth="2.5" />
      <circle cx="25" cy="17" r="2" fill="#ef4444" />
      <circle cx="34" cy="17" r="2" fill="#ef4444" />
      <path d="M23 25 h10" stroke="#000" strokeWidth="2" />
    </g>
  ),
  zombie: (
    <g>
      {SH}
      <rect x="25" y="46" width="6" height="13" rx="2" fill="#1e3a8a" />
      <rect x="33" y="46" width="6" height="13" rx="2" fill="#1e40af" />
      <path d="M23 30 h18 v18 l-3 -2 l-3 3 l-3 -3 l-3 3 l-3 -3 l-3 2z" fill="#6b8e5a" />
      <rect x="4" y="32" width="22" height="6" rx="3" fill="#86a86b" />
      <rect x="6" y="39" width="20" height="5" rx="2.5" fill="#789b60" />
      <circle cx="31" cy="21" r="10" fill="#86a86b" />
      <path d="M22 16 q4 -8 12 -6 q6 2 7 8" fill="#3f3f46" />
      <circle cx="27" cy="21" r="3" fill="#fff" />
      <circle cx="27" cy="21" r="1" fill="#b91c1c" />
      <circle cx="35" cy="20" r="2" fill="#fff" />
      <path d="M25 27 l3 -1 l2 2 l3 -2 l2 1" stroke="#450a0a" strokeWidth="1.5" fill="none" />
    </g>
  ),
  jiangshi: (
    <g>
      {SH}
      <rect x="24" y="52" width="7" height="7" fill="#111827" />
      <rect x="33" y="52" width="7" height="7" fill="#111827" />
      <path d="M22 30 h20 l3 24 h-26z" fill="#4c1d95" />
      <path d="M32 30 v24" stroke="#fbbf24" strokeWidth="1.5" />
      <rect x="27" y="38" width="10" height="8" fill="#b45309" />
      <circle cx="32" cy="42" r="2.5" fill="#fbbf24" />
      <rect x="2" y="32" width="24" height="7" rx="2" fill="#5b21b6" />
      <rect x="0" y="32" width="5" height="7" rx="2" fill="#d1e7dd" />
      <circle cx="32" cy="21" r="9" fill="#d1e7dd" />
      <rect x="21" y="10" width="22" height="5" rx="1" fill="#111827" />
      <path d="M24 10 q8 -8 16 0z" fill="#111827" />
      <circle cx="32" cy="4" r="2.5" fill="#dc2626" />
      <rect x="27" y="12" width="9" height="18" fill="#fde047" />
      <path d="M31.5 14 q2 2 0 4 q-2 2 0 4 q2 2 0 4" stroke="#dc2626" strokeWidth="1.3" fill="none" />
    </g>
  ),
  ultraman: (
    <g>
      {SH}
      <rect x="23" y="44" width="7" height="15" rx="3" fill="#d1d5db" />
      <rect x="34" y="44" width="7" height="15" rx="3" fill="#dc2626" />
      <path d="M20 26 h24 v20 h-24z" fill="#e5e7eb" />
      <path d="M20 26 l8 20 h-8z M44 26 l-8 20 h8z" fill="#dc2626" />
      <circle cx="32" cy="33" r="3.5" fill="#38bdf8" stroke="#94a3b8" strokeWidth="1.5" />
      <rect x="10" y="27" width="10" height="6" rx="3" fill="#dc2626" />
      <rect x="4" y="22" width="8" height="6" rx="3" fill="#e5e7eb" transform="rotate(-30 8 25)" />
      <rect x="44" y="27" width="10" height="6" rx="3" fill="#e5e7eb" />
      <ellipse cx="32" cy="15" rx="9" ry="11" fill="#d1d5db" />
      <path d="M31 4 l2 0 l1 10 l-4 0z" fill="#9ca3af" transform="rotate(8 32 8)" />
      <ellipse cx="27" cy="15" rx="3.5" ry="2.5" fill="#fde047" transform="rotate(-15 27 15)" />
      <ellipse cx="37" cy="16" rx="2.5" ry="3.5" fill="#fbbf24" transform="rotate(20 37 16)" />
      <text x="44" y="12" fontSize="7" fill="#ef4444" fontWeight="bold">?</text>
    </g>
  ),
  spider: (
    <g>
      {SH}
      <path d="M22 34 L8 24 L2 44 M22 38 L6 38 L4 56 M42 34 L56 24 L62 44 M42 38 L58 38 L60 56 M26 40 L18 50 L16 60 M38 40 L46 50 L48 60" stroke="#475569" strokeWidth="3" fill="none" strokeLinejoin="round" />
      <ellipse cx="34" cy="34" rx="16" ry="10" fill="#64748b" />
      <ellipse cx="34" cy="31" rx="12" ry="5" fill="#94a3b8" />
      <circle cx="18" cy="34" r="8" fill="#475569" />
      <circle cx="15" cy="33" r="3.5" fill="#f43f5e" />
      <circle cx="15" cy="33" r="1.5" fill="#fff" />
      <rect x="4" y="36" width="10" height="3" fill="#334155" />
      <line x1="34" y1="26" x2="38" y2="16" stroke="#475569" strokeWidth="1.5" />
      <circle cx="38" cy="15" r="2" fill="#f43f5e" />
    </g>
  ),
  terminator: (
    <g>
      {SH}
      <rect x="24" y="46" width="7" height="13" rx="1" fill="#111827" />
      <rect x="33" y="46" width="7" height="13" rx="1" fill="#1f2937" />
      <path d="M21 28 h22 v20 h-22z" fill="#111827" />
      <path d="M32 28 l-4 10 l4 10 l4 -10z" fill="#374151" />
      <rect x="3" y="33" width="20" height="5" fill="#374151" />
      <rect x="0" y="31" width="10" height="9" rx="1" fill="#1f2937" />
      <circle cx="32" cy="18" r="10" fill="#d1d5db" />
      <path d="M22 18 q10 -14 20 0" fill="#9ca3af" />
      <circle cx="28" cy="18" r="3" fill="#111" />
      <circle cx="28" cy="18" r="2" fill="#ef4444" />
      <circle cx="37" cy="18" r="3" fill="#111" />
      <path d="M26 24 h12 v3 h-12z" fill="#e5e7eb" />
    </g>
  ),

  // ---------- 步兵（朝右） ----------
  militia: soldier({
    body: '#92400e', legs: '#57534e',
    head: <path d="M19 17 L45 17 L39 10 L25 10Z" fill="#eab308" />,
    weapon: (
      <g>
        <rect x="39" y="12" width="2.5" height="38" fill="#78350f" />
        <path d="M37 13 v-7 M40.2 13 v-8 M43.5 13 v-7 M37 13 h6.5" stroke="#9ca3af" strokeWidth="1.8" fill="none" />
      </g>
    ),
  }),
  archer: soldier({
    body: '#15803d', legs: '#3f3f46',
    back: <rect x="17" y="26" width="6" height="18" rx="2" fill="#78350f" />,
    head: <path d="M22 22 Q32 6 42 20 Q32 13 22 22Z" fill="#166534" />,
    weapon: (
      <g>
        <path d="M45 20 Q56 38 45 56" stroke="#92400e" strokeWidth="3" fill="none" />
        <line x1="45" y1="20" x2="45" y2="56" stroke="#e5e7eb" strokeWidth="1" />
      </g>
    ),
  }),
  spearman: soldier({
    body: '#b91c1c', legs: '#44403c',
    head: <path d="M22 20 Q32 7 42 20Z" fill="#9ca3af" />,
    weapon: (
      <g>
        <line x1="38" y1="58" x2="52" y2="8" stroke="#78350f" strokeWidth="2.5" />
        <polygon points="53,1 56,11 49,9" fill="#e5e7eb" />
      </g>
    ),
  }),
  shield: soldier({
    body: '#1d4ed8', legs: '#1e293b',
    head: <path d="M22 22 Q32 6 42 22 L42 18 L22 18Z" fill="#64748b" />,
    front: (
      <g>
        <path d="M40 24 L57 24 L57 41 Q57 52 48.5 57 Q40 52 40 41Z" fill="#60a5fa" stroke="#1e3a8a" strokeWidth="2" />
        <path d="M48.5 28 v24 M43 38 h11" stroke="#fbbf24" strokeWidth="2.5" />
      </g>
    ),
  }),
  musketeer: soldier({
    body: '#1e3a8a', legs: '#f5f5f4',
    head: <path d="M20 16 L44 16 L40 9 L32 12 L24 9Z" fill="#111827" />,
    weapon: (
      <g>
        <rect x="34" y="36" width="28" height="3" fill="#57534e" />
        <rect x="30" y="36" width="12" height="5" rx="1" fill="#78350f" />
      </g>
    ),
  }),
  flamer: soldier({
    body: '#ea580c', legs: '#44403c',
    back: <rect x="14" y="27" width="10" height="19" rx="4" fill="#dc2626" stroke="#7f1d1d" />,
    head: (
      <g>
        <circle cx="32" cy="22" r="9.5" fill="#44403c" />
        <circle cx="36" cy="20" r="3" fill="#fde68a" />
      </g>
    ),
    weapon: (
      <g>
        <rect x="36" y="37" width="17" height="4" fill="#44403c" />
        <path d="M53 39 q6 -8 11 -2 q-3 1 -1 3 q-4 5 -10 -1" fill="#f97316" />
      </g>
    ),
  }),
  sniper: soldier({
    body: '#4d7c0f', legs: '#365314',
    head: (
      <g>
        <path d="M22 18 Q30 10 42 16 L42 18 L22 20Z" fill="#7f1d1d" />
        <rect x="34" y="19" width="6" height="3" fill="#1c1917" />
      </g>
    ),
    weapon: (
      <g>
        <rect x="32" y="36" width="32" height="2.5" fill="#1c1917" />
        <rect x="30" y="36" width="10" height="5" rx="1" fill="#57534e" />
        <rect x="40" y="32" width="9" height="3" rx="1" fill="#111" />
      </g>
    ),
  }),
  gunner: soldier({
    body: '#3f6212', legs: '#1a2e05',
    head: <path d="M21 21 Q32 6 43 21Z" fill="#365314" />,
    weapon: (
      <g>
        <rect x="30" y="34" width="22" height="8" rx="2" fill="#27272a" />
        <rect x="50" y="36" width="12" height="3" fill="#3f3f46" />
      </g>
    ),
  }),
  bazooka: soldier({
    body: '#57534e', legs: '#292524',
    head: <path d="M21 21 Q32 6 43 21Z" fill="#44403c" />,
    weapon: (
      <g>
        <rect x="14" y="26" width="42" height="7" rx="2" fill="#3f6212" />
        <rect x="52" y="24" width="6" height="11" rx="1" fill="#27272a" />
        <polygon points="58,26 64,29.5 58,33" fill="#ef4444" />
        <rect x="30" y="33" width="3" height="6" fill="#1c1917" />
      </g>
    ),
  }),
  exo: (
    <g>
      {SH}
      <path d="M24 44 L20 58 h8 l3 -14z M40 44 L44 58 h-8 l-3 -14z" fill="#0e7490" />
      <rect x="18" y="24" width="28" height="22" rx="5" fill="#0891b2" />
      <rect x="24" y="30" width="16" height="9" rx="2" fill="#164e63" />
      <circle cx="32" cy="34.5" r="3" fill="#22d3ee" />
      <rect x="24" y="8" width="16" height="16" rx="5" fill="#155e75" />
      <rect x="30" y="13" width="10" height="4" rx="1" fill="#67e8f9" />
      <rect x="10" y="26" width="8" height="16" rx="3" fill="#155e75" />
      <rect x="42" y="30" width="20" height="6" rx="2" fill="#164e63" />
      <circle cx="62" cy="33" r="2" fill="#22d3ee" />
    </g>
  ),

  // ---------- 战车（朝右） ----------
  jeep: (
    <g>
      {VSH}
      <path d="M6 50 V40 L16 38 L22 30 H42 L46 38 L58 40 V50z" fill="#65a30d" stroke="#3f6212" />
      <path d="M24 32 H40 L43 38 H22z" fill="#bae6fd" />
      <rect x="30" y="20" width="4" height="10" fill="#27272a" />
      <rect x="30" y="20" width="20" height="3" fill="#27272a" />
      {wheels([16, 48])}
    </g>
  ),
  apc: (
    <g>
      {VSH}
      <path d="M4 50 V34 L12 28 H52 L60 36 V50z" fill="#4d7c0f" stroke="#365314" />
      <rect x="10" y="34" width="6" height="4" fill="#1c1917" />
      <rect x="20" y="34" width="6" height="4" fill="#1c1917" />
      <rect x="30" y="20" width="14" height="8" rx="2" fill="#3f6212" />
      <rect x="42" y="22" width="16" height="3" fill="#27272a" />
      {wheels([12, 25, 39, 52], 52, 5.5)}
    </g>
  ),
  rocket: (
    <g>
      {VSH}
      <rect x="4" y="38" width="56" height="10" fill="#57534e" />
      <path d="M44 38 V26 H56 L60 32 V38z" fill="#65a30d" />
      <rect x="48" y="28" width="7" height="5" fill="#bae6fd" />
      <g transform="rotate(-20 20 36)">
        <rect x="6" y="24" width="32" height="14" rx="2" fill="#4d7c0f" stroke="#365314" />
        {[27, 31, 35].map((y) => [10, 18, 26, 34].map((x) => <circle key={`${x}${y}`} cx={x} cy={y} r="1.6" fill="#ef4444" />))}
      </g>
      {wheels([12, 24, 50], 52, 5.5)}
    </g>
  ),
  ltank: (
    <g>
      {VSH}
      {tracks(4, 54)}
      <path d="M7 46 L12 35 L52 35 L57 46Z" fill="#4d7c0f" />
      <rect x="18" y="24" width="24" height="12" rx="5" fill="#65a30d" />
      <rect x="40" y="27" width="22" height="4.5" rx="1" fill="#3f6212" />
    </g>
  ),
  flametank: (
    <g>
      {VSH}
      {tracks(4, 54)}
      <path d="M7 46 L12 35 L52 35 L57 46Z" fill="#9a3412" />
      <rect x="6" y="28" width="12" height="8" rx="4" fill="#dc2626" stroke="#7f1d1d" />
      <rect x="20" y="25" width="22" height="11" rx="5" fill="#c2410c" />
      <rect x="40" y="28" width="14" height="4" fill="#44403c" />
      <path d="M54 30 q6 -7 10 -1 q-3 1 -1 3 q-4 4 -9 -1" fill="#f97316" />
    </g>
  ),
  artillery: (
    <g>
      {VSH}
      {tracks(4, 54)}
      <path d="M7 46 L10 34 L54 34 L57 46Z" fill="#78716c" />
      <rect x="14" y="22" width="26" height="13" rx="2" fill="#57534e" />
      <rect x="30" y="10" width="34" height="5" rx="1" fill="#44403c" transform="rotate(-25 32 24)" />
      <rect x="18" y="26" width="6" height="4" fill="#bae6fd" />
    </g>
  ),
  htank: (
    <g>
      {VSH}
      {tracks(2, 60, 44, 14)}
      <path d="M4 45 L10 32 L56 32 L62 45Z" fill="#3f3f46" />
      <rect x="14" y="18" width="30" height="15" rx="4" fill="#52525b" stroke="#27272a" />
      <rect x="42" y="22" width="22" height="6" rx="1" fill="#27272a" />
      <rect x="60" y="21" width="4" height="8" fill="#18181b" />
      <circle cx="22" cy="18" r="3" fill="#27272a" />
    </g>
  ),
  missile: (
    <g>
      {VSH}
      <rect x="2" y="38" width="60" height="10" fill="#475569" />
      <path d="M48 38 V26 H58 L62 32 V38z" fill="#334155" />
      <rect x="51" y="28" width="6" height="5" fill="#bae6fd" />
      <g transform="rotate(-12 26 34)">
        <rect x="4" y="28" width="40" height="7" rx="3.5" fill="#e5e7eb" stroke="#94a3b8" />
        <polygon points="44,28 52,31.5 44,35" fill="#ef4444" />
        <path d="M6 28 l-4 -4 v11 l4 -4" fill="#94a3b8" />
      </g>
      {wheels([10, 22, 34, 54], 52, 5.5)}
    </g>
  ),
  lasertank: (
    <g>
      {VSH}
      {tracks(4, 56)}
      <path d="M6 46 L14 34 L54 34 L60 46Z" fill="#e2e8f0" stroke="#94a3b8" />
      <path d="M18 34 L22 22 H42 L46 34z" fill="#cbd5e1" stroke="#64748b" />
      <rect x="40" y="25" width="18" height="5" rx="2" fill="#475569" />
      <circle cx="59" cy="27.5" r="3.5" fill="#22d3ee" />
      <circle cx="30" cy="28" r="3" fill="#22d3ee" opacity="0.8" />
    </g>
  ),
  mammoth: (
    <g>
      <ellipse cx="32" cy="60" rx="31" ry="4" fill="#00000045" />
      {tracks(0, 30, 44, 14)}
      {tracks(34, 30, 44, 14)}
      <path d="M2 45 L8 30 L58 30 L63 45Z" fill="#7f1d1d" stroke="#450a0a" />
      <rect x="10" y="14" width="34" height="17" rx="4" fill="#991b1b" stroke="#450a0a" />
      <rect x="42" y="16" width="22" height="5" rx="1" fill="#27272a" />
      <rect x="42" y="23" width="22" height="5" rx="1" fill="#27272a" />
      <rect x="14" y="8" width="8" height="7" fill="#57534e" />
      <circle cx="30" cy="22" r="3" fill="#fbbf24" />
    </g>
  ),

  // ---------- 空军（朝右） ----------
  scout: (
    <g>
      <path d="M8 32 L4 22 L14 30z" fill="#ca8a04" />
      <ellipse cx="32" cy="33" rx="22" ry="6" fill="#facc15" />
      <ellipse cx="30" cy="36" rx="10" ry="3" fill="#ca8a04" />
      <ellipse cx="38" cy="29" rx="6" ry="4" fill="#7dd3fc" />
      <rect x="54" y="24" width="2.5" height="18" rx="1" fill="#57534e" />
    </g>
  ),
  heli: (
    <g>
      <rect x="6" y="18" width="48" height="2" rx="1" fill="#1f2937" />
      <rect x="29" y="18" width="2.5" height="8" fill="#374151" />
      <path d="M4 30 L28 30 L28 34 L4 32z" fill="#0369a1" />
      <ellipse cx="36" cy="34" rx="14" ry="9" fill="#0284c7" />
      <path d="M40 27 q10 2 9 8 h-9z" fill="#bae6fd" />
      <path d="M26 46 h22 M30 42 v4 M42 42 v4" stroke="#1f2937" strokeWidth="2" />
    </g>
  ),
  fighter: (
    <g>
      <path d="M4 34 L8 20 L18 30z" fill="#475569" />
      <path d="M6 32 L50 30 L62 34 L50 38 L6 36z" fill="#94a3b8" />
      <path d="M22 34 L36 34 L28 48 L20 48z" fill="#64748b" />
      <path d="M44 30 q6 0 8 3 h-10z" fill="#38bdf8" />
      <rect x="2" y="32" width="6" height="4" fill="#f97316" />
    </g>
  ),
  gunship: (
    <g>
      <rect x="4" y="16" width="52" height="2" rx="1" fill="#111827" />
      <rect x="29" y="16" width="3" height="8" fill="#1f2937" />
      <path d="M2 28 L26 30 L26 34 L2 32z" fill="#3f6212" />
      <path d="M24 26 L46 26 Q56 30 54 36 L46 40 L24 40z" fill="#4d7c0f" />
      <rect x="28" y="38" width="16" height="4" fill="#365314" />
      <rect x="46" y="40" width="14" height="3" fill="#1c1917" />
    </g>
  ),
  bomber: (
    <g>
      <path d="M4 30 L6 16 L16 28z" fill="#3f6212" />
      <ellipse cx="32" cy="32" rx="28" ry="7" fill="#4d7c0f" />
      <path d="M22 30 L40 30 L30 12 L24 12z" fill="#365314" />
      <path d="M22 34 L40 34 L32 48 L26 48z" fill="#365314" />
      <ellipse cx="52" cy="30" rx="6" ry="3" fill="#7dd3fc" />
    </g>
  ),
  drones: (
    <g>
      {[[18, 20], [44, 26], [26, 44]].map(([x, y], i) => (
        <g key={i}>
          <line x1={x - 10} y1={y - 3} x2={x + 10} y2={y - 3} stroke="#475569" strokeWidth="2" />
          <ellipse cx={x - 10} cy={y - 5} rx="5" ry="1.2" fill="#94a3b8" />
          <ellipse cx={x + 10} cy={y - 5} rx="5" ry="1.2" fill="#94a3b8" />
          <rect x={x - 5} y={y - 3} width="10" height="6" rx="2" fill="#1e293b" />
          <circle cx={x + 3} cy={y} r="1.5" fill="#22d3ee" />
        </g>
      ))}
    </g>
  ),
  stealth: (
    <g>
      <path d="M2 36 L60 30 L40 36 L60 42z" fill="#111827" />
      <path d="M14 35 L44 32 L40 36 L44 40z" fill="#1f2937" />
      <path d="M40 32 q8 0 10 2 h-10z" fill="#a78bfa" opacity="0.8" />
    </g>
  ),
  gunboat: (
    <g>
      <path d="M2 30 L6 14 L16 28z" fill="#64748b" />
      <ellipse cx="32" cy="32" rx="30" ry="9" fill="#94a3b8" />
      <rect x="18" y="20" width="26" height="4" rx="2" fill="#64748b" />
      <ellipse cx="54" cy="29" rx="6" ry="3" fill="#7dd3fc" />
      <rect x="28" y="40" width="3" height="8" fill="#111" />
      <rect x="40" y="40" width="3" height="8" fill="#111" />
    </g>
  ),
  strategic: (
    <g>
      <path d="M2 30 L4 12 L14 28z" fill="#334155" />
      <path d="M2 30 L56 29 L63 32 L56 35 L2 34z" fill="#475569" />
      <path d="M18 32 L42 32 L30 6 L24 6z" fill="#334155" />
      <path d="M18 32 L42 32 L32 58 L26 58z" fill="#334155" />
      <path d="M52 30 q4 0 6 2 h-6z" fill="#7dd3fc" />
    </g>
  ),
  carrier: (
    <g>
      <path d="M2 30 L62 30 L54 44 L10 44z" fill="#475569" />
      <rect x="4" y="26" width="56" height="5" fill="#64748b" />
      <rect x="36" y="14" width="12" height="12" rx="1" fill="#334155" />
      <rect x="38" y="16" width="8" height="3" fill="#38bdf8" />
      <ellipse cx="14" cy="47" rx="7" ry="2" fill="#22d3ee" opacity="0.7" />
      <ellipse cx="32" cy="47" rx="7" ry="2" fill="#22d3ee" opacity="0.7" />
      <ellipse cx="50" cy="47" rx="7" ry="2" fill="#22d3ee" opacity="0.7" />
    </g>
  ),

  // ---------- 其他 ----------
  house_site: (
    <g>
      <ellipse cx="32" cy="60" rx="26" ry="3" fill="#00000030" />
      <rect x="10" y="44" width="44" height="15" fill="#d6d3d1" />
      <path d="M12 58 V20 M52 58 V20 M12 24 H52 M12 40 H52 M12 24 L52 40 M52 24 L12 40" stroke="#a16207" strokeWidth="2.5" fill="none" />
      <rect x="40" y="48" width="12" height="8" fill="#b45309" />
    </g>
  ),
  worker: (
    <g>
      <rect x="26" y="44" width="5" height="14" rx="2" fill="#1e3a8a" />
      <rect x="33" y="44" width="5" height="14" rx="2" fill="#1e3a8a" />
      <rect x="24" y="28" width="16" height="18" rx="4" fill="#ea580c" />
      <circle cx="32" cy="20" r="8" fill="#f5c9a0" />
      <path d="M23 18 Q32 6 41 18z" fill="#facc15" />
      <line x1="40" y1="44" x2="50" y2="18" stroke="#78350f" strokeWidth="3" />
      <path d="M42 16 Q50 10 58 20" stroke="#9ca3af" strokeWidth="4" fill="none" />
    </g>
  ),
  tree: (
    <g>
      <ellipse cx="32" cy="60" rx="24" ry="3" fill="#00000040" />
      <rect x="15" y="46" width="5" height="13" fill="#78350f" />
      <path d="M17 8 L4 30 h8 L2 48 h30 L22 30 h8z" fill="#15803d" />
      <rect x="42" y="42" width="6" height="17" fill="#78350f" />
      <path d="M45 4 L30 28 h8 L28 46 h34 L52 28 h8z" fill="#166534" />
    </g>
  ),
  stone: (
    <g>
      <ellipse cx="32" cy="58" rx="28" ry="4" fill="#00000040" />
      <path d="M4 58 L10 36 L24 28 L36 36 L40 58z" fill="#a8a29e" />
      <path d="M10 36 L24 28 L22 44z" fill="#d6d3d1" />
      <path d="M30 58 L38 40 L50 34 L60 46 L60 58z" fill="#78716c" />
    </g>
  ),
  iron: (
    <g>
      <ellipse cx="32" cy="58" rx="28" ry="4" fill="#00000040" />
      <path d="M4 58 L14 26 L34 18 L50 30 L60 58z" fill="#475569" />
      <path d="M14 26 L34 18 L28 38z" fill="#64748b" />
      <circle cx="24" cy="44" r="3" fill="#b45309" />
      <circle cx="40" cy="36" r="2.5" fill="#c2410c" />
      <circle cx="44" cy="50" r="3.5" fill="#94a3b8" />
    </g>
  ),
  gold: (
    <g>
      <ellipse cx="32" cy="58" rx="28" ry="4" fill="#00000040" />
      <path d="M4 58 L12 30 L30 20 L52 28 L60 58z" fill="#57534e" />
      <path d="M22 44 l4 -4 l5 2 l-2 5 l-5 1z" fill="#facc15" />
      <path d="M38 34 l3 -3 l4 2 l-1 4 l-4 1z" fill="#fde047" />
      <path d="M42 48 l4 -3 l4 3 l-2 4 l-5 0z" fill="#eab308" />
    </g>
  ),
  oil: (
    <g>
      <ellipse cx="32" cy="56" rx="28" ry="5" fill="#0f172a" />
      <path d="M22 56 L32 20 L42 56" stroke="#57534e" strokeWidth="3" fill="none" />
      <rect x="8" y="16" width="44" height="5" rx="2" fill="#dc2626" transform="rotate(-12 32 18)" />
      <circle cx="32" cy="19" r="3" fill="#1f2937" />
      <rect x="46" y="40" width="10" height="14" rx="2" fill="#1d4ed8" />
    </g>
  ),
  'ic-wood': (
    <g>
      <rect x="6" y="22" width="44" height="20" rx="10" fill="#b45309" />
      <ellipse cx="50" cy="32" rx="9" ry="10" fill="#fcd34d" />
      <ellipse cx="50" cy="32" rx="5" ry="6" fill="none" stroke="#b45309" strokeWidth="1.5" />
    </g>
  ),
  'ic-stone': (
    <g>
      <path d="M6 50 L14 22 L34 12 L54 24 L58 50z" fill="#a8a29e" />
      <path d="M14 22 L34 12 L30 34z" fill="#d6d3d1" />
    </g>
  ),
  'ic-iron': (
    <g>
      <path d="M6 44 L16 26 H48 L58 44z" fill="#64748b" />
      <path d="M16 26 H48 L44 20 H20z" fill="#94a3b8" />
      <path d="M6 44 h52 v6 h-52z" fill="#475569" />
    </g>
  ),
  'ic-gold': (
    <g>
      <circle cx="32" cy="32" r="24" fill="#eab308" />
      <circle cx="32" cy="32" r="18" fill="#facc15" stroke="#ca8a04" strokeWidth="2" />
      <text x="32" y="41" textAnchor="middle" fontSize="24" fontWeight="bold" fill="#a16207">金</text>
    </g>
  ),
  'ic-oil': (
    <g>
      <rect x="14" y="8" width="36" height="50" rx="5" fill="#1e293b" />
      <path d="M32 26 q-8 10 0 14 q8 -4 0 -14z" fill="#facc15" />
    </g>
  ),
  'ic-power': <path d="M36 4 L12 36 H28 L22 60 L52 26 H36 L44 4z" fill="#facc15" stroke="#a16207" strokeWidth="2" />,
};

// 分阶段建筑 & 炮塔
const STRUCT_KEYS: BuildingKey[] = ['power', 'warehouse', 'barracks', 'factory', 'engineer', 'lab'];
const EXTRA: Partial<Record<BuildingKey, (t: number, p: Pal) => { extra?: ReactNode; back?: ReactNode }>> = {
  power: (t, p) => ({
    back:
      t >= 4 ? (
        <g>
          <circle cx="14" cy="14" r="8" fill={p.accent} opacity="0.5" />
          <circle cx="14" cy="14" r="4.5" fill="#fef9c3" />
        </g>
      ) : (
        <g>
          <rect x="9" y={12 - t * 2} width="7" height="30" fill="#78716c" />
          <rect x="9" y={16 - t * 2} width="7" height="2" fill="#ef4444" />
          <circle cx="13" cy={8 - t * 2} r="3.5" fill="#e5e7eb" opacity="0.7" />
          {t >= 1 && <rect x="18" y={16 - t * 2} width="6" height="26" fill="#a8a29e" />}
        </g>
      ),
  }),
  warehouse: (_t, p) => ({
    extra: (
      <g>
        <rect x="47" y="50" width="9" height="9" fill="#ca8a04" stroke={p.wall2} />
        <rect x="50" y="42" width="8" height="8" fill="#eab308" stroke={p.wall2} />
      </g>
    ),
  }),
  barracks: (t) => ({
    extra: t === 0 ? <g>{[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => <path key={i} d={`M${2 + i * 6} 59 v-8 l3 -3 l3 3 v8z`} fill="#92400e" stroke="#451a03" strokeWidth="0.5" />)}</g> : null,
  }),
  factory: (t) => ({
    back: (
      <g>
        <path d={`M4 ${28 - t * 2} l8 -8 v8 l8 -8 v8 l8 -8 v8`} fill="#57534e" />
        <rect x="36" y={10 - t * 2} width="6" height="22" fill="#57534e" />
        <circle cx="39" cy={6 - t * 2} r="3" fill="#d4d4d8" opacity="0.7" />
      </g>
    ),
    extra: t >= 3 ? <path d="M58 58 V8 H30 M58 8 L40 20" stroke="#f59e0b" strokeWidth="2" fill="none" /> : null,
  }),
  engineer: (t, p) => ({
    extra: (
      <g transform={`translate(55 ${40 - t * 2})`}>
        <circle r="7" fill={p.accent} />
        {[0, 45, 90, 135].map((a) => <rect key={a} x="-1.8" y="-9" width="3.6" height="18" fill={p.accent} transform={`rotate(${a})`} />)}
        <circle r="3" fill={p.wall} />
      </g>
    ),
  }),
  lab: (t, p) => ({
    extra: (
      <g>
        {t >= 2 && (
          <g transform="translate(14 8)">
            <path d="M-6 -2 A7 5 0 0 0 6 3" fill={p.trim} stroke="#475569" />
            <line x1="0" y1="0" x2="0" y2="10" stroke="#475569" strokeWidth="1.2" />
          </g>
        )}
        <circle cx="54" cy="50" r="4" fill="#22c55e" opacity="0.8" />
        <circle cx="57" cy="44" r="2" fill="#86efac" opacity="0.7" />
      </g>
    ),
  }),
};

for (let t = 0; t <= 5; t++) {
  const p = PAL[t];
  S[`base_t${t}`] = baseSprite(t, p);
  S[`airbase_t${t}`] = airbaseSprite(t, p);
  S[`house_t${t}`] = houseSprite(t, p);
  S[`turret_base_t${t}`] = turretBase(t);
  S[`turret_gun_t${t}`] = turretGun(t);
  for (const k of STRUCT_KEYS) {
    const ex = EXTRA[k]?.(t, p) ?? {};
    S[`${k}_t${t}`] = structure(t, p, EMBLEM[k](p), ex.extra, ex.back);
  }
}

export function buildingSprite(key: BuildingKey | 'house', level: number): string {
  if (key === 'house') return level <= 0 ? 'house_site' : `house_t${tierOf(level, HOUSE_DEF.max)}`;
  return `${key}_t${tierOf(level, BUILDINGS[key].max)}`;
}

export const SPRITE_IDS = Object.keys(S);

export function SpriteDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        {Object.entries(S).map(([id, node]) => (
          <symbol key={id} id={`spr-${id}`} viewBox="0 0 64 64" overflow="visible">
            {SPRITE_IMAGES[id] ? <image href={SPRITE_IMAGES[id]} x="0" y="0" width="64" height="64" /> : node}
          </symbol>
        ))}
      </defs>
    </svg>
  );
}

export function Sprite({ id, size = 48, className, style }: { id: string; size?: number; className?: string; style?: CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} style={{ overflow: 'visible', ...style }}>
      <use href={`#spr-${id}`} width="64" height="64" />
    </svg>
  );
}

/** 炮塔（底座+炮管组合），用于家园界面 */
export function TurretSprite({ level, size = 48, angle = -35 }: { level: number; size?: number; angle?: number }) {
  const t = tierOf(Math.max(1, level));
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" style={{ overflow: 'visible' }}>
      <use href={`#spr-turret_base_t${t}`} width="64" height="64" />
      <g transform={`translate(0 -2) rotate(${angle} 32 32)`}>
        <use href={`#spr-turret_gun_t${t}`} width="64" height="64" />
      </g>
    </svg>
  );
}

export const RES_ICON: Record<string, string> = { wood: 'ic-wood', stone: 'ic-stone', iron: 'ic-iron', gold: 'ic-gold', oil: 'ic-oil' };
export const RES_NODE: Record<string, string> = { wood: 'tree', stone: 'stone', iron: 'iron', gold: 'gold', oil: 'oil' };
