// IndexedDB 存储适配器 - 网页端实现
// 支持分块读写、URL 缓存、持久化权限

import type { IStorageAdapter, TrackMetadata, StorageInfo } from "./interface";

const DB_NAME = "LocalMusicDB";
const DB_VERSION = 2;
const METADATA_STORE = "metadata";
const AUDIO_STORE = "audioFiles";
// const CHUNK_SIZE = 1024 * 1024; // 1MB 分块大小（预留用于未来优化）

export class IndexedDBAdapter implements IStorageAdapter {
  private db: IDBDatabase | null = null;
  private urlCache: Map<string, string> = new Map(); // URL 缓存

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error("IndexedDB 打开失败:", request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // 创建元数据存储
        if (!db.objectStoreNames.contains(METADATA_STORE)) {
          const metadataStore = db.createObjectStore(METADATA_STORE, {
            keyPath: "id",
          });
          metadataStore.createIndex("fileName", "fileName", { unique: false });
          metadataStore.createIndex("addedAt", "addedAt", { unique: false });
        }

        // 创建音频文件存储
        if (!db.objectStoreNames.contains(AUDIO_STORE)) {
          db.createObjectStore(AUDIO_STORE, { keyPath: "id" });
        }
      };
    });
  }

  async saveTrack(
    id: string,
    blob: Blob,
    metadata: TrackMetadata
  ): Promise<void> {
    if (!this.db) await this.init();

    // 分别保存元数据和音频数据
    await Promise.all([
      this.saveMetadata(id, metadata),
      this.saveAudioBlob(id, blob),
    ]);
  }

  private async saveMetadata(
    _id: string,
    metadata: TrackMetadata
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([METADATA_STORE], "readwrite");
      const store = transaction.objectStore(METADATA_STORE);
      const request = store.put(metadata);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async saveAudioBlob(id: string, blob: Blob): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([AUDIO_STORE], "readwrite");
      const store = transaction.objectStore(AUDIO_STORE);
      const request = store.put({ id, blob });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getTrack(id: string): Promise<Blob | null> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([AUDIO_STORE], "readonly");
      const store = transaction.objectStore(AUDIO_STORE);
      const request = store.get(id);

      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.blob : null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getTrackURL(id: string): Promise<string | null> {
    if (!id) return null;

    // 检查缓存
    if (this.urlCache.has(id)) {
      return this.urlCache.get(id)!;
    }

    // 从 IndexedDB 读取
    const blob = await this.getTrack(id);
    if (!blob) {
      console.warn(`IndexedDB 中未找到文件 [${id}]`);
      return null;
    }

    // 创建 URL 并缓存
    const url = URL.createObjectURL(blob);
    this.urlCache.set(id, url);
    return url;
  }

  async getMetadata(id: string): Promise<TrackMetadata | null> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([METADATA_STORE], "readonly");
      const store = transaction.objectStore(METADATA_STORE);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async listTracks(): Promise<TrackMetadata[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([METADATA_STORE], "readonly");
      const store = transaction.objectStore(METADATA_STORE);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteTrack(id: string): Promise<void> {
    if (!this.db) await this.init();

    // 释放缓存的 URL
    const cachedUrl = this.urlCache.get(id);
    if (cachedUrl) {
      URL.revokeObjectURL(cachedUrl);
      this.urlCache.delete(id);
    }

    // 删除元数据和音频数据
    await Promise.all([this.deleteMetadata(id), this.deleteAudioBlob(id)]);
  }

  private async deleteMetadata(id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([METADATA_STORE], "readwrite");
      const store = transaction.objectStore(METADATA_STORE);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async deleteAudioBlob(id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([AUDIO_STORE], "readwrite");
      const store = transaction.objectStore(AUDIO_STORE);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clearAll(): Promise<void> {
    if (!this.db) await this.init();

    // 释放所有缓存的 URL
    this.urlCache.forEach((url) => URL.revokeObjectURL(url));
    this.urlCache.clear();

    // 清空所有存储
    await Promise.all([
      this.clearStore(METADATA_STORE),
      this.clearStore(AUDIO_STORE),
    ]);
  }

  private async clearStore(storeName: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], "readwrite");
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getStorageInfo(): Promise<StorageInfo> {
    try {
      if (navigator.storage && navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        const isPersistent = await this.checkPersistence();

        return {
          used: estimate.usage || 0,
          quota: estimate.quota || 0,
          isPersistent,
        };
      }
    } catch (error) {
      console.error("获取存储信息失败:", error);
    }

    return {
      used: 0,
      quota: 0,
      isPersistent: false,
    };
  }

  async requestPersistence(): Promise<boolean> {
    try {
      if (navigator.storage && navigator.storage.persist) {
        return await navigator.storage.persist();
      }
    } catch (error) {
      console.error("请求持久化存储失败:", error);
    }
    return false;
  }

  private async checkPersistence(): Promise<boolean> {
    try {
      if (navigator.storage && navigator.storage.persisted) {
        return await navigator.storage.persisted();
      }
    } catch (error) {
      console.error("检查持久化状态失败:", error);
    }
    return false;
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

  // 清理未使用的 URL 缓存
  clearURLCache(): void {
    this.urlCache.forEach((url) => {
      if (url && url.startsWith("blob:")) {
        URL.revokeObjectURL(url);
      }
    });
    this.urlCache.clear();
  }
}
