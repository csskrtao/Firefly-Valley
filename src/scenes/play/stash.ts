import { bagUsed } from '../../state/save';
import type { BagCell } from '../../systems/gear';
import { bagCells, stashCells, stashUsed, storeGear, storeItem, storeMaterials, takeGear, takeItem } from '../../systems/gear';
import { h } from '../../ui/dom';
import type { PlayScene } from '../PlayScene';
import { actBtn, emptyCell, gearCell, itemSlotCell } from './gearui';

/** 家里的仓库箱：左边背包，右边箱子，点一格就整组搬过去 */
export function stashPanel(sc: PlayScene): void {
  sc.sfx('select');
  sc.ui.panel.show('仓库箱', [{ id: 'stash', label: '仓库箱', render: (body) => renderStash(sc, body) }], {
    hint: '点背包里的东西放进箱子，点箱子里的拿回背包 · Esc 返回',
  });
}

function renderStash(sc: PlayScene, body: HTMLElement): void {
  const s = sc.s;
  const move = (ok: boolean, full: string) => {
    if (ok) sc.sfx('blip');
    else sc.toast(full);
    sc.ui.panel.refresh();
  };
  const grid = (cells: BagCell[], size: number, used: number, toStash: boolean) => {
    const el = h('div', { class: 'gslots' });
    for (const c of cells) {
      const cell = c.kind === 'gear' ? gearCell(c.g) : itemSlotCell(c.id, c.n);
      cell.addEventListener('click', () => {
        if (c.kind === 'gear') move(toStash ? storeGear(s, c.g.id) : takeGear(s, c.g.id), toStash ? '仓库箱满了' : '背包满了');
        else move((toStash ? storeItem(s, c.id, c.n) : takeItem(s, c.id, c.n)) > 0, toStash ? '仓库箱满了' : '背包满了');
      });
      el.append(cell);
    }
    for (let i = used; i < size; i++) el.append(emptyCell());
    return el;
  };
  const bUsed = bagUsed(s);
  const sUsed = stashUsed(s);
  body.append(
    h('div', { class: 'bag-head' },
      actBtn('存入矿石、素材和作物', () => {
        const n = storeMaterials(s);
        move(n > 0, '没有可以存的，或者箱子满了');
      }, { note: '身上选中的种子会留着' }),
    ),
    h('div', { class: 'stash' },
      h('section', {}, h('h3', { text: `背包 ${bUsed} / ${s.bagSize}` }), grid(bagCells(s), s.bagSize, bUsed, true)),
      h('section', {}, h('h3', { text: `仓库箱 ${sUsed} / ${s.stash.size}` }), grid(stashCells(s), s.stash.size, sUsed, false)),
    ),
  );
}
