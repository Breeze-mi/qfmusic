import { defineStore } from "pinia";
import { ref, watch } from "vue";
import type { Song } from "@/api/music";
import { persist } from "@/utils/persist";

// 本地音乐文件信息
export interface LocalMusicFile extends Song {
  filePath: string; // 文件路径
  fileUrl: string; // 本地文件URL（blob URL）
  fileSize: number; // 文件大小（字节）
  addedAt: number; // 添加时间
}

const STORAGE_KEY = "local-music-files";

export const useLocalMusicStore = defineStore("localMusic", () => {
  // 从 localStorage 加载保存的状态（不包含 fileUrl，需要重新生成）
  let savedState;
  try {
    savedState = persist.load(STORAGE_KEY, {
      localFiles: [],
    });
  } catch (error) {
    console.error("加载本地音乐数据失败:", error);
    savedState = {
      localFiles: [],
    };
  }

  // 本地音乐文件列表
  const localFiles = ref<LocalMusicFile[]>(savedState.localFiles);

  // 监听状态变化，自动保存（不保存 fileUrl）
  watch(
    localFiles,
    () => {
      try {
        const filesToSave = localFiles.value.map((file) => ({
          ...file,
          fileUrl: "", // 不保存 blob URL
        }));
        persist.save(STORAGE_KEY, {
          localFiles: filesToSave,
        });
      } catch (error) {
        console.error("保存本地音乐数据失败:", error);
      }
    },
    { deep: true }
  );

  // 添加本地音乐文件
  const addLocalFile = (file: File): Promise<LocalMusicFile> => {
    return new Promise((resolve, reject) => {
      // 检查文件类型
      if (!file.type.startsWith("audio/")) {
        reject(new Error("不支持的文件类型"));
        return;
      }

      // 创建 blob URL
      const fileUrl = URL.createObjectURL(file);

      // 解析音频元数据
      const audio = new Audio();
      audio.src = fileUrl;

      audio.addEventListener("loadedmetadata", () => {
        // 从文件名提取歌曲信息
        const fileName = file.name.replace(/\.[^/.]+$/, ""); // 移除扩展名
        const parts = fileName.split("-").map((p) => p.trim());

        const localFile: LocalMusicFile = {
          id: `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: parts.length > 1 ? parts[1] : fileName,
          artists: parts.length > 1 ? parts[0] : "未知艺术家",
          album: "本地音乐",
          picUrl: "", // 本地音乐没有封面
          duration: audio.duration,
          filePath: file.name,
          fileUrl,
          fileSize: file.size,
          addedAt: Date.now(),
        };

        // 检查是否已存在
        const exists = localFiles.value.some(
          (f) =>
            f.filePath === localFile.filePath &&
            f.fileSize === localFile.fileSize
        );

        if (!exists) {
          localFiles.value.push(localFile);
        }

        resolve(localFile);
      });

      audio.addEventListener("error", () => {
        URL.revokeObjectURL(fileUrl);
        reject(new Error("无法加载音频文件"));
      });
    });
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
      } catch (error) {
        console.error(`添加文件失败: ${file.name}`, error);
      }
    }

    return results;
  };

  // 删除本地音乐文件
  const removeLocalFile = (fileId: string | number) => {
    if (!fileId) return false;
    const id = String(fileId);
    const index = localFiles.value.findIndex((f) => f.id === id);
    if (index !== -1) {
      const file = localFiles.value[index];
      // 释放 blob URL
      if (file.fileUrl) {
        URL.revokeObjectURL(file.fileUrl);
      }
      localFiles.value.splice(index, 1);
      return true;
    }
    return false;
  };

  // 清空本地音乐
  const clearLocalFiles = () => {
    // 释放所有 blob URL
    localFiles.value.forEach((file) => {
      if (file.fileUrl) {
        URL.revokeObjectURL(file.fileUrl);
      }
    });
    localFiles.value = [];
  };

  // 获取本地音乐文件
  const getLocalFile = (fileId: string | number) => {
    if (!fileId) return undefined;
    const id = String(fileId);
    return localFiles.value.find((f) => f.id === id);
  };

  // 检查是否为本地音乐
  const isLocalMusic = (songId: string | number) => {
    if (!songId) return false;
    return String(songId).startsWith("local-");
  };

  return {
    // state
    localFiles,
    // actions
    addLocalFile,
    addLocalFiles,
    removeLocalFile,
    clearLocalFiles,
    getLocalFile,
    isLocalMusic,
  };
});
