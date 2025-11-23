<template>
    <div class="lyric-canvas-container" ref="containerRef">
        <canvas ref="canvasRef" class="lyric-canvas"></canvas>
    </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, computed } from 'vue';
import { useThemeStore } from '@/stores/theme';
import { useSettingsStore } from '@/stores/settings';
import type { LyricLine } from '@/utils/lyricParser';

// Props
const props = defineProps<{
    lyrics: LyricLine[];
    currentLyricIndex: number;
    currentTime: number;
}>();

const containerRef = ref<HTMLElement>();
const canvasRef = ref<HTMLCanvasElement>();
const themeStore = useThemeStore();
const settingsStore = useSettingsStore();

let animationFrameId: number | null = null;
let ctx: CanvasRenderingContext2D | null = null;

// 获取当前主题颜色
const getThemeColors = () => {
    const root = document.documentElement;
    const computedStyle = getComputedStyle(root);

    return {
        activeColor: computedStyle.getPropertyValue('--lyric-active-text').trim() ||
            computedStyle.getPropertyValue('--el-color-primary').trim() || '#409eff',
        inactiveColor: computedStyle.getPropertyValue('--lyric-inactive-text').trim() || '#909399',
        bgColor: computedStyle.getPropertyValue('--lyric-bg').trim() ||
            computedStyle.getPropertyValue('--el-bg-color').trim() || '#ffffff',
    };
};

// 初始化Canvas
const initCanvas = () => {
    if (!canvasRef.value || !containerRef.value) return;

    const canvas = canvasRef.value;
    const container = containerRef.value;

    // 设置Canvas尺寸（使用设备像素比以获得清晰显示）
    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    ctx = canvas.getContext('2d');
    if (ctx) {
        ctx.scale(dpr, dpr);
    }
};

// 渲染歌词
const renderLyrics = () => {
    if (!ctx || !canvasRef.value || !containerRef.value) return;

    const canvas = canvasRef.value;
    const container = containerRef.value;
    const rect = container.getBoundingClientRect();
    const colors = getThemeColors();

    // 清空画布
    ctx.clearRect(0, 0, rect.width, rect.height);

    // 设置字体
    const activeFontSize = settingsStore.lyricActiveFontSize;
    const inactiveFontSize = settingsStore.lyricInactiveFontSize;
    const fontFamily = settingsStore.fontFamily;

    // 计算布局
    const centerY = rect.height / 2;
    const lineHeight = activeFontSize * 2.5;
    const visibleLines = Math.floor(rect.height / lineHeight);
    const startIndex = Math.max(0, props.currentLyricIndex - Math.floor(visibleLines / 2));

    // 渲染可见的歌词行
    props.lyrics.slice(startIndex, startIndex + visibleLines).forEach((line, index) => {
        const actualIndex = startIndex + index;
        const isActive = actualIndex === props.currentLyricIndex;
        const fontSize = isActive ? activeFontSize : inactiveFontSize;
        const y = centerY + (index - Math.floor(visibleLines / 2)) * lineHeight;

        // 设置字体
        ctx!.font = `${isActive ? 600 : 400} ${fontSize}px ${fontFamily}`;
        ctx!.textAlign = 'center';
        ctx!.textBaseline = 'middle';

        if (isActive) {
            // 当前行：渐变填充效果
            renderGradientLine(line, rect.width / 2, y, colors);
        } else {
            // 非当前行：普通显示
            ctx!.fillStyle = colors.inactiveColor;
            ctx!.globalAlpha = actualIndex < props.currentLyricIndex ? 0.5 : 0.75;
            ctx!.fillText(line.text, rect.width / 2, y);
            ctx!.globalAlpha = 1;
        }

        // 渲染翻译（如果有）
        if (settingsStore.showLyricTranslation && line.ttext) {
            const translationY = y + fontSize * 0.8;
            ctx!.font = `400 ${fontSize * 0.6}px ${fontFamily}`;
            ctx!.fillStyle = isActive ? colors.activeColor : colors.inactiveColor;
            ctx!.globalAlpha = isActive ? 0.85 : 0.6;
            ctx!.fillText(line.ttext, rect.width / 2, translationY);
            ctx!.globalAlpha = 1;
        }
    });
};

// 渲染渐变填充的歌词行
const renderGradientLine = (line: LyricLine, x: number, y: number, colors: any) => {
    if (!ctx) return;

    const text = line.text;

    // 计算播放进度
    const relativeTime = props.currentTime - line.time;
    const lineDuration = line.duration || 4;
    let progress = 0;

    if (relativeTime < 0) {
        progress = 0;
    } else if (relativeTime >= lineDuration) {
        progress = 1;
    } else {
        progress = relativeTime / lineDuration;
    }

    // 测量文本宽度
    const textWidth = ctx.measureText(text).width;
    const startX = x - textWidth / 2;

    // 计算渐变分界点
    const gradientX = startX + textWidth * progress;

    // 先绘制未播放部分（灰色）
    ctx.fillStyle = colors.inactiveColor;
    ctx.globalAlpha = 0.75;
    ctx.fillText(text, x, y);
    ctx.globalAlpha = 1;

    // 使用clip绘制已播放部分（主题色）
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, y - settingsStore.lyricActiveFontSize, gradientX, settingsStore.lyricActiveFontSize * 2);
    ctx.clip();

    ctx.fillStyle = colors.activeColor;
    ctx.globalAlpha = 1;
    ctx.fillText(text, x, y);

    ctx.restore();

    // 添加发光效果（可选）
    if (progress > 0 && progress < 1) {
        ctx.save();
        ctx.shadowColor = colors.activeColor;
        ctx.shadowBlur = 10;
        ctx.globalAlpha = 0.3;

        ctx.beginPath();
        ctx.rect(gradientX - 5, y - settingsStore.lyricActiveFontSize, 10, settingsStore.lyricActiveFontSize * 2);
        ctx.clip();

        ctx.fillStyle = colors.activeColor;
        ctx.fillText(text, x, y);

        ctx.restore();
    }
};

// 动画循环
const animate = () => {
    renderLyrics();
    animationFrameId = requestAnimationFrame(animate);
};

// 处理窗口大小变化
const handleResize = () => {
    initCanvas();
    renderLyrics();
};

// 监听主题变化
watch(() => themeStore.isDark, () => {
    renderLyrics();
});

// 监听歌词变化
watch(() => [props.lyrics, props.currentLyricIndex, props.currentTime], () => {
    // 由动画循环自动更新
}, { deep: true });

// 生命周期
onMounted(() => {
    initCanvas();
    animate();
    window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
    if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
    }
    window.removeEventListener('resize', handleResize);
});
</script>

<style scoped lang="scss">
.lyric-canvas-container {
    width: 100%;
    height: 100%;
    position: relative;
    overflow: hidden;
}

.lyric-canvas {
    display: block;
    width: 100%;
    height: 100%;
}
</style>
