import type { ClassId } from '../data/classes';
import { ARMOR_TIERS } from '../data/equipment';
import type { NpcId } from '../data/npcs';
import type { CharSet, Look } from './character';
import { makeCharacter, makeCritter } from './character';
import { owlSprite } from './sprites';

const SKIN = '#f0c49a';

/** 镇民的长相 */
export const NPC_LOOKS: Record<Exclude<NpcId, 'owl'>, Look> = {
  smith: {
    skin: '#e0a878', hair: '#9a9a9a', hairStyle: 'bald', beard: '#c4c4c4',
    top: '#b8423a', apron: '#6b4a2b', lower: 'pants', legs: '#3a3a4a', boots: '#2a1d16',
  },
  vera: {
    skin: SKIN, hair: '#d9583b', hairStyle: 'long',
    top: '#3f9e6a', trim: '#fff2b0', apron: '#fff2b0', lower: 'skirt', legs: '#2f7a52', boots: '#5a3a22',
  },
  lia: {
    skin: '#f2cfa8', hair: '#b49be0', hairStyle: 'bun',
    top: '#f4f4f4', trim: '#e05a7a', emblem: '#e05a7a', lower: 'robe', legs: '#f4f4f4', boots: '#6b5a8a',
  },
  ian: {
    skin: SKIN, hair: '#2a2a3a', hairStyle: 'short', glasses: '#ffcf5a',
    top: '#2f4a7a', trim: '#ffcf5a', lower: 'pants', legs: '#2a2a3a', boots: '#1a1a22',
  },
  kid: {
    skin: SKIN, hair: '#7a4a2a', hairStyle: 'short', hat: { kind: 'cap', color: '#4caf50', trim: '#ffd34d' },
    top: '#e8894a', lower: 'pants', legs: '#3b4a6b', boots: '#5a3a22', kid: true,
  },
};

export const npcChars: Record<NpcId, CharSet> = {
  smith: makeCharacter(NPC_LOOKS.smith),
  vera: makeCharacter(NPC_LOOKS.vera),
  lia: makeCharacter(NPC_LOOKS.lia),
  ian: makeCharacter(NPC_LOOKS.ian),
  kid: makeCharacter(NPC_LOOKS.kid),
  owl: makeCritter(owlSprite),
};

/** 各职业的基础外观（布衣） */
export const CLASS_LOOKS: Record<ClassId, Look> = {
  warrior: {
    skin: SKIN, hair: '#6b3e22', hairStyle: 'spiky', hat: { kind: 'headband', color: '#c0392b' },
    top: '#3f6db0', trim: '#6b4a2b', lower: 'pants', legs: '#5a4030', boots: '#3a2a1e',
  },
  mage: {
    skin: SKIN, hair: '#e0b85a', hairStyle: 'long', hat: { kind: 'wizard', color: '#5b3fa8', trim: '#ffd34d' },
    top: '#4a3a9a', trim: '#ffd34d', lower: 'robe', legs: '#4a3a9a', boots: '#3a2a1e',
  },
  rogue: {
    skin: SKIN, hair: '#2a2436', hairStyle: 'short', hat: { kind: 'hood', color: '#2a2436', trim: '#3d3550' }, scarf: '#8a2030',
    top: '#3a3446', trim: '#8a2030', lower: 'pants', legs: '#2a2436', boots: '#1a1620',
  },
  spirit: {
    skin: '#f4dcc0', hair: '#dff7f2', hairStyle: 'bob', eyes: '#1f8f7f', hat: { kind: 'headband', color: '#62f0d6' },
    top: '#2a8f86', trim: '#62f0d6', lower: 'robe', legs: '#2a8f86', boots: '#1e4a46',
  },
};

/** 在职业外观上叠加护甲 */
export function armoredLook(cls: ClassId, tier: number): Look {
  const base = CLASS_LOOKS[cls];
  if (tier <= 0) return base;
  const c = ARMOR_TIERS[tier].color;
  const look: Look = { ...base, pauldron: c };
  const robe = base.lower === 'robe';
  if (tier >= 2 && !robe) look.plate = c;
  if (tier >= 2 && robe) look.trim = c;
  if (tier >= 3) look.boots = c === '#e8b830' ? '#8a6a20' : look.boots;
  return look;
}

const playerCache = new Map<string, CharSet>();

export function playerChar(cls: ClassId, tier: number): CharSet {
  const key = `${cls}:${tier}`;
  let set = playerCache.get(key);
  if (!set) {
    set = makeCharacter(armoredLook(cls, tier));
    playerCache.set(key, set);
  }
  return set;
}
