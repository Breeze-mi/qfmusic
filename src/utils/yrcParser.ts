/**
 * YRC格式歌词解析器
 * 用于解析网易云音乐的逐字歌词格式
 *
 * YRC格式示例：
 * [18890,2840](18890,260,0)总(19150,300,0)想(19450,300,0)对...
 *
 * 格式说明：
 * [行开始时间(ms),行持续时间(ms)](字符开始时间(ms),字符持续时间(ms),保留字段)字符文本...
 */

import type { LyricLine, LyricChar } from "./lyricParser";

/**
 * 解析YRC格式的单行歌词
 * @param line YRC格式的歌词行
 * @returns 解析后的歌词行对象，如果解析失败返回null
 */
export function parseYrcLine(line: string): LyricLine | null {
  // 跳过空行和注释行
  if (!line.trim() || line.startsWith("[ch:")) {
    return null;
  }

  // 匹配行时间标签：[开始时间,持续时间]
  const lineTimeMatch = line.match(/^\[(\d+),(\d+)\]/);
  if (!lineTimeMatch) {
    return null;
  }

  const lineStartTime = parseInt(lineTimeMatch[1]) / 1000; // 转换为秒
  const lineDuration = parseInt(lineTimeMatch[2]) / 1000; // 转换为秒

  // 提取字符部分
  const charsPart = line.substring(lineTimeMatch[0].length);

  // 匹配所有字符：(开始时间,持续时间,保留字段)字符
  const charRegex = /\((\d+),(\d+),\d+\)([^(]+?)(?=\(|$)/g;
  const chars: LyricChar[] = [];
  let fullText = "";
  let match;

  while ((match = charRegex.exec(charsPart)) !== null) {
    const charStartTimeMs = parseInt(match[1]); // 字符开始时间（毫秒）
    const charDurationMs = parseInt(match[2]); // 字符持续时间（毫秒）
    const charText = match[3];

    // 计算相对于行开始的时间（秒）
    // 字符的绝对时间 - 行的开始时间 = 相对时间
    const relativeStartTime = charStartTimeMs / 1000 - lineStartTime;
    const relativeEndTime = relativeStartTime + charDurationMs / 1000;

    chars.push({
      text: charText,
      startTime: relativeStartTime,
      endTime: relativeEndTime,
    });

    fullText += charText;
  }

  // 如果没有解析到任何字符，返回null
  if (chars.length === 0) {
    return null;
  }

  return {
    time: lineStartTime,
    text: fullText,
    duration: lineDuration,
    chars: chars,
    isEmpty: false,
    isSpecialMark: false,
  };
}

/**
 * 解析完整的YRC格式歌词
 * @param yrcText YRC格式的歌词文本
 * @returns 解析后的歌词行数组
 */
export function parseYrc(yrcText: string): LyricLine[] {
  if (!yrcText) {
    return [];
  }

  const lines = yrcText.split("\n");
  const result: LyricLine[] = [];

  for (const line of lines) {
    const parsed = parseYrcLine(line);
    if (parsed) {
      result.push(parsed);
    }
  }

  // 按时间排序
  result.sort((a, b) => a.time - b.time);

  return result;
}

/**
 * 判断是否为YRC格式的歌词
 * @param text 歌词文本
 * @returns 是否为YRC格式
 */
export function isYrcFormat(text: string): boolean {
  if (!text) return false;

  // YRC格式的特征：包含 [数字,数字](数字,数字,数字)文字 的模式
  const yrcPattern = /^\[(\d+),(\d+)\]\((\d+),(\d+),\d+\)/m;
  return yrcPattern.test(text);
}
