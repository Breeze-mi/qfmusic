import { defineStore } from "pinia";
import { ref, watch, nextTick } from "vue";
import type { Song } from "@/api/music";
import { persist } from "@/utils/persist";
import { tabSync } from "@/utils/sync";

// 歌单类型
export interface CustomPlaylist {
  id: string;
  name: string;
  description: string;
  coverUrl: string;
  songs: Song[];
  createdAt: number;
  updatedAt: number;
}

// 内置歌单ID
export const BUILTIN_PLAYLISTS = {
  HISTORY: "builtin-history", // 试听列表
  FAVORITE: "builtin-favorite", // 我喜欢
};

const STORAGE_KEY = "music-playlists";

export const usePlaylistStore = defineStore("playlist", () => {
  // 从 localStorage 加载保存的状态
  let savedState;
  try {
    savedState = persist.load(STORAGE_KEY, {
      playlists: [],
      historyList: [],
      favoriteList: [],
    });
  } catch (error) {
    console.error("加载歌单数据失败:", error);
    savedState = {
      playlists: [],
      historyList: [],
      favoriteList: [],
    };
  }

  // 自定义歌单列表
  const playlists = ref<CustomPlaylist[]>(savedState.playlists);
  // 试听列表（最近播放）
  const historyList = ref<Song[]>(savedState.historyList);
  // 我喜欢/收藏列表
  const favoriteList = ref<Song[]>(savedState.favoriteList);

  // 标志：是否正在从其他标签页同步数据（避免循环广播）
  let isSyncing = false;

  // 防抖保存函数：避免频繁写入 localStorage
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  const debouncedSave = () => {
    if (saveTimer) {
      clearTimeout(saveTimer);
    }
    saveTimer = setTimeout(() => {
      try {
        const state = {
          playlists: playlists.value,
          historyList: historyList.value,
          favoriteList: favoriteList.value,
        };
        persist.save(STORAGE_KEY, state);
        // 广播到其他标签页
        tabSync.broadcast("playlist", state);
      } catch (error) {
        console.error("保存歌单数据失败:", error);
      }
    }, 500); // 500ms 防抖延迟
  };

  // 监听状态变化，自动保存并同步到其他标签页
  watch(
    [playlists, historyList, favoriteList],
    () => {
      // 如果正在同步，跳过广播
      if (isSyncing) return;

      // 使用防抖保存，避免频繁操作时多次写入
      debouncedSave();
    },
    { deep: true }
  );

  // 订阅其他标签页的更新
  tabSync.subscribe("playlist", (data) => {
    // 设置同步标志，避免触发 watch 导致循环广播
    isSyncing = true;

    // 更新本地状态
    playlists.value = data.playlists || [];
    historyList.value = data.historyList || [];
    favoriteList.value = data.favoriteList || [];

    // 使用 nextTick 确保在下一个 tick 重置同步标志
    nextTick(() => {
      isSyncing = false;
    });
  });

  // ========== 试听列表（历史记录）==========
  // 添加到试听列表
  const addToHistory = (song: Song) => {
    // 移除已存在的相同歌曲
    const index = historyList.value.findIndex((s) => s.id === song.id);
    if (index !== -1) {
      historyList.value.splice(index, 1);
    }
    // // 限制列表长度为100首
    // if (historyList.value.length > 100) {
    //   historyList.value = historyList.value.slice(0, 100);
    // }
    // 添加到列表开头
    historyList.value.unshift(song);
    // 不限制列表长度，保存所有听过的歌曲
  };

  // 清空试听列表
  const clearHistory = () => {
    historyList.value = [];
  };

  // 从试听列表删除
  const removeFromHistory = (songId: string) => {
    const index = historyList.value.findIndex((s) => s.id === songId);
    if (index !== -1) {
      historyList.value.splice(index, 1);
    }
  };

  // ========== 我喜欢/收藏列表 ==========
  // 添加到收藏
  const addToFavorite = (song: Song) => {
    const exists = favoriteList.value.some((s) => s.id === song.id);
    if (!exists) {
      favoriteList.value.unshift(song);
      return true;
    }
    return false;
  };

  // 从收藏删除
  const removeFromFavorite = (songId: string) => {
    const index = favoriteList.value.findIndex((s) => s.id === songId);
    if (index !== -1) {
      favoriteList.value.splice(index, 1);
      return true;
    }
    return false;
  };

  // 检查是否已收藏
  const isFavorite = (songId: string) => {
    return favoriteList.value.some((s) => s.id === songId);
  };

  // 切换收藏状态
  const toggleFavorite = (song: Song) => {
    if (isFavorite(song.id)) {
      removeFromFavorite(song.id);
      return false;
    } else {
      addToFavorite(song);
      return true;
    }
  };

  // ========== 自定义歌单 ==========
  // 创建歌单
  const createPlaylist = (name: string, description: string = "") => {
    const newPlaylist: CustomPlaylist = {
      id: `playlist-${Date.now()}`,
      name,
      description,
      coverUrl: "",
      songs: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    playlists.value.push(newPlaylist);
    return newPlaylist;
  };

  // 删除歌单
  const deletePlaylist = (playlistId: string) => {
    const index = playlists.value.findIndex((p) => p.id === playlistId);
    if (index !== -1) {
      playlists.value.splice(index, 1);
      return true;
    }
    return false;
  };

  // 更新歌单信息
  const updatePlaylist = (
    playlistId: string,
    updates: Partial<Pick<CustomPlaylist, "name" | "description" | "coverUrl">>
  ) => {
    const playlist = playlists.value.find((p) => p.id === playlistId);
    if (playlist) {
      Object.assign(playlist, updates);
      playlist.updatedAt = Date.now();
      return true;
    }
    return false;
  };

  // 添加歌曲到歌单
  const addSongToPlaylist = (playlistId: string, song: Song) => {
    const playlist = playlists.value.find((p) => p.id === playlistId);
    if (playlist) {
      const exists = playlist.songs.some((s) => s.id === song.id);
      if (!exists) {
        playlist.songs.push(song);
        playlist.updatedAt = Date.now();
        return true;
      }
    }
    return false;
  };

  // 从歌单删除歌曲
  const removeSongFromPlaylist = (playlistId: string, songId: string) => {
    const playlist = playlists.value.find((p) => p.id === playlistId);
    if (playlist) {
      const index = playlist.songs.findIndex((s) => s.id === songId);
      if (index !== -1) {
        playlist.songs.splice(index, 1);
        playlist.updatedAt = Date.now();
        return true;
      }
    }
    return false;
  };

  // 调整歌单中歌曲的顺序
  const reorderSongsInPlaylist = (
    playlistId: string,
    fromIndex: number,
    toIndex: number
  ) => {
    const playlist = playlists.value.find((p) => p.id === playlistId);
    if (
      playlist &&
      fromIndex >= 0 &&
      fromIndex < playlist.songs.length &&
      toIndex >= 0 &&
      toIndex < playlist.songs.length
    ) {
      const [movedSong] = playlist.songs.splice(fromIndex, 1);
      playlist.songs.splice(toIndex, 0, movedSong);
      playlist.updatedAt = Date.now();
      return true;
    }
    return false;
  };

  // 调整收藏列表中歌曲的顺序
  const reorderFavoriteSongs = (fromIndex: number, toIndex: number) => {
    if (
      fromIndex >= 0 &&
      fromIndex < favoriteList.value.length &&
      toIndex >= 0 &&
      toIndex < favoriteList.value.length
    ) {
      const [movedSong] = favoriteList.value.splice(fromIndex, 1);
      favoriteList.value.splice(toIndex, 0, movedSong);
      return true;
    }
    return false;
  };

  // 获取歌单
  const getPlaylist = (playlistId: string) => {
    return playlists.value.find((p) => p.id === playlistId);
  };

  return {
    // state
    playlists,
    historyList,
    favoriteList,
    // actions - 试听列表
    addToHistory,
    clearHistory,
    removeFromHistory,
    // actions - 收藏列表
    addToFavorite,
    removeFromFavorite,
    isFavorite,
    toggleFavorite,
    reorderFavoriteSongs,
    // actions - 自定义歌单
    createPlaylist,
    deletePlaylist,
    updatePlaylist,
    addSongToPlaylist,
    removeSongFromPlaylist,
    reorderSongsInPlaylist,
    getPlaylist,
  };
});
