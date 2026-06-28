import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { AppUser } from '../types';
import { MessageSquare, Send, Loader2, ArrowLeft, Bot, HelpCircle, User, Headphones, Check, ShieldAlert } from 'lucide-react';

interface CustomerServiceProps {
  user: AppUser | null;
  onNavigate: (route: string) => void;
  onStartChat?: (userId: string) => void;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const QUICK_QUESTIONS = [
  {
    q: "👑 站长的自定义华丽卡片在哪里设置？",
    category: "creator",
    a: "站长（以及所有创作者）的华丽专属卡片，可在「个人资料设置」中自主定义！操作步骤：点击页面右上角个人头像 -> 选择「个人资料设置」（Settings），这里不仅可以更改昵称与头像，由于您拥有站长/作者身份，页面将专属渲染出「创作者连载声明 / 个人名录说明」文本框。在此输入的介绍声明，将以霓虹炫光渐变、皇冠标识等超华丽特效展现在您的「主页卡片」和「创作者名录卡片」中！"
  },
  {
    q: "📝 如何申请成为专栏创作者/作者？",
    category: "creator",
    a: "如果您是普通读者，可前往「个人中心」点击右上角头像进入，随后滑动到页面最底部，即可看到「申请成为作者」版块。在此填写您的笔名、创作大纲与内容样稿并提交。系统将自动推送通知至站长后台进行专业审核，审核通过后您即可获得专属创作发文权限、定时发布、以及高质感的创作者卡片！"
  },
  {
    q: "📅 如何每日打卡与获得福利？",
    category: "features",
    a: "您可以在「个人中心」点击「每日打卡」按钮。连续打卡可以累积天数并解锁专栏专属徽章（如：初级书虫、狂热书圣、同人真爱粉等），彰显您的尊贵阅读身份，徽章会同步在全网评论区、卡片中炫酷展示。"
  },
  {
    q: "⏳ 置顶功能和定时发布如何使用？",
    category: "creator",
    a: "当您晋升为签约作家、VIP作家或站长（Owner）后，在发布博文的侧边栏中将自动解锁「高级发布与文章管理」选项。您可以在此配置未来日期的定时公开，或者选择在个人主页置顶显示该博文。如果您是创办者，将无限制自动拥有全部高级管理权限。"
  },
  {
    q: "💑 如何玩转 CP 投票与配对粉丝乱斗？",
    category: "features",
    a: "站长与作者可在主页 or 管理区发布「CP 配对投票主题」（例如同人配对投票）。所有读者均可前往主页「CP投票专区」，点击心仪配对直接进行投票，并可实时查看到由 Recharts 渲染的精美票数占比柱状图/饼图，体验热烈的互动氛围！"
  },
  {
    q: "💰 如何发布和认领小说悬赏任务？",
    category: "features",
    a: "专栏创作者可以发起「剧情续写悬赏」（附带积分/奖励）。普通读者可点击主页的「悬赏大厅」查看当前任务，点击「认领悬赏」提交您创作的小说链接和投稿宣言。一经创作者确认采纳，即视为成功认领并全网公告！"
  }
];

export default function CustomerService({ user, onNavigate, onStartChat }: CustomerServiceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: '您好！我是《私密阅读专栏》平台的 AI 智能客服。有什么我可以帮您的吗？您也可以点击下方的常见问题快速获取解答。',
      timestamp: new Date()
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [transferredToHuman, setTransferredToHuman] = useState(false);
  const [ownerInfo, setOwnerInfo] = useState<{ uid: string; username: string; avatar: string } | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [helpCategory, setHelpCategory] = useState<'all' | 'features' | 'creator'>('all');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Fetch Owner / Founder details from database on load
  useEffect(() => {
    const fetchOwner = async () => {
      try {
        const q = query(collection(db, 'users'), where('role', '==', 'owner'));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const ownerDoc = querySnapshot.docs[0];
          const data = ownerDoc.data();
          setOwnerInfo({
            uid: ownerDoc.id,
            username: data.username || 'zhoyilee',
            avatar: data.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'
          });
        } else {
          // Query by email zhoyilee@gmail.com
          const q2 = query(collection(db, 'users'), where('email', '==', 'zhoyilee@gmail.com'));
          const querySnapshot2 = await getDocs(q2);
          if (!querySnapshot2.empty) {
            const ownerDoc = querySnapshot2.docs[0];
            const data = ownerDoc.data();
            setOwnerInfo({
              uid: ownerDoc.id,
              username: data.username || 'zhoyilee',
              avatar: data.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'
            });
          } else {
            // Sensible fallback
            setOwnerInfo({
              uid: 'mock-owner-uid',
              username: '平台创办者 (zhoyilee)',
              avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'
            });
          }
        }
      } catch (err) {
        console.error("Error fetching owner details:", err);
      }
    };
    fetchOwner();
  }, []);

  const triggerToast = (type: 'success' | 'error' | 'info', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4000);
  };

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || !user) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: textToSend.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);

    try {
      // Gather chat history to pass to Gemini API
      const history = [...messages, userMsg].map(m => ({
        role: m.role,
        content: m.content
      }));

      const res = await fetch('/api/customer-service/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ messages: history })
      });

      if (!res.ok) {
        throw new Error('API request failed');
      }

      const data = await res.json();
      const botText = data.text;

      setIsTyping(false);

      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        role: 'assistant',
        content: botText.replace('[TRANS_TO_HUMAN]', ''),
        timestamp: new Date()
      };

      setMessages(prev => [...prev, botMsg]);

      // Check for human transfer trigger
      if (botText.includes('[TRANS_TO_HUMAN]') && !transferredToHuman) {
        await executeHumanTransfer(userMsg.content, botMsg.content);
      }
    } catch (error) {
      console.error("Chat error:", error);
      setIsTyping(false);
      setMessages(prev => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: '抱歉，智能客服通道出现网络抖动。您可以直接前往「私人来信」给我们的创办者（站长 zhoyilee@gmail.com）发信进行人工处理。',
          timestamp: new Date()
        }
      ]);
    }
  };

  // Automated PM transfer to the founder
  const executeHumanTransfer = async (lastUserQ: string, lastBotA: string) => {
    if (!user || !ownerInfo) return;
    setTransferredToHuman(true);

    try {
      // 1. Send automatic Direct Message to the founder
      const pmBody = `【智能客服系统自动转办】
你好创办者，用户在与智能客服沟通时触发了转人工机制。

【用户详情】：
- 昵称: ${user.username}
- 邮箱: ${user.email}
- 注册时间: ${user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '未知'}

【触发转人工提问】：
「${lastUserQ}」

【客服最后解答】：
「${lastBotA}」`;

      await addDoc(collection(db, 'messages'), {
        senderId: user.firebaseUid,
        senderName: user.username,
        senderAvatar: user.avatar || '',
        recipientId: ownerInfo.uid,
        recipientName: ownerInfo.username,
        recipientAvatar: ownerInfo.avatar,
        body: pmBody,
        createdAt: new Date().toISOString(),
        read: false,
        isSilent: false
      });

      // 2. Create notification for the founder
      await addDoc(collection(db, 'notifications'), {
        recipientId: ownerInfo.uid,
        senderId: user.firebaseUid,
        senderName: user.username,
        senderAvatar: user.avatar || '',
        type: 'system',
        title: '收到智能客服转人工来信申请',
        body: `用户「${user.username}」在智能客服提问时，系统已自动为您生成私信工单。`,
        createdAt: new Date().toISOString(),
        read: false
      });

      triggerToast('success', "已为您成功建立人工客服来信！系统已将您的诉求与记录发送给平台创办者。");
    } catch (err) {
      console.error("Failed to execute transfer to human:", err);
      triggerToast('error', "自动转办人工私信时出错，请手动给站长发信。");
    }
  };

  const handleQuickQuestionClick = (q: string, a: string) => {
    setMessages(prev => [
      ...prev,
      {
        id: `user-q-${Date.now()}`,
        role: 'user',
        content: q,
        timestamp: new Date()
      },
      {
        id: `bot-a-${Date.now()}`,
        role: 'assistant',
        content: a,
        timestamp: new Date()
      }
    ]);
  };

  const handleGoToPM = () => {
    if (ownerInfo && onStartChat) {
      onStartChat(ownerInfo.uid);
      onNavigate('messages');
    } else {
      onNavigate('messages');
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col h-[calc(100vh-140px)]" id="customer-service-container">
      {/* Toast Alert */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-3 bg-zinc-900 text-white rounded-2xl shadow-xl text-xs font-bold animate-fade-in border border-white/10">
          {toast.type === 'success' ? <Check className="h-4.5 w-4.5 text-emerald-400" /> : <ShieldAlert className="h-4.5 w-4.5 text-rose-400" />}
          <span>{toast.text}</span>
        </div>
      )}

      {/* Header Block */}
      <div className="bg-white p-5 rounded-t-3xl border-t border-x border-gray-150/60 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('home')}
            className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-50 rounded-xl transition-all cursor-pointer"
            title="返回首页"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold tracking-wider shadow-sm shadow-indigo-600/20">
              <Headphones className="h-5 w-5" />
            </div>
            <div className="text-left">
              <h1 className="font-display font-extrabold text-sm text-gray-900 tracking-tight leading-none">
                智能客服中心
              </h1>
              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 font-bold mt-1.5 uppercase tracking-wider">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                AI 助理在线中
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={handleGoToPM}
          className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <MessageSquare className="h-3.5 w-3.5" />
          <span>直接联系创办者</span>
        </button>
      </div>

      {/* Main Chat Interface */}
      <div className="flex-1 bg-zinc-50/55 border-x border-b border-gray-150/60 flex flex-col md:flex-row overflow-hidden rounded-b-3xl shadow-xs">
        {/* Helper suggestions sidebar (Desktop) */}
        <div className="hidden md:flex w-72 border-r border-gray-100 p-5 bg-white flex-col gap-4 shrink-0 text-left">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-zinc-800 font-bold text-xs">
              <HelpCircle className="h-4 w-4 text-indigo-500" />
              <span>自助操作与使用指南</span>
            </div>
            <p className="text-[10px] text-gray-400">点击下方选项，AI 助理会自动回复您对应功能的使用方法</p>
          </div>

          {/* Help Category Selector */}
          <div className="grid grid-cols-3 gap-1 p-1 bg-gray-100/75 rounded-xl text-[10px] font-bold border border-gray-150/20 shrink-0">
            <button
              onClick={() => setHelpCategory('all')}
              className={`py-1.5 rounded-lg transition-all cursor-pointer text-center ${
                helpCategory === 'all' ? 'bg-white shadow-2xs text-indigo-600' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              全部
            </button>
            <button
              onClick={() => setHelpCategory('features')}
              className={`py-1.5 rounded-lg transition-all cursor-pointer text-center ${
                helpCategory === 'features' ? 'bg-white shadow-2xs text-indigo-600' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              平台玩法
            </button>
            <button
              onClick={() => setHelpCategory('creator')}
              className={`py-1.5 rounded-lg transition-all cursor-pointer text-center ${
                helpCategory === 'creator' ? 'bg-white shadow-2xs text-indigo-600' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              创作者
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 scrollbar-thin">
            {QUICK_QUESTIONS.filter(item => helpCategory === 'all' || item.category === helpCategory).map((item, idx) => (
              <button
                key={idx}
                onClick={() => handleQuickQuestionClick(item.q, item.a)}
                className="w-full text-left p-3 rounded-xl border border-gray-100 bg-gray-50/30 hover:border-indigo-100 hover:bg-indigo-50/15 hover:shadow-3xs text-[11px] text-gray-700 font-semibold transition-all leading-relaxed cursor-pointer block"
              >
                {item.q}
              </button>
            ))}
          </div>
        </div>

        {/* Conversation Thread */}
        <div className="flex-1 flex flex-col h-full bg-zinc-50/35 overflow-hidden">
          {/* Messages scroll area */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-thin">
            {/* Quick Helper for Mobile */}
            <div className="block md:hidden bg-indigo-50/30 p-4 rounded-2xl border border-indigo-100/30 text-left space-y-3">
              <div className="space-y-1">
                <h4 className="text-[10px] font-extrabold text-indigo-700 tracking-wider uppercase flex items-center gap-1">
                  <HelpCircle className="h-3.5 w-3.5" />
                  自助功能使用说明
                </h4>
                <p className="text-[9px] text-indigo-900/60 leading-tight">点击以下操作，客服会自动为您提供官方使用教程：</p>
              </div>

              {/* Mobile filter buttons */}
              <div className="flex gap-1.5 p-1 bg-indigo-950/5 rounded-lg text-[9px] font-bold w-fit">
                <button
                  onClick={() => setHelpCategory('all')}
                  className={`px-2.5 py-1 rounded-md transition-all ${
                    helpCategory === 'all' ? 'bg-white text-indigo-700 shadow-3xs' : 'text-gray-500'
                  }`}
                >
                  全部
                </button>
                <button
                  onClick={() => setHelpCategory('features')}
                  className={`px-2.5 py-1 rounded-md transition-all ${
                    helpCategory === 'features' ? 'bg-white text-indigo-700 shadow-3xs' : 'text-gray-500'
                  }`}
                >
                  平台玩法
                </button>
                <button
                  onClick={() => setHelpCategory('creator')}
                  className={`px-2.5 py-1 rounded-md transition-all ${
                    helpCategory === 'creator' ? 'bg-white text-indigo-700 shadow-3xs' : 'text-gray-500'
                  }`}
                >
                  创作者
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {QUICK_QUESTIONS.filter(item => helpCategory === 'all' || item.category === helpCategory).map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleQuickQuestionClick(item.q, item.a)}
                    className="px-2.5 py-1 bg-white hover:bg-indigo-50 text-[10px] text-gray-600 font-bold rounded-lg border border-gray-100 transition-all cursor-pointer"
                  >
                    {item.q}
                  </button>
                ))}
              </div>
            </div>

            {messages.map((msg) => {
              const isBot = msg.role === 'assistant';
              return (
                <div key={msg.id} className={`flex items-start gap-2.5 ${isBot ? 'justify-start text-left' : 'justify-end text-right'}`}>
                  {isBot && (
                    <div className="h-8 w-8 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                      <Bot className="h-4.5 w-4.5" />
                    </div>
                  )}

                  <div className={`max-w-[75%] space-y-1`}>
                    <div className={`p-3.5 rounded-2xl text-xs font-medium leading-relaxed break-words text-left ${
                      isBot 
                        ? 'bg-white border border-gray-100 text-gray-800 rounded-tl-none' 
                        : 'bg-indigo-600 text-white rounded-tr-none'
                    }`}>
                      {msg.content}
                    </div>
                    <span className="block text-[9px] text-gray-400 font-mono">
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {!isBot && (
                    <img
                      src={user?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'}
                      alt={user?.username}
                      className="h-8 w-8 rounded-full object-cover shrink-0 border border-gray-150"
                    />
                  )}
                </div>
              );
            })}

            {isTyping && (
              <div className="flex items-start gap-2.5 justify-start text-left">
                <div className="h-8 w-8 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                  <Bot className="h-4.5 w-4.5" />
                </div>
                <div className="p-3.5 bg-white border border-gray-100 rounded-2xl rounded-tl-none text-xs text-gray-400 flex items-center gap-1.5 font-semibold">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-600" />
                  <span>智能客服正在输入...</span>
                </div>
              </div>
            )}

            {/* Human pm redirection panel when transferred */}
            {transferredToHuman && (
              <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-left space-y-3 animate-fade-in">
                <div className="flex items-start gap-2.5 text-emerald-800">
                  <Check className="h-4.5 w-4.5 shrink-0 text-emerald-600 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-emerald-950">系统已自动为您发起转人工私信工单！</h4>
                    <p className="text-[11px] text-emerald-700 font-medium leading-relaxed mt-1">
                      由于涉及高级账户操作或敏感权限，AI 智能客服无法完全解决。
                      我们已自动向专栏创办者（站长 zhoyilee@gmail.com）发起了一封工单信件，附带您最近的聊天上下文记录。
                    </p>
                  </div>
                </div>
                <div className="pt-1.5 flex justify-end">
                  <button
                    onClick={handleGoToPM}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-bold transition-all shadow-sm flex items-center gap-1 cursor-pointer"
                  >
                    <span>立刻前往「私人来信」与创办者私聊</span>
                    <ArrowLeft className="h-3 w-3 rotate-180" />
                  </button>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Chat input box */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage(inputText);
            }}
            className="p-4 bg-white border-t border-gray-100 flex items-center gap-2"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="请输入您在使用平台中遇到的问题..."
              disabled={isTyping}
              className="flex-grow bg-gray-50 border border-gray-150 rounded-xl p-3 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-100 font-medium disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || isTyping}
              className="p-3 bg-indigo-600 hover:bg-indigo-550 disabled:bg-gray-100 disabled:text-gray-300 text-white rounded-xl transition-all cursor-pointer shrink-0 shadow-sm"
              title="发送消息"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
