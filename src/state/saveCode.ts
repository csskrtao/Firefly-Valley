import type { SaveData } from './save';
import { migrate } from './save';

/**
 * 存档码：把一个存档变成一串可以复制粘贴的文字，用来换浏览器、换设备或者备份。
 * 格式是 "FV1:" 加上存档 JSON 的 UTF-8 Base64。读回来时照常走 migrate()，所以旧版本的码也能用。
 */
const PREFIX = 'FV1:';

export function encodeSave(s: SaveData): string {
  const bytes = new TextEncoder().encode(JSON.stringify(s));
  let bin = '';
  // 分段拼，避免一次展开太多参数
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return PREFIX + btoa(bin);
}

/** 解析存档码，格式不对或者内容不是存档时返回 null。粘贴时混进的空白和换行会被忽略 */
export function decodeSave(code: string): SaveData | null {
  const text = code.replace(/\s+/g, '');
  if (!text.startsWith(PREFIX)) return null;
  try {
    const bin = atob(text.slice(PREFIX.length));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return migrate(JSON.parse(new TextDecoder().decode(bytes)));
  } catch {
    return null;
  }
}
