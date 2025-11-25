<template>
    <div class="song-detail-page">
        <!-- 顶部栏 -->
        <div class="top-bar">
            <h2 class="page-title clickable" @click="navigateToHome" title="返回主页">
                {{ playerStore.currentSong?.name || '播放详情' }}
            </h2>
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

const navigateToHome = () => {
    router.push("/");
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
            // 优先使用yrc格式的逐字歌词
            const parsed = parseLyric(
                detail.lyric,
                detail.tlyric,
                detail.yrc,
                detail.yrc2
            );
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

            &.clickable {
                cursor: pointer;
                transition: color 0.3s ease, transform 0.2s ease;

                &:hover {
                    color: var(--el-color-primary);
                    transform: translateX(-2px);
                }

                &:active {
                    transform: translateX(-2px) scale(0.98);
                }
            }
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
        padding: 20px 40px; // 减少上下 padding 从 40px 到 20px
        gap: 60px;
        padding-bottom: 100px; // 底部保持足够空间给播放器

        .left-section {
            flex: 0 0 45%;
            display: flex;
            flex-direction: column;
            align-items: flex-start; // 改为左对齐
            justify-content: center;
            padding-left: 60px; // 整体左移

            .album-cover-wrapper {
                margin-bottom: 30px;

                .album-cover {
                    width: 380px; // 稍微增大（从350px增加到380px）
                    height: 380px;
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
                    width: 380px; // 稍微增大（从300px增加到380px）
                    height: 380px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 120px; // 稍微增大（从100px增加到120px）
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
                max-width: 380px; // 匹配封面宽度

                .song-name {
                    font-size: 26px;
                    font-weight: 600;
                    color: var(--el-text-color-primary);
                    margin: 0 0 10px 0;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .song-artist,
                .song-album {
                    font-size: 15px;
                    color: var(--el-text-color-secondary);
                    margin: 3px 0;
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

// 响应式设计：小屏幕时进一步缩小封面
// @media (max-width: 1400px) {
//     .song-detail-page .detail-content {
//         .left-section {
//             .album-cover-wrapper {

//                 .album-cover,
//                 .album-cover-placeholder {
//                     width: 300px;
//                     height: 300px;
//                 }

//                 .album-cover-placeholder {
//                     font-size: 80px;
//                 }
//             }

//             .song-info {
//                 max-width: 300px;

//                 .song-name {
//                     font-size: 22px;
//                 }

//                 .song-artist,
//                 .song-album {
//                     font-size: 14px;
//                 }
//             }
//         }
//     }
// }

// @media (max-width: 1200px) {
//     .song-detail-page .detail-content {
//         gap: 40px;

//         .left-section {
//             .album-cover-wrapper {
//                 margin-bottom: 20px;

//                 .album-cover,
//                 .album-cover-placeholder {
//                     width: 220px;
//                     height: 220px;
//                 }

//                 .album-cover-placeholder {
//                     font-size: 70px;
//                 }
//             }

//             .song-info {
//                 max-width: 220px;

//                 .song-name {
//                     font-size: 20px;
//                 }

//                 .song-artist,
//                 .song-album {
//                     font-size: 13px;
//                 }
//             }
//         }
//     }
// }</style>
