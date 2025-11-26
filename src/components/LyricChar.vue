<template>
    <span ref="charRef" class="lyric-char" :class="[
        mode === 'style1' ? 'style1' : 'style2',
        animationState,
        { 'is-passed': isPassed },
        { 'is-space': char.text === ' ' },
        { 'has-space': char.text.includes(' ') && char.text !== ' ' }
    ]" :style="charAnimationStyle">{{ char.text }}</span>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, computed } from 'vue';
import type { LyricChar } from '@/utils/lyricParser';
import { globalThemeObserver } from '@/utils/themeObserver';

// Props 定义
interface Props {
    char: LyricChar;           // 字符数据
    lineTime: number;          // 行开始时间（秒）
    currentTime: number;       // 当前播放时间（秒）
    isActive: boolean;         // 所属行是否为当前行
    isPassed?: boolean;        // 所属行是否已播放过
    mode: 'style1' | 'style2'; // 卡拉OK样式
    bounceGroup?: { groupId: number; groupSize: number; groupStartTime: number }; // 弹跳分组信息
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
    const duration = (props.char.endTime - props.char.startTime) * 1000;
    // 确保持续时间为正数，最小值为50ms
    return Math.max(duration, 50);
});

// 计算字符动画样式（自适应动画时长 + 智能分组弹跳）
const charAnimationStyle = computed<Record<string, string>>(() => {
    const duration = animationDuration.value;

    // Style1 弹跳动画：根据分组大小和字符持续时间智能调整动画时长
    let bounceTime = duration;

    if (props.mode === 'style1' && props.bounceGroup) {
        const { groupSize } = props.bounceGroup;

        // 🔑 智能分组弹跳策略（适配各种节奏）：
        // 核心思想：确保弹跳动画清晰可见，同时不超过字符实际播放时间

        // 先根据分组大小确定理想的弹跳时长
        let idealBounceTime: number;

        if (groupSize === 1) {
            idealBounceTime = duration * 0.75;
        } else if (groupSize === 2) {
            idealBounceTime = 280;
        } else if (groupSize === 3) {
            idealBounceTime = 260;
        } else if (groupSize === 4) {
            idealBounceTime = 240;
        } else {
            idealBounceTime = 220;
        }

        // 🔑 关键优化：弹跳时长不能超过字符实际时长的85%
        const maxBounceTime = duration * 0.85;
        bounceTime = Math.min(idealBounceTime, maxBounceTime);

        // 🔑 最小值保护：至少120ms，但如果字符很短（<150ms），则用80%
        const minBounceTime = duration < 150 ? duration * 0.8 : 120;
        bounceTime = Math.max(minBounceTime, bounceTime);

        // 🔑 最大值保护：不超过420ms
        bounceTime = Math.min(bounceTime, 420);
    } else {
        // Style2 或无分组信息：使用原有逻辑
        if (duration < 200) {
            bounceTime = duration * 0.8;
        } else if (duration <= 400) {
            bounceTime = duration;
        } else {
            bounceTime = 400;
        }
    }

    return {
        '--bounce-duration': `${bounceTime}ms`,
    };
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
 * 更新动画状态（支持分组弹跳）
 */
function updateAnimationState() {
    const relTime = relativeTime.value;
    let startTime = props.char.startTime;
    const endTime = props.char.endTime;

    // 非当前行，取消动画
    if (!props.isActive) {
        if (animation.value) {
            animation.value.cancel();
        }
        animationState.value = 'not-started';
        return;
    }

    // 🔑 分组弹跳优化（仅 Style1）：
    // 同一组的字符使用组的开始时间，实现真正的同时弹跳
    if (props.mode === 'style1' && props.bounceGroup && props.bounceGroup.groupSize > 1) {
        // 使用组的开始时间替代字符自己的开始时间
        // 这样同组的所有字符会在同一时刻触发弹跳动画
        startTime = props.bounceGroup.groupStartTime;
    }

    // 添加小的缓冲区，避免浮点数精度问题
    const BUFFER = 0.001; // 1毫秒缓冲

    // 未开始
    if (relTime < startTime - BUFFER) {
        if (animation.value) {
            animation.value.cancel();
        }
        animationState.value = 'not-started';
    }
    // 已完成
    else if (relTime >= endTime + BUFFER) {
        if (animation.value && animation.value.playState !== 'finished') {
            animation.value.finish();
        }
        animationState.value = 'completed';
    }
    // 播放中
    else {
        // 🔑 关键修复：检测是否刚进入播放状态
        const wasNotPlaying = animationState.value !== 'playing';

        animationState.value = 'playing';

        // Style1 弹跳动画：刚进入播放状态时，强制重新触发动画
        if (props.mode === 'style1' && wasNotPlaying && charRef.value) {
            // 通过移除并重新添加 animation 来强制重新触发 CSS 动画
            const element = charRef.value;
            element.style.animation = 'none';
            void element.offsetHeight; // 强制重排
            element.style.animation = ''; // 恢复动画
        }

        if (props.mode === 'style2' && animation.value) {
            // 时间漂移校正：计算已经过去的时间
            const elapsed = relTime - startTime;
            const elapsedMs = Math.max(0, elapsed * 1000);

            // 如果动画未运行或暂停，启动它
            if (animation.value.playState !== 'running') {
                animation.value.play();
            }

            // 同步动画时间（关键：每次更新都同步，确保精确）
            if (elapsedMs >= 0 && elapsedMs <= animationDuration.value) {
                animation.value.currentTime = elapsedMs;
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

// 用于保存取消订阅函数
let unsubscribeTheme: (() => void) | null = null;

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
        // 清理旧的主题订阅
        if (oldMode === 'style2' && unsubscribeTheme) {
            unsubscribeTheme();
            unsubscribeTheme = null;
        }

        cleanup();
        initAnimation();
        updateAnimationState();

        // 如果切换到 style2，订阅主题变化
        if (newMode === 'style2') {
            subscribeToThemeChanges();
        }
    }
);

/**
 * 订阅全局主题变化
 * 使用全局观察器代替每个组件独立创建，提升性能
 */
function subscribeToThemeChanges() {
    if (props.mode !== 'style2') return;

    // 订阅主题变化
    unsubscribeTheme = globalThemeObserver.subscribe(() => {
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
}

// 生命周期
onMounted(() => {
    initAnimation();
    updateAnimationState();
    // 如果是 style2 模式，订阅主题变化
    if (props.mode === 'style2') {
        subscribeToThemeChanges();
    }
});

onUnmounted(() => {
    cleanup();
    // 取消主题订阅
    if (unsubscribeTheme) {
        unsubscribeTheme();
        unsubscribeTheme = null;
    }
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

    // 空格字符保持可见宽度
    &.is-space {
        white-space: pre; // 保留空格
        min-width: 0.3em; // 确保空格有最小宽度
    }

    // 包含空格的单词（如 "You ", "were "）
    // 使用 word-spacing 增加单词间距
    &.has-space {
        white-space: pre; // 保留空格
        // 为单词后的空格增加视觉间距
        word-spacing: 0.15em;
    }

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
            // 🔑 使用CSS变量动态设置动画时长，适应字符播放时间
            // 使用更强的弹跳效果，让分组弹跳更明显
            animation: karaoke-bounce var(--bounce-duration, 0.35s) cubic-bezier(0.25, 1.5, 0.5, 1);
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

// Style1 弹跳动画（优化版：更明显的弹跳效果）
@keyframes karaoke-bounce {
    0% {
        transform: scale(1) translateY(0) translateZ(0);
    }

    30% {
        // 更快到达顶点，更明显的弹跳
        transform: scale(1.3) translateY(-10px) translateZ(0);
    }

    50% {
        // 在顶点停留更久，让用户看清
        transform: scale(1.3) translateY(-10px) translateZ(0);
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
