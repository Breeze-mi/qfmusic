<template>
    <div class="settings-page">
        <!-- 顶部栏 -->
        <div class="top-bar">
            <h1>设置</h1>
        </div>

        <!-- 设置内容 -->
        <div class="settings-content">
            <div class="settings-section">
                <h2>外观</h2>
                <div class="setting-item">
                    <div class="setting-info">
                        <div class="setting-title">主题模式</div>
                        <div class="setting-desc">切换深色或浅色主题</div>
                    </div>
                    <el-switch v-model="themeStore.isDark" active-text="深色" inactive-text="浅色" />
                </div>
            </div>

            <div class="settings-section">
                <h2>缓存</h2>
                <div class="setting-item">
                    <div class="setting-info">
                        <div class="setting-title">缓存管理</div>
                        <div class="setting-desc">
                            <div>已缓存 {{ cacheInfo.count }} 首歌曲，占用 {{ cacheInfo.size }}</div>
                            <el-progress :percentage="cachePercentage" :show-text="false"
                                :color="cachePercentage > 80 ? '#f56c6c' : '#409eff'" style="margin-top: 8px;" />
                        </div>
                    </div>
                    <el-button type="danger" @click="handleClearCache"
                        :disabled="cacheInfo.count === 0">清空缓存</el-button>
                </div>
                <div class="setting-item">
                    <div class="setting-info">
                        <div class="setting-title">自动缓存</div>
                        <div class="setting-desc">播放过的歌曲会自动缓存，最多缓存 100 首</div>
                    </div>
                </div>
            </div>

            <div class="settings-section">
                <h2>播放</h2>
                <div class="setting-item">
                    <div class="setting-info">
                        <div class="setting-title">音质选择</div>
                        <div class="setting-desc">选择播放音质，高音质失败会自动降级</div>
                    </div>
                    <el-select v-model="settingsStore.quality" placeholder="选择音质" style="width: 160px">
                        <el-option label="标准音质 (128k)" value="standard">
                            <span>标准音质</span>
                            <span
                                style="color: var(--el-text-color-secondary); font-size: 12px; margin-left: 8px">128kbps</span>
                        </el-option>
                        <el-option label="极高音质 (320k)" value="exhigh">
                            <span>极高音质</span>
                            <span
                                style="color: var(--el-text-color-secondary); font-size: 12px; margin-left: 8px">320kbps</span>
                        </el-option>
                        <el-option label="无损音质 (FLAC)" value="lossless">
                            <span>无损音质</span>
                            <span
                                style="color: var(--el-text-color-secondary); font-size: 12px; margin-left: 8px">FLAC</span>
                        </el-option>
                        <el-option label="Hi-Res音质" value="hires">
                            <span>Hi-Res音质</span>
                            <span
                                style="color: var(--el-text-color-secondary); font-size: 12px; margin-left: 8px">24bit/96kHz</span>
                        </el-option>
                        <el-option label="高清环绕声" value="jyeffect">
                            <span>高清环绕声</span>
                        </el-option>
                        <el-option label="沉浸环绕声" value="sky">
                            <span>沉浸环绕声</span>
                        </el-option>
                        <el-option label="超清母带" value="jymaster">
                            <span>超清母带</span>
                        </el-option>
                    </el-select>
                </div>
                <div class="setting-item">
                    <div class="setting-info">
                        <div class="setting-title">播放列表</div>
                        <div class="setting-desc">当前列表 {{ playerStore.playlist.length }} 首歌曲</div>
                    </div>
                    <el-button type="danger" @click="handleClearPlaylist"
                        :disabled="playerStore.playlist.length === 0">清空列表</el-button>
                </div>
            </div>

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
import { computed } from "vue";
import { ElMessage } from "element-plus";
import { usePlayerStore } from "@/stores/player";
import { useThemeStore } from "@/stores/theme";
import { useCacheStore } from "@/stores/cache";
import { useSettingsStore } from "@/stores/settings";

const playerStore = usePlayerStore();
const themeStore = useThemeStore();
const cacheStore = useCacheStore();
const settingsStore = useSettingsStore();

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

// 获取缓存占用百分比（假设最大100MB）
const cachePercentage = computed(() => {
    const maxBytes = 100 * 1024 * 1024; // 100MB
    return Math.min((cacheInfo.value.bytes / maxBytes) * 100, 100);
});

const handleClearCache = () => {
    cacheStore.clearCache();
    ElMessage.success("缓存已清空");
};

const handleClearPlaylist = () => {
    playerStore.clearPlaylist();
    ElMessage.success("播放列表已清空");
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

                        :deep(.el-progress) {
                            width: 100%;
                        }
                    }
                }
            }
        }
    }
}
</style>
