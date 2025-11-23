import { defineStore } from "pinia";
import { ref, watch } from "vue";
import { tabSync } from "@/utils/sync";
import { applyCustomTheme, type ThemeColors } from "@/config/theme";

export const useThemeStore = defineStore("theme", () => {
  const isDark = ref(false);
  const customColors = ref<Partial<ThemeColors> | null>(null);

  // 独立的选中颜色设置（不受主题预设影响）
  const selectedColors = ref<{
    selectedBg?: string;
    selectedText?: string;
  } | null>(null);

  // 独立的歌词颜色设置（不受主题预设影响）
  const lyricColors = ref<{
    lyricBg?: string;
    lyricActiveText?: string;
    lyricInactiveText?: string;
  } | null>(null);

  // 标志：是否正在从其他标签页同步数据（避免循环广播）
  let isSyncing = false;

  // 应用主题到DOM
  const applyTheme = (dark: boolean, broadcast = true) => {
    // 添加禁用过渡的类,实现即时切换
    document.documentElement.classList.add("theme-transition-disabled");

    // 先切换dark类，触发CSS变量的切换
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");

    // 使用 requestAnimationFrame 确保DOM更新后再应用自定义颜色
    requestAnimationFrame(() => {
      // 合并主题颜色和选中颜色
      const mergedColors = {
        ...(customColors.value || {}),
        ...(selectedColors.value || {}),
      };

      // 只合并用户实际设置了的歌词颜色属性（过滤掉空值）
      if (lyricColors.value && Object.keys(lyricColors.value).length > 0) {
        const filteredLyricColors: any = {};
        if (lyricColors.value.lyricBg) {
          filteredLyricColors.lyricBg = lyricColors.value.lyricBg;
        }
        if (lyricColors.value.lyricActiveText) {
          filteredLyricColors.lyricActiveText =
            lyricColors.value.lyricActiveText;
        }
        if (lyricColors.value.lyricInactiveText) {
          filteredLyricColors.lyricInactiveText =
            lyricColors.value.lyricInactiveText;
        }
        Object.assign(mergedColors, filteredLyricColors);
      }

      // 应用自定义颜色（如果有）
      applyCustomTheme(
        dark,
        Object.keys(mergedColors).length > 0 ? mergedColors : undefined
      );

      // 在下一帧移除禁用过渡的类,恢复正常过渡效果
      requestAnimationFrame(() => {
        document.documentElement.classList.remove("theme-transition-disabled");
      });
    });

    // 广播到其他标签页（如果不是在同步中）
    if (broadcast && !isSyncing) {
      tabSync.broadcast("theme", { isDark: dark });
    }
  };

  // 切换主题（手动调用）
  const toggleTheme = () => {
    isDark.value = !isDark.value;
    applyTheme(isDark.value);
  };

  // 设置自定义颜色（主题相关，只包括主色调）
  const setCustomColors = (colors: Partial<ThemeColors> | null) => {
    customColors.value = colors;
    if (colors && Object.keys(colors).length > 0) {
      localStorage.setItem("custom-theme-colors", JSON.stringify(colors));
    } else {
      localStorage.removeItem("custom-theme-colors");
    }
    // 立即应用主题（包括自定义颜色）
    applyTheme(isDark.value, false);
  };

  // 设置独立的选中颜色（不受主题预设影响）
  const setSelectedColors = (
    colors: { selectedBg?: string; selectedText?: string } | null
  ) => {
    selectedColors.value = colors;
    if (colors && Object.keys(colors).length > 0) {
      localStorage.setItem("custom-selected-colors", JSON.stringify(colors));
    } else {
      localStorage.removeItem("custom-selected-colors");
    }
    // 立即应用主题（包括选中颜色）
    applyTheme(isDark.value, false);
  };

  // 设置独立的歌词颜色（不受主题预设影响）
  const setLyricColors = (
    colors: {
      lyricBg?: string;
      lyricActiveText?: string;
      lyricInactiveText?: string;
    } | null
  ) => {
    lyricColors.value = colors;
    if (colors && Object.keys(colors).length > 0) {
      localStorage.setItem("custom-lyric-colors", JSON.stringify(colors));
    } else {
      localStorage.removeItem("custom-lyric-colors");
    }
    // 立即应用主题（包括歌词颜色）
    applyTheme(isDark.value, false);
  };

  // 初始化主题
  const initTheme = () => {
    const savedTheme = localStorage.getItem("theme");
    isDark.value = savedTheme === "dark";

    // 加载自定义颜色
    const savedColors = localStorage.getItem("custom-theme-colors");
    if (savedColors) {
      try {
        customColors.value = JSON.parse(savedColors);
      } catch (error) {
        console.error("加载自定义主题颜色失败:", error);
      }
    }

    // 加载独立的选中颜色
    const savedSelectedColors = localStorage.getItem("custom-selected-colors");
    if (savedSelectedColors) {
      try {
        selectedColors.value = JSON.parse(savedSelectedColors);
      } catch (error) {
        console.error("加载自定义选中颜色失败:", error);
      }
    }

    // 加载独立的歌词颜色
    const savedLyricColors = localStorage.getItem("custom-lyric-colors");
    if (savedLyricColors) {
      try {
        lyricColors.value = JSON.parse(savedLyricColors);
      } catch (error) {
        console.error("加载自定义歌词颜色失败:", error);
      }
    }

    applyTheme(isDark.value, false); // 初始化时不广播
  };

  // 监听 isDark 变化，自动应用主题（用于 switch 组件）
  watch(isDark, (newValue) => {
    applyTheme(newValue);
  });

  // 订阅其他标签页的主题更新
  tabSync.subscribe("theme", (data) => {
    // 设置同步标志，避免循环广播
    isSyncing = true;

    // 更新本地状态
    isDark.value = data.isDark ?? false;
    applyTheme(isDark.value, false);

    // 重置同步标志
    setTimeout(() => {
      isSyncing = false;
    }, 0);
  });

  return {
    isDark,
    customColors,
    selectedColors,
    lyricColors,
    toggleTheme,
    setCustomColors,
    setSelectedColors,
    setLyricColors,
    initTheme,
  };
});
