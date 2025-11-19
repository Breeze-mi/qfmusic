<template>
    <div class="settings-page">
        <!-- 顶部栏 -->
        <div class="top-bar">
            <el-button :icon="ArrowLeft" circle @click="goBack" title="返回" />
            <h1>设置</h1>
        </div>

        <!-- 设置内容 -->
        <div class="settings-content">
            <!-- 外观设置 -->
            <div class="settings-section">
                <h2>外观</h2>
                <div class="setting-item">
                    <div class="setting-info">
                        <div class="setting-title">主题模式</div>
                        <div class="setting-desc">切换深色或浅色主题</div>
                    </div>
                    <el-switch v-model="themeStore.isDark" active-text="深色" inactive-text="浅色" />
                </div>
                <div class="setting-item">
                    <div class="setting-info">
                        <div class="setting-title">字体大小</div>
                        <div class="setting-desc">调整界面字体大小</div>
                    </div>
                    <el-radio-group v-model="settingsStore.fontSize" @change="handleFontSizeChange">
                        <el-radio-button label="small">小</el-radio-button>
                        <el-radio-button label="medium">中</el-radio-button>
                        <el-radio-button label="large">大</el-radio-button>
                    </el-radio-group>
                </div>
            </div>

            <!-- 播放设置 -->
            <div class="settings-section">
                <h2>播放</h2>
                <div class="setting-item">
                    <div class="setting-info">
                        <div class="setting-title">音质选择</div>
                        <div class="setting-desc">选择播放音质，高音质失败会自动降级</div>
                    </div>
                    <el-select v-model="settingsStore.quality" placeholder="选择音质" style="width: 180px">
                        <el-option label="标准音质 (128k)" value="standard" />
                        <el-option label="极高音质 (320k)" value="exhigh" />
                        <el-option label="无损音质 (FLAC)" value="lossless" />
                        <el-option label="Hi-Res音质" value="hires" />
                        <el-option label="高清环绕声" value="jyeffect" />
                        <el-option label="沉浸环绕声" value="sky" />
                        <el-option label="超清母带" value="jymaster" />
                    </el-select>
                </div>
            </div>

            <!-- 缓存管理 -->
            <div class="settings-section">
                <h2>缓存管理</h2>
                <div class="setting-item">
                    <div class="setting-info">
                        <div class="setting-title">试听缓存</div>
                        <div class="setting-desc">
                            <div>占用空间：{{ formatBytes(audioCacheInfo.totalSize) }}</div>
                            <el-progress :percentage="audioCachePercentage" :show-text="false"
                                :color="audioCachePercentage > 80 ? '#f56c6c' : '#409eff'" style="margin-top: 8px;" />
                        </div>
                    </div>
                    <el-button type="danger" @click="handleClearAudioCache"
                        :disabled="audioCacheInfo.totalSize === 0">清空缓存</el-button>
                </div>
                <div class="setting-item">
                    <div class="setting-info">
                        <div class="setting-title">歌词缓存</div>
                        <div class="setting-desc">
                            <div>占用空间：{{ cacheInfo.size }}</div>
                        </div>
                    </div>
                    <el-button type="danger" @click="handleClearLyricCache"
                        :disabled="cacheInfo.count === 0">清空缓存</el-button>
                </div>
                <div class="setting-item">
                    <div class="setting-info">
                        <div class="setting-title">封面缓存</div>
                        <div class="setting-desc">
                            <div>占用空间：{{ cacheInfo.size }}</div>
                        </div>
                    </div>
                    <el-button type="danger" @click="handleClearCoverCache"
                        :disabled="cacheInfo.count === 0">清空缓存</el-button>
                </div>
                <div class="setting-item">
                    <div class="setting-info">
                        <div class="setting-title">存储统计</div>
                        <div class="setting-desc">
                            <div>试听缓存：{{ formatBytes(audioCacheInfo.totalSize) }}</div>
                            <div>歌曲信息：{{ cacheInfo.size }}</div>
                            <div>本地音乐：{{ formatBytes(indexedDBInfo.used) }}（{{ indexedDBInfo.trackCount }} 首）</div>
                            <div>歌单数据：{{ playlistDataSize }}</div>
                            <div>总计：{{ totalStorageSize }}</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 数据备份 -->
            <div class="settings-section">
                <h2>数据备份</h2>
                <div class="setting-item">
                    <div class="setting-info">
                        <div class="setting-title">数据导出</div>
                        <div class="setting-desc">导出收藏和歌单数据为JSON文件</div>
                    </div>
                    <el-button type="primary" @click="handleExportData">导出数据</el-button>
                </div>
                <div class="setting-item">
                    <div class="setting-info">
                        <div class="setting-title">数据导入</div>
                        <div class="setting-desc">从JSON文件导入收藏和歌单数据</div>
                    </div>
                    <el-button type="primary" @click="handleImportData">导入数据</el-button>
                </div>
            </div>

            <!-- 网络设置 -->
            <div class="settings-section" v-if="settingsStore.isElectron()">
                <h2>网络</h2>
                <div class="setting-item">
                    <div class="setting-info">
                        <div class="setting-title">API服务器地址</div>
                        <div class="setting-desc">自定义后端API地址，留空使用默认地址</div>
                    </div>
                    <div class="api-input-group">
                        <el-input v-model="apiUrlInput" placeholder="http://localhost:3000" style="width: 300px"
                            clearable />
                        <el-button type="primary" @click="handleSaveApiUrl">保存</el-button>
                        <el-button @click="handleResetApiUrl">重置</el-button>
                    </div>
                </div>
            </div>



            <!-- 关于 -->
            <div class="settings-section">
                <h2>关于</h2>
                <div class="setting-item">
                    <div class="setting-info">
                        <div class="setting-title">版本信息</div>
                        <div class="setting-desc">网易云音乐播放器 v1.0.0</div>
                    </div>
                </div>
                <div class="setting-item">
                    <div class="setting-info">
                        <div class="setting-title">技术栈</div>
                        <div class="setting-desc">Vite + Vue 3 + TypeScript + Electron</div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { ArrowLeft } from "@element-plus/icons-vue";
import { ElMessage, ElMessageBox } from "element-plus";

import { useThemeStore } from "@/stores/theme";
import { useCacheStore } from "@/stores/cache";
import { useSettingsStore } from "@/stores/settings";
import { usePlaylistStore } from "@/stores/playlist";
import { useAudioCacheStore } from "@/stores/audioCache";
import { StorageFactory } from "@/storage/storageFactory";

const router = useRouter();
const themeStore = useThemeStore();
const cacheStore = useCacheStore();
const settingsStore = useSettingsStore();
const playlistStore = usePlaylistStore();
const audioCacheStore = useAudioCacheStore();

// API地址输入框
const apiUrlInput = ref(settingsStore.apiBaseUrl);

// IndexedDB存储信息（本地音乐）
const indexedDBInfo = ref({
    used: 0,
    quota: 0,
    trackCount: 0,
});

// 音频缓存信息
const audioCacheInfo = ref({
    count: 0,
    totalSize: 0,
});

// 加载IndexedDB信息
const loadIndexedDBInfo = async () => {
    try {
        const storage = StorageFactory.getAdapter();
        await storage.init();
        const info = await storage.getStorageInfo();
        const tracks = await storage.listTracks();
        indexedDBInfo.value = {
            used: info.used,
            quota: info.quota,
            trackCount: tracks.length,
        };
    } catch (error) {
        console.error("加载IndexedDB信息失败:", error);
    }
};

// 加载音频缓存信息
const loadAudioCacheInfo = async () => {
    try {
        // 无论 Web 还是 Electron 环境，音频缓存都使用 IndexedDB
        // 因为音频缓存是在渲染进程中管理的
        const stats = await audioCacheStore.getCacheStats();
        audioCacheInfo.value = stats;
    } catch (error) {
        console.error("加载音频缓存信息失败:", error);
    }
};

onMounted(() => {
    loadIndexedDBInfo();
    loadAudioCacheInfo();
});

const goBack = () => {
    router.push("/");
};

// 计算缓存信息
const cacheInfo = computed(() => {
    const info = cacheStore.getCacheInfo();
    return {
        count: info.count,
        size: formatBytes(info.bytes),
        bytes: info.bytes
    };
});

// 格式化字节大小
const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

// 计算音频缓存占用百分比（基于空间大小，假设最大 500MB）
const audioCachePercentage = computed(() => {
    const maxSize = 500 * 1024 * 1024; // 500MB
    return Math.min((audioCacheInfo.value.totalSize / maxSize) * 100, 100);
});

// 计算歌单数据大小
const playlistDataSize = computed(() => {
    try {
        const playlistKey = "music-playlists";
        const stored = localStorage.getItem(playlistKey);
        if (stored) {
            return formatBytes(new Blob([stored]).size);
        }
        return "0 B";
    } catch (error) {
        return "0 B";
    }
});

// 计算总存储大小
const totalStorageSize = computed(() => {
    const onlineAudioBytes = audioCacheInfo.value.totalSize;
    const localMusicBytes = indexedDBInfo.value.used;
    const localStorageBytes = cacheStore.getTotalStorageSize();
    return formatBytes(onlineAudioBytes + localMusicBytes + localStorageBytes);
});

// 清空试听缓存
const handleClearAudioCache = async () => {
    ElMessageBox.confirm(
        `确定要清空试听缓存吗？这将删除约 ${formatBytes(audioCacheInfo.value.totalSize)} 的缓存数据。下次播放时需要重新下载。`,
        "清空确认",
        {
            confirmButtonText: "确定",
            cancelButtonText: "取消",
            type: "warning",
        }
    )
        .then(async () => {
            try {
                // 无论 Web 还是 Electron 环境，都使用 IndexedDB 清空
                await audioCacheStore.clearAllCache();
                await loadAudioCacheInfo();
                ElMessage.success("试听缓存已清空");
            } catch (error) {
                console.error("清空试听缓存失败:", error);
                ElMessage.error("清空失败");
            }
        })
        .catch(() => { });
};

// 清空歌词缓存
const handleClearLyricCache = async () => {
    ElMessageBox.confirm(
        `确定要清空歌词缓存吗？这将删除 ${cacheInfo.value.count} 首歌曲的歌词信息。`,
        "清空确认",
        {
            confirmButtonText: "确定",
            cancelButtonText: "取消",
            type: "warning",
        }
    )
        .then(async () => {
            try {
                if (settingsStore.isElectron()) {
                    // Electron 环境
                    const result = await (window as any).electron?.invoke("clear-lyric-cache");
                    if (result?.success) {
                        cacheStore.clearLyricCache();
                        ElMessage.success("歌词缓存已清空");
                    } else {
                        throw new Error(result?.error || "清空失败");
                    }
                } else {
                    // Web 环境
                    cacheStore.clearLyricCache();
                    ElMessage.success("歌词缓存已清空");
                }
            } catch (error) {
                console.error("清空歌词缓存失败:", error);
                ElMessage.error("清空失败");
            }
        })
        .catch(() => { });
};

// 清空封面缓存
const handleClearCoverCache = async () => {
    ElMessageBox.confirm(
        `确定要清空封面缓存吗？这将删除 ${cacheInfo.value.count} 首歌曲的封面图片。`,
        "清空确认",
        {
            confirmButtonText: "确定",
            cancelButtonText: "取消",
            type: "warning",
        }
    )
        .then(async () => {
            try {
                if (settingsStore.isElectron()) {
                    // Electron 环境
                    const result = await (window as any).electron?.invoke("clear-cover-cache");
                    if (result?.success) {
                        cacheStore.clearCoverCache();
                        ElMessage.success("封面缓存已清空");
                    } else {
                        throw new Error(result?.error || "清空失败");
                    }
                } else {
                    // Web 环境
                    cacheStore.clearCoverCache();
                    ElMessage.success("封面缓存已清空");
                }
            } catch (error) {
                console.error("清空封面缓存失败:", error);
                ElMessage.error("清空失败");
            }
        })
        .catch(() => { });
};

// 导出数据
const handleExportData = () => {
    try {
        const data = {
            version: "1.0.0",
            exportTime: new Date().toISOString(),
            favorites: playlistStore.favoriteList,
            playlists: playlistStore.playlists,
            history: playlistStore.historyList,
        };

        const jsonStr = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `music-data-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        ElMessage.success("数据导出成功");
    } catch (error) {
        console.error("导出数据失败:", error);
        ElMessage.error("数据导出失败");
    }
};

// 导入数据
const handleImportData = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = async (e: Event) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;

        try {
            const text = await file.text();
            const data = JSON.parse(text);

            // 验证数据格式
            if (!data.version || !data.favorites || !data.playlists) {
                throw new Error("数据格式不正确");
            }

            ElMessageBox.confirm(
                "导入数据将覆盖当前的收藏和歌单，是否继续？",
                "导入确认",
                {
                    confirmButtonText: "确定",
                    cancelButtonText: "取消",
                    type: "warning",
                }
            )
                .then(() => {
                    playlistStore.favoriteList = data.favorites || [];
                    playlistStore.playlists = data.playlists || [];
                    if (data.history) {
                        playlistStore.historyList = data.history;
                    }
                    ElMessage.success("数据导入成功");
                })
                .catch(() => { });
        } catch (error) {
            console.error("导入数据失败:", error);
            ElMessage.error("数据导入失败，请检查文件格式");
        }
    };
    input.click();
};

// 字体大小变化
const handleFontSizeChange = (size: string) => {
    settingsStore.setFontSize(size as any);
    ElMessage.success("字体大小已更新");
};

// 保存API地址
const handleSaveApiUrl = () => {
    const url = apiUrlInput.value.trim();
    // 验证URL格式
    if (url && !url.startsWith("http://") && !url.startsWith("https://")) {
        ElMessage.warning("请输入有效的URL地址（以http://或https://开头）");
        return;
    }
    settingsStore.setApiBaseUrl(url);
    ElMessage.success("API地址已保存，重启应用后生效");
};

// 重置API地址
const handleResetApiUrl = () => {
    apiUrlInput.value = "";
    settingsStore.setApiBaseUrl("");
    ElMessage.success("已重置为默认API地址");
};
</script>

<style scoped lang="scss">
.settings-page {
    height: 100vh;
    display: flex;
    flex-direction: column;
    background: var(--el-bg-color);

    .top-bar {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 16px 24px;
        background: var(--el-bg-color);
        border-bottom: 1px solid var(--el-border-color);

        h1 {
            margin: 0;
            font-size: 20px;
            font-weight: 600;
            color: var(--el-text-color-primary);
        }
    }

    .settings-content {
        flex: 1;
        overflow-y: auto;
        padding: 24px;
        padding-bottom: 90px;

        .settings-section {
            margin-bottom: 32px;

            h2 {
                font-size: 16px;
                font-weight: 600;
                color: var(--el-text-color-primary);
                margin: 0 0 16px 0;
                padding-bottom: 8px;
                border-bottom: 1px solid var(--el-border-color-lighter);
            }

            .setting-item {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 16px;
                background: var(--el-fill-color-blank);
                border-radius: 8px;
                margin-bottom: 12px;
                transition: background 0.2s;

                &:hover {
                    background: var(--el-fill-color-light);
                }

                .setting-info {
                    flex: 1;

                    .setting-title {
                        font-size: 15px;
                        font-weight: 500;
                        color: var(--el-text-color-primary);
                        margin-bottom: 4px;
                    }

                    .setting-desc {
                        font-size: 13px;
                        color: var(--el-text-color-secondary);
                        max-width: 500px;

                        >div {
                            margin-bottom: 4px;

                            &:last-child {
                                margin-bottom: 0;
                            }
                        }

                        :deep(.el-progress) {
                            width: 100%;
                        }
                    }
                }

                .api-input-group {
                    display: flex;
                    gap: 8px;
                    align-items: center;
                }
            }
        }
    }
}
</style>
