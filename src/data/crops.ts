import type { ItemId } from './items';

export interface CropDef {
  name: string;
  item: ItemId;
  seed: ItemId;
  /** 可种植的季节，0 春 1 夏 2 秋 3 冬 */
  seasons: number[];
  days: number;
  /** 收获后再长多少天可再次收获；不填则收获后消失 */
  regrow?: number;
  color: string;
}

export const CROPS = {
  radish: { name: '萝卜', item: 'radish', seed: 'radishSeed', seasons: [0], days: 2, color: '#e05a7a' },
  berry: { name: '光莓', item: 'berry', seed: 'berrySeed', seasons: [0], days: 3, regrow: 2, color: '#62f0d6' },
  pepper: { name: '火椒', item: 'pepper', seed: 'pepperSeed', seasons: [1], days: 3, regrow: 2, color: '#e8503a' },
  melon: { name: '星瓜', item: 'melon', seed: 'melonSeed', seasons: [1], days: 6, color: '#ffd34d' },
  yam: { name: '铁根薯', item: 'yam', seed: 'yamSeed', seasons: [2], days: 4, color: '#9a7a5a' },
  pumpkin: { name: '月南瓜', item: 'pumpkin', seed: 'pumpkinSeed', seasons: [2], days: 7, color: '#f0a040' },
} satisfies Record<string, CropDef>;

export type CropId = keyof typeof CROPS;
export const CROP_IDS = Object.keys(CROPS) as CropId[];

export function cropForSeed(seed: ItemId): CropId | null {
  return CROP_IDS.find((id) => CROPS[id].seed === seed) ?? null;
}
