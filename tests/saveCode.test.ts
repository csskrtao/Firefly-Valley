import { describe, expect, it } from 'vitest';
import { newSave } from '../src/state/save';
import { decodeSave, encodeSave } from '../src/state/saveCode';

describe('save codes', () => {
  it('round-trips a save, including Chinese text and line breaks from pasting', () => {
    const s = newSave(2, 'spirit');
    s.gold = 4321;
    s.inv.salad = 3;
    s.field['6,13'] = { watered: true, crop: 'radish', days: 2 };
    const code = encodeSave(s);
    expect(code.startsWith('FV1:')).toBe(true);
    expect(decodeSave(code)).toEqual(s);
    const pasted = `  ${code.slice(0, 40)}\n${code.slice(40, 90)} \r\n${code.slice(90)}  `;
    expect(decodeSave(pasted)).toEqual(s);
  });

  it('rejects anything that is not a save code', () => {
    expect(decodeSave('')).toBeNull();
    expect(decodeSave('hello')).toBeNull();
    expect(decodeSave('FV1:not base64 at all!!')).toBeNull();
    expect(decodeSave('FV1:' + btoa('{"cls":"necromancer"}'))).toBeNull();
    expect(decodeSave(encodeSave(newSave(0, 'mage')).slice(0, 30))).toBeNull();
  });
});
