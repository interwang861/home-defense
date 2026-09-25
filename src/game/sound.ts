/**
 * 战斗音效：用 Web Audio API 实时合成，不需要任何音频素材文件，
 * 所以打包后依然是单个 HTML。
 *
 * 想换成真实音频文件时，把 play() 里对应分支换成 <audio> 或 AudioBuffer 播放即可。
 */

export type SfxKey =
  | 'melee' | 'bow' | 'gun' | 'snipe' | 'cannon' | 'rocket' | 'flame' | 'laser' | 'bomb' | 'boom';

const VOL_KEY = 'hd-sfx-volume';
const MUTE_KEY = 'hd-sfx-muted';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let voices = 0;

let volume = (() => {
  const v = Number(localStorage.getItem(VOL_KEY));
  return Number.isFinite(v) && v > 0 ? Math.min(1, v) : 0.5;
})();
let muted = localStorage.getItem(MUTE_KEY) === '1';

/** 同类音效的最小间隔（毫秒）。大规模战斗时几百个单位同时开火，必须节流 */
const MIN_GAP: Record<SfxKey, number> = {
  melee: 80, bow: 70, gun: 45, snipe: 110, cannon: 90,
  rocket: 120, flame: 140, laser: 85, bomb: 180, boom: 90,
};
const lastAt: Record<string, number> = {};
const MAX_VOICES = 16;

export function isMuted() {
  return muted;
}
export function getVolume() {
  return volume;
}
export function setVolume(v: number) {
  volume = Math.max(0, Math.min(1, v));
  localStorage.setItem(VOL_KEY, String(volume));
  if (master && ctx) master.gain.setTargetAtTime(volume * 0.5, ctx.currentTime, 0.01);
}
export function setMuted(m: boolean) {
  muted = m;
  localStorage.setItem(MUTE_KEY, m ? '1' : '0');
}

/** 必须在用户交互（点击）之后调用，浏览器才允许出声 */
export function initAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') void ctx.resume();
    return;
  }
  try {
    const AC: typeof AudioContext =
      window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = volume * 0.5;
    // 限幅，避免几十个音效叠加时爆音
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 12;
    comp.attack.value = 0.003;
    comp.release.value = 0.15;
    master.connect(comp);
    comp.connect(ctx.destination);

    const len = Math.floor(ctx.sampleRate * 0.5);
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  } catch {
    ctx = null;
  }
}

function track(node: AudioScheduledSourceNode, dur: number) {
  voices++;
  node.onended = () => {
    voices--;
  };
  node.stop(ctx!.currentTime + dur);
}

/** 噪声源：枪声、爆炸、火焰的基础 */
function noise(dur: number, gain: number, type: BiquadFilterType, freq: number, q = 1, sweepTo?: number) {
  const c = ctx!;
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, c.currentTime);
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(Math.max(40, sweepTo), c.currentTime + dur);
  f.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0008, c.currentTime + dur);
  src.connect(f);
  f.connect(g);
  g.connect(master!);
  src.start();
  track(src, dur);
}

/** 振荡器：激光、弓弦、炮弹低频 */
function tone(type: OscillatorType, from: number, to: number, dur: number, gain: number) {
  const c = ctx!;
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(from, c.currentTime);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, to), c.currentTime + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(gain, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0008, c.currentTime + dur);
  o.connect(g);
  g.connect(master!);
  o.start();
  track(o, dur);
}

/**
 * 播放一次攻击音效
 * @param key 音效种类
 * @param scale 体型/威力系数，越大声音越低沉（0.6~1.8）
 */
export function sfx(key: SfxKey, scale = 1) {
  if (muted || volume <= 0) return;
  if (!ctx) return;
  if (ctx.state === 'suspended') return;
  if (voices >= MAX_VOICES) return;

  const now = performance.now();
  if (now - (lastAt[key] ?? -1e9) < MIN_GAP[key]) return;
  lastAt[key] = now;

  const s = Math.max(0.6, Math.min(1.8, scale));
  const p = 1 / s; // 体型越大音调越低

  switch (key) {
    case 'melee': // 刀剑碰撞
      noise(0.07, 0.35, 'highpass', 2600 * p);
      tone('triangle', 900 * p, 320 * p, 0.06, 0.12);
      break;
    case 'bow': // 弓弦
      noise(0.05, 0.3, 'bandpass', 2200 * p, 3);
      tone('sine', 520 * p, 180 * p, 0.07, 0.1);
      break;
    case 'gun': // 步枪 / 机枪
      noise(0.055, 0.5, 'bandpass', 1500 * p, 1.2);
      tone('square', 260 * p, 70 * p, 0.05, 0.16);
      break;
    case 'snipe': // 狙击枪，尾音更长
      noise(0.09, 0.55, 'bandpass', 1100 * p, 1.5);
      tone('square', 200 * p, 55 * p, 0.12, 0.2);
      noise(0.28, 0.12, 'lowpass', 700 * p, 1, 200);
      break;
    case 'cannon': // 坦克炮 / 主基地主炮
      tone('sine', 170 * p, 38 * p, 0.3, 0.5);
      noise(0.22, 0.45, 'lowpass', 900 * p, 1, 180);
      break;
    case 'rocket': // 火箭 / 导弹发射
      noise(0.34, 0.4, 'lowpass', 500 * p, 1, 1800 * p);
      tone('sawtooth', 130 * p, 420 * p, 0.3, 0.14);
      break;
    case 'flame': // 喷火
      noise(0.26, 0.3, 'lowpass', 820 * p, 0.7, 340);
      break;
    case 'laser': // 激光 / 光束
      tone('sawtooth', 1750 * p, 300 * p, 0.14, 0.2);
      tone('sine', 880 * p, 190 * p, 0.12, 0.14);
      break;
    case 'bomb': // 航空炸弹
      tone('sine', 130 * p, 26 * p, 0.55, 0.6);
      noise(0.45, 0.5, 'lowpass', 600 * p, 1, 120);
      break;
    case 'boom': // 单位 / 建筑爆炸
      tone('sine', 150 * p, 30 * p, 0.4, 0.45);
      noise(0.36, 0.42, 'lowpass', 1000 * p, 1, 150);
      break;
  }
}

/** 根据单位属性推断它该用哪种音效 */
export function weaponSfx(o: { range: number; splash: number; beam?: boolean; cd: number; air?: boolean; id?: string }): SfxKey {
  if (o.beam) return 'laser';
  if (o.id === 'flamer' || o.id === 'flametank') return 'flame';
  if (o.id === 'sniper') return 'snipe';
  if (o.id === 'archer') return 'bow';
  if (o.range < 60) return 'melee';
  if (o.air && o.splash >= 60) return 'bomb';
  if (o.splash >= 55) return 'cannon';
  if (o.splash >= 25) return o.cd >= 1.5 ? 'rocket' : 'cannon';
  return 'gun';
}

/** 炮塔各阶段的武器音效 */
export const TURRET_SFX: Record<string, SfxKey> = {
  arrow: 'bow',
  shell: 'cannon',
  bullet: 'gun',
  missile: 'rocket',
  laser: 'laser',
};
