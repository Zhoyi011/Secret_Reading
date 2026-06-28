import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { AppUser } from '../types';
import { Search, Sparkles, User, BookOpen, Shield, Clock, ChevronRight, Filter } from 'lucide-react';

interface AuthorDirectoryProps {
  currentUser: AppUser | null;
  onSelectAuthor: (authorId: string) => void;
}

type LevelFilter = 'all' | 'owner' | 'vip' | 'signed' | 'normal';

export default function AuthorDirectory({ currentUser, onSelectAuthor }: AuthorDirectoryProps) {
  const [authors, setAuthors] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all');

  useEffect(() => {
    const fetchAuthors = async () => {
      setLoading(true);
      try {
        // Query users collection for authors and owners
        const usersRef = collection(db, 'users');
        const querySnapshot = await getDocs(usersRef);
        const usersList: AppUser[] = [];
        
        querySnapshot.forEach((doc) => {
          const u = doc.data() as AppUser;
          // Filter to show only authors and owners
          if (u.role === 'author' || u.role === 'owner') {
            usersList.push({
              ...u,
              firebaseUid: doc.id
            });
          }
        });
        
        // Sort: owner first, then vip, then signed, then normal
        usersList.sort((a, b) => {
          if (a.role === 'owner') return -1;
          if (b.role === 'owner') return 1;
          
          const aLevel = a.level || 'normal';
          const bLevel = b.level || 'normal';
          
          const levelWeight = { vip: 3, signed: 2, normal: 1 };
          return (levelWeight[bLevel] || 0) - (levelWeight[aLevel] || 0);
        });

        setAuthors(usersList);
      } catch (err) {
        console.error("Error fetching authors list:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAuthors();
  }, []);

  // Filter list based on search and level selection
  const filteredAuthors = authors.filter((author) => {
    const matchesSearch = author.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (author.updatePlan && author.updatePlan.toLowerCase().includes(searchQuery.toLowerCase()));
    
    if (levelFilter === 'all') return matchesSearch;
    if (levelFilter === 'owner') return matchesSearch && author.role === 'owner';
    return matchesSearch && author.role === 'author' && (author.level || 'normal') === levelFilter;
  });

  // Calculate quick summary metrics
  const counts = {
    all: authors.length,
    owner: authors.filter(a => a.role === 'owner').length,
    vip: authors.filter(a => a.role === 'author' && a.level === 'vip').length,
    signed: authors.filter(a => a.role === 'author' && a.level === 'signed').length,
    normal: authors.filter(a => a.role === 'author' && (a.level || 'normal') === 'normal').length,
  };

  return (
    <div className="space-y-6 text-left animate-fade-in">
      {/* Intro Banner */}
      <div className="bg-gradient-to-br from-indigo-50/70 via-white to-sky-50/30 rounded-3xl border border-indigo-100 p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden shadow-2xs">
        <div className="absolute top-0 right-0 h-40 w-40 bg-gradient-to-br from-indigo-150 to-transparent rounded-full -mr-16 -mt-16 pointer-events-none opacity-40"></div>
        <div className="space-y-2 z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-black border border-indigo-100/50">
            <Sparkles className="h-3.5 w-3.5 text-indigo-500 animate-spin-slow" />
            创作者名录
          </div>
          <h2 className="font-display font-black text-gray-900 text-2xl sm:text-3xl tracking-tight">
            探寻平台优质创作者
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 max-w-xl font-medium">
            这里汇集了所有才华横溢的博主与作者。从普通原创写手到深度签约大触，您可以点击任何博主的主页来了解并关注他们，催更最新连载作品。
          </p>
        </div>
      </div>

      {/* Filter and Search Controls Row */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-gray-100 shadow-2xs space-y-4">
        <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
          {/* Search bar */}
          <div className="relative flex-grow max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜索创作者用户名、连载计划..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full rounded-xl border border-gray-200 pl-10 pr-4 py-2.5 text-xs text-gray-800 bg-gray-50/30 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-100/50 focus:border-indigo-300 focus:bg-white transition-all font-semibold shadow-2xs"
            />
          </div>

          {/* Level Filter Dropdown/Tabs */}
          <div className="flex flex-row md:flex-wrap gap-2 overflow-x-auto scrollbar-none pb-1 md:pb-0 shrink-0 w-full md:w-auto -mx-4 px-4 md:mx-0 md:px-0">
            {(Object.keys(counts) as Array<keyof typeof counts>).map((level) => {
              const labelMap: Record<LevelFilter, string> = {
                all: '全部创作者',
                owner: '👑 站长',
                vip: '🏆 特邀 VIP',
                signed: '✒️ 签约作者',
                normal: '📖 普通作者'
              };

              const isSelected = levelFilter === level;
              return (
                <button
                  key={level}
                  onClick={() => setLevelFilter(level as LevelFilter)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer border flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-indigo-600 border-indigo-700 text-white shadow-xs'
                      : 'bg-white border-gray-200 text-gray-650 hover:bg-gray-50'
                  }`}
                >
                  <span>{labelMap[level as LevelFilter]}</span>
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${
                    isSelected ? 'bg-indigo-750 text-indigo-100' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {counts[level]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Grid of Creator Cards */}
      {loading ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-gray-100 shadow-2xs">
          <div className="inline-block animate-spin rounded-full border-4 border-indigo-600 border-t-transparent h-10 w-10 mb-4"></div>
          <p className="text-sm text-gray-400 font-bold">正在载入创作者名录...</p>
        </div>
      ) : filteredAuthors.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-gray-100 shadow-2xs space-y-2">
          <p className="text-sm text-gray-400 italic">没有找到符合条件的创作者。</p>
          <p className="text-xs text-gray-450">试试搜索其他的关键字或切换分类标签吧！</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 lg:gap-10">
          {filteredAuthors.map((author) => {
            const isOwner = author.role === 'owner';
            const authorLevel = author.level || 'normal';

            // Distinct visual classes matching profile card styling rules - expanded padding for breathing room
            let cardClass = "bg-white rounded-2xl border border-gray-150 p-6 sm:p-7 shadow-3xs flex flex-col justify-between relative overflow-hidden transition-all hover:translate-y-[-2px] hover:shadow-2xs";
            let nameClass = "font-display font-bold text-gray-900 text-base leading-snug line-clamp-1";
            let ringClass = "h-14 w-14 rounded-full object-cover border-2 border-indigo-50 shadow-xs ring-2 ring-indigo-50 shrink-0";
            let roleBadge = null;
            let sparklesElement = null;

            if (isOwner) {
              cardClass = "bg-gradient-to-br from-zinc-950 via-purple-950/95 to-zinc-900 rounded-2xl border border-purple-550/80 p-6 sm:p-7 shadow-[0_12px_24px_rgba(168,85,247,0.18)] flex flex-col justify-between relative overflow-hidden text-white transition-all hover:translate-y-[-2px]";
              nameClass = "font-display font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-300 to-pink-300 text-base leading-snug line-clamp-1";
              ringClass = "h-14 w-14 rounded-full object-cover border-2 border-purple-500/20 shadow-xs ring-2 ring-purple-500 shrink-0";
              roleBadge = (
                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[9px] font-bold bg-purple-600 text-white shadow-2xs shrink-0">
                  👑 站长 / 平台主理人
                </span>
              );
              sparklesElement = (
                <Sparkles className="absolute h-4 w-4 text-purple-400/25 top-3 right-3 animate-pulse pointer-events-none" />
              );
            } else if (author.role === 'author') {
              if (authorLevel === 'vip') {
                cardClass = "bg-gradient-to-br from-amber-50/40 via-white to-orange-50/20 rounded-2xl border-2 border-amber-300 p-6 sm:p-7 shadow-[0_10px_20px_rgba(245,158,11,0.06)] flex flex-col justify-between relative overflow-hidden transition-all hover:translate-y-[-2px] hover:shadow-2xs";
                nameClass = "font-display font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-600 to-rose-650 text-base leading-snug line-clamp-1";
                ringClass = "h-14 w-14 rounded-full object-cover border-2 border-white shadow-xs ring-2 ring-amber-400 shrink-0";
                roleBadge = (
                  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[9px] font-black bg-gradient-to-r from-amber-500 to-rose-500 text-white shadow-2xs shrink-0">
                    👑 特邀 VIP
                  </span>
                );
                sparklesElement = (
                  <Sparkles className="absolute h-4 w-4 text-amber-500/35 top-3 right-3 animate-pulse pointer-events-none" />
                );
              } else if (authorLevel === 'signed') {
                cardClass = "bg-gradient-to-br from-emerald-50/40 via-white to-emerald-50/5 rounded-2xl border-2 border-emerald-250 p-6 sm:p-7 shadow-3xs flex flex-col justify-between relative overflow-hidden transition-all hover:translate-y-[-2px] hover:shadow-2xs";
                nameClass = "font-display font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-emerald-950 text-base leading-snug line-clamp-1";
                ringClass = "h-14 w-14 rounded-full object-cover border-2 border-white shadow-xs ring-2 ring-emerald-300 shrink-0";
                roleBadge = (
                  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[9px] font-bold bg-emerald-600 text-white shadow-3xs shrink-0">
                    ✒️ 签约作者
                  </span>
                );
              } else {
                cardClass = "bg-gradient-to-br from-indigo-50/40 via-white to-indigo-50/5 rounded-2xl border border-indigo-150 p-6 sm:p-7 shadow-3xs flex flex-col justify-between relative overflow-hidden transition-all hover:translate-y-[-2px] hover:shadow-2xs";
                nameClass = "font-display font-bold text-indigo-900 text-base leading-snug line-clamp-1";
                ringClass = "h-14 w-14 rounded-full object-cover border-2 border-white shadow-xs ring-2 ring-indigo-200 shrink-0";
                roleBadge = (
                  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100/50 shrink-0">
                    📖 普通作者
                  </span>
                );
              }
            }

            return (
              <div key={author.firebaseUid} className={cardClass}>
                {sparklesElement}
                
                {/* Card Main Header Area */}
                <div className="flex gap-4 items-start text-left">
                  <img
                    src={author.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'}
                    alt={author.username}
                    className={ringClass}
                  />
                  <div className="space-y-1.5 min-w-0 flex-grow">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className={nameClass}>{author.username}</h4>
                      {roleBadge}
                    </div>
                    
                    <p className={`text-[10px] font-medium flex items-center gap-1 ${
                      isOwner ? 'text-purple-300/60' : 'text-gray-400'
                    }`}>
                      <Clock className="h-3 w-3" />
                      加入时间: {new Date(author.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {/* Update Plan or Bios section */}
                <div className="my-5 pt-4 border-t border-gray-150/10 min-h-[44px] text-left">
                  <p className={`text-[11px] leading-relaxed line-clamp-2 ${
                    isOwner ? 'text-purple-200/70' : 'text-gray-500'
                  }`}>
                    {author.updatePlan ? (
                      <span className="font-semibold text-indigo-555">
                        🗓️ 连载计划: {author.updatePlan}
                      </span>
                    ) : (
                      <span className="italic">✍️ 暂无连载声明。点击下方查看该作者主页发表的文章作品吧。</span>
                    )}
                  </p>
                </div>

                {/* Footer Buttons CTA */}
                <div className="pt-3">
                  <button
                    onClick={() => onSelectAuthor(author.firebaseUid)}
                    className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                      isOwner
                        ? 'bg-purple-900/40 hover:bg-purple-900/60 text-purple-200 border border-purple-500/20 hover:border-purple-550'
                        : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-100/50 hover:border-indigo-200'
                    }`}
                  >
                    <span>查看作品与主页</span>
                    <ChevronRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
