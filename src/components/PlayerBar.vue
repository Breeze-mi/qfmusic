<template>
    <div class="player-bar">
        <!-- 左侧：歌曲信息 -->
        <div class="song-info" @click="goToDetail">
            <!-- 封面区域：始终显示，确保可点击 -->
            <div class="song-cover-wrapper" :key="playerStore.currentSong?.id || 'no-song'">
                <img v-if="playerStore.currentSong?.picUrl" :src="playerStore.currentSong.picUrl"
                    :alt="playerStore.currentSong.name" class="song-cover" loading="eager" @error="handleImageError" />
                <div v-else class="song-cover-placeholder">🎵</div>
            </div>
            <!-- 歌曲详情：有歌曲时显示 -->
            <div v-if="playerStore.currentSong" class="song-details" :key="playerStore.currentSong.id">
                <div class="song-name">{{ playerStore.currentSong.name }}</div>
                <div class="song-artist">{{ playerStore.currentSong.artists }}</div>
            </div>
            <!-- 无歌曲时的占位文本 -->
            <div v-else class="song-details">
                <div class="song-name">暂无播放</div>
                <div class="song-artist">点击搜索歌曲</div>
            </div>
        </div>

        <!-- 中间：播放控制 -->
        <div class="player-controls">
            <div class="control-buttons">
                <el-button circle :icon="playModeIcon" @click="playerStore.togglePlayMode" :title="playModeText" />
                <el-button circle :icon="DArrowLeft" @click="playerStore.playPrev" />
                <el-button circle size="large" type="primary" :icon="playerStore.isPlaying ? PauseIcon : PlayIcon"
                    @click="handleTogglePlay" :class="{ 'is-playing': playerStore.isPlaying }" />
                <el-button circle :icon="DArrowRight" @click="playerStore.playNext" />
            </div>
            <div class="progress-bar">
                <span class="time">{{ formatTime(isDragging ? draggingTime : playerStore.currentTime) }}</span>
                <el-slider v-model="progressValue" :show-tooltip="false" @change="handleProgressChange"
                    @input="handleProgressInput" class="progress-slider" />
                <span class="time">{{ formatTime(playerStore.duration) }}</span>
            </div>
            <div class="volume-control">
                <el-button circle :icon="volumeIcon" @click="toggleMute" />
                <el-slider v-model="volumeValue" :show-tooltip="false" @input="handleVolumeChange" />
                <el-button circle :icon="isFavorite ? StarFilledIcon : StarIcon" @click="toggleFavorite"
                    :title="isFavorite ? '取消收藏' : '收藏'" :type="isFavorite ? 'danger' : 'default'"
                    :disabled="!playerStore.currentSong" class="favorite-button" />
            </div>
        </div>

        <!-- 右侧：播放列表 -->
        <div class="player-actions">
            <el-button :icon="MenuIcon" @click="playerStore.togglePlaylist" class="playlist-button" />
        </div>

        <!-- 音频元素 -->
        <audio ref="audioRef" @timeupdate="handleTimeUpdate" @loadedmetadata="handleLoadedMetadata" @ended="handleEnded"
            @pause="handlePause" @play="handlePlay" @playing="handlePlaying" @error="handleError"
            @waiting="handleWaiting" @stalled="handleStalled" @canplay="handleCanPlay" @canplaythrough="handleCanPlay"
            preload="metadata" />
    </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import {
    DArrowLeft,
    DArrowRight,
    Sort,
    Star,
    StarFilled,
} from "@element-plus/icons-vue";
import { usePlayerStore, PlayMode } from "@/stores/player";
import { useCacheStore } from "@/stores/cache";
import { useSettingsStore } from "@/stores/settings";
import { useThemeStore } from "@/stores/theme";
import { usePlaylistStore } from "@/stores/playlist";
import { useLocalMusicStore } from "@/stores/localMusic";
import { useAudioCacheStore } from "@/stores/audioCache";
import MusicApi from "@/api/music";
import type { SongDetail } from "@/api/music";
import { ElMessage } from "element-plus";

// 导入自定义 SVG 图标
import PlayIcon from "@/assets/icons/play.svg";
import PauseIcon from "@/assets/icons/pause.svg";
import MenuIcon from "@/assets/icons/menu.svg";
import LoopIcon from "@/assets/icons/loop.svg";
import VolumeOnLightIcon from "@/assets/icons/volume-on-light.svg";
import VolumeOffLightIcon from "@/assets/icons/volume-off-light.svg";
import RandomLightIcon from "@/assets/icons/random-light.svg";
import VolumeOnDarkIcon from "@/assets/icons/volume-on-dark.svg";
import VolumeOffDarkIcon from "@/assets/icons/volume-off-dark.svg";
import RandomDarkIcon from "@/assets/icons/random-dark.svg";
import LoopDarkIcon from "@/assets/icons/loop-dark.svg";

const router = useRouter();
const playerStore = usePlayerStore();
const cacheStore = useCacheStore();
const settingsStore = useSettingsStore();
const themeStore = useThemeStore();

// 初始化所有 stores
const playlistStore = usePlaylistStore();
const localMusicStore = useLocalMusicStore();
const audioCacheStore = useAudioCacheStore();

const audioRef = ref<HTMLAudioElement>();

// 当前使用的 Blob URL（用于释放内存）
const currentBlobUrl = ref<string | null>(null);

// 后台缓存的定时器 ID
const cacheTimerId = ref<number | null>(null);

// 释放 Blob URL，防止内存泄漏
const revokeBlobUrl = () => {
    if (currentBlobUrl.value && currentBlobUrl.value.startsWith('blob:')) {
        URL.revokeObjectURL(currentBlobUrl.value);
        // console.log('🗑️ 释放 Blob URL，防止内存泄漏');
        currentBlobUrl.value = null;
    }
};

// 清除后台缓存定时器
const clearCacheTimer = () => {
    if (cacheTimerId.value !== null) {
        clearTimeout(cacheTimerId.value);
        cacheTimerId.value = null;
        // console.log('⏹️ 清除后台缓存定时器');
    }
};

// 跳转到详情页或返回
const goToDetail = () => {
    // 如果当前在详情页，则返回
    if (router.currentRoute.value.path === "/song-detail") {
        router.back();
    } else {
        // 否则跳转到详情页（即使没有歌曲也可以跳转）
        router.push("/song-detail");
    }
};

// 处理图片加载错误
const handleImageError = (e: Event) => {
    const target = e.target as HTMLImageElement;
    // 隐藏图片，显示占位符
    target.style.display = 'none';
};

const progressValue = ref(0);
const volumeValue = ref(playerStore.volume * 100);
const isMuted = ref(false);

// 用于防止重复恢复播放
const isRecovering = ref(false);
// 用于标记用户主动操作
const userAction = ref(false);
// 是否正在拖动进度条
const isDragging = ref(false);
// 拖动时的预览时间
const draggingTime = ref(0);

// 播放模式图标（根据主题切换）
const playModeIcon = computed(() => {
    const isDark = themeStore.isDark;
    switch (playerStore.playMode) {
        case PlayMode.SEQUENCE:
            return Sort;
        case PlayMode.RANDOM:
            return isDark ? RandomDarkIcon : RandomLightIcon;
        case PlayMode.LOOP:
            return isDark ? LoopDarkIcon : LoopIcon;
        default:
            return Sort;
    }
});

// 播放模式文本
const playModeText = computed(() => {
    switch (playerStore.playMode) {
        case PlayMode.SEQUENCE:
            return "顺序播放";
        case PlayMode.RANDOM:
            return "随机播放";
        case PlayMode.LOOP:
            return "单曲循环";
        default:
            return "顺序播放";
    }
});

// 收藏相关
const StarIcon = Star;
const StarFilledIcon = StarFilled;

// 判断当前歌曲是否已收藏
const isFavorite = computed(() => {
    if (!playerStore.currentSong) return false;
    return playlistStore.isFavorite(playerStore.currentSong.id);
});

// 切换收藏状态
const toggleFavorite = () => {
    if (!playerStore.currentSong) return;

    const isFav = playlistStore.toggleFavorite(playerStore.currentSong);
    ElMessage.success(isFav ? "已添加到我喜欢" : "已取消收藏");
};

// 音量图标（根据主题切换）
const volumeIcon = computed(() => {
    const isDark = themeStore.isDark;
    const isSilent = isMuted.value || volumeValue.value === 0;

    if (isDark) {
        return isSilent ? VolumeOffDarkIcon : VolumeOnDarkIcon;
    } else {
        return isSilent ? VolumeOffLightIcon : VolumeOnLightIcon;
    }
});

// 格式化时间
const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
};

// 音质降级配置
const QUALITY_LEVELS = [
    "jymaster",   // 超清母带
    "sky",        // 沉浸环绕声
    "jyeffect",   // 高清环绕声
    "hires",      // Hi-Res音质
    "lossless",   // 无损音质
    "exhigh",     // 极高音质
    "standard"    // 标准音质
];

const QUALITY_NAMES: Record<string, string> = {
    jymaster: "超清母带",
    sky: "沉浸环绕声",
    jyeffect: "高清环绕声",
    hires: "Hi-Res",
    lossless: "无损",
    exhigh: "极高",
    standard: "标准"
};

// 获取歌曲URL（带音质降级）
const fetchSongWithQualityFallback = async (songId: string): Promise<SongDetail | null> => {
    let currentQualityIndex = QUALITY_LEVELS.indexOf(settingsStore.quality);
    if (currentQualityIndex === -1) {
        currentQualityIndex = QUALITY_LEVELS.indexOf("lossless");
    }

    while (currentQualityIndex < QUALITY_LEVELS.length) {
        try {
            const data = await MusicApi.getSong(songId, QUALITY_LEVELS[currentQualityIndex]);
            if (data.success && data.data?.url) {
                const songDetail = data.data;

                // 如果降级了，提示用户
                if (currentQualityIndex > QUALITY_LEVELS.indexOf(settingsStore.quality)) {
                    const originalQuality = settingsStore.quality;
                    const currentQuality = QUALITY_LEVELS[currentQualityIndex];
                    ElMessage.warning(
                        `${QUALITY_NAMES[originalQuality]}音质不可用，已降级到${QUALITY_NAMES[currentQuality]}音质`
                    );
                }

                return songDetail;
            }
        } catch (err: any) {
            // 如果是服务器不可用的错误，直接退出循环
            if (err?.message?.includes("服务器连接失败")) {
                console.error("服务器错误，无法加载歌曲");
                break;
            }
            console.error(`获取${QUALITY_NAMES[QUALITY_LEVELS[currentQualityIndex]]}音质失败:`, err);
        }

        currentQualityIndex++;
    }

    return null;
};

// 缓存失效后重新加载歌曲的公共函数
const reloadSongAfterCacheExpired = async (songId: string, songName: string): Promise<SongDetail | null> => {
    console.log(`缓存的URL可能已失效，重新请求: ${songName}`);

    // 清除失效的缓存
    cacheStore.setCachedSong(songId, undefined);

    // 直接重新获取歌曲，不检查健康度
    // 让业务请求自己判断成功或失败
    const newSongDetail = await fetchSongWithQualityFallback(songId);

    if (newSongDetail) {
        // 更新缓存
        cacheStore.setCachedSong(songId, newSongDetail);
        playerStore.setCurrentSongDetail(newSongDetail);
        ElMessage.success("已重新加载歌曲");
        return newSongDetail;
    } else {
        ElMessage.error("重新加载失败，歌曲不可用");
        return null;
    }
};

// 清空音频源的公共函数
const clearAudioSource = () => {
    if (audioRef.value) {
        audioRef.value.pause();
        audioRef.value.src = '';
        audioRef.value.load();
    }
};

// 统一的错误处理函数
const handleSongLoadError = (message: string, clearSource: boolean = true) => {
    playerStore.isPlaying = false;
    ElMessage.error(message);
    if (clearSource) {
        clearAudioSource();
    }
};



// 记录当前加载的歌曲ID，防止重复加载
let currentLoadingSongId = ref<string | null>(null);

// 正在重试的歌曲集合，防止并发重试
const retryingSet = ref<Set<string>>(new Set());

// 记录上次的 reloadTimestamp
const lastReloadTimestamp = ref(0);

// 监听当前歌曲变化，加载音频
watch(
    [() => playerStore.currentSong, () => playerStore.reloadTimestamp],
    async ([newSong], [oldSong]) => {
        if (newSong && audioRef.value) {
            const timestampChanged = playerStore.reloadTimestamp !== lastReloadTimestamp.value && playerStore.reloadTimestamp > 0;
            lastReloadTimestamp.value = playerStore.reloadTimestamp;

            // 防止重复加载同一首歌（除非 reloadTimestamp 变化了）
            if (newSong.id === currentLoadingSongId.value && !timestampChanged) {
                return;
            }

            // 如果是同一首歌（ID相同）且 reloadTimestamp 没变化，不需要重新加载
            if (oldSong && newSong.id === oldSong.id && !timestampChanged) {
                return;
            }

            // ✅ 立即设置 currentLoadingSongId，防止重复触发
            currentLoadingSongId.value = newSong.id;
            const wasPlaying = playerStore.isPlaying;

            // ✅ 关键修复：立即停止播放，防止残留音频
            // 不使用异步淡出，直接暂停以避免残留音频
            if (oldSong && !audioRef.value.paused) {
                // 立即将音量设为 0，避免爆音
                audioRef.value.volume = 0;
            }

            // 立即暂停播放
            audioRef.value.pause();
            audioRef.value.currentTime = 0;

            // ✅ 立即设置一个空的 data URL，彻底停止旧音频的加载和缓冲
            // 使用极小的静音音频 data URL，避免触发错误事件
            audioRef.value.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';

            // ✅ 释放旧的 Blob URL（如果有）
            revokeBlobUrl();

            // ✅ 清除后台缓存定时器
            clearCacheTimer();

            // ✅ 中止所有正在进行的后台下载，避免抢占带宽
            if (audioCacheStore) {
                audioCacheStore.abortAllDownloads();
            }

            // ✅ 恢复音量
            audioRef.value.volume = playerStore.volume;

            // 异步添加到试听列表，不阻塞切歌流程
            Promise.resolve().then(() => {
                try {
                    playlistStore?.addToHistory(newSong);
                } catch (error) {
                    console.error("添加到试听列表失败:", error);
                }
            });

            try {
                // 检查是否为本地音乐
                if (localMusicStore.isLocalMusic(newSong.id)) {
                    // 按需加载本地音乐文件信息
                    const localFile = await localMusicStore.getLocalFile(newSong.id);
                    if (!localFile) {
                        console.error("本地音乐文件不存在:", newSong.id);
                        playerStore.isPlaying = false;
                        return;
                    }

                    // 懒加载：获取音频 URL
                    const fileUrl = await localMusicStore.getTrackURL(newSong.id);

                    if (!fileUrl) {
                        console.error("无法加载本地音乐文件:", newSong.id);
                        playerStore.isPlaying = false;
                        return;
                    }

                    // 本地音乐使用获取的 URL
                    audioRef.value.src = fileUrl;
                    audioRef.value.load();

                    // 设置简单的歌曲详情
                    playerStore.setCurrentSongDetail({
                        id: newSong.id,
                        name: localFile.name,
                        ar_name: localFile.artists,
                        al_name: localFile.album,
                        level: "本地",
                        size: `${(localFile.fileSize / 1024 / 1024).toFixed(2)} MB`,
                        url: fileUrl,
                        pic: "",
                        lyric: "",
                    });

                    // 当前歌曲加载完成，启动后台加载其他本地音乐
                    if (!localMusicStore.isInitialized && !localMusicStore.isLoading) {
                        // 获取播放列表中的本地音乐 ID（优先加载）
                        const playlistLocalIds = playerStore.playlist
                            .filter(s => localMusicStore.isLocalMusic(s.id))
                            .map(s => s.id);

                        // 异步启动后台加载，不阻塞当前播放
                        setTimeout(() => {
                            localMusicStore.startBackgroundLoading(playlistLocalIds);
                        }, 1000); // 延迟 1 秒，确保当前歌曲播放流畅
                    }

                    if (wasPlaying) {
                        setTimeout(async () => {
                            try {
                                if (audioRef.value && audioRef.value.readyState >= 2) {
                                    await audioRef.value.play();
                                }
                            } catch (err) {
                                console.error("本地音乐播放失败:", err);
                                playerStore.isPlaying = false;
                            }
                        }, 100);
                    }
                    return;
                }

                // 在线音乐处理逻辑
                // 1. 优先检查音频文件缓存
                const hasAudioCache = audioCacheStore ? await audioCacheStore.hasValidCache(newSong.id) : false;
                let audioUrl: string | null = null;
                let isFromAudioCache = false;

                if (hasAudioCache && audioCacheStore) {
                    // 使用缓存的音频文件（Blob URL）
                    audioUrl = await audioCacheStore.getCachedAudioURL(newSong.id);
                    if (audioUrl) {
                        isFromAudioCache = true;
                        console.log(`✅ 使用缓存的音频文件: ${newSong.name}`);
                    }
                }

                // 2. 获取歌曲详情（用于显示信息和获取URL）
                let songDetail = cacheStore.getCachedSong(newSong.id);

                if (!songDetail) {
                    // 尝试从 API 获取歌曲详情
                    const fetchedSong = await fetchSongWithQualityFallback(newSong.id);
                    songDetail = fetchedSong ?? undefined;

                    if (songDetail) {
                        // 缓存歌曲详情
                        cacheStore.setCachedSong(newSong.id, songDetail);
                    }
                }

                // ✅ 关键修复：如果有音频缓存，即使没有歌曲详情也可以播放
                if (!songDetail && !isFromAudioCache) {
                    // 没有歌曲详情，也没有音频缓存，无法播放
                    handleSongLoadError("无法加载歌曲，所有音质均不可用");
                    return;
                }

                // 如果有歌曲详情，检查 URL 是否有效（仅在线播放需要）
                if (songDetail && !isFromAudioCache) {
                    if (!songDetail.url || songDetail.url.trim() === '') {
                        handleSongLoadError("音频链接无效，该歌曲可能无法播放");
                        return;
                    }
                }

                // ✅ 在设置音频源之前，检查是否还是当前要加载的歌曲
                if (currentLoadingSongId.value !== newSong.id) {
                    // 释放刚获取的 Blob URL
                    if (isFromAudioCache && audioUrl) {
                        URL.revokeObjectURL(audioUrl);
                    }
                    return;
                }

                // 设置歌曲详情（如果有的话）
                if (songDetail) {
                    playerStore.setCurrentSongDetail(songDetail as SongDetail);
                }

                // 3. 设置音频源（优先使用缓存）
                if (isFromAudioCache && audioUrl) {
                    // ✅ 使用缓存的音频文件（Blob URL，完全离线）
                    audioRef.value.src = audioUrl;
                    currentBlobUrl.value = audioUrl;

                    console.log(`🎵 播放缓存音频: ${newSong.name}`);
                } else if (songDetail) {
                    // ✅ 使用在线音频
                    audioRef.value.src = songDetail.url;

                    // console.log(`🌐 播放在线音频: ${newSong.name}`);
                    // console.log(`📍 音频URL: ${songDetail.url.substring(0, 100)}...`);

                    // ============================================
                    // 🎯 方案一：下次播放使用缓存（当前方案）
                    // ============================================
                    // 优点：
                    // 1. 不会与 audio 元素的下载冲突
                    // 2. 不会抢占播放带宽
                    // 3. 当前播放绝对不会中断
                    // 4. 实现简单，风险低
                    // 5. 用户体验稳定
                    // ============================================
                    if (audioCacheStore && songDetail.url && songDetail.url.trim() !== '' && audioRef.value) {
                        const currentAudioElement = audioRef.value;
                        const currentSongId = newSong.id;
                        const currentUrl = songDetail.url;

                        // 异步执行，不阻塞播放
                        (async () => {
                            try {
                                // 等待一小段时间，确保播放已经稳定开始
                                // 3秒比2秒更保险，特别是在慢速网络环境下
                                await new Promise(resolve => setTimeout(resolve, 3000));

                                // 检查是否还是当前歌曲
                                if (currentLoadingSongId.value !== currentSongId) {
                                    // console.log(`⚠️ 歌曲已切换，取消缓存: ${newSong.name}`);
                                    return;
                                }

                                // 检查缓存信息是否还有效
                                const cachedSong = cacheStore.getCachedSong(currentSongId);
                                if (!cachedSong || !cachedSong.url) {
                                    console.log(`⚠️ 缓存信息无效，跳过: ${newSong.name}`);
                                    return;
                                }

                                // console.log(`💾 开始智能缓存（播放优先）: ${newSong.name}`);

                                // 进度回调（可选，用于调试）
                                const onProgress = (percent: number) => {
                                    if (import.meta.env.DEV && Math.floor(percent) % 20 === 0) {
                                        console.log(`📥 缓存进度: ${percent.toFixed(1)}%`);
                                    }
                                };

                                // 下载完成回调：不切换播放源，下次播放时直接使用缓存
                                const onComplete = (blobUrl: string) => {
                                    // 释放 Blob URL（因为我们不立即使用）
                                    URL.revokeObjectURL(blobUrl);

                                    //console.log(`✅ 缓存完成，下次播放将使用离线版本: ${newSong.name}`);

                                    // 静默提示（不打扰用户）
                                    if (import.meta.env.DEV) {
                                        ElMessage.success({
                                            message: `${newSong.name} 已缓存`,
                                            duration: 1500,
                                            showClose: false
                                        });
                                    }
                                };

                                // 使用智能捕获方法（等待缓冲完成）
                                await audioCacheStore!.captureFromAudioElement(
                                    currentSongId,
                                    currentAudioElement,
                                    currentUrl,
                                    settingsStore.quality,
                                    onProgress,
                                    onComplete
                                );
                            } catch (error) {
                                if (error instanceof Error && error.message.includes('403')) {
                                    console.warn(`⚠️ URL 已过期: ${newSong.name}`);
                                    cacheStore.setCachedSong(currentSongId, undefined);
                                } else if (error instanceof Error && error.name !== 'AbortError') {
                                    console.error("❌ 缓存失败:", error);
                                }
                            }
                        })();
                    }


                }

                // 监听加载错误，处理缓存失效的情况
                const handleLoadError = async () => {
                    console.error(`音频加载失败: ${newSong.name}`);

                    // ✅ 检查是否还是当前要加载的歌曲
                    if (currentLoadingSongId.value !== newSong.id) {
                        //console.log(`⚠️ 歌曲已切换，放弃错误处理: ${newSong.name}`);
                        return;
                    }

                    // ✅ 防止并发重试
                    if (retryingSet.value.has(newSong.id)) {
                        //console.log(`⚠️ 歌曲正在重试中，跳过: ${newSong.name}`);
                        return;
                    }

                    retryingSet.value.add(newSong.id);

                    try {
                        // 如果使用的是音频文件缓存（Blob URL），清除失效的缓存
                        if (isFromAudioCache && audioCacheStore) {
                            console.log(`清除失效的音频缓存: ${newSong.name}`);
                            await audioCacheStore.deleteCache(newSong.id);
                        }

                        // 清除歌曲信息缓存
                        cacheStore.setCachedSong(newSong.id, undefined);

                        // 重新加载歌曲
                        console.log(`重新加载歌曲: ${newSong.name}`);
                        const newSongDetail = await reloadSongAfterCacheExpired(newSong.id, newSong.name);

                        if (newSongDetail && audioRef.value) {
                            // ✅ 再次检查是否还是当前歌曲
                            if (currentLoadingSongId.value !== newSong.id) {
                                //console.log(`⚠️ 歌曲已切换，放弃重新加载: ${newSong.name}`);
                                return;
                            }

                            // 设置新的URL（直接使用在线URL，不使用缓存）
                            audioRef.value.src = newSongDetail.url;
                            audioRef.value.load();

                            // 如果之前在播放，继续播放
                            if (wasPlaying) {
                                setTimeout(async () => {
                                    try {
                                        if (audioRef.value && audioRef.value.readyState >= 2) {
                                            await audioRef.value.play();
                                        }
                                    } catch (err) {
                                        console.error("重新播放失败:", err);
                                        playerStore.isPlaying = false;
                                    }
                                }, 100);
                            }
                        } else {
                            playerStore.isPlaying = false;
                        }
                    } finally {
                        // ✅ 移除重试标记
                        retryingSet.value.delete(newSong.id);
                    }
                };

                // 添加一次性错误监听器
                audioRef.value.addEventListener('error', handleLoadError, { once: true });

                audioRef.value.load();

                if (wasPlaying) {
                    // 等待一小段时间确保音频已开始加载
                    setTimeout(async () => {
                        try {
                            if (audioRef.value && audioRef.value.readyState >= 2) {
                                await audioRef.value.play();
                            }
                        } catch (err) {
                            console.error("播放失败:", err);
                            ElMessage.error("音频加载失败，请重试");
                            playerStore.isPlaying = false;
                        }
                    }, 100);
                }
            } catch (error) {
                console.error("加载歌曲失败:", error);
                handleSongLoadError("加载歌曲失败");
            }
        }
    },
    { immediate: true } // 立即执行，处理刷新后的初始状态
);

// 监听播放状态
watch(
    () => playerStore.isPlaying,
    async (playing) => {
        if (audioRef.value && audioRef.value.src) {
            if (playing) {
                try {
                    // 确保音频已加载
                    if (audioRef.value.readyState >= 2) {
                        if (import.meta.env.DEV) {
                            console.log("尝试播放音频，readyState:", audioRef.value.readyState);
                        }
                        await audioRef.value.play();
                    } else {
                        if (import.meta.env.DEV) {
                            console.log("音频未准备好，readyState:", audioRef.value.readyState);
                        }
                        // 音频未准备好，等待 canplay 事件后自动播放
                        // handleCanPlay 函数会处理自动播放
                    }
                } catch (err) {
                    console.error("播放失败:", err);
                    // 播放失败时，同步状态
                    playerStore.isPlaying = false;
                }
            } else {
                userAction.value = true;
                audioRef.value.pause();
            }
        }
    }
);

// 监听音量变化
watch(
    () => playerStore.volume,
    (vol) => {
        if (audioRef.value) {
            audioRef.value.volume = vol;
        }
        // 同步更新音量进度条的显示值
        volumeValue.value = vol * 100;
    }
);

// 监听currentTime变化（用于进度条拖动）
watch(
    () => playerStore.currentTime,
    (newTime) => {
        if (!audioRef.value) return;

        // 如果当前时间与音频时间差距较大（超过1秒），说明是用户拖动进度条
        const timeDiff = Math.abs(newTime - audioRef.value.currentTime);
        if (timeDiff > 1 && !isDragging.value) {
            audioRef.value.currentTime = newTime;
        }
    }
);

// 时间更新
const handleTimeUpdate = () => {
    if (audioRef.value && !isDragging.value) {
        playerStore.setCurrentTime(audioRef.value.currentTime);
        progressValue.value = playerStore.progress;
    }
};

// 加载元数据
const handleLoadedMetadata = () => {
    if (audioRef.value) {
        playerStore.setDuration(audioRef.value.duration);
        // 确保音量同步
        audioRef.value.volume = playerStore.volume;
    }
};

// 播放结束
const handleEnded = () => {
    if (import.meta.env.DEV) {
        console.log("歌曲播放结束，当前模式:", playerStore.playMode);
    }

    // 如果当前 src 是 data URL（临时的静音音频），忽略 ended 事件
    if (audioRef.value && audioRef.value.src.startsWith('data:audio/wav')) {
        //console.log("⏭️ 忽略 data URL 的 ended 事件");
        return;
    }

    // 单曲循环模式 或 只有一首歌：重新播放当前歌曲
    if (playerStore.playMode === PlayMode.LOOP || playerStore.playlist.length === 1) {
        if (audioRef.value && playerStore.currentSong) {
            // 🔑 检查是否有缓存的音频，如果有则使用缓存
            const checkAndUseCache = async () => {
                const currentSong = playerStore.currentSong;
                if (!currentSong || !audioRef.value) return;

                // 检查是否有音频缓存
                if (audioCacheStore) {
                    const cachedAudio = await audioCacheStore.getCachedAudio(currentSong.id);
                    if (cachedAudio) {
                        //console.log(`🔄 单曲循环：使用缓存音频 - ${currentSong.name}`);
                        // 释放旧的 Blob URL
                        revokeBlobUrl();
                        // 使用缓存的音频
                        currentBlobUrl.value = URL.createObjectURL(cachedAudio);
                        audioRef.value.src = currentBlobUrl.value;
                        audioRef.value.load();
                        audioRef.value.currentTime = 0;
                        audioRef.value.play().catch(err => {
                            console.error("播放缓存音频失败:", err);
                        });
                        return;
                    }
                }

                // 如果没有缓存，直接重置时间播放（使用当前的在线音源）
                audioRef.value.currentTime = 0;
                audioRef.value.play().catch(err => {
                    console.error("重新播放失败:", err);
                });
            };

            checkAndUseCache();
        }
        return;
    }

    // 其他模式：播放下一首
    playerStore.playNext();
};

// 进度条拖动中
const handleProgressInput = (value: number) => {
    isDragging.value = true;
    progressValue.value = value;
    // 计算拖动时的预览时间
    if (playerStore.duration > 0) {
        draggingTime.value = (value / 100) * playerStore.duration;
    }
};

// 进度条变化完成
const handleProgressChange = (value: number) => {
    if (audioRef.value && playerStore.duration > 0) {
        const newTime = (value / 100) * playerStore.duration;
        audioRef.value.currentTime = newTime;
        playerStore.setCurrentTime(newTime);
    }
    isDragging.value = false;
    draggingTime.value = 0;
};

// 音量变化
const handleVolumeChange = (value: number) => {
    playerStore.setVolume(value / 100);
    isMuted.value = false;
};

// 切换静音
const toggleMute = () => {
    isMuted.value = !isMuted.value;
    if (audioRef.value) {
        audioRef.value.muted = isMuted.value;
    }
};

// 处理播放/暂停按钮点击
const handleTogglePlay = () => {
    // 检查播放列表是否为空
    if (playerStore.playlist.length === 0 || !playerStore.currentSong) {
        ElMessage.warning("播放列表为空，请先添加歌曲");
        return;
    }
    userAction.value = true;
    playerStore.togglePlay();
};

// 音频暂停事件
const handlePause = () => {
    // 如果是用户主动操作或正在拖动进度条，不做处理
    if (userAction.value || isDragging.value) {
        userAction.value = false;
        return;
    }

    // 其他情况下，如果音频暂停了，同步状态
    if (import.meta.env.DEV) {
        console.log("音频暂停");
    }
};

// 音频播放事件
const handlePlay = () => {
    if (import.meta.env.DEV) {
        console.log("音频开始播放");
    }
};

// 音频错误事件
const handleError = (e: Event) => {
    console.error("音频加载错误:", e);
    const target = e.target as HTMLAudioElement;
    if (target && target.error) {
        console.error("音频错误代码:", target.error.code);
        console.error("音频错误信息:", target.error.message);
    }

    // 重置播放状态
    playerStore.isPlaying = false;
    ElMessage.error("音频加载失败，请检查网络连接或尝试其他歌曲");
};

// 音频缓冲中
const handleWaiting = () => {
    if (import.meta.env.DEV) {
        console.log("音频缓冲中...");
    }
};

// 音频可以播放
const handleCanPlay = () => {
    if (import.meta.env.DEV) {
        console.log("音频已准备好播放");
    }
    // 如果应该播放但当前是暂停状态，尝试播放
    if (playerStore.isPlaying && audioRef.value && audioRef.value.paused && !isRecovering.value) {
        isRecovering.value = true;
        audioRef.value.play().catch(err => {
            console.error("自动播放失败:", err);
            // 播放失败，同步状态
            playerStore.isPlaying = false;
        }).finally(() => {
            isRecovering.value = false;
        });
    }
};

// 音频停滞事件
const handleStalled = () => {
    if (import.meta.env.DEV) {
        console.log("音频加载停滞");
    }
};

// 音频暂停后恢复
const handlePlaying = () => {
    if (import.meta.env.DEV) {
        console.log("音频正在播放");
    }
    isRecovering.value = false;
};

// 组件卸载时释放 Blob URL
onUnmounted(() => {
    revokeBlobUrl();
    console.log('PlayerBar unmounted, 已释放资源');
});

// 组件挂载后，如果有当前歌曲但没有歌曲详情，则加载
onMounted(async () => {
    console.log("PlayerBar mounted");

    // 立即同步音量到 audio 元素
    if (audioRef.value) {
        audioRef.value.volume = playerStore.volume;
        volumeValue.value = playerStore.volume * 100;
        console.log("初始化音量:", playerStore.volume);
    }

    // 检查是否有当前歌曲但没有加载详情
    if (playerStore.currentSong && !playerStore.currentSongDetail && audioRef.value) {
        console.log("检测到刷新后的歌曲，开始加载:", playerStore.currentSong.name);

        try {
            const song = playerStore.currentSong;

            // 检查是否为本地音乐
            if (localMusicStore.isLocalMusic(song.id)) {
                // 按需加载本地音乐文件信息
                const localFile = await localMusicStore.getLocalFile(song.id);
                if (!localFile) {
                    console.error("本地音乐文件不存在:", song.id);
                    playerStore.isPlaying = false;
                    return;
                }

                const fileUrl = await localMusicStore.getTrackURL(song.id);
                if (!fileUrl) {
                    console.error("无法加载本地音乐文件:", song.id);
                    playerStore.isPlaying = false;
                    return;
                }

                audioRef.value.pause();
                audioRef.value.src = fileUrl;
                audioRef.value.load();

                playerStore.setCurrentSongDetail({
                    id: song.id,
                    name: localFile.name,
                    ar_name: localFile.artists,
                    al_name: localFile.album,
                    level: "本地",
                    size: `${(localFile.fileSize / 1024 / 1024).toFixed(2)} MB`,
                    url: fileUrl,
                    pic: "",
                    lyric: "",
                });

                const savedTime = playerStore.getSavedProgress(song.id);
                if (savedTime > 0) {
                    audioRef.value.addEventListener('loadedmetadata', () => {
                        if (audioRef.value) {
                            audioRef.value.currentTime = savedTime;
                            playerStore.setCurrentTime(savedTime);
                        }
                    }, { once: true });
                }

                // 当前歌曲加载完成，启动后台加载其他本地音乐
                if (!localMusicStore.isInitialized && !localMusicStore.isLoading) {
                    const playlistLocalIds = playerStore.playlist
                        .filter(s => localMusicStore.isLocalMusic(s.id))
                        .map(s => s.id);

                    setTimeout(() => {
                        localMusicStore.startBackgroundLoading(playlistLocalIds);
                    }, 1000);
                }

                return;
            }

            // 在线音乐处理
            // 1. 优先检查音频文件缓存
            const hasAudioCache = audioCacheStore ? await audioCacheStore.hasValidCache(song.id) : false;
            let cachedAudioUrl: string | null = null;

            if (hasAudioCache && audioCacheStore) {
                cachedAudioUrl = await audioCacheStore.getCachedAudioURL(song.id);
                if (cachedAudioUrl) {
                    console.log(`✅ 刷新后使用缓存的音频文件: ${song.name}`);
                }
            }

            // 2. 获取歌曲详情
            let songDetail = cacheStore.getCachedSong(song.id);

            if (!songDetail) {
                // 尝试从 API 获取歌曲详情
                const fetchedSong = await fetchSongWithQualityFallback(song.id);
                songDetail = fetchedSong ?? undefined;

                if (songDetail) {
                    cacheStore.setCachedSong(song.id, songDetail);
                }
            }

            // ✅ 关键修复：如果有音频缓存，即使没有歌曲详情也可以播放
            if (!songDetail && !cachedAudioUrl) {
                // 没有歌曲详情，也没有音频缓存，无法播放
                console.error("无法获取歌曲详情且无缓存");
                ElMessage.error("无法加载歌曲，请尝试切换歌曲");
                return;
            }

            // 设置歌曲详情（如果有的话）
            if (songDetail) {
                playerStore.setCurrentSongDetail(songDetail);
            }

            // 设置音频源（优先使用缓存）
            audioRef.value.pause();
            const isUsingAudioCache = !!cachedAudioUrl;

            if (cachedAudioUrl) {
                // 使用缓存的音频文件
                audioRef.value.src = cachedAudioUrl;
                console.log(`🎵 刷新后播放缓存音频: ${song.name}`);
            } else if (songDetail) {
                // 使用在线 URL
                audioRef.value.src = songDetail.url;
                console.log(`🌐 刷新后播放在线音频: ${song.name}`);
            }

            // 监听加载错误，处理缓存失效的情况
            const handleMountedLoadError = async () => {
                console.error(`刷新后音频加载失败: ${song.name}`);

                // 移除错误监听器
                audioRef.value?.removeEventListener('error', handleMountedLoadError);

                // 如果使用的是音频文件缓存，清除失效的缓存
                if (isUsingAudioCache && audioCacheStore) {
                    console.log(`清除失效的音频缓存: ${song.name}`);
                    await audioCacheStore.deleteCache(song.id);
                }

                // 清除歌曲信息缓存
                cacheStore.setCachedSong(song.id, undefined);

                // 重新加载歌曲
                console.log(`重新加载歌曲: ${song.name}`);
                const newSongDetail = await reloadSongAfterCacheExpired(song.id, song.name);

                if (newSongDetail && audioRef.value) {
                    // 设置新的URL
                    audioRef.value.src = newSongDetail.url;
                    audioRef.value.load();

                    // 恢复播放进度
                    const savedTime = playerStore.getSavedProgress(song.id);
                    if (savedTime > 0) {
                        audioRef.value.addEventListener('loadedmetadata', () => {
                            if (audioRef.value) {
                                audioRef.value.currentTime = savedTime;
                                playerStore.setCurrentTime(savedTime);
                            }
                        }, { once: true });
                    }
                }
            };

            // 添加一次性错误监听器
            audioRef.value.addEventListener('error', handleMountedLoadError, { once: true });

            audioRef.value.load();

            // 恢复播放进度
            const savedTime = playerStore.getSavedProgress(song.id);
                if (savedTime > 0) {
                    console.log(`恢复播放进度: ${savedTime.toFixed(2)}秒`);
                    // 等待音频加载完成后设置进度
                    audioRef.value.addEventListener('loadedmetadata', () => {
                        if (audioRef.value) {
                            audioRef.value.currentTime = savedTime;
                            playerStore.setCurrentTime(savedTime);
                        }
                    }, { once: true });
                } else {
                    audioRef.value.currentTime = 0;
                }
        } catch (error) {
            console.error("加载歌曲失败:", error);
            ElMessage.error("加载歌曲失败");
        }
    }
});
</script>

<style scoped lang="scss">
.player-bar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 70px;
    min-width: 600px;
    background: var(--player-bar-bg);
    border-top: 1px solid var(--player-bar-border);
    display: flex;
    align-items: center;
    padding: 0 12px;
    gap: 12px;
    z-index: 1000;
    transition: background 0.3s, border-color 0.3s;

    .song-info {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 200px;
        flex-shrink: 0;
        cursor: pointer;

        .song-cover-wrapper {
            width: 45px;
            height: 45px;
            border-radius: 4px;
            overflow: hidden;
            flex-shrink: 0;
            background: var(--el-fill-color-light);
            position: relative;

            .song-cover {
                width: 100%;
                height: 100%;
                object-fit: cover;
            }

            .song-cover-placeholder {
                width: 100%;
                height: 100%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 24px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            }
        }

        .song-details {
            flex: 1;
            min-width: 0;

            .song-name {
                font-size: 16px;
                font-weight: 600;
                color: var(--el-text-color-primary);
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                margin-bottom: 4px;
            }

            .song-artist {
                font-size: 14px;
                font-weight: 500;
                color: var(--el-text-color-secondary);
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
        }
    }

    .player-controls {
        flex: 1;
        display: flex;
        align-items: center;
        gap: 16px;

        .control-buttons {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-shrink: 0;

            .el-button {
                &.is-playing {
                    animation: pulse 1.5s ease-in-out infinite;
                }
            }
        }

        .progress-bar {
            flex: 1;
            display: flex;
            align-items: center;
            gap: 8px;
            min-width: 200px;
            max-width: 500px;

            .time {
                font-size: 12px;
                color: var(--el-text-color-secondary);
                min-width: 42px;
                text-align: center;
                user-select: none;
            }

            .progress-slider {
                flex: 1;

                // 移除所有 pointer 手势，使用默认光标
                :deep(.el-slider__runway) {
                    cursor: default !important;
                }

                :deep(.el-slider__bar) {
                    cursor: default !important;
                }

                :deep(.el-slider__button-wrapper) {
                    cursor: default !important;
                }

                :deep(.el-slider__button) {
                    cursor: default !important;
                    transition: transform 0.2s;
                }

                // 滑块悬停时的缩放效果
                :deep(.el-slider__button-wrapper:hover .el-slider__button) {
                    transform: scale(1.2);
                }
            }
        }

        .volume-control {
            display: flex;
            align-items: center;
            gap: 8px;
            width: 260px;
            min-width: 240px;
            flex-shrink: 0;

            .el-slider {
                flex: 1;
                min-width: 120px;
            }

            .favorite-button {
                flex-shrink: 0;
                transition: all 0.3s;
                margin-left: 14px;

                &:hover:not(:disabled) {
                    transform: scale(1.1);
                }

                // 已收藏状态：红色背景 + 白色图标
                &.el-button--danger {
                    background-color: var(--el-color-danger);
                    border-color: var(--el-color-danger);
                    color: #2ff2ef; //收藏后的星星颜色

                    &:hover {
                        background-color: var(--el-color-danger-light-3);
                        border-color: var(--el-color-danger-light-3);
                        color: #ffffff;
                    }

                    &:active {
                        background-color: var(--el-color-danger-dark-2);
                        border-color: var(--el-color-danger-dark-2);
                        color: #0794f2;
                    }
                }

                // 未收藏状态：默认样式
                &.el-button--default {
                    &:hover {
                        color: var(--el-color-danger);
                        border-color: var(--el-color-danger-light-5);
                        background-color: var(--el-color-danger-light-9);
                    }
                }
            }

            .el-slider {
                flex: 1;

                // 移除所有 pointer 手势，使用默认光标
                :deep(.el-slider__runway) {
                    cursor: default !important;
                }

                :deep(.el-slider__bar) {
                    cursor: default !important;
                }

                :deep(.el-slider__button-wrapper) {
                    cursor: default !important;
                }

                :deep(.el-slider__button) {
                    cursor: default !important;
                    transition: transform 0.2s;
                }

                // 滑块悬停时的缩放效果
                :deep(.el-slider__button-wrapper:hover .el-slider__button) {
                    transform: scale(1.2);
                }
            }
        }
    }

    .player-actions {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 50px;
        flex-shrink: 0;
        justify-content: flex-end;
        height: 100%;

        .playlist-button {
            height: 100%;
            min-height: 70px;
            border-radius: 0;
            padding: 0 20px;
            border: none;
            background: transparent;
            transition: background 0.2s;

            &:hover {
                background: var(--el-fill-color-light);
            }

            :deep(.el-icon) {
                font-size: 22px;
            }
        }
    }

    // 统一设置图标尺寸
    :deep(.el-button .el-icon) {
        font-size: 18px;
    }

    :deep(.el-button--large .el-icon) {
        font-size: 22px;
    }
}

@keyframes pulse {

    0%,
    100% {
        transform: scale(1);
        box-shadow: 0 0 0 0 rgba(var(--el-color-primary-rgb), 0.7);
    }

    50% {
        transform: scale(1.05);
        box-shadow: 0 0 0 10px rgba(var(--el-color-primary-rgb), 0);
    }
}
</style>


<!--
============================================
🎯 方案二：自动切换到缓存（备选方案）
============================================

优点：
1. 立即节省流量（切换后不再消耗）
2. 充分利用缓存（不浪费）
3. 更好的用户体验（立即享受离线播放）

问题：
1. 切换时可能跳回之前的进度（因为保存进度的频率问题）
2. 需要更精确的进度保存机制

实现代码（替换方案一的 onComplete 回调）：
============================================

const onComplete = (blobUrl: string) => {
    // 检查是否还在播放这首歌
    if (currentLoadingSongId.value !== currentSongId || !audioRef.value) {
        URL.revokeObjectURL(blobUrl);
        //console.log(`⚠️ 歌曲已切换，放弃切换到缓存`);
        return;
    }

    // 🎯 关键：精确保存当前播放状态
    const currentTime = audioRef.value.currentTime;
    const isPlaying = !audioRef.value.paused;
    const currentVolume = audioRef.value.volume;
    const playbackRate = audioRef.value.playbackRate;

    //console.log(`🔄 开始丝滑切换: 位置 ${currentTime.toFixed(2)}s`);

    // 释放旧的 Blob URL
    revokeBlobUrl();

    // 🎯 使用 requestAnimationFrame 确保在下一帧切换
    requestAnimationFrame(() => {
        if (!audioRef.value) return;

        try {
            // 1. 切换到缓存的 Blob URL
            audioRef.value.src = blobUrl;
            currentBlobUrl.value = blobUrl;

            // 2. 立即恢复音量和播放速率
            audioRef.value.volume = currentVolume;
            audioRef.value.playbackRate = playbackRate;

            // 3. 监听 loadedmetadata 事件
            const handleLoadedMetadata = () => {
                if (!audioRef.value) return;

                // 4. 精确恢复播放位置
                audioRef.value.currentTime = currentTime;

                // 5. 如果之前在播放，继续播放
                if (isPlaying) {
                    audioRef.value.play().then(() => {
                        //console.log(`✅ 切换完成，继续播放`);
                        ElMessage.success({
                            message: '已切换到离线播放',
                            duration: 2000,
                            showClose: false
                        });
                    }).catch(err => {
                        console.error("切换后播放失败:", err);
                        // 重新加载并重试
                        audioRef.value!.load();
                        const handleCanPlay = () => {
                            if (!audioRef.value) return;
                            audioRef.value.currentTime = currentTime;
                            audioRef.value.play().catch(() => {
                                playerStore.isPlaying = false;
                            });
                        };
                        audioRef.value!.addEventListener('canplay', handleCanPlay, { once: true });
                    });
                }
            };

            // 监听 loadedmetadata 事件
            audioRef.value.addEventListener('loadedmetadata', handleLoadedMetadata, { once: true });

            // 超时保护：2秒内没有触发则强制执行
            setTimeout(() => {
                if (audioRef.value && audioRef.value.src === blobUrl) {
                    audioRef.value.removeEventListener('loadedmetadata', handleLoadedMetadata);
                    handleLoadedMetadata();
                }
            }, 2000);

        } catch (error) {
            console.error("切换出错:", error);
            URL.revokeObjectURL(blobUrl);
        }
    });
};

============================================
-->
