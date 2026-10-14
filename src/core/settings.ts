import { audio } from './Audio';
import { storage } from './Storage';

export interface Settings {
  music: number;
  sfx: number;
  shake: boolean;
  damageNumbers: boolean;
}

const DEFAULTS: Settings = { music: 0.5, sfx: 0.8, shake: true, damageNumbers: true };

export const settings: Settings = { ...DEFAULTS, ...(storage.get<Partial<Settings>>('settings') ?? {}) };

export function saveSettings(): void {
  storage.set('settings', settings);
  applySettings();
}

export function applySettings(): void {
  audio.setVolume(settings.music, settings.sfx);
}

/** 跨存档的解锁记录，例如隐藏职业 */
export const unlocks = {
  has(key: string): boolean {
    return !!storage.get<Record<string, boolean>>('unlocks')?.[key];
  },
  add(key: string): boolean {
    const u = storage.get<Record<string, boolean>>('unlocks') ?? {};
    if (u[key]) return false;
    u[key] = true;
    storage.set('unlocks', u);
    return true;
  },
};
