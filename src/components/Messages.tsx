import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, getDocs, addDoc, onSnapshot, orderBy, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { AppUser } from '../types';
import { ArrowLeft, Loader2, Send, MessageSquare, User as UserIcon, CheckCircle2, ShieldAlert } from 'lucide-react';

interface MessagesProps {
  user: AppUser | null;
  onNavigate: (route: string) => void;
  recipientId?: string | null; // Pre-select chat recipient from other pages
}

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  recipientId: string;
  recipientName: string;
  recipientAvatar: string;
  body: string;
  createdAt: string;
  read: boolean;
}

interface ChatThread {
  otherUserId: string;
  otherUserName: string;
  otherUserAvatar: string;
  lastMessageText: string;
  lastMessageTime: string;
  unreadCount: number;
}

export default function Messages({ user, onNavigate, recipientId }: MessagesProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThreadUserId, setActiveThreadUserId] = useState<string | null>(recipientId || null);
  const [activeThreadUser, setActiveThreadUser] = useState<{ id: string; name: string; avatar: string } | null>(null);
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<AppUser[]>([]);
  const [showNewChatDropdown, setShowNewChatDropdown] = useState(false);
  const [newChatSearch, setNewChatSearch] = useState('');

  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  // 1. Fetch available users for initiating new chats
  useEffect(() => {
    const fetchUsers = async () => {
      if (!user) return;
      try {
        const usersRef = collection(db, 'users');
        const snap = await getDocs(usersRef);
        const list = snap.docs
          .map(d => d.data() as AppUser)
          .filter(u => u.firebaseUid !== user.firebaseUid);
        setAvailableUsers(list);
      } catch (err) {
        console.error("Failed to load users for messaging:", err);
      }
    };
    fetchUsers();
  }, [user]);

  // 2. Realtime listener for messages where user is sender or recipient
  useEffect(() => {
    if (!user) return;

    setLoading(true);
    const messagesRef = collection(db, 'messages');
    
    // Listen to all messages in the application and filter in memory to avoid index requirements
    const unsubscribe = onSnapshot(messagesRef, (snapshot) => {
      const allMsgs = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      })) as Message[];

      // Filter messages related to the current user
      const myMsgs = allMsgs.filter(m => m.senderId === user.firebaseUid || m.recipientId === user.firebaseUid);
      
      // Sort chronologically
      myMsgs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      
      setMessages(myMsgs);
      setLoading(false);
    }, (error) => {
      console.error("Failed to listen to messages:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // 3. Aggregate messages into chat threads
  useEffect(() => {
    if (!user || messages.length === 0) {
      setThreads([]);
      return;
    }

    const threadMap: { [key: string]: Message[] } = {};

    messages.forEach((msg) => {
      const otherId = msg.senderId === user.firebaseUid ? msg.recipientId : msg.senderId;
      if (!threadMap[otherId]) {
        threadMap[otherId] = [];
      }
      threadMap[otherId].push(msg);
    });

    const list: ChatThread[] = Object.keys(threadMap).map((otherId) => {
      const msgs = threadMap[otherId];
      const lastMsg = msgs[msgs.length - 1];
      const isSender = lastMsg.senderId === user.firebaseUid;
      
      const unreadCount = msgs.filter(m => m.recipientId === user.firebaseUid && !m.read).length;

      return {
        otherUserId: otherId,
        otherUserName: isSender ? lastMsg.recipientName : lastMsg.senderName,
        otherUserAvatar: isSender ? lastMsg.recipientAvatar : lastMsg.senderAvatar,
        lastMessageText: lastMsg.body,
        lastMessageTime: lastMsg.createdAt,
        unreadCount
      };
    });

    // Sort threads by latest message time
    list.sort((a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime());
    setThreads(list);

    // If pre-selected recipient is defined but not in the thread list, load their detail
    if (activeThreadUserId && !activeThreadUser) {
      const matchedThread = list.find(t => t.otherUserId === activeThreadUserId);
      if (matchedThread) {
        setActiveThreadUser({
          id: matchedThread.otherUserId,
          name: matchedThread.otherUserName,
          avatar: matchedThread.otherUserAvatar
        });
      } else {
        // Fetch custom user profile info from firestore
        const fetchTargetUser = async () => {
          try {
            const userSnap = await getDoc(doc(db, 'users', activeThreadUserId));
            if (userSnap.exists()) {
              const uData = userSnap.data() as AppUser;
              setActiveThreadUser({
                id: uData.firebaseUid,
                name: uData.username,
                avatar: uData.avatar || ''
              });
            }
          } catch (e) {
            console.error("Failed to load chat target info:", e);
          }
        };
        fetchTargetUser();
      }
    }
  }, [messages, activeThreadUserId, user]);

  // Mark active chat messages as Read
  useEffect(() => {
    if (!user || !activeThreadUserId) return;

    const unreadMsgs = messages.filter(
      m => m.senderId === activeThreadUserId && m.recipientId === user.firebaseUid && !m.read
    );

    if (unreadMsgs.length > 0) {
      unreadMsgs.forEach(async (msg) => {
        try {
          await updateDoc(doc(db, 'messages', msg.id), { read: true });
        } catch (e) {
          console.error("Failed to mark message as read:", e);
        }
      });
    }

    // Scroll to bottom
    setTimeout(() => {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }, [activeThreadUserId, messages, user]);

  const handleSelectThread = (thread: ChatThread) => {
    setActiveThreadUserId(thread.otherUserId);
    setActiveThreadUser({
      id: thread.otherUserId,
      name: thread.otherUserName,
      avatar: thread.otherUserAvatar
    });
  };

  const handleStartChatWithUser = (target: AppUser) => {
    setActiveThreadUserId(target.firebaseUid);
    setActiveThreadUser({
      id: target.firebaseUid,
      name: target.username,
      avatar: target.avatar || ''
    });
    setShowNewChatDropdown(false);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeThreadUser || !text.trim() || isSending) return;

    setIsSending(true);
    try {
      const payload = {
        senderId: user.firebaseUid,
        senderName: user.username,
        senderAvatar: user.avatar || '',
        recipientId: activeThreadUser.id,
        recipientName: activeThreadUser.name,
        recipientAvatar: activeThreadUser.avatar,
        body: text.trim(),
        createdAt: new Date().toISOString(),
        read: false
      };

      await addDoc(collection(db, 'messages'), payload);
      setText('');
      
      // Also write secondary push notification to receiver
      try {
        await addDoc(collection(db, 'notifications'), {
          recipientId: activeThreadUser.id,
          senderId: user.firebaseUid,
          senderName: user.username,
          senderAvatar: user.avatar || '',
          type: 'private_message',
          title: '收到新的私人来信',
          body: `用户「${user.username}」给您发了一条私信: "${payload.body.slice(0, 30)}..."`,
          read: false,
          createdAt: new Date().toISOString()
        });
      } catch (_) {}

    } catch (err) {
      console.error("Failed to send message:", err);
      alert("发送失败，请稍后重试");
    } finally {
      setIsSending(false);
    }
  };

  const activeMessages = messages.filter(
    m => (m.senderId === user?.firebaseUid && m.recipientId === activeThreadUserId) ||
         (m.senderId === activeThreadUserId && m.recipientId === user?.firebaseUid)
  );

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 text-left animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('home')}
            className="p-2 rounded-lg bg-white border border-gray-100 text-gray-500 hover:text-gray-700 transition-colors shadow-sm cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-2xl font-bold font-display text-gray-900 flex items-center gap-2">
              <MessageSquare className="h-6 w-6 text-indigo-600" />
              我的私人来信
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              与喜爱的博主或热心读者畅快倾谈，尊重交流，收获友谊。
            </p>
          </div>
        </div>

        {/* Start New Chat Button */}
        <div className="relative animate-fade-in">
          <button
            onClick={() => {
              setShowNewChatDropdown(!showNewChatDropdown);
              setNewChatSearch('');
            }}
            className="px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-500 rounded-xl text-xs font-semibold shadow-2xs hover:shadow transition-all cursor-pointer"
          >
            发起新私信 +
          </button>

          {showNewChatDropdown && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setShowNewChatDropdown(false)} />
              <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl border border-gray-100 shadow-xl z-40 p-3 space-y-2.5 flex flex-col text-left">
                <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider font-sans">
                  搜索收信人 (请输入用户名或邮箱)
                </span>
                
                <input
                  type="text"
                  autoFocus
                  placeholder="输入关键字搜索..."
                  value={newChatSearch}
                  onChange={(e) => setNewChatSearch(e.target.value)}
                  className="allow-paste w-full bg-gray-50 border border-gray-200 rounded-lg py-1.5 px-2.5 text-xs text-gray-850 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />

                <div className="max-h-56 overflow-y-auto divide-y divide-gray-50/50">
                  {!newChatSearch.trim() ? (
                    <div className="py-6 text-center text-xs text-gray-400 italic">
                      请输入对方名称进行精确搜索 🔍
                    </div>
                  ) : (() => {
                    const matched = availableUsers.filter(u => 
                      u.username.toLowerCase().includes(newChatSearch.toLowerCase()) ||
                      u.email.toLowerCase().includes(newChatSearch.toLowerCase())
                    );
                    if (matched.length === 0) {
                      return (
                        <div className="py-6 text-center text-xs text-rose-500 font-medium">
                          未找到匹配的用户 ❌
                        </div>
                      );
                    }
                    return matched.map((u) => (
                      <button
                        key={u.firebaseUid}
                        onClick={() => {
                          handleStartChatWithUser(u);
                          setShowNewChatDropdown(false);
                        }}
                        className="w-full flex items-center gap-2.5 py-2 px-1 rounded-xl hover:bg-gray-50 transition-colors text-left text-xs text-gray-850 cursor-pointer"
                      >
                        <img
                          src={u.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'}
                          alt={u.username}
                          className="h-7 w-7 rounded-full object-cover border border-gray-100 shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <span className="font-bold block truncate text-xs text-gray-900">{u.username}</span>
                          <span className="text-[9px] text-gray-400 block truncate font-mono">{u.email}</span>
                        </div>
                      </button>
                    ));
                  })()}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden grid grid-cols-1 md:grid-cols-3 h-[580px]">
        {/* Left pane: Threads list */}
        <div className="border-r border-gray-100 flex flex-col h-full bg-zinc-50/20">
          <div className="p-4 border-b border-gray-100 bg-white">
            <h3 className="text-xs font-bold text-gray-900 tracking-wider uppercase font-display">会话列表</h3>
          </div>

          <div className="overflow-y-auto flex-1 divide-y divide-gray-50">
            {loading ? (
              <div className="py-12 text-center">
                <Loader2 className="h-6 w-6 animate-spin text-indigo-600 mx-auto" />
                <span className="text-[11px] text-gray-400 mt-2 font-medium block">加载中...</span>
              </div>
            ) : threads.length === 0 ? (
              <div className="py-16 text-center text-gray-400">
                <MessageSquare className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-xs font-semibold">暂无私信记录</p>
                <p className="text-[10px] text-gray-300 mt-1">右上角发起一封信给对方吧！</p>
              </div>
            ) : (
              threads.map((thread) => {
                const isActive = thread.otherUserId === activeThreadUserId;
                return (
                  <div
                    key={thread.otherUserId}
                    onClick={() => handleSelectThread(thread)}
                    className={`p-3.5 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                      isActive ? 'bg-indigo-50/40 border-l-3 border-indigo-600' : 'hover:bg-gray-50/50 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <img
                        src={thread.otherUserAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'}
                        alt={thread.otherUserName}
                        className="h-9 w-9 rounded-full object-cover border border-gray-100 shrink-0"
                      />
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-bold text-xs text-gray-900 truncate">
                            {thread.otherUserName}
                          </span>
                          <span className="text-[9px] text-gray-400 font-medium shrink-0 font-mono">
                            {new Date(thread.lastMessageTime).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-500 truncate font-medium">
                          {thread.lastMessageText}
                        </p>
                      </div>
                    </div>

                    {thread.unreadCount > 0 && (
                      <span className="bg-rose-600 text-white text-[9px] font-bold rounded-full h-4 min-w-4 px-1 flex items-center justify-center shrink-0">
                        {thread.unreadCount}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right pane: Chat dialog */}
        <div className="md:col-span-2 flex flex-col h-full bg-white relative">
          {activeThreadUser ? (
            <>
              {/* Active Header */}
              <div className="p-4 border-b border-gray-100 flex items-center gap-3 bg-zinc-50/10">
                <img
                  src={activeThreadUser.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'}
                  alt={activeThreadUser.name}
                  className="h-9 w-9 rounded-full object-cover border border-gray-100 shrink-0"
                />
                <div>
                  <h4 className="font-bold text-xs text-gray-900 font-display">{activeThreadUser.name}</h4>
                  <span className="text-[9.5px] text-gray-400 font-medium">私密加密会话线路连接良好</span>
                </div>
              </div>

              {/* Chat timeline */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-gray-50/50 scrollbar-thin">
                {activeMessages.length === 0 ? (
                  <div className="text-center py-20 text-gray-400">
                    <MessageSquare className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-xs">与 {activeThreadUser.name} 开始了第一条私信。</p>
                    <p className="text-[10px] text-gray-300 mt-1">发个友好的招呼吧！</p>
                  </div>
                ) : (
                  activeMessages.map((msg) => {
                    const isMyMsg = msg.senderId === user?.firebaseUid;
                    return (
                      <div
                        key={msg.id}
                        className={`flex gap-3 max-w-[85%] ${isMyMsg ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
                      >
                        <img
                          src={msg.senderAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'}
                          alt={msg.senderName}
                          className="h-7 w-7 rounded-full object-cover border border-gray-100 shrink-0"
                        />
                        <div className="space-y-1">
                          <div className={`p-3 rounded-2xl text-xs font-semibold leading-relaxed break-words shadow-3xs ${
                            isMyMsg
                              ? 'bg-indigo-600 text-white rounded-tr-none'
                              : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none'
                          }`}>
                            {msg.body}
                          </div>
                          <span className={`block text-[8px] text-gray-400 font-mono font-medium ${isMyMsg ? 'text-right' : 'text-left'}`}>
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* Chat Input panel */}
              <form onSubmit={handleSendMessage} className="p-3.5 border-t border-gray-100 bg-white flex items-center gap-2">
                <input
                  type="text"
                  required
                  placeholder={`写一封回信给 ${activeThreadUser.name}...`}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className="allow-paste flex-1 bg-gray-50 border border-gray-200 rounded-xl py-2 px-3.5 text-xs text-gray-850 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  type="submit"
                  disabled={isSending || !text.trim()}
                  className="p-2.5 bg-indigo-600 text-white hover:bg-indigo-550 rounded-xl transition-all shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer shrink-0"
                >
                  {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </form>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center text-gray-400">
              <MessageSquare className="h-10 w-10 text-gray-250 mb-3" />
              <h3 className="font-bold text-gray-700 text-sm">选择一个私人会话</h3>
              <p className="text-xs text-gray-400 mt-1 max-w-xs leading-relaxed">
                点击左侧列表里任意用户的会话卡，或通过右上角“发起新私信”来建立一个新的沟通。
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
