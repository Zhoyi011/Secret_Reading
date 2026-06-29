import React, { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, deleteDoc, setDoc, addDoc, collection, onSnapshot, query, where, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Post, AppUser, Bookmark, Comment, CommentReply, ShortReview, AuthorQuestion } from '../types';
import MarkdownRenderer from './MarkdownRenderer';
import SeriesDirectory from './SeriesDirectory';
import { ArrowLeft, Heart, Calendar, User, Trash2, Edit, Loader2, Sparkles, AlertTriangle, CheckCircle, X, Copy, UserPlus, UserCheck, MessageSquare, Bookmark as BookmarkIcon, Check, AlertCircle, ChevronDown, Download, Star, BookOpen, Wifi, WifiOff, Smartphone, Cloud } from 'lucide-react';
import ImageWrapper from './ImageWrapper';
import { safeLocalStorage } from '../utils/safeStorage';
import { getDriveAccessToken, connectGoogleDrive, searchOrCreateFolder, backupPostToDrive } from '../utils/googleDrive';

interface PostDetailProps {
  postId: string;
  user: AppUser | null;
  onNavigate: (route: string) => void;
  onEditPost: (postId: string) => void;
  onBack: () => void;
  onSelectPost?: (postId: string) => void;
  onStartChat?: (authorId: string) => void;
  onSelectAuthor?: (authorId: string) => void;
  isFocusMode?: boolean;
  onToggleFocusMode?: (focused: boolean) => void;
}

export default function PostDetail({ postId, user, onNavigate, onEditPost, onBack, onSelectPost, onStartChat, onSelectAuthor, isFocusMode = false, onToggleFocusMode }: PostDetailProps) {
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

  const [isOfflineSaved, setIsOfflineSaved] = useState(false);
  const [backingUpToDrive, setBackingUpToDrive] = useState(false);
  const [showDriveAuthModal, setShowDriveAuthModal] = useState(false);
  const [isOnline, setIsOnline] = useState(() => typeof navigator !== 'undefined' ? navigator.onLine : true);

  // Monitor network status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Check if post is saved for offline
  useEffect(() => {
    if (!postId) return;
    const offlineListStr = safeLocalStorage.getItem('offline_saved_posts');
    if (offlineListStr) {
      try {
        const list = JSON.parse(offlineListStr) as any[];
        setIsOfflineSaved(list.some(p => p.id === postId));
      } catch (e) {
        console.warn("Failed to parse offline list:", e);
      }
    } else {
      setIsOfflineSaved(false);
    }
  }, [postId]);

  const handleToggleOfflineSave = () => {
    if (!post) return;
    try {
      const offlineListStr = safeLocalStorage.getItem('offline_saved_posts');
      let list: any[] = [];
      if (offlineListStr) {
        list = JSON.parse(offlineListStr);
      }
      
      if (isOfflineSaved) {
        const updatedList = list.filter(p => p.id !== post.id);
        safeLocalStorage.setItem('offline_saved_posts', JSON.stringify(updatedList));
        safeLocalStorage.removeItem(`offline_post_${post.id}`);
        setIsOfflineSaved(false);
        setToastMessage({
          type: 'success',
          text: '已成功移除该文章的离线缓存。'
        });
      } else {
        if (!list.some(p => p.id === post.id)) {
          list.push({
            id: post.id,
            title: post.title,
            authorName: post.authorName,
            coverImage: post.coverImage || post.images?.[0] || '',
            isR18: post.isR18 || false,
            shortId: post.shortId || '',
            createdAt: post.createdAt,
            savedAt: new Date().toISOString()
          });
        }
        safeLocalStorage.setItem('offline_saved_posts', JSON.stringify(list));
        safeLocalStorage.setItem(`offline_post_${post.id}`, JSON.stringify(post));
        setIsOfflineSaved(true);
        setToastMessage({
          type: 'success',
          text: '文章已妥善缓存，您可以在「离线模式」下随时畅读！'
        });
      }
      setTimeout(() => setToastMessage(null), 3000);
    } catch (e) {
      console.error("Failed to toggle offline save:", e);
      setToastMessage({
        type: 'error',
        text: '保存至离线阅读失败，请检查浏览器存储空间。'
      });
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const handleDownloadMarkdown = () => {
    if (!post) return;
    const element = document.createElement("a");
    const file = new Blob([post.content], { type: 'text/markdown;charset=utf-8' });
    element.href = URL.createObjectURL(file);
    element.download = `${post.title || 'post'}.md`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleBackupToDrive = async (forceAuthPopup = false) => {
    if (!post || backingUpToDrive) return;
    
    if (!isOnline) {
      setToastMessage({
        type: 'error',
        text: '您当前处于离线状态，无法使用 Google Drive 备份，请连接网络后重试。'
      });
      setTimeout(() => setToastMessage(null), 3000);
      return;
    }

    let token = getDriveAccessToken();
    
    if (!token || forceAuthPopup) {
      setShowDriveAuthModal(true);
      return;
    }

    setBackingUpToDrive(true);
    try {
      const folderId = await searchOrCreateFolder(token);
      await backupPostToDrive(token, post, folderId);
      setToastMessage({
        type: 'success',
        text: `🎉 成功备份至 Google Drive！已保存在您的「私密阅读专栏备份」文件夹中。`
      });
    } catch (err: any) {
      console.error('Drive backup failed:', err);
      if (err?.message?.includes('授权失效') || err?.status === 401) {
        setShowDriveAuthModal(true);
      } else {
        setToastMessage({
          type: 'error',
          text: `备份失败: ${err.message || err}`
        });
      }
    } finally {
      setBackingUpToDrive(false);
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  const [recommending, setRecommending] = useState(false);

  const handleToggleRecommend = async () => {
    if (!post || !user || user.role !== 'owner' || recommending) return;
    setRecommending(true);
    try {
      const postRef = doc(db, 'posts', post.id);
      const currentlyRecommended = !!post.isRecommended;
      const isStillValid = currentlyRecommended && post.recommendedAt && (new Date().getTime() - new Date(post.recommendedAt).getTime() < 48 * 60 * 60 * 1000);
      
      const newRecommendedState = !isStillValid;
      const payload = {
        isRecommended: newRecommendedState,
        recommendedAt: newRecommendedState ? new Date().toISOString() : null,
      };
      
      await updateDoc(postRef, payload);
      setPost(prev => prev ? { ...prev, ...payload } : null);
      setToastMessage({
        type: 'success',
        text: newRecommendedState ? '该作品已被站长亲自推荐，将在首页置顶展示48小时！' : '已取消站长推荐。',
      });
    } catch (err) {
      console.error('Error toggling recommendation:', err);
      setToastMessage({
        type: 'error',
        text: '更新推荐状态失败，请重试。'
      });
    } finally {
      setRecommending(false);
    }
  };

  // Expanded state for R18 content
  const [isR18Expanded, setIsR18Expanded] = useState(false);
  const [showR18Warning, setShowR18Warning] = useState(false);

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
  const [authorPosts, setAuthorPosts] = useState<Post[]>([]);
  const [tagMatchedPosts, setTagMatchedPosts] = useState<Post[]>([]);
  const [guessYouLikePosts, setGuessYouLikePosts] = useState<Post[]>([]);

  // Reader Short Reviews (读后感) states
  const [shortReviews, setShortReviews] = useState<ShortReview[]>([]);
  const [newReview, setNewReview] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  // Author Questions (问作者) states
  const [authorQuestions, setAuthorQuestions] = useState<AuthorQuestion[]>([]);
  const [newQuestion, setNewQuestion] = useState('');
  const [questionSubmitting, setQuestionSubmitting] = useState(false);
  const [answeringQuestionId, setAnsweringQuestionId] = useState<string | null>(null);
  const [newAnswer, setNewAnswer] = useState('');
  const [answerSubmitting, setAnswerSubmitting] = useState(false);

  // Author growth level state
  const [authorAllPosts, setAuthorAllPosts] = useState<Post[]>([]);

  // Series/连载 states
  const [seriesChapters, setSeriesChapters] = useState<Post[]>([]);
  const [userProgressMap, setUserProgressMap] = useState<Record<string, number>>({});

  // Fetch series chapters when post.seriesId is present
  useEffect(() => {
    if (!post || !post.seriesId) {
      setSeriesChapters([]);
      return;
    }

    const fetchChapters = async () => {
      try {
        const q = query(
          collection(db, 'posts'),
          where('seriesId', '==', post.seriesId),
          where('status', '==', 'published')
        );
        const snap = await getDocs(q);
        const docsList = snap.docs.map(d => ({ id: d.id, ...d.data() }) as Post);
        docsList.sort((a, b) => (a.seriesOrder || 0) - (b.seriesOrder || 0));
        setSeriesChapters(docsList);
      } catch (err) {
        console.error("Failed to fetch series chapters:", err);
      }
    };

    fetchChapters();
  }, [post?.seriesId]);

  // Fetch reading history for each of these chapters to map reading progress
  useEffect(() => {
    if (!user || !post || !post.seriesId) {
      setUserProgressMap({});
      return;
    }

    const fetchProgress = async () => {
      try {
        const q = query(collection(db, 'history'), where('userId', '==', user.firebaseUid));
        const snap = await getDocs(q);
        const progMap: Record<string, number> = {};
        snap.docs.forEach(docSnap => {
          const data = docSnap.data();
          if (data.postId) {
            progMap[data.postId] = data.progress || 0;
          }
        });
        setUserProgressMap(progMap);
      } catch (err) {
        console.warn("Failed to fetch user reading progress for series:", err);
      }
    };

    fetchProgress();
  }, [user, post?.seriesId]);

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
          const fullPost: Post = {
            id: postSnap.id,
            ...loadedData,
            shortId: currentShortId,
          };
          setPost(fullPost);

          if (loadedData.isR18) {
            setShowR18Warning(true);
          }

          // Sync the window path to /authorName/shortId for independent-page feeling!
          window.history.pushState(null, '', `/${encodeURIComponent(loadedData.authorName)}/${currentShortId}`);

          // Increment views count in firestore (non-blocking)
          const updatedViews = (loadedData.views || 0) + 1;
          updateDoc(postRef, { views: updatedViews }).catch(err => console.warn("Failed to update views count:", err));

          // Auto-update offline cache if it was already marked for offline
          const offlineListStr = safeLocalStorage.getItem('offline_saved_posts');
          if (offlineListStr) {
            try {
              const list = JSON.parse(offlineListStr) as any[];
              if (list.some(p => p.id === postId)) {
                safeLocalStorage.setItem(`offline_post_${postId}`, JSON.stringify(fullPost));
              }
            } catch (e) {
              console.warn("Error parsing offline list for auto-cache update", e);
            }
          }
        } else {
          console.error("No such article post available");
          // Try to load from offline cache as fallback!
          const cached = safeLocalStorage.getItem(`offline_post_${postId}`);
          if (cached) {
            try {
              const parsed = JSON.parse(cached) as Post;
              setPost(parsed);
              if (parsed.isR18) {
                setShowR18Warning(true);
              }
              setToastMessage({ type: 'success', text: '您当前处于离线状态，已为您加载本地缓存版本。' });
              setTimeout(() => setToastMessage(null), 4000);
            } catch (e) {
              console.error("Failed to parse cached post:", e);
            }
          }
        }
      } catch (err) {
        console.error("Failed to load post detail:", err);
        // Try to load from offline cache as fallback!
        const cached = safeLocalStorage.getItem(`offline_post_${postId}`);
        if (cached) {
          try {
            const parsed = JSON.parse(cached) as Post;
            setPost(parsed);
            if (parsed.isR18) {
              setShowR18Warning(true);
            }
            setToastMessage({ type: 'success', text: '网络连接受限，已为您加载已下载的离线版本。' });
            setTimeout(() => setToastMessage(null), 4000);
          } catch (e) {
            console.error("Failed to parse cached post on error fallback:", e);
          }
        }
      } finally {
        setLoading(false);
      }
    };

    fetchPost();
  }, [postId]);

  // Record access in history immediately when post is set
  useEffect(() => {
    if (!user || !post) return;
    
    const recordAccess = async () => {
      try {
        const historyRef = doc(db, 'history', `${user.firebaseUid}_${post.id}`);
        // Fetch existing first to avoid resetting any previously saved higher scroll progress
        const docSnap = await getDoc(historyRef);
        let existingProgress = 0;
        if (docSnap.exists()) {
          existingProgress = docSnap.data().progress || 0;
        }
        await setDoc(historyRef, {
          id: `${user.firebaseUid}_${post.id}`,
          userId: user.firebaseUid,
          postId: post.id,
          postTitle: post.title,
          authorName: post.authorName,
          coverImage: post.coverImage || post.images?.[0] || '',
          progress: existingProgress,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } catch (err) {
        console.warn("Failed to record access in history:", err);
      }
    };
    
    recordAccess();
  }, [post?.id, user?.firebaseUid]);

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
    if (!postId || !user) return;

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
  }, [postId, user]);

  // Load related posts and multi-way recommendations
  useEffect(() => {
    const fetchRecommendations = async () => {
      if (!post) return;
      try {
        const postsRef = collection(db, 'posts');
        const snap = await getDocs(query(postsRef, where('status', '==', 'published')));
        const loaded = snap.docs.map(d => ({ id: d.id, ...d.data() }) as Post);
        const filterR18Active = user?.filterR18 !== false;
        
        // Exclude current post and respect R18 filters
        const eligiblePosts = loaded.filter(p => {
          if (p.id === post.id) return false;
          if (filterR18Active && p.isR18) return false;
          return true;
        });

        // 1. 同作者更多作品
        const sameAuthor = eligiblePosts
          .filter(p => p.authorId === post.authorId)
          .sort((a, b) => (b.views || 0) - (a.views || 0))
          .slice(0, 3);
        setAuthorPosts(sameAuthor);

        // 2. 看过这篇的人也看了 (Overlap tags)
        const matchedTags = eligiblePosts
          .filter(p => p.authorId !== post.authorId) // different author
          .map(p => {
            const overlapCount = (p.tags || []).filter(t => (post.tags || []).includes(t)).length;
            return { post: p, overlapCount };
          })
          .filter(item => item.overlapCount > 0)
          .sort((a, b) => b.overlapCount - a.overlapCount || (b.post.likes || 0) - (a.post.likes || 0))
          .map(item => item.post)
          .slice(0, 3);
        setTagMatchedPosts(matchedTags);

        // 3. 猜你喜欢 (Overall top engaging, prioritizing shared tags with reader interests/history)
        const guess = eligiblePosts
          .filter(p => !sameAuthor.some(sa => sa.id === p.id) && !matchedTags.some(mt => mt.id === p.id))
          .sort((a, b) => {
            const scoreA = (a.likes || 0) * 3 + (a.views || 0) + (a.collects || 0) * 5;
            const scoreB = (b.likes || 0) * 3 + (b.views || 0) + (b.collects || 0) * 5;
            return scoreB - scoreA;
          })
          .slice(0, 3);
        setGuessYouLikePosts(guess);

        // Fallback for legacy relatedPosts state (keep it working so no compilation/prop bugs)
        setRelatedPosts(eligiblePosts.slice(0, 3));
      } catch (err) {
        console.warn("Failed to fetch recommendations:", err);
      }
    };

    fetchRecommendations();
  }, [post, user?.filterR18]);

  // Reader Short Reviews (读后感) real-time listener
  useEffect(() => {
    if (!postId) return;
    const q = query(collection(db, 'short_reviews'), where('postId', '==', postId));
    const unsub = onSnapshot(q, (snap) => {
      const loaded: ShortReview[] = [];
      snap.forEach((d) => {
        loaded.push({ id: d.id, ...d.data() } as ShortReview);
      });
      // Sort: Featured first, then newest first
      loaded.sort((a, b) => {
        if (a.isFeatured !== b.isFeatured) {
          return a.isFeatured ? -1 : 1;
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      setShortReviews(loaded);
    }, (err) => {
      console.error("Failed to load short reviews:", err);
    });
    return () => unsub();
  }, [postId]);

  // Author Questions (问作者) real-time listener
  useEffect(() => {
    if (!postId) return;
    const q = query(collection(db, 'questions'), where('postId', '==', postId));
    const unsub = onSnapshot(q, (snap) => {
      const loaded: AuthorQuestion[] = [];
      snap.forEach((d) => {
        loaded.push({ id: d.id, ...d.data() } as AuthorQuestion);
      });
      // Sort: Newest first
      loaded.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setAuthorQuestions(loaded);
    }, (err) => {
      console.error("Failed to load author questions:", err);
    });
    return () => unsub();
  }, [postId]);

  // Fetch author posts to calculate growth level
  useEffect(() => {
    if (!post?.authorId) return;
    const q = query(collection(db, 'posts'), where('authorId', '==', post.authorId), where('status', '==', 'published'));
    getDocs(q).then(snap => {
      const loaded = snap.docs.map(d => ({ id: d.id, ...d.data() }) as Post);
      setAuthorAllPosts(loaded);
    }).catch(err => console.error("Failed to load author all posts for level:", err));
  }, [post?.authorId]);

  // Helper functions for short reviews and questions
  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOnline) {
      setToastMessage({ type: 'error', text: '您当前处于离线模式，无法提交短评，请连接网络后重试。' });
      setTimeout(() => setToastMessage(null), 3000);
      return;
    }
    if (!user || !postId || !newReview.trim() || reviewSubmitting) return;
    setReviewSubmitting(true);
    try {
      await addDoc(collection(db, 'short_reviews'), {
        postId,
        userId: user.firebaseUid,
        username: user.username,
        avatar: user.avatar || '',
        content: newReview.trim(),
        isFeatured: false,
        createdAt: new Date().toISOString()
      });
      setNewReview('');
      setToastMessage({ type: 'success', text: '发布短评成功！欢迎作者精选推荐。' });
    } catch (err) {
      console.error("Failed to submit short review:", err);
      setToastMessage({ type: 'error', text: '发布失败，请重试。' });
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleToggleFeatureReview = async (reviewId: string, currentFeatured: boolean) => {
    if (!isOnline) {
      setToastMessage({ type: 'error', text: '您当前处于离线模式，无法管理精选。' });
      setTimeout(() => setToastMessage(null), 3000);
      return;
    }
    if (!user || !post || user.firebaseUid !== post.authorId) return;
    try {
      const reviewRef = doc(db, 'short_reviews', reviewId);
      await updateDoc(reviewRef, { isFeatured: !currentFeatured });
      setToastMessage({ type: 'success', text: !currentFeatured ? '已设为精选短评！将在顶部优先展示。' : '已取消精选。' });
    } catch (err) {
      console.error("Failed to toggle feature review:", err);
    }
  };

  const handleAskQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOnline) {
      setToastMessage({ type: 'error', text: '您当前处于离线模式，无法向作者提问。' });
      setTimeout(() => setToastMessage(null), 3000);
      return;
    }
    if (!user || !postId || !newQuestion.trim() || questionSubmitting) return;
    setQuestionSubmitting(true);
    try {
      await addDoc(collection(db, 'questions'), {
        postId,
        userId: user.firebaseUid,
        username: user.username,
        avatar: user.avatar || '',
        question: newQuestion.trim(),
        createdAt: new Date().toISOString()
      });
      setNewQuestion('');
      setToastMessage({ type: 'success', text: '提问成功！请耐心等待作者回复。' });
    } catch (err) {
      console.error("Failed to submit question:", err);
      setToastMessage({ type: 'error', text: '提问失败，请重试。' });
    } finally {
      setQuestionSubmitting(false);
    }
  };

  const handleAnswerQuestion = async (questionId: string) => {
    if (!user || !post || user.firebaseUid !== post.authorId || !newAnswer.trim() || answerSubmitting) return;
    setAnswerSubmitting(true);
    try {
      const questionRef = doc(db, 'questions', questionId);
      await updateDoc(questionRef, {
        answer: newAnswer.trim(),
        answeredAt: new Date().toISOString()
      });
      setNewAnswer('');
      setAnsweringQuestionId(null);
      setToastMessage({ type: 'success', text: '已回复读者提问！' });
    } catch (err) {
      console.error("Failed to answer question:", err);
      setToastMessage({ type: 'error', text: '回复失败，请重试。' });
    } finally {
      setAnswerSubmitting(false);
    }
  };

  // Author Growth Level MEMO
  const authorGrowth = React.useMemo(() => {
    const count = authorAllPosts.length;
    const totalLikes = authorAllPosts.reduce((sum, p) => sum + (p.likes || 0), 0);
    const totalViews = authorAllPosts.reduce((sum, p) => sum + (p.views || 0), 0);
    const points = count * 20 + totalLikes * 8 + totalViews * 1;
    
    let level = '青铜作家';
    let nextLevel = '白银作家';
    let minPoints = 0;
    let nextPoints = 120;
    let badgeColor = 'from-amber-600 to-amber-500';
    let icon = '🥉';
    
    if (points >= 1500) {
      level = '钻石作家';
      nextLevel = '已达最高级';
      minPoints = 1500;
      nextPoints = 1500;
      badgeColor = 'from-cyan-600 to-indigo-500';
      icon = '💎';
    } else if (points >= 500) {
      level = '黄金作家';
      nextLevel = '钻石作家';
      minPoints = 500;
      nextPoints = 1500;
      badgeColor = 'from-yellow-500 to-amber-500';
      icon = '🥇';
    } else if (points >= 120) {
      level = '白银作家';
      nextLevel = '黄金作家';
      minPoints = 120;
      nextPoints = 500;
      badgeColor = 'from-slate-500 to-slate-400';
      icon = '🥈';
    }
    
    const percent = nextPoints === minPoints ? 100 : Math.min(100, Math.max(0, ((points - minPoints) / (nextPoints - minPoints)) * 100));
    return { level, nextLevel, points, nextPoints, percent, badgeColor, icon };
  }, [authorAllPosts]);

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
    const shareUrl = `https://secret-reading.vercel.app/${encodeURIComponent(post.authorName)}/${post.shortId || ''}`;
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
    if (!isOnline) {
      setToastMessage({ type: 'error', text: '您当前处于离线模式，无法发表评论。' });
      setTimeout(() => setToastMessage(null), 3000);
      return;
    }
    if (!user || !post || !newCommentText.trim()) return;

    if (user.isMuted) {
      setToastMessage({ type: 'error', text: "您已被管理员禁言，无法发表评论。如有疑问请联系客服/站长。" });
      setTimeout(() => setToastMessage(null), 4000);
      return;
    }

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

    if (user.isMuted) {
      setToastMessage({ type: 'error', text: "您已被管理员禁言，无法进行回复。如有疑问请联系客服/站长。" });
      setTimeout(() => setToastMessage(null), 4000);
      return;
    }

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

  const currentChapterIndex = post ? seriesChapters.findIndex(ch => ch.id === post.id) : -1;
  const prevChapter = currentChapterIndex > 0 ? seriesChapters[currentChapterIndex - 1] : null;
  const nextChapter = currentChapterIndex >= 0 && currentChapterIndex < seriesChapters.length - 1 ? seriesChapters[currentChapterIndex + 1] : null;

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
      {!isFocusMode ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-8">
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <button
              onClick={onBack}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-gray-100 text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-all font-medium text-xs shadow-sm cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>返回列表</span>
            </button>

            <button
              onClick={() => onToggleFocusMode?.(true)}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 hover:bg-indigo-100 hover:text-indigo-700 transition-all font-bold text-xs shadow-sm cursor-pointer"
              title="进入无干扰沉浸阅读模式"
            >
              <BookOpen className="h-3.5 w-3.5 text-indigo-500" />
              <span>沉浸模式</span>
            </button>

            <button
              onClick={handleToggleOfflineSave}
              className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all text-xs font-bold shadow-sm cursor-pointer ${
                isOfflineSaved
                  ? 'bg-emerald-50 border-emerald-150 text-emerald-700 hover:bg-emerald-100'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
              title={isOfflineSaved ? '已保存离线缓存，点击可取消' : '保存该文至本地，无网环境下亦可畅读'}
            >
              {isOfflineSaved ? (
                <>
                  <Smartphone className="h-3.5 w-3.5 text-emerald-600" />
                  <span>已存离线</span>
                </>
              ) : (
                <>
                  <Smartphone className="h-3.5 w-3.5 text-gray-400" />
                  <span>离线保存</span>
                </>
              )}
            </button>
          </div>

          {user && (isAuthor || isAdminOrOwner) && (
            <div className="flex flex-wrap items-center justify-end gap-1.5 w-full sm:w-auto">
              {user.role === 'owner' && post.status === 'published' && (
                <button
                  disabled={recommending}
                  onClick={handleToggleRecommend}
                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border transition-all text-xs font-semibold cursor-pointer disabled:opacity-50 ${
                    post.isRecommended && post.recommendedAt && (new Date().getTime() - new Date(post.recommendedAt).getTime() < 48 * 60 * 60 * 1000)
                      ? 'bg-amber-100 border-amber-200 text-amber-800 hover:bg-amber-200'
                      : 'bg-white border-amber-200 text-amber-700 hover:bg-amber-50'
                  }`}
                  title="置顶推荐博文 48 小时"
                >
                  <Star className={`h-3.5 w-3.5 ${post.isRecommended && post.recommendedAt && (new Date().getTime() - new Date(post.recommendedAt).getTime() < 48 * 60 * 60 * 1000) ? 'fill-amber-500 text-amber-600' : ''}`} />
                  <span className="hidden sm:inline">
                    {post.isRecommended && post.recommendedAt && (new Date().getTime() - new Date(post.recommendedAt).getTime() < 48 * 60 * 60 * 1000) ? '取消推荐' : '站长推荐'}
                  </span>
                  <span className="sm:hidden">推荐</span>
                </button>
              )}
              {isAuthor && (
                <>
                  <button
                    onClick={handleDownloadMarkdown}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-600 hover:bg-emerald-100 transition-all text-xs font-semibold cursor-pointer"
                    title="导出文章为 Markdown 源文件"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">导出 Markdown</span>
                    <span className="sm:hidden">导出</span>
                  </button>
                  <button
                    disabled={backingUpToDrive}
                    onClick={() => handleBackupToDrive()}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-600 border border-indigo-500 text-white hover:bg-indigo-700 transition-all text-xs font-semibold cursor-pointer disabled:opacity-60"
                    title="安全备份此博文内容至您的 Google Drive 账户"
                  >
                    {backingUpToDrive ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Cloud className="h-3.5 w-3.5" />
                    )}
                    <span className="hidden sm:inline">Drive 云备份</span>
                    <span className="sm:hidden">云备份</span>
                  </button>
                  <button
                    onClick={() => onEditPost(post.id)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 hover:bg-indigo-100 transition-all text-xs font-semibold"
                    title="编辑文章"
                  >
                    <Edit className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">修改编辑</span>
                    <span className="sm:hidden">编辑</span>
                  </button>
                </>
              )}

              {(isAuthor || isAdminOrOwner) && (
                <button
                  onClick={initiateDelete}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-50 border border-rose-100 text-rose-600 hover:bg-rose-100 transition-all text-xs font-semibold"
                  title="删除文章"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">删除文章</span>
                  <span className="sm:hidden">删除</span>
                </button>
              )}
            </div>
          )}
        </div>
      ) : null}

      {/* Main post container */}
      <article className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 sm:p-10 space-y-6">
        {!isOnline && (
          <div className="flex items-start gap-2.5 p-3.5 bg-amber-50/75 rounded-2xl border border-amber-100 text-amber-800 text-xs font-semibold leading-relaxed mb-4">
            <WifiOff className="h-4 w-4 text-amber-600 animate-pulse shrink-0 mt-0.5" />
            <span>您目前处于离线模式。当前展示的是本地安全缓存的离线版本。部分动态评论/提问推荐板块将暂停提交，直到网络恢复。</span>
          </div>
        )}
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
            {!isFocusMode && (
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
            )}
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

              {/* Author Level Badge */}
              <div 
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-gradient-to-r ${authorGrowth.badgeColor} text-white shadow-3xs border border-white/25 cursor-help`}
                title={`作者成长指数: ${authorGrowth.points} 积分。距离下一阶段需要 ${authorGrowth.nextPoints} 积分。`}
              >
                <span className="text-xs">{authorGrowth.icon}</span>
                <span>{authorGrowth.level}</span>
              </div>

              {/* Follow / Unfollow Button */}
              {user && user.firebaseUid !== post.authorId && !isFocusMode && (
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
              {user && user.firebaseUid !== post.authorId && onStartChat && !isFocusMode && (
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
            {user && !isFocusMode && (
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
            <div className={`max-w-md mx-auto w-full rounded-2xl overflow-hidden border border-gray-100 bg-gray-50 flex items-center justify-center max-h-[340px] p-1.5 shadow-2xs relative transition-all duration-500 ${
              post.isR18 && !isR18Expanded ? 'filter blur-3xl saturate-0 scale-95 select-none pointer-events-none' : ''
            }`}>
              <ImageWrapper
                src={post.images?.[0] || post.coverImage}
                alt="Post Cover Banner"
                width={500}
                className="w-full h-auto max-h-[325px] object-contain rounded-xl select-none"
                placeholderClassName="w-full h-auto max-h-[325px] rounded-xl"
              />
              {post.isR18 && !isR18Expanded && (
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center p-3 text-center">
                  <span className="bg-red-600/90 text-white text-[10px] font-bold px-2 py-1 rounded-lg shadow border border-red-500 flex items-center gap-1 animate-pulse">
                    🔞 R18 限制级内容已打码
                  </span>
                </div>
              )}
            </div>
            {post.images.length > 1 && (
              <div className="grid grid-cols-4 gap-2.5">
                {post.images.slice(1).map((img, idx) => (
                  <div key={idx} className={`aspect-square sm:aspect-video rounded-xl overflow-hidden border border-gray-150/60 bg-gray-50 flex items-center justify-center p-0.5 hover:border-indigo-200 transition-colors cursor-zoom-in relative transition-all duration-500 ${
                    post.isR18 && !isR18Expanded ? 'filter blur-2xl saturate-0 select-none pointer-events-none' : ''
                  }`}>
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
            <div className="my-8 p-8 border border-red-250 bg-red-50/50 rounded-3xl text-center space-y-4 shadow-xs" id="r18-content-gate">
              <AlertTriangle className="h-10 w-10 text-red-650 mx-auto animate-bounce" />
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-gray-900">⚠️ 本文包含 R18 限制级敏感内容</h4>
                <p className="text-xs text-gray-500 leading-relaxed max-w-md mx-auto">
                  此文章已被作者或管理员标记为限制级内容，请确认您已年满 18 周岁，且处于适宜且安全的私人阅读环境中。
                </p>
              </div>
              <button
                onClick={() => {
                  setIsR18Expanded(true);
                  setShowR18Warning(false);
                }}
                className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-extrabold rounded-xl transition-all shadow-md shadow-red-600/20 cursor-pointer font-sans"
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

        {/* Series Navigation and Directory Segment */}
        {post && post.seriesId && seriesChapters.length > 0 && (
          <div className="mt-8 pt-8 border-t border-gray-100 space-y-6">
            {/* Previous / Next Chapter Navigation */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Previous Chapter */}
              {prevChapter ? (
                <button
                  onClick={() => onSelectPost?.(prevChapter.id)}
                  className="flex flex-col items-start p-4 bg-white border border-gray-150/80 rounded-xl text-left hover:border-indigo-300 hover:bg-indigo-50/10 transition-all cursor-pointer group shadow-3xs"
                >
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider group-hover:text-indigo-500 transition-colors flex items-center gap-1">
                    ← 上一篇 (第 {prevChapter.seriesOrder || currentChapterIndex} 篇)
                  </span>
                  <span className="text-xs font-bold text-gray-800 mt-1 line-clamp-1 group-hover:text-indigo-950">
                    {prevChapter.title}
                  </span>
                </button>
              ) : (
                <div className="flex flex-col items-start p-4 bg-gray-50/50 border border-dashed border-gray-200 rounded-xl text-left select-none opacity-60">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    ← 上一篇
                  </span>
                  <span className="text-xs font-medium text-gray-450 mt-1">
                    已经是本系列第一篇
                  </span>
                </div>
              )}

              {/* Next Chapter */}
              {nextChapter ? (
                <button
                  onClick={() => onSelectPost?.(nextChapter.id)}
                  className="flex flex-col items-end p-4 bg-white border border-gray-150/80 rounded-xl text-right hover:border-indigo-300 hover:bg-indigo-50/10 transition-all cursor-pointer group shadow-3xs"
                >
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider group-hover:text-indigo-500 transition-colors flex items-center gap-1">
                    下一篇 (第 {nextChapter.seriesOrder || (currentChapterIndex + 2)} 篇) →
                  </span>
                  <span className="text-xs font-bold text-gray-800 mt-1 line-clamp-1 group-hover:text-indigo-950">
                    {nextChapter.title}
                  </span>
                </button>
              ) : (
                <div className="flex flex-col items-end p-4 bg-gray-50/50 border border-dashed border-gray-200 rounded-xl text-right select-none opacity-60">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    下一篇 →
                  </span>
                  <span className="text-xs font-medium text-gray-450 mt-1">
                    已经是本系列最后一篇
                  </span>
                </div>
              )}
            </div>

            {/* Series Directory Table of Contents */}
            <SeriesDirectory
              seriesId={post.seriesId}
              seriesTitle={post.seriesTitle || '未知系列'}
              currentPostId={post.id}
              user={user}
              onSelectPost={(id) => onSelectPost?.(id)}
              chapters={seriesChapters}
              userProgressMap={userProgressMap}
            />
          </div>
        )}

        {/* Bookshelf status category block */}
        {user && !isFocusMode && (
          <div className="mt-8 p-5 bg-gray-50 border border-gray-100 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-left">
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-gray-700 flex items-center gap-1">
                <BookmarkIcon className="h-4 w-4 text-indigo-600" />
                <span>同步至我的读者书架</span>
              </h4>
              <p className="text-[10px] text-gray-400 leading-normal">将文章归类至您的专属书架，便于后续一键追更及进度 management（当前阅读进度: {Math.round(scrollProgress)}%）。</p>
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

        {/* Smart Multi-dimensional Recommendations */}
        {!isFocusMode && (
          <div className="mt-12 space-y-8 text-left border-t border-gray-100 pt-8" id="smart-recommendations-panel">
            {/* Row 1: Overlapping Tags matching - 看过这篇的人也看了 */}
            {tagMatchedPosts.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-gray-50 pb-2">
                  <h4 className="font-display font-bold text-gray-800 text-xs sm:text-sm flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-indigo-500" />
                    <span>看过这篇的人也看了 (同类题材)</span>
                  </h4>
                  <span className="text-[10px] text-indigo-500 font-bold bg-indigo-50 px-2 py-0.5 rounded-full">标签重合度匹配</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {tagMatchedPosts.map((rPost) => (
                    <div
                      key={rPost.id}
                      onClick={() => onSelectPost?.(rPost.id)}
                      className="group bg-white border border-gray-100/80 rounded-xl p-3 shadow-3xs hover:shadow-2xs cursor-pointer transition-all flex flex-col space-y-2 text-left"
                    >
                      <div className="h-24 rounded-lg overflow-hidden bg-gray-50 relative shrink-0">
                        <img
                          src={rPost.coverImage || rPost.images?.[0] || 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=300&q=80'}
                          alt={rPost.title}
                          className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
                        />
                        {rPost.tags && rPost.tags.length > 0 && (
                          <span className="absolute bottom-1.5 left-1.5 text-[8px] bg-black/70 text-white font-bold px-1.5 py-0.5 rounded">
                            #{rPost.tags[0]}
                          </span>
                        )}
                      </div>
                      <h5 className="font-display font-bold text-xs text-gray-900 group-hover:text-indigo-600 transition-colors line-clamp-1">
                        {rPost.title}
                      </h5>
                      <div className="flex items-center justify-between text-[10px] text-gray-400">
                        <span>作者: {rPost.authorName}</span>
                        <span className="text-rose-500 font-bold">❤️ {rPost.likes || 0}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Row 2: Same author - 同作者更多作品 */}
            {authorPosts.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-gray-50 pb-2">
                  <h4 className="font-display font-bold text-gray-800 text-xs sm:text-sm flex items-center gap-1.5">
                    <User className="h-4 w-4 text-emerald-500" />
                    <span>该作者的更多作品</span>
                  </h4>
                  <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full">名作推荐</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {authorPosts.map((rPost) => (
                    <div
                      key={rPost.id}
                      onClick={() => onSelectPost?.(rPost.id)}
                      className="group bg-white border border-gray-100/80 rounded-xl p-3 shadow-3xs hover:shadow-2xs cursor-pointer transition-all flex flex-col space-y-2 text-left"
                    >
                      <div className="h-24 rounded-lg overflow-hidden bg-gray-50 relative shrink-0">
                        <img
                          src={rPost.coverImage || rPost.images?.[0] || 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=300&q=80'}
                          alt={rPost.title}
                          className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
                        />
                      </div>
                      <h5 className="font-display font-bold text-xs text-gray-900 group-hover:text-indigo-600 transition-colors line-clamp-1">
                        {rPost.title}
                      </h5>
                      <div className="flex items-center justify-between text-[10px] text-gray-400 font-mono">
                        <span>阅读量: {rPost.views || 0}</span>
                        <span className="text-indigo-500">❤️ {rPost.likes || 0}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Row 3: Guess You Like - 猜你喜欢 */}
            {guessYouLikePosts.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-gray-50 pb-2">
                  <h4 className="font-display font-bold text-gray-800 text-xs sm:text-sm flex items-center gap-1.5">
                    <BookOpen className="h-4 w-4 text-purple-500" />
                    <span>猜你喜欢 (全站热文推荐)</span>
                  </h4>
                  <span className="text-[10px] text-purple-600 font-bold bg-purple-50 px-2 py-0.5 rounded-full">高频互动匹配</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {guessYouLikePosts.map((rPost) => (
                    <div
                      key={rPost.id}
                      onClick={() => onSelectPost?.(rPost.id)}
                      className="group bg-white border border-gray-100/80 rounded-xl p-3 shadow-3xs hover:shadow-2xs cursor-pointer transition-all flex flex-col space-y-2 text-left"
                    >
                      <div className="h-24 rounded-lg overflow-hidden bg-gray-50 relative shrink-0">
                        <img
                          src={rPost.coverImage || rPost.images?.[0] || 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=300&q=80'}
                          alt={rPost.title}
                          className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
                        />
                      </div>
                      <h5 className="font-display font-bold text-xs text-gray-900 group-hover:text-indigo-600 transition-colors line-clamp-1">
                        {rPost.title}
                      </h5>
                      <div className="flex items-center justify-between text-[10px] text-gray-400">
                        <span>作者: {rPost.authorName}</span>
                        <span className="text-purple-500 font-mono">热度: {Math.round((rPost.views || 0) * 0.2 + (rPost.likes || 0) * 1.5)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Reader Short Review Wall (读者短评墙) */}
        {!isFocusMode && (
          <div className="mt-12 border-t border-gray-100 pt-8 text-left space-y-6" id="short-reviews-wall">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="font-display font-bold text-gray-950 text-sm sm:text-base flex items-center gap-2">
                  <Star className="h-5 w-5 text-amber-500 fill-amber-400 animate-pulse" />
                  <span>读者精选短评墙</span>
                </h3>
                <p className="text-[10px] text-gray-400 mt-1">读罢此篇，写下一段简短的心得，优秀短评会被作者精选置顶噢！</p>
              </div>
              <span className="text-[10px] bg-amber-50 text-amber-700 font-bold px-2.5 py-1 rounded-full font-sans">
                {shortReviews.length} 条微评
              </span>
            </div>

            {/* Submit Short Review Form */}
            {user ? (
              <form onSubmit={handleSubmitReview} className="bg-gray-50/50 border border-gray-100 rounded-2xl p-4 space-y-3">
                <textarea
                  value={newReview}
                  onChange={(e) => setNewReview(e.target.value.slice(0, 200))}
                  placeholder="畅言您对本章节的读后感或对CP的短评（200字以内）..."
                  rows={2}
                  maxLength={200}
                  className="allow-paste w-full block rounded-xl border border-gray-250 p-3 text-xs text-gray-800 placeholder-gray-400 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-gray-400 font-medium">当前字数：{newReview.length}/200</span>
                  <button
                    type="submit"
                    disabled={!newReview.trim() || reviewSubmitting}
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-200 text-white font-bold rounded-xl text-xs transition-all shadow-3xs cursor-pointer flex items-center gap-1"
                  >
                    {reviewSubmitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    <span>发表短评</span>
                  </button>
                </div>
              </form>
            ) : (
              <div className="text-center py-6 bg-gray-50 border border-dashed border-gray-200 rounded-2xl">
                <p className="text-xs text-gray-500">请先登录后再发表读后感与精彩短评。</p>
              </div>
            )}

            {/* Short Reviews List */}
            {shortReviews.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-xs italic">
                还没有读者发表过短评。写下您的第一条微评，抢占沙发吧！
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {shortReviews.map((review) => {
                  const isPostAuthor = user && post && user.firebaseUid === post.authorId;
                  return (
                    <div
                      key={review.id}
                      className={`relative bg-white rounded-2xl p-4 border transition-all flex flex-col justify-between gap-3 ${
                        review.isFeatured
                          ? 'border-amber-200 shadow-3xs bg-amber-50/10'
                          : 'border-gray-100 shadow-3xs hover:border-gray-200'
                      }`}
                    >
                      {/* Featured pin badge */}
                      {review.isFeatured && (
                        <div className="absolute top-3 right-3 flex items-center gap-0.5 bg-gradient-to-r from-amber-500 to-amber-600 text-white text-[8px] font-extrabold px-2 py-0.5 rounded-full shadow-3xs">
                          <Star className="h-2 w-2 fill-white" />
                          <span>作者精选</span>
                        </div>
                      )}

                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          {review.avatar ? (
                            <img src={review.avatar} alt={review.username} className="h-5 w-5 rounded-full object-cover border border-gray-100" />
                          ) : (
                            <div className="h-5 w-5 rounded-full bg-indigo-50 text-indigo-500 flex items-center justify-center text-[10px] font-bold">
                              {review.username.charAt(0)}
                            </div>
                          )}
                          <div>
                            <span className="text-xs font-bold text-gray-800 block">{review.username}</span>
                            <span className="text-[8px] text-gray-400 font-mono block">{new Date(review.createdAt).toLocaleString()}</span>
                          </div>
                        </div>

                        <p className="text-xs text-gray-600 leading-relaxed italic pr-6 whitespace-pre-wrap">
                          “ {review.content} ”
                        </p>
                      </div>

                      {/* Author action for Pin / Feature */}
                      {isPostAuthor && (
                        <div className="flex justify-end pt-1.5 border-t border-gray-50">
                          <button
                            onClick={() => handleToggleFeatureReview(review.id, review.isFeatured)}
                            className={`px-2 py-1 rounded-lg text-[9px] font-bold transition-all flex items-center gap-1 cursor-pointer border ${
                              review.isFeatured
                                ? 'bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200'
                                : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-amber-50 hover:text-amber-600 hover:border-amber-200'
                            }`}
                          >
                            <Star className={`h-3 w-3 ${review.isFeatured ? 'fill-amber-500 text-amber-600' : ''}`} />
                            <span>{review.isFeatured ? '取消精选' : '推荐至短评墙'}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Ask Author Section (作者问答区) */}
        {!isFocusMode && (
          <div className="mt-12 border-t border-gray-100 pt-8 text-left space-y-6 animate-fade-in" id="ask-author-section">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="font-display font-bold text-gray-950 text-sm sm:text-base flex items-center gap-2">
                  <User className="h-5 w-5 text-emerald-600" />
                  <span>问作者 Q&A</span>
                </h3>
                <p className="text-[10px] text-gray-400 mt-1">对文章设定、CP结局或者连载计划有疑问？在此提问，作者将亲自答复！</p>
              </div>
              <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2.5 py-1 rounded-full font-sans">
                {authorQuestions.length} 条互动
              </span>
            </div>

            {/* Ask Question Form */}
            {user ? (
              <form onSubmit={handleAskQuestion} className="bg-gray-50/50 border border-gray-100 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">提问通道</span>
                  <span className="text-[10px] text-gray-400 font-medium">向 @{post?.authorName} 发起关于设定、番外或剧情的探讨</span>
                </div>
                <textarea
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value.slice(0, 150))}
                  placeholder="在这里写下您的提问（150字以内）..."
                  rows={2}
                  maxLength={150}
                  className="allow-paste w-full block rounded-xl border border-gray-250 p-3 text-xs text-gray-800 placeholder-gray-400 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-gray-400 font-medium">当前字数：{newQuestion.length}/150</span>
                  <button
                    type="submit"
                    disabled={!newQuestion.trim() || questionSubmitting}
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-200 text-white font-bold rounded-xl text-xs transition-all shadow-3xs cursor-pointer flex items-center gap-1"
                  >
                    {questionSubmitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <MessageSquare className="h-3.5 w-3.5" />}
                    <span>发送提问</span>
                  </button>
                </div>
              </form>
            ) : (
              <div className="text-center py-6 bg-gray-50 border border-dashed border-gray-200 rounded-2xl">
                <p className="text-xs text-gray-500">请先登录后再进行提问咨询。</p>
              </div>
            )}

            {/* Questions List */}
            {authorQuestions.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-xs italic">
                还没有读者在此发起过提问。留下对主角设定的疑惑吧！
              </div>
            ) : (
              <div className="space-y-4">
                {authorQuestions.map((qa) => {
                  const isPostAuthor = user && post && user.firebaseUid === post.authorId;
                  const isAnsweringThis = answeringQuestionId === qa.id;
                  
                  return (
                    <div key={qa.id} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-3xs space-y-3.5">
                      {/* Reader's Question */}
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-xl bg-amber-50 text-amber-600 shrink-0 font-bold font-sans text-xs">
                          问
                        </div>
                        <div className="space-y-1 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-800">{qa.username}</span>
                            <span className="text-[9px] text-gray-400 font-mono">{new Date(qa.createdAt).toLocaleString()}</span>
                          </div>
                          <p className="text-gray-700 font-medium">{qa.question}</p>
                        </div>
                      </div>

                      {/* Author's Answer */}
                      {qa.answer ? (
                        <div className="bg-emerald-50/30 border border-emerald-100/50 rounded-xl p-3.5 flex items-start gap-3 ml-6">
                          <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700 shrink-0 font-bold font-sans text-xs">
                            答
                          </div>
                          <div className="space-y-1 text-xs text-left">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-emerald-800">作者官方回复</span>
                              <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.2 rounded font-semibold font-mono">Official</span>
                              {qa.answeredAt && (
                                <span className="text-[9px] text-gray-400 font-mono ml-1">{new Date(qa.answeredAt).toLocaleDateString()}</span>
                              )}
                            </div>
                            <p className="text-gray-600 leading-relaxed font-sans">{qa.answer}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="ml-6 flex items-center justify-between">
                          <span className="text-[10px] text-gray-400 font-medium bg-gray-50 px-2 py-1 rounded-md flex items-center gap-1">
                            <Loader2 className="h-3 w-3 animate-spin text-indigo-500" />
                            <span>静待作者亲临答复中...</span>
                          </span>
                          
                          {/* If current user is author, show answering controls */}
                          {isPostAuthor && !isAnsweringThis && (
                            <button
                              onClick={() => {
                                setAnsweringQuestionId(qa.id);
                                setNewAnswer('');
                              }}
                              className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 hover:text-indigo-700 rounded-lg text-[10px] font-bold transition-all border border-indigo-100/30 cursor-pointer"
                            >
                              ✍️ 亲笔答复
                            </button>
                          )}
                        </div>
                      )}

                      {/* Author answering panel */}
                      {isPostAuthor && isAnsweringThis && (
                        <div className="ml-6 p-4 bg-indigo-50/30 border border-indigo-100 rounded-xl space-y-3.5">
                          <textarea
                            value={newAnswer}
                            onChange={(e) => setNewAnswer(e.target.value)}
                            placeholder="请提笔写下您的官方回复..."
                            rows={2}
                            className="allow-paste w-full block rounded-xl border border-indigo-200 p-2.5 text-xs text-gray-800 placeholder-gray-400 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                          <div className="flex items-center justify-end gap-2 text-[10px]">
                            <button
                              onClick={() => setAnsweringQuestionId(null)}
                              className="px-3 py-1 bg-white hover:bg-gray-50 text-gray-500 rounded-lg font-bold border border-gray-200 transition-all cursor-pointer"
                            >
                              取消
                            </button>
                            <button
                              onClick={() => handleAnswerQuestion(qa.id)}
                              disabled={!newAnswer.trim() || answerSubmitting}
                              className="px-3.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold transition-all shadow-3xs cursor-pointer"
                            >
                              {answerSubmitting ? '发布中...' : '确认发送答复'}
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
        )}

        {/* Elegant Comments Section */}
        {!isFocusMode && (
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
        )}
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
      {/* R18 Content Warning Modal */}
      {showR18Warning && post?.isR18 && !isR18Expanded && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in" id="r18-warning-modal">
          <div className="bg-zinc-950 border border-red-900 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl space-y-6 text-center text-white">
            <div className="flex flex-col items-center gap-3">
              <div className="p-4 bg-red-950/50 border border-red-800 rounded-full text-red-500 animate-pulse">
                <AlertCircle className="h-10 w-10" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-extrabold text-red-500 font-display tracking-tight">🔞 限制级敏感内容提示</h3>
                <p className="text-[10px] text-red-400 font-semibold tracking-wider uppercase font-mono">Restricted Content Warning (R18)</p>
              </div>
            </div>

            <p className="text-xs leading-relaxed text-zinc-300">
              您当前请求阅读的文章 <span className="font-semibold text-red-400">「{post?.title}」</span> 已被作者或管理员标记为包含限制级或敏感不适宜内容（R18）。
              根据平台准则，您必须年满 <span className="font-bold text-red-500 text-sm">18 周岁</span> 方可继续浏览。
            </p>

            <div className="p-3 bg-red-950/20 border border-red-950 rounded-xl text-[10px] text-zinc-400 leading-relaxed text-left">
              ⚠️ 打码说明：在未点击下方“确认年满18岁并继续阅读”前，文章内的所有配图、封面等均保持高度马赛克模糊状态。
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={onBack}
                className="flex-1 py-2.5 px-4 bg-zinc-850 hover:bg-zinc-800 text-zinc-300 font-bold rounded-xl text-xs transition-colors border border-zinc-700 flex items-center justify-center cursor-pointer"
              >
                返回
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsR18Expanded(true);
                  setShowR18Warning(false);
                }}
                className="flex-1 py-2.5 px-4 bg-red-600 hover:bg-red-500 text-white font-extrabold rounded-xl text-xs transition-colors flex items-center justify-center gap-1 cursor-pointer shadow-lg shadow-red-900/30 font-display"
              >
                我已年满18岁，继续
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Floating control bar during Focus Mode */}
      {isFocusMode && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 animate-fade-in bg-white/95 backdrop-blur-md border border-gray-150 p-2 rounded-full shadow-lg">
          <button
            onClick={() => {
              onToggleFocusMode?.(false);
              onBack();
            }}
            className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-full transition-all cursor-pointer flex items-center justify-center"
            title="返回博文列表"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="w-px h-4 bg-gray-200" />
          <button
            onClick={() => onToggleFocusMode?.(false)}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 rounded-full font-bold text-xs cursor-pointer transition-all hover:scale-102 flex-row shrink-0"
            title="退出沉浸阅读模式"
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span>退出沉浸</span>
          </button>
        </div>
      )}
      {/* Google Drive Authorization & Backup Modal */}
      {showDriveAuthModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full border border-gray-100 shadow-xl space-y-6 text-left">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                <Cloud className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">连接您的 Google Drive</h3>
                <p className="text-xs text-gray-400 font-medium">安全备份您的文学创作</p>
              </div>
            </div>
            <p className="text-xs sm:text-sm text-gray-600 leading-relaxed font-medium">
              备份需要您授权连接自己的 Google 账户。应用将在您的云端硬盘中自动创建一个专属的 <span className="font-bold text-gray-900">「私密阅读专栏备份」</span> 文件夹，并将该作品以格式精美的 Markdown 文本文件安全备份。
            </p>
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-[11px] text-amber-800 leading-normal font-semibold">
              🔒 安全保障：本系统仅申请 <code className="bg-amber-100/60 px-1 py-0.5 rounded font-mono">drive.file</code> 最小功能权限，意味着系统只能对由其自身创建的文件拥有管理权限，绝对无法访问或修改您在云端硬盘中的其他任何私人文件。
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowDriveAuthModal(false)}
                className="flex-1 py-2.5 px-4 bg-gray-50 hover:bg-gray-100 text-gray-700 font-bold rounded-xl text-xs transition-all border border-gray-100 cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={async () => {
                  setShowDriveAuthModal(false);
                  setBackingUpToDrive(true);
                  try {
                    const token = await connectGoogleDrive();
                    const folderId = await searchOrCreateFolder(token);
                    await backupPostToDrive(token, post!, folderId);
                    setToastMessage({
                      type: 'success',
                      text: '🎉 Google Drive 授权并备份成功！已安全存于您的云端。'
                    });
                  } catch (err: any) {
                    setToastMessage({
                      type: 'error',
                      text: `连接并备份失败: ${err.message || err}`
                    });
                  } finally {
                    setBackingUpToDrive(false);
                    setTimeout(() => setToastMessage(null), 4000);
                  }
                }}
                className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-all shadow-sm shadow-indigo-600/15 flex items-center justify-center gap-2 cursor-pointer"
              >
                {backingUpToDrive ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : '授权并备份'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
