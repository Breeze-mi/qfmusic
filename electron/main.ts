import { app, BrowserWindow, ipcMain, dialog, Tray, Menu, nativeImage } from "electron";
// import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "fs/promises";
import { existsSync } from "fs";
// const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, "..");

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, "public")
  : RENDERER_DIST;

let win: BrowserWindow | null;
let tray: Tray | null = null;

// 创建系统托盘
function createTray() {
  // 使用应用图标创建托盘
  const iconPath = path.join(process.env.VITE_PUBLIC, "icon.ico");

  // 创建托盘图标
  tray = new Tray(iconPath);

  // 设置托盘提示文字
  tray.setToolTip("清风音乐");

  // 创建托盘右键菜单
  const contextMenu = Menu.buildFromTemplate([
    {
      label: "显示主窗口",
      click: () => {
        if (win) {
          win.show();
          win.focus();
        }
      }
    },
    {
      type: "separator"
    },
    {
      label: "退出",
      click: () => {
        app.isQuiting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);

  // 双击托盘图标显示窗口
  tray.on("double-click", () => {
    if (win) {
      win.show();
      win.focus();
    }
  });
}

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, "icon.ico"),
    width: 1200,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      devTools: !app.isPackaged, // 仅开发环境启用开发工具
      // 为了支持 file:// 协议访问本地文件，需要特殊配置
      // 使用更安全的方式：只在打包后的生产环境禁用 webSecurity
      webSecurity: false, // 访问本地文件需要
      nodeIntegration: false, // 保持禁用
      contextIsolation: true, // 保持启用
      allowRunningInsecureContent: false,
    },
  });

  // 开发环境下自动打开开发者工具
  if (VITE_DEV_SERVER_URL) {
    win.webContents.openDevTools();
  }

  // Test active push message to Renderer-process.
  win.webContents.on("did-finish-load", () => {
    win?.webContents.send("main-process-message", new Date().toLocaleString());
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }

  // 处理窗口关闭事件
  win.on("close", (event) => {
    if (!app.isQuiting) {
      event.preventDefault();

      // 从渲染进程获取设置
      win?.webContents.send("get-tray-setting");

      // 默认最小化到托盘（如果用户没有设置，默认启用）
      win?.hide();
    }
  });
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});

app.on("activate", () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// 本地音乐文件存储 IPC 处理

// 存储文件路径映射
const localMusicDir = path.join(app.getPath("userData"), "local-music");
const audioCacheDir = path.join(app.getPath("userData"), "audio-cache");
const coverCacheDir = path.join(app.getPath("userData"), "cover-cache");
const lyricCacheDir = path.join(app.getPath("userData"), "lyric-cache");

// 确保目录存在
async function ensureLocalMusicDir() {
  if (!existsSync(localMusicDir)) {
    await fs.mkdir(localMusicDir, { recursive: true });
  }
}

// 保存音频文件
ipcMain.handle(
  "save-local-music",
  async (_event, id: string, buffer: ArrayBuffer) => {
    try {
      await ensureLocalMusicDir();
      const filePath = path.join(localMusicDir, `${id}.audio`);
      await fs.writeFile(filePath, Buffer.from(buffer));
      return { success: true, filePath };
    } catch (error: any) {
      console.error("保存音频文件失败:", error);
      return { success: false, error: error.message };
    }
  }
);

// 读取音频文件
ipcMain.handle("read-local-music", async (_event, id: string) => {
  try {
    const filePath = path.join(localMusicDir, `${id}.audio`);
    if (!existsSync(filePath)) {
      return { success: false, error: "文件不存在" };
    }
    const buffer = await fs.readFile(filePath);
    return { success: true, buffer: buffer.buffer };
  } catch (error: any) {
    console.error("读取音频文件失败:", error);
    return { success: false, error: error.message };
  }
});

// 删除音频文件
ipcMain.handle("delete-local-music", async (_event, id: string) => {
  try {
    const filePath = path.join(localMusicDir, `${id}.audio`);
    if (existsSync(filePath)) {
      await fs.unlink(filePath);
    }
    return { success: true };
  } catch (error: any) {
    console.error("删除音频文件失败:", error);
    return { success: false, error: error.message };
  }
});

// 清空所有音频文件
ipcMain.handle("clear-local-music", async () => {
  try {
    if (existsSync(localMusicDir)) {
      const files = await fs.readdir(localMusicDir);
      await Promise.all(
        files.map((file) => fs.unlink(path.join(localMusicDir, file)))
      );
    }
    return { success: true };
  } catch (error: any) {
    console.error("清空音频文件失败:", error);
    return { success: false, error: error.message };
  }
});

// 缓存管理 IPC 处理

// 确保目录存在
async function ensureDir(dir: string) {
  if (!existsSync(dir)) {
    await fs.mkdir(dir, { recursive: true });
  }
}

// 获取目录大小
async function getDirSize(dir: string): Promise<number> {
  if (!existsSync(dir)) return 0;

  let totalSize = 0;
  const files = await fs.readdir(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stats = await fs.stat(filePath);
    if (stats.isFile()) {
      totalSize += stats.size;
    }
  }

  return totalSize;
}

// 清空目录
async function clearDir(dir: string) {
  if (!existsSync(dir)) return;

  const files = await fs.readdir(dir);
  await Promise.all(files.map((file) => fs.unlink(path.join(dir, file))));
}

// 保存音频缓存到文件系统
ipcMain.handle(
  "save-audio-cache",
  async (_event, songId: string, buffer: ArrayBuffer, metadata: any) => {
    try {
      await ensureDir(audioCacheDir);

      // 保存音频文件
      const audioFilePath = path.join(audioCacheDir, `${songId}.audio`);
      await fs.writeFile(audioFilePath, Buffer.from(buffer));

      // 保存元数据
      const metadataFilePath = path.join(audioCacheDir, `${songId}.meta.json`);
      await fs.writeFile(metadataFilePath, JSON.stringify(metadata, null, 2));

      console.log(
        `音频缓存已保存: ${songId}, 大小: ${(
          buffer.byteLength /
          1024 /
          1024
        ).toFixed(2)} MB`
      );
      return { success: true };
    } catch (error: any) {
      console.error("保存音频缓存失败:", error);
      return { success: false, error: error.message };
    }
  }
);

// 获取试听缓存大小
ipcMain.handle("get-audio-cache-size", async () => {
  try {
    const size = await getDirSize(audioCacheDir);
    return { success: true, size };
  } catch (error: any) {
    console.error("获取试听缓存大小失败:", error);
    return { success: false, error: error.message, size: 0 };
  }
});

// 清空试听缓存
ipcMain.handle("clear-audio-cache", async () => {
  try {
    await clearDir(audioCacheDir);
    console.log("试听缓存已清空");
    return { success: true };
  } catch (error: any) {
    console.error("清空试听缓存失败:", error);
    return { success: false, error: error.message };
  }
});

// 获取封面缓存大小
ipcMain.handle("get-cover-cache-size", async () => {
  try {
    const size = await getDirSize(coverCacheDir);
    return { success: true, size };
  } catch (error: any) {
    console.error("获取封面缓存大小失败:", error);
    return { success: false, error: error.message, size: 0 };
  }
});

// 清空封面缓存
ipcMain.handle("clear-cover-cache", async () => {
  try {
    await clearDir(coverCacheDir);
    console.log("封面缓存已清空");
    return { success: true };
  } catch (error: any) {
    console.error("清空封面缓存失败:", error);
    return { success: false, error: error.message };
  }
});

// 获取歌词缓存大小
ipcMain.handle("get-lyric-cache-size", async () => {
  try {
    const size = await getDirSize(lyricCacheDir);
    return { success: true, size };
  } catch (error: any) {
    console.error("获取歌词缓存大小失败:", error);
    return { success: false, error: error.message, size: 0 };
  }
});

// 清空歌词缓存
ipcMain.handle("clear-lyric-cache", async () => {
  try {
    await clearDir(lyricCacheDir);
    console.log("歌词缓存已清空");
    return { success: true };
  } catch (error: any) {
    console.error("清空歌词缓存失败:", error);
    return { success: false, error: error.message };
  }
});

// 获取所有缓存统计
ipcMain.handle("get-cache-stats", async () => {
  try {
    const audioSize = await getDirSize(audioCacheDir);
    const coverSize = await getDirSize(coverCacheDir);
    const lyricSize = await getDirSize(lyricCacheDir);
    const localMusicSize = await getDirSize(localMusicDir);

    return {
      success: true,
      stats: {
        audioCache: audioSize,
        coverCache: coverSize,
        lyricCache: lyricSize,
        localMusic: localMusicSize,
        total: audioSize + coverSize + lyricSize + localMusicSize,
      },
    };
  } catch (error: any) {
    console.error("获取缓存统计失败:", error);
    return { success: false, error: error.message };
  }
});

// 新增：读取本地文件（引用模式）
ipcMain.handle("read-local-file", async (_event, filePath: string) => {
  try {
    if (!existsSync(filePath)) {
      return { success: false, error: "文件不存在" };
    }
    const buffer = await fs.readFile(filePath);
    return { success: true, buffer: buffer.buffer };
  } catch (error: any) {
    console.error("读取本地文件失败:", error);
    return { success: false, error: error.message };
  }
});

// 新增：使用Electron dialog选择音频文件
ipcMain.handle("show-open-dialog", async () => {
  try {
    const result = await dialog.showOpenDialog({
      properties: ["openFile", "multiSelections"],
      filters: [
        { name: "音频文件", extensions: ["mp3", "flac", "wav", "ogg", "m4a", "aac", "wma"] },
        { name: "所有文件", extensions: ["*"] }
      ],
      title: "选择音频文件"
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, canceled: true };
    }

    // 读取每个文件的信息并返回
    const filesInfo = await Promise.all(
      result.filePaths.map(async (filePath) => {
        const stats = await fs.stat(filePath);
        const buffer = await fs.readFile(filePath);
        return {
          path: filePath,
          name: path.basename(filePath),
          size: stats.size,
          buffer: buffer.buffer,
        };
      })
    );

    return { success: true, files: filesInfo };
  } catch (error: any) {
    console.error("选择文件失败:", error);
    return { success: false, error: error.message };
  }
});

// IPC 处理：控制是否最小化到托盘
ipcMain.handle("set-close-to-tray", async (_event, enabled: boolean) => {
  app.isQuiting = !enabled;
  return { success: true };
});

// IPC 处理：显示/隐藏窗口
ipcMain.handle("show-window", async () => {
  if (win) {
    win.show();
    win.focus();
  }
  return { success: true };
});

ipcMain.handle("hide-window", async () => {
  if (win) {
    win.hide();
  }
  return { success: true };
});

app.whenReady().then(() => {
  // 创建系统托盘
  createTray();

  if (VITE_DEV_SERVER_URL) {
    ipcMain.on("open-f12", () => {
      win?.webContents.openDevTools();
    });
  }
  createWindow();
});
