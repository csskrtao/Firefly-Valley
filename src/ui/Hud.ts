import type { Img } from '../gfx/sprite';
import { iconUrl } from '../gfx/tiles';
import { $, h } from './dom';

export interface HudSlot {
  icon: Img;
  label: string;
  count?: number;
}

export interface HudSkill {
  name: string;
  key: string;
  cd: number;
  max: number;
  /** 还没到解锁等级时为需要的等级 */
  need: number | null;
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
  level: number;
  xp: number;
  xpNext: number;
  skills: HudSkill[];
  buffs: string[];
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
  private skillsEl = $('#hudSkills');
  private xpBar = $('#xpBar');
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
    this.xpBar.style.transform = `scaleX(${i.xpNext ? Math.min(1, i.xp / i.xpNext) : 1})`;
    this.text('#xpTxt', i.xpNext ? `Lv.${i.level}  ${i.xp}/${i.xpNext}` : `Lv.${i.level}  已满级`);
    this.text('#hudBuffs', i.buffs.join(' · '));
    $('#hudBuffs').hidden = !i.buffs.length;
    this.text('#hudQuest', i.quest ?? '');
    $('#hudQuest').hidden = !i.quest;
    this.updateSkills(i.skills);

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

  /** 技能栏：电脑上显示在右下角，手机上直接写在触屏按钮上 */
  private updateSkills(list: HudSkill[]): void {
    const key = list.map((k) => `${k.name}${k.need}`).join('|');
    if (this.cache.get('skills') !== key) {
      this.cache.set('skills', key);
      this.skillsEl.innerHTML = '';
      for (const k of list) {
        this.skillsEl.append(h('div', { class: 'sk' }, h('i'), h('em', { text: k.key }), h('b', { text: k.name }), h('small')));
      }
    }
    list.forEach((k, idx) => {
      const el = this.skillsEl.children[idx] as HTMLElement | undefined;
      const state = k.need ? `Lv${k.need}` : k.cd > 0 ? k.cd.toFixed(1) : '就绪';
      if (el) {
        el.className = `sk${k.need ? ' locked' : k.cd > 0 ? '' : ' ready'}`;
        (el.querySelector('i') as HTMLElement).style.transform = `scaleY(${k.need ? 0 : Math.min(1, k.cd / k.max)})`;
        const sm = el.querySelector('small')!;
        if (sm.textContent !== state) sm.textContent = state;
      }
      const btn = document.getElementById(`tSkill${idx}`);
      if (btn) {
        const label = k.need ? `${k.name}\nLv${k.need}` : k.cd > 0 ? `${k.name}\n${Math.ceil(k.cd)}` : k.name;
        if (btn.textContent !== label) btn.textContent = label;
        btn.className = `sk${k.need ? ' locked' : k.cd > 0 ? ' cd' : ''}`;
      }
    });
  }
}
