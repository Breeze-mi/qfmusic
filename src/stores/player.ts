import { defineStore } from "pinia";
import { ref, computed, watch, nextTick } from "vue";
import type { Song, SongDetail } from "@/api/music";
import { persist } from "@/utils/persist";
import { tabSync } from "@/utils/sync";

// 播放模式
export enum PlayMode {
  SEQUENCE = "sequence", // 顺序播放
  RANDOM = "random", // 随机播放
  LOOP = "loop", // 单曲循环
}

const STORAGE_KEY = "music-player-state";

export const usePlayerStore = defineStore("player", () => {
  // 从 localStorage 加载保存的状态
  const savedState = persist.load(STORAGE_KEY, {
    playlist: [],
    currentIndex: -1,
    playMode: PlayMode.SEQUENCE,
    volume: 0.7,
    savedProgress: {}, // 保存每首歌的播放进度 { songId: currentTime }
  });

  // 播放列表
  const playlist = ref<Song[]>(savedState.playlist);
  // 当前播放索引
  const currentIndex = ref(savedState.currentIndex);
  // 是否正在播放（刷新后不自动播放）
  const isPlaying = ref(false);
  // 播放模式
  const playMode = ref<PlayMode>(savedState.playMode);
  // 当前歌曲详情
  const currentSongDetail = ref<SongDetail | null>(null);
  // 音量 (0-1)
  const volume = ref(savedState.volume);
  // 当前播放时间
  const currentTime = ref(0);
  // 歌曲总时长
  const duration = ref(0);
  // 保存的播放进度
  const savedProgress = ref<Record<string, number>>(
    savedState.savedProgress || {}
  );
  // 是否显示播放列表
  const showPlaylist = ref(false);
  // 是否显示歌曲详情页
  const showDetail = ref(false);
  // 强制重新加载的时间戳（用于同一首歌重新播放）
  const reloadTimestamp = ref(0);

  // 标志：是否正在从其他标签页同步数据（避免循环广播）
  let isSyncing = false;

  // 监听状态变化，自动保存并同步到其他标签页
  // 注意：不同步 isPlaying 和 currentTime，因为每个标签页应该独立控制播放
  watch(
    [playlist, currentIndex, playMode, volume, savedProgress],
    () => {
      // 如果正在同步，跳过广播
      if (isSyncing) return;

      const state = {
        playlist: playlist.value,
        currentIndex: currentIndex.value,
        playMode: playMode.value,
        volume: volume.value,
        savedProgress: savedProgress.value,
      };
      persist.save(STORAGE_KEY, state);

      // 广播到其他标签页
      tabSync.broadcast("player", state);
    },
    { deep: true }
  );

  // 订阅其他标签页的更新
  tabSync.subscribe("player", (data) => {
    // 设置同步标志，避免触发 watch 导致循环广播
    isSyncing = true;

    // 更新本地状态
    playlist.value = data.playlist || [];
    currentIndex.value = data.currentIndex ?? -1;
    playMode.value = data.playMode || PlayMode.SEQUENCE;
    volume.value = data.volume ?? 0.7;
    savedProgress.value = data.savedProgress || {};

    // ✅ 更新 currentSong
    if (currentIndex.value >= 0 && currentIndex.value < playlist.value.length) {
      currentSong.value = playlist.value[currentIndex.value];
    } else {
      currentSong.value = null;
    }

    // 使用 nextTick 确保在下一个 tick 重置同步标志
    nextTick(() => {
      isSyncing = false;
    });
  });

  // 当前播放歌曲（直接存储，避免 computed 的多次触发）
  const currentSong = ref<Song | null>(
    currentIndex.value >= 0 && currentIndex.value < savedState.playlist.length
      ? savedState.playlist[currentIndex.value]
      : null
  );

  // 播放进度 (0-100)
  const progress = computed(() => {
    if (duration.value === 0) return 0;
    return (currentTime.value / duration.value) * 100;
  });

  // 添加歌曲到播放列表（不播放）
  const addToPlaylist = (song: Song) => {
    const index = playlist.value.findIndex((s) => s.id === song.id);
    if (index === -1) {
      playlist.value.push(song);
      console.log(
        `添加歌曲到播放列表: ${song.name}, 当前列表长度: ${playlist.value.length}`
      );
      return true;
    } else {
      console.log(`歌曲已在播放列表中: ${song.name}`);
      return false;
    }
  };

  // 播放指定歌曲
  const playSong = (song: Song) => {
    // 重置 API 健康检查状态（可选功能，已禁用）
    // if (typeof window !== "undefined") {
    //   import("@/utils/request").then(({ resetAPIHealthStatus }) => {
    //     resetAPIHealthStatus();
    //   });
    // }

    const index = playlist.value.findIndex((s) => s.id === song.id);
    if (index === -1) {
      // 歌曲不在播放列表中，添加到列表末尾
      const newIndex = playlist.value.length;
      playlist.value.push(song);
      currentIndex.value = newIndex;
      // ✅ 直接设置 currentSong，避免 computed 的多次触发
      currentSong.value = song;
      // ✅ 如果是添加到空列表，强制重新加载（解决清空后再播放同一首歌的问题）
      if (newIndex === 0) {
        reloadTimestamp.value = Date.now();
      }
      console.log(
        `添加歌曲到播放列表: ${song.name}, 当前列表长度: ${playlist.value.length}, 索引: ${newIndex}`
      );
    } else {
      // 歌曲已在播放列表中
      // 如果是当前正在播放的歌曲，重置播放进度（从头开始播放）
      if (index === currentIndex.value && currentSong.value?.id === song.id) {
        reloadTimestamp.value = Date.now();
        console.log(`重新播放当前歌曲: ${song.name}`);
      } else {
        // 切换到该歌曲
        currentIndex.value = index;
        // ✅ 直接设置 currentSong，避免 computed 的多次触发
        currentSong.value = song;
        console.log(`切换到播放列表中的歌曲: ${song.name}, 索引: ${index}`);
      }
    }
    isPlaying.value = true;
  };

  // 播放/暂停
  const togglePlay = () => {
    // 重置 API 健康检查状态（可选功能，已禁用）
    // if (typeof window !== "undefined") {
    //   import("@/utils/request").then(({ resetAPIHealthStatus }) => {
    //     resetAPIHealthStatus();
    //   });
    // }
    isPlaying.value = !isPlaying.value;
  };

  // 获取随机索引（避免重复）
  const getRandomIndex = (): number => {
    if (playlist.value.length === 1) {
      return 0;
    }
    let newIndex: number;
    do {
      newIndex = Math.floor(Math.random() * playlist.value.length);
    } while (newIndex === currentIndex.value);
    return newIndex;
  };

  // 切换到指定索引的歌曲
  const switchToIndex = (newIndex: number) => {
    const oldIndex = currentIndex.value;
    currentIndex.value = newIndex;
    currentSong.value = playlist.value[newIndex];

    // 如果索引没变（只有一首歌的情况），更新时间戳强制重新加载
    if (newIndex === oldIndex) {
      reloadTimestamp.value = Date.now();
    }

    isPlaying.value = true;
  };

  // 上一首
  const playPrev = () => {
    if (playlist.value.length === 0) return;

    // 重置 API 健康检查状态（可选功能，已禁用）
    // if (typeof window !== "undefined") {
    //   import("@/utils/request").then(({ resetAPIHealthStatus }) => {
    //     resetAPIHealthStatus();
    //   });
    // }

    let newIndex: number;
    if (playMode.value === PlayMode.RANDOM) {
      newIndex = getRandomIndex();
    } else {
      newIndex =
        currentIndex.value <= 0
          ? playlist.value.length - 1
          : currentIndex.value - 1;
    }

    switchToIndex(newIndex);
    console.log(
      `playPrev: 切换到索引 ${newIndex}, 歌曲: ${currentSong.value?.name}`
    );
  };

  // 下一首
  const playNext = () => {
    if (playlist.value.length === 0) return;

    // 重置 API 健康检查状态（可选功能，已禁用）
    // if (typeof window !== "undefined") {
    //   import("@/utils/request").then(({ resetAPIHealthStatus }) => {
    //     resetAPIHealthStatus();
    //   });
    // }

    let newIndex: number;
    if (playMode.value === PlayMode.RANDOM) {
      newIndex = getRandomIndex();
    } else {
      newIndex =
        currentIndex.value >= playlist.value.length - 1
          ? 0
          : currentIndex.value + 1;
    }

    switchToIndex(newIndex);
    console.log(
      `playNext: 切换到索引 ${newIndex}, 歌曲: ${currentSong.value?.name}`
    );
  };

  // 切换播放模式
  const togglePlayMode = () => {
    const modes = [PlayMode.SEQUENCE, PlayMode.RANDOM, PlayMode.LOOP];
    const currentModeIndex = modes.indexOf(playMode.value);
    playMode.value = modes[(currentModeIndex + 1) % modes.length];
  };

  // 从播放列表删除歌曲
  const removeFromPlaylist = (index: number) => {
    // 如果删除的是当前播放的歌曲
    if (index === currentIndex.value) {
      // 如果列表只有一首歌，清空状态并停止播放
      if (playlist.value.length === 1) {
        playlist.value = [];
        currentIndex.value = -1;
        currentSong.value = null;
        isPlaying.value = false;
        currentSongDetail.value = null;
        currentTime.value = 0;
        duration.value = 0;
        return;
      }

      // 先删除歌曲
      playlist.value.splice(index, 1);

      // 计算新的索引：如果删除的是最后一首，回到第一首；否则保持当前索引
      const newIndex = index >= playlist.value.length ? 0 : index;

      // 切换到新歌曲并继续播放
      currentIndex.value = newIndex;
      currentSong.value = playlist.value[newIndex];
      reloadTimestamp.value = Date.now();
      isPlaying.value = true;
    } else {
      // 如果删除的歌曲在当前播放歌曲之前，索引需要减1
      if (index < currentIndex.value) {
        currentIndex.value--;
      }
      playlist.value.splice(index, 1);
    }
  };

  // 清空播放列表
  const clearPlaylist = () => {
    playlist.value = [];
    currentIndex.value = -1;
    currentSong.value = null;
    isPlaying.value = false;
    currentSongDetail.value = null;
    savedProgress.value = {};
    currentTime.value = 0;
    duration.value = 0;
  };

  // 设置当前歌曲详情
  const setCurrentSongDetail = (detail: SongDetail) => {
    currentSongDetail.value = detail;
  };

  // 设置音量
  const setVolume = (val: number) => {
    volume.value = Math.max(0, Math.min(1, val));
  };

  // 设置当前播放时间
  const setCurrentTime = (time: number) => {
    currentTime.value = time;

    // 保存当前歌曲的播放进度（每2秒保存一次）
    if (currentSong.value && time > 0 && Math.floor(time) % 2 === 0) {
      savedProgress.value[currentSong.value.id] = time;
    }
  };

  // 设置歌曲总时长
  const setDuration = (time: number) => {
    duration.value = time;
  };

  // 获取歌曲的保存进度
  const getSavedProgress = (songId: string): number => {
    return savedProgress.value[songId] || 0;
  };

  // 清除歌曲的保存进度
  const clearSavedProgress = (songId: string) => {
    delete savedProgress.value[songId];
  };

  // 切换播放列表显示
  const togglePlaylist = () => {
    showPlaylist.value = !showPlaylist.value;
  };

  // 切换详情页显示
  const toggleDetail = () => {
    showDetail.value = !showDetail.value;
  };

  return {
    // state
    playlist,
    currentIndex,
    isPlaying,
    playMode,
    currentSongDetail,
    volume,
    currentTime,
    duration,
    showPlaylist,
    showDetail,
    reloadTimestamp,
    // computed
    currentSong,
    progress,
    // actions
    addToPlaylist,
    playSong,
    togglePlay,
    playPrev,
    playNext,
    switchToIndex,
    togglePlayMode,
    removeFromPlaylist,
    clearPlaylist,
    setCurrentSongDetail,
    setVolume,
    setCurrentTime,
    setDuration,
    getSavedProgress,
    clearSavedProgress,
    togglePlaylist,
    toggleDetail,
  };
});
