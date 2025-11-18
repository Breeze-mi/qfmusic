// Electron 文件系统适配器 - Electron 端实现
// 使用 IPC 访问文件系统，真正的持久化存储

import type { IStorageAdapter, TrackMetadata, StorageInfo } from "./interface";

const METADATA_KEY = "electron-local-music-metadata";

// 类型定义
declare global {
  interface Window {
    electronAPI?: {
      saveLocalMusic(
        id: string,
        buffer: ArrayBuffer
      ): Promise<{ success: boolean; error?: string }>;
      readLocalMusic(
        id: string
      ): Promise<{ success: boolean; buffer?: ArrayBuffer; error?: string }>;
      deleteLocalMusic(
        id: string
      ): Promise<{ success: boolean; error?: string }>;
      clearLocalMusic(): Promise<{ success: boolean; error?: string }>;
    };
  }
}

export class ElectronAdapter implements IStorageAdapter {
  private metadata: Map<string, TrackMetadata> = new Map();
  private urlCache: Map<string, string> = new Map();

  async init(): Promise<void> {
    // 从 localStorage 加载元数据
    try {
      const savedMetadata = localStorage.getItem(METADATA_KEY);
      if (savedMetadata) {
        const metadataArray: TrackMetadata[] = JSON.parse(savedMetadata);
        metadataArray.forEach((meta) => {
          this.metadata.set(meta.id, meta);
        });
      }
    } catch (error) {
      console.error("加载元数据失败:", error);
    }
  }

  async saveTrack(
    id: string,
    blob: Blob,
    metadata: TrackMetadata
  ): Promise<void> {
    // 保存元数据到 localStorage
    this.metadata.set(id, metadata);
    this.saveMetadataToStorage();

    // 通过 IPC 保存文件到文件系统
    if (window.electronAPI) {
      try {
        const buffer = await blob.arrayBuffer();
        const result = await window.electronAPI.saveLocalMusic(id, buffer);
        if (!result.success) {
          console.error(`保存文件失败 [${id}]:`, result.error);
        }
      } catch (error) {
        console.error(`保存文件异常 [${id}]:`, error);
      }
    } else {
      console.warn("Electron API 不可用");
    }
  }

  private saveMetadataToStorage(): void {
    try {
      const metadataArray = Array.from(this.metadata.values());
      localStorage.setItem(METADATA_KEY, JSON.stringify(metadataArray));
    } catch (error) {
      console.error("保存元数据失败:", error);
    }
  }

  async getTrack(id: string): Promise<Blob | null> {
    if (!window.electronAPI) {
      console.warn("Electron API 不可用");
      return null;
    }

    try {
      const result = await window.electronAPI.readLocalMusic(id);

      if (result.success && result.buffer) {
        const metadata = this.metadata.get(id);
        const mimeType = metadata?.fileType || "audio/mpeg";
        return new Blob([result.buffer], { type: mimeType });
      } else {
        console.warn(`读取文件失败 [${id}]:`, result.error);
        return null;
      }
    } catch (error) {
      console.error(`读取文件异常 [${id}]:`, error);
      return null;
    }
  }

  async getTrackURL(id: string): Promise<string | null> {
    if (!id) return null;

    // 检查缓存
    if (this.urlCache.has(id)) {
      return this.urlCache.get(id)!;
    }

    // 从文件系统读取
    const blob = await this.getTrack(id);
    if (!blob) {
      console.warn(`文件系统中未找到文件 [${id}]`);
      return null;
    }

    // 创建 URL 并缓存
    const url = URL.createObjectURL(blob);
    this.urlCache.set(id, url);
    return url;
  }

  async getMetadata(id: string): Promise<TrackMetadata | null> {
    return this.metadata.get(id) || null;
  }

  async listTracks(): Promise<TrackMetadata[]> {
    return Array.from(this.metadata.values());
  }

  async deleteTrack(id: string): Promise<void> {
    // 删除元数据
    this.metadata.delete(id);
    this.saveMetadataToStorage();

    // 释放 URL 缓存
    const url = this.urlCache.get(id);
    if (url) {
      URL.revokeObjectURL(url);
      this.urlCache.delete(id);
    }

    // 通过 IPC 删除文件
    if (window.electronAPI) {
      try {
        const result = await window.electronAPI.deleteLocalMusic(id);
        if (!result.success) {
          console.error(`删除文件失败 [${id}]:`, result.error);
        }
      } catch (error) {
        console.error(`删除文件异常 [${id}]:`, error);
      }
    }
  }

  async clearAll(): Promise<void> {
    // 清空元数据
    this.metadata.clear();
    localStorage.removeItem(METADATA_KEY);

    // 释放所有 URL 缓存
    this.urlCache.forEach((url) => URL.revokeObjectURL(url));
    this.urlCache.clear();

    // 通过 IPC 清空所有文件
    if (window.electronAPI) {
      try {
        const result = await window.electronAPI.clearLocalMusic();
        if (!result.success) {
          console.error("清空文件失败:", result.error);
        }
      } catch (error) {
        console.error("清空文件异常:", error);
      }
    }
  }

  async getStorageInfo(): Promise<StorageInfo> {
    // 计算元数据中记录的文件大小
    let used = 0;
    this.metadata.forEach((meta) => {
      used += meta.fileSize;
    });

    return {
      used,
      quota: Number.MAX_SAFE_INTEGER, // Electron 端理论上无限制
      isPersistent: true, // 文件系统持久化
    };
  }

  async requestPersistence(): Promise<boolean> {
    // Electron 端默认持久化
    return true;
  }

  revokeTrackURL(url: string): void {
    if (!url || !url.startsWith("blob:")) return;

    URL.revokeObjectURL(url);

    // 从缓存中移除
    for (const [id, cachedUrl] of this.urlCache.entries()) {
      if (cachedUrl === url) {
        this.urlCache.delete(id);
        break;
      }
    }
  }
}
