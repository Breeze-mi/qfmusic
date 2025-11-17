<template>
    <el-drawer v-model="playerStore.showPlaylist" direction="btt" size="450px" title="播放列表" :show-close="true"
        class="playlist-drawer" :modal="false">
        <template #header>
            <div class="playlist-header">
                <span>播放列表 ({{ playerStore.playlist.length }})</span>
                <el-button text @click="handleClearAll">清空</el-button>
            </div>
        </template>

        <div class="playlist-content">
            <div v-for="(song, index) in playerStore.playlist" :key="song.id" class="playlist-item"
                :class="{ active: index === playerStore.currentIndex }" @click="handlePlaySong(index)">
                <div class="item-left">
                    <img :src="song.picUrl" :alt="song.name" class="song-cover" />
                    <div class="song-info">
                        <div class="song-name">
                            {{ song.name }}
                            <el-icon v-if="index === playerStore.currentIndex && playerStore.isPlaying"
                                class="playing-icon">
                                <VideoPlay />
                            </el-icon>
                        </div>
                        <div class="song-artist">{{ song.artists }}</div>
                    </div>
                </div>
                <div class="item-right">
                    <el-button text :icon="Delete" @click.stop="handleRemove(index)" />
                </div>
            </div>

            <el-empty v-if="playerStore.playlist.length === 0" description="播放列表为空" />
        </div>
    </el-drawer>
</template>

<script setup lang="ts">
import { Delete, VideoPlay } from "@element-plus/icons-vue";
import { usePlayerStore } from "@/stores/player";
import { ElMessageBox, ElMessage } from "element-plus";

const playerStore = usePlayerStore();

const handlePlaySong = (index: number) => {
    playerStore.currentIndex = index;
    playerStore.isPlaying = true;
    ElMessage.success(`开始播放：${playerStore.playlist[index].name}`);
};

const handleRemove = (index: number) => {
    const songName = playerStore.playlist[index].name;
    playerStore.removeFromPlaylist(index);
    ElMessage.success(`已从播放列表移除：${songName}`);
};

const handleClearAll = () => {
    if (playerStore.playlist.length === 0) {
        ElMessage.info("播放列表已经是空的");
        return;
    }

    ElMessageBox.confirm("确定要清空播放列表吗？", "提示", {
        confirmButtonText: "确定",
        cancelButtonText: "取消",
        type: "warning",
    }).then(() => {
        playerStore.clearPlaylist();
        ElMessage.success("播放列表已清空");
    }).catch(() => {
        // 用户取消
    });
};
</script>

<style scoped lang="scss">
// 播放列表抽屉样式 - 使用全局样式确保生效
:deep(.playlist-drawer .el-drawer) {
    bottom: 70px !important;
    height: 450px !important;
    width: 400px !important;
    max-width: 90vw !important;
    right: 0 !important;
    left: auto !important;
    margin: 0 auto !important;
}

// 额外的全局样式覆盖
:deep(.playlist-drawer.el-drawer__container) {
    position: fixed !important;
    bottom: 70px !important;
    top: auto !important;
    height: 450px !important;
    width: 400px !important;
    max-width: 90vw !important;
    right: 0 !important;
    left: auto !important;
}

:deep(.el-drawer__body) {
    padding: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

:deep(.el-drawer__header) {
    margin-bottom: 0;
    padding: 12px 16px;
    flex-shrink: 0;
    border-bottom: 1px solid var(--el-border-color-lighter);
}

.playlist-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    padding: 0 4px;
}

.playlist-content {
    flex: 1;
    overflow-y: auto;
    padding: 8px 16px;

    // 自定义滚动条
    &::-webkit-scrollbar {
        width: 6px;
    }

    &::-webkit-scrollbar-track {
        background: var(--el-fill-color-lighter);
        border-radius: 3px;
    }

    &::-webkit-scrollbar-thumb {
        background: var(--el-fill-color-dark);
        border-radius: 3px;

        &:hover {
            background: var(--el-text-color-secondary);
        }
    }

    .playlist-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 12px;
        cursor: pointer;
        transition: background 0.2s;
        border-radius: 8px;
        margin-bottom: 4px;

        &:hover {
            background: var(--el-fill-color-light);
        }

        &.active {
            background: var(--el-color-primary-light-9);

            .song-name {
                color: var(--el-color-primary);
            }
        }

        .item-left {
            display: flex;
            align-items: center;
            gap: 10px;
            flex: 1;
            min-width: 0;
            overflow: hidden;

            .song-cover {
                width: 44px;
                height: 44px;
                border-radius: 4px;
                object-fit: cover;
                flex-shrink: 0;
            }

            .song-info {
                flex: 1;
                min-width: 0;
                overflow: hidden;

                .song-name {
                    font-size: 13px;
                    font-weight: 500;
                    color: var(--el-text-color-primary);
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    display: block;
                    max-width: 100%;
                    line-height: 1.4;

                    .playing-icon {
                        color: var(--el-color-primary);
                        animation: pulse 1s ease-in-out infinite;
                        margin-left: 4px;
                        vertical-align: middle;
                        display: inline-block;
                    }
                }

                .song-artist {
                    font-size: 12px;
                    color: var(--el-text-color-secondary);
                    margin-top: 2px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    display: block;
                    max-width: 100%;
                }
            }
        }

        .item-right {
            opacity: 0;
            transition: opacity 0.2s;
            flex-shrink: 0;
            margin-left: 8px;
        }

        &:hover .item-right {
            opacity: 1;
        }
    }
}

@keyframes pulse {

    0%,
    100% {
        opacity: 1;
    }

    50% {
        opacity: 0.5;
    }
}
</style>
