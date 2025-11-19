import { defineStore } from "pinia";
import { ref, watch } from "vue";
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
      apiBaseUrl: "",
    };
  };

  const savedSettings = loadSettings();

  // 音质设置
  const quality = ref<QualityLevel>(savedSettings.quality || "lossless");

  // 搜索类型
  const searchType = ref<SearchType>(savedSettings.searchType || "music");

  // 字体大小
  const fontSize = ref<FontSize>(savedSettings.fontSize || "medium");

  // API服务器地址（空字符串表示使用默认地址）
  const apiBaseUrl = ref<string>(savedSettings.apiBaseUrl || "");

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
        apiBaseUrl: apiBaseUrl.value,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

      // 广播到其他标签页
      tabSync.broadcast("settings", state);
    } catch (error) {
      console.error("保存设置失败:", error);
    }
  };

  // 监听变化并自动保存
  watch([quality, searchType, fontSize, apiBaseUrl], saveSettings);

  // 订阅其他标签页的更新
  tabSync.subscribe("settings", (data) => {
    // 设置同步标志，避免触发 watch 导致循环广播
    isSyncing = true;

    // 更新本地状态
    quality.value = data.quality || "lossless";
    searchType.value = data.searchType || "music";
    fontSize.value = data.fontSize || "medium";
    apiBaseUrl.value = data.apiBaseUrl || "";

    // 重置同步标志
    setTimeout(() => {
      isSyncing = false;
    }, 0);
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

  // 应用字体大小
  const applyFontSize = (size: FontSize) => {
    const root = document.documentElement;
    switch (size) {
      case "small":
        root.style.fontSize = "14px";
        break;
      case "medium":
        root.style.fontSize = "16px";
        break;
      case "large":
        root.style.fontSize = "18px";
        break;
    }
  };

  // 初始化时应用字体大小
  applyFontSize(fontSize.value);

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

  return {
    quality,
    searchType,
    fontSize,
    apiBaseUrl,
    setQuality,
    setSearchType,
    setFontSize,
    setApiBaseUrl,
    isElectron,
    isProduction,
    isDevelopment,
    shouldUseFileSystemCache,
  };
});
