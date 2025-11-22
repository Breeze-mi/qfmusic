<template>
  <div class="app-container">
    <!-- 侧边栏 - 在全屏页面时隐藏 -->
    <Sidebar v-if="!isFullscreenPage" />

    <!-- 主内容区 -->
    <div class="main-wrapper" :class="{ 'fullscreen': isFullscreenPage }">
      <router-view>
      </router-view>
    </div>

    <!-- 歌曲详情页 - 独立渲染，覆盖整个应用 -->
    <!-- <transition name="slide-up" appear>
      <div v-if="showSongDetail" class="song-detail-overlay">
        <router-view v-slot="{ Component, route }">
          <component :is="Component" v-if="isSongDetailPage(route.path)" :key="route.path" />
        </router-view>
      </div>
    </transition> -->

    <!-- 全局播放控制栏 -->
    <PlayerBar />

    <!-- 播放列表抽屉 -->
    <PlaylistDrawer />
  </div>
</template>

<script setup lang="ts">
import { computed, watch, ref } from "vue";
import { useRoute } from "vue-router";
import Sidebar from "@/components/Sidebar.vue";
import PlayerBar from "@/components/PlayerBar.vue";
import PlaylistDrawer from "@/components/PlaylistDrawer.vue";

const route = useRoute();

// 判断当前页面是否为全屏页面
const isFullscreenPage = computed(() => {
  return route.meta.fullscreen === true;
});

// // 判断是否是歌曲详情页
// const isSongDetailPage = (routePath: string) => {
//   return routePath.startsWith('/song/');
// };

// // 控制歌曲详情页的显示状态
// const showSongDetail = ref(false);

// // 监听路由变化，控制动画
// watch(() => route.path, (newPath, oldPath) => {
//   const isEnteringSongDetail = isSongDetailPage(newPath);
//   const isLeavingSongDetail = oldPath && isSongDetailPage(oldPath);

//   if (isEnteringSongDetail) {
//     // 进入歌曲详情页
//     showSongDetail.value = true;
//   } else if (isLeavingSongDetail) {
//     // 离开歌曲详情页
//     showSongDetail.value = false;
//   }
// }, { immediate: true });
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


/* 歌曲详情页覆盖层 */
/*
.song-detail-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
  background: var(--el-bg-color);
  transform-origin: center bottom;
}

/* 歌曲详情页弹出动画 - 抽屉效果：从底部向上滑出 + 淡入淡出 */
/* .slide-up-enter-active {
  animation: drawerSlideUp 1s ease-out !important;
}

.slide-up-leave-active {
  animation: drawerSlideDown 1s ease-in !important;
}

@keyframes drawerSlideUp {
  0% {
    transform: translateY(100%);
    opacity: 0;
  }

  100% {
    transform: translateY(0);
    opacity: 1;
  }
}

@keyframes drawerSlideDown {
  0% {
    transform: translateY(0);
    opacity: 1;
  }

  100% {
    transform: translateY(100%);
    opacity: 0;
  }
} */
</style>
