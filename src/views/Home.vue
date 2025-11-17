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
                    <span class="results-count">找到 {{ searchStore.searchResults.length }} 首歌曲</span>
                </div>
                <div class="results-table">
                    <div class="table-header">
                        <div class="col-index">#</div>
                        <div class="col-name">歌曲名</div>
                        <div class="col-artist">艺术家</div>
                        <div class="col-album">专辑名</div>
                        <div class="col-duration">时长</div>
                        <div class="col-actions">操作</div>
                    </div>
                    <div class="table-body">
                        <div v-for="(song, index) in searchStore.searchResults" :key="song.id" class="table-row"
                            @dblclick="handlePlaySong(song)"
                            :class="{ 'is-playing': playerStore.currentSong?.id === song.id }">
                            <div class="col-index">
                                <span v-if="playerStore.currentSong?.id !== song.id">{{ index + 1 }}</span>
                                <el-icon v-else class="playing-icon">
                                    <VideoPlay />
                                </el-icon>
                            </div>
                            <div class="col-name">
                                <span class="song-name">{{ song.name }}</span>
                            </div>
                            <div class="col-artist">{{ song.artists }}</div>
                            <div class="col-album">{{ song.album }}</div>
                            <div class="col-duration">{{ formatDuration(song.duration) }}</div>
                            <div class="col-actions">
                                <el-button text :icon="VideoPlay" @click.stop="handlePlaySong(song)" title="播放" />
                                <el-button text :icon="Plus" @click.stop="handleAddToPlaylist(song)" title="添加到播放列表" />
                                <el-button text :icon="Download" title="下载" />
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
                    <img :src="playerStore.currentSong.picUrl" :alt="playerStore.currentSong.name" class="large-cover"
                        :class="{ rotating: playerStore.isPlaying }" />
                    <h2>{{ playerStore.currentSong.name }}</h2>
                    <p>{{ playerStore.currentSong.artists }}</p>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { onMounted } from "vue";
import { useRouter } from "vue-router";
import { Sunny, Moon, VideoPlay, Plus, Download, Setting } from "@element-plus/icons-vue";
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

const goToSettings = () => {
    router.push("/settings");
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

const formatDuration = (duration?: number) => {
    if (!duration) return "--:--";
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
};

onMounted(() => {
    themeStore.initTheme();
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
            gap: 8px;
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
                }
            }

            .results-table {
                flex: 1;
                overflow-y: auto;
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
                        text-align: center;
                    }

                    .col-name {
                        flex: 1;
                        min-width: 200px;
                    }

                    .col-artist {
                        flex: 0 0 180px;
                    }

                    .col-album {
                        flex: 0 0 180px;
                    }

                    .col-duration {
                        flex: 0 0 80px;
                        text-align: center;
                    }

                    .col-actions {
                        flex: 0 0 120px;
                        text-align: center;
                    }
                }

                .table-body {
                    // 移除 flex 和 overflow，让父容器处理滚动

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
                            flex: 0 0 180px;
                            font-size: 13px;
                            color: var(--el-text-color-secondary);
                            overflow: hidden;
                            text-overflow: ellipsis;
                            white-space: nowrap;
                        }

                        .col-album {
                            flex: 0 0 180px;
                            font-size: 13px;
                            color: var(--el-text-color-secondary);
                            overflow: hidden;
                            text-overflow: ellipsis;
                            white-space: nowrap;
                        }

                        .col-duration {
                            flex: 0 0 80px;
                            text-align: center;
                            font-size: 13px;
                            color: var(--el-text-color-secondary);
                        }

                        .col-actions {
                            flex: 0 0 120px;
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
</style>
