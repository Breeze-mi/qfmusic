import { defineStore } from "pinia";
import { ref } from "vue";
import type { Song } from "@/api/music";
import { StorageFactory } from "@/storage/storageFactory";
import type { TrackMetadata } from "@/storage/interface";

// 本地音乐文件信息
export interface LocalMusicFile extends Song {
  filePath: string;
  fileUrl: string;
  fileSize: number;
  addedAt: number;
}

export const useLocalMusicStore = defineStore("localMusic", () => {
  const storageAdapter = StorageFactory.getAdapter();

  // 本地音乐文件列表
  const localFiles = ref<LocalMusicFile[]>([]);

  // 是否已初始化
  const isInitialized = ref(false);

  // 是否正在加载
  const isLoading = ref(false);

  // 存储信息
  const storageInfo = ref({
    used: 0,
    quota: 0,
    isPersistent: false,
  });

  // 初始化：从存储恢复文件
  const initializeFromStorage = async () => {
    if (isInitialized.value) return;

    isLoading.value = true;
    try {
      await storageAdapter.init();

      // 请求持久化存储权限
      const isPersistent = await storageAdapter.requestPersistence();
      if (!isPersistent) {
        console.warn("持久化存储未启用，数据可能被浏览器清理");
      }

      // 获取存储信息
      storageInfo.value = await storageAdapter.getStorageInfo();

      // 加载所有音频元数据
      const metadataList = await storageAdapter.listTracks();

      // 懒加载：只加载元数据，URL 在需要时才生成
      localFiles.value = metadataList.map((metadata) => ({
        id: metadata.id,
        name: metadata.name,
        artists: metadata.artists,
        album: metadata.album,
        picUrl: "",
        duration: metadata.duration,
        filePath: metadata.fileName,
        fileUrl: "", // 懒加载，暂不生成 URL
        fileSize: metadata.fileSize,
        addedAt: metadata.addedAt,
      }));

      isInitialized.value = true;
    } catch (error) {
      console.error("初始化本地音乐存储失败:", error);
      isInitialized.value = true;
    } finally {
      isLoading.value = false;
    }
  };

  // 懒加载：获取音频 URL（需要时才生成）
  const getTrackURL = async (id: string): Promise<string | null> => {
    if (!id) return null;

    try {
      // 先从内存中查找已缓存的 URL
      const file = localFiles.value.find((f) => f.id === id);
      if (file?.fileUrl) {
        return file.fileUrl;
      }

      // 如果初始化还没完成，直接从存储读取（按需加载）
      if (!isInitialized.value) {
        console.log(`按需加载本地音乐 [${id}]`);
        const url = await storageAdapter.getTrackURL(id);

        // 如果成功获取，尝试加载元数据并添加到列表
        if (url) {
          const metadata = await storageAdapter.getMetadata(id);
          if (metadata) {
            if (!file) {
              // 添加到列表中
              localFiles.value.push({
                id: metadata.id,
                name: metadata.name,
                artists: metadata.artists,
                album: metadata.album,
                picUrl: "",
                duration: metadata.duration,
                filePath: metadata.fileName,
                fileUrl: url,
                fileSize: metadata.fileSize,
                addedAt: metadata.addedAt,
              });
            } else {
              // 更新 URL
              file.fileUrl = url;
            }
          }
        }

        return url;
      }

      // 初始化完成后，从存储获取 URL
      const url = await storageAdapter.getTrackURL(id);
      if (url && file) {
        file.fileUrl = url; // 缓存 URL
      }

      return url;
    } catch (error) {
      console.error(`获取音频 URL 失败 [${id}]:`, error);
      return null;
    }
  };

  // 添加本地音乐文件
  const addLocalFile = async (file: File): Promise<LocalMusicFile> => {
    // 检查文件类型
    if (!file.type.startsWith("audio/")) {
      throw new Error("不支持的文件类型");
    }

    // 创建临时 blob URL 用于解析元数据
    const tempUrl = URL.createObjectURL(file);

    try {
      // 解析音频元数据
      const audio = new Audio();
      audio.src = tempUrl;

      const metadata = await new Promise<TrackMetadata>((resolve, reject) => {
        audio.addEventListener("loadedmetadata", () => {
          const fileName = file.name.replace(/\.[^/.]+$/, "");
          const parts = fileName.split("-").map((p) => p.trim());

          const metadata: TrackMetadata = {
            id: `local-${Date.now()}-${Math.random()
              .toString(36)
              .substr(2, 9)}`,
            name: parts.length > 1 ? parts[1] : fileName,
            artists: parts.length > 1 ? parts[0] : "未知艺术家",
            album: "本地音乐",
            duration: audio.duration,
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            addedAt: Date.now(),
          };

          resolve(metadata);
        });

        audio.addEventListener("error", () => {
          reject(new Error("无法加载音频文件"));
        });

        setTimeout(() => reject(new Error("加载超时")), 5000);
      });

      // 检查是否已存在
      const exists = localFiles.value.some(
        (f) => f.filePath === file.name && f.fileSize === file.size
      );

      if (exists) {
        URL.revokeObjectURL(tempUrl);
        throw new Error("文件已存在");
      }

      // 保存到存储
      await storageAdapter.saveTrack(metadata.id, file, metadata);

      // 获取播放 URL
      const fileUrl = await storageAdapter.getTrackURL(metadata.id);

      // 添加到列表
      const localFile: LocalMusicFile = {
        id: metadata.id,
        name: metadata.name,
        artists: metadata.artists,
        album: metadata.album,
        picUrl: "",
        duration: metadata.duration,
        filePath: metadata.fileName,
        fileUrl: fileUrl || "",
        fileSize: metadata.fileSize,
        addedAt: metadata.addedAt,
      };

      localFiles.value.push(localFile);

      // 更新存储信息
      storageInfo.value = await storageAdapter.getStorageInfo();

      // 释放临时 URL
      URL.revokeObjectURL(tempUrl);

      return localFile;
    } catch (error) {
      URL.revokeObjectURL(tempUrl);
      throw error;
    }
  };

  // 批量添加本地音乐文件
  const addLocalFiles = async (
    files: FileList | File[]
  ): Promise<LocalMusicFile[]> => {
    const results: LocalMusicFile[] = [];
    const fileArray = Array.from(files);

    for (const file of fileArray) {
      try {
        const localFile = await addLocalFile(file);
        results.push(localFile);
      } catch (error: any) {
        console.error(`添加文件失败: ${file.name}`, error);
        // 继续处理其他文件
      }
    }

    return results;
  };

  // 删除本地音乐文件
  const removeLocalFile = async (fileId: string | number) => {
    if (!fileId) return false;
    const id = String(fileId);
    const index = localFiles.value.findIndex((f) => f.id === id);

    if (index !== -1) {
      const file = localFiles.value[index];

      // 释放 blob URL（如果存在）
      if (file.fileUrl && file.fileUrl.startsWith("blob:")) {
        storageAdapter.revokeTrackURL(file.fileUrl);
      }

      // 从存储删除
      try {
        await storageAdapter.deleteTrack(id);
        console.log(`文件已删除: ${file.name}`);
      } catch (error) {
        console.error("删除文件失败:", error);
      }

      // 从列表删除
      localFiles.value.splice(index, 1);

      // 更新存储信息
      storageInfo.value = await storageAdapter.getStorageInfo();

      return true;
    }
    return false;
  };

  // 清空本地音乐
  const clearLocalFiles = async () => {
    // 释放所有 blob URL
    localFiles.value.forEach((file) => {
      if (file.fileUrl && file.fileUrl.startsWith("blob:")) {
        storageAdapter.revokeTrackURL(file.fileUrl);
      }
    });

    try {
      await storageAdapter.clearAll();
      console.log("所有本地音乐已清空");
    } catch (error) {
      console.error("清空失败:", error);
    }

    localFiles.value = [];
    storageInfo.value = await storageAdapter.getStorageInfo();
  };

  // 获取本地音乐文件（支持按需加载）
  const getLocalFile = async (
    fileId: string | number
  ): Promise<LocalMusicFile | undefined> => {
    if (!fileId) return undefined;
    const id = String(fileId);

    // 先从内存中查找
    let file = localFiles.value.find((f) => f.id === id);
    if (file) return file;

    // 如果初始化还没完成，尝试从存储按需加载
    if (!isInitialized.value) {
      try {
        const metadata = await storageAdapter.getMetadata(id);
        if (metadata) {
          // 创建文件对象并添加到列表
          file = {
            id: metadata.id,
            name: metadata.name,
            artists: metadata.artists,
            album: metadata.album,
            picUrl: "",
            duration: metadata.duration,
            filePath: metadata.fileName,
            fileUrl: "", // URL 稍后按需加载
            fileSize: metadata.fileSize,
            addedAt: metadata.addedAt,
          };
          localFiles.value.push(file);
          return file;
        }
      } catch (error) {
        console.error(`按需加载元数据失败 [${id}]:`, error);
      }
    }

    return undefined;
  };

  // 检查是否为本地音乐
  const isLocalMusic = (songId: string | number) => {
    if (!songId) return false;
    return String(songId).startsWith("local-");
  };

  // 获取存储大小
  const getStorageSize = async (): Promise<number> => {
    const info = await storageAdapter.getStorageInfo();
    return info.used;
  };

  // 检查文件是否有效（同步版本）
  const isFileValid = (fileId: string | number): boolean => {
    if (!fileId) return false;
    const id = String(fileId);
    // 元数据存在即认为有效（URL 可以懒加载）
    return localFiles.value.some((f) => f.id === id);
  };

  // 刷新存储信息
  const refreshStorageInfo = async () => {
    storageInfo.value = await storageAdapter.getStorageInfo();
  };

  // 后台渐进式加载
  let backgroundLoadingAborted = false;
  const backgroundLoadQueue = ref<string[]>([]);

  const startBackgroundLoading = async (priorityIds: string[] = []) => {
    // 如果已经在加载或已完成初始化，跳过
    if (isLoading.value || isInitialized.value) return;

    backgroundLoadingAborted = false;
    isLoading.value = true;

    try {
      // 获取所有元数据
      const allMetadata = await storageAdapter.listTracks();

      // 构建加载队列：优先加载播放列表中的歌曲
      const loadedIds = new Set(localFiles.value.map((f) => f.id));
      const priorityQueue = priorityIds.filter((id) => !loadedIds.has(id));
      const normalQueue = allMetadata
        .map((m) => m.id)
        .filter((id) => !loadedIds.has(id) && !priorityIds.includes(id));

      backgroundLoadQueue.value = [...priorityQueue, ...normalQueue];

      console.log(
        `开始后台加载 ${backgroundLoadQueue.value.length} 首本地音乐`
      );

      // 逐个加载
      for (const id of backgroundLoadQueue.value) {
        if (backgroundLoadingAborted) {
          console.log("后台加载已中断");
          break;
        }

        // 检查是否已加载
        if (localFiles.value.some((f) => f.id === id)) continue;

        try {
          // 加载元数据
          const metadata = await storageAdapter.getMetadata(id);
          if (metadata && !backgroundLoadingAborted) {
            localFiles.value.push({
              id: metadata.id,
              name: metadata.name,
              artists: metadata.artists,
              album: metadata.album,
              picUrl: "",
              duration: metadata.duration,
              filePath: metadata.fileName,
              fileUrl: "", // URL 按需加载
              fileSize: metadata.fileSize,
              addedAt: metadata.addedAt,
            });
          }

          // 每加载一首，稍微延迟，避免阻塞主线程
          await new Promise((resolve) => setTimeout(resolve, 50));
        } catch (error) {
          console.error(`后台加载失败 [${id}]:`, error);
        }
      }

      if (!backgroundLoadingAborted) {
        console.log(`后台加载完成，共 ${localFiles.value.length} 首本地音乐`);
        isInitialized.value = true;
      }
    } catch (error) {
      console.error("后台加载失败:", error);
    } finally {
      isLoading.value = false;
      backgroundLoadQueue.value = [];
    }
  };

  // 中断后台加载
  const abortBackgroundLoading = () => {
    backgroundLoadingAborted = true;
  };

  // 清理所有 blob URL（用于组件卸载时释放资源）
  const cleanupBlobURLs = () => {
    localFiles.value.forEach((file) => {
      if (file.fileUrl && file.fileUrl.startsWith("blob:")) {
        storageAdapter.revokeTrackURL(file.fileUrl);
        file.fileUrl = ""; // 清空 URL，下次使用时重新生成
      }
    });
    console.log("已清理所有 blob URL");
  };

  return {
    // state
    localFiles,
    isInitialized,
    isLoading,
    storageInfo,
    backgroundLoadQueue,
    // actions
    initializeFromStorage,
    getTrackURL,
    addLocalFile,
    addLocalFiles,
    removeLocalFile,
    clearLocalFiles,
    getLocalFile,
    isLocalMusic,
    getStorageSize,
    isFileValid,
    refreshStorageInfo,
    startBackgroundLoading,
    abortBackgroundLoading,
    cleanupBlobURLs,
  };
});
