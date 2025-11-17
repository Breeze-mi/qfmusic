import { defineStore } from "pinia";
import { ref, watch } from "vue";

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
    return { quality: "lossless", searchType: "music" };
  };

  const savedSettings = loadSettings();

  // 音质设置
  const quality = ref<QualityLevel>(savedSettings.quality);

  // 搜索类型
  const searchType = ref<SearchType>(savedSettings.searchType);

  // 保存设置到 localStorage
  const saveSettings = () => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          quality: quality.value,
          searchType: searchType.value,
        })
      );
    } catch (error) {
      console.error("保存设置失败:", error);
    }
  };

  // 监听变化并自动保存
  watch([quality, searchType], saveSettings);

  // 设置音质
  const setQuality = (level: QualityLevel) => {
    quality.value = level;
  };

  // 设置搜索类型
  const setSearchType = (type: SearchType) => {
    searchType.value = type;
  };

  return {
    quality,
    searchType,
    setQuality,
    setSearchType,
  };
});
