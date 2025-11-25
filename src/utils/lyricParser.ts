/**
 * 歌词解析工具
 * 用于解析LRC格式歌词和YRC格式逐字歌词，支持卡拉OK模式的逐字时间分配
 */

import { parseYrc, isYrcFormat } from "./yrcParser";

// 字符信息（卡拉OK模式）
export interface LyricChar {
  text: string;
  startTime: number; // 相对于行开始的时间（秒）
  endTime: number; // 相对于行开始的时间（秒）
}

// 歌词行信息
export interface LyricLine {
  time: number; // 行开始时间（秒）
  text: string; // 完整歌词文本
  ttext?: string; // 翻译文本
  duration?: number; // 行持续时间（秒）
  chars?: LyricChar[]; // 逐字信息（卡拉OK模式）
  isEmpty?: boolean; // 是否为空行（用于节奏控制）
  isSpecialMark?: boolean; // 是否为特殊标记（不显示但保留时间）
}

// 歌词元信息
export interface LyricMetaInfo {
  lyricist?: string; // 作词
  composer?: string; // 作曲
  arranger?: string; // 编曲
  album?: string; // 专辑
  [key: string]: string | undefined;
}

/**
 * 将文本分割成字符数组（智能处理中英文）
 */
export function splitTextToChars(text: string): string[] {
  const chars: string[] = [];
  let i = 0;

  while (i < text.length) {
    const char = text[i];

    // 英文字母或数字：尝试提取完整单词
    if (/[a-zA-Z0-9]/.test(char)) {
      let word = char;
      i++;
      while (i < text.length && /[a-zA-Z0-9]/.test(text[i])) {
        word += text[i];
        i++;
      }
      chars.push(word);
    }
    // 空格：单独处理
    else if (char === " ") {
      chars.push(char);
      i++;
    }
    // 其他字符（中文、标点等）：单个字符
    else {
      chars.push(char);
      i++;
    }
  }

  return chars;
}

/**
 * 计算字符的权重（用于智能时间分配）
 */
export function getCharWeight(char: string): number {
  // 空格：几乎不占时间
  if (char === " ") return 0.1;

  // 标点符号：占用较少时间
  if (/[，。！？、；：""''（）《》【】…—·]/.test(char)) return 0.3;
  if (/[,\.!?;:'"()\[\]\-]/.test(char)) return 0.3;

  // 英文单词：根据长度分配权重
  if (/[a-zA-Z]/.test(char)) {
    return Math.min(char.length * 0.8, 3); // 单词越长权重越大，但有上限
  }

  // 中文字符：标准权重
  return 1.0;
}

/**
 * 为歌词行生成逐字时间信息（智能版：基于时长比率的自适应分配）
 *
 * 策略说明：
 * 由于没有逐字的精确时间标签，我们使用启发式算法：
 * 1. 快节奏（比率<0.8）：均匀快速分配
 * 2. 正常节奏（0.8-1.3）：均匀分配，最后略微拖尾
 * 3. 慢节奏（1.3-2.5）：前面正常，后面拖长
 * 4. 超慢节奏（>2.5）：前面快速，后面极度拖长
 *
 * 注意：这只是近似模拟，真实情况可能更复杂（前慢、中慢、后慢都有可能）
 */
export function generateCharTimings(
  line: LyricLine,
  nextLineTime?: number
): LyricChar[] {
  if (!line.text) return [];

  // 计算行持续时间（如果没有下一行，默认4秒）
  const rawDuration = nextLineTime ? nextLineTime - line.time : 4;
  line.duration = rawDuration;

  // 分割文本为字符/单词
  const chars = splitTextToChars(line.text);
  if (chars.length === 0) return [];

  const charCount = chars.length;

  // 定义常量
  const NORMAL_CHAR_DURATION = 0.25; // 正常语速：每个字0.25秒
  const MIN_CHAR_DURATION = 0.15; // 最小时长：0.15秒
  const FAST_CHAR_DURATION = 0.2; // 快速语速：0.2秒/字

  // 计算正常语速下需要的总时长
  const normalTotalDuration = charCount * NORMAL_CHAR_DURATION;

  // 计算时长比率（实际时长 / 正常时长）
  const durationRatio = rawDuration / normalTotalDuration;

  let currentTime = 0;
  const result: LyricChar[] = [];

  // === 策略1：快节奏（时长比率 < 0.8） ===
  // 所有字快速均匀分配
  if (durationRatio < 0.8) {
    const charDuration = Math.max(rawDuration / charCount, MIN_CHAR_DURATION);

    for (let i = 0; i < chars.length; i++) {
      result.push({
        text: chars[i],
        startTime: currentTime,
        endTime: currentTime + charDuration,
      });
      currentTime += charDuration;
    }
  }
  // === 策略2：正常节奏（0.8 <= 时长比率 <= 1.3） ===
  // 均匀分配，略微拖尾
  else if (durationRatio <= 1.3) {
    // 前面的字：正常速度
    const frontCharDuration = NORMAL_CHAR_DURATION;
    const frontCount = charCount - 1;

    for (let i = 0; i < frontCount; i++) {
      result.push({
        text: chars[i],
        startTime: currentTime,
        endTime: currentTime + frontCharDuration,
      });
      currentTime += frontCharDuration;
    }

    // 最后一个字：占用剩余时间
    result.push({
      text: chars[charCount - 1],
      startTime: currentTime,
      endTime: rawDuration,
    });
  }
  // === 策略3：慢节奏（1.3 < 时长比率 <= 2.5） ===
  // 前面正常，后面拖长
  else if (durationRatio <= 2.5) {
    // 确定拖长的字数（最多拖长30%的字，最多3个，至少1个）
    let extendCount = Math.min(Math.ceil(charCount * 0.3), 3);
    extendCount = Math.max(extendCount, 1);

    const normalCount = charCount - extendCount;

    // 前面的字：占用50-60%的时间
    const frontRatio = 0.55;
    const frontDuration = rawDuration * frontRatio;
    const frontCharDuration = Math.min(
      frontDuration / normalCount,
      NORMAL_CHAR_DURATION * 1.2
    );

    for (let i = 0; i < normalCount; i++) {
      result.push({
        text: chars[i],
        startTime: currentTime,
        endTime: currentTime + frontCharDuration,
      });
      currentTime += frontCharDuration;
    }

    // 后面的字：平均分配剩余时间
    const remainingDuration = rawDuration - currentTime;
    const extendCharDuration = remainingDuration / extendCount;

    for (let i = normalCount; i < charCount; i++) {
      const isLastChar = i === charCount - 1;
      const duration = isLastChar
        ? rawDuration - currentTime // 最后一个字精确到结束
        : extendCharDuration;

      result.push({
        text: chars[i],
        startTime: currentTime,
        endTime: currentTime + duration,
      });
      currentTime += duration;
    }
  }
  // === 策略4：超慢节奏（时长比率 > 2.5） ===
  // 前面快速，后面极度拖长
  else {
    // 前面的字：快速播放，占用30-40%的时间
    const frontRatio = Math.max(
      0.3,
      Math.min(0.4, normalTotalDuration / rawDuration)
    );
    const frontDuration = rawDuration * frontRatio;

    // 确定拖长的字数（至少2个，最多一半）
    let extendCount = Math.max(2, Math.ceil(charCount * 0.4));
    extendCount = Math.min(extendCount, Math.ceil(charCount / 2));

    const normalCount = charCount - extendCount;
    const frontCharDuration = Math.min(
      frontDuration / normalCount,
      FAST_CHAR_DURATION
    );

    for (let i = 0; i < normalCount; i++) {
      result.push({
        text: chars[i],
        startTime: currentTime,
        endTime: currentTime + frontCharDuration,
      });
      currentTime += frontCharDuration;
    }

    // 后面的字：极度拖长
    const remainingDuration = rawDuration - currentTime;
    const extendCharDuration = remainingDuration / extendCount;

    for (let i = normalCount; i < charCount; i++) {
      const isLastChar = i === charCount - 1;
      const duration = isLastChar
        ? rawDuration - currentTime
        : extendCharDuration;

      result.push({
        text: chars[i],
        startTime: currentTime,
        endTime: currentTime + duration,
      });
      currentTime += duration;
    }
  }

  return result;
}

/**
 * 解析歌词元信息（作词、作曲等）
 */
export function parseMetaInfo(lyricText: string): LyricMetaInfo {
  const metaInfo: LyricMetaInfo = {};
  const lines = lyricText.split("\n");

  const metaPatterns = {
    lyricist: /作词\s*[:：]\s*(.+)/,
    composer: /作曲\s*[:：]\s*(.+)/,
    arranger: /编曲\s*[:：]\s*(.+)/,
    album: /专辑\s*[:：]\s*(.+)/,
  };

  lines.forEach((line) => {
    // 检查是否为元信息行（时间戳为00:00.00）
    const match = line.match(/\[00:00\.00\](.*)/);
    if (match) {
      const content = match[1].trim();

      // 匹配各种元信息
      for (const [key, pattern] of Object.entries(metaPatterns)) {
        const metaMatch = content.match(pattern);
        if (metaMatch) {
          metaInfo[key] = metaMatch[1].trim();
          break;
        }
      }
    }
  });

  return metaInfo;
}

/**
 * 过滤特殊标记（如music、end等）
 */
export function filterSpecialMarks(text: string): {
  text: string;
  isSpecialMark: boolean;
} {
  // 特殊标记模式（支持中英文括号）
  const specialPatterns = [
    /^[\(（]music[\)）]$/i,
    /^[\(（]intro[\)）]$/i,
    /^[\(（]outro[\)）]$/i,
    /^[\(（]bridge[\)）]$/i,
    /^[\(（]间奏[\)）]$/i,
    /^end$/i,
    /^\.\.\.$/,
    /^…$/,
  ];

  const trimmedText = text.trim();

  // 检查是否为特殊标记
  for (const pattern of specialPatterns) {
    if (pattern.test(trimmedText)) {
      return { text: "", isSpecialMark: true };
    }
  }

  return { text: trimmedText, isSpecialMark: false };
}

/**
 * 解析多时间标签的歌词行
 */
export function parseMultipleTimestamps(line: string): Array<{
  time: number;
  text: string;
}> {
  const results: Array<{ time: number; text: string }> = [];

  // 匹配所有时间标签
  const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/g;
  const times: number[] = [];
  let match;

  while ((match = timeRegex.exec(line)) !== null) {
    const minutes = parseInt(match[1]);
    const seconds = parseInt(match[2]);
    const milliseconds = parseInt(match[3]);
    const time = minutes * 60 + seconds + milliseconds / 1000;
    times.push(time);
  }

  // 提取歌词文本
  const text = line.replace(timeRegex, "").trim();

  // 为每个时间点创建歌词行
  times.forEach((time) => {
    results.push({ time, text });
  });

  return results;
}

/**
 * 解析LRC格式歌词（支持翻译和卡拉OK模式）
 * 支持YRC格式的逐字歌词（优先级：yrc > yrcs > lyric）
 * 返回歌词列表和元信息
 *
 * @param lyricText 普通LRC格式歌词
 * @param tlyricText 翻译歌词（可选）
 * @param yrcText YRC格式逐字歌词（可选，优先级最高）
 * @param yrcsText YRC格式逐字歌词备用（可选）
 */
export function parseLyric(
  lyricText: string,
  tlyricText?: string,
  yrcText?: string,
  yrcsText?: string
): {
  lyrics: LyricLine[];
  metaInfo: LyricMetaInfo;
} {
  // 优先使用YRC格式的逐字歌词
  const yrcSource = yrcText || yrcsText;

  if (yrcSource && isYrcFormat(yrcSource)) {
    console.log("✓ 使用YRC格式逐字歌词");
    const lyrics = parseYrc(yrcSource);

    // 如果有翻译歌词，尝试匹配
    if (tlyricText && lyrics.length > 0) {
      matchTranslationLyrics(lyrics, tlyricText);
    }

    // YRC格式没有元信息，如果有普通歌词，从中提取元信息
    const metaInfo = lyricText ? parseMetaInfo(lyricText) : {};

    // 开发环境下打印调试信息
    if (lyrics.length > 0) {
      console.log(`解析完成: ${lyrics.length} 行歌词`);
      console.log(
        `第一行: "${lyrics[0].text}" (${lyrics[0].time.toFixed(3)}s, ${
          lyrics[0].chars?.length || 0
        } 字符)`
      );
    }

    return { lyrics, metaInfo };
  }

  // 如果没有YRC格式，使用普通LRC格式
  if (!lyricText) {
    return { lyrics: [], metaInfo: {} };
  }

  console.log("✓ 使用LRC格式歌词（模拟逐字时间）");

  // 解析元信息
  const metaInfo = parseMetaInfo(lyricText);

  const lines = lyricText.split("\n");
  const result: LyricLine[] = [];
  const allTimePoints: number[] = []; // 记录所有时间点（包括特殊标记）

  // 第一遍：解析所有歌词行，收集时间点
  lines.forEach((line) => {
    // 处理多时间标签
    const parsedLines = parseMultipleTimestamps(line);

    parsedLines.forEach(({ time, text }) => {
      // 记录所有时间点
      allTimePoints.push(time);

      // 过滤特殊标记
      const { text: filteredText, isSpecialMark } = filterSpecialMarks(text);

      // 跳过元信息行（时间为00:00.00且没有实际歌词内容）
      if (time === 0 && !filteredText && !isSpecialMark) {
        return;
      }

      // 跳过特殊标记，不添加到结果中
      if (isSpecialMark) {
        return;
      }

      // 只添加有文本内容的歌词，跳过空行以优化间距
      if (filteredText) {
        result.push({
          time,
          text: filteredText,
          isEmpty: false,
          isSpecialMark: false,
        });
      }
    });
  });

  // 排序结果和时间点
  result.sort((a, b) => a.time - b.time);
  allTimePoints.sort((a, b) => a - b);

  // 为每行生成逐字时间信息（仅对有文本的行）
  result.forEach((line) => {
    if (line.text) {
      // 找到下一个时间点（可能是下一句歌词，也可能是特殊标记）
      const currentTimeIndex = allTimePoints.indexOf(line.time);
      const nextLineTime =
        currentTimeIndex >= 0 && currentTimeIndex < allTimePoints.length - 1
          ? allTimePoints[currentTimeIndex + 1]
          : undefined;
      line.chars = generateCharTimings(line, nextLineTime);
    }
  });

  // 解析翻译歌词并匹配到原文
  if (tlyricText) {
    matchTranslationLyrics(result, tlyricText);
  }

  return { lyrics: result, metaInfo };
}

/**
 * 匹配翻译歌词到原文
 * @param lyrics 原文歌词数组
 * @param tlyricText 翻译歌词文本
 */
function matchTranslationLyrics(lyrics: LyricLine[], tlyricText: string): void {
  const tlines = tlyricText.split("\n");
  const tlyricMap = new Map<number, string>();

  tlines.forEach((line) => {
    const parsedLines = parseMultipleTimestamps(line);
    parsedLines.forEach(({ time, text }) => {
      if (text) {
        tlyricMap.set(time, text);
      }
    });
  });

  // 将翻译匹配到原文（基于时间戳匹配，允许小误差）
  lyrics.forEach((item) => {
    // 精确匹配
    if (tlyricMap.has(item.time)) {
      item.ttext = tlyricMap.get(item.time);
    } else {
      // 模糊匹配（±0.5秒内）
      for (const [time, text] of tlyricMap.entries()) {
        if (Math.abs(time - item.time) < 0.5) {
          item.ttext = text;
          break;
        }
      }
    }
  });
}

/**
 * 判断字符的高亮状态（用于卡拉OK模式）
 */
export function getCharHighlightClass(
  lineIndex: number,
  currentLyricIndex: number,
  currentTime: number,
  line: LyricLine,
  char: LyricChar
): string {
  if (lineIndex !== currentLyricIndex) {
    return ""; // 非当前行
  }

  // 计算当前播放时间相对于行开始的时间
  const relativeTime = currentTime - line.time;

  // 添加小的缓冲区，避免频繁切换状态导致动画卡顿
  const BUFFER = 0.05; // 50毫秒缓冲

  if (relativeTime < char.startTime - BUFFER) {
    return ""; // 未开始
  } else if (relativeTime >= char.endTime + BUFFER) {
    return "char-sung"; // 已唱过
  } else {
    return "char-singing"; // 正在唱
  }
}

/**
 * 获取字符的动态样式（自适应动画时长）
 */
export function getCharAnimationStyle(char: LyricChar): Record<string, string> {
  // 计算字符的持续时间
  const duration = char.endTime - char.startTime;

  // 动画时长自适应：
  // - 如果字符持续时间很短（<0.3s），使用快速动画（0.25s）
  // - 如果字符持续时间正常（0.3-1s），使用标准动画（0.4s）
  // - 如果字符持续时间很长（>1s），使用慢速动画（0.5s）
  let animationDuration = "0.4s";

  if (duration < 0.3) {
    animationDuration = "0.25s"; // 快速动画，确保能完整播放
  } else if (duration > 1) {
    animationDuration = "0.5s"; // 慢速动画，更优雅
  }

  return {
    "--animation-duration": animationDuration,
  };
}

/**
 * 缓动函数：easeOutQuad - 快速开始，慢速结束
 * 使渐变填充更自然流畅
 */
function easeOutQuad(t: number): number {
  return t * (2 - t);
}

/**
 * 获取字符的渐变填充进度（样式二：从左到右颜色过渡）
 * 返回0-100的百分比，表示已填充的比例
 * 优化版：添加缓动函数，使过渡更平滑
 */
export function getCharGradientProgress(
  lineIndex: number,
  currentLyricIndex: number,
  currentTime: number,
  line: LyricLine,
  char: LyricChar
): number {
  if (lineIndex !== currentLyricIndex) {
    return 0; // 非当前行，未填充
  }

  // 计算当前播放时间相对于行开始的时间
  const relativeTime = currentTime - line.time;

  if (relativeTime < char.startTime) {
    return 0; // 未开始，0%填充
  } else if (relativeTime >= char.endTime) {
    return 100; // 已完成，100%填充
  } else {
    // 正在播放，计算填充进度
    const charDuration = char.endTime - char.startTime;
    const elapsed = relativeTime - char.startTime;

    // 线性进度
    const linearProgress = elapsed / charDuration;

    // 应用缓动函数，使过渡更平滑
    const easedProgress = easeOutQuad(linearProgress);

    // 转换为百分比，保留2位小数以提高精度
    const progress = Math.round(easedProgress * 10000) / 100;

    return Math.min(Math.max(progress, 0), 100);
  }
}

/**
 * 获取字符的渐变样式（样式二）
 * 使用CSS linear-gradient实现从左到右的颜色填充效果
 */
export function getCharGradientStyle(
  lineIndex: number,
  currentLyricIndex: number,
  currentTime: number,
  line: LyricLine,
  char: LyricChar
): Record<string, string> {
  const progress = getCharGradientProgress(
    lineIndex,
    currentLyricIndex,
    currentTime,
    line,
    char
  );

  return {
    "--gradient-progress": `${progress}%`,
  };
}
