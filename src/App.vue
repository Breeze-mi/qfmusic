<template>
  <div class="app-container">
    <!-- 侧边栏 - 在全屏页面时隐藏 -->
    <Sidebar v-if="!isFullscreenPage" />

    <!-- 主内容区 -->
    <div class="main-wrapper" :class="{ 'fullscreen': isFullscreenPage }">
      <router-view>
      </router-view>
    </div>

    <!-- 全局播放控制栏 -->
    <PlayerBar />

    <!-- 播放列表抽屉 -->
    <PlaylistDrawer />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import Sidebar from "@/components/Sidebar.vue";
import PlayerBar from "@/components/PlayerBar.vue";
import PlaylistDrawer from "@/components/PlaylistDrawer.vue";

const route = useRoute();

// 判断当前页面是否为全屏页面
const isFullscreenPage = computed(() => {
  return route.meta.fullscreen === true;
});


</script>

<style>
.app-container {
  width: 100%;
  height: 100vh;
  min-width: 800px;
  overflow: hidden;
  display: flex;
}

.main-wrapper {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: all 0.3s ease;
  /* position: relative; */

  &.fullscreen {
    width: 100%;
  }
}

/* 为整个应用设置最小宽度 */
body {
  min-width: 800px;
}
</style>
