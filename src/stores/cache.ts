import { defineStore } from "pinia";
import { ref, watch } from "vue";
import type { SongDetail } from "@/api/music";
import { persist } from "@/utils/persist";

const STORAGE_KEY = "music-song-cache";
const MAX_CACHE_SIZE = 100; // 最多缓存100首歌曲

export const useCacheStore = defineStore("cache", () => {
  // 从 localStorage 加载缓存
  const loadCache = (): Map<string, SongDetail> => {
    try {
      const saved = persist.load(STORAGE_KEY, { cache: {} });
      const cacheObj = saved.cache || {};
      return new Map(Object.entries(cacheObj));
    } catch (error) {
      console.error("加载缓存失败:", error);
      return new Map();
    }
  };

  // 歌曲详情缓存 Map<songId, SongDetail>
  const songCache = ref<Map<string, SongDetail>>(loadCache());

  // 保存缓存到 localStorage
  const saveCache = () => {
    try {
      const cacheObj = Object.fromEntries(songCache.value);
      persist.save(STORAGE_KEY, { cache: cacheObj });
    } catch (error) {
      console.error("保存缓存失败:", error);
    }
  };

  // 监听缓存变化，自动保存（使用防抖避免频繁写入）
  let saveTimer: number | null = null;
  watch(
    songCache,
    () => {
      if (saveTimer !== null) {
        clearTimeout(saveTimer);
      }
      saveTimer = window.setTimeout(() => {
        saveCache();
        saveTimer = null;
      }, 1000);
    },
    { deep: true }
  );

  // 获取缓存的歌曲详情
  const getCachedSong = (songId: string): SongDetail | undefined => {
    return songCache.value.get(songId);
  };

  // 设置歌曲详情缓存
  const setCachedSong = (
    songId: string,
    songDetail: SongDetail | undefined
  ) => {
    if (songDetail) {
      // 如果缓存已满，删除最早的缓存
      if (songCache.value.size >= MAX_CACHE_SIZE) {
        const firstKey = songCache.value.keys().next().value;
        if (firstKey) {
          songCache.value.delete(firstKey);
          console.log(`缓存已满，删除最早的缓存: ${firstKey}`);
        }
      }

      songCache.value.set(songId, songDetail);
      console.log(`缓存歌曲: ${songId}, 当前缓存数量: ${songCache.value.size}`);
    }
  };

  // 检查是否有缓存
  const hasCachedSong = (songId: string): boolean => {
    return songCache.value.has(songId);
  };

  // 清空缓存
  const clearCache = () => {
    songCache.value.clear();
    saveCache();
    console.log("已清空所有缓存");
  };

  // 获取缓存大小
  const getCacheSize = (): number => {
    return songCache.value.size;
  };

  return {
    getCachedSong,
    setCachedSong,
    hasCachedSong,
    clearCache,
    getCacheSize,
  };
});
