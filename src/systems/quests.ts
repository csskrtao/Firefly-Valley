import type { QuestDef } from '../data/quests';
import { QUESTS } from '../data/quests';
import type { BossId, MonsterId } from '../data/monsters';
import type { SaveData } from '../state/save';
import { addItem, count, removeItem } from '../state/save';
import type { ItemId } from '../data/items';

export const currentQuest = (s: SaveData): QuestDef | null => QUESTS[s.quest.index] ?? null;

export function accept(s: SaveData): boolean {
  if (!currentQuest(s) || s.quest.active) return false;
  s.quest.active = true;
  s.quest.progress = 0;
  return true;
}

export function onKill(s: SaveData, mon: MonsterId): void {
  const q = currentQuest(s);
  if (!q || !s.quest.active) return;
  if (q.goal.type === 'kill' && q.goal.target === mon) s.quest.progress = Math.min(q.goal.count, s.quest.progress + 1);
}

export function onBoss(s: SaveData, boss: BossId): void {
  const q = currentQuest(s);
  if (!q || !s.quest.active) return;
  if (q.goal.type === 'boss' && q.goal.target === boss) s.quest.progress = 1;
}

export function progressOf(s: SaveData): { have: number; need: number } {
  const q = currentQuest(s);
  if (!q) return { have: 0, need: 0 };
  switch (q.goal.type) {
    case 'kill': return { have: s.quest.progress, need: q.goal.count };
    case 'collect': return { have: Math.min(count(s, q.goal.item), q.goal.count), need: q.goal.count };
    case 'boss': return { have: s.quest.progress, need: 1 };
  }
}

export function isComplete(s: SaveData): boolean {
  if (!s.quest.active) return false;
  const p = progressOf(s);
  return p.have >= p.need;
}

/** 交付委托并发放奖励，bonus 为金币加成比例 */
export function turnIn(s: SaveData, bonus = 0): QuestDef | null {
  const q = currentQuest(s);
  if (!q || !isComplete(s)) return null;
  if (q.goal.type === 'collect') removeItem(s, q.goal.item, q.goal.count);
  s.gold += Math.round(q.reward.gold * (1 + bonus));
  for (const [id, n] of Object.entries(q.reward.items ?? {}) as [ItemId, number][]) addItem(s, id, n);
  s.quest.index++;
  s.quest.active = false;
  s.quest.progress = 0;
  return q;
}
