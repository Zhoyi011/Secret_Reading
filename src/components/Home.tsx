import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Post, AppUser } from '../types';
import { Search, PenTool, LayoutGrid, List, Heart, Calendar, User as UserIcon, BookOpen, AlertCircle, Eye, Bookmark, Tag, SlidersHorizontal, Check, X } from 'lucide-react';
import { searchMatches } from '../utils/chineseConverter';
import ImageWrapper from './ImageWrapper';
import { motion } from 'motion/react';

interface HomeProps {
  user: AppUser | null;
  onNavigate: (route: string) => void;
  onSelectPost: (postId: string) => void;
  onSelectAuthor?: (authorId: string) => void;
}

const TAG_CATEGORIES: Record<string, string[]> = {
  '内容主题': ['纯爱', '虐恋', '病娇', '黑化', '救赎', '先婚后爱', '破镜重圆', '暗恋成真', '替身文学', '强制爱', '养成系', '双向奔赴', '恨海情天', '宿命感'],
  '关系设定': ['师生', '师徒（年上）', '师徒（年下）', '上司下属', '青梅竹马', '天降', '骨科（亲）', '骨科（伪）', '宿敌', '主仆', '老板员工', '教授学生', '继亲', '叔侄', '义兄弟/义姐妹'],
  '场景风格': ['架空', '现代', '古代', '民国', '星际', '末世', '西幻', '东方玄幻', 'ABO', '哨兵向导', '穿越', '重生', '系统', '无限流', '娱乐圈', '电竞', '校园', '职场', '黑道', '悬疑'],
  '特殊属性': ['微肉', '中肉', '重肉', '纯肉', '前戏为主', '后入', '骑乘', '口交', '足交', '乳交', 'SM', '捆绑', '强制', '催眠', '触手', '兽人', '人外', '产乳', '怀孕', '双性', '扶她', '女攻男受', '男攻女受', '互攻'],
  '结局倾向': ['甜', '微虐', '大虐', '先虐后甜', '先甜后虐', '开放式结局', 'HE', 'BE', '意难平']
};

const AVAILABLE_TAGS = Object.values(TAG_CATEGORIES).flat();

type SortOption = 'latest' | 'non-r18' | 'r18' | 'following' | 'hottest' | 'likes' | 'collects';

export default function Home({ user, onNavigate, onSelectPost, onSelectAuthor }: HomeProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [indexErrorLink, setIndexErrorLink] = useState<string | null>(null);

  // Advanced features state
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showTagModal, setShowTagModal] = useState(false);
  const [tagSearchQuery, setTagSearchQuery] = useState('');
  const [activeTagTab, setActiveTagTab] = useState<string>('全部');
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>('latest');

  useEffect(() => {
    setLoading(true);

    const postsRef = collection(db, 'posts');
    
    // Proper indexed query
    const qProper = query(
      postsRef,
      where('status', '==', 'published'),
      orderBy('createdAt', 'desc')
    );

    // Unsorted fallback query
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
          // Default sorting client-side
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

  // Listen to authors followed by current user
  useEffect(() => {
    if (!user) {
      setFollowingIds([]);
      return;
    }
    const q = query(collection(db, 'follows'), where('followerId', '==', user.firebaseUid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ids = snapshot.docs.map(doc => doc.data().followingId) as string[];
      setFollowingIds(ids);
    }, (error) => {
      console.error("Failed to load following in Home:", error);
    });
    return () => unsubscribe();
  }, [user]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 5) return '深夜好 🌌';
    if (hour < 12) return '早安 🌅';
    if (hour < 17) return '下午好 ☕';
    return '晚上好 🌃';
  };

  const filterR18Active = user?.filterR18 !== false; // defaults to true

  // Apply filtering and sorting dynamically
  const filteredPosts = posts
    .filter((post) => {
      // 1. R18 level restriction
      if (filterR18Active && post.isR18) {
        return false;
      }

      // If the selected mode is "non-r18" (正常博文), we strictly filter out post.isR18
      if (sortBy === 'non-r18' && post.isR18) {
        return false;
      }

      // If the selected mode is "r18" (R18特区), we strictly filter out !post.isR18 (only show R18 posts)
      if (sortBy === 'r18' && !post.isR18) {
        return false;
      }

      // 2. Scheduled posts check (Only author or admin can view future posts before release time)
      if (post.publishAt) {
        const isFuture = new Date(post.publishAt) > new Date();
        if (isFuture) {
          const isPostAuthor = user && post.authorId === user.firebaseUid;
          const isSiteAdmin = user && user.role === 'owner';
          if (!isPostAuthor && !isSiteAdmin) {
            return false;
          }
        }
      }

      // 3. Category/Tag selection (Multi-selection intersection search)
      if (selectedTags.length > 0) {
        const matchAll = selectedTags.every((t) => post.tags && post.tags.includes(t));
        if (!matchAll) return false;
      }

      // 4. Input search query
      return (
        searchMatches(search, post.title) ||
        searchMatches(search, post.authorName) ||
        searchMatches(search, post.content) ||
        (post.tags && post.tags.some(t => searchMatches(search, t)))
      );
    })
    .sort((a, b) => {
      // Followed authors priority sort
      if (sortBy === 'following') {
        const aFollowed = followingIds.includes(a.authorId) ? 1 : 0;
        const bFollowed = followingIds.includes(b.authorId) ? 1 : 0;
        if (aFollowed !== bFollowed) {
          return bFollowed - aFollowed;
        }
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      }

      // Apply multi-sort rules dynamically on the client side
      if (sortBy === 'hottest') {
        return (b.views || 0) - (a.views || 0);
      }
      if (sortBy === 'likes') {
        return (b.likes || 0) - (a.likes || 0);
      }
      if (sortBy === 'collects') {
        return (b.collects || 0) - (a.collects || 0);
      }
      // Fallback/Default latest
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 text-left animate-fade-in">
      {indexErrorLink && (
        <div className="mb-6 p-4 bg-amber-50 rounded-2xl border border-amber-200 shadow-sm" id="composite-index-tip">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-gray-900 font-display">发现索引降级处理中</h4>
              <p className="text-xs text-gray-600 leading-relaxed font-sans">
                应用当前已自动降级为“本地多维组合排序算法”，完全不影响正常业务的使用。您也可以一键点此在您的 Firebase Console 生成此复合索引。
              </p>
              <div className="pt-1.5">
                <a
                  href={indexErrorLink}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-[10px] transition-colors cursor-pointer"
                >
                  ⚡ 点击创建复合索引
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
          <p className="text-gray-500 text-xs mt-1 leading-normal">
            今天也是绝佳的阅读日。让纸墨心香、同人与真知灼见治愈和指引心灵。
          </p>
        </div>

        {user && (user.role === 'author' || user.role === 'owner') && (
          <button
            onClick={() => onNavigate('write')}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white hover:bg-indigo-500 rounded-xl text-xs font-semibold shadow-sm hover:shadow transition-all group shrink-0 cursor-pointer"
          >
            <PenTool className="h-4 w-4 group-hover:rotate-12 transition-transform" />
            开始落笔写文
          </button>
        )}
      </div>

      {/* Category Tags selection bar */}
      <div className="mb-8 bg-white p-5 rounded-2xl border border-gray-100 shadow-2xs space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-indigo-500" />
            <span className="text-xs font-bold text-gray-900 font-display">多维标签筛选</span>
          </div>
          {selectedTags.length > 0 && (
            <button
              onClick={() => setSelectedTags([])}
              className="text-[10px] font-bold text-indigo-600 hover:text-indigo-500 hover:underline cursor-pointer"
            >
              清除全部已选 ({selectedTags.length})
            </button>
          )}
        </div>

        {selectedTags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 p-3 bg-gray-50/50 rounded-xl border border-gray-100">
            {selectedTags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-100/60 animate-in fade-in zoom-in-95 duration-100"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => setSelectedTags(prev => prev.filter(t => t !== tag))}
                  className="p-0.5 hover:bg-indigo-100 text-indigo-500 hover:text-indigo-800 rounded-md transition-colors cursor-pointer"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        ) : (
          <div className="text-center py-4 bg-gray-50/50 border border-dashed border-gray-250 rounded-xl">
            <span className="text-[11px] text-gray-400 font-medium">💡 当前未应用任何标签筛选，点击下方按钮开始多维过滤</span>
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            setTagSearchQuery('');
            setActiveTagTab('全部');
            setShowTagModal(true);
          }}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 px-4 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 hover:text-indigo-700 rounded-xl text-xs font-bold transition-all border border-indigo-100/55 cursor-pointer shadow-3xs"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          选择多维筛选标签 ({selectedTags.length > 0 ? `已选 ${selectedTags.length} 个` : '点击选择题材设定'})
        </button>
      </div>

      {/* Search and sort toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 bg-white p-4 rounded-2xl border border-gray-100 shadow-2xs">
        <div className="relative flex-1 max-w-md">
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
            <Search className="h-4 w-4" />
          </span>
          <input
            type="text"
            placeholder="搜索博文标题、正文、作者、标签..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="allow-paste w-full bg-gray-50/50 border border-gray-200 rounded-xl py-2 pl-9 pr-3 text-xs text-gray-850 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Multi-Sorting dropdown options */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-gray-400 font-sans uppercase">排序与过滤:</span>
            <select
              id="sorting-and-filtering-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="rounded-lg border border-gray-200 py-1.5 px-2 text-xs text-gray-650 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="latest">最新发布 📅</option>
              <option value="non-r18">正常博文（无18） 🍃</option>
              {!filterR18Active && (
                <option value="r18">R18 🔞（已关闭过滤）</option>
              )}
              {user && (
                <option value="following">关注作者优先 🌟</option>
              )}
              <option value="hottest">最热阅读 🔥</option>
              <option value="likes">点赞最多 ❤️</option>
              <option value="collects">最多收藏 📖</option>
            </select>
          </div>

          <div className="h-4 w-px bg-gray-200"></div>

          <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-xl shadow-inner">
            <button
              onClick={() => setViewMode('grid')}
              title="网格排版"
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${viewMode === 'grid' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-75'}`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              title="列表排版"
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${viewMode === 'list' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-75'}`}
            >
              <List className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main loading posts state */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          <span className="text-gray-500 text-xs font-semibold mt-4">正在获取精品专栏博文...</span>
        </div>
      ) : filteredPosts.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gray-50 text-gray-400 mb-4">
            <BookOpen className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-bold text-gray-900 font-display">空空如也</h3>
          <p className="text-xs text-gray-500 mt-2 max-w-sm mx-auto leading-relaxed">
            {search || selectedTags.length > 0 ? '当前筛选条件下暂无公开文章。切换题材或清空搜索词试试。' : '当前专栏还没有发布任何博文噢，快去写篇大作发布吧！'}
          </p>
          {(search || selectedTags.length > 0) && (
            <button
              onClick={() => {
                setSearch('');
                setSelectedTags([]);
              }}
              className="mt-4 px-3.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            >
              重置过滤器
            </button>
          )}
        </div>
      ) : (
        <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in" : "space-y-4 animate-fade-in"}>
          {filteredPosts.map((post) => {
            const hasCover = post.images && post.images.length > 0;
            const coverImage = post.coverImage || (hasCover ? post.images[0] : 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=800&q=80');
            const cleanSummary = post.content.replace(/[#*`_[\]()-]/g, '').slice(0, 80) + '...';

            const isFuture = post.publishAt && new Date(post.publishAt) > new Date();

            return (
              <div
                key={post.id}
                onClick={() => onSelectPost(post.id)}
                className={`group bg-white rounded-2xl overflow-hidden border border-gray-100 cursor-pointer shadow-2xs hover:shadow-sm transition-all duration-300 flex ${viewMode === 'grid' ? 'flex-col' : 'flex-col sm:flex-row h-auto sm:h-40'}`}
              >
                {/* Image Section */}
                <div className={`relative overflow-hidden shrink-0 ${viewMode === 'grid' ? 'aspect-video w-full' : 'w-full sm:w-1/3 md:w-1/4 h-48 sm:h-full'}`}>
                  <ImageWrapper
                    src={coverImage}
                    alt={post.title}
                    width={500}
                    isR18={post.isR18}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-102"
                    placeholderClassName="w-full h-full"
                  />
                  
                  {/* Status badges */}
                  <div className="absolute top-2 left-2 flex flex-col gap-1.5">
                    {post.status === 'draft' && (
                      <span className="bg-amber-400 text-amber-950 text-[9px] px-2 py-0.5 rounded-full font-bold shadow-sm">
                        草稿
                      </span>
                    )}
                    {isFuture && (
                      <span className="bg-indigo-600 text-white text-[9px] px-2 py-0.5 rounded-full font-bold shadow-sm">
                        定时待发布
                      </span>
                    )}
                  </div>
                </div>

                {/* Content Section */}
                <div className="p-5 flex flex-col justify-between flex-grow text-left">
                  <div className="space-y-1.5">
                    <h3 className="font-display font-bold text-gray-900 group-hover:text-indigo-600 transition-colors line-clamp-1 text-sm sm:text-base leading-snug flex items-center gap-1.5">
                      {post.isR18 && (
                        <span className="shrink-0 bg-rose-100 text-rose-700 text-[9px] font-extrabold px-1.5 py-0.5 rounded-md uppercase tracking-wider font-mono">
                          R18
                        </span>
                      )}
                      <span>{post.title}</span>
                    </h3>
                    <p className="text-gray-500 text-[11px] sm:text-xs line-clamp-2 md:line-clamp-3 leading-relaxed">
                      {cleanSummary}
                    </p>
                  </div>

                  {/* Render Tags Chips directly on the Feed */}
                  {post.tags && post.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {post.tags.map((tg) => (
                        <span key={tg} className="bg-gray-100 text-gray-600 text-[9px] font-bold px-1.5 py-0.5 rounded">
                          #{tg}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-3.5 border-t border-gray-100 mt-4 text-[10px] text-gray-400">
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onSelectAuthor) onSelectAuthor(post.authorId);
                      }}
                      className="flex items-center gap-1.5 font-semibold text-gray-655 hover:text-indigo-600 transition-all cursor-pointer"
                      title="点击查看作者主页"
                    >
                      {post.authorAvatar ? (
                        <img
                          src={post.authorAvatar}
                          alt={post.authorName}
                          className="h-5 w-5 rounded-full object-cover border border-gray-100 shadow-3xs group-hover:scale-105 transition-all"
                        />
                      ) : (
                        <span className="p-0.5 bg-indigo-50 text-indigo-500 rounded-full">
                          <UserIcon className="h-3.5 w-3.5" />
                        </span>
                      )}
                      <span>{post.authorName}</span>
                    </div>

                    <div className="flex items-center gap-2.5 font-mono font-semibold">
                      {post.views !== undefined && (
                        <span className="flex items-center gap-0.5">
                          <Eye className="h-3 w-3" />
                          {post.views}
                        </span>
                      )}
                      <span className="flex items-center gap-0.5 text-rose-500">
                        <Heart className="h-3 w-3 fill-rose-500 text-rose-500" />
                        {post.likes || 0}
                      </span>
                      {post.collects !== undefined && post.collects > 0 && (
                        <span className="flex items-center gap-0.5 text-indigo-500">
                          <Bookmark className="h-3 w-3 fill-indigo-500 text-indigo-500" />
                          {post.collects}
                        </span>
                      )}
                      <span className="flex items-center gap-0.5">
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

      {/* Premium Tag Selector Modal */}
      {showTagModal && (
        <div className="fixed inset-0 bg-zinc-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-2xl w-full border border-gray-100 shadow-2xl flex flex-col h-[85vh] max-h-[680px] overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-left">
            
            {/* Header */}
            <div className="p-6 border-b border-gray-100 flex items-start justify-between shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-xl">
                    <Tag className="h-5 w-5" />
                  </span>
                  <h3 className="text-base font-bold text-gray-900 font-display">选择筛选标签分类</h3>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  选择多个标签进行交集过滤（例如同时选择「甜」+「现代」将仅显示同时具有这两个标签的文章）。
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowTagModal(false)}
                className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-650 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Sub-header Controls: Search & Category tabs */}
            <div className="px-6 py-4 bg-gray-50/50 border-b border-gray-100 space-y-3.5 shrink-0">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="搜索标签（例如：师徒、古代、甜...）"
                  value={tagSearchQuery}
                  onChange={(e) => setTagSearchQuery(e.target.value)}
                  className="block w-full rounded-2xl border border-gray-200 pl-10 pr-4 py-2.5 text-xs text-gray-800 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-100/50 focus:border-indigo-300 transition-all font-medium"
                />
                {tagSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setTagSearchQuery('')}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 p-0.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-650 cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Category tabs */}
              {!tagSearchQuery && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  {['全部', ...Object.keys(TAG_CATEGORIES)].map((category) => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setActiveTagTab(category)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                        activeTagTab === category
                          ? 'bg-indigo-600 text-white shadow-3xs'
                          : 'bg-white border border-gray-200 text-gray-550 hover:bg-gray-100'
                      }`}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Scrollable Tags Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {tagSearchQuery ? (
                // Search Results
                <div className="space-y-3">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    搜索结果 ({
                      AVAILABLE_TAGS.filter(tag => tag.includes(tagSearchQuery)).length
                    } 个标签)
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {AVAILABLE_TAGS.filter(tag => tag.includes(tagSearchQuery)).map((tag) => {
                      const isSelected = selectedTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => {
                            setSelectedTags(prev => 
                              prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
                            );
                          }}
                          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-600 border-indigo-700 text-white shadow-xs'
                              : 'bg-white border-gray-200 text-gray-650 hover:bg-gray-50'
                          }`}
                        >
                          {tag}
                          {isSelected && <Check className="h-3.5 w-3.5 text-indigo-200" />}
                        </button>
                      );
                    })}
                    {AVAILABLE_TAGS.filter(tag => tag.includes(tagSearchQuery)).length === 0 && (
                      <p className="text-xs text-gray-450 italic py-4 w-full text-center">
                        没有找到匹配「{tagSearchQuery}」的标签，换个词试试吧
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                // Categorized list, filtered by active tab
                Object.entries(TAG_CATEGORIES)
                  .filter(([categoryName]) => activeTagTab === '全部' || activeTagTab === categoryName)
                  .map(([categoryName, tags]) => (
                    <div key={categoryName} className="space-y-2.5">
                      <span className="inline-flex items-center text-[10px] font-bold text-indigo-500 font-sans tracking-wide bg-indigo-50/70 px-2 py-0.5 rounded">
                        {categoryName}
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {tags.map((tag) => {
                          const isSelected = selectedTags.includes(tag);
                          return (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => {
                                setSelectedTags(prev => 
                                  prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
                                );
                              }}
                              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 cursor-pointer ${
                                isSelected
                                  ? 'bg-indigo-600 border-indigo-700 text-white shadow-xs'
                                  : 'bg-white border-gray-200 text-gray-650 hover:bg-gray-50'
                              }`}
                            >
                              {tag}
                              {isSelected && <Check className="h-3.5 w-3.5 text-indigo-200" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shrink-0">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-500 font-semibold">当前已选过滤标签:</span>
                  <span className="text-xs font-bold text-indigo-600">
                    {selectedTags.length} 个标签
                  </span>
                </div>
                {/* Micro-preview of selected items in footer */}
                <div className="flex flex-wrap gap-1 max-w-md">
                  {selectedTags.map(tag => (
                    <span key={tag} className="inline-flex items-center text-[9px] font-bold bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded-md border border-indigo-100/50">
                      {tag}
                    </span>
                  ))}
                  {selectedTags.length === 0 && (
                    <span className="text-[10px] text-gray-400 italic">全部文章（未设置标签过滤）</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTags([]);
                  }}
                  className="px-4 py-2 border border-gray-250 hover:bg-gray-100 text-gray-650 hover:text-gray-800 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                >
                  清空筛选
                </button>
                <button
                  type="button"
                  onClick={() => setShowTagModal(false)}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
                >
                  确认并应用筛选 ({selectedTags.length}个)
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

// Simple loader to replace missing imports
function Loader2({ className }: { className?: string }) {
  return <div className={`animate-spin rounded-full border-2 border-indigo-600 border-t-transparent ${className}`} />;
}
