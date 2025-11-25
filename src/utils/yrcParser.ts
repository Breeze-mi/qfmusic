/**
 * YRC格式歌词解析器
 * 用于解析网易云音乐的逐字歌词格式
 *
 * YRC格式示例：
 * 旧格式：[18890,2840](18890,260,0)总(19150,300,0)想(19450,300,0)对...
 * 新格式（JSON）：{"t":18890,"c":[{"tx":"总","t":260},{"tx":"想","t":300}]}
 *
 * 格式说明：
 * 旧格式：[行开始时间(ms),行持续时间(ms)](字符绝对时间(ms),字符持续时间(ms),保留字段)字符文本...
 * 新格式：{"t":行开始时间(ms),"c":[{"tx":"字符","t":字符持续时间(ms)}]}
 */

import type { LyricLine, LyricChar } from "./lyricParser";

/**
 * 解析JSON格式的YRC行（新格式）
 * @param line JSON格式的YRC行
 * @returns 解析后的歌词行对象，如果解析失败返回null
 */
export function parseYrcJsonLine(line: string): LyricLine | null {
  try {
    const data = JSON.parse(line);
    if (!data.t || !data.c || !Array.isArray(data.c)) {
      return null;
    }

    const lineStartTimeMs = data.t;
    const lineStartTime = lineStartTimeMs / 1000; // 转换为秒

    const chars: LyricChar[] = [];
    let fullText = "";
    let currentOffsetMs = 0; // 当前字符相对于行开始的偏移（毫秒）

    for (const charData of data.c) {
      if (!charData.tx) continue;

      const charText = charData.tx;
      const charDurationMs = charData.t || 0;

      // 计算相对于行开始的时间（秒）
      const relativeStartTime = currentOffsetMs / 1000;
      const relativeEndTime = (currentOffsetMs + charDurationMs) / 1000;

      chars.push({
        text: charText,
        startTime: relativeStartTime,
        endTime: relativeEndTime,
      });

      fullText += charText;
      currentOffsetMs += charDurationMs;
    }

    if (chars.length === 0) {
      return null;
    }

    // 计算行持续时间（最后一个字符的结束时间）
    const lineDuration = currentOffsetMs / 1000;

    return {
      time: lineStartTime,
      text: fullText,
      duration: lineDuration,
      chars: chars,
      isEmpty: false,
      isSpecialMark: false,
    };
  } catch (error) {
    return null;
  }
}

/**
 * 解析旧格式的YRC行
 * @param line YRC格式的歌词行
 * @returns 解析后的歌词行对象，如果解析失败返回null
 */
export function parseYrcLine(line: string): LyricLine | null {
  // 跳过空行和注释行
  if (!line.trim() || line.startsWith("[ch:")) {
    return null;
  }

  // 尝试JSON格式
  if (line.trim().startsWith("{")) {
    return parseYrcJsonLine(line);
  }

  // 匹配行时间标签：[开始时间,持续时间]
  const lineTimeMatch = line.match(/^\[(\d+),(\d+)\]/);
  if (!lineTimeMatch) {
    return null;
  }

  const lineStartTimeMs = parseInt(lineTimeMatch[1]);
  const lineDurationMs = parseInt(lineTimeMatch[2]);
  const lineStartTime = lineStartTimeMs / 1000; // 转换为秒
  const lineDuration = lineDurationMs / 1000; // 转换为秒

  // 提取字符部分
  const charsPart = line.substring(lineTimeMatch[0].length);

  // 匹配所有字符：(开始时间,持续时间,保留字段)字符
  const charRegex = /\((\d+),(\d+),\d+\)([^(]+?)(?=\(|$)/g;
  const chars: LyricChar[] = [];
  let fullText = "";
  let match;

  while ((match = charRegex.exec(charsPart)) !== null) {
    const charAbsoluteTimeMs = parseInt(match[1]); // 字符绝对开始时间（毫秒）
    const charDurationMs = parseInt(match[2]); // 字符持续时间（毫秒）
    const charText = match[3];

    // 计算相对于行开始的时间（秒）
    // 关键：字符的绝对时间 - 行的开始时间 = 相对偏移
    const relativeOffsetMs = Math.max(0, charAbsoluteTimeMs - lineStartTimeMs);
    const relativeStartTime = relativeOffsetMs / 1000;
    const relativeEndTime = (relativeOffsetMs + charDurationMs) / 1000;

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
 * 过滤特殊标记（与lyricParser保持一致）
 * 注意：只过滤纯音乐标记，保留有意义的内容
 */
function filterSpecialMarks(text: string): {
  text: string;
  isSpecialMark: boolean;
} {
  const trimmedText = text.trim();

  // 空行直接返回
  if (!trimmedText) {
    return { text: "", isSpecialMark: false };
  }

  // 特殊标记模式（只匹配纯音乐标记）
  const specialPatterns = [
    /^[\(（]?music[\)）]?$/i,
    /^[\(（]?intro[\)）]?$/i,
    /^[\(（]?outro[\)）]?$/i,
    /^[\(（]?bridge[\)）]?$/i,
    /^[\(（]?间奏[\)）]?$/i,
    /^[\(（]?前奏[\)）]?$/i,
    /^[\(（]?尾奏[\)）]?$/i,
    /^[\(（]?solo[\)）]?$/i,
    /^[\(（]?instrumental[\)）]?$/i,
    /^[\(（]?伴奏[\)）]?$/i,
    /^end$/i,
    /^\.\.\.$/,
    /^…$/,
  ];

  // 检查是否为纯音乐标记（完全匹配）
  for (const pattern of specialPatterns) {
    if (pattern.test(trimmedText)) {
      return { text: "", isSpecialMark: true };
    }
  }

  // 不是特殊标记，保留原文本
  return { text: trimmedText, isSpecialMark: false };
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
      // 过滤特殊标记
      const { text: filteredText, isSpecialMark } = filterSpecialMarks(
        parsed.text
      );

      // 跳过特殊标记
      if (isSpecialMark) {
        continue;
      }

      // 只添加有文本内容的歌词
      if (filteredText) {
        result.push(parsed);
      }
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
