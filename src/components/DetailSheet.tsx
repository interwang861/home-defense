import { useEffect, useRef, useState } from 'react';
import type { GameState } from '../game/types';
import type { Selection } from './Village';
import { DetailPanel, type Act } from './Panels';
import { cn } from '../utils/cn';

/** 手机端的底部升级面板：点建筑滑出，可下滑关闭 */
export function DetailSheet({ s, sel, act, onClose }: { s: GameState; sel: Selection | null; act: Act; onClose: () => void }) {
  const [shown, setShown] = useState(false);
  const [drag, setDrag] = useState(0);
  const startY = useRef<number | null>(null);

  useEffect(() => {
    if (!sel) {
      setShown(false);
      return;
    }
    setDrag(0);
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, [sel]);

  useEffect(() => {
    if (!sel) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sel, onClose]);

  if (!sel) return null;
  const open = shown && drag <= 90;

  return (
    <div className="fixed inset-0 z-40 lg:hidden">
      <div
        className={cn('absolute inset-0 bg-black/60 backdrop-blur-[2px] transition-opacity duration-300', open ? 'opacity-100' : 'opacity-0')}
        onClick={onClose}
      />
      <div
        className="absolute inset-x-0 bottom-0 max-h-[82vh] overflow-hidden rounded-t-3xl border-t-2 border-amber-400/40 bg-slate-900 shadow-[0_-20px_60px_rgba(0,0,0,0.7)] transition-transform duration-300 ease-out"
        style={{ transform: `translateY(${open ? 0 : 105}%) translateY(${drag}px)` }}
      >
        <div
          className="relative cursor-grab touch-none border-b border-slate-700/70 bg-gradient-to-b from-slate-800 to-slate-900 px-4 pb-2 pt-3 active:cursor-grabbing"
          onPointerDown={(e) => {
            startY.current = e.clientY;
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (startY.current === null) return;
            const d = e.clientY - startY.current;
            if (d > 0) setDrag(d);
          }}
          onPointerUp={() => {
            startY.current = null;
            if (drag > 90) onClose();
            else setDrag(0);
          }}
          onPointerCancel={() => {
            startY.current = null;
            setDrag(0);
          }}
        >
          <div className="absolute left-1/2 top-1.5 h-1 w-10 -translate-x-1/2 rounded-full bg-slate-600" />
          <div className="flex items-center justify-between">
            <span className="mt-1 text-[11px] font-bold uppercase tracking-[0.18em] text-amber-300/80">升级面板</span>
            <button
              onClick={onClose}
              className="mt-1 flex h-7 w-7 items-center justify-center rounded-full bg-slate-700/80 text-slate-300 transition hover:bg-slate-600 hover:text-white active:scale-90"
              aria-label="关闭"
            >
              ✕
            </button>
          </div>
        </div>
        <div className="max-h-[calc(82vh-56px)] overflow-y-auto overscroll-contain pb-6">
          <DetailPanel s={s} sel={sel} act={act} />
        </div>
      </div>
    </div>
  );
}
