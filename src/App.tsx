import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type { BattleResult, GameState } from './game/types';
import { SAVE_KEY } from './game/config';
import { addLog, applyBattle, canAfford, loadGame, newGame, pay, saveGame, tick } from './game/logic';
import { autoResolve, createBattle, makeResult, repairBase, repairCost, type BattleState } from './game/battle';
import { SpriteDefs } from './game/sprites';
import { TopBar } from './components/TopBar';
import { Village, type Selection } from './components/Village';
import { BestiaryPanel, DetailPanel, EngineerQueue, LogPanel, ResidentsPanel, type Act } from './components/Panels';
import { ArmyPanel } from './components/ArmyPanel';
import { TechPanel } from './components/TechPanel';
import { AttackAlert, BattleView, ResultModal } from './components/BattleView';
import { Btn, fmtDur } from './components/ui';
import { cn } from './utils/cn';

type Tab = 'detail' | 'residents' | 'army' | 'tech' | 'bestiary' | 'log';
type Phase = 'idle' | 'alert' | 'battle';

const SCALES = [1, 10, 60, 600, 3600];

function processOffline(s: GameState): string | null {
  let secs = (Date.now() - s.lastSaved) / 1000;
  if (!(secs > 10)) return null;
  secs = Math.min(secs, 48 * 3600);
  let remaining = secs;
  let battles = 0;
  let wins = 0;
  let guard = 0;
  while (remaining > 0 && guard < 10000) {
    guard++;
    const toAtk = Math.max(0, s.nextAttackAt - s.gameTime);
    const step = Math.min(remaining, 60, toAtk);
    tick(s, step);
    remaining -= step;
    if (s.nextAttackAt - s.gameTime <= 1e-6) {
      const r = autoResolve(s);
      applyBattle(s, r);
      battles++;
      if (r.victory) wins++;
    }
  }
  const text = `离线 ${fmtDur(secs)}，居民持续采集资源${battles ? `；期间遭遇 ${battles} 次进攻（自动结算：胜 ${wins} 负 ${battles - wins}）` : ''}。`;
  addLog(s, text, 'info');
  return text;
}

export default function App() {
  const gsRef = useRef<GameState | null>(null);
  const offlineRef = useRef<string | null>(null);
  if (!gsRef.current) {
    const loaded = loadGame();
    if (loaded) {
      if (!SCALES.includes(loaded.timeScale)) loaded.timeScale = 1;
      offlineRef.current = processOffline(loaded);
      gsRef.current = loaded;
    } else {
      gsRef.current = newGame();
    }
  }
  const s = gsRef.current;
  const [, force] = useReducer((x: number) => x + 1, 0);
  const [sel, setSel] = useState<Selection | null>({ kind: 'building', key: 'base' });
  const [tab, setTab] = useState<Tab>('detail');
  const [phase, setPhase] = useState<Phase>('idle');
  const phaseRef = useRef<Phase>('idle');
  const [battle, setBattle] = useState<BattleState | null>(null);
  const [result, setResult] = useState<BattleResult | null>(null);
  const [offline, setOffline] = useState<string | null>(offlineRef.current);
  const [toasts, setToasts] = useState<{ id: number; text: string }[]>([]);

  const changePhase = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  const toast = useCallback((text: string) => {
    const id = Math.random();
    setToasts((t) => [...t.slice(-3), { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2200);
  }, []);

  const act: Act = (fn) => {
    const r = fn(gsRef.current!);
    if (typeof r === 'string') toast(r);
    force();
  };

  // 主循环
  useEffect(() => {
    let last = Date.now();
    let saveAcc = 0;
    const id = setInterval(() => {
      const now = Date.now();
      const real = Math.min(60, (now - last) / 1000);
      last = now;
      const g = gsRef.current!;
      saveAcc += real;
      if (phaseRef.current === 'idle') {
        const dt = real * g.timeScale;
        const toAtk = g.nextAttackAt - g.gameTime;
        if (dt >= toAtk) {
          tick(g, Math.max(0, toAtk));
          changePhase('alert');
        } else {
          tick(g, dt);
        }
      }
      if (saveAcc > 3) {
        saveAcc = 0;
        saveGame(g);
      }
      force();
    }, 200);
    const onUnload = () => saveGame(gsRef.current!);
    window.addEventListener('beforeunload', onUnload);
    return () => {
      clearInterval(id);
      window.removeEventListener('beforeunload', onUnload);
    };
  }, []);

  const onFight = () => {
    setBattle(createBattle(gsRef.current!));
    changePhase('battle');
  };

  const onAuto = () => {
    const g = gsRef.current!;
    const r = autoResolve(g);
    applyBattle(g, r);
    saveGame(g);
    setResult(r);
    changePhase('idle');
  };

  const onBattleDone = (b: BattleState) => {
    const g = gsRef.current!;
    const r = makeResult(g, b, false);
    applyBattle(g, r);
    saveGame(g);
    setBattle(null);
    setResult(r);
    changePhase('idle');
  };

  const onRepair = (b: BattleState): string | void => {
    const g = gsRef.current!;
    const c = repairCost(b);
    if (!canAfford(g.res, c)) return '资源不足，无法修复';
    pay(g.res, c);
    repairBase(b);
  };

  const onAttackNow = () => {
    if (phaseRef.current !== 'idle') return;
    const g = gsRef.current!;
    g.nextAttackAt = g.gameTime;
    changePhase('alert');
  };

  const onReset = () => {
    if (!confirm('确定要清除存档，重新开始游戏吗？')) return;
    localStorage.removeItem(SAVE_KEY);
    gsRef.current = newGame();
    setSel({ kind: 'building', key: 'base' });
    setResult(null);
    setBattle(null);
    changePhase('idle');
    force();
  };

  const onSelect = (x: Selection) => {
    setSel(x);
    setTab('detail');
  };

  const idle = s.residents.filter((p) => p.job === 'idle').length;
  const TABS: { key: Tab; label: string }[] = [
    { key: 'detail', label: '详情' },
    { key: 'residents', label: `居民${idle ? `(${idle}闲)` : ''}` },
    { key: 'army', label: '军队' },
    { key: 'tech', label: '科技' },
    { key: 'bestiary', label: '图鉴' },
    { key: 'log', label: '日志' },
  ];

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,#1e293b,#020617)] text-white">
      <SpriteDefs />
      <TopBar
        s={s}
        onScale={(v) => act((d) => {
          d.timeScale = v;
        })}
        onAttackNow={onAttackNow}
        onReset={onReset}
      />

      <main className="mx-auto grid max-w-[1500px] gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_390px]">
        <section className="space-y-3">
          <Village s={s} sel={sel} onSelect={onSelect} />
          <div className="rounded-xl border border-slate-700 bg-slate-800/70 p-2">
            <div className="mb-1.5 text-xs font-bold text-slate-400">工程师建造队列</div>
            <EngineerQueue s={s} />
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-3 text-xs leading-relaxed text-slate-400">
            <b className="text-slate-200">玩法提示：</b>
            点击资源点派遣居民采集木材、石头、铁矿、金矿、石油；升级主基地解锁更多资源与建筑等级上限（升到10级约1小时，50级需2800小时）；仓库决定资源上限；电力不足会降低采集效率。
            建筑每 10 级进化一次外形；4 座炮塔守护基地；兵营/战车工厂/空军基地生产部队，部队可进阶至 5 星；作战实验室研发科技。
            怪物每 <b className="text-rose-300">12 小时</b>进攻一次（坚守 5 分钟），每 <b className="text-fuchsia-300">7 天</b>迎来一次大防守（持续 30 分钟）。
            胜利获得当前资源 6%，失败损失 5%。右上角可调整时间流速快速体验。
          </div>
        </section>

        <aside className="h-fit rounded-xl border border-slate-700 bg-slate-800/80 shadow-xl lg:sticky lg:top-[76px]">
          <div className="flex border-b border-slate-700">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  'flex-1 px-1 py-2 text-xs font-bold transition sm:text-sm',
                  tab === t.key ? 'border-b-2 border-amber-400 text-amber-300' : 'text-slate-400 hover:text-slate-200',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          {tab === 'detail' && <DetailPanel s={s} sel={sel} act={act} />}
          {tab === 'residents' && <ResidentsPanel s={s} act={act} />}
          {tab === 'army' && <ArmyPanel s={s} act={act} />}
          {tab === 'tech' && <TechPanel s={s} act={act} />}
          {tab === 'bestiary' && <BestiaryPanel s={s} act={act} />}
          {tab === 'log' && <LogPanel s={s} />}
        </aside>
      </main>

      {phase === 'alert' && <AttackAlert gs={s} onFight={onFight} onAuto={onAuto} />}
      {phase === 'battle' && battle && <BattleView battle={battle} gs={s} onRepair={onRepair} onDone={onBattleDone} />}
      {result && <ResultModal r={result} onClose={() => setResult(null)} />}

      {offline && (
        <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/60 p-4">
          <div className="max-w-sm rounded-2xl border border-sky-500 bg-slate-900 p-5 text-center">
            <div className="text-4xl">🌙</div>
            <h2 className="mt-1 text-xl font-bold text-sky-300">欢迎回来！</h2>
            <p className="mt-2 text-sm text-slate-300">{offline}</p>
            <Btn className="mt-4 w-full" onClick={() => setOffline(null)}>
              继续建设家园
            </Btn>
          </div>
        </div>
      )}

      <div className="pointer-events-none fixed bottom-4 left-1/2 z-[70] flex -translate-x-1/2 flex-col items-center gap-2">
        {toasts.map((t) => (
          <div key={t.id} className="toast-in rounded-lg bg-rose-600 px-4 py-2 text-sm font-bold text-white shadow-lg">
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}
