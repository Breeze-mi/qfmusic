import { defineStore } from "pinia";
import { ref, computed, watch } from "vue";
import type { Song, SongDetail } from "@/api/music";
import { persist } from "@/utils/persist";

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

  // 监听状态变化，自动保存
  watch(
    [playlist, currentIndex, playMode, volume, savedProgress],
    () => {
      persist.save(STORAGE_KEY, {
        playlist: playlist.value,
        currentIndex: currentIndex.value,
        playMode: playMode.value,
        volume: volume.value,
        savedProgress: savedProgress.value,
      });
    },
    { deep: true }
  );

  // 当前播放歌曲
  const currentSong = computed(() => {
    if (currentIndex.value >= 0 && currentIndex.value < playlist.value.length) {
      return playlist.value[currentIndex.value];
    }
    return null;
  });

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
    const index = playlist.value.findIndex((s) => s.id === song.id);
    if (index === -1) {
      // 歌曲不在播放列表中，添加到列表末尾
      playlist.value.push(song);
      currentIndex.value = playlist.value.length - 1;
      console.log(
        `添加歌曲到播放列表: ${song.name}, 当前列表长度: ${playlist.value.length}`
      );
    } else {
      // 歌曲已在播放列表中，直接切换到该歌曲
      currentIndex.value = index;
      console.log(`切换到播放列表中的歌曲: ${song.name}, 索引: ${index}`);
    }
    isPlaying.value = true;
  };

  // 播放/暂停
  const togglePlay = () => {
    isPlaying.value = !isPlaying.value;
  };

  // 上一首
  const playPrev = () => {
    if (playlist.value.length === 0) return;

    if (playMode.value === PlayMode.RANDOM) {
      currentIndex.value = Math.floor(Math.random() * playlist.value.length);
    } else {
      currentIndex.value =
        currentIndex.value <= 0
          ? playlist.value.length - 1
          : currentIndex.value - 1;
    }
    isPlaying.value = true;
  };

  // 下一首
  const playNext = () => {
    if (playlist.value.length === 0) return;

    if (playMode.value === PlayMode.LOOP) {
      // 单曲循环，重置播放时间即可，不需要重新加载
      currentTime.value = 0;
      isPlaying.value = true;
      return;
    }

    if (playMode.value === PlayMode.RANDOM) {
      currentIndex.value = Math.floor(Math.random() * playlist.value.length);
    } else {
      currentIndex.value =
        currentIndex.value >= playlist.value.length - 1
          ? 0
          : currentIndex.value + 1;
    }
    isPlaying.value = true;
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
      // 如果列表只有一首歌，清空状态
      if (playlist.value.length === 1) {
        playlist.value = [];
        currentIndex.value = -1;
        isPlaying.value = false;
        currentSongDetail.value = null;
        return;
      }
      // 如果删除的是最后一首，播放第一首
      if (index === playlist.value.length - 1) {
        currentIndex.value = 0;
      }
      // 否则保持当前索引，会自动播放下一首
    } else if (index < currentIndex.value) {
      // 如果删除的歌曲在当前播放歌曲之前，索引需要减1
      currentIndex.value--;
    }
    playlist.value.splice(index, 1);
  };

  // 清空播放列表
  const clearPlaylist = () => {
    playlist.value = [];
    currentIndex.value = -1;
    isPlaying.value = false;
    currentSongDetail.value = null;
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

    // 保存当前歌曲的播放进度（每3秒保存一次，避免频繁写入）
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
    // computed
    currentSong,
    progress,
    // actions
    addToPlaylist,
    playSong,
    togglePlay,
    playPrev,
    playNext,
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
