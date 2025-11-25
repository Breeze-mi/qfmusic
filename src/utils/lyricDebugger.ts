/**
 * 歌词调试工具
 * 用于验证歌词时间同步和动画准确性
 */

import type { LyricLine, LyricChar } from "./lyricParser";

/**
 * 验证歌词行的时间连续性
 */
export function validateLyricTiming(lyrics: LyricLine[]): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  lyrics.forEach((line, lineIndex) => {
    // 检查行时间是否为负数
    if (line.time < 0) {
      errors.push(`行 ${lineIndex + 1}: 时间为负数 (${line.time})`);
    }

    // 检查字符时间
    if (line.chars && line.chars.length > 0) {
      line.chars.forEach((char, charIndex) => {
        // 检查字符相对时间是否为负数
        if (char.startTime < 0) {
          errors.push(
            `行 ${lineIndex + 1}, 字符 ${charIndex + 1} "${
              char.text
            }": 开始时间为负数 (${char.startTime})`
          );
        }

        // 检查字符持续时间是否为负数
        const duration = char.endTime - char.startTime;
        if (duration < 0) {
          errors.push(
            `行 ${lineIndex + 1}, 字符 ${charIndex + 1} "${
              char.text
            }": 持续时间为负数 (${duration})`
          );
        }

        // 检查字符持续时间是否过短（小于10ms）
        if (duration > 0 && duration < 0.01) {
          warnings.push(
            `行 ${lineIndex + 1}, 字符 ${charIndex + 1} "${
              char.text
            }": 持续时间过短 (${(duration * 1000).toFixed(1)}ms)`
          );
        }

        // 检查字符持续时间是否过长（大于5秒）
        if (duration > 5) {
          warnings.push(
            `行 ${lineIndex + 1}, 字符 ${charIndex + 1} "${
              char.text
            }": 持续时间过长 (${duration.toFixed(2)}s)`
          );
        }

        // 检查字符之间的间隔
        if (charIndex > 0) {
          const prevChar = line.chars![charIndex - 1];
          const gap = char.startTime - prevChar.endTime;

          // 间隔大于100ms
          if (gap > 0.1) {
            warnings.push(
              `行 ${lineIndex + 1}, 字符 ${charIndex} 到 ${
                charIndex + 1
              }: 间隔过大 (${(gap * 1000).toFixed(1)}ms)`
            );
          }

          // 重叠（负间隔）
          if (gap < -0.001) {
            warnings.push(
              `行 ${lineIndex + 1}, 字符 ${charIndex} 到 ${
                charIndex + 1
              }: 时间重叠 (${(gap * 1000).toFixed(1)}ms)`
            );
          }
        }
      });

      // 检查第一个字符是否从0开始
      if (line.chars[0].startTime > 0.05) {
        warnings.push(
          `行 ${
            lineIndex + 1
          }: 第一个字符不是从0开始 (${line.chars[0].startTime.toFixed(3)}s)`
        );
      }

      // 检查最后一个字符是否接近行持续时间
      if (line.duration) {
        const lastChar = line.chars[line.chars.length - 1];
        const diff = Math.abs(lastChar.endTime - line.duration);
        if (diff > 0.1) {
          warnings.push(
            `行 ${
              lineIndex + 1
            }: 最后一个字符结束时间与行持续时间不匹配 (差值: ${(
              diff * 1000
            ).toFixed(1)}ms)`
          );
        }
      }
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * 打印歌词调试信息
 */
export function printLyricDebugInfo(lyrics: LyricLine[], maxLines: number = 5) {
  console.group("🎵 歌词调试信息");

  console.log(`总行数: ${lyrics.length}`);

  const validation = validateLyricTiming(lyrics);
  console.log(`验证结果: ${validation.isValid ? "✓ 通过" : "✗ 失败"}`);

  if (validation.errors.length > 0) {
    console.group("❌ 错误:");
    validation.errors.forEach((error) => console.error(error));
    console.groupEnd();
  }

  if (validation.warnings.length > 0) {
    console.group("⚠️ 警告:");
    validation.warnings.forEach((warning) => console.warn(warning));
    console.groupEnd();
  }

  console.group(`前 ${Math.min(maxLines, lyrics.length)} 行详情:`);
  lyrics.slice(0, maxLines).forEach((line, index) => {
    console.group(`行 ${index + 1}: "${line.text}" (${line.time.toFixed(3)}s)`);
    if (line.chars && line.chars.length > 0) {
      console.log(`字符数: ${line.chars.length}`);
      console.log(`持续时间: ${line.duration?.toFixed(3)}s`);
      console.table(
        line.chars.map((char, i) => ({
          序号: i + 1,
          字符: char.text,
          开始: `${char.startTime.toFixed(3)}s`,
          结束: `${char.endTime.toFixed(3)}s`,
          持续: `${((char.endTime - char.startTime) * 1000).toFixed(0)}ms`,
        }))
      );
    }
    console.groupEnd();
  });
  console.groupEnd();

  console.groupEnd();
}

/**
 * 实时监控歌词播放状态
 */
export class LyricPlaybackMonitor {
  private startTime: number = 0;
  private lastLogTime: number = 0;
  private logInterval: number = 1000; // 每秒记录一次

  constructor(logInterval: number = 1000) {
    this.logInterval = logInterval;
  }

  start() {
    this.startTime = performance.now();
    this.lastLogTime = this.startTime;
  }

  log(
    currentTime: number,
    currentLine: LyricLine | null,
    currentChar: LyricChar | null
  ) {
    const now = performance.now();
    if (now - this.lastLogTime < this.logInterval) {
      return;
    }

    this.lastLogTime = now;

    console.log(
      `[${currentTime.toFixed(2)}s] 行: "${
        currentLine?.text || "无"
      }" | 字符: "${currentChar?.text || "无"}"`
    );
  }

  stop() {
    const elapsed = (performance.now() - this.startTime) / 1000;
    console.log(`播放监控结束，总时长: ${elapsed.toFixed(2)}s`);
  }
}
