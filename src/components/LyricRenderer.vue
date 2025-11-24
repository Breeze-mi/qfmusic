<template>
    <div ref="containerRef" class="lyric-renderer">
        <div class="lyric-list">
            <!-- 元信息显示 -->
            <div v-if="hasMetaInfo" class="lyric-meta-info">
                <div v-if="metaInfo.lyricist" class="meta-item">
                    <span class="meta-label">作词：</span>
                    <span class="meta-value">{{ metaInfo.lyricist }}</span>
                </div>
                <div v-if="metaInfo.composer" class="meta-item">
                    <span class="meta-label">作曲：</span>
                    <span class="meta-value">{{ metaInfo.composer }}</span>
                </div>
                <div v-if="metaInfo.arranger" class="meta-item">
                    <span class="meta-label">编曲：</span>
                    <span class="meta-value">{{ metaInfo.arranger }}</span>
                </div>
                <div v-if="metaInfo.album" class="meta-item">
                    <span class="meta-label">专辑：</span>
                    <span class="meta-value">{{ metaInfo.album }}</span>
                </div>
            </div>

            <!-- 歌词列表 -->
            <LyricLine v-for="(line, index) in lyrics" :key="`${line.time}-${index}`"
                :ref="(el) => setLineRef(el, index)" :line="line" :is-active="index === currentLyricIndex"
                :is-passed="index < currentLyricIndex" :current-time="adjustedTime" :karaoke-mode="karaokeMode" />
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import type { LyricLine as LyricLineType, LyricMetaInfo } from '@/utils/lyricParser';
import LyricLine from './LyricLine.vue';

// Props 定义
interface Props {
    lyrics: LyricLineType[];                // 歌词数据
    currentTime: number;                    // 当前播放时间（秒）
    isPlaying: boolean;                     // 是否正在播放
    metaInfo?: LyricMetaInfo;               // 歌词元信息
    karaokeMode: 'off' | 'style1' | 'style2'; // 卡拉OK模式
    lyricOffset?: number;                   // 歌词时间偏移量（秒）
}

const props = withDefaults(defineProps<Props>(), {
    lyricOffset: 0,
    metaInfo: () => ({})
});

// Refs
const containerRef = ref<HTMLElement | null>(null);
const lineRefs = ref<Map<number, HTMLElement>>(new Map());
const isScrolling = ref(false);
const scrollAnimationId = ref<number | null>(null);
const containerWidth = ref<number>(0);
const containerHeight = ref<number>(0);
const prevActiveLine = ref<number>(0); // 记录前一个激活的歌词行索引
const lineHeights = ref<Map<number, number>>(new Map()); // 记录每行的原始高度（未激活时）

// 检查是否有元信息
const hasMetaInfo = computed(() => {
    return !!(
        props.metaInfo?.lyricist ||
        props.metaInfo?.composer ||
        props.metaInfo?.arranger ||
        props.metaInfo?.album
    );
});

// 计算调整后的时间（应用偏移量）
const adjustedTime = computed(() => props.currentTime + props.lyricOffset);

/**
 * 计算当前歌词索引
 */
const currentLyricIndex = computed(() => {
    const time = adjustedTime.value;

    if (!props.lyrics || props.lyrics.length === 0) {
        return -1;
    }

    // 找到最后一个开始时间小于等于当前时间的歌词
    let index = -1;
    for (let i = 0; i < props.lyrics.length; i++) {
        if (props.lyrics[i].time <= time) {
            index = i;
        } else {
            break;
        }
    }

    return index;
});

/**
 * 设置行引用
 */
function setLineRef(el: any, index: number) {
    if (el && el.$el) {
        lineRefs.value.set(index, el.$el);
        // 记录未激活状态下的行高（用于智能滚动位置计算）
        if (index !== currentLyricIndex.value && !lineHeights.value.has(index)) {
            lineHeights.value.set(index, el.$el.clientHeight);
        }
    } else if (el) {
        lineRefs.value.set(index, el);
        if (index !== currentLyricIndex.value && !lineHeights.value.has(index)) {
            lineHeights.value.set(index, el.clientHeight);
        }
    }
}

/**
 * 缓动函数：easeOutCubic - 快速开始，慢速结束
 */
function easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
}

/**
 * 缓动函数：easeInOutQuad - 慢速开始，慢速结束（更平滑，避免"弹"的感觉）
 * 这个函数的特点是开始和结束都很慢，中间才加速
 */
function easeInOutQuad(t: number): number {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/**
 * 平滑滚动到当前歌词
 * @param immediate 是否立即滚动（无动画）
 * @param duration 动画时长（毫秒），默认根据滚动方向自动计算
 */
function scrollToCurrentLyric(immediate = false, duration?: number) {
    if (!containerRef.value || currentLyricIndex.value < 0) {
        return;
    }

    const targetLine = lineRefs.value.get(currentLyricIndex.value);
    if (!targetLine) {
        return;
    }

    const container = containerRef.value;
    const containerHeight = container.clientHeight;
    const targetTop = targetLine.offsetTop;
    const targetHeight = targetLine.clientHeight;

    // 智能位置偏移计算：考虑前一行歌词的高度变化
    // 当歌词从激活状态变为非激活状态时，高度会减小，需要补偿这个差值
    let offset = 0;
    const prevLineIndex = prevActiveLine.value;
    if (prevLineIndex >= 0 && prevLineIndex < currentLyricIndex.value) {
        const prevLine = lineRefs.value.get(prevLineIndex);
        const prevLineOriginalHeight = lineHeights.value.get(prevLineIndex) ?? 0;
        if (prevLine && prevLineOriginalHeight > 0) {
            // 当前高度 - 原始高度 = 高度变化量
            const heightChange = prevLine.clientHeight - prevLineOriginalHeight;
            offset = heightChange;
        }
    }

    // 计算目标滚动位置（将当前行显示在容器上方 1/3 的位置）
    // 减去偏移量以补偿前一行的高度变化
    const targetScroll = targetTop - offset - containerHeight / 3 + targetHeight / 2;

    // 立即滚动（用于快进快退）
    if (immediate) {
        container.scrollTop = targetScroll;
        return;
    }

    // 平滑滚动动画
    const startScroll = container.scrollTop;
    const distance = targetScroll - startScroll;

    // 根据滚动方向和距离调整动画时长（如果没有指定）
    let animationDuration: number;
    if (duration !== undefined) {
        animationDuration = duration;
    } else {
        const isScrollingUp = distance < 0;
        const absDistance = Math.abs(distance);

        if (isScrollingUp) {
            // 向上滚动（快退时）：使用 easeOutCubic，快速开始
            animationDuration = Math.min(800 + absDistance * 0.4, 1400);
        } else {
            // 向下滚动（正常播放时）：使用更长的时间和 easeInOutQuad
            // 基础时长 1500ms，让滚动更慢更平滑
            animationDuration = Math.min(1550 + absDistance * 0.7, 2000);
        }
    }

    const startTime = performance.now();

    // 取消之前的滚动动画
    if (scrollAnimationId.value !== null) {
        cancelAnimationFrame(scrollAnimationId.value);
    }

    function animate(currentTime: number) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / animationDuration, 1);

        // 根据滚动方向选择不同的缓动函数
        const isScrollingUp = distance < 0;
        const easedProgress = isScrollingUp
            ? easeOutCubic(progress)      // 快退：快速开始
            : easeInOutQuad(progress);    // 正常播放：慢速开始，避免"弹"的感觉

        container.scrollTop = startScroll + distance * easedProgress;

        if (progress < 1) {
            scrollAnimationId.value = requestAnimationFrame(animate);
        } else {
            scrollAnimationId.value = null;
            isScrolling.value = false;
        }
    }

    isScrolling.value = true;
    scrollAnimationId.value = requestAnimationFrame(animate);
}

/**
 * 更新容器尺寸
 */
function updateContainerSize() {
    if (containerRef.value) {
        containerWidth.value = containerRef.value.clientWidth;
        containerHeight.value = containerRef.value.clientHeight;
    }
}

/**
 * 处理窗口大小变化
 */
function handleResize() {
    updateContainerSize();
    // 窗口大小变化时，重新计算滚动位置
    nextTick(() => {
        if (currentLyricIndex.value >= 0) {
            scrollToCurrentLyric(false);
        }
    });
}

/**
 * 清理资源
 */
function cleanup() {
    if (scrollAnimationId.value !== null) {
        cancelAnimationFrame(scrollAnimationId.value);
        scrollAnimationId.value = null;
    }
    if (scrollDelayTimer.value !== null) {
        clearTimeout(scrollDelayTimer.value);
        scrollDelayTimer.value = null;
    }
    lineRefs.value.clear();
}

// 延迟滚动定时器
const scrollDelayTimer = ref<number | null>(null);

// 监听当前歌词索引变化，自动滚动
watch(currentLyricIndex, (newIndex, oldIndex) => {
    if (newIndex < 0 || newIndex === oldIndex) {
        return;
    }

    // 清除之前的延迟定时器
    if (scrollDelayTimer.value !== null) {
        clearTimeout(scrollDelayTimer.value);
        scrollDelayTimer.value = null;
    }

    // 判断是否需要立即滚动：
    // 1. oldIndex 为 null（首次加载或歌曲切换）
    // 2. 索引跳跃超过1（快进快退）
    const shouldScrollImmediately = oldIndex == null || Math.abs(newIndex - oldIndex) !== 1;

    if (shouldScrollImmediately) {
        // 立即滚动（无动画）
        nextTick(() => {
            scrollToCurrentLyric(true);
            prevActiveLine.value = newIndex;
        });
    } else {
        // 正常连续播放：先让歌词变色（高亮、放大），延迟后再滚动
        // 延迟 600ms 让用户充分看到变色和卡拉OK动画效果
        scrollDelayTimer.value = window.setTimeout(() => {
            nextTick(() => {
                // 不指定时长，让 scrollToCurrentLyric 根据滚动方向自动计算
                // 向上滚动会使用 3000-5000ms，向下滚动使用 1500-2900ms
                scrollToCurrentLyric(false);
                prevActiveLine.value = newIndex;
            });
            scrollDelayTimer.value = null;
        }, 500);
    }
});

// 监听歌词列表变化，重置滚动位置
watch(() => props.lyrics, () => {
    nextTick(() => {
        if (containerRef.value) {
            containerRef.value.scrollTop = 0;
        }
        lineRefs.value.clear();
        lineHeights.value.clear();
        prevActiveLine.value = 0;
    });
}, { deep: false });

// 生命周期
onMounted(() => {
    // 初始化容器尺寸
    updateContainerSize();

    // 初始滚动到当前歌词
    nextTick(() => {
        if (currentLyricIndex.value >= 0) {
            scrollToCurrentLyric(true);
        }
    });

    // 监听窗口大小变化
    window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
    cleanup();
    window.removeEventListener('resize', handleResize);
});
</script>

<style scoped lang="scss">
.lyric-renderer {
    width: 100%;
    height: 100%;
    overflow-y: auto;
    overflow-x: hidden;
    position: relative;

    // GPU 加速
    will-change: scroll-position;
    transform: translateZ(0);
    -webkit-transform: translateZ(0);

    // 禁用浏览器默认的平滑滚动，使用我们自己的动画控制
    scroll-behavior: auto;

    // 自定义滚动条样式
    &::-webkit-scrollbar {
        width: 6px;
    }

    &::-webkit-scrollbar-track {
        background: transparent;
    }

    &::-webkit-scrollbar-thumb {
        background: var(--lyric-inactive-text);
        opacity: 0.3;
        border-radius: 3px;
        transition: opacity 0.2s ease;

        &:hover {
            opacity: 0.5;
        }
    }

    .lyric-list {
        padding: 40vh 0; // 上下留白，使第一行和最后一行可以居中
        min-height: 100%;

        // 响应式调整：小屏幕减少上下留白
        @media (max-height: 600px) {
            padding: 30vh 0;
        }

        @media (max-height: 400px) {
            padding: 20vh 0;
        }
    }

    // 元信息样式
    .lyric-meta-info {
        text-align: center;
        padding: 16px 20px;
        margin-bottom: 20px;

        .meta-item {
            font-size: 13px;
            line-height: 1.8;
            color: var(--lyric-inactive-text);
            opacity: 0.7;
            margin: 2px 0;
            transition: color 0.3s ease, opacity 0.3s ease;

            .meta-label {
                font-weight: 500;
                margin-right: 4px;
            }

            .meta-value {
                font-weight: 400;
            }
        }

        // 响应式调整：小屏幕减小字体
        @media (max-width: 768px) {
            padding: 12px 16px;
            margin-bottom: 16px;

            .meta-item {
                font-size: 12px;
                line-height: 1.6;
            }
        }
    }
}
</style>
