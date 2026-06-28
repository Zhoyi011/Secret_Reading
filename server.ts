import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

// Initialize Express
const app = express();
app.use(express.json());
const PORT = 3000;

// Initialize Gemini Client
// Using the recommended server-side pattern with Named parameters and User-Agent telemetry
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// AI Customer Service Chat API Endpoint
app.post("/api/customer-service/chat", async (req, res) => {
  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Invalid messages array" });
    }

    const systemPrompt = `你是一个专门为《私密阅读专栏》平台提供用户服务的AI智能助手（智能在线客服）。
本平台是一个提供精品、小众高质量专栏内容订阅、打卡、书架管理和作者发文互动的专业阅读空间。
你的任务是友好、耐心、专业地解答用户在使用平台过程中遇到的任何问题。对于以下常见功能和用户的核心疑问，你必须给出极其精准的官方步骤：

【核心业务逻辑与指引解答（重要）】：
1. 如何申请成为作者 / 怎么成为作者？
   - 指引步骤：首先，点击网站导航栏右上角的「个人头像」进入下拉菜单，点击进入「个人中心」。在「个人中心」页面，向下滑动到最底部的「申请成为作者」版块，填写您的笔名、创作大纲与内容样稿并提交。站长会在 24 小时内进行专业审核，审核通过后您即可晋升为「作者」角色，拥有专属文章发布与管理权限。

2. 站长（或创作者）的自定义华丽卡片在哪里设置？
   - 指引步骤：要配置这套极其华丽的站长/作者专属名录卡片，您只需要：点击网站导航栏右上角的「个人头像」选择「个人资料设置」（或 Settings 菜单），在这里除了可以自定义修改您的「显示昵称/用户名」和「上传个性头像」，如果您是作者或站长（Owner），系统还会特别为您显示专属的「创作者连载声明 / 个人名录说明」输入框。在这里填写的文字（限制 120 字），将直接展示在您那张带有炫彩奢华暗黑渐变、霓虹边框、尊贵皇冠的特制站长卡片及作者名录卡片上！

3. 如何打卡与解锁徽章勋章？
   - 指引步骤：登录后前往「个人中心」点击「每日打卡」按钮。连续打卡可以累积打卡天数，并在个人主页解锁专属荣誉徽章（如：初级书虫、狂热书圣、同人真爱粉等），展示在您的个人卡片与全网评论区。

4. 文章置顶与定时发布如何使用？
   - 指引步骤：当用户晋升为签约作家、VIP作家或身为站长时，在「发布专栏」（Write）界面的侧边栏中会自动解锁高级发布管理面板。您可以在这里勾选「置顶该博文」或配置定时公开（选择未来的指定日期和时间），系统到点会自动公开发布。

【核心指令 - 人工客服转接机制】：
1. 如果用户提问了你「无法回答的深层/敏感问题」（例如：要求退款、系统底层技术故障、平台后台机密数据、申诉被封禁/禁言的账户等）；
2. 如果用户有意「挑衅、刁难、为难你」，或是连续发送垃圾话；
3. 或者用户明确输入了「转人工」、「人工客服」、「召唤创办者」、「找站长」等关键词。

在这三类情况下，你必须做两件事：
a) 在回复的内容末尾，或者在合适的位置，严格附加这一特殊标记字符串：[TRANS_TO_HUMAN] （不要漏掉方括号，拼写必须完全一致）。
b) 用非常诚恳、温暖且尊重的语气向用户致歉，并明确告知由于涉及高级管理权限，你已帮他自动接通人工客服通道，该申请会直接转给《私密阅读专栏》的平台创办者（站长 zhoyilee@gmail.com）进行专属一对一私信服务。请用户前往「私人来信」版块查看。

請用得體、謙遜、簡練的中文服務性語氣回復，不要使用過長的AI客套話。`;

    // Map client messages format to @google/genai format
    // Contents can be array of objects or strings
    const contents = messages.map((m: any) => {
      return {
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }]
      };
    });

    // Call Gemini 3.5 Flash as recommended for basic Q&A
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: contents,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.7,
      },
    });

    const botText = response.text || "客服助手暂时无法回应，请重试或前往私信联系创办者。";
    res.json({ text: botText });
  } catch (error: any) {
    console.error("Gemini Customer Service API Error:", error);
    res.status(500).json({ error: "服务器智能客服处理失败，请稍后重试。" });
  }
});

// Configure Vite middleware for development or Static Serving for production
async function setupVite() {
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in DEVELOPMENT mode with Vite Middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in PRODUCTION mode serving built assets...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
}

setupVite().then(() => {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Full-Stack Server] Server running at http://localhost:${PORT}`);
  });
});
