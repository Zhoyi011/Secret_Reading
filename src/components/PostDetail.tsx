import React, { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Post, AppUser } from '../types';
import MarkdownRenderer from './MarkdownRenderer';
import { ArrowLeft, Heart, Calendar, User, Trash2, Edit, Loader2, Sparkles, Image as ImageIcon } from 'lucide-react';
import { isSandbox, getMockPosts, likeMockPost, deleteMockPost } from '../sandboxStorage';

interface PostDetailProps {
  postId: string;
  user: AppUser | null;
  onNavigate: (route: string) => void;
  onEditPost: (postId: string) => void;
  onBack: () => void;
}

export default function PostDetail({ postId, user, onNavigate, onEditPost, onBack }: PostDetailProps) {
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [liking, setLiking] = useState(false);

  useEffect(() => {
    const fetchPost = async () => {
      setLoading(true);
      if (isSandbox()) {
        const mockPosts = getMockPosts();
        const found = mockPosts.find(p => p.id === postId);
        if (found) {
          setPost(found);
        } else {
          console.error("No such article post available in sandbox");
        }
        setLoading(false);
        return;
      }

      try {
        const postRef = doc(db, 'posts', postId);
        const postSnap = await getDoc(postRef);

        if (postSnap.exists()) {
          setPost({
            id: postSnap.id,
            ...postSnap.data(),
          } as Post);
        } else {
          console.error("No such article post available");
        }
      } catch (err) {
        console.error("Failed to load post detail:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchPost();
  }, [postId]);

  const handleLike = async () => {
    if (!user || !post) return;
    if (liking) return;

    setLiking(true);
    const userId = user.firebaseUid;

    if (isSandbox()) {
      const updated = likeMockPost(post.id, userId);
      if (updated) {
        setPost(updated);
      }
      setLiking(false);
      return;
    }

    const isLiked = post.likers?.includes(userId) || false;

    // Correct schema calculations
    const updatedLikers = isLiked
      ? (post.likers || []).filter((id) => id !== userId)
      : [...(post.likers || []), userId];

    const updatedLikesCount = updatedLikers.length;

    try {
      const postRef = doc(db, 'posts', post.id);
      
      const updatePayload = {
        likes: updatedLikesCount,
        likers: updatedLikers,
      };

      try {
        await updateDoc(postRef, updatePayload);
      } catch (fError) {
        handleFirestoreError(fError, OperationType.UPDATE, `posts/${post.id}`);
      }

      // Optimistic state update local reflecting success
      setPost((prev) => prev ? {
        ...prev,
        likes: updatedLikesCount,
        likers: updatedLikers,
      } : null);
    } catch (err: any) {
      console.error("Liking transaction failed:", err);
      alert("点赞操作失败: " + err.message);
    } finally {
      setLiking(false);
    }
  };

  const handleDelete = async () => {
    if (!post) return;
    if (!confirm("确定要永久删除本篇文章吗？该操作不可撤销。")) return;

    if (isSandbox()) {
      deleteMockPost(post.id);
      alert("文章已被成功删除 (沙盒环境)");
      onBack();
      return;
    }

    try {
      const postRef = doc(db, 'posts', post.id);
      
      try {
        await deleteDoc(postRef);
      } catch (fError) {
        handleFirestoreError(fError, OperationType.DELETE, `posts/${post.id}`);
      }

      alert("文章已被成功删除");
      onBack();
    } catch (err: any) {
      console.error("Delete post failed:", err);
      alert("删除失败: " + err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 container mx-auto">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        <span className="text-sm font-medium text-gray-500 mt-4">正在加载尊享排版文章...</span>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="max-w-xl mx-auto mt-20 p-8 text-center bg-white rounded-2xl border border-gray-100 shadow-sm">
        <h3 className="text-lg font-bold text-gray-900 font-display">文章未找到</h3>
        <p className="text-gray-500 mt-2 text-sm">该文章可能已被作者删除或移动。</p>
        <button
          onClick={onBack}
          className="mt-6 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-500 transition-colors shadow-sm"
        >
          返回名册首页
        </button>
      </div>
    );
  }

  const isAlreadyLiked = user ? post.likers?.includes(user.firebaseUid) : false;
  const isAuthor = user ? post.authorId === user.firebaseUid : false;
  const isAdminOrOwner = user ? user.role === 'owner' : false;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Navigator headers */}
      <div className="flex items-center justify-between gap-4 mb-8">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-gray-100 text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-all font-medium text-xs shadow-sm"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          返回列表
        </button>

        {user && (isAuthor || isAdminOrOwner) && (
          <div className="flex items-center gap-2">
            {isAuthor && post.status === 'draft' && (
              <button
                onClick={() => onEditPost(post.id)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-550 border border-indigo-100 text-indigo-600 hover:bg-indigo-50 transition-all text-xs font-semibold"
              >
                <Edit className="h-3.5 w-3.5" />
                继续编辑它
              </button>
            )}

            {(isAuthor || isAdminOrOwner) && (
              <button
                onClick={handleDelete}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 border border-rose-100 text-rose-600 hover:bg-rose-100 transition-all text-xs font-semibold"
              >
                <Trash2 className="h-3.5 w-3.5" />
                删除文章
              </button>
            )}
          </div>
        )}
      </div>

      {/* Main post container */}
      <article className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 sm:p-10 space-y-6">
        <div className="space-y-4">
          <h1 className="font-display font-bold text-gray-950 text-2xl sm:text-3.5xl tracking-tight leading-snug">
            {post.title}
          </h1>

          <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 pt-2 pb-4 border-b border-gray-100/80">
            <div className="flex items-center gap-1.5 text-gray-700 font-semibold">
              <User className="h-4 w-4 text-indigo-600" />
              <span>{post.authorName}</span>
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              <span>{new Date(post.createdAt).toLocaleDateString()} 发布</span>
            </div>
            {post.status === 'draft' && (
              <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-[10px] font-bold">
                私密草稿
              </span>
            )}
          </div>
        </div>

        {/* Primary cover / gallery section */}
        {post.images && post.images.length > 0 && (
          <div className="space-y-2">
            <div className="aspect-video w-full rounded-2xl overflow-hidden border border-gray-100/50">
              <img
                src={post.images[0]}
                alt="Post Cover Banner"
                className="w-full h-full object-cover"
              />
            </div>
            {post.images.length > 1 && (
              <div className="grid grid-cols-4 gap-2">
                {post.images.slice(1).map((img, idx) => (
                  <div key={idx} className="aspect-video rounded-lg overflow-hidden border border-gray-100">
                    <img src={img} alt={`Gallery index ${idx}`} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Article content renderer */}
        <div className="py-2 selection:bg-indigo-100">
          <MarkdownRenderer content={post.content} />
        </div>

        {/* Appreciation like footer section */}
        <div className="flex flex-col items-center justify-center pt-10 pb-4 border-t border-gray-50 mt-10">
          <button
            onClick={handleLike}
            disabled={!user || liking}
            className={`flex items-center gap-2.5 px-6 py-3.5 rounded-full transition-all text-sm font-semibold shadow-sm focus:outline-none ${isAlreadyLiked ? 'bg-red-50 text-red-500 scale-105 border border-red-100' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'} active:scale-95 disabled:opacity-50`}
          >
            <Heart className={`h-5 w-5 ${isAlreadyLiked ? 'fill-red-500 text-red-500 animate-pulse' : 'text-gray-500'}`} />
            <span>{isAlreadyLiked ? '已点赞专栏' : '点赞赞赏文章'}</span>
            <span className="bg-white/80 backdrop-blur px-2 py-0.5 rounded-full text-xs min-w-[20px] shadow-inner text-gray-800">
              {post.likes || 0}
            </span>
          </button>
          <p className="text-[10px] text-gray-400 mt-2.5 font-medium">每位签约读者对单篇文章只能点赞或取消一次</p>
        </div>
      </article>
    </div>
  );
}
