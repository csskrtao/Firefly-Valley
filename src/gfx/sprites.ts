import { ARMOR_TIERS } from '../data/equipment';
import type { Img } from './sprite';
import { sprite } from './sprite';

const E = '................';

const PLAYER = [
  '......hhhh......', '.....hhhhhh.....', '....hhhhhhhh....', '....hssssssh....', '....sesssses....', '....ssssssss....', '.....ssssss.....',
  '....bbbbbbbb....', '...sbbbbbbbbs...', '...sbbbbbbbbs...', '....bbbbbbbb....', '....pppppppp....', '....ppp..ppp....', '....ppp..ppp....', '....kkk..kkk....', E,
];
const LEGS_B = ['.....pp..ppp....', '.....pp..ppp....', '.....kk..kkk....'];

export interface PlayerFrames { front: Img[]; back: Img[] }

/** 每阶护甲一套：正面/背面，各两帧走路动画 */
export const playerSprites: PlayerFrames[] = ARMOR_TIERS.map((a) => {
  const pal = { h: '#5a3a22', s: '#f0c49a', e: '#22161a', b: a.color, p: '#3b4a6b', k: '#2a1d16' };
  const back = PLAYER.map((r, i) => (i >= 3 && i <= 5 ? r.replace(/[es]/g, 'h') : r));
  const walk = (rows: string[]) => rows.slice(0, 12).concat(LEGS_B, [E]);
  return { front: [sprite(PLAYER, pal), sprite(walk(PLAYER), pal)], back: [sprite(back, pal), sprite(walk(back), pal)] };
});

const SLIME = [E, E, E, E, E, E, '......gggg......', '....gggggggg....', '...gglggggggg...', '..ggwlggggggggg.', '..ggggdggggdggg.', '..ggggdggggdggg.', '.gggggggggggggg.', '.gggggggggggggg.', '..hhhhhhhhhhhh..', E];
const BAT1 = [E, E, E, E, E, '.k............k.', '.kk..........kk.', '.kkk..kkkk..kkk.', '..kkkkkrkrkkkk..', '...kkkkkkkkkk...', '....kk.kk.kk....', '.....k....k.....', E, E, E, E];
const BAT2 = [E, E, E, E, E, E, E, '......kkkk......', '..kkkkkrkrkkkk..', '.kkkkkkkkkkkkkk.', '.kk.kk.kk.kk.kk.', '.k............k.', E, E, E, E];
const SKEL = [E, '.....wwwwww.....', '....wwwwwwww....', '....wkkwwkkw....', '....wkkwwkkw....', '....wwwwwwww....', '.....wkwkww.....', '......wwww......', '....wwwwwwww....', '...w.w.ww.w.w...', '...w.wwwwww.w...', '......wwww......', '.....ww..ww.....', '.....w....w.....', '....ww....ww....', E];
const MUSH = [E, E, '.....rrrrrr.....', '...rrwrrrrwrr...', '..rrrrrrwrrrrr..', '..rwrrrrrrrrwr..', '..rrrrrrrrrrrr..', '....ssssssss....', '....sdssssds....', '....ssssssss....', '.....ssssss.....', '.....ssssss.....', '....ff....ff....', E, E, E];
const GOLEM = [E, '.....oooooo.....', '....oyyooyyo....', '....oooooooo....', '..oooo.oo.oooo..', '.ooddoooooooddo.', '.oo.oddddddo.oo.', '.oo.oooooooo.oo.', '....oooooooo....', '....oo....oo....', '....oo....oo....', '...ooo....ooo...', E, E, E, E];
const MOLE = [E, E, E, E, E, '......mmmm......', '....mmmmmmmm....', '...mmwmmmmwmm...', '..mmmmmppmmmmm..', '..mmmmmmmmmmmm..', '.cc.mmmmmmmm.cc.', '.ccc.mmmmmm.ccc.', E, E, E, E];

export const monsterSprites = {
  slime: [sprite(SLIME, { g: '#6fd16b', l: '#c4f7b4', w: '#fff', d: '#1d3320', h: '#3e8d45' })],
  king: [sprite(SLIME, { g: '#b06bd8', l: '#ecc4ff', w: '#fff', d: '#2a1236', h: '#6e3a96' })],
  bat: [sprite(BAT1, { k: '#6b448f', r: '#ff5a5a' }), sprite(BAT2, { k: '#6b448f', r: '#ff5a5a' })],
  skeleton: [sprite(SKEL, { w: '#e8e4d4', k: '#2a2230' })],
  mushroom: [sprite(MUSH, { r: '#c94a4a', w: '#f4ecd8', s: '#e8d8b0', d: '#2a1a12', f: '#8a6a4a' })],
  golem: [sprite(GOLEM, { o: '#9a5a32', d: '#6b3a1e', y: '#ffcf5a' })],
  mole: [sprite(MOLE, { m: '#7a5a44', w: '#fff', p: '#ff9aa8', c: '#d9d2c0' })],
};

const SMITH = [E, '.....ssssss.....', '....ssssssss....', '....sesssses....', '....ssssssss....', '....gggggggg....', '.....gggggg.....', '...rrraaaarrr...', '..srraaaaaarrs..', '..s.raaaaaar.s..', '....aaaaaaaa....', '....pppppppp....', '....ppp..ppp....', '....ppp..ppp....', '....kkk..kkk....', E];
const VERA = ['.....hhhhhh.....', '....hhhhhhhh....', '...hhhhhhhhhh...', '...hhsesseshh...', '...hhsssssshh...', '...hh.ssss.hh...', '...h.dddddd.h...', '....dddddddd....', '...sddwddwdds...', '....dddddddd....', '...dddddddddd...', '..dddddddddddd..', '....ss....ss....', '....kk....kk....', E, E];
const LIA = ['.....hhhhhh.....', '....hhhhhhhh....', '...hhhhhhhhhh...', '...hhsesseshh...', '...hhsssssshh...', '...hh.ssss.hh...', '....wwwwwwww....', '...swwwccwwws...', '....wwwccwww....', '....wwwwwwww....', '...wwwwwwwwww...', '...wwwwwwwwww...', '....ss....ss....', '....kk....kk....', E, E];
const IAN = [E, '.....hhhhhh.....', '....hhhhhhhh....', '....hggsggsh....', '....hssssssh....', '....ssssssss....', '.....ssssss.....', '....bbbybbbb....', '...sbbbybbbbs...', '...sbbbbbbbbs...', '....bbbbbbbb....', '....pppppppp....', '....ppp..ppp....', '....ppp..ppp....', '....kkk..kkk....', E];
const OWL = [E, E, E, '....o......o....', '....oooooooo....', '...oowwoowwoo...', '...owbwoowbwo...', '...oowwyywwoo...', '...ooooyyoooo...', '...olloooollo...', '....olloollo....', '.....oooooo.....', '....yy.mm.yy....', '......mmmm......', '......mmmm......', '......mmmm......'];
const KID = [E, E, E, '.....cccccc.....', '....cccccccccc..', '.....ssssss.....', '.....esssse.....', '.....ssssss.....', '......oooo......', '.....oooooo.....', '....soooooos....', '.....oooooo.....', '.....pp..pp.....', '.....kk..kk.....', E, E];

export const npcSprites = {
  smith: sprite(SMITH, { s: '#e0a878', e: '#2a1a12', g: '#c4c4c4', r: '#b8423a', a: '#6b4a2b', p: '#3a3a4a', k: '#2a1d16' }),
  vera: sprite(VERA, { h: '#d9583b', s: '#f0c49a', e: '#2a1a12', d: '#3f9e6a', w: '#fff2b0', k: '#5a3a22' }),
  lia: sprite(LIA, { h: '#b49be0', s: '#f2cfa8', e: '#2a1a12', w: '#f4f4f4', c: '#e05a7a', k: '#6b5a8a' }),
  ian: sprite(IAN, { h: '#2a2a3a', g: '#cfe8ff', s: '#f0c49a', b: '#2f4a7a', y: '#ffcf5a', p: '#2a2a3a', k: '#1a1a22' }),
  owl: sprite(OWL, { o: '#8a6a4a', w: '#f4ecd8', b: '#1a1a1a', y: '#f2b632', l: '#c9a77a', m: '#6b4a2b' }),
  kid: sprite(KID, { c: '#4caf50', s: '#f0c49a', e: '#2a1a12', o: '#e8894a', p: '#3b4a6b', k: '#5a3a22' }),
};

const TREE = ['.....gggggg.....', '...gggGgggggg...', '..ggGGggggggGg..', '.gggGgggggGgggg.', '.ggggggGgggggdg.', '.gGgggggggggggd.', '.ggggdggggGgggd.', '..ggggggdggggd..', '..dggggggggddd..', '...ddgggggddd...', '.....ddttdd.....', '......tttt......', '......tttt......', '......tttt......', '.....tttttt.....', E];
export const treeSprite = sprite(TREE, { g: '#3f8a3a', G: '#6cbf4a', d: '#2a5f2e', t: '#6b4a2b' });
export const treeSpriteWinter = sprite(TREE, { g: '#cfd8e0', G: '#f4f8fb', d: '#9aa8b8', t: '#6b4a2b' });
export const treeSpriteAutumn = sprite(TREE, { g: '#c86a2a', G: '#f0a040', d: '#8a3a1a', t: '#6b4a2b' });
