import { defineStore } from "pinia";
import { ref, watch, nextTick } from "vue";
import { tabSync } from "@/utils/sync";

// 音质类型
export type QualityLevel =
  | "standard" // 标准音质 (128kbps)
  | "exhigh" // 极高音质 (320kbps)
  | "lossless" // 无损音质 (FLAC)
  | "hires" // Hi-Res音质 (24bit/96kHz)
  | "jyeffect" // 高清环绕声
  | "sky" // 沉浸环绕声
  | "jymaster"; // 超清母带

// 搜索类型
export type SearchType = "music" | "song" | "playlist" | "album";

// 字体大小
export type FontSize = "small" | "medium" | "large";

// 字体系列
export type FontFamily = string;

// 卡拉OK样式模式
export type KaraokeMode = "off" | "style1" | "style2";

const STORAGE_KEY = "music-player-settings";

export const useSettingsStore = defineStore("settings", () => {
  // 从 localStorage 加载设置
  const loadSettings = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.error("加载设置失败:", error);
    }
    return {
      quality: "lossless",
      searchType: "music",
      fontSize: "medium",
      fontFamily: "Microsoft YaHei",
      apiBaseUrl: "",
      lyricActiveFontSize: 32,
      lyricInactiveFontSize: 18,
      showLyricTranslation: true, // 默认显示翻译
      karaokeMode: "off", // 默认关闭
      globalLyricOffset: 0, // 全局歌词偏移量（秒）
      songLyricOffsets: {}, // 单曲歌词偏移量（Map）
      closeToTray: true, // 默认关闭到托盘
    };
  };

  const savedSettings = loadSettings();

  // 音质设置
  const quality = ref<QualityLevel>(savedSettings.quality || "lossless");

  // 搜索类型
  const searchType = ref<SearchType>(savedSettings.searchType || "music");

  // 字体大小
  const fontSize = ref<FontSize>(savedSettings.fontSize || "medium");

  // 字体系列
  const fontFamily = ref<FontFamily>(
    savedSettings.fontFamily || "Microsoft YaHei"
  );

  // API服务器地址（空字符串表示使用默认地址）
  const apiBaseUrl = ref<string>(savedSettings.apiBaseUrl || "");

  // 歌词字体大小（像素值）
  const lyricActiveFontSize = ref<number>(
    savedSettings.lyricActiveFontSize || 32
  );
  const lyricInactiveFontSize = ref<number>(
    savedSettings.lyricInactiveFontSize || 18
  );

  // 是否显示歌词翻译（外文歌曲显示中文翻译）
  const showLyricTranslation = ref<boolean>(
    savedSettings.showLyricTranslation !== false // 默认为 true
  );

  // 卡拉OK样式模式：'off' | 'style1' | 'style2'
  // off: 关闭（普通整行高亮）
  // style1: 弹跳效果（逐字弹跳）
  // style2: 渐变填充效果（从左到右颜色过渡）
  const karaokeMode = ref<"off" | "style1" | "style2">(
    savedSettings.karaokeMode || "off" // 默认关闭
  );

  // 全局歌词偏移量（秒）
  const globalLyricOffset = ref<number>(savedSettings.globalLyricOffset || 0);

  // 单曲歌词偏移量（Map: songId -> offset）
  const songLyricOffsets = ref<Record<string, number>>(
    savedSettings.songLyricOffsets || {}
  );

  // 是否关闭到托盘（仅Electron环境有效）
  const closeToTray = ref<boolean>(
    savedSettings.closeToTray !== false // 默认为 true
  );

  // 标志：是否正在从其他标签页同步数据（避免循环广播）
  let isSyncing = false;

  // 保存设置到 localStorage 并同步到其他标签页
  const saveSettings = () => {
    // 如果正在同步，跳过广播
    if (isSyncing) return;

    try {
      const state = {
        quality: quality.value,
        searchType: searchType.value,
        fontSize: fontSize.value,
        fontFamily: fontFamily.value,
        apiBaseUrl: apiBaseUrl.value,
        lyricActiveFontSize: lyricActiveFontSize.value,
        lyricInactiveFontSize: lyricInactiveFontSize.value,
        showLyricTranslation: showLyricTranslation.value,
        karaokeMode: karaokeMode.value,
        globalLyricOffset: globalLyricOffset.value,
        songLyricOffsets: songLyricOffsets.value,
        closeToTray: closeToTray.value,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

      // 广播到其他标签页
      tabSync.broadcast("settings", state);
    } catch (error) {
      console.error("保存设置失败:", error);
    }
  };

  // 监听变化并自动保存
  watch(
    [
      quality,
      searchType,
      fontSize,
      fontFamily,
      apiBaseUrl,
      lyricActiveFontSize,
      lyricInactiveFontSize,
      showLyricTranslation,
      karaokeMode,
      globalLyricOffset,
      songLyricOffsets,
      closeToTray,
    ],
    saveSettings,
    { deep: true }
  );

  // 订阅其他标签页的更新
  tabSync.subscribe("settings", (data) => {
    // 设置同步标志，避免触发 watch 导致循环广播
    isSyncing = true;

    // 更新本地状态
    quality.value = data.quality || "lossless";
    searchType.value = data.searchType || "music";
    fontSize.value = data.fontSize || "medium";
    fontFamily.value = data.fontFamily || "Microsoft YaHei";
    apiBaseUrl.value = data.apiBaseUrl || "";
    lyricActiveFontSize.value = data.lyricActiveFontSize || 32;
    lyricInactiveFontSize.value = data.lyricInactiveFontSize || 18;
    showLyricTranslation.value = data.showLyricTranslation !== false;
    karaokeMode.value = data.karaokeMode || "off";
    globalLyricOffset.value = data.globalLyricOffset || 0;
    songLyricOffsets.value = data.songLyricOffsets || {};
    closeToTray.value = data.closeToTray !== false;

    // 使用 nextTick 确保在下一个 tick 重置同步标志
    nextTick(() => {
      isSyncing = false;
    });
  });

  // 设置音质
  const setQuality = (level: QualityLevel) => {
    quality.value = level;
  };

  // 设置搜索类型
  const setSearchType = (type: SearchType) => {
    searchType.value = type;
  };

  // 设置字体大小
  const setFontSize = (size: FontSize) => {
    fontSize.value = size;
    // 应用字体大小到根元素
    applyFontSize(size);
  };

  // 设置字体系列
  const setFontFamily = (family: FontFamily) => {
    fontFamily.value = family;
    // 应用字体系列到根元素
    applyFontFamily(family);
  };

  // 应用字体大小
  const applyFontSize = (size: FontSize) => {
    const root = document.documentElement;
    switch (size) {
      //程序整体字体
      case "small":
        // 小
        root.style.setProperty("--custom-font-size-base", "12px");
        root.style.setProperty("--custom-font-size-sm", "10px");
        root.style.setProperty("--custom-font-size-md", "12px");
        root.style.setProperty("--custom-font-size-lg", "14px");
        break;
      case "medium":
        // 中
        root.style.setProperty("--custom-font-size-base", "17px");
        root.style.setProperty("--custom-font-size-sm", "15px");
        root.style.setProperty("--custom-font-size-md", "17px");
        root.style.setProperty("--custom-font-size-lg", "19px");
        break;
      case "large":
        // 大
        root.style.setProperty("--custom-font-size-base", "20px");
        root.style.setProperty("--custom-font-size-sm", "18px");
        root.style.setProperty("--custom-font-size-md", "20px");
        root.style.setProperty("--custom-font-size-lg", "22px");
        break;
    }
  };

  // 应用字体系列
  const applyFontFamily = (family: FontFamily) => {
    const root = document.documentElement;
    root.style.setProperty("--custom-font-family", family);
  };

  // 初始化时应用字体大小和字体系列
  applyFontSize(fontSize.value);
  applyFontFamily(fontFamily.value);

  // 设置API地址
  const setApiBaseUrl = (url: string) => {
    apiBaseUrl.value = url;
  };

  // 检查是否在Electron环境
  const isElectron = () => {
    return !!(window as any).electronAPI;
  };

  // 检查是否为生产环境
  const isProduction = () => {
    return import.meta.env.PROD;
  };

  // 检查是否为开发环境
  const isDevelopment = () => {
    return import.meta.env.DEV;
  };

  // 检查是否应该使用文件系统缓存（Electron 生产环境）
  const shouldUseFileSystemCache = () => {
    return isElectron() && isProduction();
  };

  // 设置歌词字体大小
  const setLyricFontSizes = (activeSize: number, inactiveSize: number) => {
    lyricActiveFontSize.value = activeSize;
    lyricInactiveFontSize.value = inactiveSize;
    applyLyricFontSizes();
  };

  // 设置是否显示歌词翻译
  const setShowLyricTranslation = (show: boolean) => {
    showLyricTranslation.value = show;
  };

  // 设置卡拉OK样式模式
  const setKaraokeMode = (mode: "off" | "style1" | "style2") => {
    karaokeMode.value = mode;
  };

  // 应用歌词字体大小到 CSS 变量
  const applyLyricFontSizes = () => {
    const root = document.documentElement;
    root.style.setProperty(
      "--lyric-active-font-size",
      `${lyricActiveFontSize.value}px`
    );
    root.style.setProperty(
      "--lyric-inactive-font-size",
      `${lyricInactiveFontSize.value}px`
    );
  };

  // 初始化时应用歌词字体大小
  applyLyricFontSizes();

  // 获取歌词偏移量（优先使用单曲偏移量，否则使用全局偏移量）
  const getLyricOffset = (songId?: string): number => {
    if (songId && songLyricOffsets.value[songId] !== undefined) {
      return songLyricOffsets.value[songId];
    }
    return globalLyricOffset.value;
  };

  // 设置歌词偏移量
  const setLyricOffset = (offset: number, songId?: string) => {
    if (songId) {
      // 设置单曲偏移量
      songLyricOffsets.value[songId] = offset;
    } else {
      // 设置全局偏移量
      globalLyricOffset.value = offset;
    }
  };

  // 设置是否关闭到托盘
  const setCloseToTray = async (enabled: boolean) => {
    closeToTray.value = enabled;

    // 如果在Electron环境，通知主进程
    if (isElectron() && (window as any).electron) {
      try {
        await (window as any).electron.invoke("set-close-to-tray", enabled);
      } catch (error) {
        console.error("设置关闭到托盘失败:", error);
      }
    }
  };

  return {
    quality,
    searchType,
    fontSize,
    fontFamily,
    apiBaseUrl,
    lyricActiveFontSize,
    lyricInactiveFontSize,
    showLyricTranslation,
    karaokeMode,
    globalLyricOffset,
    songLyricOffsets,
    closeToTray,
    setQuality,
    setSearchType,
    setFontSize,
    setFontFamily,
    setApiBaseUrl,
    setLyricFontSizes,
    setShowLyricTranslation,
    setKaraokeMode,
    getLyricOffset,
    setLyricOffset,
    setCloseToTray,
    isElectron,
    isProduction,
    isDevelopment,
    shouldUseFileSystemCache,
  };
});
