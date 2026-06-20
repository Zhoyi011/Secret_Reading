import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Post, AppUser } from '../types';
import { Search, PenTool, LayoutGrid, List, Heart, Calendar, ArrowRight, User as UserIcon, BookOpen, AlertCircle } from 'lucide-react';
import { isSandbox, getMockPosts } from '../sandboxStorage';

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

  useEffect(() => {
    setLoading(true);
    if (isSandbox()) {
      // Local sandbox loads mock posts from localStorage
      const mockPosts = getMockPosts().filter(p => p.status === 'published');
      setPosts(mockPosts);
      setLoading(false);
      return;
    }

    const postsRef = collection(db, 'posts');
    // Query published articles, sorted by creation date descending
    const q = query(
      postsRef,
      where('status', '==', 'published'),
      orderBy('createdAt', 'desc')
    );

    // Dynamic real-time listening
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadedPosts = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Post[];
      setPosts(loadedPosts);
      setLoading(false);
    }, (error) => {
      // Graceful error logging per the System Skill instructions
      console.error("Firestore loading posts failed:", error);
      handleFirestoreError(error, OperationType.LIST, 'posts');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 5) return '深夜好 🌌';
    if (hour < 12) return '早安 🌅';
    if (hour < 17) return '下午好 ☕';
    return '晚上好 🌃';
  };

  const filteredPosts = posts.filter(post => 
    post.title.toLowerCase().includes(search.toLowerCase()) ||
    post.authorName.toLowerCase().includes(search.toLowerCase()) ||
    post.content.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
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
            className="w-full bg-white border border-gray-200 rounded-xl py-2 pl-9 pr-4 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-sm"
          />
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
                  <img
                    src={coverImage}
                    alt={post.title}
                    className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
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
    </div>
  );
}
