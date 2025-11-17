// 持久化工具
export const persist = {
  // 保存数据到 localStorage
  save<T>(key: string, data: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.error(`保存数据失败 [${key}]:`, error);
    }
  },

  // 从 localStorage 加载数据
  load<T>(key: string, defaultValue: T): T {
    try {
      const data = localStorage.getItem(key);
      if (data) {
        return JSON.parse(data) as T;
      }
    } catch (error) {
      console.error(`加载数据失败 [${key}]:`, error);
    }
    return defaultValue;
  },

  // 删除数据
  remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error(`删除数据失败 [${key}]:`, error);
    }
  },

  // 清空所有数据
  clear(): void {
    try {
      localStorage.clear();
    } catch (error) {
      console.error("清空数据失败:", error);
    }
  },
};
