/**
 * 歌词解析工具
 * 用于解析LRC格式歌词，支持卡拉OK模式的逐字时间分配
 */

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
 * 为歌词行生成逐字时间信息（参考主流平台策略）
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

  // 计算每个字符的权重
  const weights = chars.map((char) => getCharWeight(char));
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  // 参考主流平台的策略：
  // 1. 前面的字正常速度播放（占用60-85%时间）
  // 2. 最后一个字延长显示（占用剩余时间）
  // 3. 根据字数动态调整比例
  const charCount = chars.length;
  let frontRatio = 0.75; // 默认75%给前面的字

  // 字数越多，前面占比越大（避免太快）
  if (charCount > 15) {
    frontRatio = 0.85;
  } else if (charCount > 10) {
    frontRatio = 0.8;
  } else if (charCount < 5) {
    frontRatio = 0.65; // 字少时，给最后一个字更多时间
  }

  const frontDuration = rawDuration * frontRatio;

  // 为前面的字符分配时间（除了最后一个）
  let currentTime = 0;
  const result: LyricChar[] = [];

  // 最小字符持续时间：0.15秒（确保动画能完整播放）
  const MIN_CHAR_DURATION = 0.15;

  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    const weight = weights[i];

    if (i === chars.length - 1) {
      // 最后一个字：占用剩余所有时间（尾音效果）
      result.push({
        text: char,
        startTime: currentTime,
        endTime: rawDuration, // 延长到行结束
      });
    } else {
      // 前面的字：按权重分配时间
      let charDuration = (weight / totalWeight) * frontDuration;

      // 确保每个字至少有最小持续时间（动画能完整播放）
      charDuration = Math.max(charDuration, MIN_CHAR_DURATION);

      result.push({
        text: char,
        startTime: currentTime,
        endTime: currentTime + charDuration,
      });

      currentTime += charDuration;
    }
  }

  // 如果前面的字占用时间超过了frontDuration，需要压缩
  if (currentTime > frontDuration && chars.length > 1) {
    const compressionRatio = frontDuration / currentTime;
    let adjustedTime = 0;

    for (let i = 0; i < result.length - 1; i++) {
      const originalDuration = result[i].endTime - result[i].startTime;
      const newDuration = originalDuration * compressionRatio;

      result[i].startTime = adjustedTime;
      result[i].endTime = adjustedTime + newDuration;
      adjustedTime += newDuration;
    }

    // 调整最后一个字的开始时间
    result[result.length - 1].startTime = adjustedTime;
  }

  return result;
}

/**
 * 解析LRC格式歌词（支持翻译和卡拉OK模式）
 */
export function parseLyric(
  lyricText: string,
  tlyricText?: string
): LyricLine[] {
  if (!lyricText) return [];

  const lines = lyricText.split("\n");
  const result: LyricLine[] = [];

  // 解析原文歌词
  lines.forEach((line) => {
    const match = line.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/);
    if (match) {
      const minutes = parseInt(match[1]);
      const seconds = parseInt(match[2]);
      const milliseconds = parseInt(match[3]);
      const time = minutes * 60 + seconds + milliseconds / 1000;
      const text = match[4].trim();
      if (text) {
        result.push({ time, text });
      }
    }
  });

  // 排序
  result.sort((a, b) => a.time - b.time);

  // 为每行生成逐字时间信息（用于卡拉OK模式）
  result.forEach((line, index) => {
    const nextLineTime =
      index < result.length - 1 ? result[index + 1].time : undefined;
    line.chars = generateCharTimings(line, nextLineTime);
  });

  // 解析翻译歌词并匹配到原文
  if (tlyricText) {
    const tlines = tlyricText.split("\n");
    const tlyricMap = new Map<number, string>();

    tlines.forEach((line) => {
      const match = line.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/);
      if (match) {
        const minutes = parseInt(match[1]);
        const seconds = parseInt(match[2]);
        const milliseconds = parseInt(match[3]);
        const time = minutes * 60 + seconds + milliseconds / 1000;
        const text = match[4].trim();
        if (text) {
          tlyricMap.set(time, text);
        }
      }
    });

    // 将翻译匹配到原文（基于时间戳匹配，允许小误差）
    result.forEach((item) => {
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

  return result;
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
