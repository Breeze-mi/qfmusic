<template>
    <div class="sidebar">
        <!-- Logo -->
        <div class="sidebar-logo">
            <h1>🎵 音乐</h1>
        </div>

        <!-- 主导航 -->
        <div class="sidebar-nav">
            <div class="nav-item" :class="{ active: currentRoute === '/' }" @click="navigateTo('/')">
                <el-icon>
                    <Search />
                </el-icon>
                <span>发现音乐</span>
            </div>
        </div>

        <!-- 我的音乐 -->
        <div class="sidebar-section">
            <div class="section-title">我的音乐</div>
            <div class="nav-item" :class="{ active: currentRoute === '/playlist/history' }"
                @click="navigateTo('/playlist/history')">
                <el-icon>
                    <Clock />
                </el-icon>
                <span>最近播放</span>
            </div>
            <div class="nav-item" :class="{ active: currentRoute === '/playlist/favorite' }"
                @click="navigateTo('/playlist/favorite')">
                <el-icon>
                    <Star />
                </el-icon>
                <span>我的收藏</span>
            </div>
            <div class="nav-item" :class="{ active: currentRoute === '/playlist/local' }"
                @click="navigateTo('/playlist/local')">
                <el-icon>
                    <Folder />
                </el-icon>
                <span>本地音乐</span>
                <span class="count" v-if="localMusicStore.localFiles.length > 0">{{
                    localMusicStore.localFiles.length }}</span>
            </div>
        </div>

        <!-- 创建的歌单 -->
        <div class="sidebar-section">
            <div class="section-title">
                <span>创建的歌单</span>
                <el-icon class="add-icon" @click="showCreateDialog = true" title="新建歌单">
                    <Plus />
                </el-icon>
            </div>
            <div v-if="playlistStore.playlists.length === 0" class="empty-tip">
                暂无歌单
            </div>
            <div v-else class="playlist-list">
                <div v-for="playlist in playlistStore.playlists" :key="playlist.id" class="nav-item playlist-item"
                    :class="{ active: currentRoute === `/playlist/${playlist.id}` }"
                    @click="navigateTo(`/playlist/${playlist.id}`)"
                    @contextmenu.prevent="handlePlaylistContextMenu($event, playlist)">
                    <el-icon>
                        <Headset />
                    </el-icon>
                    <span class="playlist-name">{{ playlist.name }}</span>
                    <span class="count" v-if="playlist.songs.length > 0">{{ playlist.songs.length }}</span>
                </div>
            </div>
        </div>

        <!-- 右键菜单 -->
        <div v-if="contextMenuVisible" class="context-menu"
            :style="{ top: contextMenuY + 'px', left: contextMenuX + 'px' }">
            <div class="menu-item" @click="handleRenamePlaylist">
                <el-icon>
                    <Edit />
                </el-icon>
                <span>重命名</span>
            </div>
            <div class="menu-item delete-item" @click="handleDeletePlaylist">
                <el-icon>
                    <Delete />
                </el-icon>
                <span>删除歌单</span>
            </div>
        </div>

        <!-- 创建/编辑歌单对话框 -->
        <el-dialog v-model="showCreateDialog" :title="editingPlaylist ? '编辑歌单' : '新建歌单'" width="400px">
            <el-form :model="playlistForm" label-width="80px">
                <el-form-item label="歌单名称">
                    <el-input v-model="playlistForm.name" placeholder="请输入歌单名称" maxlength="50" show-word-limit />
                </el-form-item>
                <el-form-item label="歌单简介">
                    <el-input v-model="playlistForm.description" type="textarea" :rows="3" placeholder="请输入歌单简介（可选）"
                        maxlength="200" show-word-limit />
                </el-form-item>
            </el-form>
            <template #footer>
                <el-button @click="showCreateDialog = false; editingPlaylist = null">取消</el-button>
                <el-button type="primary" @click="handleSavePlaylist">
                    {{ editingPlaylist ? '保存' : '创建' }}
                </el-button>
            </template>
        </el-dialog>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import { Search, Clock, Star, Folder, Headset, Plus, Edit, Delete } from "@element-plus/icons-vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { usePlaylistStore } from "@/stores/playlist";
import { useLocalMusicStore } from "@/stores/localMusic";

const router = useRouter();
const route = useRoute();
const playlistStore = usePlaylistStore();
const localMusicStore = useLocalMusicStore();

const currentRoute = computed(() => route.path);
const showCreateDialog = ref(false);
const playlistForm = ref({
    name: "",
    description: "",
});

const navigateTo = (path: string) => {
    router.push(path);
};

// 右键菜单状态
const contextMenuVisible = ref(false);
const contextMenuX = ref(0);
const contextMenuY = ref(0);
const contextMenuPlaylist = ref<any>(null);
const editingPlaylist = ref<any>(null);

// 显示右键菜单
const handlePlaylistContextMenu = (event: MouseEvent, playlist: any) => {
    event.preventDefault();
    event.stopPropagation();
    contextMenuPlaylist.value = playlist;
    contextMenuX.value = event.clientX;
    contextMenuY.value = event.clientY;
    contextMenuVisible.value = true;
};

// 关闭右键菜单
const closeContextMenu = () => {
    contextMenuVisible.value = false;
    contextMenuPlaylist.value = null;
};

// 重命名歌单
const handleRenamePlaylist = () => {
    if (!contextMenuPlaylist.value) return;

    editingPlaylist.value = contextMenuPlaylist.value;
    playlistForm.value = {
        name: contextMenuPlaylist.value.name,
        description: contextMenuPlaylist.value.description,
    };
    showCreateDialog.value = true;
    closeContextMenu();
};

// 删除歌单
const handleDeletePlaylist = () => {
    if (!contextMenuPlaylist.value) return;

    const playlist = contextMenuPlaylist.value;
    closeContextMenu(); // 先关闭菜单

    ElMessageBox.confirm(
        `确定要删除歌单《${playlist.name}》吗？歌单中的 ${playlist.songs.length} 首歌曲也会被移除。`,
        "删除确认",
        {
            confirmButtonText: "确定",
            cancelButtonText: "取消",
            type: "warning",
        }
    ).then(() => {
        const success = playlistStore.deletePlaylist(playlist.id);
        if (success) {
            ElMessage.success("歌单已删除");
            // 如果当前正在查看被删除的歌单，跳转到首页
            if (currentRoute.value === `/playlist/${playlist.id}`) {
                navigateTo('/');
            }
        } else {
            ElMessage.error("删除失败");
        }
    }).catch(() => {
        // 用户取消
    });
};

// 保存歌单（创建或编辑）
const handleSavePlaylist = () => {
    if (!playlistForm.value.name.trim()) {
        ElMessage.warning("请输入歌单名称");
        return;
    }

    // 检查歌单名是否重复（编辑时排除自己）
    const isDuplicate = playlistStore.playlists.some(p =>
        p.name === playlistForm.value.name &&
        (!editingPlaylist.value || p.id !== editingPlaylist.value.id)
    );

    if (isDuplicate) {
        ElMessage.warning("歌单名称已存在，请使用其他名称");
        return;
    }

    if (editingPlaylist.value) {
        // 编辑歌单
        playlistStore.updatePlaylist(editingPlaylist.value.id, {
            name: playlistForm.value.name,
            description: playlistForm.value.description,
        });
        ElMessage.success("歌单已更新");
        editingPlaylist.value = null;
    } else {
        // 创建歌单
        playlistStore.createPlaylist(playlistForm.value.name, playlistForm.value.description);
        ElMessage.success("歌单创建成功");
    }

    showCreateDialog.value = false;
    playlistForm.value = {
        name: "",
        description: "",
    };
};

// 点击其他地方关闭右键菜单
const handleClickOutside = () => {
    if (contextMenuVisible.value) {
        closeContextMenu();
    }
};

onMounted(() => {
    document.addEventListener("click", handleClickOutside);
});

onUnmounted(() => {
    document.removeEventListener("click", handleClickOutside);
});
</script>

<style scoped lang="scss">
.sidebar {
    width: 200px;
    height: 100vh;
    background: #f7f8fa;
    display: flex;
    flex-direction: column;
    border-right: 1px solid #e5e5e7;
    flex-shrink: 0;

    .sidebar-logo {
        padding: 20px 16px;
        border-bottom: 1px solid #e5e5e7;

        h1 {
            margin: 0;
            font-size: 18px;
            font-weight: 600;
            color: #333;
        }
    }

    .sidebar-nav {
        padding: 12px 8px;
        border-bottom: 1px solid #e5e5e7;
    }

    .sidebar-section {
        padding: 12px 8px;
        border-bottom: 1px solid #e5e5e7;

        .section-title {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 8px 12px;
            font-size: 12px;
            color: #999;
            font-weight: 500;

            .add-icon {
                cursor: pointer;
                color: #666;
                transition: color 0.2s;

                &:hover {
                    color: #2878ff;
                }
            }
        }

        .empty-tip {
            padding: 8px 12px;
            font-size: 12px;
            color: #999;
            text-align: center;
        }

        .playlist-list {
            max-height: 300px;
            overflow-y: auto;

            &::-webkit-scrollbar {
                width: 4px;
            }

            &::-webkit-scrollbar-thumb {
                background: #ddd;
                border-radius: 2px;
            }
        }
    }

    .nav-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 12px;
        margin: 2px 0;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s;
        font-size: 14px;
        color: #333;
        position: relative;

        .el-icon {
            font-size: 18px;
            color: #666;
        }

        span {
            flex: 1;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .count {
            flex: none;
            font-size: 12px;
            color: #999;
            background: #e5e5e7;
            padding: 2px 6px;
            border-radius: 10px;
            min-width: 20px;
            text-align: center;
        }

        &:hover {
            background: #ebedf0;
        }

        &.active {
            background: linear-gradient(90deg, #2878ff 0%, #4a8fff 100%);
            color: white;
            box-shadow: 0 2px 8px rgba(40, 120, 255, 0.3);

            .el-icon {
                color: white;
            }

            .count {
                background: rgba(255, 255, 255, 0.25);
                color: white;
            }
        }
    }

    .playlist-item {
        .playlist-name {
            font-size: 13px;
        }
    }
}

/* 右键菜单样式 */
.context-menu {
    position: fixed;
    background: white;
    border: 1px solid #e5e5e7;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    padding: 4px 0;
    min-width: 140px;
    z-index: 10000;

    .menu-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 16px;
        cursor: pointer;
        transition: background 0.2s;
        font-size: 13px;
        color: #333;

        .el-icon {
            font-size: 16px;
            color: #666;
        }

        &:hover {
            background: #f7f7f7;

            .el-icon {
                color: #2878ff;
            }
        }

        &.delete-item {
            &:hover {
                background: #fff1f0;
                color: #ff4d4f;

                .el-icon {
                    color: #ff4d4f;
                }
            }
        }
    }
}
</style>
