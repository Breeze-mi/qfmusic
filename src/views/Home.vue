<template>
    <div class="home-page">
        <!-- 顶部搜索栏 -->
        <div class="top-bar">
            <SearchBar />
            <div class="top-actions">
                <el-button circle :icon="Setting" @click="navigateToSettings" title="设置" />
                <el-button circle :icon="themeStore.isDark ? Sunny : Moon" @click="themeStore.toggleTheme"
                    title="切换主题" />
            </div>
        </div>

        <!-- 主内容区 -->
        <div class="main-content">
            <!-- 搜索结果列表 -->
            <div v-if="searchStore.showResults" class="search-results-container">
                <div class="results-header">
                    <h2>搜索结果</h2>
                    <span class="results-count">共 {{ searchStore.total }} 首歌曲</span>
                </div>
                <!-- 无结果提示 -->
                <div v-if="searchStore.total === 0" class="no-results">
                    <el-empty description="未找到相关歌曲">
                        <template #image>
                            <div class="empty-icon">🔍</div>
                        </template>
                        <template #description>
                            <p>未找到相关歌曲</p>
                            <p class="empty-tip">请尝试其他关键词或检查输入是否正确</p>
                        </template>
                    </el-empty>
                </div>

                <div v-else class="results-wrapper">
                    <div class="results-table">
                        <div class="table-header">
                            <div class="col-index">#</div>
                            <div class="col-name">歌曲名</div>
                            <div class="col-artist">艺术家</div>
                            <div class="col-album">专辑名</div>
                            <div class="col-actions">操作</div>
                        </div>
                        <div class="table-body" ref="tableBodyRef" :class="{ 'shift-selecting': isShiftPressed }">
                            <div v-for="(song, index) in searchStore.searchResults" :key="song.id" class="table-row"
                                @click="handleSongClick(song, index, $event)" @dblclick="handlePlaySong(song)"
                                @contextmenu.prevent="handleContextMenu($event, song)" :class="{
                                    'is-playing': playerStore.currentSong?.id === song.id,
                                    'is-selected': selectedSongs.has(song.id)
                                }">
                                <div class="col-index">
                                    <span v-if="playerStore.currentSong?.id !== song.id">
                                        {{ (searchStore.currentPage - 1) * searchStore.pageSize + index + 1 }}
                                    </span>
                                    <el-icon v-else class="playing-icon">
                                        <VideoPlay />
                                    </el-icon>
                                </div>
                                <div class="col-name">
                                    <span class="song-name">{{ song.name }}</span>
                                </div>
                                <div class="col-artist">{{ song.artists }}</div>
                                <div class="col-album">{{ song.album }}</div>
                                <div class="col-actions">
                                    <el-button text :icon="VideoPlay" @click.stop="handlePlaySong(song)" title="播放" />
                                    <el-button text :icon="Plus" @click.stop="handleAddToPlaylist(song)"
                                        title="添加到播放列表" />
                                    <el-button text :icon="Download" title="下载" />
                                </div>
                            </div>

                            <!-- 分页组件 - 作为列表的一部分，随滚动自然出现 -->
                            <div v-if="searchStore.totalPages > 1" class="pagination-in-list">
                                <el-pagination v-model:current-page="searchStore.currentPage"
                                    :page-size="searchStore.pageSize" :total="searchStore.total"
                                    layout="prev, pager, next" :hide-on-single-page="false"
                                    @current-change="handlePageChange" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 默认显示：当前播放或空状态 -->
            <div v-else-if="!playerStore.currentSong" class="empty-state">
                <el-empty description="搜索并播放你喜欢的音乐" :image-size="200">
                    <template #image>
                        <div class="empty-icon">🎵</div>
                    </template>
                </el-empty>
            </div>

            <div v-else class="playing-info">
                <div class="current-playing">
                    <img v-if="playerStore.currentSong.picUrl" :src="playerStore.currentSong.picUrl"
                        :alt="playerStore.currentSong.name" class="large-cover"
                        :class="{ rotating: playerStore.isPlaying }" loading="lazy" @error="handleCoverError" />
                    <div v-else class="large-cover-placeholder" :class="{ rotating: playerStore.isPlaying }">
                        🎵
                    </div>
                    <h2>{{ playerStore.currentSong.name }}</h2>
                    <p>{{ playerStore.currentSong.artists }}</p>
                </div>
            </div>
        </div>

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
import { onMounted, ref, onUnmounted, computed, watch } from "vue";
import { useRouter } from "vue-router";
import { VideoPlay, Plus, Download, DArrowRight, Star, Setting, Sunny, Moon, FolderAdd, ArrowRight } from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";
import SearchBar from "@/components/SearchBar.vue";
import { usePlayerStore } from "@/stores/player";
import { useThemeStore } from "@/stores/theme";
import { useSearchStore } from "@/stores/search";
import { usePlaylistStore } from "@/stores/playlist";
import type { Song } from "@/api/music";

const router = useRouter();
const playerStore = usePlayerStore();
const themeStore = useThemeStore();
const searchStore = useSearchStore();
const playlistStore = usePlaylistStore();

const navigateToSettings = () => {
    router.push("/settings");
};

// 分页控制
const tableBodyRef = ref<HTMLElement>();

const handlePageChange = (page: number) => {
    searchStore.setCurrentPage(page);
    // 清空选中状态
    selectedSongs.value.clear();
    lastSelectedIndex.value = null;
    // 滚动到顶部
    if (tableBodyRef.value) {
        tableBodyRef.value.scrollTop = 0;
    }
};

const handlePlaySong = (song: Song) => {
    playerStore.playSong(song);
    playlistStore.addToHistory(song);
    ElMessage.success(`开始播放：${song.name}`);
};

const handleAddToPlaylist = (song: Song) => {
    const added = playerStore.addToPlaylist(song);
    if (added) {
        ElMessage.success(`已添加到播放列表：${song.name}`);
    } else {
        ElMessage.info(`歌曲已在播放列表中：${song.name}`);
    }
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
                if (searchStore.searchResults[i]) {
                    selectedSongs.value.add(searchStore.searchResults[i].id);
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

// 获取要操作的歌曲列表（单选或多选）
const getTargetSongs = () => {
    if (selectedSongs.value.size > 1) {
        return searchStore.searchResults.filter(s => selectedSongs.value.has(s.id));
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
    const songs = getTargetSongs();
    if (songs.length === 0) return;

    songs.forEach(song => playerStore.addToPlaylist(song));
    ElMessage.success(songs.length > 1 ? `已添加 ${songs.length} 首歌曲到播放列表` : `已添加到播放列表：${songs[0].name}`);
    selectedSongs.value.clear();
    lastSelectedIndex.value = null;
    closeContextMenu();
};

// 统一的菜单处理：下一首播放
const handleMenuPlayNext = () => {
    const songs = getTargetSongs();
    if (songs.length === 0) return;

    const currentIndex = playerStore.currentIndex;

    // 从后往前插入，保持顺序
    [...songs].reverse().forEach(song => {
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

    ElMessage.success(songs.length > 1 ? `已将 ${songs.length} 首歌曲添加为下一首播放` : `已将《${songs[0].name}》添加为下一首播放`);
    selectedSongs.value.clear();
    lastSelectedIndex.value = null;
    closeContextMenu();
};

// 统一的菜单处理：收藏/取消收藏
const handleMenuToggleFavorite = () => {
    const songs = getTargetSongs();
    if (songs.length === 0) return;

    if (songs.length === 1) {
        const isFav = playlistStore.toggleFavorite(songs[0]);
        ElMessage.success(isFav ? "已添加到我喜欢" : "已取消收藏");
    } else {
        // 批量收藏
        let addedCount = 0;
        songs.forEach(song => {
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
const handleMenuAddToCustomPlaylist = (playlistId: string) => {
    const songs = getTargetSongs();
    if (songs.length === 0) return;

    let addedCount = 0;
    songs.forEach(song => {
        const success = playlistStore.addSongToPlaylist(playlistId, song);
        if (success) addedCount++;
    });

    const playlist = playlistStore.getPlaylist(playlistId);
    if (addedCount > 0) {
        ElMessage.success(songs.length > 1 ? `已添加 ${addedCount} 首歌曲到歌单《${playlist?.name}》` : `已添加到歌单《${playlist?.name}》`);
    } else {
        ElMessage.info("歌曲已在该歌单中");
    }

    selectedSongs.value.clear();
    lastSelectedIndex.value = null;
    closeContextMenu();
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

// Shift 键状态
const isShiftPressed = ref(false);

// 显示右键菜单
const handleContextMenu = (event: MouseEvent, song: Song) => {
    event.preventDefault();

    // 检查是否有选中的文字
    const selection = window.getSelection();
    const selectedText = selection?.toString().trim();

    // 如果有选中的文字，静默复制到剪贴板
    if (selectedText) {
        navigator.clipboard.writeText(selectedText).catch(() => {
            // 静默失败，不显示任何提示
        });
        return;
    }

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
};

// 点击其他地方关闭右键菜单
const handleClickOutside = () => {
    if (contextMenuVisible.value) {
        closeContextMenu();
    }
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

// 处理封面图片加载错误
const handleCoverError = (e: Event) => {
    const target = e.target as HTMLImageElement;
    // 隐藏损坏的图片，让占位符显示
    target.style.display = 'none';
    // 清空picUrl，触发占位符显示
    if (playerStore.currentSong) {
        playerStore.currentSong.picUrl = '';
    }
};

onMounted(() => {
    themeStore.initTheme();
    document.addEventListener("click", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);
});

onUnmounted(() => {
    document.removeEventListener("click", handleClickOutside);
    document.removeEventListener("keydown", handleKeyDown);
    document.removeEventListener("keyup", handleKeyUp);
});

// 监听搜索结果变化，滚动到顶部
watch(() => searchStore.searchResults, () => {
    if (tableBodyRef.value) {
        tableBodyRef.value.scrollTop = 0;
    }
});

</script>

<style scoped lang="scss">
.home-page {
    height: 100vh;
    display: flex;
    flex-direction: column;
    background: var(--el-bg-color);
    transition: background 0.3s;

    .top-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 24px;
        height: 79px;
        background: var(--el-bg-color);
        border-bottom: 1px solid var(--el-border-color-light);
        flex-shrink: 0;
        gap: 20px;
        transition: background 0.3s, border-color 0.3s;

        .top-actions {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-shrink: 0;

            // 加大设置和主题切换按钮
            :deep(.el-button.is-circle) {
                width: 40px;
                height: 40px;
                font-size: 22px;
            }
        }
    }

    .main-content {
        flex: 1;
        overflow-y: auto;
        padding: 0 0 70px 0;
        background: var(--el-bg-color);
        transition: background 0.3s;

        .search-results-container {
            padding: 24px;
            height: 100%;
            display: flex;
            flex-direction: column;
            background: var(--el-bg-color);

            .results-header {
                display: flex;
                align-items: center;
                gap: 16px;
                margin-bottom: 16px;
                flex-shrink: 0;

                h2 {
                    margin: 0;
                    font-size: 18px;
                    font-weight: 600;
                    color: var(--el-text-color-primary);
                }

                .results-count {
                    font-size: 13px;
                    color: var(--el-text-color-secondary);
                }


            }

            .results-wrapper {
                flex: 1;
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }

            .results-table {
                flex: 1;
                display: flex;
                flex-direction: column;
                overflow: hidden;
                position: relative;

                .table-header {
                    display: flex;
                    align-items: center;
                    padding: 10px 0;
                    background: var(--el-bg-color);
                    font-size: var(--custom-font-size-base);
                    font-weight: 600;
                    color: var(--el-text-color-secondary);
                    position: sticky;
                    top: 0;
                    z-index: 10;
                    border-bottom: 1px solid var(--el-border-color-light);
                    min-width: 0;
                    transition: background 0.3s, border-color 0.3s;

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
                        flex-shrink: 0;
                        text-align: left;
                    }

                    .col-album {
                        width: 210px;
                        flex-shrink: 0;
                        text-align: left;
                    }

                    .col-actions {
                        width: 190px;
                        flex-shrink: 0;
                        text-align: center;
                    }
                }

                .table-body {
                    flex: 1;
                    overflow-y: auto;
                    overflow-x: hidden;

                    /* 当按住 Shift 键时禁止文字选择 */
                    &.shift-selecting {
                        .table-row {
                            user-select: none;
                        }
                    }

                    .table-row {
                        display: flex;
                        align-items: center;
                        padding: 12px 0;
                        cursor: pointer;
                        transition: all 0.2s;
                        border-bottom: 1px solid var(--el-border-color-lighter);
                        user-select: text;
                        /* 允许文字选择 */
                        min-width: 0;
                        flex-wrap: nowrap;

                        &:hover {
                            background: var(--el-fill-color-light);

                            .col-actions {
                                opacity: 1;
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

                        .col-name {
                            flex: 1;
                            min-width: 100px;
                            display: flex;
                            align-items: center;

                            .song-name {
                                font-size: var(--custom-font-size-base);
                                font-weight: 400;
                                color: var(--el-text-color-primary);
                                overflow: hidden;
                                text-overflow: ellipsis;
                                white-space: nowrap;
                            }
                        }

                        .col-artist {
                            width: 280px;
                            flex-shrink: 0;
                            font-size: var(--custom-font-size-md);
                            color: var(--el-text-color-regular);
                            overflow: hidden;
                            text-overflow: ellipsis;
                            white-space: nowrap;
                            text-align: left;
                        }

                        .col-album {
                            width: 200px;
                            flex-shrink: 0;
                            font-size: var(--custom-font-size-md);
                            color: var(--el-text-color-regular);
                            overflow: hidden;
                            text-overflow: ellipsis;
                            white-space: nowrap;
                            text-align: left;
                        }

                        .col-actions {
                            width: 190px;
                            flex-shrink: 0;
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

        .pagination-in-list {
            padding: 30px 0 20px 0;
            display: flex;
            justify-content: center;
            align-items: center;
            background: var(--el-bg-color);

            :deep(.el-pagination) {

                .btn-prev,
                .btn-next,
                .el-pager li {
                    background: transparent;
                    min-width: 32px;
                    height: 32px;
                    line-height: 32px;
                    border-radius: 4px;

                    &:hover {
                        background: var(--el-fill-color-light);
                    }
                }

                .el-pager li.is-active {
                    background: var(--el-color-primary);
                    color: #fff;

                    &:hover {
                        background: var(--el-color-primary);
                    }
                }
            }
        }

        .no-results {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 40px 24px;

            .empty-icon {
                font-size: 80px;
            }

            .empty-tip {
                margin-top: 8px;
                font-size: 13px;
                color: var(--el-text-color-placeholder);
            }
        }

        .empty-state {
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 40px 24px 90px;
            background: var(--el-bg-color);

            .empty-icon {
                font-size: 120px;
            }
        }

        .playing-info {
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 40px 24px 90px;
            background: var(--el-bg-color);

            .current-playing {
                text-align: center;

                .large-cover,
                .large-cover-placeholder {
                    width: 280px;
                    height: 280px;
                    border-radius: 8px;
                    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
                    margin-bottom: 24px;

                    &.rotating {
                        animation: rotate 20s linear infinite;
                    }
                }

                .large-cover {
                    object-fit: cover;
                }

                .large-cover-placeholder {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 120px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: rgba(255, 255, 255, 0.9);
                }

                h2 {
                    font-size: 24px;
                    font-weight: 600;
                    color: var(--el-text-color-primary);
                    margin: 0 0 12px 0;
                }

                p {
                    font-size: 16px;
                    color: var(--el-text-color-regular);
                    margin: 0;
                }
            }
        }
    }
}

@keyframes rotate {
    from {
        transform: rotate(0deg);
    }

    to {
        transform: rotate(360deg);
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
        user-select: none;

        .el-icon {
            font-size: var(--custom-font-size-lg);
            color: var(--el-text-color-regular);
            transition: color 0.2s;
            flex-shrink: 0;
        }

        span {
            flex: 1;
            transition: color 0.2s;
        }

        .arrow-icon {
            margin-left: auto;
            font-size: var(--custom-font-size-base);
        }

        &:hover {
            background: var(--el-fill-color-light);
            color: var(--el-color-primary);

            .el-icon {
                color: var(--el-color-primary);
            }

            span {
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

                .submenu-item {
                    padding: 10px 16px;
                    font-size: var(--custom-font-size-md);
                    color: var(--el-text-color-primary);
                    cursor: pointer;
                    transition: background 0.2s;

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
