import { defineStore } from "pinia";
import { ref, watch } from "vue";
import type { SongDetail } from "@/api/music";
import { persist } from "@/utils/persist";

const STORAGE_KEY = "music-song-cache";
const MAX_CACHE_SIZE = 120; // 最多缓存120首歌曲

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
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  watch(
    songCache,
    () => {
      if (saveTimer !== null) {
        clearTimeout(saveTimer);
      }
      saveTimer = setTimeout(() => {
        saveCache();
        saveTimer = null;
      }, 1100);
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
    } else {
      // 如果 songDetail 为 undefined，删除缓存
      if (songCache.value.has(songId)) {
        songCache.value.delete(songId);
        console.log(`删除失效的缓存: ${songId}`);
      }
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

  // 获取缓存大小（歌曲数量）
  const getCacheSize = (): number => {
    return songCache.value.size;
  };

  // 获取缓存信息（包括字节大小）
  const getCacheInfo = (): { count: number; bytes: number } => {
    const count = songCache.value.size;
    if (count === 0) {
      return { count: 0, bytes: 0 };
    }

    // 计算实际的localStorage存储大小
    try {
      // 直接从localStorage读取，这样能获取真实的存储大小
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        // 使用字符串长度 * 2（因为JavaScript字符串是UTF-16编码）
        const bytes = new Blob([stored]).size;
        return { count, bytes };
      }
      return { count, bytes: 0 };
    } catch (error) {
      console.error("计算缓存大小失败:", error);
      return { count, bytes: 0 };
    }
  };

  // 获取所有localStorage的总大小
  const getTotalStorageSize = (): number => {
    try {
      let totalBytes = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          const value = localStorage.getItem(key);
          if (value) {
            // 计算key和value的大小
            totalBytes += new Blob([key]).size;
            totalBytes += new Blob([value]).size;
          }
        }
      }
      return totalBytes;
    } catch (error) {
      console.error("计算总存储大小失败:", error);
      return 0;
    }
  };

  return {
    getCachedSong,
    setCachedSong,
    hasCachedSong,
    clearCache,
    getCacheSize,
    getCacheInfo,
    getTotalStorageSize,
  };
});
