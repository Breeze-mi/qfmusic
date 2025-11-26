// Electron 文件系统适配器 - Electron 端实现
// 使用引用模式：只保存文件路径，不复制文件内容

import type { IStorageAdapter, TrackMetadata, StorageInfo } from "./interface";

const METADATA_KEY = "electron-local-music-metadata";

// 扩展元数据，添加原始文件路径
interface ElectronTrackMetadata extends TrackMetadata {
  originalPath?: string; // 原始文件的绝对路径
}

// 类型定义
// declare global {
//   interface Window {
//     electronAPI?: {
//       // 保留这些接口以兼容旧代码，但不再使用
//       saveLocalMusic(
//         id: string,
//         buffer: ArrayBuffer
//       ): Promise<{ success: boolean; error?: string }>;
//       readLocalMusic(
//         id: string
//       ): Promise<{ success: boolean; buffer?: ArrayBuffer; error?: string }>;
//       deleteLocalMusic(
//         id: string
//       ): Promise<{ success: boolean; error?: string }>;
//       clearLocalMusic(): Promise<{ success: boolean; error?: string }>;
//       // 新增：读取本地文件路径
//       readLocalFile(
//         filePath: string
//       ): Promise<{ success: boolean; buffer?: ArrayBuffer; error?: string }>;
//     };
//   }
// }

export class ElectronAdapter implements IStorageAdapter {
  private metadata: Map<string, ElectronTrackMetadata> = new Map();
  private urlCache: Map<string, string> = new Map();

  async init(): Promise<void> {
    // 从 localStorage 加载元数据
    try {
      const savedMetadata = localStorage.getItem(METADATA_KEY);
      if (savedMetadata) {
        const metadataArray: ElectronTrackMetadata[] =
          JSON.parse(savedMetadata);
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
    // 引用模式：只保存元数据和文件路径，不复制文件
    // 从 blob 中提取原始文件路径（如果是 File 对象）
    let originalPath = "";

    if (blob instanceof File) {
      // File 对象包含 path 属性（Electron 环境）
      originalPath = (blob as any).path || "";

      // 如果没有 path 属性，尝试使用 webkitRelativePath 或 name
      if (!originalPath) {
        originalPath = (blob as any).webkitRelativePath || blob.name || "";
        console.warn(
          `⚠️ File 对象缺少 path 属性，使用备用路径: ${originalPath}`
        );
      }
    }

    // 验证路径是否有效 - 必须是绝对路径
    if (
      !originalPath ||
      (!originalPath.includes("/") && !originalPath.includes("\\"))
    ) {
      console.error(`❌ 无法获取有效的文件路径 [${id}]，路径: ${originalPath}`);
      throw new Error("无法获取文件路径，请确保使用 Electron dialog 选择文件");
    }

    const electronMetadata: ElectronTrackMetadata = {
      ...metadata,
      originalPath, // 保存原始文件路径
    };

    // 只保存元数据到 localStorage
    this.metadata.set(id, electronMetadata);
    this.saveMetadataToStorage();

    if (import.meta.env.DEV) {
      console.log(`📌 引用本地文件: ${originalPath}`);
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
    const metadata = this.metadata.get(id);
    if (!metadata || !metadata.originalPath) {
      console.warn(`元数据或文件路径不存在 [${id}]`);
      return null;
    }

    if (!window.electronAPI?.readLocalFile) {
      console.warn("Electron API 不可用");
      return null;
    }

    try {
      // 通过 IPC 读取原始文件
      const result = await window.electronAPI.readLocalFile(
        metadata.originalPath
      );

      if (result.success && result.buffer) {
        const mimeType = metadata.fileType || "audio/mpeg";
        return new Blob([result.buffer], { type: mimeType });
      } else {
        console.warn(`读取文件失败 [${metadata.originalPath}]:`, result.error);
        return null;
      }
    } catch (error) {
      console.error(`读取文件异常 [${metadata.originalPath}]:`, error);
      return null;
    }
  }

  async getTrackURL(id: string): Promise<string | null> {
    if (!id) return null;

    // 检查缓存
    if (this.urlCache.has(id)) {
      return this.urlCache.get(id)!;
    }

    const metadata = this.metadata.get(id);
    if (!metadata || !metadata.originalPath) {
      console.warn(`元数据或文件路径不存在 [${id}]`);
      return null;
    }

    // 引用模式：使用 file:// 协议（带正确的URL编码）
    // 1. 统一路径分隔符为正斜杠
    let normalizedPath = metadata.originalPath.replace(/\\/g, "/");

    // 2. 对路径中的每个部分进行URL编码，处理中文和特殊字符
    // 分割路径，对每个部分编码后再组合
    const pathParts = normalizedPath.split("/");
    const encodedParts = pathParts.map(part => {
      // 跳过空字符串和盘符(如 C:)
      if (!part || part.endsWith(":")) return part;
      // 编码路径部分，处理中文和特殊字符
      return encodeURIComponent(part);
    });
    const encodedPath = encodedParts.join("/");

    // 3. 构建 file:// URL
    // Windows: file:///C:/path/to/file.mp3 (需要三个斜杠)
    const fileUrl = `file:///${encodedPath}`;

    // 缓存 URL
    this.urlCache.set(id, fileUrl);

    if (import.meta.env.DEV) {
      console.log(`🔗 使用文件引用: ${fileUrl}`);
    }

    return fileUrl;
  }

  async getMetadata(id: string): Promise<TrackMetadata | null> {
    return this.metadata.get(id) || null;
  }

  async listTracks(): Promise<TrackMetadata[]> {
    return Array.from(this.metadata.values());
  }

  async deleteTrack(id: string): Promise<void> {
    // 引用模式：只删除元数据，不删除原始文件
    this.metadata.delete(id);
    this.saveMetadataToStorage();

    // 释放 URL 缓存
    this.urlCache.delete(id);

    if (import.meta.env.DEV) {
      console.log(`🗑️ 已移除引用 [${id}]，原始文件未删除`);
    }
  }

  async clearAll(): Promise<void> {
    // 引用模式：只清空元数据，不删除原始文件
    this.metadata.clear();
    localStorage.removeItem(METADATA_KEY);

    // 释放所有 URL 缓存
    this.urlCache.clear();

    if (import.meta.env.DEV) {
      console.log("🗑️ 已清空所有引用，原始文件未删除");
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
    // 引用模式：file:// URL 不需要释放
    if (!url) return;

    // 从缓存中移除
    for (const [id, cachedUrl] of this.urlCache.entries()) {
      if (cachedUrl === url) {
        this.urlCache.delete(id);
        break;
      }
    }
  }
}
