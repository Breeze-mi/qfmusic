<template>
    <span ref="charRef" class="lyric-char" :class="[
        mode === 'style1' ? 'style1' : 'style2',
        animationState,
        { 'is-passed': isPassed }
    ]">{{ char.text }}</span>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, computed } from 'vue';
import type { LyricChar } from '@/utils/lyricParser';

// Props 定义
interface Props {
    char: LyricChar;           // 字符数据
    lineTime: number;          // 行开始时间（秒）
    currentTime: number;       // 当前播放时间（秒）
    isActive: boolean;         // 所属行是否为当前行
    isPassed?: boolean;        // 所属行是否已播放过
    mode: 'style1' | 'style2'; // 卡拉OK样式
}

const props = defineProps<Props>();

// Refs
const charRef = ref<HTMLElement | null>(null);
const animation = ref<Animation | null>(null);
const animationState = ref<'not-started' | 'playing' | 'completed'>('not-started');

// 计算相对时间（相对于行开始的时间）
const relativeTime = computed(() => props.currentTime - props.lineTime);

// 计算动画持续时间（毫秒）
const animationDuration = computed(() => {
    return (props.char.endTime - props.char.startTime) * 1000;
});

/**
 * 创建 Web Animation API 动画（style2 模式）
 */
function createAnimation(): Animation | null {
    if (!charRef.value || props.mode !== 'style2') {
        return null;
    }

    try {
        const duration = animationDuration.value;

        // 创建 KeyframeEffect
        const effect = new KeyframeEffect(
            charRef.value,
            [
                { backgroundSize: '0% 100%' },
                { backgroundSize: '100% 100%' }
            ],
            {
                duration,
                easing: 'linear',
                fill: 'forwards'
            }
        );

        // 创建 Animation 实例
        const anim = new Animation(effect, document.timeline);

        return anim;
    } catch (error) {
        console.error('创建动画失败:', error);
        // 降级到 CSS 过渡
        if (charRef.value) {
            charRef.value.style.transition = `background-size ${animationDuration.value}ms linear`;
        }
        return null;
    }
}

/**
 * 更新动画状态
 */
function updateAnimationState() {
    const relTime = relativeTime.value;
    const startTime = props.char.startTime;
    const endTime = props.char.endTime;

    // 非当前行，取消动画
    if (!props.isActive) {
        if (animation.value) {
            animation.value.cancel();
        }
        animationState.value = 'not-started';
        return;
    }

    // 未开始
    if (relTime < startTime) {
        if (animation.value) {
            animation.value.cancel();
        }
        animationState.value = 'not-started';
    }
    // 已完成
    else if (relTime >= endTime) {
        if (animation.value && animation.value.playState !== 'finished') {
            animation.value.finish();
        }
        animationState.value = 'completed';
    }
    // 播放中
    else {
        animationState.value = 'playing';

        if (props.mode === 'style2' && animation.value) {
            // 如果动画未运行，启动它
            if (animation.value.playState !== 'running') {
                animation.value.play();

                // 时间漂移校正：计算已经过去的时间
                const elapsed = relTime - startTime;
                const elapsedMs = elapsed * 1000;

                // 设置动画的当前时间以同步
                if (elapsedMs > 0 && elapsedMs < animationDuration.value) {
                    animation.value.currentTime = elapsedMs;
                }
            }
        }
    }
}

/**
 * 初始化动画（仅 style2 模式）
 */
function initAnimation() {
    if (props.mode === 'style2') {
        animation.value = createAnimation();
    }
}

/**
 * 清理动画
 */
function cleanup() {
    if (animation.value) {
        animation.value.cancel();
        animation.value = null;
    }
}

/**
 * 清理主题观察器
 */
function cleanupThemeObserver() {
    if (themeObserver) {
        themeObserver.disconnect();
        themeObserver = null;
    }
}

// 监听 props 变化
watch(
    () => [props.currentTime, props.isActive, props.lineTime],
    () => {
        updateAnimationState();
    },
    { immediate: false }
);

// 监听模式变化，重新初始化动画
watch(
    () => props.mode,
    (newMode, oldMode) => {
        // 先清理旧的观察器（如果从 style2 切换到其他模式）
        if (oldMode === 'style2') {
            cleanupThemeObserver();
        }

        cleanup();
        initAnimation();
        updateAnimationState();

        // 如果切换到 style2，重新创建观察器
        if (newMode === 'style2') {
            observeThemeChanges();
        }
    }
);

// 监听主题颜色变化（通过 CSS 变量）
// 当主题切换时，style2 模式需要重新创建动画以应用新的渐变颜色
let themeObserver: MutationObserver | null = null;

function observeThemeChanges() {
    if (props.mode !== 'style2' || !charRef.value) return;

    // 监听根元素的 style 属性变化（主题切换会修改 CSS 变量）
    themeObserver = new MutationObserver(() => {
        if (props.mode === 'style2' && animation.value) {
            // 主题切换时，重新创建动画以应用新的颜色
            const currentTime = animation.value.currentTime;
            const playState = animation.value.playState;

            cleanup();
            initAnimation();

            // 恢复动画状态
            if (animation.value && playState === 'running' && currentTime !== null) {
                animation.value.play();
                animation.value.currentTime = currentTime;
            } else if (animation.value && playState === 'finished') {
                animation.value.finish();
            }
        }
    });

    themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['style', 'class']
    });
}

// 生命周期
onMounted(() => {
    initAnimation();
    updateAnimationState();
    observeThemeChanges();
});

onUnmounted(() => {
    cleanup();
    cleanupThemeObserver();
});
</script>

<style scoped lang="scss">
.lyric-char {
    display: inline-block;
    position: relative;

    // GPU 加速
    will-change: background-size, transform;
    transform: translateZ(0);
    -webkit-transform: translateZ(0);

    // 抗锯齿
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;

    // Style1: 弹跳效果
    &.style1 {
        // 添加主题颜色过渡
        transition: color 0.3s ease, transform 0.1s ease, opacity 0.3s ease;

        &.not-started {
            color: var(--lyric-inactive-text);
            transform: scale(1) translateY(0);
            opacity: 1;
        }

        &.playing {
            color: var(--lyric-active-text, var(--el-color-primary));
            font-weight: 700;
            opacity: 1;
            animation: karaoke-bounce 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        &.completed {
            color: var(--lyric-active-text, var(--el-color-primary));
            font-weight: 600;
            transform: scale(1) translateY(0);
            opacity: 1;
        }
    }

    // Style2: 渐变填充效果
    &.style2 {
        // 使用 background-clip: text 实现文字颜色渐变
        background-color: var(--lyric-inactive-text);
        background-image: linear-gradient(to right,
                var(--lyric-active-text, var(--el-color-primary)),
                var(--lyric-active-text, var(--el-color-primary)));
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        background-size: 0% 100%;
        background-repeat: no-repeat;
        background-position: left center;
        // 添加主题颜色过渡（不包括 background-size，因为它由动画控制）
        transition: background-color 0.3s ease, background-image 0.3s ease, opacity 0.3s ease;

        &.not-started {
            background-size: 0% 100%;
            opacity: 1;
        }

        &.playing {
            // 动画由 Web Animations API 控制
            opacity: 1;
        }

        &.completed {
            background-size: 100% 100%;
            opacity: 1;
        }
    }

    // 已播放过的行的字符
    &.is-passed {
        opacity: 0.5 !important; // 已播放行的字符变暗
    }
}

// Style1 弹跳动画
@keyframes karaoke-bounce {
    0% {
        transform: scale(1) translateY(0) translateZ(0);
    }

    40% {
        transform: scale(1.25) translateY(-7px) translateZ(0);
    }

    100% {
        transform: scale(1) translateY(0) translateZ(0);
    }
}

// 响应式调整：小屏幕减小弹跳幅度
@media (max-width: 768px) {
    @keyframes karaoke-bounce {
        0% {
            transform: scale(1) translateY(0) translateZ(0);
        }

        40% {
            transform: scale(1.15) translateY(-5px) translateZ(0);
        }

        100% {
            transform: scale(1) translateY(0) translateZ(0);
        }
    }
}

@media (max-width: 480px) {
    @keyframes karaoke-bounce {
        0% {
            transform: scale(1) translateY(0) translateZ(0);
        }

        40% {
            transform: scale(1.1) translateY(-3px) translateZ(0);
        }

        100% {
            transform: scale(1) translateY(0) translateZ(0);
        }
    }
}
</style>
