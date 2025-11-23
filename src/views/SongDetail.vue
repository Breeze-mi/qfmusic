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
                <!-- 样式二：使用Canvas渲染 -->
                <div v-if="settingsStore.karaokeMode === 'style2' && lyrics.length > 0" class="lyrics-container-canvas">
                    <LyricCanvasRenderer :lyrics="lyrics" :currentLyricIndex="currentLyricIndex"
                        :currentTime="playerStore.currentTime" />
                </div>
                <!-- 其他样式：使用DOM渲染 -->
                <div v-else class="lyrics-container" ref="lyricsContainerRef">
                    <div v-if="lyrics.length > 0" class="lyrics">
                        <div v-for="(line, index) in lyrics" :key="index" class="lyric-item"
                            :class="{ active: index === currentLyricIndex }"
                            :ref="(el: any) => { if (index === currentLyricIndex) currentLyricRef = el }">
                            <!-- 卡拉OK样式一：弹跳效果 -->
                            <div v-if="settingsStore.karaokeMode === 'style1' && line.chars && line.chars.length > 0"
                                class="lyric-line karaoke-style1">
                                <span v-for="(char, charIndex) in line.chars" :key="charIndex" class="lyric-char"
                                    :class="getCharClass(index, line, char)" :style="getCharStyle(char)">
                                    {{ char.text }}
                                </span>
                            </div>
                            <!-- 普通模式：整行高亮 -->
                            <div v-else class="lyric-line">{{ line.text }}</div>
                            <div v-if="settingsStore.showLyricTranslation && line.ttext" class="lyric-translation">
                                {{ line.ttext }}
                            </div>
                        </div>
                    </div>
                    <div v-else class="no-lyrics">
                        <el-empty description="暂无歌词" />
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted } from "vue";
import { useRouter } from "vue-router";
import { Setting, Sunny, Moon } from "@element-plus/icons-vue";
import { usePlayerStore } from "@/stores/player";
import { useThemeStore } from "@/stores/theme";
import { useSettingsStore } from "@/stores/settings";
import LyricCanvasRenderer from "@/components/LyricCanvasRenderer.vue";
import {
    parseLyric,
    getCharHighlightClass,
    getCharAnimationStyle,
    type LyricLine,
    type LyricChar,
} from "@/utils/lyricParser";

const router = useRouter();
const playerStore = usePlayerStore();
const themeStore = useThemeStore();
const settingsStore = useSettingsStore();

const navigateToSettings = () => {
    router.push("/settings");
};

const lyrics = ref<LyricLine[]>([]);
const currentLyricIndex = ref(0);
const lyricsContainerRef = ref<HTMLElement>();
const currentLyricRef = ref<HTMLElement>();
let scrollTimer: number | null = null;
let scrollAnimationFrame: number | null = null;

// 包装函数：调用工具函数
const getCharClass = (lineIndex: number, line: LyricLine, char: LyricChar) => {
    return getCharHighlightClass(
        lineIndex,
        currentLyricIndex.value,
        playerStore.currentTime,
        line,
        char
    );
};

const getCharStyle = (char: LyricChar) => {
    return getCharAnimationStyle(char);
};

// 监听歌曲详情变化，解析歌词
watch(
    () => playerStore.currentSongDetail,
    (detail) => {
        if (detail?.lyric) {
            lyrics.value = parseLyric(detail.lyric, detail.tlyric);
        } else {
            lyrics.value = [];
        }
        currentLyricIndex.value = 0;
    },
    { immediate: true }
);

// 监听播放时间，更新当前歌词
watch(
    () => playerStore.currentTime,
    (time) => {
        if (lyrics.value.length === 0) return;

        for (let i = 0; i < lyrics.value.length; i++) {
            if (time < lyrics.value[i].time) {
                const newIndex = Math.max(0, i - 1);
                if (newIndex !== currentLyricIndex.value) {
                    currentLyricIndex.value = newIndex;
                    scrollToCurrentLyric();
                }
                break;
            }
            if (i === lyrics.value.length - 1) {
                if (currentLyricIndex.value !== i) {
                    currentLyricIndex.value = i;
                    scrollToCurrentLyric();
                }
            }
        }
    }
);

// 缓动函数：easeOutCubic，让滚动更自然
const easeOutCubic = (t: number): number => {
    return 1 - Math.pow(1 - t, 3);
};

// 自定义平滑滚动动画
const smoothScrollTo = (element: HTMLElement, targetScrollTop: number, duration: number) => {
    const startScrollTop = element.scrollTop;
    const distance = targetScrollTop - startScrollTop;
    const startTime = performance.now();

    // 取消之前的动画，避免多个动画冲突
    if (scrollAnimationFrame !== null) {
        cancelAnimationFrame(scrollAnimationFrame);
    }

    const animateScroll = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easedProgress = easeOutCubic(progress);

        element.scrollTop = startScrollTop + distance * easedProgress;

        if (progress < 1) {
            scrollAnimationFrame = requestAnimationFrame(animateScroll);
        } else {
            scrollAnimationFrame = null;
        }
    };

    scrollAnimationFrame = requestAnimationFrame(animateScroll);
};

// 滚动到当前歌词（带延迟）
const scrollToCurrentLyric = () => {
    if (scrollTimer !== null) {
        clearTimeout(scrollTimer);
    }

    scrollTimer = window.setTimeout(() => {
        nextTick(() => {
            if (currentLyricRef.value && lyricsContainerRef.value) {
                const container = lyricsContainerRef.value;
                const lyric = currentLyricRef.value as HTMLElement;
                const containerHeight = container.clientHeight;
                const lyricTop = lyric.offsetTop;
                const lyricHeight = lyric.clientHeight;
                const targetScrollTop = lyricTop - containerHeight / 2 + lyricHeight / 2;

                smoothScrollTo(container, targetScrollTop, 2000);
            }
        });
    }, 1000);
};

onMounted(() => {
    if (playerStore.currentSongDetail?.lyric) {
        lyrics.value = parseLyric(playerStore.currentSongDetail.lyric, playerStore.currentSongDetail.tlyric);
    }
});
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

            .lyrics-container-canvas {
                flex: 1;
                background: var(--lyric-bg);
                border-radius: 12px;
                transition: background 0.3s;
                overflow: hidden;
            }

            .lyrics-container {
                flex: 1;
                overflow-y: auto;
                padding: 20px;
                background: var(--lyric-bg);
                border-radius: 12px;
                scroll-behavior: auto; // 禁用浏览器默认的平滑滚动，使用自定义动画
                transition: background 0.3s;

                &::-webkit-scrollbar {
                    width: 8px;
                }

                &::-webkit-scrollbar-track {
                    background: var(--el-fill-color-light);
                    border-radius: 4px;
                }

                &::-webkit-scrollbar-thumb {
                    background: var(--el-fill-color-dark);
                    border-radius: 4px;

                    &:hover {
                        background: var(--el-text-color-secondary);
                    }
                }

                .lyrics {
                    padding: 100px 20px;

                    .lyric-item {
                        text-align: center;
                        padding: 8px 0;
                        cursor: default;
                        transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);

                        .lyric-line {
                            font-size: var(--lyric-inactive-font-size, 18px);
                            line-height: 2;
                            color: var(--lyric-inactive-text);
                            opacity: 0.75;

                            // 卡拉OK样式一：弹跳效果
                            &.karaoke-style1 {
                                .lyric-char {
                                    display: inline-block;
                                    transition: color 0.15s ease-out,
                                        opacity 0.15s ease-out,
                                        font-weight 0.15s ease-out,
                                        text-shadow 0.15s ease-out;
                                    transform-origin: center bottom;
                                    will-change: transform;

                                    color: inherit;
                                    opacity: inherit;

                                    &.char-singing {
                                        color: var(--lyric-active-text, var(--el-color-primary));
                                        opacity: 1;
                                        font-weight: 700;
                                        text-shadow: 0 2px 12px var(--lyric-active-shadow);
                                        animation: karaoke-bounce var(--animation-duration, 0.4s) cubic-bezier(0.34, 1.56, 0.64, 1);
                                    }

                                    &.char-sung {
                                        color: var(--lyric-active-text, var(--el-color-primary));
                                        opacity: 0.9;
                                        font-weight: 600;
                                        transform: scale(1);
                                        transition: all 0.2s ease-out;
                                    }
                                }
                            }

                            // 卡拉OK样式二：整行渐变填充效果（完美方案）
                            &.karaoke-style2 {
                                position: relative;
                                font-weight: 600;

                                // 基础文本层（未播放颜色）
                                .lyric-text-base {
                                    color: var(--lyric-inactive-text);
                                    opacity: 0.75;
                                }

                                // 渐变文本层（已播放颜色）
                                .lyric-text-gradient {
                                    position: absolute;
                                    left: 0;
                                    top: 0;
                                    color: var(--lyric-active-text, var(--el-color-primary));

                                    // 使用clip-path裁剪，实现从左到右的填充效果
                                    clip-path: inset(0 calc(100% - var(--line-gradient-progress, 0%)) 0 0);
                                    -webkit-clip-path: inset(0 calc(100% - var(--line-gradient-progress, 0%)) 0 0);

                                    // 性能优化
                                    will-change: clip-path;

                                    // GPU加速
                                    transform: translateZ(0);
                                    -webkit-transform: translateZ(0);

                                    // 抗锯齿
                                    -webkit-font-smoothing: antialiased;
                                    -moz-osx-font-smoothing: grayscale;
                                }
                            }
                        }

                        .lyric-translation {
                            font-size: calc(var(--lyric-inactive-font-size, 18px) * 0.85);
                            line-height: 1.8;
                            color: var(--lyric-inactive-text);
                            opacity: 0.6;
                            margin-top: 4px;
                        }

                        &.active {
                            transform: scale(1.05);

                            .lyric-line {
                                font-size: var(--lyric-active-font-size, 32px);

                                // 普通模式：整行高亮
                                &:not(.karaoke-mode) {
                                    font-weight: 700;
                                    color: var(--lyric-active-text, var(--el-color-primary));
                                    opacity: 1;
                                    text-shadow: 0 2px 8px var(--lyric-active-shadow);
                                }

                                // 卡拉OK样式一：保持基础样式
                                &.karaoke-style1 {
                                    font-weight: 400;
                                }

                                // 卡拉OK样式二：保持基础样式
                                &.karaoke-style2 {
                                    font-weight: 400;
                                }
                            }

                            .lyric-translation {
                                font-size: calc(var(--lyric-active-font-size, 32px) * 0.6);
                                color: var(--lyric-active-text, var(--el-color-primary));
                                opacity: 0.85;
                            }
                        }
                    }
                }

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

// 卡拉OK弹跳动画（优化版：更平滑的曲线）
@keyframes karaoke-bounce {
    0% {
        transform: scale(1) translateY(0);
        opacity: 0.75;
    }

    20% {
        transform: scale(1.15) translateY(-4px);
        opacity: 0.9;
    }

    40% {
        transform: scale(1.25) translateY(-7px);
        opacity: 1;
    }

    60% {
        transform: scale(1.2) translateY(-5px);
        opacity: 1;
    }

    80% {
        transform: scale(1.05) translateY(-1px);
        opacity: 1;
    }

    100% {
        transform: scale(1) translateY(0);
        opacity: 1;
    }
}
</style>
