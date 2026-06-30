# 📌 安卓 APK 完美还原提示词 (App Rebuild & APK Generator Master Prompt)

> 💡 **使用指南**：请将以下整个 Markdown 的内容复制，并完整提供给您的打包助理/代码生成 AI。此提示词专为高保真、99% 像素级还原“私密阅读” (Secret Reading) 的原生移动端 APP 而设计，涵盖所有样式、逻辑、交互动效、防作弊 copyright 限制、简繁字转换及管理员/审核功能。

---

```markdown
# Role: 全栈 React 19 + Capacitor v8 独立移动端 APP 开发专家

## 1. 任务背景与核心目标
请独立生成并完整实现一个名为 **“私密阅读 (Secret Reading)”** 的小说连载与社交平台，并使用 **Capacitor v8** 封装，以便打包出原生 **Android APK**。
应用需要支持移动端离线优先体验、像素级的优雅暗色/护眼高对比度 UI 设计、顺滑的手势过渡动画以及高安全性的 Firebase 后端对接。

---

## 2. 核心技术栈与底层约束
*   **前端语言与框架**: React 19 + TypeScript + Vite 6
*   **样式体系**: Tailwind CSS v4 (采用现代化变量 `@theme` 加载 Inter 和 JetBrains Mono 字体)
*   **动画过渡**: Motion (`motion/react`) 提供全套卡片浮现、抽屉滑动与模态弹窗动画
*   **图表与图标**: `lucide-react` 图标集 (禁用任何手写 SVG，保障组件整洁)
*   **混合客户端**: @capacitor/core + @capacitor/android (Capacitor v8)
*   **数据库**: Firebase 12 (Auth, Firestore 实时数据库)。网络波动时，需启用 Firestore 自动本地缓存。
*   **辅助依赖**: `opencc-js` (实现高精密简繁体中文一键全局转换)

---

## 3. 全局样式规范 & 视觉语境 (Aesthetics)
*   **配色调色盘**:
    *   主底色: 护眼级暗色板 `bg-[#0f141c]` (深邃炭蓝)，纯黑 `bg-black` 用于卡片底衬。
    *   阅读器专属: 墨绿 `bg-[#1a2421]` (茶墨护眼)，米黄 `bg-[#faf6eb]`，暗夜 `bg-[#121212]`。
    *   主色调 / 交互聚焦: 翡翠绿 `text-emerald-400` / `bg-emerald-500`。
    *   辅助文字: 钛灰 `text-slate-400`。
*   **字体配对**: 标题使用无衬线 `font-sans` (Inter) 加粗紧凑排版；正文和代码数据等显示区域使用 `font-mono` (JetBrains Mono) 增强科技感与对齐美感。
*   **滚动条隐藏**: 原生 WebView 环境下隐藏滚动条，采用顺滑惯性滚动。

---

## 4. 全局核心逻辑与安全防护机制

### 4.1 离线降级与安全存储 (safeLocalStorage)
必须封装一套 `safeStorage` 机制，在 `localStorage` 被 Android 原生容器限制时平稳降级到内存 Map，防止 App 启动抛出 `SecurityError` 并白屏：
```typescript
const isStorageAvailable = () => {
  try {
    const key = '__storage_test__';
    localStorage.setItem(key, key);
    localStorage.removeItem(key);
    return true;
  } catch (e) {
    return false;
  }
};
```

### 4.2 反版权盗用与搬运防护 (Anti-Copyright Protection)
*   **全局防右键**: 除非在创作面板或输入框内，否则全局禁用 `contextmenu` (阻止原生 Android 长按呼出剪贴板菜单)。
*   **全局防复制**: 捕获 `copy` 事件。除作者撰写编辑区域外，一律执行 `e.preventDefault()` 阻止文字被带出 App。
*   **防文本选择**: 正文阅读区域和列表，禁止通过长按手势高亮选取文本。

### 4.3 简繁体动态一键转换 (Simplified-Traditional Translation)
在全局状态机中挂载 `isTraditional` 变量。当开启时，主页、连载详情、小说阅读章节等所有中文信息利用 `opencc-js` 进行实时翻译，实现两岸三地无缝阅读。

---

## 5. 核心页面路由与布局结构 (12大模块像素级实现)

App 为单屏架构并辅以自定义 SPA 历史状态模拟。底层核心页面包含：

### 5.1 注册与登录面板 (Login & Register)
*   支持 Firebase 邮箱密码一键注册/登录。
*   注册时，在 Firestore `users` 集合中同步创建配置，根据邮箱决定角色（如超级管理员 `zhoyilee@gmail.com` 初始化为 `owner`，其余为 `reader`）。

### 5.2 读者引导页 (Onboarding)
*   新用户登录后首次进入 App 触发。可设置生日、个性签名，并选择感兴趣的小说标签。

### 5.3 首页大厅 (Home)
*   **顶部公告栏**: 自动滚屏轮播超级管理员发布的系统动态。
*   **连载小说橱窗**: 卡片式横向滑动推荐，展示封面、评分、当前字数以及连载进度。
*   **简繁体一键切换快捷挂件**: 优雅固定于屏幕边缘。

### 5.4 连载详情页 (Series Directory)
*   展示特定专栏 (Series) 的作者资料、总阅读量。
*   章节时间线瀑布流列表，显示各章节发布字数及读者互动点赞数。

### 5.5 阅读器页面 (PostDetail)
*   **专注模式 (Focus Mode)**: 启动后隐藏手机顶部状态栏、底部导航和主操作栏，全屏沉浸式阅读。
*   **阅读器设置**: 提供字体大小微调 (xs-xxl)、护眼背景色（浅米黄/茶墨绿/暗黑色）自由切换。
*   **互动区**: 集成章评（支持用户针对特定段落写短评 `short_reviews` ）、给作者提问、送出虚拟鲜花互动。

### 5.6 读者私密书架 (Bookshelf)
*   列出用户追更追读的所有书籍连载，一键移出书架，自动提示哪一本书有新章节更新。
*   支持**本地离线阅读**，无网环境下点击直接阅读已加载的章节。

### 5.7 个人中心 (Profile)
*   显示当前读者的连续阅读天数 (UserStreak)。
*   **每日打卡挂件**: 限制一天只能打卡一次，并动态显示签到日历。

### 5.8 创作者面板 (Write)
*   只限 role 为 `author` 或 `owner` 的用户访问。
*   支持在线创建新专栏 (Series)。
*   内置 Markdown 编辑器，支持拖拽、粘贴剪贴板图片快速上传并剪裁图片 (ImageCropper)。

### 5.9 实时私聊会话 (Messages)
*   基于 Firestore 实时侦听器 (`onSnapshot`)。两端读者与作者直接发起 1v1 极速聊天，支持未读小红点提醒、未读消息置顶。

### 5.10 系统举报审批与管理后台 (Admin Panel)
*   仅限 `owner` 和 `admin` 访问。
*   **作者资格申请队列**: 审批普通用户的作者申请，一键为其提升角色到 `author`。
*   **敏感违规内容审查流**: 展示全平台被读者举报的包含 R18 违规、抄袭的小说章节列表。管理员可以一键下架、封禁用户或将举报驳回。
*   **全局广播发布**: 撰写全平台可见的轮播公告。

### 5.11 系统设置与缓存管理 (Settings)
*   允许更改头像、重置密码。
*   **缓存清理挂件**: 一键擦除本地 `safeStorage` 中已下载的小说。

### 5.12 原生下载指引弹窗 (DownloadAndroidModal)
*   智能检测当前容器是否为浏览器。如果是，则展示富有交互质感的引导弹窗，提示用户下载安装独立的 APK 文件。

---

## 6. 核心数据库 Blueprint (Firestore Schema)

请在本地后端初始化并注册以下核心 Collections 结构，保障 App 的全功能对接：

```json
{
  "users": {
    "fields": {
      "userId": "string (UID)",
      "email": "string",
      "username": "string",
      "avatar": "string",
      "role": "string (reader / author / owner)",
      "birthday": "string",
      "createdAt": "timestamp"
    }
  },
  "posts": {
    "fields": {
      "postId": "string",
      "title": "string",
      "content": "string (Markdown格式正文)",
      "authorId": "string",
      "authorName": "string",
      "seriesId": "string",
      "seriesOrder": "number (章节顺序)",
      "shortId": "string (用于直接访问的分流6位短码)",
      "status": "string (draft / published)",
      "likes": "number",
      "likers": "array of string"
    }
  },
  "series": {
    "fields": {
      "seriesId": "string",
      "title": "string",
      "description": "string",
      "authorId": "string",
      "createdAt": "timestamp"
    }
  },
  "messages": {
    "fields": {
      "messageId": "string",
      "senderId": "string",
      "recipientId": "string",
      "body": "string",
      "createdAt": "timestamp",
      "read": "boolean"
    }
  },
  "reports": {
    "fields": {
      "reportId": "string",
      "postId": "string",
      "reporterName": "string",
      "reason": "string (引战/敏感/侵权)",
      "status": "string (pending / resolved)"
    }
  }
}
```

---

## 7. 打包独立 APK 的重要指导

当您重新还原并编写完毕前端代码后，请指导终端运行以下底层命令生成原生 APK 项目结构：

1.  **Vite 项目初始化 Android**:
    ```bash
    npm i @capacitor/cli @capacitor/core @capacitor/android
    npx cap init "私密阅读" "secret.reading" --web-dir=dist
    npx cap add android
    ```
2.  **构建并同步**:
    ```bash
    npm run build
    npx cap sync
    ```
3.  **使用 Gradle 进行本地终极 APK 交付**:
    ```bash
    cd android
    # 打包 debug 版本
    ./gradlew assembleDebug
    ```
```
