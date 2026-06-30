# 私密阅读 (Secret Reading) - 项目技术详解与 APK 打包指南
> **Project_Details.md**

本项目是一个名为 **“私密阅读” (Secret Reading)** 的高保真、体验卓越的轻量级小说序列化与读者社区平台。
为了绕过在云端沙盒环境中因缺少 **Java Development Kit (JDK 17)** 与 `JAVA_HOME` 环境变量导致的 APK 本地编译限制，本文档详尽列出了项目的**文件架构**、**运行逻辑**以及**如何在任何拥有 Android 编译环境的设备或 AI 助手的协助下将本项目打包成 APK 安装包**。

---

## 目录
1. [技术栈与核心特性](#技术栈与核心特性)
2. [项目文件目录结构与详解](#项目文件目录结构与详解)
3. [核心功能运作流 (Workflow)](#核心功能运作流)
4. [数据库架构设计 (Firestore Collections)](#数据库架构设计)
5. [离线数据缓存设计 (Offline-First)](#离线数据缓存设计)
6. [Android APK 离线打包完全指南 (重要)](#android-apk-离线打包完全指南)
7. [GitHub 发布与持续集成建议](#github-发布与持续集成建议)

---

## 技术栈与核心特性

*   **前端框架**: React 19 (TypeScript) + Vite 6
*   **动画库**: Motion (`motion/react`) 提供丝滑的页面切换及弹窗过渡效果
*   **图标库**: Lucide React 提供全套现代、统一的 SVG 图标
*   **样式库**: Tailwind CSS v4 现代化原子级 CSS 框架
*   **混合移动跨平台包装**: Capacitor v8 (Capacitor CLI & Core & Android)
*   **后端与存储**: Firebase v12 (包含 Firebase Authentication 用户认证, Firestore 实时云数据库)
*   **特殊工具类**:
    *   `opencc-js`: 实现繁体/简体中文的一键转换，满足不同地区读者的阅读习惯。
    *   `safeLocalStorage` / `safeSessionStorage`: 封装了具有降级保护的离线状态与账号缓存逻辑，避免在 Android WebView 或特殊浏览器沙盒中因 `localStorage` 被禁用而崩溃。

---

## 项目文件目录结构与详解

项目代码完全遵循高度模块化、关注点分离的设计模式，文件具体作用分配如下：

### 1. 根目录配置文件
*   **`package.json`**: 声明项目依赖（包括 React 19, Capacitor v8, Firebase 12, Motion, Lucide 等）与构建脚本。
*   **`capacitor.config.ts`**: Capacitor 官方配置文件。定义了 App 包名为 `com.secret.reading`，应用名称为 `私密阅读`，并指定编译出的静态网页资源目录为 `dist`。
*   **`vite.config.ts`**: Vite 的编译打包配置文件，集成 React 插件以及 Tailwind CSS v4 编译器。
*   **`tsconfig.json`**: TypeScript 静态类型检查与编译选项配置文件。
*   **`vercel.json`**: 静态托管路由重定向配置文件，包含 CleanURLs 与 Service Worker/静态资源直通规则。
*   **`firebase-applet-config.json`**: 自动关联的 Firebase 客户端 SDK 秘钥配置。
*   **`firebase-blueprint.json`**: 完整的云数据库模型蓝图，规定了 16 个核心数据集合的属性。
*   **`firestore.rules`**: 部署于 Firebase 端的安全规则，保障读者与作者之间的数据不被越权篡改。
*   **`server.ts`**: Express 全栈服务端。不仅在开发时通过 Vite Middleware 实时代理静态资源，也具备 API 网关扩展能力。

### 2. `/src` 前端核心代码目录
*   **`src/main.tsx`**: React 应用的总入口文件，渲染 `App.tsx` 并将其挂载到 `index.html` 的 `#root` 节点。
*   **`src/App.tsx`**: **应用核心主控中心**。
    *   管理全局路由状态（包含 `home`, `login`, `register`, `write`, `profile`, `admin`, `settings`, `bookshelf` 等页面切换）。
    *   实时监听 Firebase 用户鉴权状态更改 (`onAuthStateChanged`)。
    *   监听网络连通性状态，并在网络离线时展示精美离线浮窗提醒。
    *   捕获 Android 浏览器 / PWA 触发的 `beforeinstallprompt` 安装引导逻辑。
    *   在内存及安全离线缓存中实时同步用户档案与通知队列。
*   **`src/firebase.ts`**: 初始化 Firebase App、Authentication 以及 Firestore 的实例。包含：
    *   `testConnection()`: 网络自动探针，在初次加载时检查数据库访问状态。
    *   `handleFirestoreError()`: 统一的错误截获与上报引擎，提供操作类型、路径和用户鉴权状态的 JSON 格式解析。
*   **`src/types.ts`**: 全局 TypeScript 类型接口声明。定义了 `AppUser`, `Post`, `Series`, `Comment`, `Notification`, `Message`, `UserStreak` 等高强度的实体类型。
*   **`src/index.css`**: 全局 CSS 文件，采用 `@import "tailwindcss";` 导入 Tailwind 全套样式并加载了 Inter 现代无衬线字体。

### 3. `src/components/` 核心功能组件
*   **`Login.tsx` / `Register.tsx`**: 用户登录与注册模块。完美对接 Firebase Auth，注册时将用户数据同步写入 Firestore `users` 集合。
*   **`Home.tsx`**: 应用的主页。展示推荐轮播、系统最新公告、热门小说连载、完结推荐，以及智能的简繁转换开关。
*   **`Onboarding.tsx`**: 首次登录读者的兴趣取向与个人生日、个性签名向导，为新读者建立专属画像。
*   **`Bookshelf.tsx`**: 读者个人的私密书架。支持将小说/连载一键加入书架，显示最近阅读章节、追更进度，支持离线本地缓存书籍阅读。
*   **`Write.tsx`**: 作者与管理员的小说创作中心。支持创建/管理连载专栏 (Series)，在线撰写/编辑文章草稿，支持 Markdown 渲染，支持拖拽上传图片/插图。
*   **`PostDetail.tsx`**: 小说章节/博文详情阅读器。
    *   支持**专注模式 (Focus Mode)** 切换（隐藏非必要元素，提供最舒适的阅读暗色护眼环境）。
    *   支持简繁体转换阅读。
    *   集成点赞、评论互动、读者短评 (Short Review)、向作者提问 Q&A 等强社交特性。
    *   防作弊/防搬运设计：内置选择文本保护，限制随意复制。
*   **`Profile.tsx` / `AuthorProfile.tsx`**: 用户个人主页与作者主页。显示用户的足迹、发布的文章、关注的作者、粉丝数，支持用户一键私信 (Message) 与关注操作。
*   **`Messages.tsx`**: 实时私信/私密豆邮对话面板。支持两端实时接收新消息，显示历史私信会话列表。
*   **`Settings.tsx`**: 用户账户设置面板。支持修改个人资料（昵称、头像链接、生日）、退出登录、以及一键清理离线缓存。
*   **`Admin.tsx`**: 超级后台面板（专属于 role 为 `owner` 或 `admin` 的用户，如 `zhoyilee@gmail.com`）。
    *   审批普通读者提交的“作者资格申请”。
    *   审核读者举报的违规或带有 R18 标签的敏感博文与图片（支持一键封禁、下架或标记合规）。
    *   发布全局系统公告 (Announcements)。
*   **`DownloadAndroidModal.tsx`**: 提示读者下载 APK 或安装 PWA 应用的引导弹窗，检测当前是否为 Android 容器环境，提供原生下载安装的操作指引。
*   **`ImageUploader.tsx` / `ImageCropper.tsx` / `ImageWrapper.tsx`**: 辅助图片上传与头像裁剪的高性能微组件。
*   **`MarkdownRenderer.tsx`**: 将数据库中存储的 Markdown 格式文章完美渲染为优雅排版的 HTML 阅读页。

### 4. `src/utils/` 与 `src/lib/` 辅助函数
*   **`src/utils/safeStorage.ts`**: 封装了防崩溃的 LocalStorage 与 SessionStorage 安全存取器。即使环境完全禁用了 Cookie/本地存储，也能平稳降级到内存 Map 中运行，绝不抛出白屏异常。
*   **`src/utils/chineseConverter.ts`**: 集成 `opencc-js` 实现的高精度“简体字-繁体字”动态双向翻译工具。
*   **`src/utils/googleDrive.ts`**: 备份用户数据到 Google 云端硬盘的相关 API 封装。
*   **`src/lib/mongoClient.ts`**: 为后期可能扩展的外部文档型数据库（如 MongoDB）预留的安全客户端存取规范。

### 5. `/android` 目录
*   **完整的 Capacitor 原生 Android 工程**。它将 Vite 构建出来的网页文件通过原生 `WebView` 封装。所有的 Android 生命周期、应用图标、权限声明均已在其中设置完毕，是编译出原生 Android `.apk` 文件的关键。

---

## 核心功能运作流

```
[ 用户注册/登录 (Firebase Auth) ]
         │
         ├───> [ 写入 users/{uid} (Firestore) ]
         │
         ├───> [ 主页 Home 浏览推荐 / 简繁转换 ]
         │         │
         │         ├───> [ 博文/小说详情阅读 PostDetail ]
         │         │         ├───> [ 开启专注模式 Focus Mode ]
         │         │         ├───> [ 发表短评 ShortReview ]
         │         │         └───> [ 申请加入书架 Bookshelf ]
         │         │
         │         ├───> [ 关注作者 Follow ] ──> [ 触发 notification 发送通知 ]
         │         └───> [ 发送私信 Message ] ──> [ Messages Panel 实时双向对话 ]
         │
         └───> [ 创作面板 Write (限作者/所有者) ]
                   ├───> [ 创建小说专栏 Series ]
                   └───> [ 发布章节 Post (Markdown) ]
```

---

## 数据库架构设计 (Firestore Collections)

项目依托 Google Cloud Firestore 实现了 16 个核心高并发集合，各集合对应的数据属性如下：

1.  **`users` (用户表)**:
    *   `userId` (Firebase UID)
    *   `email` (电子邮箱)
    *   `username` (昵称)
    *   `avatar` (头像链接)
    *   `role` (角色: `reader` / `author` / `owner`)
    *   `createdAt` (注册时间)
2.  **`posts` (小说章节/文章表)**:
    *   `postId` (章节ID)
    *   `title` (标题)
    *   `content` (正文 Markdown)
    *   `authorId` (作者UID)
    *   `authorName` (作者名)
    *   `seriesId` (所属专栏ID)
    *   `seriesOrder` (章节序号/第几章)
    *   `likes` (点赞数)
    *   `likers` (点赞者UID列表)
    *   `status` (`draft`草稿 / `published`已发布)
3.  **`series` (小说连载专栏表)**:
    *   `seriesId` (专栏ID)
    *   `title` (小说名字)
    *   `description` (小说简介)
    *   `authorId` (创建作者UID)
4.  **`follows` (粉丝关注表)**:
    *   `followerId` -> `followingId` (关注与被关注的映射关系及双方昵称/头像)
5.  **`notifications` (系统与社交消息表)**:
    *   `recipientId` (接收者UID), `senderId` (发送者), `type` (`like` / `follow` / `new_post`), `body` (内容), `read` (已读/未读状态)
6.  **`messages` (实时私信表)**:
    *   `senderId`, `recipientId`, `body` (私信内容), `createdAt`, `read` (未读标志)
7.  **`reports` (敏感内容举报表)**:
    *   `postId` (被举报博文), `reporterName` (举报人), `reason` (引战/未标R18/图片违规), `status` (pending/resolved)
8.  **`author_applications` (作者资格审核表)**:
    *   `userId` (读者UID), `bio` (自述/作品大纲), `status` (pending/approved/rejected)
9.  **`user_streaks` (每日签到阅读打卡表)**:
    *   `userId`, `streakCount` (连续签到天数), `lastCheckedIn` (最后打卡日期), `history` (历史记录)
10. **`comments` (章节评论表)**:
    *   `postId`, `userId`, `username`, `content` (评论正文), `replies` (作者的二次回复数组)
11. **其他娱乐与周边数据集合**:
    *   `short_reviews` (段评/章节短评)
    *   `questions` (读者向作者提问的 Q&A 板块)
    *   `story_bounties` (读者发布的“故事悬赏令”，作者可接单认领创作)
    *   `cp_polls` (同人/角色月度 CP 投票大决战)
    *   `announcements` (系统公告)

---

## 离线数据缓存设计 (Offline-First)

考虑到移动端用户可能会在电梯、地铁等弱网或无网环境下使用，本项目引入了高可用的**离线优先**技术：
1.  **静默账户同步**: 用户登录后，其账户状态及角色信息通过 `safeLocalStorage` 自动被持久化在 WebView 沙盒中。再次启动即使没有网络，应用也能瞬间呈现已登录的骨架屏页面。
2.  **网络感知导航**: 全局状态监听 `navigator.onLine`。当网络中断时，应用右上角和底部会通过带有缓动动画的浮窗提醒用户当前处于“离线模式”，并将数据提交功能进行置灰，防止用户操作丢失。
3.  **异常平稳拦截**: 任何未联网的 Firestore 提交均通过 `safeStorage` 离线缓冲，或者在重试失败后通过 `handleFirestoreError` 输出清晰的用户交互提示，绝不卡死。

---

## Android APK 离线打包完全指南 (重要)

请将此部分复制并提供给拥有本地 Android 编译环境的 AI 助手或电脑终端。在具备 JDK 17 和 Android SDK 驱动的电脑上，只需通过以下几步，就能将该项目的代码 100% 成功编译出原生的 `.apk` 安装包。

### 1. 准备环境 (在打包电脑上)
1.  **安装 Node.js** (推荐 v18 或 v20 LTS 版本)。
2.  **安装 Java 开发工具包 (JDK)**: 必须安装 **JDK 17** (因为 Capacitor v8 和最新的 Gradle 8+ 强依赖于 JDK 17)。
    *   配置系统环境变量 `JAVA_HOME` 指向 JDK 17 安装路径。
    *   将 `JAVA_HOME/bin` 加到系统的 `PATH` 变量中。
3.  **安装 Android Studio**:
    *   在 Android Studio 的 **SDK Manager** 中，下载 Android SDK (建议 API 33, 34 或更高)。
    *   下载并配置好 **Command-line Tools** 以及 **CMake**。
    *   配置环境变量 `ANDROID_HOME` 指向 Android SDK 的安装路径。

### 2. 本地拉取代码与安装依赖
解压或从 GitHub 克隆项目代码到本地，打开终端（Terminal）执行：
```bash
# 1. 安装全部必要的 NPM 依赖
npm install

# 2. 对前端 React + Vite 代码进行编译，生成纯静态网页资源
# 这会在根目录下产生一个 /dist 文件夹（内含 index.html, JS、CSS 资源以及 PWA 资源）
npm run build
```

### 3. 同步网页资源至原生 Android 壳子
通过 Capacitor 命令行，将刚编译出的 `dist` 网页内容复制、覆盖并同步到原生安卓工程中：
```bash
# 3. 同步资源并重新注册 Android 依赖插件
npx cap sync
```

### 4. 权限检查与配置 (可选)
如果需要自定义应用图标、启动图，或者打包时自定义原生权限，可分别定位到：
*   **Android App 主入口配置**: `android/app/src/main/AndroidManifest.xml` (已配置好网络、文件等基础权限)。
*   **应用图标路径**: `android/app/src/main/res/` 目录下各 `mipmap` 文件夹内。
*   **Capacitor 配置文件**: 根目录 `capacitor.config.ts` 中的 `appName` 可以修改打包出来后在手机桌面上显示的 App 名字。

### 5. 执行编译打包生成 APK

#### 方式一：命令行极速打包 (推荐)
直接在终端中运行以下命令。如果您的 Windows / macOS 系统已配置好 `JAVA_HOME` 和 Android 环境变量，它会自动拉起本地 Gradle 构建：

*   **给 Gradle 脚本赋予执行权限** (仅 macOS / Linux 用户需要，Windows 用户跳过此步):
    ```bash
    chmod +x ./android/gradlew
    ```
*   **编译 Debug (调试) 版 APK**:
    ```bash
    npx cap build android --androidreleasetype=APK
    ```
    构建成功后，控制台会输出 APK 文件存储路径。通常它会被保存在：
    `android/app/build/outputs/apk/debug/app-debug.apk`

*   **编译 Release (正式版/发布版) APK**:
    ```bash
    # 进入原生安卓子目录直接调用 Gradle 任务
    cd android
    ./gradlew assembleRelease
    ```
    生成的未签名 Release 版 APK 位于：
    `android/app/build/outputs/apk/release/app-release-unsigned.apk`
    可以使用 `keytool` 和 `apksigner` 工具进行签名即可直接在安卓手机中无缝安装！

#### 方式二：使用 Android Studio GUI 可视化打包 (最稳妥、直观)
1.  启动 **Android Studio**。
2.  选择 **Open an Existing Project** (打开已有项目)，定位到本项目的 **`/android`** 文件夹，点击打开。
3.  等待 Android Studio 自动同步并下载 Gradle 依赖依赖包 (通常需要 2~5 分钟，确保网络畅通)。
4.  在顶部导航栏中，依次点击：
    **Build** -> **Build Bundle(s) / APK(s)** -> **Build APK(s)**。
5.  Android Studio 会自动在后台进行打包。打包完成后，右下角会弹出通知气泡：
    > *APK(s) generated successfully for 1 module: ...*
6.  点击气泡中的 **locate** (定位) 链接，即可直接打开文件夹，获取生成的 `app-debug.apk` 文件！将其拷贝到手机中即可完美运行！

---

## GitHub 发布与持续集成建议

如果您打算把代码托管到 GitHub 上，不仅便于备份，还能借助 **GitHub Actions** 帮您自动打包生成 APK。

### 1. 将项目推送到您的 GitHub
在项目根目录执行：
```bash
git init
git add .
git commit -m "feat: init Secret Reading application with Capacitor config"
git branch -M main
git remote add origin YOUR_GITHUB_REPO_URL
git push -u origin main
```

### 2. (进阶) 使用 GitHub Actions 实现“提交代码自动生成 APK”
在项目根目录下，新建一个工作流配置文件：`.github/workflows/android_build.yml`，内容填入：
```yaml
name: Build Android APK

on:
  push:
    branches: [ main ]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Source Code
        uses: actions/checkout@v4

      - name: Set up JDK 17
        uses: actions/setup-java@v3
        with:
          java-version: '17'
          distribution: 'zulu'

      - name: Install Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 18

      - name: Install Dependencies
        run: npm install

      - name: Build Web Application
        run: npm run build

      - name: Capacitor Sync
        run: npx cap sync

      - name: Set Executable Gradle Permissions
        run: chmod +x android/gradlew

      - name: Build with Gradle
        run: |
          cd android
          ./gradlew assembleDebug

      - name: Upload Debug APK Artifact
        uses: actions/upload-artifact@v3
        with:
          name: secret-reading-debug-apk
          path: android/app/build/outputs/apk/debug/app-debug.apk
```
*   **效果**: 每次您在手机上对代码进行轻微调整或更新，一推送到 GitHub，GitHub 会自动花 3 分钟帮您在线打包出一个 APK，您只需用手机打开 GitHub 网页就能直接点击下载！无需任何本地电脑配置！
