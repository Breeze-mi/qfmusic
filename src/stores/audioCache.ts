import { defineStore } from "pinia";
import { ref } from "vue";
import { useSettingsStore } from "./settings";

// 音频缓存数据库配置
const DB_NAME = "AudioCacheDB";
const DB_VERSION = 1;
const AUDIO_STORE = "audioFiles";
const METADATA_STORE = "audioMetadata";

// Electron IPC 类型定义
declare global {
  interface Window {
    electron?: {
      invoke(channel: string, ...args: any[]): Promise<any>;
    };
  }
}

// 音频元数据
interface AudioMetadata {
  songId: string;
  url: string; // 原始URL
  cachedAt: number; // 缓存时间
  lastAccessAt: number; // 最后访问时间
  size: number; // 文件大小
  quality: string; // 音质
  expiresAt?: number; // URL过期时间（如果知道的话）
}

// 缓存配置
const MAX_CACHE_SIZE = 120; // 最多缓存120首歌
const CACHE_EXPIRY_DAYS = 2; // 缓存2天后清理
const URL_EXPIRY_HOURS = 6; // URL 6 小时后可能过期

export const useAudioCacheStore = defineStore("audioCache", () => {
  const settingsStore = useSettingsStore();
  const db = ref<IDBDatabase | null>(null);
  const isInitialized = ref(false);
  const downloadingSet = ref<Set<string>>(new Set()); // 正在下载的歌曲集合
  const abortControllers = ref<Map<string, AbortController>>(new Map()); // 下载控制器

  // 检查是否应该使用文件系统缓存（Electron 生产环境）
  const shouldUseFileSystem = () => settingsStore.shouldUseFileSystemCache();

  // 初始化数据库
  const init = async (): Promise<void> => {
    if (isInitialized.value) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error("音频缓存数据库打开失败:", request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        db.value = request.result;
        isInitialized.value = true;
        console.log("音频缓存数据库初始化成功");
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const database = (event.target as IDBOpenDBRequest).result;

        // 创建音频文件存储
        if (!database.objectStoreNames.contains(AUDIO_STORE)) {
          database.createObjectStore(AUDIO_STORE, { keyPath: "songId" });
        }

        // 创建元数据存储
        if (!database.objectStoreNames.contains(METADATA_STORE)) {
          const metadataStore = database.createObjectStore(METADATA_STORE, {
            keyPath: "songId",
          });
          metadataStore.createIndex("lastAccessAt", "lastAccessAt", {
            unique: false,
          });
          metadataStore.createIndex("cachedAt", "cachedAt", { unique: false });
        }
      };
    });
  };

  // 检查缓存是否存在且有效
  const hasValidCache = async (songId: string): Promise<boolean> => {
    try {
      // Electron 生产环境：检查文件系统
      if (shouldUseFileSystem()) {
        const result = await window.electron?.invoke("has-audio-cache", songId);
        if (result?.success && result?.exists) {
          return true;
        }
        return false;
      }

      // Web 环境或 Electron 开发环境：检查 IndexedDB
      await init();
      const metadata = await getMetadata(songId);
      if (!metadata) return false;

      // 检查是否过期
      const now = Date.now();
      const cacheAge = now - metadata.cachedAt;
      const maxAge = CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

      if (cacheAge > maxAge) {
        console.log(`缓存已过期: ${songId}`);
        await deleteCache(songId);
        return false;
      }

      return true;
    } catch (error) {
      console.error("检查缓存失败:", error);
      return false;
    }
  };

  // 获取缓存的音频Blob
  const getCachedAudio = async (songId: string): Promise<Blob | null> => {
    try {
      // Electron 生产环境：从文件系统读取
      if (shouldUseFileSystem()) {
        const result = await window.electron?.invoke(
          "read-audio-cache",
          songId
        );
        if (result?.success && result?.buffer) {
          const blob = new Blob([result.buffer], { type: "audio/mpeg" });
          console.log(`从文件系统读取缓存音频: ${songId}`);
          return blob;
        }
        return null;
      }

      // Web 环境或 Electron 开发环境：从 IndexedDB 读取
      await init();
      if (!db.value) return null;

      return new Promise((resolve, reject) => {
        const transaction = db.value!.transaction([AUDIO_STORE], "readonly");
        const store = transaction.objectStore(AUDIO_STORE);
        const request = store.get(songId);

        request.onsuccess = () => {
          const result = request.result;
          if (result && result.blob) {
            // 更新最后访问时间
            updateLastAccessTime(songId);
            resolve(result.blob);
          } else {
            resolve(null);
          }
        };

        request.onerror = () => {
          console.error("获取缓存音频失败:", request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error("获取缓存音频失败:", error);
      return null;
    }
  };

  // 获取缓存的音频URL
  const getCachedAudioURL = async (songId: string): Promise<string | null> => {
    try {
      const blob = await getCachedAudio(songId);
      if (!blob) return null;

      const url = URL.createObjectURL(blob);
      console.log(`使用缓存的音频: ${songId}`);
      return url;
    } catch (error) {
      console.error("创建音频URL失败:", error);
      return null;
    }
  };

  // 从 audio 元素捕获已下载的音频数据（智能缓存，支持丝滑切换）
  const captureFromAudioElement = async (
    songId: string,
    audioElement: HTMLAudioElement,
    audioUrl: string,
    quality: string,
    onProgress?: (percent: number) => void,
    onComplete?: (blobUrl: string) => void
  ): Promise<void> => {
    try {
      await init();

      // 检查是否已缓存
      const alreadyCached = await hasValidCache(songId);
      if (alreadyCached) {
        //console.log(`✅ 歌曲 ${songId} 已缓存，跳过`);
        return;
      }

      // 检查是否正在处理
      if (downloadingSet.value.has(songId)) {
        //console.log(`⏸️ 歌曲 ${songId} 正在处理中，跳过`);
        return;
      }

      downloadingSet.value.add(songId);

      //console.log(`🎵 智能缓存：等待缓冲完成: ${songId}`);

      // 等待音频缓冲到一定程度（不需要完全加载，减少等待时间）
      const waitForBuffering = new Promise<void>((resolve) => {
        // 如果已经缓冲足够（readyState >= 3 表示有未来数据）
        if (audioElement.readyState >= 3) {
          resolve();
          return;
        }

        // 监听 canplay 事件（比 canplaythrough 更早触发）
        const handleCanPlay = () => {
          audioElement.removeEventListener("canplay", handleCanPlay);
          resolve();
        };

        audioElement.addEventListener("canplay", handleCanPlay);

        // 超时保护（10秒，优化后的时间）
        setTimeout(() => {
          audioElement.removeEventListener("canplay", handleCanPlay);
          resolve();
        }, 10000);
      });

      await waitForBuffering;

      // 创建 AbortController 用于中止下载
      const abortController = new AbortController();
      abortControllers.value.set(songId, abortController);

      // 流式下载完整音频文件（支持进度回调）
      //console.log(`⬇️ 开始流式下载: ${songId}`);

      const response = await fetch(audioUrl, {
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`下载失败: ${response.status}`);
      }

      const contentLength = response.headers.get("Content-Length");
      const total = contentLength ? parseInt(contentLength, 10) : 0;

      if (!response.body) {
        throw new Error("响应体为空");
      }

      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let downloaded = 0;

      // 流式读取数据
      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        chunks.push(value);
        downloaded += value.length;

        // 触发进度回调
        if (onProgress && total > 0) {
          const percent = (downloaded / total) * 100;
          onProgress(percent);
        }
      }

      // 合并所有数据块
      const blob = new Blob(chunks as BlobPart[], { type: "audio/mpeg" });

      if (blob.size === 0) {
        //console.error(`❌ 下载的音频文件大小为 0: ${songId}`);
        return;
      }

      console.log(
        `✅ 音频下载完成: ${songId}, 大小: ${(blob.size / 1024 / 1024).toFixed(
          2
        )} MB`
      );

      // 检查缓存大小
      await ensureCacheSpace();

      // 保存到缓存
      await saveAudioCache(songId, blob, audioUrl, quality);

      // 触发完成回调，返回 Blob URL
      if (onComplete) {
        const blobUrl = URL.createObjectURL(blob);
        onComplete(blobUrl);
        //console.log(`🎉 缓存完成，可切换到离线播放: ${songId}`);
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        //console.log(`⏹️ 下载已中止: ${songId}`);
      } else {
        //console.error("❌ 捕获音频失败:", error);
      }
    } finally {
      downloadingSet.value.delete(songId);
      abortControllers.value.delete(songId);
    }
  };

  // 下载并缓存音频（独立下载，用于预加载等场景）
  const downloadAndCache = async (
    songId: string,
    audioUrl: string,
    quality: string,
    onProgress?: (downloaded: number, total: number) => void,
    onComplete?: (blobUrl: string) => void
  ): Promise<Blob | null> => {
    try {
      await init();

      // 检查是否正在下载
      if (downloadingSet.value.has(songId)) {
        //console.log(`⏸️ 歌曲 ${songId} 正在下载中，跳过重复下载`);
        return null;
      }

      // 检查是否已缓存
      const alreadyCached = await hasValidCache(songId);
      if (alreadyCached) {
        //console.log(`✅ 歌曲 ${songId} 已缓存，跳过下载`);
        const cachedBlob = await getCachedAudio(songId);
        if (cachedBlob && onComplete) {
          const blobUrl = URL.createObjectURL(cachedBlob);
          onComplete(blobUrl);
        }
        return cachedBlob;
      }

      // 检查 URL 是否有效
      if (!audioUrl || audioUrl.trim() === "") {
        console.error(`音频 URL 为空，无法缓存: ${songId}`);
        return null;
      }

      // 标记为下载中
      downloadingSet.value.add(songId);

      // 创建 AbortController 用于中止下载
      const abortController = new AbortController();
      abortControllers.value.set(songId, abortController);

      //console.log(`⬇️ 开始下载音频: ${songId}, 音质: ${quality}`);

      // 使用流式下载，支持进度回调
      const response = await fetch(audioUrl, {
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`下载失败: ${response.status} ${response.statusText}`);
      }

      const contentLength = response.headers.get("Content-Length");
      const total = contentLength ? parseInt(contentLength, 10) : 0;

      if (!response.body) {
        throw new Error("响应体为空");
      }

      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let downloaded = 0;

      // 流式读取数据
      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        chunks.push(value);
        downloaded += value.length;

        // 触发进度回调
        if (onProgress && total > 0) {
          onProgress(downloaded, total);
        }
      }

      // 合并所有数据块
      const blob = new Blob(chunks as BlobPart[], { type: "audio/mpeg" });

      if (blob.size === 0) {
        //console.error(`❌ 下载的音频文件大小为 0: ${songId}`);
        return null;
      }

      console.log(
        `✅ 音频下载完成: ${songId}, 大小: ${(blob.size / 1024 / 1024).toFixed(
          2
        )} MB`
      );

      // 检查缓存大小
      await ensureCacheSpace();

      // 保存到缓存
      await saveAudioCache(songId, blob, audioUrl, quality);

      // 触发完成回调
      if (onComplete) {
        const blobUrl = URL.createObjectURL(blob);
        onComplete(blobUrl);
        console.log(`🎵 缓存完成: ${songId}`);
      }

      return blob;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        //console.log(`⏹️ 下载已中止: ${songId}`);
      } else {
        //console.error("❌ 下载并缓存音频失败:", error);
      }
      return null;
    } finally {
      downloadingSet.value.delete(songId);
      abortControllers.value.delete(songId);
    }
  };

  // 中止指定歌曲的下载
  const abortDownload = (songId: string): void => {
    const controller = abortControllers.value.get(songId);
    if (controller) {
      controller.abort();
      abortControllers.value.delete(songId);
      downloadingSet.value.delete(songId);
      //console.log(`🛑 已中止下载: ${songId}`);
    }
  };

  // 中止所有正在进行的下载
  const abortAllDownloads = (): void => {
    const count = abortControllers.value.size;
    if (count > 0) {
      abortControllers.value.forEach((controller, songId) => {
        controller.abort();
        //console.log(`🛑 已中止下载: ${songId}`);
      });
      abortControllers.value.clear();
      downloadingSet.value.clear();
      ////console.log(`🛑 已中止所有下载，共 ${count} 个`);
    }
  };

  // 保存音频缓存
  const saveAudioCache = async (
    songId: string,
    blob: Blob,
    url: string,
    quality: string
  ): Promise<void> => {
    const now = Date.now();
    const metadata: AudioMetadata = {
      songId,
      url,
      cachedAt: now,
      lastAccessAt: now,
      size: blob.size,
      quality,
      expiresAt: now + URL_EXPIRY_HOURS * 60 * 60 * 1000,
    };

    // Electron 生产环境：保存到文件系统
    if (shouldUseFileSystem()) {
      try {
        // 将 Blob 转换为 ArrayBuffer
        const arrayBuffer = await blob.arrayBuffer();

        // 通过 IPC 保存到文件系统
        const result = await window.electron?.invoke(
          "save-audio-cache",
          songId,
          arrayBuffer,
          metadata
        );

        if (result?.success) {
          console.log(`音频缓存已保存到文件系统: ${songId}`);
          return;
        } else {
          throw new Error(result?.error || "保存到文件系统失败");
        }
      } catch (error) {
        console.error("保存到文件系统失败，回退到 IndexedDB:", error);
        // 如果文件系统保存失败，回退到 IndexedDB
      }
    }

    // Web 环境或 Electron 开发环境：保存到 IndexedDB
    if (!db.value) await init();

    // 保存音频文件
    await new Promise<void>((resolve, reject) => {
      const transaction = db.value!.transaction([AUDIO_STORE], "readwrite");
      const store = transaction.objectStore(AUDIO_STORE);
      const request = store.put({ songId, blob });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    // 保存元数据
    await new Promise<void>((resolve, reject) => {
      const transaction = db.value!.transaction([METADATA_STORE], "readwrite");
      const store = transaction.objectStore(METADATA_STORE);
      const request = store.put(metadata);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    console.log(`音频缓存保存成功: ${songId}`);
  };

  // 获取元数据
  const getMetadata = async (songId: string): Promise<AudioMetadata | null> => {
    if (!db.value) await init();

    return new Promise((resolve, reject) => {
      const transaction = db.value!.transaction([METADATA_STORE], "readonly");
      const store = transaction.objectStore(METADATA_STORE);
      const request = store.get(songId);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  };

  // 更新最后访问时间
  const updateLastAccessTime = async (songId: string): Promise<void> => {
    try {
      const metadata = await getMetadata(songId);
      if (metadata) {
        metadata.lastAccessAt = Date.now();
        await new Promise<void>((resolve, reject) => {
          const transaction = db.value!.transaction(
            [METADATA_STORE],
            "readwrite"
          );
          const store = transaction.objectStore(METADATA_STORE);
          const request = store.put(metadata);

          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      }
    } catch (error) {
      console.error("更新访问时间失败:", error);
    }
  };

  // 确保缓存空间足够
  const ensureCacheSpace = async (): Promise<void> => {
    try {
      const allMetadata = await getAllMetadata();

      if (allMetadata.length >= MAX_CACHE_SIZE) {
        // 按最后访问时间排序，删除最旧的
        allMetadata.sort((a, b) => a.lastAccessAt - b.lastAccessAt);

        const toDelete = allMetadata.slice(
          0,
          allMetadata.length - MAX_CACHE_SIZE + 1
        );
        console.log(`清理旧缓存: ${toDelete.length} 个文件`);

        for (const metadata of toDelete) {
          await deleteCache(metadata.songId);
        }
      }
    } catch (error) {
      //console.error("清理缓存空间失败:", error);
    }
  };

  // 获取所有元数据
  const getAllMetadata = async (): Promise<AudioMetadata[]> => {
    if (!db.value) await init();

    return new Promise((resolve, reject) => {
      const transaction = db.value!.transaction([METADATA_STORE], "readonly");
      const store = transaction.objectStore(METADATA_STORE);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  };

  // 删除缓存
  const deleteCache = async (songId: string): Promise<void> => {
    // Electron 生产环境：从文件系统删除
    if (shouldUseFileSystem()) {
      const result = await window.electron?.invoke(
        "delete-audio-cache",
        songId
      );
      if (result?.success) {
        //console.log(`缓存已从文件系统删除: ${songId}`);
        return;
      }
      // 如果文件系统删除失败，继续尝试删除 IndexedDB（可能有残留）
    }

    // Web 环境或 Electron 开发环境：从 IndexedDB 删除
    if (!db.value) await init();

    // 删除音频文件
    await new Promise<void>((resolve, reject) => {
      const transaction = db.value!.transaction([AUDIO_STORE], "readwrite");
      const store = transaction.objectStore(AUDIO_STORE);
      const request = store.delete(songId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    // 删除元数据
    await new Promise<void>((resolve, reject) => {
      const transaction = db.value!.transaction([METADATA_STORE], "readwrite");
      const store = transaction.objectStore(METADATA_STORE);
      const request = store.delete(songId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    //console.log(`缓存已删除: ${songId}`);
  };

  // 清空所有缓存
  const clearAllCache = async (): Promise<void> => {
    // Electron 生产环境：清空文件系统缓存
    if (shouldUseFileSystem()) {
      const result = await window.electron?.invoke("clear-audio-cache");
      if (result?.success) {
        //console.log("文件系统音频缓存已清空");
        return;
      } else {
        throw new Error(result?.error || "清空文件系统缓存失败");
      }
    }

    // Web 环境或 Electron 开发环境：清空 IndexedDB
    if (!db.value) await init();

    await new Promise<void>((resolve, reject) => {
      const transaction = db.value!.transaction(
        [AUDIO_STORE, METADATA_STORE],
        "readwrite"
      );

      const audioStore = transaction.objectStore(AUDIO_STORE);
      const metadataStore = transaction.objectStore(METADATA_STORE);

      const audioRequest = audioStore.clear();
      const metadataRequest = metadataStore.clear();

      let completed = 0;
      const checkComplete = () => {
        completed++;
        if (completed === 2) resolve();
      };

      audioRequest.onsuccess = checkComplete;
      metadataRequest.onsuccess = checkComplete;

      audioRequest.onerror = () => reject(audioRequest.error);
      metadataRequest.onerror = () => reject(metadataRequest.error);
    });

    //console.log("IndexedDB 音频缓存已清空");
  };

  // 获取缓存统计信息
  const getCacheStats = async (): Promise<{
    count: number;
    totalSize: number;
  }> => {
    try {
      // Electron 生产环境：从文件系统获取
      if (shouldUseFileSystem()) {
        const result = await window.electron?.invoke("get-audio-cache-size");
        if (result?.success) {
          return {
            count: 0, // 文件系统不统计数量
            totalSize: result.size || 0,
          };
        }
        return { count: 0, totalSize: 0 };
      }

      // Web 环境或 Electron 开发环境：使用 IndexedDB
      const allMetadata = await getAllMetadata();

      // 计算实际 Blob 大小（更准确）
      let actualSize = 0;
      let validCount = 0;

      for (const meta of allMetadata) {
        const blob = await getCachedAudio(meta.songId);
        if (blob && blob.size > 0) {
          actualSize += blob.size;
          validCount++;
        } else if (blob && blob.size === 0) {
          // 发现损坏的缓存，记录警告
          console.warn(
            `发现损坏的缓存: ${meta.songId}, 元数据大小: ${meta.size}, 实际大小: 0`
          );
        }
      }

      return {
        count: validCount, // 只统计有效的缓存
        totalSize: actualSize, // 使用实际 Blob 大小
      };
    } catch (error) {
      console.error("获取缓存统计失败:", error);
      return { count: 0, totalSize: 0 };
    }
  };

  // 清理过期缓存
  const cleanExpiredCache = async (): Promise<void> => {
    try {
      const allMetadata = await getAllMetadata();
      const now = Date.now();
      const maxAge = CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

      let cleanedCount = 0;
      for (const metadata of allMetadata) {
        const age = now - metadata.cachedAt;
        if (age > maxAge) {
          await deleteCache(metadata.songId);
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        //console.log(`清理了 ${cleanedCount} 个过期缓存`);
      }
    } catch (error) {
      //console.error("清理过期缓存失败:", error);
    }
  };

  return {
    init,
    hasValidCache,
    getCachedAudio,
    getCachedAudioURL,
    captureFromAudioElement,
    downloadAndCache,
    abortDownload,
    abortAllDownloads,
    deleteCache,
    clearAllCache,
    getCacheStats,
    cleanExpiredCache,
  };
});
