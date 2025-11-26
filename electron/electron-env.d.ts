/// <reference types="vite-plugin-electron/electron-env" />

declare namespace NodeJS {
  interface ProcessEnv {
    /**
     * The built directory structure
     *
     * ```tree
     * ├─┬─┬ dist
     * │ │ └── index.html
     * │ │
     * │ ├─┬ dist-electron
     * │ │ ├── main.js
     * │ │ └── preload.js
     * │
     * ```
     */
    APP_ROOT: string;
    /** /dist/ or /public/ */
    VITE_PUBLIC: string;
  }
}

// Used in Renderer process, expose in `preload.ts`
interface Window {
  ipcRenderer: import("electron").IpcRenderer;
  electronAPI?: {
    openF12(): void;
    saveLocalMusic(id: string, buffer: ArrayBuffer): Promise<{ success: boolean; error?: string }>;
    readLocalMusic(id: string): Promise<{ success: boolean; buffer?: ArrayBuffer; error?: string }>;
    deleteLocalMusic(id: string): Promise<{ success: boolean; error?: string }>;
    clearLocalMusic(): Promise<{ success: boolean; error?: string }>;
    readLocalFile(filePath: string): Promise<{ success: boolean; buffer?: ArrayBuffer; error?: string }>;
    showOpenDialog(): Promise<{
      success: boolean;
      canceled?: boolean;
      files?: Array<{
        path: string;
        name: string;
        size: number;
        buffer: ArrayBuffer;
      }>;
      error?: string;
    }>;
  };
  electron?: {
    invoke(channel: string, ...args: any[]): Promise<any>;
  };
}
