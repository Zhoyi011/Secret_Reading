import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { AppUser } from '../types';
import { Bookmark, BookOpen, Trash2, ArrowLeft, Loader2, Heart, Calendar } from 'lucide-react';
import ImageWrapper from './ImageWrapper';

interface BookshelfProps {
  user: AppUser | null;
  onNavigate: (route: string) => void;
  onSelectPost: (postId: string) => void;
}

interface BookmarkItem {
  id: string;
  postId: string;
  userId: string;
  status: 'want' | 'reading' | 'read';
  progress: number;
  postTitle: string;
  postCover: string;
  postAuthor: string;
  updatedAt: string;
}

export default function Bookshelf({ user, onNavigate, onSelectPost }: BookshelfProps) {
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'want' | 'reading' | 'read'>('all');

  useEffect(() => {
    if (!user) return;

    setLoading(true);
    const bookmarksRef = collection(db, 'bookmarks');
    const q = query(bookmarksRef, where('userId', '==', user.firebaseUid));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      })) as BookmarkItem[];
      
      // Sort by last updated
      items.sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
      setBookmarks(items);
      setLoading(false);
    }, (error) => {
      console.error("Error reading bookmarks shelf:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const removeBookmark = async (bookmarkId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("确定要将本文章移出您的书架吗？")) return;
    try {
      await deleteDoc(doc(db, 'bookmarks', bookmarkId));
    } catch (err) {
      console.error("Failed to remove bookmark:", err);
    }
  };

  const filteredBookmarks = bookmarks.filter(item => {
    if (activeTab === 'all') return true;
    return item.status === activeTab;
  });

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 text-left animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => onNavigate('home')}
          className="p-2 rounded-lg bg-white border border-gray-100 text-gray-500 hover:text-gray-700 transition-colors shadow-sm cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-2xl font-bold font-display text-gray-900 flex items-center gap-2">
            <Bookmark className="h-6 w-6 text-indigo-600 fill-indigo-100" />
            我的读者书架
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            同步记录您的阅读进度，划分想读、在读、已读类别，不错过任何一段佳章。
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100 mb-6 bg-white p-1 rounded-xl shadow-2xs border">
        <button
          onClick={() => setActiveTab('all')}
          className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'all'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
          }`}
        >
          全部收藏 ({bookmarks.length})
        </button>
        <button
          onClick={() => setActiveTab('want')}
          className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'want'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
          }`}
        >
          想读 ({bookmarks.filter(b => b.status === 'want').length})
        </button>
        <button
          onClick={() => setActiveTab('reading')}
          className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'reading'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
          }`}
        >
          在读 ({bookmarks.filter(b => b.status === 'reading').length})
        </button>
        <button
          onClick={() => setActiveTab('read')}
          className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'read'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
          }`}
        >
          已读 ({bookmarks.filter(b => b.status === 'read').length})
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 bg-white border border-gray-100 rounded-2xl shadow-3xs">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          <span className="text-gray-500 text-xs mt-3 font-semibold">正在整理私人书库...</span>
        </div>
      ) : filteredBookmarks.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <BookOpen className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-gray-800 font-display">书架空空如也</h3>
          <p className="text-xs text-gray-400 mt-2 max-w-sm mx-auto leading-relaxed">
            您还没有标记此分类的文章。在任意博文的详情页中点击“加入书架”即可同步进度并追踪。
          </p>
          <button
            onClick={() => onNavigate('home')}
            className="mt-5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer"
          >
            去大厅找书看
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredBookmarks.map((item) => {
            const scrollProgress = item.progress || 0;
            return (
              <div
                key={item.id}
                onClick={() => onSelectPost(item.postId)}
                className="group bg-white rounded-2xl border border-gray-100 p-4 shadow-3xs hover:shadow-2xs transition-all duration-300 flex flex-col justify-between cursor-pointer"
              >
                <div className="space-y-3.5">
                  <div className="aspect-video rounded-xl overflow-hidden border border-gray-100 bg-gray-50 relative shrink-0">
                    <ImageWrapper
                      src={item.postCover}
                      alt={item.postTitle}
                      width={400}
                      className="w-full h-full object-cover transition-transform group-hover:scale-102"
                      placeholderClassName="w-full h-full"
                    />
                    <span className={`absolute top-2 left-2 text-[9px] font-bold px-2 py-0.5 rounded-full shadow-2xs text-white ${
                      item.status === 'want' ? 'bg-amber-500' :
                      item.status === 'reading' ? 'bg-indigo-600 animate-pulse' :
                      'bg-emerald-600'
                    }`}>
                      {item.status === 'want' ? '想读' :
                       item.status === 'reading' ? '在读' : '已读'}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <h3 className="font-bold text-gray-900 line-clamp-1 group-hover:text-indigo-600 transition-colors text-sm font-display">
                      {item.postTitle}
                    </h3>
                    <div className="flex items-center justify-between text-[10px] text-gray-400">
                      <span>作者：{item.postAuthor}</span>
                      <span className="font-mono">{new Date(item.updatedAt).toLocaleDateString()} 更新</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3.5 border-t border-gray-50 space-y-2">
                  <div className="flex items-center justify-between text-[9px] font-bold text-gray-500">
                    <span>阅读进度</span>
                    <span className="font-mono text-indigo-600">{Math.round(scrollProgress)}%</span>
                  </div>

                  {/* Progress track */}
                  <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                      style={{ width: `${scrollProgress}%` }}
                    />
                  </div>

                  <div className="flex justify-end pt-1.5">
                    <button
                      onClick={(e) => removeBookmark(item.id, e)}
                      title="移出书架"
                      className="p-1.5 text-gray-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
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
