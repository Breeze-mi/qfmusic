<template>
    <div class="player-bar">
        <!-- 左侧：歌曲信息 -->
        <div class="song-info" @click="goToDetail">
            <div v-if="playerStore.currentSong" class="song-cover-wrapper">
                <img :src="playerStore.currentSong.picUrl" :alt="playerStore.currentSong.name" class="song-cover"
                    loading="lazy" />
            </div>
            <div v-if="playerStore.currentSong" class="song-details">
                <div class="song-name">{{ playerStore.currentSong.name }}</div>
                <div class="song-artist">{{ playerStore.currentSong.artists }}</div>
            </div>
        </div>

        <!-- 中间：播放控制 -->
        <div class="player-controls">
            <div class="control-buttons">
                <el-button circle :icon="playModeIcon" @click="playerStore.togglePlayMode" :title="playModeText" />
                <el-button circle :icon="DArrowLeft" @click="playerStore.playPrev" />
                <el-button circle size="large" type="primary" :icon="playerStore.isPlaying ? VideoPause : VideoPlay"
                    @click="handleTogglePlay" :class="{ 'is-playing': playerStore.isPlaying }" />
                <el-button circle :icon="DArrowRight" @click="playerStore.playNext" />
                <el-button circle :icon="volumeIcon" @click="toggleMute" />
            </div>
            <div class="progress-bar">
                <span class="time">{{ formatTime(isDragging ? draggingTime : playerStore.currentTime) }}</span>
                <el-slider v-model="progressValue" :show-tooltip="false" @change="handleProgressChange"
                    @input="handleProgressInput" class="progress-slider" />
                <span class="time">{{ formatTime(playerStore.duration) }}</span>
            </div>
        </div>

        <!-- 右侧：音量和播放列表 -->
        <div class="player-actions">
            <div class="volume-control">
                <el-slider v-model="volumeValue" :show-tooltip="false" @input="handleVolumeChange" />
            </div>
            <el-button circle :icon="List" @click="playerStore.togglePlaylist" :badge="playerStore.playlist.length" />
        </div>

        <!-- 音频元素 -->
        <audio ref="audioRef" @timeupdate="handleTimeUpdate" @loadedmetadata="handleLoadedMetadata" @ended="handleEnded"
            @pause="handlePause" @play="handlePlay" @playing="handlePlaying" @error="handleError"
            @waiting="handleWaiting" @stalled="handleStalled" @canplay="handleCanPlay" @canplaythrough="handleCanPlay"
            preload="metadata" />
    </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import { useRouter } from "vue-router";
import {
    VideoPlay,
    VideoPause,
    DArrowLeft,
    DArrowRight,
    List,
    Refresh,
    Sort,
    RefreshRight,
    Mute,
    Microphone,
} from "@element-plus/icons-vue";
import { usePlayerStore, PlayMode } from "@/stores/player";
import { useCacheStore } from "@/stores/cache";
import { useSettingsStore } from "@/stores/settings";
import { usePlaylistStore } from "@/stores/playlist";
import { useLocalMusicStore } from "@/stores/localMusic";
import MusicApi from "@/api/music";
import type { SongDetail } from "@/api/music";
import { ElMessage } from "element-plus";
import { checkAPIHealth } from "@/utils/request";

const router = useRouter();
const playerStore = usePlayerStore();
const cacheStore = useCacheStore();
const settingsStore = useSettingsStore();

// 安全地初始化新的stores
let playlistStore;
let localMusicStore;
try {
    playlistStore = usePlaylistStore();
    localMusicStore = useLocalMusicStore();
} catch (error) {
    console.error("初始化store失败:", error);
    // 提供默认的空实现
    playlistStore = {
        addToHistory: () => { },
    } as any;
    localMusicStore = {
        isLocalMusic: () => false,
        getLocalFile: () => null,
    } as any;
}

const audioRef = ref<HTMLAudioElement>();

// 跳转到详情页或返回
const goToDetail = () => {
    if (!playerStore.currentSong) return;

    // 如果当前在详情页，则返回
    if (router.currentRoute.value.path === "/song-detail") {
        router.back();
    } else {
        // 否则跳转到详情页
        router.push("/song-detail");
    }
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

// 播放模式图标
const playModeIcon = computed(() => {
    switch (playerStore.playMode) {
        case PlayMode.SEQUENCE:
            return Sort;
        case PlayMode.RANDOM:
            return Refresh;
        case PlayMode.LOOP:
            return RefreshRight;
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

// 音量图标
const volumeIcon = computed(() => {
    return isMuted.value || volumeValue.value === 0 ? Mute : Microphone;
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

    // 检查服务器状态
    const isHealthy = await checkAPIHealth();
    if (!isHealthy) {
        ElMessage.error("服务器连接失败，无法重新加载歌曲");
        return null;
    }

    // 重新获取歌曲
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

// 平滑淡出函数，使用指数衰减曲线，避免切歌时的爆音
const fadeOut = async (duration: number = 20): Promise<void> => {
    if (!audioRef.value) return;

    const originalVolume = audioRef.value.volume;
    const steps = 4; // 减少到4步
    const stepDuration = duration / steps;

    for (let i = 0; i < steps; i++) {
        if (audioRef.value) {
            // 使用指数衰减：音量快速下降，但平滑过渡
            const progress = (i + 1) / steps;
            const exponentialProgress = Math.pow(progress, 2); // 平方衰减
            audioRef.value.volume = originalVolume * (1 - exponentialProgress);
            await new Promise(resolve => setTimeout(resolve, stepDuration));
        }
    }

    if (audioRef.value) {
        audioRef.value.volume = 0;
    }
};

// 监听当前歌曲变化，加载音频
watch(
    () => playerStore.currentSong,
    async (newSong, oldSong) => {
        if (newSong && audioRef.value) {
            const wasPlaying = playerStore.isPlaying;
            const originalVolume = audioRef.value.volume;

            // 如果有旧歌曲正在播放，先平滑淡出
            if (oldSong && !audioRef.value.paused) {
                await fadeOut(20); // 20ms 极速淡出
            } else {
                // 如果没有播放，直接静音
                audioRef.value.volume = 0;
            }

            // 立即暂停并重置
            audioRef.value.pause();
            audioRef.value.currentTime = 0;

            // 异步添加到试听列表，不阻塞切歌流程
            Promise.resolve().then(() => {
                try {
                    playlistStore?.addToHistory(newSong);
                } catch (error) {
                    console.error("添加到试听列表失败:", error);
                }
            });

            // 极速恢复音量（30ms）
            setTimeout(() => {
                if (audioRef.value) {
                    audioRef.value.volume = originalVolume;
                }
            }, 30);

            try {
                // 检查是否为本地音乐
                if (localMusicStore.isLocalMusic(newSong.id)) {
                    const localFile = localMusicStore.getLocalFile(newSong.id);
                    if (localFile && localFile.fileUrl) {
                        // 本地音乐直接使用 blob URL
                        audioRef.value.src = localFile.fileUrl;
                        audioRef.value.load();

                        // 设置简单的歌曲详情
                        playerStore.setCurrentSongDetail({
                            name: localFile.name,
                            ar_name: localFile.artists,
                            al_name: localFile.album,
                            level: "本地",
                            size: `${(localFile.fileSize / 1024 / 1024).toFixed(2)} MB`,
                            url: localFile.fileUrl,
                            pic: "",
                            lyric: "",
                        });

                        if (wasPlaying) {
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
                        return;
                    } else {
                        // 本地文件不存在
                        handleSongLoadError("本地音乐文件不存在", false);  // 不清空 src，避免错误
                        return;
                    }
                }

                // 在线音乐处理逻辑
                // 先检查缓存
                let songDetail = cacheStore.getCachedSong(newSong.id);

                if (songDetail) {
                    console.log(`使用缓存的歌曲: ${newSong.name}`);
                } else {
                    console.log(`请求API获取歌曲: ${newSong.name}, 音质: ${settingsStore.quality}`);

                    // 先检查后端状态
                    const isHealthy = await checkAPIHealth();
                    if (!isHealthy) {
                        handleSongLoadError("服务器连接失败，无法加载歌曲");
                        return;
                    }

                    // 使用公共函数获取歌曲（带音质降级）
                    const fetchedSong = await fetchSongWithQualityFallback(newSong.id);
                    songDetail = fetchedSong ?? undefined;

                    if (songDetail) {
                        // 缓存歌曲详情
                        cacheStore.setCachedSong(newSong.id, songDetail);
                    }

                    if (!songDetail) {
                        handleSongLoadError("无法加载歌曲，所有音质均不可用");
                        return;
                    }
                }

                // 确保songDetail存在后再使用
                if (!songDetail) {
                    handleSongLoadError("歌曲详情获取失败");
                    return;
                }

                // 检查音频 URL 是否有效
                if (!songDetail.url || songDetail.url.trim() === '') {
                    handleSongLoadError("音频链接无效，该歌曲可能无法播放");
                    return;
                }

                playerStore.setCurrentSongDetail(songDetail as SongDetail);

                // 设置音频源并加载
                audioRef.value.src = songDetail.url;

                // 标记是否使用了缓存
                const isFromCache = cacheStore.hasCachedSong(newSong.id);

                // 监听加载错误，如果是缓存的URL失效，自动重新请求
                const handleLoadError = async () => {
                    if (isFromCache && audioRef.value) {
                        // 移除错误监听器，避免重复触发
                        audioRef.value.removeEventListener('error', handleLoadError);

                        // 使用公共函数重新加载
                        const newSongDetail = await reloadSongAfterCacheExpired(newSong.id, newSong.name);

                        if (newSongDetail && audioRef.value) {
                            // 设置新的URL
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
                                    }
                                }, 100);
                            }
                        } else {
                            playerStore.isPlaying = false;
                        }
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
                        console.log("尝试播放音频，readyState:", audioRef.value.readyState);
                        await audioRef.value.play();
                    } else {
                        console.log("音频未准备好，readyState:", audioRef.value.readyState);
                        // 音频未准备好，等待 canplay 事件
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
    }
);

// 监听currentTime变化（用于单曲循环和进度条拖动）
watch(
    () => playerStore.currentTime,
    (newTime) => {
        if (!audioRef.value) return;

        // 如果当前时间与音频时间差距较大（超过1秒），说明是用户拖动进度条
        const timeDiff = Math.abs(newTime - audioRef.value.currentTime);
        if (timeDiff > 1 && !isDragging.value) {
            audioRef.value.currentTime = newTime;
            return;
        }

        // 如果store的时间被重置为0，且音频当前时间不是0，说明是单曲循环
        if (newTime === 0 && audioRef.value.currentTime > 0.1) {
            audioRef.value.currentTime = 0;
            if (playerStore.isPlaying) {
                audioRef.value.play().catch(err => {
                    console.error("单曲循环播放失败:", err);
                });
            }
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
    }
};

// 播放结束
const handleEnded = () => {
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
    console.log("音频暂停");
};

// 音频播放事件
const handlePlay = () => {
    console.log("音频开始播放");
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
    console.log("音频缓冲中...");
};

// 音频可以播放
const handleCanPlay = () => {
    console.log("音频已准备好播放");
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
    console.log("音频加载停滞");
};

// 音频暂停后恢复
const handlePlaying = () => {
    console.log("音频正在播放");
    isRecovering.value = false;
};

// 组件挂载后，如果有当前歌曲但没有歌曲详情，则加载
onMounted(async () => {
    console.log("PlayerBar mounted");

    // 检查是否有当前歌曲但没有加载详情
    if (playerStore.currentSong && !playerStore.currentSongDetail && audioRef.value) {
        console.log("检测到刷新后的歌曲，开始加载:", playerStore.currentSong.name);

        try {
            const song = playerStore.currentSong;

            // 检查是否为本地音乐
            if (localMusicStore.isLocalMusic(song.id)) {
                const localFile = localMusicStore.getLocalFile(song.id);
                if (localFile && localFile.fileUrl) {
                    console.log("加载本地音乐:", localFile.name);
                    audioRef.value.pause();
                    audioRef.value.src = localFile.fileUrl;
                    audioRef.value.load();

                    playerStore.setCurrentSongDetail({
                        name: localFile.name,
                        ar_name: localFile.artists,
                        al_name: localFile.album,
                        level: "本地",
                        size: `${(localFile.fileSize / 1024 / 1024).toFixed(2)} MB`,
                        url: localFile.fileUrl,
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
                    return;
                } else {
                    // 本地音乐文件不存在（刷新后blob URL丢失）
                    console.log("本地音乐文件URL已失效，需要重新导入");
                    // 停止当前播放，但不清空 src 避免错误
                    if (audioRef.value) {
                        audioRef.value.pause();
                    }
                    playerStore.isPlaying = false;
                    ElMessage.warning("本地音乐文件已失效，请重新导入");
                    return;
                }
            }

            // 在线音乐处理
            let songDetail = cacheStore.getCachedSong(song.id);

            if (!songDetail) {
                console.log(`从API获取歌曲详情: ${song.name}`);

                // 先检查后端状态
                const isHealthy = await checkAPIHealth();
                if (!isHealthy) {
                    console.error("服务器不可用，无法加载歌曲");
                    ElMessage.error("服务器连接失败，无法加载歌曲");
                    return;
                }

                // 使用公共函数获取歌曲（带音质降级）
                const fetchedSong = await fetchSongWithQualityFallback(song.id);
                songDetail = fetchedSong ?? undefined;

                if (songDetail) {
                    cacheStore.setCachedSong(song.id, songDetail);
                }
            }

            if (songDetail) {
                console.log("歌曲详情加载成功，设置音频源");
                playerStore.setCurrentSongDetail(songDetail);

                // 设置音频源
                audioRef.value.pause();
                audioRef.value.src = songDetail.url;

                // 标记是否使用了缓存（用于刷新后的恢复）
                const isFromCache = cacheStore.hasCachedSong(song.id);

                // 监听加载错误，如果是缓存的URL失效，自动重新请求
                const handleMountedLoadError = async () => {
                    if (isFromCache && audioRef.value) {
                        // 移除错误监听器
                        audioRef.value.removeEventListener('error', handleMountedLoadError);

                        // 使用公共函数重新加载
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

                // console.log("音频源已设置，等待用户点击播放");
            } else {
                console.error("无法获取歌曲详情");
                ElMessage.error("无法加载歌曲，请尝试切换歌曲");
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
    background: var(--el-bg-color);
    border-top: 1px solid var(--el-border-color);
    display: flex;
    align-items: center;
    padding: 0 12px;
    gap: 12px;
    z-index: 1000;

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

            .song-cover {
                width: 100%;
                height: 100%;
                object-fit: cover;
            }
        }

        .song-details {
            flex: 1;
            min-width: 0;

            .song-name {
                font-size: 14px;
                font-weight: 500;
                color: var(--el-text-color-primary);
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                margin-bottom: 4px;
            }

            .song-artist {
                font-size: 13px;
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
    }

    .player-actions {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 120px;
        flex-shrink: 0;
        justify-content: flex-end;

        .volume-control {
            width: 80px;
            min-width: 60px;

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
