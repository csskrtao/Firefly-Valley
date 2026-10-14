import { sprite } from './sprite';

const E = '................';

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

const OWL = [E, E, E, '....o......o....', '....oooooooo....', '...oowwoowwoo...', '...owbwoowbwo...', '...oowwyywwoo...', '...ooooyyoooo...', '...olloooollo...', '....olloollo....', '.....oooooo.....', '....yy.mm.yy....', '......mmmm......', '......mmmm......', '......mmmm......'];

/** 猫头鹰咕咕没有人形，直接用 16×16 的小图 */
export const owlSprite = sprite(OWL, { o: '#8a6a4a', w: '#f4ecd8', b: '#1a1a1a', y: '#f2b632', l: '#c9a77a', m: '#6b4a2b' });

const TREE = ['.....gggggg.....', '...gggGgggggg...', '..ggGGggggggGg..', '.gggGgggggGgggg.', '.ggggggGgggggdg.', '.gGgggggggggggd.', '.ggggdggggGgggd.', '..ggggggdggggd..', '..dggggggggddd..', '...ddgggggddd...', '.....ddttdd.....', '......tttt......', '......tttt......', '......tttt......', '.....tttttt.....', E];
export const treeSprite = sprite(TREE, { g: '#3f8a3a', G: '#6cbf4a', d: '#2a5f2e', t: '#6b4a2b' });
export const treeSpriteWinter = sprite(TREE, { g: '#cfd8e0', G: '#f4f8fb', d: '#9aa8b8', t: '#6b4a2b' });
export const treeSpriteAutumn = sprite(TREE, { g: '#c86a2a', G: '#f0a040', d: '#8a3a1a', t: '#6b4a2b' });
