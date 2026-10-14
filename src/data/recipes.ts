import type { ItemId } from './items';

export interface Recipe {
  dish: ItemId;
  needs: Partial<Record<ItemId, number>>;
}

/** 在家里的灶台上做饭：作物、采集物组合成料理 */
export const RECIPES: Recipe[] = [
  { dish: 'salad', needs: { radish: 1, leek: 1 } },
  { dish: 'morelSoup', needs: { morel: 1, radish: 1 } },
  { dish: 'skewer', needs: { mushroom: 2 } },
  { dish: 'pepperSoup', needs: { pepper: 2 } },
  { dish: 'jam', needs: { berry: 2, raspberry: 1 } },
  { dish: 'smoothie', needs: { melon: 1, crystalFruit: 1 } },
  { dish: 'pie', needs: { pumpkin: 1, hazelnut: 2 } },
  { dish: 'bar', needs: { hazelnut: 2, dandelion: 1 } },
  { dish: 'stew', needs: { winterRoot: 2, yam: 1 } },
  { dish: 'tea', needs: { fireflower: 1, dandelion: 1 } },
];
