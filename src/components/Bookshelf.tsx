import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { AppUser } from '../types';
import { Bookmark, BookOpen, Trash2, ArrowLeft, Loader2, Heart, Calendar, Clock, AlertTriangle, X, Smartphone } from 'lucide-react';
import ImageWrapper from './ImageWrapper';
import { safeLocalStorage } from '../utils/safeStorage';

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

interface HistoryItem {
  id: string;
  postId: string;
  userId: string;
  postTitle: string;
  authorName: string;
  coverImage: string;
  progress: number;
  updatedAt: string;
}

export default function Bookshelf({ user, onNavigate, onSelectPost }: BookshelfProps) {
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'want' | 'reading' | 'read' | 'history' | 'offline'>('all');
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [offlinePosts, setOfflinePosts] = useState<any[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  // Load offline saved posts from local storage
  useEffect(() => {
    const offlineListStr = safeLocalStorage.getItem('offline_saved_posts');
    if (offlineListStr) {
      try {
        setOfflinePosts(JSON.parse(offlineListStr));
      } catch (e) {
        console.warn("Failed to parse offline posts list:", e);
      }
    }
  }, []);

  const removeOfflinePost = (postId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setConfirmDialog({
      isOpen: true,
      title: '删除本地离线缓存',
      message: '确定要删除这篇文章的本地离线缓存吗？删除后您在离线状态下将无法阅读。',
      onConfirm: () => {
        try {
          const offlineListStr = safeLocalStorage.getItem('offline_saved_posts');
          if (offlineListStr) {
            const list = JSON.parse(offlineListStr) as any[];
            const updatedList = list.filter(p => p.id !== postId);
            safeLocalStorage.setItem('offline_saved_posts', JSON.stringify(updatedList));
            safeLocalStorage.removeItem(`offline_post_${postId}`);
            setOfflinePosts(updatedList);
          }
        } catch (err) {
          console.error("Failed to remove offline cached post:", err);
        }
        setConfirmDialog(null);
      }
    });
  };

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
    e.preventDefault();
    console.log("Initiating bookmark removal for ID:", bookmarkId);
    setConfirmDialog({
      isOpen: true,
      title: '移出书架',
      message: '确定要将本文章移出您的书架吗？',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'bookmarks', bookmarkId));
          console.log("Successfully deleted bookmark:", bookmarkId);
        } catch (err) {
          console.error("Failed to remove bookmark:", err);
        }
        setConfirmDialog(null);
      }
    });
  };

  useEffect(() => {
    if (!user) return;

    setHistoryLoading(true);
    const historyRef = collection(db, 'history');
    const q = query(historyRef, where('userId', '==', user.firebaseUid));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      })) as HistoryItem[];
      
      // Sort by last updated
      items.sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
      setHistoryItems(items);
      setHistoryLoading(false);
    }, (error) => {
      console.error("Error reading reading history:", error);
      setHistoryLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const removeHistoryItem = async (historyId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    console.log("Initiating history removal for ID:", historyId);
    setConfirmDialog({
      isOpen: true,
      title: '删除阅读历史',
      message: '确定要删除这条阅读历史记录吗？',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'history', historyId));
          console.log("Successfully deleted history document:", historyId);
        } catch (err) {
          console.error("Failed to remove history item:", err);
        }
        setConfirmDialog(null);
      }
    });
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
      <div className="flex border-b border-gray-100 mb-6 bg-white p-1 rounded-xl shadow-2xs border overflow-x-auto gap-1">
        <button
          onClick={() => setActiveTab('all')}
          className={`flex-1 min-w-[70px] py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'all'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
          }`}
        >
          全部收藏 ({bookmarks.length})
        </button>
        <button
          onClick={() => setActiveTab('want')}
          className={`flex-1 min-w-[50px] py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'want'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
          }`}
        >
          想读 ({bookmarks.filter(b => b.status === 'want').length})
        </button>
        <button
          onClick={() => setActiveTab('reading')}
          className={`flex-1 min-w-[50px] py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'reading'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
          }`}
        >
          在读 ({bookmarks.filter(b => b.status === 'reading').length})
        </button>
        <button
          onClick={() => setActiveTab('read')}
          className={`flex-1 min-w-[50px] py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'read'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
          }`}
        >
          已读 ({bookmarks.filter(b => b.status === 'read').length})
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 min-w-[80px] py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
            activeTab === 'history'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
          }`}
        >
          <Clock className="h-3.5 w-3.5 shrink-0" />
          <span>阅读历史 ({historyItems.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('offline')}
          className={`flex-1 min-w-[80px] py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
            activeTab === 'offline'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
          }`}
        >
          <Smartphone className="h-3.5 w-3.5 shrink-0" />
          <span>离线缓存 ({offlinePosts.length})</span>
        </button>
      </div>

      {/* Content */}
      {activeTab === 'offline' ? (
        offlinePosts.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 shadow-sm">
            <Smartphone className="h-10 w-10 text-gray-300 mx-auto mb-3 animate-pulse" />
            <h3 className="text-sm font-bold text-gray-800 font-display">暂无离线下载内容</h3>
            <p className="text-xs text-gray-400 mt-2 max-w-sm mx-auto leading-relaxed">
              您还没有离线缓存过任何文章。您可以在任意文章的顶部点击“离线保存”，系统将妥善在本地打包，保证在没有网络连接时也可以流畅畅读。
            </p>
            <button
              onClick={() => onNavigate('home')}
              className="mt-5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer"
            >
              去浏览推荐文章
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-left">
            {offlinePosts.map((item) => (
              <div
                key={item.id}
                onClick={() => onSelectPost(item.id)}
                className="group bg-white rounded-2xl border border-gray-100 p-4 shadow-3xs hover:shadow-2xs transition-all duration-300 flex flex-col justify-between cursor-pointer relative overflow-hidden"
              >
                <div className="space-y-3.5">
                  <div className="aspect-video rounded-xl overflow-hidden border border-gray-100 bg-gray-50 relative shrink-0">
                    <ImageWrapper
                      src={item.coverImage}
                      alt={item.title}
                      width={400}
                      className="w-full h-full object-cover transition-transform group-hover:scale-102"
                      placeholderClassName="w-full h-full"
                    />
                    <span className="absolute top-2 left-2 text-[9px] font-bold px-2 py-0.5 rounded-full shadow-2xs text-white bg-emerald-600/95 backdrop-blur-xs flex items-center gap-1">
                      <Smartphone className="h-2.5 w-2.5" />
                      <span>本地已缓存</span>
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <h3 className="font-bold text-gray-900 line-clamp-1 group-hover:text-indigo-600 transition-colors text-sm font-display">
                      {item.title}
                    </h3>
                    <div className="flex items-center justify-between text-[10px] text-gray-400">
                      <span>作者：{item.authorName}</span>
                      <span className="font-mono text-emerald-600">离线阅读就绪</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3.5 border-t border-gray-50 flex items-center justify-between text-[10px] text-gray-400">
                  <span>保存于 {item.savedAt ? new Date(item.savedAt).toLocaleDateString() : '近期'}</span>
                  <button
                    onClick={(e) => removeOfflinePost(item.id, e)}
                    title="删除本地缓存"
                    className="p-1.5 text-gray-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : activeTab === 'history' ? (
        historyLoading ? (
          <div className="flex flex-col items-center justify-center py-24 bg-white border border-gray-100 rounded-2xl shadow-3xs">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            <span className="text-gray-500 text-xs mt-3 font-semibold">正在调阅浏览足迹...</span>
          </div>
        ) : historyItems.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 shadow-sm">
            <Clock className="h-10 w-10 text-gray-300 mx-auto mb-3 animate-pulse" />
            <h3 className="text-sm font-bold text-gray-800 font-display">暂无阅读历史</h3>
            <p className="text-xs text-gray-400 mt-2 max-w-sm mx-auto leading-relaxed">
              您最近还没有浏览过任何博文。在大厅里点开几篇文章阅读，它们就会自动记录在这里，方便您随时继续阅读。
            </p>
            <button
              onClick={() => onNavigate('home')}
              className="mt-5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer"
            >
              去浏览博文
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-left">
            {historyItems.map((item) => {
              const scrollProgress = item.progress || 0;
              return (
                <div
                  key={item.id}
                  onClick={() => onSelectPost(item.postId)}
                  className="group bg-white rounded-2xl border border-gray-100 p-4 shadow-3xs hover:shadow-2xs transition-all duration-300 flex flex-col justify-between cursor-pointer relative overflow-hidden"
                >
                  <div className="space-y-3.5">
                    <div className="aspect-video rounded-xl overflow-hidden border border-gray-100 bg-gray-50 relative shrink-0">
                      <ImageWrapper
                        src={item.coverImage}
                        alt={item.postTitle}
                        width={400}
                        className="w-full h-full object-cover transition-transform group-hover:scale-102"
                        placeholderClassName="w-full h-full"
                      />
                      <span className="absolute top-2 left-2 text-[9px] font-bold px-2 py-0.5 rounded-full shadow-2xs text-white bg-zinc-700/90 backdrop-blur-xs flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" />
                        <span>阅读足迹</span>
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <h3 className="font-bold text-gray-900 line-clamp-1 group-hover:text-indigo-600 transition-colors text-sm font-display">
                        {item.postTitle}
                      </h3>
                      <div className="flex items-center justify-between text-[10px] text-gray-400">
                        <span>作者：{item.authorName}</span>
                        <span className="font-mono">{new Date(item.updatedAt).toLocaleDateString()} 访问</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3.5 border-t border-gray-50 space-y-2">
                    <div className="flex items-center justify-between text-[9px] font-bold text-gray-500">
                      <span>上次读到</span>
                      <span className="font-mono text-indigo-600">{Math.round(scrollProgress)}%</span>
                    </div>

                    {/* Progress track */}
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full transition-all duration-500"
                        style={{ width: `${scrollProgress}%` }}
                      />
                    </div>

                    <div className="flex justify-end pt-1.5">
                      <button
                        onClick={(e) => removeHistoryItem(item.id, e)}
                        title="删除此条浏览记录"
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
        )
      ) : loading ? (
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

      {/* Custom Confirm Dialog Modal */}
      {confirmDialog?.isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in" id="bookshelf-confirm-modal">
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-sm w-full p-6 border border-gray-100 shadow-xl space-y-4 animate-scale-in text-left"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-50 text-amber-500 shrink-0">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <h3 className="font-display font-bold text-gray-900 text-sm">{confirmDialog.title}</h3>
              </div>
              <button 
                onClick={() => setConfirmDialog(null)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <p className="text-xs text-gray-500 leading-relaxed">
              {confirmDialog.message}
            </p>
            
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setConfirmDialog(null)}
                className="px-3.5 py-1.5 rounded-xl border border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-50 text-xs font-bold transition-all cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={() => {
                  confirmDialog.onConfirm();
                }}
                className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>确认</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
