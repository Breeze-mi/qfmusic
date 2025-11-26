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
 * 计算字符的弹跳分组
 * 智能分组算法：根据字符持续时间自适应分组，适配各种节奏的歌曲
 *
 * 核心策略：
 * 1. 确保每组的总时长足够完成一次完整的弹跳动画（≥200ms）
 * 2. 拖长音（>350ms）单独成组，突出重点
 * 3. 快速连续的字符合并成组，避免视觉跟不上
 * 4. 自适应调整：根据整行的平均节奏动态调整分组策略
 *
 * @param chars 字符数组
 * @returns 分组信息数组，每个元素包含该字符所属的组ID、组内字符数和组开始时间
 */
export function calculateBounceGroups(
  chars: LyricChar[]
): Array<{ groupId: number; groupSize: number; groupStartTime: number }> {
  if (!chars || chars.length === 0) {
    return [];
  }

  // 过滤掉空格，计算有效字符的平均时长
  const validChars = chars.filter((c) => c.text.trim() !== "");
  if (validChars.length === 0) {
    return chars.map((c) => ({
      groupId: 0,
      groupSize: 1,
      groupStartTime: c.startTime,
    }));
  }

  const totalDuration = validChars.reduce(
    (sum, c) => sum + (c.endTime - c.startTime) * 1000,
    0
  );
  const avgCharDuration = totalDuration / validChars.length;

  // 🔑 根据平均时长动态调整分组参数
  let MIN_GROUP_DURATION: number; // 每组最小总时长
  let LONG_CHAR_THRESHOLD: number; // 拖长音阈值
  let MAX_GROUP_SIZE: number; // 最大组大小

  if (avgCharDuration < 150) {
    // 超快节奏（Rap、快歌）：平均<150ms/字
    MIN_GROUP_DURATION = 220; // 组总时长至少220ms（微调+20ms，确保动画完整）
    LONG_CHAR_THRESHOLD = 280; // >280ms算拖长音（微调-20ms，更早识别拖长音）
    MAX_GROUP_SIZE = 5; // 最多5字一组（微调-1，避免组太大）
  } else if (avgCharDuration < 250) {
    // 快节奏：平均150-250ms/字
    MIN_GROUP_DURATION = 260; // 组总时长至少260ms（微调+10ms）
    LONG_CHAR_THRESHOLD = 380; // >380ms算拖长音（微调+30ms，更准确）
    MAX_GROUP_SIZE = 3; // 最多3字一组（微调-1，更精细）
  } else if (avgCharDuration < 400) {
    // 正常节奏：平均250-400ms/字
    MIN_GROUP_DURATION = 280; // 组总时长至少280ms（微调-20ms，更灵活）
    LONG_CHAR_THRESHOLD = 500; // >500ms算拖长音（微调+50ms，避免误判）
    MAX_GROUP_SIZE = 2; // 最多2字一组（微调-1，更清晰）
  } else {
    // 慢节奏：平均>400ms/字
    MIN_GROUP_DURATION = 300; // 组总时长至少300ms（微调-50ms，更自然）
    LONG_CHAR_THRESHOLD = 650; // >650ms算拖长音（微调+50ms，更准确）
    MAX_GROUP_SIZE = 2; // 最多2字一组（保持不变）
  }

  const groups: Array<{
    groupId: number;
    groupSize: number;
    groupStartTime: number;
  }> = [];
  let currentGroupId = 0;
  let currentGroupStartIndex = 0;
  let currentGroupDuration = 0;
  let currentGroupCharCount = 0; // 当前组的有效字符数（不含空格）
  let currentGroupStartTime = chars.length > 0 ? chars[0].startTime : 0; // 当前组的开始时间（相对于行开始）

  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    const charDuration = (char.endTime - char.startTime) * 1000;

    // 空格：跟随当前组，不影响分组逻辑
    if (char.text.trim() === "") {
      currentGroupDuration += charDuration;
      continue;
    }

    // 累加当前组的持续时间和字符数
    currentGroupDuration += charDuration;
    currentGroupCharCount++;

    // 🔑 判断是否需要结束当前组
    const shouldEndGroup =
      // 条件1：当前字符是拖长音，且不是组内第一个字 → 前面的字结束成组，拖长音单独成组
      (charDuration >= LONG_CHAR_THRESHOLD && currentGroupCharCount > 1) ||
      // 条件2：当前组已达到最小时长，且达到最大组大小 → 结束当前组
      (currentGroupDuration >= MIN_GROUP_DURATION &&
        currentGroupCharCount >= MAX_GROUP_SIZE) ||
      // 条件3：当前组已达到最小时长，且下一个字符是拖长音 → 提前结束当前组
      (currentGroupDuration >= MIN_GROUP_DURATION &&
        i < chars.length - 1 &&
        chars[i + 1].text.trim() !== "" &&
        (chars[i + 1].endTime - chars[i + 1].startTime) * 1000 >=
          LONG_CHAR_THRESHOLD);

    // 如果当前字符是拖长音且是组内第一个字，单独成组
    if (charDuration >= LONG_CHAR_THRESHOLD && currentGroupCharCount === 1) {
      // 拖长音单独成组
      const groupSize = i - currentGroupStartIndex + 1;
      const groupStartTime = currentGroupStartTime;
      for (let j = currentGroupStartIndex; j <= i; j++) {
        groups.push({ groupId: currentGroupId, groupSize, groupStartTime });
      }
      currentGroupId++;
      currentGroupStartIndex = i + 1;
      currentGroupStartTime = i + 1 < chars.length ? chars[i + 1].startTime : 0;
      currentGroupDuration = 0;
      currentGroupCharCount = 0;
    } else if (shouldEndGroup) {
      // 结束当前组（不包含当前字符）
      const groupSize = i - currentGroupStartIndex;
      const groupStartTime = currentGroupStartTime;
      for (let j = currentGroupStartIndex; j < i; j++) {
        groups.push({ groupId: currentGroupId, groupSize, groupStartTime });
      }
      currentGroupId++;
      currentGroupStartIndex = i;
      currentGroupStartTime = chars[i].startTime;
      currentGroupDuration = charDuration;
      currentGroupCharCount = 1;
    }
  }

  // 处理最后一组
  if (currentGroupStartIndex < chars.length) {
    const groupSize = chars.length - currentGroupStartIndex;
    const groupStartTime = currentGroupStartTime;
    for (let j = currentGroupStartIndex; j < chars.length; j++) {
      groups.push({ groupId: currentGroupId, groupSize, groupStartTime });
    }
  }

  return groups;
}

/**
 * 计算字符的权重（用于智能时间分配）
 * 参考洛雪音乐的实现，更精细地区分不同字符类型
 */
export function getCharWeight(char: string): number {
  // 空格：几乎不占时间（但保留一点，避免视觉上太紧凑）
  if (char === " ") return 0.05;

  // 标点符号：占用较少时间
  // 中文标点
  if (/[，。！？、；：""''（）《》【】…—·]/.test(char)) return 0.2;
  // 英文标点
  if (/[,\.!?;:'"()\[\]\-]/.test(char)) return 0.2;

  // 数字：较短时间
  if (/[0-9]/.test(char)) return 0.6;

  // 英文单词：根据长度分配权重
  if (/[a-zA-Z]/.test(char)) {
    // 单词越长，权重越大，但有上限
    // 短单词（1-2字母）：0.8
    // 中等单词（3-5字母）：1.5-2.5
    // 长单词（6+字母）：最多3.0
    return Math.min(char.length * 0.5 + 0.3, 3.0);
  }

  // 中文字符：标准权重
  return 1.0;
}

/**
 * 检测字符是否可能是拖长音位置
 * 基于中文歌曲演唱习惯的启发式规则
 */
function isLikelyExtendedChar(
  char: string,
  index: number,
  chars: string[],
  isLastChar: boolean
): boolean {
  // 1. 最后一个字（最常见的拖长位置）
  if (isLastChar) return true;

  // 2. 语气词（通常会拖长）- 仅在句尾或接近句尾时
  const vocalChars = new Set(["啊", "呀", "哦", "嗯", "唉", "哎"]);
  if (vocalChars.has(char) && index >= chars.length - 3) {
    return true;
  }

  return false;
}

/**
 * 检测是否为段落结束（长间奏前）
 * 通过分析下一行的时间间隔判断
 */
function isLongPause(currentLineTime: number, nextLineTime: number): boolean {
  const gap = nextLineTime - currentLineTime;
  // 如果间隔超过5秒，认为是长间奏
  return gap > 5;
}

/**
 * 为歌词行生成逐字时间信息（优化版：基于字符权重的智能分配）
 *
 * 策略说明：
 * 参考洛雪音乐的实现思路，使用更智能的算法：
 * 1. 基于字符权重分配时间（中文字、英文单词、标点符号权重不同）
 * 2. 根据节奏自适应调整（快/正常/慢/超慢）
 * 3. 模拟真实演唱习惯（前快后慢、重音拖长等）
 * 4. 考虑标点符号的停顿效果
 * 5. 智能识别拖长音位置（句尾、情感重音等）
 * 6. 处理极端情况（长间奏、超长停顿等）
 *
 * 改进点：
 * - 更精细的字符权重计算
 * - 更自然的时间分布曲线
 * - 更好的节奏适应性
 * - 智能识别拖长音位置
 * - 处理段落间的长停顿
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

  // 检测是否为长间奏前的最后一句
  const hasLongPause = nextLineTime
    ? isLongPause(line.time + rawDuration, nextLineTime)
    : false;

  // 定义常量
  const NORMAL_CHAR_DURATION = 0.25; // 正常语速：每个字0.25秒
  const MIN_CHAR_DURATION = 0.12; // 最小时长：0.12秒（更快）
  const MAX_CHAR_DURATION = 2.0; // 最大时长：2秒（避免单字过长）

  // === 步骤1：计算每个字符的权重 ===
  const weights = chars.map((char) => getCharWeight(char));
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  // 如果总权重为0（全是空格/标点），使用均匀分配
  if (totalWeight === 0) {
    const charDuration = rawDuration / charCount;
    let currentTime = 0;
    return chars.map((char) => {
      const result = {
        text: char,
        startTime: currentTime,
        endTime: currentTime + charDuration,
      };
      currentTime += charDuration;
      return result;
    });
  }

  // === 步骤2：识别拖长音位置 ===
  const extendedPositions = chars.map((char, i) =>
    isLikelyExtendedChar(char, i, chars, i === charCount - 1)
  );

  // === 步骤3：计算节奏类型和调整系数 ===
  const normalTotalDuration = totalWeight * NORMAL_CHAR_DURATION;
  const durationRatio = rawDuration / normalTotalDuration;

  // 根据时长比率确定节奏类型和分配策略
  let timeDistribution: number[]; // 时间分布权重

  if (durationRatio < 0.7) {
    // 快节奏：几乎均匀，最后略微拖长
    timeDistribution = weights.map((_, i) => {
      const isLastChar = i === charCount - 1;
      return isLastChar ? 1.15 : 1.0; // 减少拖长幅度
    });
  } else if (durationRatio <= 1.3) {
    // 正常节奏：轻微前快后慢
    timeDistribution = weights.map((_, i) => {
      const progress = i / (charCount - 1 || 1);
      let base = 1.0 + progress * 0.15; // 减少变化幅度：1.0 -> 1.15

      // 拖长音位置轻微加权
      if (extendedPositions[i]) {
        base *= 1.2; // 减少加权幅度
      }

      return base;
    });
  } else if (durationRatio <= 2.0) {
    // 慢节奏：前快后慢
    timeDistribution = weights.map((_, i) => {
      const progress = i / (charCount - 1 || 1);
      // 使用较平缓的曲线：1.0 -> 1.8
      let base = 1.0 + Math.pow(progress, 1.3) * 0.8;

      // 拖长音位置适度加权
      if (extendedPositions[i]) {
        base *= 1.3; // 减少加权幅度
      }

      return base;
    });
  } else {
    // 超慢节奏：前面快速，后面拖长
    timeDistribution = weights.map((_, i) => {
      const progress = i / (charCount - 1 || 1);
      let base: number;

      // 使用较平缓的指数曲线
      if (progress < 0.5) {
        base = 0.85; // 前50%稍快
      } else {
        const backProgress = (progress - 0.5) * 2;
        base = 1.0 + Math.pow(backProgress, 1.8) * 1.5; // 减少拖长幅度
      }

      // 拖长音位置加权
      if (extendedPositions[i]) {
        base *= 1.5; // 减少加权幅度
      }

      // 如果是长间奏前的最后一句，最后一个字适度拖长
      if (hasLongPause && i === charCount - 1) {
        base *= 1.3; // 减少加权幅度
      }

      return base;
    });
  }

  // === 步骤4：计算调整后的权重 ===
  const adjustedWeights = weights.map((w, i) => w * timeDistribution[i]);
  const totalAdjustedWeight = adjustedWeights.reduce((sum, w) => sum + w, 0);

  // === 步骤5：分配时间 ===
  let currentTime = 0;
  const result: LyricChar[] = [];

  for (let i = 0; i < chars.length; i++) {
    // 计算该字符应占用的时间
    const ratio = adjustedWeights[i] / totalAdjustedWeight;
    let charDuration = rawDuration * ratio;

    // 限制单个字符的时长范围
    charDuration = Math.max(
      MIN_CHAR_DURATION,
      Math.min(charDuration, MAX_CHAR_DURATION)
    );

    // 最后一个字符：精确到行结束时间（避免累积误差）
    const isLastChar = i === chars.length - 1;
    const endTime = isLastChar ? rawDuration : currentTime + charDuration;

    result.push({
      text: chars[i],
      startTime: currentTime,
      endTime: endTime,
    });

    currentTime = endTime;
  }

  // === 步骤6：微调优化 ===
  // 优化1：确保拖长音位置有足够的时长
  for (let i = 0; i < result.length; i++) {
    if (extendedPositions[i]) {
      const char = result[i];
      const charDuration = char.endTime - char.startTime;
      const minExtendedDuration = MIN_CHAR_DURATION * 2; // 拖长音至少是普通字的2倍

      if (charDuration < minExtendedDuration && i < result.length - 1) {
        // 需要延长，从后面的非拖长音字符借时间
        const needTime = minExtendedDuration - charDuration;
        let borrowedTime = 0;

        for (let j = i + 1; j < result.length && borrowedTime < needTime; j++) {
          if (!extendedPositions[j]) {
            const nextChar = result[j];
            const nextDuration = nextChar.endTime - nextChar.startTime;

            if (nextDuration > MIN_CHAR_DURATION * 1.5) {
              const canBorrow = Math.min(
                nextDuration - MIN_CHAR_DURATION,
                needTime - borrowedTime
              );
              borrowedTime += canBorrow;
            }
          }
        }

        if (borrowedTime > 0) {
          char.endTime += borrowedTime;
          // 更新后续字符的时间
          for (let j = i + 1; j < result.length; j++) {
            result[j].startTime += borrowedTime;
            if (j < result.length - 1) {
              result[j].endTime += borrowedTime;
            }
          }
        }
      }
    }
  }

  // 优化2：如果最后一个字符时间过短，从前面的字符借一些时间
  if (result.length > 1) {
    const lastChar = result[result.length - 1];
    const lastDuration = lastChar.endTime - lastChar.startTime;
    const minLastDuration = extendedPositions[result.length - 1]
      ? MIN_CHAR_DURATION * 2.5 // 如果是拖长音，要求更长
      : MIN_CHAR_DURATION * 1.5;

    if (lastDuration < minLastDuration) {
      // 最后一个字太短，尝试延长
      const needTime = minLastDuration - lastDuration;
      let borrowedTime = 0;

      // 从倒数第二个字符开始，向前借时间
      for (let i = result.length - 2; i >= 0 && borrowedTime < needTime; i--) {
        const char = result[i];
        const charDuration = char.endTime - char.startTime;
        const minDuration = extendedPositions[i]
          ? MIN_CHAR_DURATION * 2
          : MIN_CHAR_DURATION * 1.5;

        if (charDuration > minDuration) {
          // 这个字符有余量，可以借一些时间
          const canBorrow = Math.min(
            charDuration - minDuration,
            needTime - borrowedTime
          );
          char.endTime -= canBorrow;
          borrowedTime += canBorrow;

          // 更新后续字符的时间
          for (let j = i + 1; j < result.length; j++) {
            result[j].startTime -= borrowedTime;
            result[j].endTime -= borrowedTime;
          }
        }
      }
    }
  }

  // 优化3：处理标点符号后的停顿
  for (let i = 0; i < result.length - 1; i++) {
    const char = result[i];

    // 如果当前字符是标点符号，且后面有字符
    if (
      /[，。！？、；：""''（）《》【】…—·,\.!?;:'"()\[\]\-]/.test(char.text)
    ) {
      const punctDuration = char.endTime - char.startTime;

      // 标点符号时间过长，压缩一下，给后面的字更多时间
      if (punctDuration > MIN_CHAR_DURATION * 0.5) {
        const reduceTime = punctDuration - MIN_CHAR_DURATION * 0.3;
        char.endTime -= reduceTime;

        // 将节省的时间分配给后面的字符
        for (let j = i + 1; j < result.length; j++) {
          result[j].startTime -= reduceTime;
          if (j < result.length - 1) {
            result[j].endTime -= reduceTime;
          }
        }
      }
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
 * 注意：只过滤纯音乐标记，保留有意义的内容（如歌手标注、元信息等）
 */
export function filterSpecialMarks(text: string): {
  text: string;
  isSpecialMark: boolean;
} {
  const trimmedText = text.trim();

  // 空行直接返回
  if (!trimmedText) {
    return { text: "", isSpecialMark: false };
  }

  // 特殊标记模式（只匹配纯音乐标记，不包含其他内容）
  const specialPatterns = [
    /^[\(（]?music[\)）]?$/i, // Music、(Music)、（Music）
    /^[\(（]?intro[\)）]?$/i, // Intro、(Intro)、（Intro）
    /^[\(（]?outro[\)）]?$/i, // Outro、(Outro)、（Outro）
    /^[\(（]?bridge[\)）]?$/i, // Bridge、(Bridge)、（Bridge）
    /^[\(（]?间奏[\)）]?$/i, // 间奏、(间奏)、（间奏）
    /^[\(（]?前奏[\)）]?$/i, // 前奏、(前奏)、（前奏）
    /^[\(（]?尾奏[\)）]?$/i, // 尾奏、(尾奏)、（尾奏）
    /^[\(（]?solo[\)）]?$/i, // Solo、(Solo)、（Solo）
    /^[\(（]?instrumental[\)）]?$/i, // Instrumental
    /^[\(（]?伴奏[\)）]?$/i, // 伴奏
    /^end$/i, // End
    /^\.\.\.$/, // ...
    /^…$/, // …
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
