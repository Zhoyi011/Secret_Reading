import React, { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, deleteDoc, setDoc, addDoc, collection, onSnapshot, query, where, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Post, AppUser, Bookmark, Comment, CommentReply } from '../types';
import MarkdownRenderer from './MarkdownRenderer';
import { ArrowLeft, Heart, Calendar, User, Trash2, Edit, Loader2, Sparkles, AlertTriangle, CheckCircle, X, Copy, UserPlus, UserCheck, MessageSquare, Bookmark as BookmarkIcon, Check, AlertCircle, ChevronDown } from 'lucide-react';
import ImageWrapper from './ImageWrapper';

interface PostDetailProps {
  postId: string;
  user: AppUser | null;
  onNavigate: (route: string) => void;
  onEditPost: (postId: string) => void;
  onBack: () => void;
  onSelectPost?: (postId: string) => void;
  onStartChat?: (authorId: string) => void;
  onSelectAuthor?: (authorId: string) => void;
}

export default function PostDetail({ postId, user, onNavigate, onEditPost, onBack, onSelectPost, onStartChat, onSelectAuthor }: PostDetailProps) {
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [liking, setLiking] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copiedTitle, setCopiedTitle] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const [isFollowing, setIsFollowing] = useState(false);
  const [followingLoading, setFollowingLoading] = useState(true);

  const [scrollProgress, setScrollProgress] = useState(0);

  // Expanded state for R18 content
  const [isR18Expanded, setIsR18Expanded] = useState(false);

  // Bookmark / Bookshelf state
  const [bookmarkState, setBookmarkState] = useState<'none' | 'want' | 'reading' | 'read'>('none');

  // Comments state
  const [comments, setComments] = useState<Comment[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [replyingCommentId, setReplyingCommentId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  // Report state
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('引战');
  const [reportDetails, setReportDetails] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);
  const [reasonDropdownOpen, setReasonDropdownOpen] = useState(false);

  // Recommendations
  const [relatedPosts, setRelatedPosts] = useState<Post[]>([]);

  // Monitor scroll progress
  useEffect(() => {
    if (loading || !post) return;

    const handleScroll = () => {
      const scrollHeight = document.documentElement.scrollHeight;
      const clientHeight = document.documentElement.clientHeight;
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const totalHeight = scrollHeight - clientHeight;

      if (totalHeight > 0) {
        const progress = (scrollTop / totalHeight) * 100;
        setScrollProgress(Math.min(100, Math.max(0, progress)));
      } else {
        setScrollProgress(0);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [loading, post]);

  // Load post details and increment mock views
  useEffect(() => {
    const fetchPost = async () => {
      setLoading(true);

      try {
        const postRef = doc(db, 'posts', postId);
        const postSnap = await getDoc(postRef);

        if (postSnap.exists()) {
          const loadedData = postSnap.data() as Post;
          let currentShortId = loadedData.shortId;
          if (!currentShortId) {
            currentShortId = Math.floor(100000 + Math.random() * 900000).toString();
            updateDoc(postRef, { shortId: currentShortId }).catch(err => console.warn("Failed to update shortId:", err));
            loadedData.shortId = currentShortId;
          }
          setPost({
            id: postSnap.id,
            ...loadedData,
            shortId: currentShortId,
          });

          // Sync the window path to /authorName/shortId for independent-page feeling!
          window.history.pushState(null, '', `/${encodeURIComponent(loadedData.authorName)}/${currentShortId}`);

          // Increment views count in firestore (non-blocking)
          const updatedViews = (loadedData.views || 0) + 1;
          updateDoc(postRef, { views: updatedViews }).catch(err => console.warn("Failed to update views count:", err));
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

  // Listen to follow status
  useEffect(() => {
    if (!user || !post || user.firebaseUid === post.authorId) {
      setFollowingLoading(false);
      return;
    }

    const followDocId = `${user.firebaseUid}_${post.authorId}`;
    const followRef = doc(db, 'follows', followDocId);

    const unsub = onSnapshot(followRef, (snapshot) => {
      setIsFollowing(snapshot.exists());
      setFollowingLoading(false);
    }, (err) => {
      console.error("Failed to listen to follow status:", err);
      setFollowingLoading(false);
    });

    return () => unsub();
  }, [user, post?.authorId]);

  // Listen to bookmark / bookshelf state
  useEffect(() => {
    if (!user || !postId) return;

    const bookmarkRef = doc(db, 'bookmarks', `${user.firebaseUid}_${postId}`);
    const unsub = onSnapshot(bookmarkRef, (snapshot) => {
      if (snapshot.exists()) {
        const bData = snapshot.data() as Bookmark;
        setBookmarkState(bData.state);
      } else {
        setBookmarkState('none');
      }
    }, (err) => {
      console.warn("Failed to listen to bookmark state:", err);
    });

    return () => unsub();
  }, [user, postId]);

  // Listen to comments
  useEffect(() => {
    if (!postId) return;

    const commentsRef = collection(db, 'comments');
    const q = query(commentsRef, where('postId', '==', postId));

    const unsub = onSnapshot(q, (snapshot) => {
      const loaded = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Comment[];
      // Sort comments descending by creation timestamp
      loaded.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setComments(loaded);
    }, (err) => {
      console.error("Failed to subscribe to comments:", err);
    });

    return () => unsub();
  }, [postId]);

  // Load related posts recommendations
  useEffect(() => {
    const fetchRelated = async () => {
      if (!post) return;
      try {
        const postsRef = collection(db, 'posts');
        const snap = await getDocs(query(postsRef, where('status', '==', 'published')));
        const loaded = snap.docs.map(d => ({ id: d.id, ...d.data() }) as Post);
        const filterR18Active = user?.filterR18 !== false;
        const filtered = loaded.filter(p => {
          if (p.id === post.id) return false;
          if (filterR18Active && p.isR18) return false;
          return true;
        });
        setRelatedPosts(filtered.slice(0, 3));
      } catch (err) {
        console.warn("Failed to fetch related posts:", err);
      }
    };

    fetchRelated();
  }, [post, user?.filterR18]);

  // Throttled Reading progress & History tracking
  useEffect(() => {
    if (!user || !post || scrollProgress === 0) return;

    const saveProgress = async () => {
      const roundedProgress = Math.round(scrollProgress);

      // Save reading history
      const historyRef = doc(db, 'history', `${user.firebaseUid}_${post.id}`);
      await setDoc(historyRef, {
        id: `${user.firebaseUid}_${post.id}`,
        userId: user.firebaseUid,
        postId: post.id,
        postTitle: post.title,
        authorName: post.authorName,
        coverImage: post.coverImage || post.images?.[0] || '',
        progress: roundedProgress,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      // If bookmarked, keep progress synchronized in bookshelf
      if (bookmarkState !== 'none') {
        const bookmarkRef = doc(db, 'bookmarks', `${user.firebaseUid}_${post.id}`);
        await setDoc(bookmarkRef, {
          progress: roundedProgress,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      }
    };

    const timer = setTimeout(() => {
      saveProgress().catch(err => console.warn("Background history sync failed:", err));
    }, 4000);

    return () => clearTimeout(timer);
  }, [scrollProgress, user, post?.id, bookmarkState]);

  const handleCopyTitle = async () => {
    if (!post) return;
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(post.title);
        setCopiedTitle(true);
        setTimeout(() => setCopiedTitle(false), 2000);
      } else {
        const tempTextArea = document.createElement('textarea');
        tempTextArea.value = post.title;
        document.body.appendChild(tempTextArea);
        tempTextArea.select();
        document.execCommand('copy');
        document.body.removeChild(tempTextArea);
        setCopiedTitle(true);
        setTimeout(() => setCopiedTitle(false), 2000);
      }
    } catch (err) {
      console.error("Clipboard copy failed:", err);
    }
  };

  const handleCopyLink = async () => {
    if (!post) return;
    const shareUrl = `${window.location.origin}/${encodeURIComponent(post.authorName)}/${post.shortId || ''}`;
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(shareUrl);
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      } else {
        const tempTextArea = document.createElement('textarea');
        tempTextArea.value = shareUrl;
        document.body.appendChild(tempTextArea);
        tempTextArea.select();
        document.execCommand('copy');
        document.body.removeChild(tempTextArea);
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      }
    } catch (err) {
      console.error("Clipboard copy failed:", err);
    }
  };

  const handleFollowToggle = async () => {
    if (!user || !post) return;
    const followDocId = `${user.firebaseUid}_${post.authorId}`;
    const followRef = doc(db, 'follows', followDocId);

    try {
      if (isFollowing) {
        await deleteDoc(followRef);
        setToastMessage({
          type: 'success',
          text: `已取消关注「${post.authorName}」`
        });
      } else {
        const followPayload = {
          followerId: user.firebaseUid,
          followerName: user.username,
          followerAvatar: user.avatar || '',
          followingId: post.authorId,
          followingName: post.authorName,
          followingAvatar: '',
          createdAt: new Date().toISOString()
        };
        await setDoc(followRef, followPayload);

        // Send a notification to the followed author
        const notifPayload = {
          recipientId: post.authorId,
          senderId: user.firebaseUid,
          senderName: user.username,
          senderAvatar: user.avatar || '',
          type: 'follow',
          title: '新增关注通知',
          body: `「${user.username}」关注了您！`,
          read: false,
          createdAt: new Date().toISOString(),
        };
        await addDoc(collection(db, 'notifications'), notifPayload);

        setToastMessage({
          type: 'success',
          text: `成功关注「${post.authorName}」！`
        });
      }
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err: any) {
      console.error("Follow operation failed:", err);
      setToastMessage({
        type: 'error',
        text: "关注操作失败: " + (err.message || String(err))
      });
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  const handleLike = async () => {
    if (!user || !post) return;
    if (liking) return;

    setLiking(true);
    const userId = user.firebaseUid;
    const isLiked = post.likers?.includes(userId) || false;

    const updatedLikers = isLiked
      ? (post.likers || []).filter((id) => id !== userId)
      : [...(post.likers || []), userId];

    const updatedLikesCount = updatedLikers.length;

    try {
      const postRef = doc(db, 'posts', post.id);
      await updateDoc(postRef, {
        likes: updatedLikesCount,
        likers: updatedLikers,
      });

      setPost((prev) => prev ? {
        ...prev,
        likes: updatedLikesCount,
        likers: updatedLikers,
      } : null);

      if (!isLiked && post.authorId !== userId) {
        try {
          const notifPayload = {
            recipientId: post.authorId,
            senderId: userId,
            senderName: user.username,
            senderAvatar: user.avatar || '',
            type: 'like',
            title: '文章点赞通知',
            body: `「${user.username}」赞赏了您的博文《${post.title}》`,
            postId: post.id,
            postTitle: post.title,
            read: false,
            createdAt: new Date().toISOString(),
          };
          await addDoc(collection(db, 'notifications'), notifPayload);
        } catch (notifErr) {
          console.error("Failed to push like notification:", notifErr);
        }
      }

      setToastMessage({
        type: 'success',
        text: isLiked ? "已取消赞赏！" : "点赞赞赏文章成功！"
      });
      setTimeout(() => setToastMessage(null), 3500);
    } catch (err: any) {
      console.error("Liking failed:", err);
      setToastMessage({
        type: 'error',
        text: "点赞操作失败: " + (err.message || String(err))
      });
      setTimeout(() => setToastMessage(null), 4000);
    } finally {
      setLiking(false);
    }
  };

  const handleUpdateBookmark = async (state: 'want' | 'reading' | 'read') => {
    if (!user || !post) return;

    try {
      const bookmarkRef = doc(db, 'bookmarks', `${user.firebaseUid}_${post.id}`);
      await setDoc(bookmarkRef, {
        id: `${user.firebaseUid}_${post.id}`,
        userId: user.firebaseUid,
        postId: post.id,
        postTitle: post.title,
        authorName: post.authorName,
        coverImage: post.coverImage || post.images?.[0] || '',
        state: state,
        progress: Math.round(scrollProgress),
        updatedAt: new Date().toISOString()
      });

      // Increment collections/bookmarks count on post doc
      const postRef = doc(db, 'posts', post.id);
      const postSnap = await getDoc(postRef);
      let collectsCount = 0;
      if (postSnap.exists()) {
        collectsCount = postSnap.data().collects || 0;
      }
      if (bookmarkState === 'none') {
        await updateDoc(postRef, { collects: collectsCount + 1 });
      }

      setToastMessage({
        type: 'success',
        text: `已将文章归类为 [${state === 'want' ? '想读' : state === 'reading' ? '在读' : '已读'}] 并同步至书架`
      });
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err: any) {
      console.error("Bookmark sync failed:", err);
      setToastMessage({ type: 'error', text: "同步书架失败：" + err.message });
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const handleRemoveBookmark = async () => {
    if (!user || !post) return;

    try {
      const bookmarkRef = doc(db, 'bookmarks', `${user.firebaseUid}_${post.id}`);
      await deleteDoc(bookmarkRef);

      // Decrement collects count
      const postRef = doc(db, 'posts', post.id);
      const postSnap = await getDoc(postRef);
      if (postSnap.exists()) {
        const collectsCount = postSnap.data().collects || 0;
        await updateDoc(postRef, { collects: Math.max(0, collectsCount - 1) });
      }

      setToastMessage({ type: 'success', text: "已从您的读者书架移出该文章。" });
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err: any) {
      console.error("Remove bookmark failed:", err);
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !post || !newCommentText.trim()) return;

    setSubmittingComment(true);
    try {
      const commentsRef = collection(db, 'comments');
      await addDoc(commentsRef, {
        postId: post.id,
        userId: user.firebaseUid,
        username: user.username,
        avatar: user.avatar || '',
        content: newCommentText.trim(),
        createdAt: new Date().toISOString(),
        replies: []
      });

      setNewCommentText('');
      setToastMessage({ type: 'success', text: "评论成功发表！" });
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err: any) {
      console.error("Comment submit failed:", err);
      setToastMessage({ type: 'error', text: "提交评论失败，请重试。" });
      setTimeout(() => setToastMessage(null), 3000);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleAddReply = async (commentId: string) => {
    if (!user || !post || !replyText.trim()) return;

    try {
      const commentRef = doc(db, 'comments', commentId);
      const comSnap = await getDoc(commentRef);
      if (comSnap.exists()) {
        const cData = comSnap.data() as Comment;
        const newReply: CommentReply = {
          id: `reply-${Date.now()}`,
          authorId: user.firebaseUid,
          authorName: user.username,
          content: replyText.trim(),
          createdAt: new Date().toISOString()
        };

        const updatedReplies = [...(cData.replies || []), newReply];
        await updateDoc(commentRef, { replies: updatedReplies });

        // Push notification to the comment owner
        if (cData.userId !== user.firebaseUid) {
          await addDoc(collection(db, 'notifications'), {
            recipientId: cData.userId,
            senderId: user.firebaseUid,
            senderName: user.username,
            senderAvatar: user.avatar || '',
            type: 'system',
            title: '您的评论收到了作者回复',
            body: `作者「${user.username}」回复了您在《${post.title}》下的留言`,
            postId: post.id,
            postTitle: post.title,
            read: false,
            createdAt: new Date().toISOString()
          });
        }

        setReplyText('');
        setReplyingCommentId(null);
        setToastMessage({ type: 'success', text: "作者回复已同步！" });
        setTimeout(() => setToastMessage(null), 3000);
      }
    } catch (err: any) {
      console.error("Reply submit failed:", err);
    }
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !post) return;

    setSubmittingReport(true);
    try {
      const reportsRef = collection(db, 'reports');
      await addDoc(reportsRef, {
        postId: post.id,
        postTitle: post.title,
        reporterId: user.firebaseUid,
        reporterName: user.username,
        reason: reportReason,
        details: reportDetails.trim(),
        status: 'pending',
        createdAt: new Date().toISOString()
      });

      setShowReportModal(false);
      setReportDetails('');
      setToastMessage({ type: 'success', text: "举报已妥善收到，系统安全人员会于24小时内人工核验！" });
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err: any) {
      console.error("Report submission failed:", err);
      setToastMessage({ type: 'error', text: "提交举报失败，请重试。" });
      setTimeout(() => setToastMessage(null), 4000);
    } finally {
      setSubmittingReport(false);
    }
  };

  const initiateDelete = () => {
    setShowDeleteModal(true);
  };

  const executeDelete = async () => {
    if (!post) return;
    setDeleting(true);
    setToastMessage(null);

    try {
      const postRef = doc(db, 'posts', post.id);
      await deleteDoc(postRef);

      setToastMessage({ type: 'success', text: "博文已成功永久移除！" });
      setTimeout(() => {
        setShowDeleteModal(false);
        onBack();
      }, 1500);
    } catch (err: any) {
      console.error("Delete post failed:", err);
      setToastMessage({ type: 'error', text: "删除文章出错：" + (err.message || String(err)) });
      setTimeout(() => setToastMessage(null), 4500);
    } finally {
      setDeleting(false);
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
      {/* Visual Reading Progress Bar */}
      <div className="fixed top-0 left-0 w-full h-[3px] bg-gray-100/30 z-[99] pointer-events-none">
        <div 
          className="bg-gradient-to-r from-indigo-500 to-indigo-600 h-full transition-all duration-75 ease-out shadow-[0_1px_4px_rgba(79,70,229,0.3)]"
          style={{ width: `${scrollProgress}%` }}
        />
      </div>

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
            {isAuthor && (
              <button
                onClick={() => onEditPost(post.id)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 hover:bg-indigo-100 transition-all text-xs font-semibold"
              >
                <Edit className="h-3.5 w-3.5" />
                修改编辑文章
              </button>
            )}

            {(isAuthor || isAdminOrOwner) && (
              <button
                onClick={initiateDelete}
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
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <h1 className="font-display font-bold text-gray-950 text-2xl sm:text-3.5xl tracking-tight leading-snug flex-grow flex items-center gap-2 flex-wrap">
              {post.isR18 && (
                <span className="shrink-0 bg-rose-100 text-rose-700 text-xs font-extrabold px-2.5 py-0.5 rounded-lg border border-rose-250 font-mono tracking-wide uppercase">
                  R18 限制级
                </span>
              )}
              <span>{post.title}</span>
            </h1>
            <div className="flex flex-wrap gap-2 self-start shrink-0">
              <button
                onClick={handleCopyTitle}
                className="allow-copy shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-150 text-gray-500 hover:text-indigo-600 hover:border-indigo-100 hover:bg-indigo-50/50 transition-all text-xs font-semibold shadow-2xs cursor-pointer"
                title="拷贝这篇博文的标题"
              >
                {copiedTitle ? (
                  <>
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                    <span className="text-emerald-600">已拷贝</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>拷贝标题</span>
                  </>
                )}
              </button>

              <button
                onClick={handleCopyLink}
                className="allow-copy shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-150 text-gray-500 hover:text-indigo-600 hover:border-indigo-100 hover:bg-indigo-50/50 transition-all text-xs font-semibold shadow-2xs cursor-pointer"
                title="拷贝这篇博文的分享链接"
              >
                {copiedLink ? (
                  <>
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                    <span className="text-emerald-600 font-bold">链接已复制</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5 text-indigo-500 animate-pulse" />
                    <span>复制分享链接</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-gray-500 pt-2 pb-4 border-b border-gray-100/80">
            <div className="flex flex-wrap items-center gap-4">
              <div
                onClick={() => {
                  if (onSelectAuthor) onSelectAuthor(post.authorId);
                }}
                className="flex items-center gap-1.5 text-gray-700 font-semibold hover:text-indigo-600 transition-colors cursor-pointer"
                title="查看作者专栏主页"
              >
                <User className="h-4 w-4 text-indigo-600" />
                <span>{post.authorName}</span>
              </div>

              {/* Follow / Unfollow Button */}
              {user && user.firebaseUid !== post.authorId && (
                <button
                  onClick={handleFollowToggle}
                  disabled={followingLoading}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all shadow-2xs cursor-pointer ${
                    isFollowing
                      ? 'bg-gray-100 hover:bg-gray-200 text-gray-600 border border-gray-200'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white border border-indigo-700'
                  }`}
                >
                  {followingLoading ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : isFollowing ? (
                    <>
                      <UserCheck className="h-3 w-3 text-emerald-600" />
                      <span>已关注</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-3 w-3" />
                      <span>关注作者</span>
                    </>
                  )}
                </button>
              )}

              {/* Send Private Message Button */}
              {user && user.firebaseUid !== post.authorId && onStartChat && (
                <button
                  onClick={() => onStartChat(post.authorId)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all border border-gray-250 hover:bg-gray-50 text-gray-650 cursor-pointer shadow-2xs"
                  title="向作者发私人信件交流"
                >
                  <MessageSquare className="h-3 w-3 text-indigo-500" />
                  <span>发私信</span>
                </button>
              )}

              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>{new Date(post.createdAt).toLocaleDateString()} 发布</span>
              </div>

              {post.views !== undefined && (
                <span className="text-gray-400">阅读 {post.views} 次</span>
              )}
            </div>

            {/* Abuse Report action */}
            {user && (
              <button
                onClick={() => setShowReportModal(true)}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-400 hover:text-rose-600 transition-colors"
              >
                <AlertTriangle className="h-3 w-3" />
                <span>举报此文</span>
              </button>
            )}
          </div>
        </div>

        {/* Primary cover / gallery section */}
        {((post.images && post.images.length > 0) || post.coverImage) && (
          <div className="space-y-3">
            <div className="max-w-md mx-auto w-full rounded-2xl overflow-hidden border border-gray-100 bg-gray-50 flex items-center justify-center max-h-[340px] p-1.5 shadow-2xs">
              <ImageWrapper
                src={post.images?.[0] || post.coverImage}
                alt="Post Cover Banner"
                width={500}
                className="w-full h-auto max-h-[325px] object-contain rounded-xl select-none"
                placeholderClassName="w-full h-auto max-h-[325px] rounded-xl"
              />
            </div>
            {post.images.length > 1 && (
              <div className="grid grid-cols-4 gap-2.5">
                {post.images.slice(1).map((img, idx) => (
                  <div key={idx} className="aspect-square sm:aspect-video rounded-xl overflow-hidden border border-gray-150/60 bg-gray-50 flex items-center justify-center p-0.5 hover:border-indigo-200 transition-colors cursor-zoom-in">
                    <ImageWrapper 
                      src={img} 
                      alt={`Gallery index ${idx}`} 
                      width={200}
                      className="w-full h-full object-cover rounded-lg"
                      placeholderClassName="w-full h-full rounded-lg"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Article content renderer with R18 gate fold */}
        <div className="py-2 selection:bg-indigo-100">
          {post.isR18 && !isR18Expanded ? (
            <div className="my-8 p-8 border border-red-200 bg-red-50/40 rounded-3xl text-center space-y-4 shadow-inner" id="r18-content-gate">
              <AlertTriangle className="h-10 w-10 text-red-650 mx-auto animate-bounce" />
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-gray-900">⚠️ 本文包含 R18 限制级敏感内容</h4>
                <p className="text-xs text-gray-500 leading-relaxed max-w-md mx-auto">
                  此文章已被作者或管理员标记为限制级内容，请确认您已年满 18 周岁，且处于适宜且安全的私人阅读环境中。
                </p>
              </div>
              <button
                onClick={() => setIsR18Expanded(true)}
                className="px-6 py-2.5 bg-red-650 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-red-600/10 cursor-pointer"
              >
                确认展开内容 ➔
              </button>
            </div>
          ) : (
            <MarkdownRenderer content={post.content} />
          )}
        </div>

        {/* Appreciation like footer section */}
        <div className="flex flex-col items-center justify-center pt-10 pb-4 border-t border-gray-50 mt-10">
          <button
            onClick={handleLike}
            disabled={!user || liking}
            className={`flex items-center gap-2.5 px-6 py-3.5 rounded-full transition-all text-sm font-semibold shadow-sm focus:outline-none ${isAlreadyLiked ? 'bg-red-50 text-red-500 scale-105 border border-red-100' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'} active:scale-95 disabled:opacity-50`}
          >
            <Heart className={`h-5 w-5 ${isAlreadyLiked ? 'fill-red-500 text-red-500 animate-pulse' : 'text-gray-500'}`} />
            <span>{isAlreadyLiked ? '已赞赏该博文' : '赞赏文章'}</span>
            <span className="bg-white/80 backdrop-blur px-2 py-0.5 rounded-full text-xs min-w-[20px] shadow-inner text-gray-800">
              {post.likes || 0}
            </span>
          </button>
          <p className="text-[10px] text-gray-400 mt-2.5 font-medium">每位签约读者对单篇文章只能点赞或取消一次</p>
        </div>

        {/* Bookshelf status category block */}
        {user && (
          <div className="mt-8 p-5 bg-gray-50 border border-gray-100 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-left">
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-gray-700 flex items-center gap-1">
                <BookmarkIcon className="h-4 w-4 text-indigo-600" />
                <span>同步至我的读者书架</span>
              </h4>
              <p className="text-[10px] text-gray-400 leading-normal">将文章归类至您的专属书架，便于后续一键追更及进度管理（当前阅读进度: {Math.round(scrollProgress)}%）。</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              {(['want', 'reading', 'read'] as const).map((state) => {
                const labels = { want: '想读 📖', reading: '在读 ⚡', read: '已读 🎓' };
                const active = bookmarkState === state;
                return (
                  <button
                    key={state}
                    onClick={() => handleUpdateBookmark(state)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer border ${
                      active 
                        ? 'bg-indigo-600 border-indigo-700 text-white shadow-sm font-extrabold' 
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {labels[state]}
                  </button>
                );
              })}
              {bookmarkState !== 'none' && (
                <button
                  onClick={handleRemoveBookmark}
                  className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                  title="从书架移出"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Related Recommendations Block */}
        {relatedPosts.length > 0 && (
          <div className="mt-8 space-y-4 text-left">
            <h4 className="font-display font-bold text-gray-950 text-sm flex items-center gap-2 border-b border-gray-100 pb-2">
              <Sparkles className="h-4 w-4 text-amber-500 animate-pulse" />
              <span>同人及专栏相关推荐</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {relatedPosts.map((rPost) => (
                <div
                  key={rPost.id}
                  onClick={() => {
                    if (onSelectPost) {
                      onSelectPost(rPost.id);
                    } else {
                      window.location.reload();
                    }
                  }}
                  className="group bg-white border border-gray-100 rounded-xl p-3 shadow-2xs hover:shadow-sm cursor-pointer transition-all flex flex-col space-y-2 text-left"
                >
                  <div className="h-20 rounded-lg overflow-hidden bg-gray-50">
                    <img
                      src={rPost.coverImage || rPost.images?.[0] || 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=150&q=80'}
                      alt={rPost.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  <h5 className="font-display font-semibold text-xs text-gray-900 group-hover:text-indigo-600 transition-colors line-clamp-1">
                    {rPost.title}
                  </h5>
                  <p className="text-[10px] text-gray-400 line-clamp-1">作者: {rPost.authorName}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Elegant Comments Section */}
        <div className="mt-12 border-t border-gray-100 pt-8 space-y-6 text-left" id="comments-container">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-bold text-gray-900 text-sm sm:text-base flex items-center gap-2">
              <MessageSquare className="h-4.5 w-4.5 text-indigo-600" />
              <span>专栏读者评论区 ({comments.length})</span>
            </h3>
            <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider font-mono">Reader Comments</span>
          </div>

          {/* Comment input form */}
          {user ? (
            <form onSubmit={handleSubmitComment} className="space-y-3 bg-gray-50/50 p-4 rounded-2xl border border-gray-100/60">
              <textarea
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                placeholder="写下您的共鸣、见解或针对文章排版的建言..."
                rows={3}
                maxLength={500}
                required
                className="allow-paste w-full rounded-xl border border-gray-200 p-3 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
              />
              <div className="flex justify-between items-center text-[10px] text-gray-400">
                <span>文明发言，杜绝不当广告或违法言论。</span>
                <button
                  type="submit"
                  disabled={submittingComment || !newCommentText.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs hover:shadow transition-all cursor-pointer disabled:opacity-50"
                >
                  {submittingComment ? '发表中...' : '提交评论'}
                </button>
              </div>
            </form>
          ) : (
            <div className="text-center p-6 bg-gray-50 rounded-2xl border border-gray-100/60">
              <p className="text-xs text-gray-500">请先登录账号后再参与专栏文章评论噢。</p>
            </div>
          )}

          {/* Comments list */}
          {comments.length === 0 ? (
            <div className="text-center py-8 bg-white border border-dashed border-gray-200 rounded-2xl">
              <p className="text-xs text-gray-400 font-medium animate-pulse">暂无评论，快来做第一个发表见解的人吧！</p>
            </div>
          ) : (
            <div className="space-y-4">
              {comments.map((comment) => {
                const isAuthorOfPost = user && post.authorId === user.firebaseUid;
                const isOwnerOfSite = user && user.role === 'owner';
                const canReply = isAuthorOfPost || isOwnerOfSite;

                return (
                  <div key={comment.id} className="bg-white p-4 rounded-2xl border border-gray-100/70 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={comment.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'}
                          alt={comment.username}
                          className="h-8 w-8 rounded-full object-cover border border-gray-150"
                        />
                        <div>
                          <span className="text-xs font-bold text-gray-900 block">{comment.username}</span>
                          <span className="text-[9px] text-gray-400 font-medium font-mono">
                            {new Date(comment.createdAt).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {canReply && (
                        <button
                          onClick={() => {
                            setReplyingCommentId(comment.id);
                            setReplyText('');
                          }}
                          className="text-[10px] text-indigo-600 hover:underline font-bold"
                        >
                          回复
                        </button>
                      )}
                    </div>

                    <p className="text-xs text-gray-700 leading-relaxed pl-1">{comment.content}</p>

                    {/* Render nested replies if exist */}
                    {comment.replies && comment.replies.length > 0 && (
                      <div className="mt-3 pl-3 border-l-2 border-indigo-100 space-y-2 bg-indigo-50/20 p-2.5 rounded-r-xl">
                        {comment.replies.map((reply) => (
                          <div key={reply.id} className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-bold text-indigo-700">作者「{reply.authorName}」回复：</span>
                              <span className="text-[8px] text-gray-400 font-mono">
                                {new Date(reply.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                            <p className="text-xs text-gray-600 leading-relaxed">{reply.content}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Author reply textbox */}
                    {replyingCommentId === comment.id && (
                      <div className="mt-3 p-3 bg-zinc-50 border border-zinc-200 rounded-xl space-y-2">
                        <h5 className="text-[10px] font-bold text-gray-700">回复读者评论：</h5>
                        <input
                          type="text"
                          placeholder="输入您的回复内容..."
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          className="allow-paste w-full rounded-lg border border-gray-200 p-2 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                        />
                        <div className="flex justify-end gap-2 text-[10px]">
                          <button
                            type="button"
                            onClick={() => setReplyingCommentId(null)}
                            className="px-2.5 py-1 text-gray-500 hover:bg-gray-100 rounded"
                          >
                            取消
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAddReply(comment.id)}
                            disabled={!replyText.trim()}
                            className="px-3 py-1 bg-indigo-600 text-white rounded font-semibold text-[10px] cursor-pointer"
                          >
                            确认回复
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </article>

      {/* Abuse Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 bg-zinc-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <form onSubmit={handleReportSubmit} className="bg-white rounded-3xl max-w-md w-full border border-gray-100 p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-rose-50 rounded-2xl text-rose-600">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 font-display">举报不当/敏感文章</h3>
                <p className="text-xs text-gray-400">此举报会同步至系统后台进行人工审核。</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5 relative">
                <label className="text-xs font-bold text-gray-700">举报主要原因</label>
                
                {/* Custom select trigger */}
                <button
                  type="button"
                  onClick={() => setReasonDropdownOpen(!reasonDropdownOpen)}
                  className="w-full flex items-center justify-between rounded-xl border border-gray-200 py-3 px-4 text-xs text-gray-800 bg-white hover:bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-indigo-100/50 transition-all font-medium text-left cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    {reportReason === '引战' && <span>💥 引战</span>}
                    {reportReason === 'R18内容但无加入R18标签' && <span>🔞 R18内容但无加入R18标签</span>}
                    {reportReason === '非R18博文图片带有R18图片' && <span>🖼️ 非R18博文图片带有R18图片</span>}
                  </span>
                  <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${reasonDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown popup overlay */}
                {reasonDropdownOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-10" 
                      onClick={() => setReasonDropdownOpen(false)} 
                    />
                    <div className="absolute left-0 right-0 mt-1.5 bg-white border border-gray-100 rounded-2xl shadow-xl z-20 overflow-hidden divide-y divide-gray-50/50 animate-in fade-in slide-in-from-top-1.5 duration-150">
                      {[
                        { value: '引战', label: '引战 💥', desc: '故意挑起群体冲突、侮辱或带有节奏引战倾向。' },
                        { value: 'R18内容但无加入R18标签', label: 'R18内容但无加入R18标签 🔞', desc: '博文正文包含R18敏感内容，但未正确设置或缺失R18文章标签。' },
                        { value: '非R18博文图片带有R18图片', label: '非R18博文图片带有R18图片 🖼️', desc: '博文虽未标记R18，但在插图、封面配图中含有R18敏感内容。' }
                      ].map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            setReportReason(option.value);
                            setReasonDropdownOpen(false);
                          }}
                          className={`w-full flex items-start gap-3 p-3.5 text-left hover:bg-gray-50/70 transition-colors cursor-pointer ${
                            reportReason === option.value ? 'bg-indigo-50/20' : ''
                          }`}
                        >
                          <div className={`mt-0.5 rounded-full p-1 ${
                            reportReason === option.value ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-50 text-gray-400'
                          }`}>
                            <Check className={`h-3.5 w-3.5 transition-opacity ${
                              reportReason === option.value ? 'opacity-100' : 'opacity-0'
                            }`} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className={`block text-xs font-bold ${
                              reportReason === option.value ? 'text-indigo-600' : 'text-gray-800'
                            }`}>
                              {option.label}
                            </span>
                            <span className="block text-[10px] text-gray-400 font-medium leading-normal mt-0.5">
                              {option.desc}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700">详细描述补充 (选填)</label>
                <textarea
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                  placeholder="请详细描述该博文或配图存在的违规问题..."
                  rows={3}
                  className="allow-paste block w-full rounded-xl border border-gray-200 p-3 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowReportModal(false)}
                className="flex-1 py-3 px-4 bg-gray-50 hover:bg-gray-100 text-gray-700 font-bold rounded-2xl text-xs transition-colors border border-gray-100"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={submittingReport}
                className="flex-1 py-3 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-2xl text-xs transition-colors flex items-center justify-center gap-1.5"
              >
                {submittingReport ? '正在提交...' : '确认举报'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 shadow-xl" id="custom-toast">
          <div className={`flex items-center gap-2 px-5 py-3 rounded-full border text-xs font-bold ${
            toastMessage.type === 'success' 
              ? 'bg-emerald-50 border-emerald-100 text-emerald-800' 
              : 'bg-rose-50 border-rose-100 text-rose-800'
          }`}>
            {toastMessage.type === 'success' ? (
              <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
            )}
            <span>{toastMessage.text}</span>
            <button onClick={() => setToastMessage(null)} className="ml-2 hover:opacity-75">
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}

      {/* Custom Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-zinc-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-50" id="delete-confirm-modal">
          <div className="bg-white rounded-3xl max-w-md w-full border border-gray-100 p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-rose-50 rounded-2xl text-rose-600">
                <Trash2 className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-gray-900 font-display">确认永久删除文章吗？</h3>
                <p className="text-xs text-gray-450 uppercase font-mono font-semibold tracking-wider">Dangerous Action</p>
              </div>
            </div>

            <p className="text-xs leading-relaxed text-gray-500">
              您正在请求永久删除文章 <span className="font-semibold text-gray-850 text-rose-650">「{post?.title}」</span>。此操作会将文章从数据库服务器永久移除，相关的赞赏、喜欢及排版记录也会彻底消失，且不可恢复。
            </p>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 py-3 px-4 bg-gray-50 hover:bg-gray-100 text-gray-700 font-bold rounded-2xl text-xs transition-colors border border-gray-100 flex items-center justify-center cursor-pointer disabled:opacity-50"
              >
                取消
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={executeDelete}
                className="flex-1 py-3 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-2xl text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-rose-600/10 disabled:opacity-50"
              >
                {deleting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    正在删除...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    确认永久删除
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
