/**
 * 防抖函数
 * @param fn 要执行的函数
 * @param delay 延迟时间（毫秒）
 * @returns 防抖后的函数
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: number | null = null;
  return function (this: any, ...args: Parameters<T>) {
    if (timer !== null) {
      clearTimeout(timer);
    }
    timer = window.setTimeout(() => {
      fn.apply(this, args);
      timer = null;
    }, delay);
  };
}

/**
 * 节流函数
 * @param fn 要执行的函数
 * @param delay 延迟时间（毫秒）
 * @returns 节流后的函数
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let lastTime = 0;
  let timer: number | null = null;

  return function (this: any, ...args: Parameters<T>) {
    const now = Date.now();

    if (now - lastTime >= delay) {
      // 如果距离上次执行已经超过延迟时间，立即执行
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      fn.apply(this, args);
      lastTime = now;
    } else {
      // 否则设置定时器，在延迟时间后执行
      if (timer !== null) {
        clearTimeout(timer);
      }
      timer = window.setTimeout(() => {
        fn.apply(this, args);
        lastTime = Date.now();
        timer = null;
      }, delay - (now - lastTime));
    }
  };
}

/**
 * 图片懒加载指令
 */
export const lazyLoadDirective = {
  mounted(el: HTMLImageElement, binding: { value: string }) {
    const loadImage = () => {
      el.src = binding.value;
      el.classList.add("loaded");
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            loadImage();
            observer.unobserve(el);
          }
        });
      },
      {
        rootMargin: "50px", // 提前50px开始加载
      }
    );

    // 设置占位图
    el.src =
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect fill='%23f0f0f0' width='100' height='100'/%3E%3C/svg%3E";

    observer.observe(el);
  },
};
