<template>
    <div class="search-bar">
        <el-select v-model="settingsStore.searchType" placeholder="选择类型" style="width: 120px">
            <el-option label="搜索音乐" value="music" />
            <el-option label="单曲解析" value="song" />
            <el-option label="歌单解析" value="playlist" />
            <el-option label="专辑解析" value="album" />
        </el-select>
        <el-input v-model="searchStore.keyword" :placeholder="placeholderText" :prefix-icon="Search" clearable
            @keyup.enter="handleSearch" />
        <el-button type="primary" :icon="Search" @click="handleSearch" :loading="searchStore.searching">
            {{ buttonText }}
        </el-button>
    </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { Search } from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";
import MusicApi from "@/api/music";
import { useSearchStore } from "@/stores/search";
import { useSettingsStore } from "@/stores/settings";

const searchStore = useSearchStore();
const settingsStore = useSettingsStore();

// 提取ID的通用函数
const extractId = (input: string): string => {
    const trimmed = input.trim();

    // 如果是纯数字，直接返回
    if (/^\d+$/.test(trimmed)) {
        return trimmed;
    }

    // 尝试从URL中提取ID
    const patterns = [
        /id=(\d+)/,           // ?id=123456
        /\/(\d+)/,            // /123456
        /song\/(\d+)/,        // /song/123456
        /playlist\/(\d+)/,    // /playlist/123456
        /album\/(\d+)/,       // /album/123456
    ];

    for (const pattern of patterns) {
        const match = trimmed.match(pattern);
        if (match) {
            return match[1];
        }
    }

    return trimmed;
};

// 根据搜索类型动态显示文本
const placeholderText = computed(() => {
    const typeMap = {
        music: "搜索音乐",
        song: "输入歌曲ID或链接",
        playlist: "输入歌单ID",
        album: "输入专辑ID",
    };
    return typeMap[settingsStore.searchType];
});

const buttonText = computed(() => {
    const typeMap = {
        music: "搜索",
        song: "解析单曲",
        playlist: "解析歌单",
        album: "解析专辑",
    };
    return typeMap[settingsStore.searchType];
});

const handleSearch = async () => {
    if (!searchStore.keyword.trim()) {
        ElMessage.warning(`请输入${placeholderText.value}`);
        return;
    }

    searchStore.setSearching(true);
    try {
        const type = settingsStore.searchType;

        if (type === "music") {
            // 搜索音乐 - 请求更多结果（最多9999首）
            const { data } = await MusicApi.search(searchStore.keyword, 9999);
            if (data.value?.success) {
                searchStore.setSearchResults(data.value.data);
                if (data.value.data.length === 0) {
                    ElMessage.info("未找到相关歌曲，请尝试其他关键词");
                } else {
                    ElMessage.success(`找到 ${data.value.data.length} 首歌曲`);
                }
            } else {
                ElMessage.error(data.value?.message || "搜索失败");
            }
        } else if (type === "playlist") {
            // 解析歌单
            const playlistId = extractId(searchStore.keyword);

            if (!/^\d+$/.test(playlistId)) {
                ElMessage.error("请输入有效的歌单ID或链接");
                return;
            }

            const { data } = await MusicApi.getPlaylist(playlistId);
            if (data.value?.success && data.value.data?.playlist) {
                const playlist = data.value.data.playlist;
                searchStore.setSearchResults(playlist.tracks);
                ElMessage.success(`解析成功：${playlist.name}，共 ${playlist.tracks.length} 首歌曲`);
            } else {
                ElMessage.error(data.value?.message || "歌单解析失败，请检查ID是否正确");
            }
        } else if (type === "album") {
            // 解析专辑
            const albumId = extractId(searchStore.keyword);

            if (!/^\d+$/.test(albumId)) {
                ElMessage.error("请输入有效的专辑ID或链接");
                return;
            }

            const { data } = await MusicApi.getAlbum(albumId);
            if (data.value?.success && data.value.data?.album) {
                const album = data.value.data.album;
                searchStore.setSearchResults(album.songs);
                ElMessage.success(`解析成功：${album.name}，共 ${album.songs.length} 首歌曲`);
            } else {
                ElMessage.error(data.value?.message || "专辑解析失败，请检查ID是否正确");
            }
        } else if (type === "song") {
            // 单曲解析
            const songId = extractId(searchStore.keyword);

            if (!/^\d+$/.test(songId)) {
                ElMessage.error("请输入有效的歌曲ID或链接");
                return;
            }

            // 获取歌曲详情
            const { data } = await MusicApi.getSong(songId, settingsStore.quality);
            if (data.value?.success && data.value.data) {
                const songDetail = data.value.data;
                // 将单曲转换为搜索结果格式
                const song = {
                    id: songId,
                    name: songDetail.name,
                    artists: songDetail.ar_name,
                    album: songDetail.al_name,
                    picUrl: songDetail.pic,
                    duration: 0
                };
                searchStore.setSearchResults([song]);
                ElMessage.success(`解析成功：${songDetail.name} - ${songDetail.ar_name}`);
            } else {
                ElMessage.error(data.value?.message || "单曲解析失败");
            }
        }
    } catch (error) {
        console.error("操作失败:", error);
        ElMessage.error("操作失败，请稍后重试");
    } finally {
        searchStore.setSearching(false);
    }
};
</script>

<style scoped lang="scss">
.search-bar {
    display: flex;
    gap: 8px;
    width: 100%;
    max-width: 600px;

    .el-input {
        flex: 1;
    }
}
</style>
