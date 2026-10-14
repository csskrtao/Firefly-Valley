import type { Img } from '../gfx/sprite';
import { iconUrl } from '../gfx/tiles';
import { $, h } from './dom';

export interface HudSlot {
  icon: Img;
  label: string;
  count?: number;
}

export interface HudInfo {
  hp: number;
  maxHp: number;
  en: number;
  date: string;
  clock: string;
  weather: string;
  gold: number;
  where: string;
  cls: string;
  skill: string;
  skillCd: number;
  slots: HudSlot[];
  selected: number;
  quest: string | null;
  boss: { name: string; hp: number; max: number } | null;
}

/** 屏幕上的常驻信息：血条、时间、金币、工具栏、Boss 血条 */
export class Hud {
  private root = $('#hud');
  private hpBar = $('#hpBar');
  private enBar = $('#enBar');
  private hotbar = $('#hotbar');
  private bossbar = $('#bossbar');
  private cache = new Map<string, string>();
  onSlot: ((i: number) => void) | null = null;

  show(on: boolean): void {
    this.root.hidden = !on;
    // 触屏按键只在游戏中显示
    document.body.classList.toggle('playing', on);
  }

  private text(id: string, v: string): void {
    if (this.cache.get(id) === v) return;
    this.cache.set(id, v);
    $(id).textContent = v;
  }

  update(i: HudInfo): void {
    this.hpBar.style.transform = `scaleX(${Math.max(0, i.hp / i.maxHp)})`;
    this.enBar.style.transform = `scaleX(${Math.max(0, i.en / 100)})`;
    this.text('#hpTxt', `HP ${Math.ceil(i.hp)}/${i.maxHp}`);
    this.text('#enTxt', `体力 ${Math.ceil(i.en)}/100`);
    this.text('#hudDate', i.date);
    this.text('#hudClock', `${i.clock} ${i.weather}`);
    this.text('#hudGold', `${i.gold} G`);
    this.text('#hudWhere', i.where);
    this.text('#hudSkill', `${i.cls} · ${i.skill} ${i.skillCd > 0 ? `${i.skillCd.toFixed(1)}s` : '就绪'}`);
    this.text('#hudQuest', i.quest ?? '');
    $('#hudQuest').hidden = !i.quest;

    const key = i.slots.map((s) => `${s.label}:${s.count ?? ''}`).join('|') + `#${i.selected}`;
    if (this.cache.get('slots') !== key) {
      this.cache.set('slots', key);
      this.hotbar.innerHTML = '';
      i.slots.forEach((s, idx) => {
        const bt = h('button', { type: 'button', class: `slot${idx === i.selected ? ' on' : ''}`, title: s.label, 'aria-label': s.label },
          h('img', { src: iconUrl(s.icon), alt: '' }),
          h('em', { text: String(idx + 1) }),
          s.count !== undefined ? h('b', { text: String(s.count) }) : null,
        );
        bt.addEventListener('click', () => this.onSlot?.(idx));
        this.hotbar.append(bt);
      });
    }

    this.bossbar.hidden = !i.boss;
    if (i.boss) {
      this.text('#bossName', i.boss.name);
      $('#bossFill').style.transform = `scaleX(${Math.max(0, i.boss.hp / i.boss.max)})`;
    }
  }
}
