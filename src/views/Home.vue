<template>
    <div class="home-page">
        <!-- 顶部栏 -->
        <div class="top-bar">
            <div class="logo">
                <h1>🎵 音乐播放器</h1>
            </div>
            <SearchBar />
            <div class="actions">
                <el-button circle :icon="Setting" @click="goToSettings" title="设置" />
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
                    <span class="results-count">
                        共 {{ searchStore.total }} 首歌曲
                        <span v-if="searchStore.totalPages > 1" class="page-info">

                        </span>
                    </span>
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
                        <div class="table-body">
                            <div v-for="(song, index) in searchStore.searchResults" :key="song.id" class="table-row"
                                @dblclick="handlePlaySong(song)" @contextmenu.prevent="handleContextMenu($event, song)"
                                :class="{ 'is-playing': playerStore.currentSong?.id === song.id }">
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
                        </div>
                    </div>

                    <!-- 分页组件 -->
                    <div v-if="searchStore.totalPages > 1" class="pagination">
                        <el-pagination v-model:current-page="searchStore.currentPage" :page-size="searchStore.pageSize"
                            :total="searchStore.total" layout="prev, pager, next" :hide-on-single-page="false"
                            @current-change="handlePageChange" />
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
                    <img :src="playerStore.currentSong.picUrl" :alt="playerStore.currentSong.name" class="large-cover"
                        :class="{ rotating: playerStore.isPlaying }" loading="lazy" />
                    <h2>{{ playerStore.currentSong.name }}</h2>
                    <p>{{ playerStore.currentSong.artists }}</p>
                </div>
            </div>
        </div>

        <!-- 右键菜单 -->
        <div v-if="contextMenuVisible" class="context-menu"
            :style="{ top: contextMenuY + 'px', left: contextMenuX + 'px' }" @click="closeContextMenu">
            <div class="menu-item" @click="handlePlaySong(contextMenuSong!)">
                <el-icon>
                    <VideoPlay />
                </el-icon>
                <span>播放</span>
            </div>
            <div class="menu-item" @click="handlePlayNext(contextMenuSong!)">
                <el-icon>
                    <DArrowRight />
                </el-icon>
                <span>下一首播放</span>
            </div>
            <div class="menu-item" @click="handleAddToPlaylist(contextMenuSong!)">
                <el-icon>
                    <Plus />
                </el-icon>
                <span>添加到播放列表</span>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { onMounted, ref, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { Sunny, Moon, VideoPlay, Plus, Download, Setting, DArrowRight } from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";
import SearchBar from "@/components/SearchBar.vue";
import { usePlayerStore } from "@/stores/player";
import { useThemeStore } from "@/stores/theme";
import { useSearchStore } from "@/stores/search";
import type { Song } from "@/api/music";

const router = useRouter();
const playerStore = usePlayerStore();
const themeStore = useThemeStore();
const searchStore = useSearchStore();

// // 后端状态，不在首页显示
// const backendStatus = computed(() => {
//     const isOnline = getAPIHealthStatus();
//     const failures = getConsecutiveFailures();

//     let message = "";
//     if (isOnline) {
//         message = "服务器连接成功";
//     } else if (failures >= 3) {
//         message = "接口连接失败，请检查后重新搜索";
//     } else {
//         message = "服务器连接失败";
//     }

//     return {
//         isOnline,
//         message
//     };
// });

const goToSettings = () => {
    router.push("/settings");
};

const handlePageChange = (page: number) => {
    searchStore.setCurrentPage(page);
    // 滚动到顶部
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

const handlePlaySong = (song: Song) => {
    playerStore.playSong(song);
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

// 右键菜单状态
const contextMenuVisible = ref(false);
const contextMenuX = ref(0);
const contextMenuY = ref(0);
const contextMenuSong = ref<Song | null>(null);

// 显示右键菜单
const handleContextMenu = (event: MouseEvent, song: Song) => {
    event.preventDefault();
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

// 下一首播放
const handlePlayNext = (song: Song) => {
    const currentIndex = playerStore.currentIndex;
    const existingIndex = playerStore.playlist.findIndex((s) => s.id === song.id);

    if (existingIndex !== -1) {
        // 如果歌曲已在播放列表中，移动到下一首位置
        const playlist = [...playerStore.playlist];
        const [movedSong] = playlist.splice(existingIndex, 1);
        playlist.splice(currentIndex + 1, 0, movedSong);
        playerStore.playlist = playlist;
        ElMessage.success(`已将《${song.name}》移至下一首播放`);
    } else {
        // 如果歌曲不在播放列表中，添加到下一首位置
        playerStore.playlist.splice(currentIndex + 1, 0, song);
        ElMessage.success(`已将《${song.name}》添加为下一首播放`);
    }
    closeContextMenu();
};

// 点击其他地方关闭右键菜单
const handleClickOutside = () => {
    if (contextMenuVisible.value) {
        closeContextMenu();
    }
};

onMounted(() => {
    themeStore.initTheme();
    document.addEventListener("click", handleClickOutside);
});

onUnmounted(() => {
    document.removeEventListener("click", handleClickOutside);
});

</script>

<style scoped lang="scss">
.home-page {
    height: 100vh;
    display: flex;
    flex-direction: column;
    background: var(--el-bg-color);

    .top-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 24px;
        background: var(--el-bg-color);
        border-bottom: 1px solid var(--el-border-color);
        gap: 20px;

        .logo {
            h1 {
                margin: 0;
                font-size: 20px;
                color: var(--el-color-primary);
                white-space: nowrap;
            }
        }

        .actions {
            display: flex;
            align-items: center;
            gap: 12px;
        }
    }

    .main-content {
        flex: 1;
        overflow-y: auto;
        padding: 0 0 70px 0;

        .search-results-container {
            padding: 24px;
            height: calc(100vh - 70px - 60px);
            display: flex;
            flex-direction: column;

            .results-header {
                display: flex;
                align-items: center;
                gap: 16px;
                margin-bottom: 16px;
                padding-bottom: 12px;
                border-bottom: 1px solid var(--el-border-color);
                flex-shrink: 0;

                h2 {
                    margin: 0;
                    font-size: 20px;
                    font-weight: 600;
                    color: var(--el-text-color-primary);
                }

                .results-count {
                    font-size: 14px;
                    color: var(--el-text-color-secondary);

                    .page-info {
                        margin-left: 8px;
                        color: var(--el-color-primary);
                    }
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
                border-radius: 4px;
                position: relative;

                .table-header {
                    display: flex;
                    align-items: center;
                    padding: 12px 16px;
                    background: var(--el-fill-color-light);
                    font-size: 13px;
                    font-weight: 600;
                    color: var(--el-text-color-secondary);
                    position: sticky;
                    top: 0;
                    z-index: 10;
                    border-radius: 4px 4px 0 0;

                    .col-index {
                        width: 50px;
                        flex-shrink: 0;
                        text-align: center;
                    }

                    .col-name {
                        flex: 1;
                        min-width: 200px;
                    }

                    .col-artist {
                        width: 194px;
                        flex-shrink: 0;
                    }

                    .col-album {
                        width: 200px;
                        flex-shrink: 0;
                    }

                    .col-actions {
                        width: 140px;
                        flex-shrink: 0;
                        text-align: center;
                    }
                }

                .table-body {
                    flex: 1;
                    overflow-y: auto;

                    .table-row {
                        display: flex;
                        align-items: center;
                        padding: 8px 16px;
                        cursor: pointer;
                        transition: all 0.2s;
                        border-radius: 4px;

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
                            font-size: 14px;
                            color: var(--el-text-color-secondary);

                            .playing-icon {
                                color: var(--el-color-primary);
                                font-size: 16px;
                            }
                        }

                        &.is-playing {
                            background: var(--el-color-primary-light-9);

                            .col-name .song-name {
                                color: var(--el-color-primary);
                            }
                        }

                        .col-name {
                            flex: 1;
                            min-width: 200px;
                            display: flex;
                            align-items: center;

                            .song-name {
                                font-size: 14px;
                                font-weight: 500;
                                color: var(--el-text-color-primary);
                                overflow: hidden;
                                text-overflow: ellipsis;
                                white-space: nowrap;
                            }
                        }

                        .col-artist {
                            width: 180px;
                            flex-shrink: 0;
                            font-size: 13px;
                            color: var(--el-text-color-secondary);
                            overflow: hidden;
                            text-overflow: ellipsis;
                            white-space: nowrap;
                        }

                        .col-album {
                            width: 200px;
                            flex-shrink: 0;
                            font-size: 13px;
                            color: var(--el-text-color-secondary);
                            overflow: hidden;
                            text-overflow: ellipsis;
                            white-space: nowrap;
                        }

                        .col-actions {
                            width: 140px;
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

        .pagination {
            padding: 20px 0;
            display: flex;
            justify-content: center;
            align-items: center;
            flex-shrink: 0;

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

            .current-playing {
                text-align: center;

                .large-cover {
                    width: 300px;
                    height: 300px;
                    border-radius: 50%;
                    object-fit: cover;
                    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
                    margin-bottom: 24px;

                    &.rotating {
                        animation: rotate 20s linear infinite;
                    }
                }

                h2 {
                    font-size: 28px;
                    font-weight: 600;
                    color: var(--el-text-color-primary);
                    margin: 0 0 12px 0;
                }

                p {
                    font-size: 18px;
                    color: var(--el-text-color-secondary);
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

@keyframes pulse-online {

    0%,
    100% {
        opacity: 1;
        box-shadow: 0 0 0 0 rgba(103, 194, 58, 0.7);
    }

    50% {
        opacity: 0.8;
        box-shadow: 0 0 0 4px rgba(103, 194, 58, 0);
    }
}

@keyframes pulse-offline {

    0%,
    100% {
        opacity: 1;
        box-shadow: 0 0 0 0 rgba(245, 108, 108, 0.7);
    }

    50% {
        opacity: 0.8;
        box-shadow: 0 0 0 4px rgba(245, 108, 108, 0);
    }
}

/* 右键菜单样式 */
.context-menu {
    position: fixed;
    background: var(--el-bg-color-overlay);
    border: 1px solid var(--el-border-color);
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    padding: 4px 0;
    min-width: 180px;
    z-index: 9999;
    backdrop-filter: blur(10px);

    .menu-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 16px;
        cursor: pointer;
        transition: background 0.2s;
        font-size: 14px;
        color: var(--el-text-color-primary);

        .el-icon {
            font-size: 16px;
            color: var(--el-text-color-secondary);
        }

        &:hover {
            background: var(--el-fill-color-light);

            .el-icon {
                color: var(--el-color-primary);
            }
        }
    }

    .menu-divider {
        height: 1px;
        background: var(--el-border-color-lighter);
        margin: 4px 0;
    }
}
</style>
