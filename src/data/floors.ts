import type { ItemId } from './items';
import type { BossId, MonsterId } from './monsters';

export interface MinePalette {
  floor: string;
  dot: string;
  wall: string;
  top: string;
}

export interface ZoneDef {
  id: string;
  name: string;
  from: number;
  to: number;
  pal: MinePalette;
  monsters: Partial<Record<MonsterId, number>>;
  ores: { item: ItemId; weight: number; from?: number }[];
  boss: { floor: number; id: BossId; room: string; pal: MinePalette };
}

export const ZONES: ZoneDef[] = [
  {
    id: 'moss', name: '苔藓矿道', from: 1, to: 5,
    pal: { floor: '#3d4a36', dot: '#52634a', wall: '#232c1d', top: '#3d5030' },
    monsters: { slime: 5, bat: 3, mushroom: 2 },
    ores: [{ item: 'copper', weight: 6 }, { item: 'iron', weight: 1, from: 3 }],
    boss: { floor: 5, id: 'slimeKing', room: '王座洞窟', pal: { floor: '#383150', dot: '#4a4168', wall: '#1c1729', top: '#3a3058' } },
  },
  {
    id: 'rust', name: '锈铁坑道', from: 6, to: 10,
    pal: { floor: '#4a3a30', dot: '#5f4b3d', wall: '#2a1f19', top: '#4d3628' },
    monsters: { skeleton: 4, bat: 2, golem: 2, mole: 3 },
    ores: [{ item: 'iron', weight: 5 }, { item: 'copper', weight: 1 }, { item: 'gold', weight: 2, from: 7 }, { item: 'glowstone', weight: 1, from: 8 }],
    boss: { floor: 10, id: 'ironJaw', room: '铁颚深坑', pal: { floor: '#3e2a26', dot: '#553833', wall: '#1e1210', top: '#4a2620' } },
  },
];

export const MAX_FLOOR = ZONES[ZONES.length - 1].to;

export function zoneFor(floor: number): ZoneDef {
  return ZONES.find((z) => floor >= z.from && floor <= z.to) ?? ZONES[ZONES.length - 1];
}

export function isBossFloor(floor: number): boolean {
  return zoneFor(floor).boss.floor === floor;
}

export function floorName(floor: number): string {
  const z = zoneFor(floor);
  return z.boss.floor === floor ? z.boss.room : z.name;
}
