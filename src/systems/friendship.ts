import type { ItemId } from '../data/items';
import type { NpcId } from '../data/npcs';
import { NPCS } from '../data/npcs';
import type { SaveData } from '../state/save';
import { removeItem } from '../state/save';

export const PTS_PER_HEART = 100;
export const MAX_HEARTS = 10;

export const hearts = (s: SaveData, id: NpcId): number => Math.min(MAX_HEARTS, Math.floor(s.npcs[id].pts / PTS_PER_HEART));

function addPts(s: SaveData, id: NpcId, n: number): void {
  const st = s.npcs[id];
  st.pts = Math.max(0, Math.min(MAX_HEARTS * PTS_PER_HEART, st.pts + n));
}

/** 每天第一次对话加好感，返回是否加了 */
export function talk(s: SaveData, id: NpcId): boolean {
  const st = s.npcs[id];
  if (st.talkDay === s.day) return false;
  st.talkDay = s.day;
  addPts(s, id, 20);
  return true;
}

export type GiftReaction = 'love' | 'like' | 'neutral' | 'dislike' | 'already' | 'none';

export function giftReaction(id: NpcId, item: ItemId): Exclude<GiftReaction, 'already' | 'none'> {
  const d = NPCS[id];
  if ((d.loves as ItemId[]).includes(item)) return 'love';
  if ((d.likes as ItemId[]).includes(item)) return 'like';
  if ((d.dislikes as ItemId[]).includes(item)) return 'dislike';
  return 'neutral';
}

const GIFT_PTS = { love: 80, like: 45, neutral: 20, dislike: -20 } as const;

export function gift(s: SaveData, id: NpcId, item: ItemId): GiftReaction {
  const st = s.npcs[id];
  if (st.giftDay === s.day) return 'already';
  if (!removeItem(s, item)) return 'none';
  const r = giftReaction(id, item);
  st.giftDay = s.day;
  addPts(s, id, GIFT_PTS[r]);
  return r;
}

/** 返回下一段还没看过的心数剧情 */
export function pendingHeartEvent(s: SaveData, id: NpcId): { hearts: number; text: string } | null {
  const h = hearts(s, id);
  const st = s.npcs[id];
  const events = NPCS[id].heartEvents as Record<number, string>;
  const levels = Object.keys(events).map(Number).sort((a, b) => a - b);
  for (const lv of levels) {
    if (lv > st.seenHearts && lv <= h) {
      st.seenHearts = lv;
      return { hearts: lv, text: events[lv] };
    }
  }
  return null;
}

export const hasPerk = (s: SaveData, id: NpcId, minHearts: number): boolean => hearts(s, id) >= minHearts;
