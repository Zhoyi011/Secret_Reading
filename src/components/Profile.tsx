import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { AppUser, Post } from '../types';
import { User, Calendar, BookOpen, Clock, Edit2, Shield, Heart, HeartOff, PenTool } from 'lucide-react';

interface ProfileProps {
  user: AppUser | null;
  onNavigate: (route: string) => void;
  onSelectPost: (postId: string) => void;
  onEditPost: (postId: string) => void;
}

export default function Profile({ user, onNavigate, onSelectPost, onEditPost }: ProfileProps) {
  const [myPosts, setMyPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    setLoading(true);
    const postsRef = collection(db, 'posts');
    const q = query(postsRef, where('authorId', '==', user.firebaseUid));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loaded = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Post[];
      // Sort descending by creation date
      loaded.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setMyPosts(loaded);
      setLoading(false);
    }, (error) => {
      console.error("Failed to load user posts:", error);
      handleFirestoreError(error, OperationType.LIST, 'posts');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  if (!user) {
    return (
      <div className="max-w-xl mx-auto mt-20 p-8 text-center bg-white rounded-2xl border border-gray-100 shadow-sm">
        <h3 className="text-lg font-bold text-gray-900 font-display">未登录账户</h3>
        <p className="text-gray-500 mt-2 text-sm">请先登录或注册以查看您的个人主页。</p>
        <button
          onClick={() => onNavigate('login')}
          className="mt-6 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-500 transition-colors shadow-sm"
        >
          立即登录
        </button>
      </div>
    );
  }

  const publishedCount = myPosts.filter(p => p.status === 'published').length;
  const draftCount = myPosts.filter(p => p.status === 'draft').length;
  const totalReceivedLikes = myPosts.reduce((acc, p) => acc + (p.likes || 0), 0);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      {/* User info card */}
      <div className="bg-white rounded-3xl border border-gray-100 p-6 sm:p-10 shadow-sm flex flex-col md:flex-row items-center gap-6 sm:gap-8 relative overflow-hidden">
        {/* Subtle decorative background gradients */}
        <div className="absolute top-0 right-0 h-40 w-40 bg-gradient-to-br from-indigo-100/40 to-transparent rounded-full -mr-16 -mt-16 pointer-events-none"></div>

        <img
          src={user.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'}
          alt={user.username}
          className="h-24 w-24 sm:h-28 sm:w-28 rounded-full object-cover border-4 border-indigo-50 shadow-md shrink-0"
        />

        <div className="space-y-3 text-center md:text-left flex-grow">
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3">
            <h2 className="font-display font-bold text-gray-900 text-2xl sm:text-3xl leading-none">
              {user.username}
            </h2>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
              user.role === 'owner' ? 'bg-indigo-100 text-indigo-800' :
              user.role === 'author' ? 'bg-emerald-100 text-emerald-800' :
              'bg-gray-100 text-gray-700'
            }`}>
              <Shield className="h-3 w-3" />
              {user.role === 'owner' ? '站长 (Owner)' :
               user.role === 'author' ? '专栏作者 (Author)' : '尊享读者 (Reader)'}
            </span>
          </div>

          <p className="text-gray-500 text-xs sm:text-sm font-medium flex items-center justify-center md:justify-start gap-1">
            <User className="h-4 w-4 text-gray-400" />
            <span>邮箱: {user.email}</span>
          </p>

          <p className="text-gray-400 text-xs flex items-center justify-center md:justify-start gap-3">
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              加入于: {new Date(user.createdAt).toLocaleDateString()}
            </span>
          </p>
        </div>

        {/* Stats card banner */}
        <div className="grid grid-cols-3 divide-x divide-gray-100 bg-gray-50/50 rounded-2xl border border-gray-100 p-4 shrink-0 w-full md:w-auto text-center">
          <div className="px-3">
            <span className="block font-display text-lg font-bold text-gray-900">{publishedCount}</span>
            <span className="text-[10px] text-gray-500">已发文章</span>
          </div>
          <div className="px-3">
            <span className="block font-display text-lg font-bold text-gray-900">{draftCount}</span>
            <span className="text-[10px] text-gray-500">保存草稿</span>
          </div>
          <div className="px-3">
            <span className="block font-display text-lg font-bold text-gray-900">{totalReceivedLikes}</span>
            <span className="text-[10px] text-gray-500">获赞总计</span>
          </div>
        </div>
      </div>

      {/* Articles summary list */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-bold text-gray-900 text-lg flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-indigo-600" />
            我的创作历史 & 稿件备忘录
          </h3>

          {(user.role === 'author' || user.role === 'owner') && (
            <button
              onClick={() => onNavigate('write')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-indigo-100 hover:border-indigo-200 bg-indigo-50/55 rounded-lg text-xs font-semibold text-indigo-600 transition-all hover:bg-indigo-50"
            >
              <PenTool className="h-3.5 w-3.5" />
              撰写新博文
            </button>
          )}
        </div>

        {loading ? (
          <div className="py-12 flex justify-center items-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent"></div>
          </div>
        ) : myPosts.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-gray-400 text-xs">您目前还没有任何文章或写作草稿噢。</p>
          </div>
        ) : (
          <div className="space-y-4">
            {myPosts.map((post) => (
              <div
                key={post.id}
                className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 hover:shadow-xs transition-shadow"
              >
                <div
                  onClick={() => onSelectPost(post.id)}
                  className="flex items-center gap-4 cursor-pointer group flex-grow"
                >
                  <img
                    src={post.images?.[0] || 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=150&q=80'}
                    alt={post.title}
                    className="h-12 w-20 rounded-lg object-cover border border-gray-100"
                  />
                  <div>
                    <h4 className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors font-display text-sm leading-snug line-clamp-1">
                      {post.title}
                    </h4>
                    <p className="text-gray-400 text-[10px] mt-1 flex items-center gap-3">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold ${post.status === 'published' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                        {post.status === 'published' ? '已公开发表' : '草稿备忘'}
                      </span>
                      <span>更新于 - {new Date(post.updatedAt).toLocaleDateString()}</span>
                      <span className="flex items-center gap-0.5 text-rose-500">
                        <Heart className="h-3 w-3 fill-rose-500" />
                        {post.likes || 0}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                  <button
                    onClick={() => onEditPost(post.id)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-gray-300 text-gray-600 bg-white hover:bg-gray-50 transition-all font-semibold text-xs shadow-sm"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                    修改编辑
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
