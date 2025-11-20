# 清风音乐播放器

一个现代化的桌面音乐播放器，支持在线音乐播放、本地音乐管理、歌单管理等功能。

## ✨ 特性

- 🎵 **在线音乐播放** - 搜索并播放在线音乐
- 💾 **本地音乐管理** - 导入和管理本地音乐文件
- 📝 **歌单管理** - 创建和管理自定义歌单
- 🌓 **主题切换** - 支持深色/浅色主题

## 🛠️ 技术栈

- **前端框架**: Vue 3 + TypeScript
- **桌面框架**: Electron
- **UI 组件**: Element Plus
- **状态管理**: Pinia
- **路由**: Vue Router
- **构建工具**: Vite
- **后端服务**: [Netease_url](https://github.com/Breeze-mi/Netease_url)

## 📦 项目结构

```
├── electron/           # Electron 主进程代码
├── src/
│   ├── api/           # API 接口
│   ├── components/    # Vue 组件
│   ├── stores/        # Pinia 状态管理
│   ├── storage/       # 存储适配器
│   ├── utils/         # 工具函数
│   └── views/         # 页面视图
├── public/            # 静态资源
└── build/             # 打包资源
```

## 🚀 快速开始

### 环境要求

- Node.js >= 16.x
- pnpm >= 8.x

### 安装依赖

```bash
pnpm p-install
```

### 启动后端服务

本项目需要配合后端服务使用，请先启动后端：

```bash
# 克隆后端项目
git clone https://github.com/Breeze-mi/Netease_url.git

# 进入目录安装依赖
cd Netease_url

pip install -r requirements.txt

#启动后端
python main.py
```

后端服务默认运行在 `http://localhost:5000`

### 开发模式

````bash
# 开发模式
pnpm run dev

### 生产构建

```bash
# 构建 Web 版本
pnpm p-build

# 构建 Electron 应用
pnpm  build
````

## 🎮 使用说明

### 1. 搜索音乐

- 在搜索框输入歌曲名、歌手名或关键词
- 支持多种搜索类型：音乐搜索、单曲解析、歌单解析、专辑解析
- 双击歌曲即可播放

### 2. 本地音乐

- 点击侧边栏"本地音乐"
- 点击"导入音乐"按钮选择本地音频文件
- 支持常见音频格式（MP3、FLAC、WAV 等）

### 3. 歌单管理

- 点击侧边栏"我喜欢"查看收藏的歌曲
- 点击"创建歌单"创建自定义歌单
- 右键歌曲可添加到指定歌单

### 4. 播放控制

- 底部播放栏提供完整的播放控制
- 支持播放/暂停、上一曲/下一曲、进度调节
- 支持音量调节、播放模式切换
- 支持歌词显示

## ⚙️ 配置说明

### 环境变量

创建 `.env.local` 文件自定义配置：

```bash
# API 服务器地址
VITE_API_BASE_URL=http://localhost:5000
```

### 音质设置

在设置页面可以选择播放音质：

- 标准音质 (128k)
- 极高音质 (320k)
- 无损音质 (FLAC)
- Hi-Res 音质

### 缓存管理

- 试听缓存：自动缓存播放过的歌曲
- 本地音乐：永久存储导入的音乐文件
- 可在设置页面清空缓存

## 📱 平台支持

### Web 版本

直接在浏览器中运行，支持：

- Chrome / Edge (推荐)
- Firefox
- Safari

### Electron 版本

打包为桌面应用，支持：

- Windows 10/11

## 🔧 开发指南

### 添加新功能

1. 在 `src/api/` 中添加 API 接口
2. 在 `src/stores/` 中添加状态管理
3. 在 `src/views/` 或 `src/components/` 中添加 UI 组件

## 📄 许可证

MIT License

## 🙏 致谢

- 后端灵感来源：[Netease_url](https://github.com/Suxiaoqinx/Netease_url)
- 项目灵感来源：[洛雪音乐](https://github.com/lyswhut/lx-music-desktop)
- UI 组件：[Element Plus](https://element-plus.org/)

- 图标： [阿里巴巴矢量图](https://www.iconfont.cn/)

## 📮 反馈与建议

如有问题或建议，欢迎提交 Issue。

---

**注意：** 本项目仅供学习交流使用，请勿用于商业用途。
