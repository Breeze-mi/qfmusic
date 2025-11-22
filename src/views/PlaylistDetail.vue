<template>
    <div class="playlist-detail-page">
        <!-- 顶部操作栏 -->
        <div class="top-bar">
            <h2 class="page-title">{{ playlistTitle }}</h2>
            <div class="spacer"></div>
            <el-button v-if="isLocalPlaylist" :icon="FolderAdd" @click="handleImportLocal">
                导入本地音乐
            </el-button>
            <el-button v-if="songs.length > 0" type="primary" :icon="VideoPlay" @click="playAll">
                播放全部
            </el-button>
            <el-button circle :icon="Setting" @click="navigateToSettings" title="设置" />
            <el-button circle :icon="themeStore.isDark ? Sunny : Moon" @click="themeStore.toggleTheme" title="切换主题" />
        </div>

        <!-- 主内容区 -->
        <div class="playlist-content">
            <!-- 失效文件提示 -->
            <el-alert v-if="isLocalPlaylist && invalidFilesCount > 0" type="warning"
                :title="`检测到 ${invalidFilesCount} 个文件失效`" description="刷新页面后本地音乐文件可能失效，建议重新导入或使用 IndexedDB 自动恢复功能"
                show-icon :closable="false" style="margin-bottom: 16px;">
                <template #default>
                    <el-button size="small" type="warning" @click="handleCleanInvalidFiles">
                        清理失效文件
                    </el-button>
                </template>
            </el-alert>

            <div v-if="songs.length === 0" class="empty-state">
                <el-empty :description="emptyDescription">
                    <el-button v-if="isLocalPlaylist" type="primary" :icon="FolderAdd" @click="handleImportLocal">
                        导入本地音乐
                    </el-button>
                </el-empty>
            </div>
            <div v-else-if="songs.length > 0" class="songs-table">
                <div class="table-header">
                    <div class="col-index">#</div>
                    <div class="col-name">歌曲名</div>
                    <div class="col-artist">艺术家</div>
                    <div class="col-album">专辑名</div>
                    <div class="col-actions">操作</div>
                </div>
                <div class="table-body" :class="{ 'shift-selecting': isShiftPressed }">
                    <div v-for="(song, index) in songs" :key="song.id" class="table-row" :class="[
                        playerStore.currentSong?.id === song.id ? 'is-playing' : '',
                        selectedSongs.has(song.id) ? 'is-selected' : '',
                        isLocalPlaylist && !localMusicStore.isFileValid(song.id) ? 'is-invalid' : '',
                        draggedIndex === index ? 'is-dragging' : '',
                        dragOverIndex === index ? 'drag-over' : ''
                    ]" :draggable="canReorder" @click="handleSongClick(song, index, $event)"
                        @dblclick="handlePlaySong(song)" @contextmenu.prevent="handleContextMenu($event, song)"
                        @dragstart="handleDragStart(index, $event)" @dragend="handleDragEnd"
                        @dragover.prevent="handleDragOver(index, $event)" @dragleave="handleDragLeave"
                        @drop.prevent="handleDrop(index, $event)">
                        <div class="col-index">
                            <span v-if="playerStore.currentSong?.id !== song.id">{{ index + 1 }}</span>
                            <el-icon v-else class="playing-icon">
                                <VideoPlay />
                            </el-icon>
                        </div>
                        <div class="col-name">
                            <span class="song-name">
                                {{ song.name }}
                                <el-tag v-if="isLocalPlaylist && !localMusicStore.isFileValid(song.id)" type="warning"
                                    size="small" style="margin-left: 8px;">
                                    文件失效
                                </el-tag>
                            </span>
                        </div>
                        <div class="col-artist">{{ song.artists }}</div>
                        <div class="col-album">{{ song.album }}</div>
                        <div class="col-actions">
                            <el-button text :icon="VideoPlay" @click.stop="handlePlaySong(song)" title="播放"
                                :disabled="isLocalPlaylist && !localMusicStore.isFileValid(song.id)" />
                            <el-button v-if="!isBuiltinPlaylist" text :icon="Delete"
                                @click.stop="handleRemoveSong(song.id)" title="从歌单删除" />
                            <el-button v-if="isFavoritePlaylist" text :icon="Star" type="danger"
                                @click.stop="handleQuickToggleFavorite(song)" title="取消收藏" />
                            <el-button v-else-if="!isFavoritePlaylist" text :icon="Star"
                                @click.stop="handleQuickToggleFavorite(song)" title="收藏" />
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- 本地音乐导入对话框 -->
        <input ref="fileInputRef" type="file" accept="audio/*" multiple style="display: none"
            @change="handleFileChange" />

        <!-- 右键菜单 -->
        <div v-if="contextMenuVisible" class="context-menu"
            :style="{ top: contextMenuY + 'px', left: contextMenuX + 'px' }" @click="closeContextMenu">
            <!-- 单选时显示播放选项 -->
            <div v-if="selectedSongs.size <= 1" class="menu-item" @click="handlePlaySong(contextMenuSong!)">
                <el-icon>
                    <VideoPlay />
                </el-icon>
                <span>播放</span>
            </div>
            <div class="menu-item" @click="handleMenuPlayNext">
                <el-icon>
                    <DArrowRight />
                </el-icon>
                <span>下一首播放</span>
            </div>
            <div class="menu-item" @click="handleMenuAddToPlaylist">
                <el-icon>
                    <Plus />
                </el-icon>
                <span>添加到播放列表</span>
            </div>
            <div class="menu-item" @click="handleMenuToggleFavorite">
                <el-icon>
                    <Star />
                </el-icon>
                <span>{{ getMenuFavoriteText }}</span>
            </div>
            <div class="menu-divider"></div>
            <div v-if="!isBuiltinPlaylist" class="menu-item" @click="handleMenuRemoveSong">
                <el-icon>
                    <Delete />
                </el-icon>
                <span>从歌单删除</span>
            </div>
            <div v-if="isHistoryPlaylist" class="menu-item" @click="handleMenuRemoveSong">
                <el-icon>
                    <Delete />
                </el-icon>
                <span>从历史删除</span>
            </div>
            <div v-if="isLocalPlaylist" class="menu-item" @click="handleMenuRemoveSong">
                <el-icon>
                    <Delete />
                </el-icon>
                <span>删除本地音乐</span>
            </div>
            <div class="menu-divider"></div>
            <div class="menu-item submenu" @mouseenter="showPlaylistSubmenu = true"
                @mouseleave="showPlaylistSubmenu = false">
                <el-icon>
                    <FolderAdd />
                </el-icon>
                <span>添加到歌单</span>
                <el-icon class="arrow-icon">
                    <ArrowRight />
                </el-icon>
                <!-- 子菜单 -->
                <div v-if="showPlaylistSubmenu" class="submenu-content">
                    <div v-if="playlistStore.playlists.length === 0" class="submenu-item disabled">
                        暂无歌单
                    </div>
                    <template v-else>
                        <div v-for="playlist in playlistStore.playlists" :key="playlist.id" class="submenu-item"
                            @click.stop="handleMenuAddToCustomPlaylist(playlist.id)">
                            {{ playlist.name }}
                        </div>
                    </template>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import { VideoPlay, Delete, Star, FolderAdd, Setting, Sunny, Moon, Plus, DArrowRight, ArrowRight } from "@element-plus/icons-vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { usePlayerStore } from "@/stores/player";
import { usePlaylistStore } from "@/stores/playlist";
import { useLocalMusicStore } from "@/stores/localMusic";
import { useThemeStore } from "@/stores/theme";
import type { Song } from "@/api/music";

const router = useRouter();
const route = useRoute();
const playerStore = usePlayerStore();
const playlistStore = usePlaylistStore();
const localMusicStore = useLocalMusicStore();
const themeStore = useThemeStore();

const navigateToSettings = () => {
    router.push("/settings");
};

const fileInputRef = ref<HTMLInputElement>();
const playlistId = computed(() => route.params.id as string);

// 判断歌单类型
const isHistoryPlaylist = computed(() => playlistId.value === "history");
const isFavoritePlaylist = computed(() => playlistId.value === "favorite");
const isLocalPlaylist = computed(() => playlistId.value === "local");
const isBuiltinPlaylist = computed(() => isHistoryPlaylist.value || isFavoritePlaylist.value || isLocalPlaylist.value);

// 歌单标题
const playlistTitle = computed(() => {
    if (isHistoryPlaylist.value) return "试听列表";
    if (isFavoritePlaylist.value) return "我喜欢";
    if (isLocalPlaylist.value) return "本地音乐";
    const playlist = playlistStore.getPlaylist(playlistId.value);
    return playlist?.name || "歌单";
});

// 空状态描述
const emptyDescription = computed(() => {
    if (isHistoryPlaylist.value) return "还没有播放过歌曲";
    if (isFavoritePlaylist.value) return "还没有收藏歌曲";
    if (isLocalPlaylist.value) return "还没有导入本地音乐";
    return "歌单为空";
});

// 歌曲列表
const songs = computed(() => {
    if (isHistoryPlaylist.value) return playlistStore.historyList;
    if (isFavoritePlaylist.value) return playlistStore.favoriteList;
    if (isLocalPlaylist.value) return localMusicStore.localFiles;
    const playlist = playlistStore.getPlaylist(playlistId.value);
    return playlist?.songs || [];
});

// 失效文件数量
const invalidFilesCount = computed(() => {
    if (!isLocalPlaylist.value) return 0;
    return songs.value.filter(song => !localMusicStore.isFileValid(song.id)).length;
});

const playAll = () => {
    if (songs.value.length === 0) return;
    // 清空当前播放列表，添加所有歌曲
    playerStore.clearPlaylist();
    songs.value.forEach((song) => playerStore.addToPlaylist(song));
    playerStore.currentIndex = 0;
    playerStore.isPlaying = true;
    ElMessage.success("开始播放全部歌曲");
};

const handlePlaySong = (song: Song) => {
    playerStore.playSong(song);
    // 添加到试听列表
    playlistStore.addToHistory(song);
    ElMessage.success(`开始播放：${song.name}`);
};

// 快捷收藏（用于表格中的按钮）
const handleQuickToggleFavorite = (song: Song) => {
    const isFav = playlistStore.toggleFavorite(song);
    ElMessage.success(isFav ? "已添加到我喜欢" : "已取消收藏");
};

// 处理歌曲点击（支持多选）
const handleSongClick = (song: Song, index: number, event: MouseEvent) => {
    // Ctrl/Cmd + 点击：多选/取消选择
    if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        if (selectedSongs.value.has(song.id)) {
            selectedSongs.value.delete(song.id);
            if (selectedSongs.value.size === 0) {
                lastSelectedIndex.value = null;
            }
        } else {
            selectedSongs.value.add(song.id);
            lastSelectedIndex.value = index;
        }
    }
    // Shift + 点击：范围选择
    else if (event.shiftKey) {
        event.preventDefault();
        // 如果没有上次选中的索引，从当前位置开始
        if (lastSelectedIndex.value === null) {
            selectedSongs.value.clear();
            selectedSongs.value.add(song.id);
            lastSelectedIndex.value = index;
        } else {
            // 范围选择
            const start = Math.min(lastSelectedIndex.value, index);
            const end = Math.max(lastSelectedIndex.value, index);
            selectedSongs.value.clear();
            for (let i = start; i <= end; i++) {
                if (songs.value[i]) {
                    selectedSongs.value.add(songs.value[i].id);
                }
            }
        }
    }
    // 普通点击：单选或清空
    else {
        // 如果点击的是已选中的歌曲，保持选中状态
        if (selectedSongs.value.has(song.id) && selectedSongs.value.size === 1) {
            // 不做任何操作，保持选中
            return;
        }
        // 否则清空其他选中，只选中当前歌曲
        selectedSongs.value.clear();
        selectedSongs.value.add(song.id);
        lastSelectedIndex.value = index;
    }
};

// 批量删除选中的歌曲
const handleDeleteSelected = () => {
    if (selectedSongs.value.size === 0) {
        ElMessage.info("请先选择歌曲");
        return;
    }

    const selectedList = songs.value.filter(s => selectedSongs.value.has(s.id));
    ElMessageBox.confirm(`确定要删除选中的 ${selectedList.length} 首歌曲吗？`, "批量删除确认", {
        confirmButtonText: "确定",
        cancelButtonText: "取消",
        type: "warning",
    }).then(() => {
        selectedList.forEach(song => {
            if (isLocalPlaylist.value) {
                localMusicStore.removeLocalFile(song.id);
            } else if (isHistoryPlaylist.value) {
                playlistStore.removeFromHistory(song.id);
            } else if (!isBuiltinPlaylist.value) {
                playlistStore.removeSongFromPlaylist(playlistId.value, song.id);
            }
        });
        ElMessage.success(`已删除 ${selectedList.length} 首歌曲`);
        selectedSongs.value.clear();
        lastSelectedIndex.value = null;
    }).catch(() => {
        // 用户取消
    });
};

// 获取要操作的歌曲列表（单选或多选）
const getTargetSongs = () => {
    if (selectedSongs.value.size > 1) {
        return songs.value.filter(s => selectedSongs.value.has(s.id));
    }
    return contextMenuSong.value ? [contextMenuSong.value] : [];
};

// 收藏菜单文本
const getMenuFavoriteText = computed(() => {
    if (selectedSongs.value.size > 1) {
        return '收藏';
    }
    return playlistStore.isFavorite(contextMenuSong.value?.id || '') ? '取消收藏' : '收藏';
});

// 统一的菜单处理：添加到播放列表
const handleMenuAddToPlaylist = () => {
    const targetSongs = getTargetSongs();
    if (targetSongs.length === 0) return;

    targetSongs.forEach(song => playerStore.addToPlaylist(song));
    ElMessage.success(targetSongs.length > 1 ? `已添加 ${targetSongs.length} 首歌曲到播放列表` : `已添加到播放列表：${targetSongs[0].name}`);
    selectedSongs.value.clear();
    lastSelectedIndex.value = null;
    closeContextMenu();
};

// 统一的菜单处理：下一首播放
const handleMenuPlayNext = () => {
    const targetSongs = getTargetSongs();
    if (targetSongs.length === 0) return;

    const currentIndex = playerStore.currentIndex;

    // 从后往前插入，保持顺序
    [...targetSongs].reverse().forEach(song => {
        const existingIndex = playerStore.playlist.findIndex((s) => s.id === song.id);
        if (existingIndex !== -1) {
            const playlist = [...playerStore.playlist];
            const [movedSong] = playlist.splice(existingIndex, 1);
            playlist.splice(currentIndex + 1, 0, movedSong);
            playerStore.playlist = playlist;
        } else {
            playerStore.playlist.splice(currentIndex + 1, 0, song);
        }
    });

    ElMessage.success(targetSongs.length > 1 ? `已将 ${targetSongs.length} 首歌曲添加为下一首播放` : `已将《${targetSongs[0].name}》添加为下一首播放`);
    selectedSongs.value.clear();
    lastSelectedIndex.value = null;
    closeContextMenu();
};

// 统一的菜单处理：收藏/取消收藏
const handleMenuToggleFavorite = () => {
    const targetSongs = getTargetSongs();
    if (targetSongs.length === 0) return;

    if (targetSongs.length === 1) {
        const isFav = playlistStore.toggleFavorite(targetSongs[0]);
        ElMessage.success(isFav ? "已添加到我喜欢" : "已取消收藏");
    } else {
        // 批量收藏
        let addedCount = 0;
        targetSongs.forEach(song => {
            if (!playlistStore.isFavorite(song.id)) {
                playlistStore.toggleFavorite(song);
                addedCount++;
            }
        });
        ElMessage.success(`已收藏 ${addedCount} 首歌曲`);
    }

    selectedSongs.value.clear();
    lastSelectedIndex.value = null;
    closeContextMenu();
};

// 统一的菜单处理：添加到自定义歌单
const handleMenuAddToCustomPlaylist = (targetPlaylistId: string) => {
    const targetSongs = getTargetSongs();
    if (targetSongs.length === 0) return;

    let addedCount = 0;
    targetSongs.forEach(song => {
        const success = playlistStore.addSongToPlaylist(targetPlaylistId, song);
        if (success) addedCount++;
    });

    const playlist = playlistStore.getPlaylist(targetPlaylistId);
    if (addedCount > 0) {
        ElMessage.success(targetSongs.length > 1 ? `已添加 ${addedCount} 首歌曲到歌单《${playlist?.name}》` : `已添加到歌单《${playlist?.name}》`);
    } else {
        ElMessage.info("歌曲已在该歌单中");
    }

    selectedSongs.value.clear();
    lastSelectedIndex.value = null;
    closeContextMenu();
};

// 统一的菜单处理：删除歌曲
const handleMenuRemoveSong = () => {
    const targetSongs = getTargetSongs();
    if (targetSongs.length === 0) return;

    if (targetSongs.length === 1) {
        handleRemoveSong(targetSongs[0].id);
    } else {
        handleDeleteSelected();
    }
};

const handleRemoveSong = (songId: string) => {
    const song = songs.value.find(s => s.id === songId);
    if (!song) return;

    ElMessageBox.confirm(`确定要删除《${song.name}》吗？`, "删除确认", {
        confirmButtonText: "确定",
        cancelButtonText: "取消",
        type: "warning",
    }).then(() => {
        if (isLocalPlaylist.value) {
            localMusicStore.removeLocalFile(songId);
            ElMessage.success("已从本地音乐删除");
        } else if (isHistoryPlaylist.value) {
            playlistStore.removeFromHistory(songId);
            ElMessage.success("已从历史记录删除");
        } else if (!isBuiltinPlaylist.value) {
            playlistStore.removeSongFromPlaylist(playlistId.value, songId);
            ElMessage.success("已从歌单删除");
        }
        closeContextMenu();
    }).catch(() => {
        // 用户取消
    });
};

// 右键菜单状态
const contextMenuVisible = ref(false);
const contextMenuX = ref(0);
const contextMenuY = ref(0);
const contextMenuSong = ref<Song | null>(null);
const showPlaylistSubmenu = ref(false);

// 多选状态
const selectedSongs = ref<Set<string>>(new Set());
const lastSelectedIndex = ref<number | null>(null);

// Shift 键状态（用于控制文字选择）
const isShiftPressed = ref(false);

// 拖拽状态
const draggedIndex = ref<number | null>(null);
const dragOverIndex = ref<number | null>(null);

// 是否支持排序（只有自定义歌单和我喜欢支持）
const canReorder = computed(() => !isHistoryPlaylist.value && !isLocalPlaylist.value);

// 处理鼠标按下（右键划词开始）
// 显示右键菜单
const handleContextMenu = (event: MouseEvent, song: Song) => {
    event.preventDefault();

    // 如果右键点击的歌曲不在选中列表中，清空选中状态
    if (!selectedSongs.value.has(song.id)) {
        selectedSongs.value.clear();
        lastSelectedIndex.value = null;
    }

    contextMenuSong.value = song;
    contextMenuX.value = event.clientX;
    contextMenuY.value = event.clientY;
    contextMenuVisible.value = true;
};

// 关闭右键菜单
const closeContextMenu = () => {
    contextMenuVisible.value = false;
    contextMenuSong.value = null;
    showPlaylistSubmenu.value = false;
};

// 点击其他地方关闭右键菜单
const handleClickOutside = () => {
    if (contextMenuVisible.value) {
        closeContextMenu();
    }
};

const handleImportLocal = () => {
    fileInputRef.value?.click();
};

const handleFileChange = async (event: Event) => {
    const target = event.target as HTMLInputElement;
    const files = target.files;
    if (!files || files.length === 0) return;

    ElMessage.info(`正在导入 ${files.length} 个文件...`);

    try {
        const results = await localMusicStore.addLocalFiles(files);
        ElMessage.success(`成功导入 ${results.length} 首歌曲`);
    } catch (error) {
        console.error("导入失败:", error);
        ElMessage.error("导入失败，请重试");
    }

    // 清空文件输入
    if (target) {
        target.value = "";
    }
};

// 清理失效文件
const handleCleanInvalidFiles = async () => {
    try {
        await ElMessageBox.confirm(
            `确定要清理 ${invalidFilesCount.value} 个失效文件吗？此操作不可恢复。`,
            "清理失效文件",
            {
                confirmButtonText: "确定",
                cancelButtonText: "取消",
                type: "warning",
            }
        );

        const invalidFiles = songs.value.filter(song => !localMusicStore.isFileValid(song.id));
        for (const file of invalidFiles) {
            await localMusicStore.removeLocalFile(file.id);
        }

        ElMessage.success(`已清理 ${invalidFiles.length} 个失效文件`);
    } catch {
        // 用户取消
    }
};

// 拖拽开始
const handleDragStart = (index: number, event: DragEvent) => {
    if (!canReorder.value) return;
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
const handleDragOver = (index: number, _event: DragEvent) => {
    if (!canReorder.value) return;
    if (draggedIndex.value === null || draggedIndex.value === index) return;
    dragOverIndex.value = index;
};

// 拖拽离开
const handleDragLeave = () => {
    dragOverIndex.value = null;
};

// 放置
const handleDrop = (targetIndex: number, _event: DragEvent) => {
    if (!canReorder.value || draggedIndex.value === null) {
        dragOverIndex.value = null;
        return;
    }

    const fromIndex = draggedIndex.value;
    if (fromIndex === targetIndex) {
        draggedIndex.value = null;
        dragOverIndex.value = null;
        return;
    }

    // 计算实际插入位置
    let actualTargetIndex = targetIndex;
    if (fromIndex < targetIndex) {
        actualTargetIndex = targetIndex - 1;
    }

    // 执行排序
    if (isFavoritePlaylist.value) {
        playlistStore.reorderFavoriteSongs(fromIndex, actualTargetIndex);
    } else if (!isBuiltinPlaylist.value) {
        playlistStore.reorderSongsInPlaylist(playlistId.value, fromIndex, actualTargetIndex);
    }

    draggedIndex.value = null;
    dragOverIndex.value = null;
    ElMessage.success("已调整歌曲顺序");
};

// 监听 Shift 键状态
const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Shift') {
        isShiftPressed.value = true;
    }
};

const handleKeyUp = (event: KeyboardEvent) => {
    if (event.key === 'Shift') {
        isShiftPressed.value = false;
    }
};

onMounted(() => {
    // 检查歌单是否存在
    if (!isBuiltinPlaylist.value) {
        const playlist = playlistStore.getPlaylist(playlistId.value);
        if (!playlist) {
            ElMessage.error("歌单不存在");
            router.push("/");
        }
    }
    document.addEventListener("click", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);
});

onUnmounted(() => {
    document.removeEventListener("click", handleClickOutside);
    document.removeEventListener("keydown", handleKeyDown);
    document.removeEventListener("keyup", handleKeyUp);
});
</script>

<style scoped lang="scss">
.playlist-detail-page {
    height: 100vh;
    display: flex;
    flex-direction: column;
    background: var(--el-bg-color);

    .top-bar {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 20px 24px;
        height: 79px;
        background: var(--el-bg-color);
        border-bottom: 1px solid var(--el-border-color);
        flex-shrink: 0;

        .page-title {
            font-size: 22px;
            font-weight: 600;
            color: var(--el-text-color-primary);
            margin: 0;
        }

        .spacer {
            flex: 1;
        }

        // 统一设置和主题切换按钮大小
        :deep(.el-button.is-circle) {
            width: 40px;
            height: 40px;
            font-size: 22px;
        }

        .selected-count {
            font-size: 13px;
            color: var(--el-color-primary);
            font-weight: 500;
        }
    }

    .playlist-content {
        flex: 1;
        overflow-y: auto;
        padding: 24px;
        padding-bottom: 90px;

        .empty-state {
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .songs-table {
            .table-header {
                display: flex;
                align-items: center;
                padding: 12px 16px;
                background: var(--el-fill-color-light);
                font-size: var(--custom-font-size-md);
                font-weight: 600;
                color: var(--el-text-color-secondary);
                border-radius: 4px;
                margin-bottom: 8px;

                .col-index {
                    width: 50px;
                    flex-shrink: 0;
                    text-align: center;
                }

                .col-name {
                    flex: 1;
                    min-width: 100px;
                    text-align: left;
                }

                .col-artist {
                    width: 280px;
                    flex-shrink: 1;
                    text-align: left;
                }

                .col-album {
                    width: 200px;
                    flex-shrink: 1;
                    text-align: left;
                }

                .col-actions {
                    width: 190px;
                    flex-shrink: 1;
                    text-align: center;
                }
            }

            .table-body {

                /* 当按住 Shift 键时禁止文字选择 */
                &.shift-selecting {
                    .table-row {
                        user-select: none;
                    }
                }

                .table-row {
                    display: flex;
                    align-items: center;
                    padding: 8px 16px;
                    cursor: pointer;
                    transition: all 0.2s;
                    border-radius: 4px;
                    user-select: text;
                    /* 允许文字选择 */
                    position: relative;
                    flex-wrap: nowrap;

                    &:hover {
                        background: var(--el-fill-color-light);

                        .col-actions {
                            opacity: 1;
                        }
                    }

                    &.is-dragging {
                        opacity: 0.5;
                        transform: scale(0.98);
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

                    &.is-playing {
                        background: var(--song-playing-bg);
                        border-left: 3px solid var(--el-color-primary);
                        padding-left: 13px;

                        .col-name .song-name {
                            color: var(--song-playing-text);
                        }

                        .col-artist,
                        .col-album {
                            color: var(--song-playing-text-secondary);
                        }

                        .col-index {
                            .playing-icon {
                                color: var(--song-playing-text);
                            }
                        }
                    }

                    &.is-selected {
                        background: var(--song-selected-bg) !important;

                        .col-name .song-name {
                            font-weight: 500;
                            color: var(--song-selected-text);
                        }

                        .col-artist,
                        .col-album {
                            color: var(--song-selected-text);
                            opacity: 0.85;
                        }

                        .col-index {
                            color: var(--song-selected-text);
                            opacity: 0.7;
                        }
                    }

                    &.is-invalid {
                        opacity: 0.5;

                        .col-name .song-name {
                            color: var(--el-text-color-secondary);
                            text-decoration: line-through;
                        }
                    }

                    .col-index {
                        width: 50px;
                        flex-shrink: 0;
                        text-align: center;
                        font-size: var(--custom-font-size-base);
                        color: var(--el-text-color-secondary);

                        .playing-icon {
                            color: var(--el-color-primary);
                            font-size: var(--custom-font-size-lg);
                        }
                    }

                    .col-name {
                        flex: 1;
                        min-width: 100px;
                        overflow: hidden;
                        display: flex;
                        align-items: center;

                        .song-name {
                            font-size: var(--custom-font-size-base);
                            font-weight: 500;
                            color: var(--el-text-color-primary);
                            overflow: hidden;
                            text-overflow: ellipsis;
                            white-space: nowrap;
                        }
                    }

                    .col-artist {
                        width: 280px;
                        flex-shrink: 1;
                        font-size: var(--custom-font-size-md);
                        color: var(--el-text-color-secondary);
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                        text-align: left;
                    }

                    .col-album {
                        width: 200px;
                        flex-shrink: 1;
                        font-size: var(--custom-font-size-md);
                        color: var(--el-text-color-secondary);
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                        text-align: left;
                    }

                    .col-actions {
                        width: 190px;
                        flex-shrink: 1;
                        display: flex;
                        justify-content: center;
                        gap: 4px;
                        opacity: 0;
                        transition: opacity 0.2s;
                    }
                }
            }
        }
    }
}

/* 右键菜单样式 */
.context-menu {
    position: fixed;
    background: var(--el-bg-color-overlay);
    border: 1px solid var(--el-border-color);
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    padding: 4px 0;
    min-width: 160px;
    z-index: 9999;

    .menu-divider {
        height: 1px;
        background: var(--el-border-color-light);
        margin: 4px 0;
    }

    .menu-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 16px;
        cursor: pointer;
        transition: background 0.2s, color 0.2s;
        font-size: var(--custom-font-size-md);
        color: var(--el-text-color-primary);
        position: relative;

        .el-icon {
            font-size: var(--custom-font-size-lg);
            color: var(--el-text-color-regular);
            transition: color 0.2s;
        }

        .arrow-icon {
            margin-left: auto;
            font-size: var(--custom-font-size-base);
        }

        &:hover {
            background: var(--el-fill-color-light);

            .el-icon {
                color: var(--el-color-primary);
            }
        }

        &.submenu {
            position: relative;

            .submenu-content {
                position: absolute;
                left: 100%;
                top: 0;
                background: var(--el-bg-color-overlay);
                border: 1px solid var(--el-border-color);
                border-radius: 6px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                padding: 4px 0;
                min-width: 140px;
                max-height: 300px;
                overflow-y: auto;
                z-index: 10000;

                &::-webkit-scrollbar {
                    width: 6px;
                }

                &::-webkit-scrollbar-thumb {
                    background: var(--el-border-color);
                    border-radius: 3px;
                }

                .submenu-item {
                    padding: 10px 16px;
                    font-size: var(--custom-font-size-md);
                    color: var(--el-text-color-primary);
                    cursor: pointer;
                    transition: background 0.2s;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;

                    &:hover {
                        background: var(--el-fill-color-light);
                    }

                    &.disabled {
                        color: var(--el-text-color-secondary);
                        cursor: not-allowed;
                    }
                }
            }
        }
    }
}
</style>
