/**
 * 主题配置文件
 * 用于自定义主题颜色和样式
 */

export interface ThemeColors {
  // 主色调
  primary: string;
  primaryLight3: string;
  primaryLight5: string;
  primaryLight7: string;
  primaryLight9: string;
  primaryDark2: string;

  // 选中状态颜色
  selectedBg: string;
  selectedBorder: string;
  selectedText: string;

  // 正在播放状态颜色
  playingBg: string;
  playingText: string;
  playingTextSecondary: string;

  // 歌词显示颜色
  lyricBg: string;
  lyricActiveText: string;
  lyricInactiveText: string;
  lyricInactiveOpacity: string;
  lyricActiveShadow: string;
}

// 浅色主题默认配置
export const lightThemeColors: ThemeColors = {
  primary: "#ec4141",
  primaryLight3: "#f06565",
  primaryLight5: "#f48989",
  primaryLight7: "#f8adad",
  primaryLight9: "#fcd1d1",
  primaryDark2: "#d13838",
  selectedBg: "#fef0f0",
  selectedBorder: "#ec4141",
  selectedText: "#333333",
  playingBg: "#fef0f0",
  playingText: "#ec4141",
  playingTextSecondary: "#666666",
  lyricBg: "#f7f8fa",
  lyricActiveText: "#333333",
  lyricInactiveText: "#999999",
  lyricInactiveOpacity: "0.5",
  lyricActiveShadow: "rgba(236, 65, 65, 0.2)",
};

// 暗色主题默认配置
export const darkThemeColors: ThemeColors = {
  primary: "#ec4141",
  primaryLight3: "#f06565",
  primaryLight5: "#f48989",
  primaryLight7: "#f8adad",
  primaryLight9: "#fcd1d1",
  primaryDark2: "#d13838",
  selectedBg: "rgba(236, 65, 65, 0.15)",
  selectedBorder: "#ec4141",
  selectedText: "#eeeeee",
  playingBg: "rgba(236, 65, 65, 0.12)",
  playingText: "#ec4141",
  playingTextSecondary: "#cccccc",
  lyricBg: "#262626",
  lyricActiveText: "#ffffff",
  lyricInactiveText: "#888888",
  lyricInactiveOpacity: "0.4",
  lyricActiveShadow: "rgba(236, 65, 65, 0.3)",
};

/**
 * 应用自定义主题颜色
 */
export function applyCustomTheme(
  isDark: boolean,
  customColors?: Partial<ThemeColors>
) {
  const root = document.documentElement;

  if (customColors && Object.keys(customColors).length > 0) {
    const baseColors = isDark ? darkThemeColors : lightThemeColors;
    const colors = { ...baseColors, ...customColors };

    root.style.setProperty("--el-color-primary", colors.primary);
    root.style.setProperty("--el-color-primary-light-3", colors.primaryLight3);
    root.style.setProperty("--el-color-primary-light-5", colors.primaryLight5);
    root.style.setProperty("--el-color-primary-light-7", colors.primaryLight7);
    root.style.setProperty("--el-color-primary-light-9", colors.primaryLight9);
    root.style.setProperty("--el-color-primary-dark-2", colors.primaryDark2);
    root.style.setProperty("--song-selected-bg", colors.selectedBg);
    root.style.setProperty("--song-selected-border", colors.selectedBorder);
    root.style.setProperty("--song-selected-text", colors.selectedText);
    root.style.setProperty("--song-playing-bg", colors.playingBg);
    root.style.setProperty("--song-playing-text", colors.playingText);
    root.style.setProperty(
      "--song-playing-text-secondary",
      colors.playingTextSecondary
    );
    root.style.setProperty("--lyric-bg", colors.lyricBg);
    root.style.setProperty("--lyric-active-text", colors.lyricActiveText);
    root.style.setProperty("--lyric-inactive-text", colors.lyricInactiveText);
    root.style.setProperty(
      "--lyric-inactive-opacity",
      colors.lyricInactiveOpacity
    );
    root.style.setProperty("--lyric-active-shadow", colors.lyricActiveShadow);
  } else {
    root.style.removeProperty("--el-color-primary");
    root.style.removeProperty("--el-color-primary-light-3");
    root.style.removeProperty("--el-color-primary-light-5");
    root.style.removeProperty("--el-color-primary-light-7");
    root.style.removeProperty("--el-color-primary-light-9");
    root.style.removeProperty("--el-color-primary-dark-2");
    root.style.removeProperty("--song-selected-bg");
    root.style.removeProperty("--song-selected-border");
    root.style.removeProperty("--song-selected-text");
    root.style.removeProperty("--song-playing-bg");
    root.style.removeProperty("--song-playing-text");
    root.style.removeProperty("--song-playing-text-secondary");
    root.style.removeProperty("--lyric-bg");
    root.style.removeProperty("--lyric-active-text");
    root.style.removeProperty("--lyric-inactive-text");
    root.style.removeProperty("--lyric-inactive-opacity");
    root.style.removeProperty("--lyric-active-shadow");
  }
}

// ========== 预设主题 ==========

export const neteaseRedTheme: Partial<ThemeColors> = {
  primary: "#ec4141",
  primaryLight3: "#f06565",
  primaryLight5: "#f48989",
  primaryLight7: "#f8adad",
  primaryLight9: "#fcd1d1",
  primaryDark2: "#d13838",
  selectedBg: "#fef0f0",
  selectedBorder: "#ec4141",
  // selectedText 不设置，自动根据深浅模式使用 baseColors 的值
  playingBg: "#fef0f0",
  playingText: "#ec4141",
};

export const kugouBlueTheme: Partial<ThemeColors> = {
  primary: "#2878ff",
  primaryLight3: "#4a8fff",
  primaryLight5: "#6ca6ff",
  primaryLight7: "#8ebdff",
  primaryLight9: "#b0d4ff",
  primaryDark2: "#1f5fd9",
  selectedBg: "rgba(40, 120, 255, 0.12)",
  selectedBorder: "#2878ff",
  // selectedText 不设置，自动根据深浅模式使用 baseColors 的值
  playingBg: "rgba(40, 120, 255, 0.12)",
  playingText: "#2878ff",
};

export const qqGreenTheme: Partial<ThemeColors> = {
  primary: "#31c27c",
  primaryLight3: "#53ce93",
  primaryLight5: "#75daaa",
  primaryLight7: "#97e6c1",
  primaryLight9: "#b9f2d8",
  primaryDark2: "#28a569",
  selectedBg: "rgba(49, 194, 124, 0.12)",
  selectedBorder: "#31c27c",
  // selectedText 不设置，自动根据深浅模式使用 baseColors 的值
  playingBg: "rgba(49, 194, 124, 0.12)",
  playingText: "#31c27c",
};

export const orangeTheme: Partial<ThemeColors> = {
  primary: "#ff9800",
  primaryLight3: "#ffb74d",
  primaryLight5: "#ffcc80",
  primaryLight7: "#ffe0b2",
  primaryLight9: "#fff3e0",
  primaryDark2: "#f57c00",
  selectedBg: "rgba(255, 152, 0, 0.12)",
  selectedBorder: "#ff9800",
  // selectedText 不设置，自动根据深浅模式使用 baseColors 的值
  playingBg: "rgba(255, 152, 0, 0.12)",
  playingText: "#ff9800",
};

export const pinkTheme: Partial<ThemeColors> = {
  primary: "#e91e63",
  primaryLight3: "#f06292",
  primaryLight5: "#f48fb1",
  primaryLight7: "#f8bbd0",
  primaryLight9: "#fce4ec",
  primaryDark2: "#c2185b",
  selectedBg: "rgba(233, 30, 99, 0.12)",
  selectedBorder: "#e91e63",
  // selectedText 不设置，自动根据深浅模式使用 baseColors 的值
  playingBg: "rgba(233, 30, 99, 0.12)",
  playingText: "#e91e63",
};

export const purpleTheme: Partial<ThemeColors> = {
  primary: "#9c27b0",
  primaryLight3: "#ba68c8",
  primaryLight5: "#ce93d8",
  primaryLight7: "#e1bee7",
  primaryLight9: "#f3e5f5",
  primaryDark2: "#7b1fa2",
  selectedBg: "rgba(156, 39, 176, 0.12)",
  selectedBorder: "#9c27b0",
  // selectedText 不设置，自动根据深浅模式使用 baseColors 的值
  playingBg: "rgba(156, 39, 176, 0.12)",
  playingText: "#9c27b0",
};

// 主题预设映射
export const themePresets = {
  default: null,
  netease: neteaseRedTheme,
  kugou: kugouBlueTheme,
  qq: qqGreenTheme,
  orange: orangeTheme,
  pink: pinkTheme,
  purple: purpleTheme,
};
