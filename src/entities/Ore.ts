import type { ItemId } from '../data/items';

const ORE_HP: Partial<Record<ItemId, number>> = { copper: 2, iron: 3, gold: 4, glowstone: 5 };

export class Ore {
  hp: number;
  shake = 0;
  constructor(readonly tx: number, readonly ty: number, readonly item: ItemId) {
    this.hp = ORE_HP[item] ?? 2;
  }
}
