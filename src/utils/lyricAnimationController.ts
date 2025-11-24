/**
 * 歌词动画控制器
 * 提供精确的时间控制和动画管理功能
 */

/**
 * TimeoutTools - 精确时间控制工具类
 * 结合 requestAnimationFrame 和 setTimeout 实现高精度定时
 * 参考洛雪音乐的实现，提供时间漂移校正功能
 */
export class TimeoutTools {
  private nextTick: (callback: FrameRequestCallback) => number;
  private cancelNextTick: (handle: number) => void;
  private invokeTime: number = 0;
  private animationFrameId: number | null = null;
  private timeoutId: number | null = null;
  private callback: ((drift: number) => void) | null = null;
  private thresholdTime: number;

  /**
   * 构造函数
   * @param thresholdTime 阈值时间（毫秒），小于此值使用 RAF，大于此值使用 setTimeout
   */
  constructor(thresholdTime: number = 80) {
    this.nextTick = window.requestAnimationFrame.bind(window);
    this.cancelNextTick = window.cancelAnimationFrame.bind(window);
    this.thresholdTime = thresholdTime;
  }

  /**
   * 内部运行方法
   * 递归调用 RAF 或 setTimeout 以实现精确定时
   */
  private run(): void {
    this.animationFrameId = this.nextTick(() => {
      this.animationFrameId = null;
      const diff = this.invokeTime - performance.now();

      if (diff > 0) {
        // 还没到执行时间
        if (diff < this.thresholdTime) {
          // 时间差小于阈值，继续使用 RAF（更精确）
          return this.run();
        }
        // 时间差大于阈值，使用 setTimeout（节省性能）
        this.timeoutId = window.setTimeout(() => {
          this.timeoutId = null;
          this.run();
        }, diff - this.thresholdTime);
        return;
      }

      // 到达执行时间，调用回调（传入时间漂移量）
      this.callback?.(diff);
    });
  }

  /**
   * 启动定时器
   * @param callback 回调函数，参数为时间漂移量（负数表示延迟）
   * @param timeout 延迟时间（毫秒）
   */
  start(callback: (drift: number) => void, timeout: number = 0): void {
    this.callback = callback;
    this.invokeTime = performance.now() + timeout;
    this.run();
  }

  /**
   * 清理定时器
   * 取消所有待执行的 RAF 和 setTimeout
   */
  clear(): void {
    if (this.animationFrameId) {
      this.cancelNextTick(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.timeoutId) {
      window.clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    this.callback = null;
  }
}

/**
 * AnimationManager - 动画管理器
 * 管理所有字符的 Web Animation 实例
 * 提供创建、获取、删除、暂停、恢复等功能
 */
export class AnimationManager {
  private animations: Map<string, Animation> = new Map();
  private timeoutTools: TimeoutTools;

  constructor() {
    this.timeoutTools = new TimeoutTools();
  }

  /**
   * 创建动画实例
   * @param key 动画唯一标识符
   * @param element 目标 DOM 元素
   * @param duration 动画持续时间（毫秒）
   * @returns Animation 实例
   */
  createAnimation(
    key: string,
    element: HTMLElement,
    duration: number
  ): Animation {
    // 如果已存在，先删除旧动画
    if (this.animations.has(key)) {
      this.removeAnimation(key);
    }

    // 创建新动画（渐变填充效果）
    const animation = new Animation(
      new KeyframeEffect(
        element,
        [{ backgroundSize: "0 100%" }, { backgroundSize: "100% 100%" }],
        {
          duration,
          easing: "linear",
          fill: "forwards",
        }
      ),
      document.timeline
    );

    this.animations.set(key, animation);
    return animation;
  }

  /**
   * 获取动画实例
   * @param key 动画唯一标识符
   * @returns Animation 实例或 undefined
   */
  getAnimation(key: string): Animation | undefined {
    return this.animations.get(key);
  }

  /**
   * 删除动画实例
   * @param key 动画唯一标识符
   */
  removeAnimation(key: string): void {
    const animation = this.animations.get(key);
    if (animation) {
      animation.cancel();
      this.animations.delete(key);
    }
  }

  /**
   * 清理所有动画
   * 取消所有动画并清空 Map
   */
  clearAll(): void {
    this.animations.forEach((animation) => animation.cancel());
    this.animations.clear();
    this.timeoutTools.clear();
  }

  /**
   * 暂停所有动画
   * 将所有正在运行的动画暂停
   */
  pauseAll(): void {
    this.animations.forEach((animation) => {
      if (animation.playState === "running") {
        animation.pause();
      }
    });
  }

  /**
   * 恢复所有动画
   * 将所有暂停的动画恢复播放
   */
  resumeAll(): void {
    this.animations.forEach((animation) => {
      if (animation.playState === "paused") {
        animation.play();
      }
    });
  }

  /**
   * 获取当前动画数量
   * @returns 动画实例数量
   */
  getAnimationCount(): number {
    return this.animations.size;
  }

  /**
   * 获取 TimeoutTools 实例
   * @returns TimeoutTools 实例
   */
  getTimeoutTools(): TimeoutTools {
    return this.timeoutTools;
  }
}
