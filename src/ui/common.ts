import { audio } from '../core/Audio';
import { saveSettings, settings } from '../core/settings';
import { h } from './dom';

/** 设置页：音量、震屏、伤害数字。标题画面和暂停菜单共用 */
export function renderSettings(body: HTMLElement, onChange?: () => void): void {
  const slider = (label: string, key: 'music' | 'sfx') => {
    const id = `set-${key}`;
    const input = h('input', { type: 'range', id, min: '0', max: '100', step: '5', value: String(Math.round(settings[key] * 100)), 'data-nav': '' });
    const out = h('output', { for: id, text: `${Math.round(settings[key] * 100)}%` });
    input.addEventListener('input', () => {
      settings[key] = Number(input.value) / 100;
      out.textContent = `${input.value}%`;
      saveSettings();
      if (key === 'sfx') audio.sfx('blip');
    });
    return h('label', { class: 'setting', for: id }, h('span', { text: label }), input, out);
  };
  const toggle = (label: string, key: 'shake' | 'damageNumbers') => {
    const bt = h('button', { type: 'button', class: 'setting toggle', 'data-nav': '' }, h('span', { text: label }), h('b', { text: settings[key] ? '开' : '关' }));
    bt.addEventListener('click', () => {
      settings[key] = !settings[key];
      saveSettings();
      audio.sfx('select');
      bt.querySelector('b')!.textContent = settings[key] ? '开' : '关';
      onChange?.();
    });
    return bt;
  };
  body.append(
    h('div', { class: 'settings' },
      slider('音乐音量', 'music'),
      slider('音效音量', 'sfx'),
      toggle('屏幕震动', 'shake'),
      toggle('显示伤害数字', 'damageNumbers'),
    ),
    h('p', { class: 'muted', text: '设置会保存在这台设备的浏览器里。' }),
  );
}

const KEYS: [string, string][] = [
  ['WASD / 方向键', '移动'],
  ['J / 空格', '使用当前工具（锄地、浇水、播种、挖矿）'],
  ['K', '普通攻击（法师和萤灵使是远程）'],
  ['L', '职业技能'],
  ['E / 回车', '对话、开门、上下楼、收获'],
  ['1–5 / Tab', '切换工具；再按一次 3 切换种子'],
  ['Q', '喝药水，没有就吃作物'],
  ['I / B', '背包、装备、人物关系、委托'],
  ['Esc / P', '暂停菜单'],
];

export function renderHelp(body: HTMLElement): void {
  const dl = h('dl', { class: 'keys' });
  for (const [k, v] of KEYS) dl.append(h('dt', { text: k }), h('dd', { text: v }));
  body.append(
    dl,
    h('h3', { text: '怎么玩' }),
    h('ol', { class: 'guide' },
      h('li', { text: '在围栏里的田地锄地、播种、浇水。每天浇水作物才会长，下雨天不用浇。' }),
      h('li', { text: '去南边的矿脉挖矿打怪，矿石交给铁匠老岩锻造和强化装备。' }),
      h('li', { text: '每 5 层有一个守层者。击败后才能打造更高阶的装备、去更深的楼层。' }),
      h('li', { text: '和镇民聊天、送礼提升好感，好感高了会有折扣和特殊奖励。' }),
      h('li', { text: '凌晨 2 点前回家睡觉，睡觉会自动存档。' }),
    ),
    h('p', { class: 'muted', text: '手机上用屏幕两侧的虚拟按键操作。' }),
  );
}

/** 存档码页：显示一个存档的存档码和复制按钮。标题画面和暂停菜单共用 */
export function renderSaveCode(body: HTMLElement, code: string): void {
  const box = h('textarea', { class: 'code-box', rows: '5', readonly: '', spellcheck: 'false', 'aria-label': '存档码' });
  box.value = code;
  const status = h('p', { class: 'muted', text: '在另一台设备上打开萤石谷，标题画面选「导入存档码」，粘贴进去就能接着玩。' });
  const copy = h('button', { type: 'button', class: 'menu-btn', 'data-nav': '' }, h('span', { text: '复制存档码' }));
  copy.addEventListener('click', async () => {
    audio.sfx('select');
    try {
      await navigator.clipboard.writeText(code);
      status.textContent = '已复制。存档码里有你的全部进度，收好别弄丢。';
    } catch {
      // 不允许直接写剪贴板时，选中全部文字让玩家自己复制
      box.focus();
      box.select();
      status.textContent = '已经全部选中，按 Ctrl+C（手机上长按选择“复制”）。';
    }
  });
  box.addEventListener('focus', () => box.select());
  body.append(box, h('div', { class: 'menu' }, copy), status);
}
