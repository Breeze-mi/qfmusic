import { app, BrowserWindow, ipcMain } from "electron";
// import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

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

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      devTools: true, // 启用开发者工具
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
import fs from "fs/promises";
import { existsSync } from "fs";

// 存储文件路径映射
const localMusicDir = path.join(app.getPath("userData"), "local-music");

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

app.whenReady().then(() => {
  if (VITE_DEV_SERVER_URL) {
    ipcMain.on("open-f12", () => {
      win?.webContents.openDevTools();
    });
  }
  createWindow();
});
