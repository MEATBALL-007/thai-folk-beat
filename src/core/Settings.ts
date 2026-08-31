import { readJSON, writeJSON } from './Storage';
import { DIFFICULTIES, type Difficulty } from '../game/Difficulty';

/** Spec §5.2. Persisted under this key. */
const KEY = 'tfb.settings';

/** Resolution selector: ต่ำ / กลาง / สูง -> PixiJS renderer resolution. */
export const RESOLUTION_SCALES = [0.75, 1.0, 1.5] as const;
export const RESOLUTION_LABELS_TH = ['ต่ำ', 'กลาง', 'สูง'] as const;

export const SCROLL_MIN = 0.8;
export const SCROLL_MAX = 2.5;
export const OFFSET_MIN = -200;
export const OFFSET_MAX = 200;

export interface SettingsData {
  /** SFX bus, 0..100. */
  sound: number;
  /** Music bus, 0..100. */
  music: number;
  /** Index into RESOLUTION_SCALES. */
  resolutionStep: number;
  /** Audio calibration, -200..+200 ms. Feeds Conductor.userOffsetMs. */
  offsetMs: number;
  /** Seconds a note is visible before its hit time, 0.8..2.5. */
  scrollSec: number;
  /** Note density. Chosen at song select, persisted here. */
  difficulty: Difficulty;
}

const DEFAULTS: SettingsData = {
  sound: 80,
  music: 80,
  resolutionStep: 1,
  offsetMs: 0,
  scrollSec: 1.5,
  // Deliberately the gentlest setting: the first person to play any given
  // build is someone seeing it cold, and four consecutive misses ends a run.
  difficulty: 'easy',
};

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Every setter clamps. Settings come back from localStorage, which a user can
 * hand-edit — and a scrollSec of 0 would divide by zero in the note highway.
 */
class SettingsStore {
  private data: SettingsData;

  constructor() {
    const raw = readJSON<SettingsData>(KEY, DEFAULTS);
    this.data = {
      sound: clamp(Number(raw.sound) || 0, 0, 100),
      music: clamp(Number(raw.music) || 0, 0, 100),
      resolutionStep: clamp(Math.round(Number(raw.resolutionStep) || 0), 0, RESOLUTION_SCALES.length - 1),
      offsetMs: clamp(Number(raw.offsetMs) || 0, OFFSET_MIN, OFFSET_MAX),
      scrollSec: clamp(Number(raw.scrollSec) || DEFAULTS.scrollSec, SCROLL_MIN, SCROLL_MAX),
      difficulty: DIFFICULTIES.includes(raw.difficulty) ? raw.difficulty : DEFAULTS.difficulty,
    };
  }

  get sound(): number {
    return this.data.sound;
  }
  get music(): number {
    return this.data.music;
  }
  get resolutionStep(): number {
    return this.data.resolutionStep;
  }
  get resolutionScale(): number {
    return RESOLUTION_SCALES[this.data.resolutionStep] ?? 1;
  }
  get offsetMs(): number {
    return this.data.offsetMs;
  }
  get scrollSec(): number {
    return this.data.scrollSec;
  }
  get difficulty(): Difficulty {
    return this.data.difficulty;
  }

  setSound(v: number): void {
    this.data.sound = clamp(v, 0, 100);
    this.save();
  }
  setMusic(v: number): void {
    this.data.music = clamp(v, 0, 100);
    this.save();
  }
  setResolutionStep(v: number): void {
    this.data.resolutionStep = clamp(Math.round(v), 0, RESOLUTION_SCALES.length - 1);
    this.save();
  }
  setOffsetMs(v: number): void {
    this.data.offsetMs = clamp(Math.round(v), OFFSET_MIN, OFFSET_MAX);
    this.save();
  }
  setScrollSec(v: number): void {
    this.data.scrollSec = clamp(v, SCROLL_MIN, SCROLL_MAX);
    this.save();
  }
  setDifficulty(v: Difficulty): void {
    this.data.difficulty = DIFFICULTIES.includes(v) ? v : DEFAULTS.difficulty;
    this.save();
  }

  snapshot(): SettingsData {
    return { ...this.data };
  }

  private save(): void {
    writeJSON(KEY, this.data);
  }
}

export const settings = new SettingsStore();
