<template>
    <div class="lyric-line" :class="{
        'is-active': isActive,
        'is-passed': isPassed,
        'karaoke-mode': karaokeMode !== 'off',
        'has-translation': line.ttext
    }">
        <!-- 主歌词 -->
        <div class="lyric-text">
            <!-- 卡拉OK模式：逐字渲染 -->
            <template v-if="karaokeMode !== 'off' && line.chars && line.chars.length > 0">
                <LyricChar v-for="(char, index) in line.chars" :key="`${line.time}-${index}`" :char="char"
                    :line-time="line.time" :current-time="currentTime" :is-active="isActive" :is-passed="isPassed"
                    :mode="karaokeMode" />
            </template>

            <!-- 普通模式：整行显示 -->
            <template v-else>
                <span class="lyric-text-content">{{ line.text }}</span>
            </template>
        </div>

        <!-- 翻译文本 -->
        <div v-if="line.ttext" class="lyric-translation">
            {{ line.ttext }}
        </div>
    </div>
</template>

<script setup lang="ts">
import type { LyricLine as LyricLineType } from '@/utils/lyricParser';
import LyricChar from './LyricChar.vue';

// Props 定义
interface Props {
    line: LyricLineType;                    // 歌词行数据
    isActive: boolean;                      // 是否为当前行
    isPassed?: boolean;                     // 是否已播放过
    currentTime: number;                    // 当前播放时间（秒）
    karaokeMode: 'off' | 'style1' | 'style2'; // 卡拉OK模式
}

defineProps<Props>();
</script>

<style scoped lang="scss">
.lyric-line {
    padding: 8px 20px;
    margin: 4px 0;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    text-align: center;
    word-wrap: break-word;
    word-break: break-word;

    // GPU 加速
    will-change: transform, opacity;
    transform: translateZ(0);
    -webkit-transform: translateZ(0);

    // 抗锯齿
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;

    // 整体过渡（用于 margin 等布局属性）
    transition: margin 0.3s cubic-bezier(0.4, 0, 0.2, 1);

    // 主歌词文本
    .lyric-text {
        font-size: var(--lyric-inactive-font-size, 18px);
        line-height: 1.8;
        color: var(--lyric-inactive-text);
        opacity: 1; // 默认不透明度为1（未播放和正在播放）
        // 优化：只过渡需要的属性，提升性能
        transition-property: font-size, color, opacity, transform;
        transition-duration: 0.3s;
        transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
        font-weight: 400;
        min-height: 1.8em; // 确保即使是空行也有最小高度

        .lyric-text-content {
            display: inline-block;
        }
    }

    // 翻译文本
    .lyric-translation {
        font-size: calc(var(--lyric-inactive-font-size, 18px) * 0.85);
        line-height: 1.6;
        color: var(--lyric-inactive-text);
        opacity: 0.8;
        margin-top: 6px;
        // 优化：只过渡需要的属性，提升性能
        transition-property: font-size, color, opacity;
        transition-duration: 0.3s;
        transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    }

    // 当前行样式
    &.is-active {
        margin: 12px 0; // 当前行增加上下间距，使其更突出

        .lyric-text {
            font-size: var(--lyric-active-font-size, 32px);
            line-height: 1.5;
            font-weight: 600;
            opacity: 1; // 当前行保持完全不透明

            // 非卡拉OK模式：整行高亮
            &:not(.karaoke-mode) .lyric-text-content {
                color: var(--lyric-active-text, var(--el-color-primary));
                opacity: 1;
                font-weight: 700;
                text-shadow: 0 2px 8px var(--lyric-active-shadow);
            }
        }

        .lyric-translation {
            font-size: calc(var(--lyric-active-font-size, 32px) * 0.6);
            line-height: 1.4;
            color: var(--lyric-active-text, var(--el-color-primary));
            opacity: 0.9;
            margin-top: 8px;
        }
    }

    // 已播放行样式（变暗）- 全局规则，适用于所有模式
    &.is-passed {
        .lyric-text {
            opacity: 0.5; // 已播放的行变暗
        }

        .lyric-translation {
            opacity: 0.4;
        }
    }

    // 响应式调整：小屏幕减小内边距
    @media (max-width: 768px) {
        padding: 6px 16px;
        margin: 3px 0;

        &.is-active {
            margin: 10px 0;
        }
    }

    @media (max-width: 480px) {
        padding: 5px 12px;
        margin: 2px 0;

        &.is-active {
            margin: 8px 0;
        }
    }

    // 响应式调整：小屏幕限制最大字体大小
    @media (max-width: 768px) {
        &.is-active .lyric-text {
            font-size: min(var(--lyric-active-font-size, 32px), 28px);
        }
    }

    @media (max-width: 480px) {
        &.is-active .lyric-text {
            font-size: min(var(--lyric-active-font-size, 32px), 24px);
        }

        .lyric-text {
            font-size: min(var(--lyric-inactive-font-size, 18px), 16px);
        }
    }
}

// 卡拉OK模式下的特殊处理
.lyric-line.karaoke-mode.is-active {
    .lyric-text {
        // 卡拉OK模式下，字符颜色由 LyricChar 组件控制
        // 这里只设置容器的基础样式
        opacity: 1;
    }
}
</style>
