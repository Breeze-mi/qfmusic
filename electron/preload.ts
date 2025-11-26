import { ipcRenderer, contextBridge } from "electron";

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld("ipcRenderer", {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args;
    return ipcRenderer.on(channel, (event, ...args) =>
      listener(event, ...args)
    );
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...omit] = args;
    return ipcRenderer.off(channel, ...omit);
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args;
    return ipcRenderer.send(channel, ...omit);
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args;
    return ipcRenderer.invoke(channel, ...omit);
  },

  // You can expose other APTs you need here.
  // ...
});

contextBridge.exposeInMainWorld("electronAPI", {
  openF12() {
    return ipcRenderer.send("open-f12");
  },
  // 本地音乐文件系统 API
  saveLocalMusic(id: string, buffer: ArrayBuffer) {
    return ipcRenderer.invoke("save-local-music", id, buffer);
  },
  readLocalMusic(id: string) {
    return ipcRenderer.invoke("read-local-music", id);
  },
  deleteLocalMusic(id: string) {
    return ipcRenderer.invoke("delete-local-music", id);
  },
  clearLocalMusic() {
    return ipcRenderer.invoke("clear-local-music");
  },
  // 新增：读取本地文件（引用模式）
  readLocalFile(filePath: string) {
    return ipcRenderer.invoke("read-local-file", filePath);
  },
  // 新增：使用Electron dialog选择音频文件
  showOpenDialog() {
    return ipcRenderer.invoke("show-open-dialog");
  },
});

// 缓存管理 API
contextBridge.exposeInMainWorld("electron", {
  invoke(channel: string, ...args: any[]) {
    return ipcRenderer.invoke(channel, ...args);
  },
});
