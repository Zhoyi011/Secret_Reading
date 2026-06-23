import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Post, AppUser } from '../types';
import { Search, PenTool, LayoutGrid, List, Heart, Calendar, ArrowRight, User as UserIcon, BookOpen, AlertCircle, Clipboard, X } from 'lucide-react';
import { searchMatches } from '../utils/chineseConverter';
import ImageWrapper from './ImageWrapper';
import { motion, AnimatePresence } from 'motion/react';

interface HomeProps {
  user: AppUser | null;
  onNavigate: (route: string) => void;
  onSelectPost: (postId: string) => void;
}

export default function Home({ user, onNavigate, onSelectPost }: HomeProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [indexErrorLink, setIndexErrorLink] = useState<string | null>(null);
  
  // Custom dialog paste fallback stats
  const [showPasteFallback, setShowPasteFallback] = useState(false);
  const [fallbackPasteText, setFallbackPasteText] = useState('');

  const handlePasteSearch = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setSearch(text);
      }
    } catch (err) {
      console.warn('Failed to read clipboard during quick paste, showing custom helper overlay:', err);
      // Clean previous value and show fallback in-app paste modal
      setFallbackPasteText('');
      setShowPasteFallback(true);
    }
  };

  useEffect(() => {
    setLoading(true);

    const postsRef = collection(db, 'posts');
    
    // In production, we prefer using index-sorted query.
    // If index doesn't exist yet, we fall back to unsorted query and sort client-side.
    const qProper = query(
      postsRef,
      where('status', '==', 'published'),
      orderBy('createdAt', 'desc')
    );

    const qFallback = query(
      postsRef,
      where('status', '==', 'published')
    );

    let unsubscribe: () => void = () => {};

    const startListener = (useFallback: boolean) => {
      if (unsubscribe) unsubscribe();

      const qToUse = useFallback ? qFallback : qProper;

      unsubscribe = onSnapshot(qToUse, (snapshot) => {
        const loadedPosts = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Post[];

        if (useFallback) {
          // Sort client-side
          loadedPosts.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        }
        setPosts(loadedPosts);
        setLoading(false);
      }, (error) => {
        const errorStr = (error.message || String(error)).toLowerCase();
        if (!useFallback && (errorStr.includes('index') || errorStr.includes('composite') || errorStr.includes('failed-precondition'))) {
          console.warn("Home component detected missing composite index. Falling back to client-side sorting gracefully...", error);
          setIndexErrorLink(
            `https://console.firebase.google.com/v1/r/project/secret-reading/firestore/indexes?create_composite=Ckxwcm9qZWN0cy9zZWNyZXQtcmVhZGluZy9kYXRhYmFzZXMvKGRlZmF1bHQpL2NvbGxlY3Rpb25Hcm91cHMvcG9zdHMvaW5kZXhlcy9fEAEaCgoGc3RhdHVzEAEaDQoJY3JlYXRlZEF0EAIaDAoIX19uYW1lX18QAg`
          );
          startListener(true);
        } else {
          console.error("Firestore loading posts failed:", error);
          handleFirestoreError(error, OperationType.LIST, 'posts');
          setLoading(false);
        }
      });
    };

    startListener(false);

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 5) return '深夜好 🌌';
    if (hour < 12) return '早安 🌅';
    if (hour < 17) return '下午好 ☕';
    return '晚上好 🌃';
  };

  const filteredPosts = posts.filter(post => 
    searchMatches(search, post.title) ||
    searchMatches(search, post.authorName) ||
    searchMatches(search, post.content)
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {indexErrorLink && (
        <div className="mb-6 p-4 bg-amber-50 rounded-2xl border border-amber-200 shadow-sm" id="composite-index-tip">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-gray-900">⚠️ 发现数据库查询索引缺失</h4>
              <p className="text-xs text-gray-600 leading-relaxed font-sans">
                当前列表页面使用了多重条件（<code className="bg-amber-100/50 px-1 py-0.5 rounded font-bold font-mono">status</code> 筛选 与 <code className="bg-amber-100/50 px-1 py-0.5 rounded font-bold font-mono">createdAt</code> 倒序排列），这在 Firebase 中需要对应的复合索引才可运行。
                <br />
                <strong>🎉 应用程序已自动降级为“本地备用排序模式”，服务当前完全正常！</strong>但如需更完美地优化生产级性能：
              </p>
              <div className="pt-2">
                <a
                  href={indexErrorLink}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-[10px] transition-colors cursor-pointer"
                >
                  ⚡ 一键点此在您的 Firebase Console 自动创建此索引
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Greetings area */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 bg-gradient-to-r from-indigo-50/60 to-purple-50/20 p-6 rounded-2xl border border-indigo-100/30">
        <div>
          <h2 className="font-display text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            {getGreeting()}，{user?.username || '朗读者'}
          </h2>
          <p className="text-gray-500 text-xs mt-1">
            今天也是绝佳的阅读日。让纸墨心香、真知灼见指引心灵。
          </p>
        </div>

        {user && (user.role === 'author' || user.role === 'owner') && (
          <button
            onClick={() => onNavigate('write')}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white hover:bg-indigo-500 rounded-xl text-xs font-semibold shadow-sm hover:shadow transition-all group shrink-0"
          >
            <PenTool className="h-4 w-4 group-hover:rotate-12 transition-transform" />
            开始落笔写文
          </button>
        )}
      </div>

      {/* Filter and tool headers */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="relative flex-1 max-w-md">
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
            <Search className="h-4 w-4" />
          </span>
          <input
            type="text"
            placeholder="搜索文章标题、正文、作者..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="allow-paste w-full bg-white border border-gray-200 rounded-xl py-2 pl-9 pr-20 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-sm"
          />
          <button
            onClick={handlePasteSearch}
            className="allow-paste absolute inset-y-1.5 right-1.5 px-2.5 bg-gray-50 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg text-[10px] font-semibold text-gray-400 border border-gray-150 transition-all flex items-center gap-1 cursor-pointer select-none"
            title="快捷粘贴剪贴板内容"
          >
            <Clipboard className="h-3 w-3" />
            <span>粘贴</span>
          </button>
        </div>

        <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-xl self-end sm:self-auto shadow-inner">
          <button
            onClick={() => setViewMode('grid')}
            title="网格视图"
            className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            title="列表视图"
            className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <List className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Main loading posts state */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
          <span className="text-gray-500 text-sm mt-4 font-medium">正在获取最新专栏文章...</span>
        </div>
      ) : filteredPosts.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gray-50 text-gray-400 mb-4">
            <BookOpen className="h-6 w-6" />
          </div>
          <h3 className="text-md font-bold text-gray-900 font-display">空空如也</h3>
          <p className="text-xs text-gray-500 mt-2 max-w-sm mx-auto">
            {search ? '切换另一个搜索词试试，或者暂时还没有匹配的内容。' : '当前专栏还没有发布任何公开的文章。快去写篇大作吧！'}
          </p>
          {search && (
            <button
              onClick={() => setSearch('')}
              className="mt-4 px-3 py-1.5 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg text-xs font-semibold transition-colors"
            >
              重置过滤器
            </button>
          )}
        </div>
      ) : (
        <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "space-y-4"}>
          {filteredPosts.map((post) => {
            const hasCover = post.images && post.images.length > 0;
            const coverImage = hasCover ? post.images[0] : 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=800&q=80';
            const cleanSummary = post.content.replace(/[#*`_[\]()-]/g, '').slice(0, 100) + '...';

            return (
              <div
                key={post.id}
                onClick={() => onSelectPost(post.id)}
                className={`bg-white rounded-2xl overflow-hidden border border-gray-100 cursor-pointer shadow-sm hover:shadow-md transition-all duration-300 flex ${viewMode === 'grid' ? 'flex-col' : 'flex-row h-44 sm:h-40'}`}
              >
                {/* Image Section */}
                <div className={`relative overflow-hidden shrink-0 ${viewMode === 'grid' ? 'aspect-video w-full' : 'w-1/3 sm:w-1/4 h-full'}`}>
                  <ImageWrapper
                    src={coverImage}
                    alt={post.title}
                    width={500}
                    className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                    placeholderClassName="w-full h-full"
                  />
                  {post.status === 'draft' && (
                    <span className="absolute top-2 left-2 bg-yellow-400 text-yellow-950 text-[10px] px-2 py-0.5 rounded-full font-bold">
                      草稿
                    </span>
                  )}
                </div>

                {/* Content Section */}
                <div className="p-5 flex flex-col justify-between flex-grow">
                  <div className="space-y-2">
                    <h3 className="font-display font-bold text-gray-900 group-hover:text-indigo-600 transition-colors line-clamp-1 text-sm sm:text-base leading-snug">
                      {post.title}
                    </h3>
                    <p className="text-gray-500 text-xs line-clamp-2 md:line-clamp-3 leading-relaxed">
                      {cleanSummary}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-gray-50 mt-4 text-[11px] text-gray-400">
                    <div className="flex items-center gap-1.5 font-medium text-gray-600">
                      <UserIcon className="h-3 w-3 text-indigo-500" />
                      <span>{post.authorName}</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1 hover:text-red-500 transition-colors">
                        <Heart className="h-3 w-3 fill-red-500 text-red-500" />
                        {post.likes || 0}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(post.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Fallback Paste Modal */}
      <AnimatePresence>
        {showPasteFallback && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
            onClick={() => setShowPasteFallback(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-white rounded-2xl p-6 max-w-sm w-full border border-gray-100 shadow-2xl space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                    <Clipboard className="h-4 w-4" />
                  </div>
                  <h3 className="text-sm font-bold text-gray-900">安全快捷粘贴</h3>
                </div>
                <button
                  onClick={() => setShowPasteFallback(false)}
                  className="p-1 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-2">
                <p className="text-xs text-gray-500 leading-relaxed">
                  当前处于网页沙盒预览状态下，因浏览器的安全政策限制，我们无法直接用程序自动读取您的本地剪贴板。
                </p>
                <div className="p-2.5 bg-indigo-50/60 rounded-xl border border-indigo-100/50 text-[11px] text-indigo-800 leading-normal">
                  💡 <strong>提示：</strong>请点击下方输入框获得焦点，然后按键盘快捷键 <strong className="font-mono">Ctrl+V</strong> (或者苹果系统的 <strong className="font-mono">⌘+V</strong>) 粘贴，确认即搜索：
                </div>
              </div>

              <input
                type="text"
                autoFocus
                value={fallbackPasteText}
                onChange={(e) => setFallbackPasteText(e.target.value)}
                placeholder="在此框按 Ctrl+V 粘贴..."
                className="allow-paste allow-right-click w-full bg-gray-50 border border-gray-205 rounded-xl py-2.5 px-3.5 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all font-sans font-medium"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setSearch(fallbackPasteText);
                    setShowPasteFallback(false);
                  }
                }}
              />

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPasteFallback(false)}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold text-gray-500 hover:bg-gray-100 border border-transparent transition-colors cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="button"
                  disabled={!fallbackPasteText.trim()}
                  onClick={() => {
                    setSearch(fallbackPasteText);
                    setShowPasteFallback(false);
                  }}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:pointer-events-none transition-colors shadow-2xs cursor-pointer"
                >
                  确定并搜索
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
