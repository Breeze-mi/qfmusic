import { createApp } from "vue";
import ElementPlus from "element-plus";
import "element-plus/dist/index.css";
import "./style.css";
import router from "./router";
import { createPinia } from "pinia";
import App from "./App.vue";
import { useThemeStore } from "./stores/theme";
import { useLocalMusicStore } from "./stores/localMusic";

const pinia = createPinia();
const app = createApp(App);

app.use(router);
app.use(pinia);
app.use(ElementPlus);

// 初始化主题
const themeStore = useThemeStore();
themeStore.initTheme();

// 初始化本地音乐（从存储恢复）
const localMusicStore = useLocalMusicStore();
localMusicStore.initializeFromStorage().catch((error) => {
  console.error("初始化本地音乐失败:", error);
});

if (
  process.env.NODE_ENV === "development" &&
  (window as any)?.electronAPI?.openF12
) {
  window.addEventListener("keydown", (e) => {
    // F12
    if (e.key === "F12") {
      e.preventDefault();
      (window as any)?.electronAPI?.openF12();
      return false;
    }
  });
}
app.mount("#app");
