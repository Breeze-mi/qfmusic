/**
 * 全局主题观察器
 * 避免每个组件创建独立的 MutationObserver，提升性能
 */

type ThemeChangeCallback = () => void;

class GlobalThemeObserver {
  private observer: MutationObserver | null = null;
  private callbacks: Set<ThemeChangeCallback> = new Set();
  private isInitialized = false;

  /**
   * 初始化全局观察器
   */
  private init() {
    if (this.isInitialized) return;

    this.observer = new MutationObserver(() => {
      // 主题切换时，通知所有订阅者
      this.callbacks.forEach((callback) => {
        try {
          callback();
        } catch (error) {
          console.error("主题变化回调执行失败:", error);
        }
      });
    });

    this.observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["style", "class"],
    });

    this.isInitialized = true;
  }

  /**
   * 订阅主题变化
   * @param callback 主题变化时的回调函数
   * @returns 取消订阅的函数
   */
  subscribe(callback: ThemeChangeCallback): () => void {
    // 首次订阅时初始化观察器
    if (this.callbacks.size === 0) {
      this.init();
    }

    this.callbacks.add(callback);

    // 返回取消订阅函数
    return () => {
      this.callbacks.delete(callback);

      // 如果没有订阅者了，断开观察器
      if (this.callbacks.size === 0) {
        this.disconnect();
      }
    };
  }

  /**
   * 断开观察器
   */
  private disconnect() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
      this.isInitialized = false;
    }
  }

  /**
   * 获取当前订阅者数量（用于调试）
   */
  getSubscriberCount(): number {
    return this.callbacks.size;
  }
}

// 导出单例
export const globalThemeObserver = new GlobalThemeObserver();
