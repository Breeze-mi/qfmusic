// 存储接口 - 依赖倒置原则
// 定义统一的存储接口，支持多种实现（IndexedDB、Electron FS、File System API 等）

export interface TrackMetadata {
  id: string;
  name: string;
  artists: string;
  album: string;
  duration: number;
  fileName: string;
  fileSize: number;
  fileType: string;
  addedAt: number;
}

export interface StorageInfo {
  used: number; // 已使用空间（字节）
  quota: number; // 总配额（字节）
  isPersistent: boolean; // 是否持久化存储
}

// 统一的存储接口
export interface IStorageAdapter {
  // 初始化存储
  init(): Promise<void>;

  // 保存音频文件
  saveTrack(id: string, blob: Blob, metadata: TrackMetadata): Promise<void>;

  // 获取音频文件（返回 Blob）
  getTrack(id: string): Promise<Blob | null>;

  // 获取音频 URL（优化：直接返回可播放的 URL）
  getTrackURL(id: string): Promise<string | null>;

  // 获取元数据
  getMetadata(id: string): Promise<TrackMetadata | null>;

  // 获取所有元数据
  listTracks(): Promise<TrackMetadata[]>;

  // 删除音频文件
  deleteTrack(id: string): Promise<void>;

  // 清空所有文件
  clearAll(): Promise<void>;

  // 获取存储信息
  getStorageInfo(): Promise<StorageInfo>;

  // 请求持久化存储权限
  requestPersistence(): Promise<boolean>;

  // 释放资源（如 blob URL）
  revokeTrackURL(url: string): void;
}
