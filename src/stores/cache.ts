import { defineStore } from "pinia";
import { ref } from "vue";
import type { SongDetail } from "@/api/music";

export const useCacheStore = defineStore("cache", () => {
  // 歌曲详情缓存 Map<songId, SongDetail>
  const songCache = ref<Map<string, SongDetail>>(new Map());

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
