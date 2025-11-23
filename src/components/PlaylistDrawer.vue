<template>
    <!-- 遮罩层 -->
    <transition name="fade">
        <div v-if="playerStore.showPlaylist" class="playlist-overlay" @click="handleClickOutside"></div>
    </transition>

    <!-- 自定义侧边栏 -->
    <transition name="slide">
        <div v-if="playerStore.showPlaylist" class="playlist-drawer">
            <!-- 头部 -->
            <div class="playlist-header">
                <div class="header-main">
                    <div class="header-left">
                        <span class="header-title">播放列表</span>
                        <span class="song-count">{{ playerStore.playlist.length }}首</span>
                    </div>
                    <div class="header-right">
                        <el-button v-if="selectedIndices.size > 0" text size="small" type="danger"
                            @click="handleRemoveSelected" class="text-btn">
                            删除选中
                        </el-button>
                        <el-button v-if="selectedIndices.size > 0" text size="small" @click="handleCancelSelect"
                            class="text-btn">
                            取消
                        </el-button>
                        <el-button v-else text size="small" @click="handleClearAll"
                            :disabled="playerStore.playlist.length === 0" class="text-btn">
                            清空
                        </el-button>
                        <el-button text size="small" @click="handleClosePlaylist" class="icon-btn">
                            <el-icon>
                                <Close />
                            </el-icon>
                        </el-button>
                    </div>
                </div>
            </div>

            <!-- 内容区 -->
            <div class="playlist-content">
                <div v-if="playerStore.playlist.length === 0" class="empty-state">
                    <el-empty description="播放列表为空" :image-size="120" />
                </div>
                <div v-else class="playlist-items">
                    <div v-for="(song, index) in playerStore.playlist" :key="song.id" class="playlist-item" :class="{
                        'is-playing': index === playerStore.currentIndex,
                        'is-dragging': draggedIndex === index,
                        'drag-over': dragOverIndex === index,
                        'is-selected': selectedIndices.has(index),
                        'is-focused': focusedIndex === index && !selectedIndices.has(index)
                    }" draggable="true" @dragstart="handleDragStart(index, $event)" @dragend="handleDragEnd"
                        @dragover.prevent="handleDragOver(index, $event)" @dragleave="handleDragLeave"
                        @drop.prevent="handleDrop(index, $event)" @dblclick="handlePlaySong(index)"
                        @click="handleSongClick(index, $event)">
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
                            <el-button text size="small" :icon="VideoPlay" @click.stop="handlePlaySong(index)"
                                title="播放" />
                            <el-button text size="small" :icon="Delete" @click.stop="handleRemove(index)" title="删除" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </transition>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from "vue";
import { Delete, VideoPlay, Close } from "@element-plus/icons-vue";
import { usePlayerStore } from "@/stores/player";
import { ElMessageBox, ElMessage } from "element-plus";

const playerStore = usePlayerStore();

// 拖拽相关状态
const draggedIndex = ref<number | null>(null);
const dragOverIndex = ref<number | null>(null);

// 多选相关状态
const selectedIndices = ref<Set<number>>(new Set());
const lastSelectedIndex = ref<number | null>(null);
const focusedIndex = ref<number | null>(null); // 临时聚焦的索引

// 点击遮罩层关闭
const handleClickOutside = () => {
    playerStore.togglePlaylist();
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

// 监听播放列表显示状态，关闭时清空选中
watch(() => playerStore.showPlaylist, (newVal) => {
    if (!newVal) {
        // 播放列表关闭时，清空选中状态和聚焦状态
        selectedIndices.value.clear();
        lastSelectedIndex.value = null;
        focusedIndex.value = null;
    }
});

onMounted(() => {
    // 延迟添加监听器，避免立即触发
    setTimeout(() => {
        document.addEventListener('click', handleGlobalClick);
    }, 160);
});

onUnmounted(() => {
    document.removeEventListener('click', handleGlobalClick);
});

// 处理歌曲点击（支持多选）
const handleSongClick = (index: number, event: MouseEvent) => {
    // Ctrl/Cmd + 点击：真正选中/取消选择
    if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        // 清除聚焦状态
        focusedIndex.value = null;
        if (selectedIndices.value.has(index)) {
            selectedIndices.value.delete(index);
            if (selectedIndices.value.size === 0) {
                lastSelectedIndex.value = null;
            }
        } else {
            selectedIndices.value.add(index);
            lastSelectedIndex.value = index;
        }
    }
    // Shift + 点击：范围选择
    else if (event.shiftKey) {
        event.preventDefault();
        // 确定范围选择的起点：优先使用 focusedIndex，其次使用 lastSelectedIndex
        const startIndex = focusedIndex.value !== null ? focusedIndex.value :
            (lastSelectedIndex.value !== null ? lastSelectedIndex.value : index);

        // 清除聚焦状态
        focusedIndex.value = null;

        // 范围选择
        const start = Math.min(startIndex, index);
        const end = Math.max(startIndex, index);
        selectedIndices.value.clear();
        for (let i = start; i <= end; i++) {
            selectedIndices.value.add(i);
        }
        // 保持起点作为 lastSelectedIndex，以便后续的 Shift 选择
        lastSelectedIndex.value = startIndex;
    }
    // 普通点击：临时聚焦（不是真正选中）
    else {
        // 清空真正的选中状态
        selectedIndices.value.clear();
        // 设置临时聚焦，并记录为起点用于 Shift 选择
        focusedIndex.value = index;
        // 同时记录 lastSelectedIndex，这样 Shift 选择时会以这个为起点
        lastSelectedIndex.value = index;
    }
};

const handlePlaySong = (index: number) => {
    // 使用 playerStore 的 switchToIndex 方法切换歌曲
    if (index >= 0 && index < playerStore.playlist.length) {
        const song = playerStore.playlist[index];

        // 如果是当前正在播放的歌曲，使用 switchToIndex 来重新播放
        if (index === playerStore.currentIndex) {
            playerStore.switchToIndex(index);
            // ElMessage.success(`重新播放：${song.name}`);
        } else {
            playerStore.currentIndex = index;
            playerStore.currentSong = song; // 手动设置 currentSong
            playerStore.isPlaying = true;
            ElMessage.success(`开始播放：${song.name}`);
        }
    }
    // 清空选中状态和聚焦状态
    selectedIndices.value.clear();
    lastSelectedIndex.value = null;
    focusedIndex.value = null;
};

const handleRemove = (index: number) => {
    const songName = playerStore.playlist[index].name;

    ElMessageBox.confirm(`确定要从播放列表中删除《${songName}》吗？`, "删除确认", {
        confirmButtonText: "确定",
        cancelButtonText: "取消",
        type: "warning",
    }).then(() => {
        playerStore.removeFromPlaylist(index);
        ElMessage.success(`已从播放列表移除：${songName}`);
        // 清空选中状态和聚焦状态
        selectedIndices.value.clear();
        lastSelectedIndex.value = null;
        focusedIndex.value = null;
    }).catch(() => {
        // 用户取消删除
    });
};

// 批量删除选中的歌曲
const handleRemoveSelected = () => {
    if (selectedIndices.value.size === 0) {
        ElMessage.info("请先选择要删除的歌曲");
        return;
    }

    const count = selectedIndices.value.size;
    ElMessageBox.confirm(`确定要删除选中的 ${count} 首歌曲吗？`, "批量删除确认", {
        confirmButtonText: "确定",
        cancelButtonText: "取消",
        type: "warning",
    }).then(() => {
        // 从大到小排序索引，避免删除时索引变化
        const sortedIndices = Array.from(selectedIndices.value).sort((a, b) => b - a);
        sortedIndices.forEach((index) => {
            playerStore.removeFromPlaylist(index);
        });
        ElMessage.success(`已删除 ${count} 首歌曲`);
        selectedIndices.value.clear();
        lastSelectedIndex.value = null;
        focusedIndex.value = null;
    }).catch(() => {
        // 用户取消
    });
};

// 取消选中
const handleCancelSelect = () => {
    selectedIndices.value.clear();
    lastSelectedIndex.value = null;
    focusedIndex.value = null;
};

// 关闭播放列表（清空选中状态）
const handleClosePlaylist = () => {
    selectedIndices.value.clear();
    lastSelectedIndex.value = null;
    focusedIndex.value = null;
    playerStore.togglePlaylist();
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
        selectedIndices.value.clear();
        lastSelectedIndex.value = null;
        focusedIndex.value = null;
        ElMessage.success("播放列表已清空");
    }).catch(() => {
        // 用户取消
    });
};

// 拖拽开始
const handleDragStart = (index: number, event: DragEvent) => {
    // 如果当前项未被选中，且有其他选中项，则清空选中并只拖拽当前项
    if (!selectedIndices.value.has(index) && selectedIndices.value.size > 0) {
        selectedIndices.value.clear();
        lastSelectedIndex.value = null;
    }

    // 如果当前项未被选中，则只拖拽当前项
    if (!selectedIndices.value.has(index)) {
        draggedIndex.value = index;
        if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', JSON.stringify([index]));
        }
    } else {
        // 如果当前项已被选中，则拖拽所有选中项
        draggedIndex.value = index; // 记录拖拽起始位置
        const selectedArray = Array.from(selectedIndices.value).sort((a, b) => a - b);
        if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', JSON.stringify(selectedArray));
        }
    }
};

// 拖拽结束
const handleDragEnd = () => {
    draggedIndex.value = null;
    dragOverIndex.value = null;
    // 注意：不清空选中状态，让用户可以继续操作
};

// 拖拽经过
const handleDragOver = (index: number, event: DragEvent) => {
    event.preventDefault();

    if (draggedIndex.value === null) return;

    // 如果拖拽到选中项上，不显示插入线
    if (selectedIndices.value.has(index)) {
        dragOverIndex.value = null;
        return;
    }

    // 如果不是拖拽到自己，显示插入线
    if (draggedIndex.value !== index) {
        dragOverIndex.value = index;
    }
};

// 拖拽离开
const handleDragLeave = () => {
    dragOverIndex.value = null;
};

// 放置
const handleDrop = (targetIndex: number, event: DragEvent) => {
    if (draggedIndex.value === null) {
        dragOverIndex.value = null;
        return;
    }

    // 获取拖拽的索引数组
    const draggedIndicesStr = event.dataTransfer?.getData('text/plain');
    if (!draggedIndicesStr) {
        dragOverIndex.value = null;
        return;
    }

    const draggedIndicesArray: number[] = JSON.parse(draggedIndicesStr);

    // 排序拖拽的索引（保持原有顺序）
    const sortedDraggedIndices = [...draggedIndicesArray].sort((a, b) => a - b);

    // 如果目标位置在拖拽项中间，不做任何操作
    if (sortedDraggedIndices.includes(targetIndex)) {
        draggedIndex.value = null;
        dragOverIndex.value = null;
        return;
    }

    // 如果只拖拽一个项目且目标位置相同，则不做任何操作
    if (draggedIndicesArray.length === 1 && draggedIndicesArray[0] === targetIndex) {
        draggedIndex.value = null;
        dragOverIndex.value = null;
        return;
    }

    const playlist = [...playerStore.playlist];
    const currentPlayingIndex = playerStore.currentIndex;

    if (draggedIndicesArray.length === 1) {
        // ========== 单个项目拖拽 ==========
        const fromIndex = draggedIndicesArray[0];
        const [movedSong] = playlist.splice(fromIndex, 1);

        // 计算实际插入位置
        let actualTargetIndex = targetIndex;
        if (fromIndex < targetIndex) {
            actualTargetIndex = targetIndex - 1;
        }

        playlist.splice(actualTargetIndex, 0, movedSong);

        // 更新当前播放索引
        let newCurrentIndex = currentPlayingIndex;
        if (currentPlayingIndex === fromIndex) {
            // 移动的是当前播放的歌曲
            newCurrentIndex = actualTargetIndex;
        } else if (fromIndex < currentPlayingIndex && actualTargetIndex >= currentPlayingIndex) {
            // 从当前播放位置前面移到后面
            newCurrentIndex = currentPlayingIndex - 1;
        } else if (fromIndex > currentPlayingIndex && actualTargetIndex <= currentPlayingIndex) {
            // 从当前播放位置后面移到前面
            newCurrentIndex = currentPlayingIndex + 1;
        }

        playerStore.playlist = playlist;
        playerStore.currentIndex = newCurrentIndex;
    } else {
        // ========== 多个项目拖拽 ==========

        // 1. 提取要移动的歌曲（按原始顺序）
        const movedSongs = sortedDraggedIndices.map(i => playlist[i]);

        // 2. 记录当前播放的歌曲（如果在移动列表中）
        const currentSongInMoved = sortedDraggedIndices.includes(currentPlayingIndex);
        const currentSong = currentSongInMoved ? playlist[currentPlayingIndex] : null;

        // 3. 创建新的播放列表（不包含要移动的歌曲）
        const remainingPlaylist = playlist.filter((_, index) => !sortedDraggedIndices.includes(index));

        // 4. 计算实际插入位置
        // 计算目标位置之前有多少被移动的歌曲
        const movedBeforeTarget = sortedDraggedIndices.filter(i => i < targetIndex).length;
        let actualInsertIndex = targetIndex - movedBeforeTarget;

        // 确保插入位置在有效范围内
        actualInsertIndex = Math.max(0, Math.min(actualInsertIndex, remainingPlaylist.length));

        // 5. 在新位置插入歌曲
        const newPlaylist = [
            ...remainingPlaylist.slice(0, actualInsertIndex),
            ...movedSongs,
            ...remainingPlaylist.slice(actualInsertIndex)
        ];

        // 6. 计算新的当前播放索引
        let newCurrentIndex = currentPlayingIndex;

        if (currentSongInMoved) {
            // 如果当前播放的歌曲在被移动的歌曲中
            // 找到它在新列表中的位置
            newCurrentIndex = newPlaylist.findIndex(song => song.id === currentSong!.id);
        } else {
            // 如果当前播放的歌曲不在被移动的歌曲中
            // 找到它在新列表中的位置
            const currentSongObj = playlist[currentPlayingIndex];
            newCurrentIndex = newPlaylist.findIndex(song => song.id === currentSongObj.id);
        }

        // 确保索引有效
        if (newCurrentIndex === -1) {
            newCurrentIndex = currentPlayingIndex;
        }

        playerStore.playlist = newPlaylist;
        playerStore.currentIndex = newCurrentIndex;

        // 清空选中状态
        selectedIndices.value.clear();
        lastSelectedIndex.value = null;
    }

    draggedIndex.value = null;
    dragOverIndex.value = null;

    const count = draggedIndicesArray.length;
    ElMessage.success(count === 1 ? "已调整播放顺序" : `已移动 ${count} 首歌曲`);
};
</script>

<style scoped lang="scss">
// 遮罩层样式
.playlist-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: calc(100vh - 70px);
    background: rgba(0, 0, 0, 0.3);
    z-index: 999;
    pointer-events: auto;
}

// 自定义侧边栏
.playlist-drawer {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 70px;
    width: 380px;
    background: var(--el-bg-color);
    box-shadow: -2px 0 8px rgba(0, 0, 0, 0.15);
    z-index: 1000;
}

// 过渡动画
.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.3s;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}

.slide-enter-active,
.slide-leave-active {
    transition: transform 0.3s;
}

.slide-enter-from,
.slide-leave-to {
    transform: translateX(100%);
}

.playlist-header {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 49px;
    padding: 10px 14px;
    border-bottom: 1px solid var(--el-border-color-lighter);
    background: var(--el-bg-color);
    z-index: 1;

    .header-main {
        display: flex;
        justify-content: space-between;
        align-items: center;
        width: 100%;
    }

    .header-left {
        display: flex;
        align-items: center;
        gap: 6px;

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

        .text-btn {
            padding: 4px 10px;
            min-width: auto;
            height: 28px;
            font-size: 13px;
        }

        .icon-btn {
            padding: 4px 6px;
            min-width: auto;
            height: 28px;

            .el-icon {
                font-size: 16px;
            }
        }
    }
}

.playlist-content {
    position: absolute;
    top: 49px;
    left: 0;
    right: 0;
    bottom: 0;
    overflow: hidden;

    .empty-state {
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .playlist-items {
        height: 100%;
        overflow-y: auto;
        overflow-x: hidden;
        padding: 0;

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
            padding: 7px 14px;
            cursor: default;
            transition: background 0.2s, opacity 0.2s, transform 0.2s;
            gap: 8px;
            position: relative;
            user-select: none;
            min-height: 52px;

            &:hover {
                background: var(--el-fill-color-light);

                .item-actions {
                    opacity: 1;
                }
            }

            &.is-playing {
                background: var(--song-playing-bg);
                border-left: 3px solid var(--el-color-primary);
                padding-left: 11px;

                .song-name {
                    color: var(--song-playing-text);
                }

                .song-artist {
                    color: var(--song-playing-text-secondary);
                }

                .playing-icon {
                    color: var(--song-playing-text);
                }
            }

            &.is-selected {
                background: var(--song-selected-bg) !important;
                border-left: 3px solid var(--el-color-primary);
                padding-left: 11px;

                .song-name {
                    font-weight: 500;
                    color: var(--song-selected-text);
                }

                .song-artist {
                    color: var(--el-text-color-secondary);
                }
            }

            &.is-focused {
                background: var(--song-playing-bg);
                // 没有左边的红色竖线，只是临时高亮

                .song-name {
                    color: var(--el-text-color-primary);
                }

                .song-artist {
                    color: var(--el-text-color-secondary);
                }
            }

            // 当同时是 is-playing 和 is-selected 时，使用 selected 的样式
            &.is-playing.is-selected {
                .song-name {
                    color: var(--song-selected-text);
                }

                .song-artist {
                    color: var(--el-text-color-secondary);
                }
            }

            // 当同时是 is-playing 和 is-focused 时，使用 focused 的样式
            &.is-playing.is-focused {
                .song-name {
                    color: var(--el-text-color-primary);
                }

                .song-artist {
                    color: var(--el-text-color-secondary);
                }
            }

            &.is-dragging {
                opacity: 0.5;
                transform: scale(0.98);

                // 如果是选中项，显示更明显的拖拽效果
                &.is-selected {
                    opacity: 0.7;
                    box-shadow: 0 4px 12px rgba(64, 158, 255, 0.3);
                }
            }

            &.drag-over {
                border-top: 3px solid var(--el-color-primary);
                margin-top: -1px;

                &::before {
                    content: '';
                    position: absolute;
                    top: -4px;
                    left: 0;
                    width: 8px;
                    height: 8px;
                    background: var(--el-color-primary);
                    border-radius: 50%;
                    z-index: 10;
                }
            }

            .item-index {
                width: 26px;
                flex-shrink: 0;
                display: flex;
                align-items: center;
                justify-content: center;

                .index-number {
                    font-size: 12px;
                    color: var(--el-text-color-secondary);
                }

                .playing-icon {
                    font-size: 15px;

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
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    margin-bottom: 4px;
                    line-height: 1.4;
                }

                .song-artist {
                    font-size: 12px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    line-height: 1.3;
                }
            }

            // 默认状态的颜色（没有任何特殊状态时）
            &:not(.is-playing):not(.is-selected):not(.is-focused) {
                .song-name {
                    color: var(--el-text-color-primary);
                }

                .song-artist {
                    color: var(--el-text-color-secondary);
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
