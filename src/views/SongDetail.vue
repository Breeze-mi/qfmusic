<template>
    <div class="song-detail-page">
        <!-- 顶部栏 -->
        <div class="top-bar">
            <h2 class="page-title">{{ playerStore.currentSong?.name || '播放详情' }}</h2>
            <div class="spacer"></div>
            <el-button circle :icon="Setting" @click="navigateToSettings" title="设置" />
            <el-button circle :icon="themeStore.isDark ? Sunny : Moon" @click="themeStore.toggleTheme" title="切换主题" />
        </div>

        <!-- 主内容区：左右布局 -->
        <div class="detail-content">
            <!-- 左侧：封面和歌曲信息 -->
            <div class="left-section">
                <div class="album-cover-wrapper">
                    <div v-if="playerStore.currentSong?.picUrl" class="album-cover"
                        :class="{ rotating: playerStore.isPlaying }" :style="{
                            backgroundImage: `url(${playerStore.currentSong.picUrl})`,
                        }"></div>
                    <div v-else class="album-cover-placeholder" :class="{ rotating: playerStore.isPlaying }">
                        🎵
                    </div>
                </div>
                <div class="song-info">
                    <h2 class="song-name">{{ playerStore.currentSong?.name || '未知歌曲' }}</h2>
                    <p class="song-artist">艺术家：{{ playerStore.currentSong?.artists || '--' }}</p>
                    <p class="song-album">专辑：{{ playerStore.currentSong?.album || '--' }}</p>
                </div>
            </div>

            <!-- 右侧：歌词 -->
            <div class="right-section">
                <!-- 歌词渲染器 -->
                <div class="lyrics-container">
                    <LyricRenderer v-if="lyrics.length > 0" :lyrics="lyrics" :meta-info="metaInfo"
                        :current-time="playerStore.currentTime" :is-playing="playerStore.isPlaying"
                        :karaoke-mode="settingsStore.karaokeMode" :lyric-offset="lyricOffset" />
                    <div v-else class="no-lyrics">
                        <el-empty description="暂无歌词" />
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { useRouter } from "vue-router";
import { Setting, Sunny, Moon } from "@element-plus/icons-vue";
import { usePlayerStore } from "@/stores/player";
import { useThemeStore } from "@/stores/theme";
import { useSettingsStore } from "@/stores/settings";
import {
    parseLyric,
    type LyricLine,
    type LyricMetaInfo,
} from "@/utils/lyricParser";
import LyricRenderer from "@/components/LyricRenderer.vue";

const router = useRouter();
const playerStore = usePlayerStore();
const themeStore = useThemeStore();
const settingsStore = useSettingsStore();

const navigateToSettings = () => {
    router.push("/settings");
};

const lyrics = ref<LyricLine[]>([]);
const metaInfo = ref<LyricMetaInfo>({});

// 获取当前歌曲的歌词偏移量
const lyricOffset = computed(() => {
    const songId = playerStore.currentSong?.id?.toString();
    return settingsStore.getLyricOffset(songId);
});

// 监听歌曲详情变化，解析歌词
watch(
    () => playerStore.currentSongDetail,
    (detail) => {
        if (detail?.lyric) {
            const parsed = parseLyric(detail.lyric, detail.tlyric);
            lyrics.value = parsed.lyrics;
            metaInfo.value = parsed.metaInfo;
        } else {
            lyrics.value = [];
            metaInfo.value = {};
        }
    },
    { immediate: true }
);
</script>

<style scoped lang="scss">
.song-detail-page {
    height: 100vh;
    display: flex;
    flex-direction: column;
    background: var(--el-bg-color);

    .top-bar {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 20px 24px;
        background: var(--el-bg-color);
        border-bottom: 1px solid var(--el-border-color);
        flex-shrink: 0;

        .page-title {
            font-size: 22px;
            font-weight: 600;
            color: var(--el-text-color-primary);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            margin: 0;
        }

        .spacer {
            flex: 1;
        }

        // 统一设置和主题切换按钮大小
        :deep(.el-button.is-circle) {
            width: 40px;
            height: 40px;
            font-size: 22px;
        }
    }

    .detail-content {
        flex: 1;
        display: flex;
        overflow: hidden;
        padding: 40px;
        gap: 60px;
        padding-bottom: 90px;

        .left-section {
            flex: 0 0 45%;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;

            .album-cover-wrapper {
                margin-bottom: 40px;

                .album-cover {
                    width: 400px; //旋转图片大小
                    height: 400px; //旋转图片大小
                    border-radius: 50%;
                    background-size: cover;
                    background-position: center;
                    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.2);
                    background-color: var(--el-fill-color-light);

                    &.rotating {
                        animation: rotate 20s linear infinite;
                    }
                }

                .album-cover-placeholder {
                    width: 400px;
                    height: 400px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 120px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.2);

                    &.rotating {
                        animation: rotate 20s linear infinite;
                    }
                }
            }

            .song-info {
                text-align: left;
                width: 100%;
                max-width: 400px; //旋转图片大小

                .song-name {
                    font-size: 30px;
                    font-weight: 600;
                    color: var(--el-text-color-primary);
                    margin: 0 0 12px 0;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .song-artist,
                .song-album {
                    font-size: 16px;
                    color: var(--el-text-color-secondary);
                    margin: 4px 0;
                    line-height: 1.5;
                }
            }
        }

        .right-section {
            flex: 1;
            display: flex;
            flex-direction: column;
            min-width: 0;
            position: relative;

            .lyrics-container {
                flex: 1;
                background: var(--lyric-bg);
                border-radius: 12px;
                transition: background 0.3s;
                overflow: hidden;
                position: relative;

                .no-lyrics {
                    height: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
            }
        }
    }
}

@keyframes rotate {
    from {
        transform: rotate(0deg);
    }

    to {
        transform: rotate(360deg);
    }
}
</style>
