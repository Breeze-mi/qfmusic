<template>
    <el-drawer v-model="playerStore.showPlaylist" direction="rtl" :size="380" :show-close="false"
        class="playlist-drawer" :modal="false" @click.self="handleClickOutside">
        <template #header>
            <div class="playlist-header">
                <div class="header-left">
                    <span class="header-title">播放列表</span>
                    <span class="song-count">{{ playerStore.playlist.length }}首</span>
                </div>
                <div class="header-right">
                    <el-button text size="small" @click="handleClearAll" :disabled="playerStore.playlist.length === 0">
                        <el-icon>
                            <Delete />
                        </el-icon>
                        清空
                    </el-button>
                    <el-button text size="small" @click="playerStore.togglePlaylist">
                        <el-icon>
                            <Close />
                        </el-icon>
                    </el-button>
                </div>
            </div>
        </template>

        <div class="playlist-content">
            <div v-if="playerStore.playlist.length === 0" class="empty-state">
                <el-empty description="播放列表为空" :image-size="120" />
            </div>
            <div v-else class="playlist-items">
                <div v-for="(song, index) in playerStore.playlist" :key="song.id" class="playlist-item" :class="{
                    'is-playing': index === playerStore.currentIndex,
                    'is-dragging': draggedIndex === index,
                    'drag-over': dragOverIndex === index
                }" draggable="true" @dragstart="handleDragStart(index, $event)" @dragend="handleDragEnd"
                    @dragover.prevent="handleDragOver(index, $event)" @dragleave="handleDragLeave"
                    @drop.prevent="handleDrop(index)" @dblclick="handlePlaySong(index)">
                    <div class="drag-handle">
                        <el-icon>
                            <DCaret />
                        </el-icon>
                    </div>
                    <div class="item-index">
                        <span v-if="index !== playerStore.currentIndex" class="index-number">{{ index + 1 }}</span>
                        <el-icon v-else class="playing-icon" :class="{ 'is-animating': playerStore.isPlaying }">
                            <VideoPlay />
                        </el-icon>
                    </div>
                    <div class="item-info">
                        <div class="song-name">{{ song.name }}</div>
                        <div class="song-artist">{{ song.artists }}</div>
                    </div>
                    <div class="item-actions">
                        <el-button text size="small" :icon="VideoPlay" @click.stop="handlePlaySong(index)" title="播放" />
                        <el-button text size="small" :icon="Delete" @click.stop="handleRemove(index)" title="删除" />
                    </div>
                </div>
            </div>
        </div>
    </el-drawer>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { Delete, VideoPlay, Close, DCaret } from "@element-plus/icons-vue";
import { usePlayerStore } from "@/stores/player";
import { ElMessageBox, ElMessage } from "element-plus";

const playerStore = usePlayerStore();

// 拖拽相关状态
const draggedIndex = ref<number | null>(null);
const dragOverIndex = ref<number | null>(null);

// 点击外部关闭
const handleClickOutside = (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    // 检查点击的是否是遮罩层或drawer外部
    if (target.classList.contains('el-drawer__container') ||
        target.classList.contains('el-overlay')) {
        playerStore.togglePlaylist();
    }
};

// 监听全局点击事件
const handleGlobalClick = (event: MouseEvent) => {
    if (!playerStore.showPlaylist) return;

    const target = event.target as HTMLElement;
    const drawer = document.querySelector('.playlist-drawer');
    const playlistButton = document.querySelector('.player-actions'); // 播放列表按钮所在区域

    // 如果点击的不是drawer内部，也不是播放列表按钮，则关闭
    if (drawer && !drawer.contains(target) &&
        playlistButton && !playlistButton.contains(target)) {
        playerStore.showPlaylist = false;
    }
};

onMounted(() => {
    // 延迟添加监听器，避免立即触发
    setTimeout(() => {
        document.addEventListener('click', handleGlobalClick);
    }, 160);
});

onUnmounted(() => {
    document.removeEventListener('click', handleGlobalClick);
});

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

// 拖拽开始
const handleDragStart = (index: number, event: DragEvent) => {
    draggedIndex.value = index;
    if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', index.toString());
    }
};

// 拖拽结束
const handleDragEnd = () => {
    draggedIndex.value = null;
    dragOverIndex.value = null;
};

// 拖拽经过
const handleDragOver = (index: number, event: DragEvent) => {
    event.preventDefault();
    if (draggedIndex.value !== null && draggedIndex.value !== index) {
        dragOverIndex.value = index;
    }
};

// 拖拽离开
const handleDragLeave = () => {
    dragOverIndex.value = null;
};

// 放置
const handleDrop = (targetIndex: number) => {
    if (draggedIndex.value === null || draggedIndex.value === targetIndex) {
        dragOverIndex.value = null;
        return;
    }

    const fromIndex = draggedIndex.value;
    const playlist = [...playerStore.playlist];
    const currentIndex = playerStore.currentIndex;

    // 移动歌曲
    const [movedSong] = playlist.splice(fromIndex, 1);
    playlist.splice(targetIndex, 0, movedSong);

    // 更新当前播放索引
    let newCurrentIndex = currentIndex;
    if (currentIndex === fromIndex) {
        // 如果移动的是当前播放的歌曲
        newCurrentIndex = targetIndex;
    } else if (fromIndex < currentIndex && targetIndex >= currentIndex) {
        // 从前面移到后面，当前索引-1
        newCurrentIndex = currentIndex - 1;
    } else if (fromIndex > currentIndex && targetIndex <= currentIndex) {
        // 从后面移到前面，当前索引+1
        newCurrentIndex = currentIndex + 1;
    }

    // 更新播放列表
    playerStore.playlist = playlist;
    playerStore.currentIndex = newCurrentIndex;

    draggedIndex.value = null;
    dragOverIndex.value = null;

    ElMessage.success("已调整播放顺序");
};
</script>

<style scoped lang="scss">
:deep(.el-drawer) {
    bottom: 70px !important;
    top: auto !important;
    height: calc(100vh - 70px) !important;
}

:deep(.el-drawer__header) {
    margin-bottom: 0;
    padding: 14px 20px;
    border-bottom: 1px solid var(--el-border-color-lighter);
}

:deep(.el-drawer__body) {
    padding: 0;
    display: flex;
    flex-direction: column;
}

.playlist-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;

    .header-left {
        display: flex;
        align-items: center;
        gap: 8px;

        .header-title {
            font-size: 16px;
            font-weight: 600;
            color: var(--el-text-color-primary);
        }

        .song-count {
            font-size: 13px;
            color: var(--el-text-color-secondary);
        }
    }

    .header-right {
        display: flex;
        align-items: center;
        gap: 4px;
    }
}

.playlist-content {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;

    .empty-state {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .playlist-items {
        flex: 1;
        overflow-y: auto;
        padding: 4px 0;

        // 自定义滚动条
        &::-webkit-scrollbar {
            width: 6px;
        }

        &::-webkit-scrollbar-track {
            background: transparent;
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
            padding: 10px 20px;
            cursor: move;
            transition: background 0.2s, opacity 0.2s, transform 0.2s;
            gap: 12px;
            position: relative;

            &:hover {
                background: var(--el-fill-color-light);

                .item-actions {
                    opacity: 1;
                }

                .drag-handle {
                    opacity: 1;
                }
            }

            &.is-playing {
                background: var(--el-color-primary-light-9);

                .song-name {
                    color: var(--el-color-primary);
                }

                .playing-icon {
                    color: var(--el-color-primary);
                }
            }

            &.is-dragging {
                opacity: 0.5;
                transform: scale(0.98);
            }

            &.drag-over {
                border-top: 2px solid var(--el-color-primary);
            }

            .drag-handle {
                width: 20px;
                flex-shrink: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0;
                transition: opacity 0.2s;
                cursor: grab;
                color: var(--el-text-color-secondary);

                &:active {
                    cursor: grabbing;
                }

                .el-icon {
                    font-size: 14px;
                    transform: rotate(90deg);
                }
            }

            .item-index {
                width: 30px;
                flex-shrink: 0;
                display: flex;
                align-items: center;
                justify-content: center;

                .index-number {
                    font-size: 13px;
                    color: var(--el-text-color-secondary);
                }

                .playing-icon {
                    font-size: 16px;

                    &.is-animating {
                        animation: pulse-icon 1.5s ease-in-out infinite;
                    }
                }
            }

            .item-info {
                flex: 1;
                min-width: 0;
                overflow: hidden;

                .song-name {
                    font-size: 14px;
                    font-weight: 500;
                    color: var(--el-text-color-primary);
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    margin-bottom: 4px;
                    line-height: 1.4;
                }

                .song-artist {
                    font-size: 12px;
                    color: var(--el-text-color-secondary);
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    line-height: 1.3;
                }
            }

            .item-actions {
                display: flex;
                align-items: center;
                gap: 4px;
                opacity: 0;
                transition: opacity 0.2s;
                flex-shrink: 0;
            }
        }
    }
}

@keyframes pulse-icon {

    0%,
    100% {
        opacity: 1;
        transform: scale(1);
    }

    50% {
        opacity: 0.6;
        transform: scale(0.95);
    }
}
</style>
