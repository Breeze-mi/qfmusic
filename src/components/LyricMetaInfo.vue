<template>
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
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { LyricMetaInfo } from '@/utils/lyricParser';

// Props 定义
interface Props {
    metaInfo: LyricMetaInfo;  // 歌词元信息
}

const props = defineProps<Props>();

// 检查是否有元信息
const hasMetaInfo = computed(() => {
    return !!(
        props.metaInfo.lyricist ||
        props.metaInfo.composer ||
        props.metaInfo.arranger ||
        props.metaInfo.album
    );
});
</script>

<style scoped lang="scss">
.lyric-meta-info {
    position: sticky;
    top: 0;
    z-index: 10;
    padding: 16px 20px;
    background: linear-gradient(to bottom,
            var(--lyric-bg) 0%,
            var(--lyric-bg) 70%,
            transparent 100%);
    text-align: center;

    // GPU 加速
    will-change: transform;
    transform: translateZ(0);
    -webkit-transform: translateZ(0);

    .meta-item {
        font-size: 13px;
        line-height: 1.8;
        color: var(--lyric-inactive-text);
        opacity: 0.7;
        margin: 2px 0;

        .meta-label {
            font-weight: 500;
            margin-right: 4px;
        }

        .meta-value {
            font-weight: 400;
        }
    }

    // 响应式调整
    @media (max-width: 768px) {
        padding: 12px 16px;

        .meta-item {
            font-size: 12px;
        }
    }
}
</style>
