// 存储工厂 - 根据环境选择合适的存储适配器

import type { IStorageAdapter } from "./interface";
import { IndexedDBAdapter } from "./indexedDBAdapter";
import { ElectronAdapter } from "./electronAdapter";

export class StorageFactory {
  private static instance: IStorageAdapter | null = null;

  // 检测是否在 Electron 环境
  private static isElectron(): boolean {
    return !!(window as any).electronAPI;
  }

  // 获取存储适配器实例（单例）
  static getAdapter(): IStorageAdapter {
    if (!this.instance) {
      this.instance = this.isElectron()
        ? new ElectronAdapter()
        : new IndexedDBAdapter();
    }
    return this.instance;
  }

  // 重置实例（用于测试）
  static reset(): void {
    this.instance = null;
  }
}
