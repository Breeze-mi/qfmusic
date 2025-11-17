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
import { ref, computed, watch } from "vue";
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
import MusicApi from "@/api/music";
import type { SongDetail } from "@/api/music";
import { ElMessage } from "element-plus";

const router = useRouter();
const playerStore = usePlayerStore();
const cacheStore = useCacheStore();
const settingsStore = useSettingsStore();
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

// 监听当前歌曲变化，加载音频
watch(
    () => playerStore.currentSong,
    async (newSong) => {
        if (newSong && audioRef.value) {
            try {
                // 先检查缓存
                let songDetail = cacheStore.getCachedSong(newSong.id);

                if (songDetail) {
                    console.log(`使用缓存的歌曲: ${newSong.name}`);
                } else {
                    console.log(`请求API获取歌曲: ${newSong.name}, 音质: ${settingsStore.quality}`);

                    // 音质降级顺序：从高到低
                    const qualityLevels = [
                        "jymaster",   // 超清母带
                        "sky",        // 沉浸环绕声
                        "jyeffect",   // 高清环绕声
                        "hires",      // Hi-Res音质
                        "lossless",   // 无损音质
                        "exhigh",     // 极高音质
                        "standard"    // 标准音质
                    ];

                    // 音质名称映射
                    const qualityNames: Record<string, string> = {
                        jymaster: "超清母带",
                        sky: "沉浸环绕声",
                        jyeffect: "高清环绕声",
                        hires: "Hi-Res",
                        lossless: "无损",
                        exhigh: "极高",
                        standard: "标准"
                    };

                    // 从用户选择的音质开始尝试
                    let currentQualityIndex = qualityLevels.indexOf(settingsStore.quality);
                    if (currentQualityIndex === -1) {
                        currentQualityIndex = qualityLevels.indexOf("lossless"); // 默认无损
                    }

                    while (currentQualityIndex < qualityLevels.length) {
                        try {
                            const { data } = await MusicApi.getSong(newSong.id, qualityLevels[currentQualityIndex]);
                            if (data.value?.success && data.value.data?.url) {
                                songDetail = data.value.data;

                                // 如果降级了，提示用户
                                if (currentQualityIndex > qualityLevels.indexOf(settingsStore.quality)) {
                                    const originalQuality = settingsStore.quality;
                                    const currentQuality = qualityLevels[currentQualityIndex];
                                    ElMessage.warning(
                                        `${qualityNames[originalQuality]}音质不可用，已降级到${qualityNames[currentQuality]}音质`
                                    );
                                }

                                // 缓存歌曲详情
                                cacheStore.setCachedSong(newSong.id, songDetail);
                                break;
                            }
                        } catch (err) {
                            console.error(`获取${qualityNames[qualityLevels[currentQualityIndex]]}音质失败:`, err);
                        }

                        // 尝试下一个音质级别
                        currentQualityIndex++;
                    }

                    if (!songDetail) {
                        ElMessage.error("所有音质均获取失败");
                        return;
                    }
                }

                // 确保songDetail存在后再使用
                if (!songDetail) {
                    ElMessage.error("歌曲详情获取失败");
                    return;
                }

                playerStore.setCurrentSongDetail(songDetail as SongDetail);

                // 检查音频 URL 是否有效
                if (!songDetail.url || songDetail.url.trim() === '') {
                    ElMessage.error("音频链接无效");
                    return;
                }

                // 重置音频元素
                audioRef.value.pause();
                audioRef.value.currentTime = 0;
                audioRef.value.src = songDetail.url;

                // 等待音频加载完成后再播放
                audioRef.value.load();

                if (playerStore.isPlaying) {
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
                ElMessage.error("加载歌曲失败");
            }
        }
    }
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
                font-size: 13px;
                font-weight: 500;
                color: var(--el-text-color-primary);
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                margin-bottom: 4px;
            }

            .song-artist {
                font-size: 12px;
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
