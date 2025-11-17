<template>
    <div class="song-detail-page">
        <!-- 顶部栏 -->
        <div class="top-bar">
            <el-button circle :icon="ArrowLeft" @click="goBack" title="返回" />
            <span class="page-title">{{ playerStore.currentSong?.name || '播放详情' }}</span>
            <div class="spacer"></div>
        </div>

        <!-- 主内容区：左右布局 -->
        <div class="detail-content">
            <!-- 左侧：封面和歌曲信息 -->
            <div class="left-section">
                <div class="album-cover-wrapper">
                    <div class="album-cover" :class="{ rotating: playerStore.isPlaying }" :style="{
                        backgroundImage: playerStore.currentSong
                            ? `url(${playerStore.currentSong.picUrl})`
                            : 'none',
                    }"></div>
                </div>
                <div class="song-info">
                    <h2 class="song-name">{{ playerStore.currentSong?.name || '未知歌曲' }}</h2>
                    <p class="song-artist">艺术家：{{ playerStore.currentSong?.artists || '--' }}</p>
                    <p class="song-album">专辑：{{ playerStore.currentSong?.album || '--' }}</p>
                </div>
            </div>

            <!-- 右侧：歌词 -->
            <div class="right-section">
                <div class="lyrics-container" ref="lyricsContainerRef">
                    <div v-if="lyrics.length > 0" class="lyrics">
                        <div v-for="(line, index) in lyrics" :key="index" class="lyric-line"
                            :class="{ active: index === currentLyricIndex }"
                            :ref="(el: any) => { if (index === currentLyricIndex) currentLyricRef = el }">
                            {{ line.text }}
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
import { ArrowLeft } from "@element-plus/icons-vue";
import { usePlayerStore } from "@/stores/player";

const router = useRouter();
const playerStore = usePlayerStore();

interface LyricLine {
    time: number;
    text: string;
}

const lyrics = ref<LyricLine[]>([]);
const currentLyricIndex = ref(0);
const lyricsContainerRef = ref<HTMLElement>();
const currentLyricRef = ref<HTMLElement>();
let scrollTimer: number | null = null;
let scrollAnimationFrame: number | null = null;

const goBack = () => {
    router.back();
};

// 解析歌词
const parseLyric = (lyricText: string) => {
    if (!lyricText) return [];

    const lines = lyricText.split("\n");
    const result: LyricLine[] = [];

    lines.forEach((line) => {
        const match = line.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/);
        if (match) {
            const minutes = parseInt(match[1]);
            const seconds = parseInt(match[2]);
            const milliseconds = parseInt(match[3]);
            const time = minutes * 60 + seconds + milliseconds / 1000;
            const text = match[4].trim();
            if (text) {
                result.push({ time, text });
            }
        }
    });

    return result.sort((a, b) => a.time - b.time);
};

// 监听歌曲详情变化，解析歌词
watch(
    () => playerStore.currentSongDetail,
    (detail) => {
        if (detail?.lyric) {
            lyrics.value = parseLyric(detail.lyric);
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

    // 取消之前的动画
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
    // 清除之前的定时器
    if (scrollTimer !== null) {
        clearTimeout(scrollTimer);
    }

    // 延迟900ms后滚动，先让歌词高亮变色，用户看到后再滚动
    scrollTimer = window.setTimeout(() => {
        nextTick(() => {
            if (currentLyricRef.value && lyricsContainerRef.value) {
                const container = lyricsContainerRef.value;
                const lyric = currentLyricRef.value as HTMLElement;
                const containerHeight = container.clientHeight;
                const lyricTop = lyric.offsetTop;
                const lyricHeight = lyric.clientHeight;
                const targetScrollTop = lyricTop - containerHeight / 2 + lyricHeight / 2;

                // 使用自定义平滑滚动，持续时间1000ms
                smoothScrollTo(container, targetScrollTop, 1000);
            }
        });
    }, 860);
};



onMounted(() => {
    // 初始化时解析歌词
    if (playerStore.currentSongDetail?.lyric) {
        lyrics.value = parseLyric(playerStore.currentSongDetail.lyric);
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
        padding: 16px 24px;
        background: var(--el-bg-color);
        border-bottom: 1px solid var(--el-border-color);
        flex-shrink: 0;

        .page-title {
            font-size: 18px;
            font-weight: 600;
            color: var(--el-text-color-primary);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .spacer {
            flex: 1;
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
            }

            .song-info {
                text-align: left;
                width: 100%;
                max-width: 400px; //旋转图片大小

                .song-name {
                    font-size: 30px;
                    font-weight: 600;
                    color: var(--el-text-color-primary);
                    margin: 0 0 20px 0;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .song-artist,
                .song-album {
                    font-size: 16px;
                    color: var(--el-text-color-secondary);
                    margin: 8px 0;
                    line-height: 1.6;
                }
            }
        }

        .right-section {
            flex: 1;
            display: flex;
            flex-direction: column;
            min-width: 0;

            .lyrics-container {
                flex: 1;
                overflow-y: auto;
                padding: 20px;
                background: var(--el-fill-color-lighter);
                border-radius: 12px;
                scroll-behavior: auto; // 禁用浏览器默认的平滑滚动，使用自定义动画

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

                    .lyric-line {
                        text-align: center;
                        font-size: 19px; //普通歌词
                        line-height: 2.8;
                        color: var(--el-text-color-regular);
                        transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                        padding: 8px 0;
                        cursor: default;
                        opacity: 0.65;

                        &.active {
                            font-size: 30px; //当前播放歌词
                            font-weight: 600;
                            color: var(--el-color-primary);
                            opacity: 1;
                            transform: scale(1.05);
                            text-shadow: 0 2px 8px rgba(64, 158, 255, 0.2);
                        }

                        // 当前歌词的前一句和后一句稍微突出一些
                        &.active+.lyric-line,
                        &:has(+ .active) {
                            opacity: 0.8;
                            color: var(--el-text-color-regular);
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
</style>
