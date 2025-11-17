<template>
  <div class="app-container">
    <router-view v-slot="{ Component }">
      <transition name="fade" mode="out-in">
        <component :is="Component" />
      </transition>
    </router-view>

    <!-- 全局播放控制栏 -->
    <PlayerBar />

    <!-- 播放列表抽屉 -->
    <PlaylistDrawer />
  </div>
</template>

<script setup lang="ts">
import PlayerBar from "@/components/PlayerBar.vue";
import PlaylistDrawer from "@/components/PlaylistDrawer.vue";
</script>

<style>
.app-container {
  width: 100%;
  height: 100vh;
  min-width: 600px;
  overflow: hidden;
}

/* 为整个应用设置最小宽度 */
body {
  min-width: 600px;
}

/* 页面切换动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.fade-enter-from {
  opacity: 0;
  transform: translateX(20px);
}

.fade-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}
</style>
