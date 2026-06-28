import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, onSnapshot, doc, getDoc, setDoc, deleteDoc, addDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { AppUser, Post, Follow } from '../types';
import { ArrowLeft, User, Calendar, BookOpen, Clock, Shield, Heart, Eye, MessageSquare, Loader2, Bookmark, CheckCircle2, X, Sparkles } from 'lucide-react';
import ImageWrapper from './ImageWrapper';

interface AuthorProfileProps {
  authorId: string;
  user: AppUser | null;
  onNavigate: (route: string) => void;
  onSelectPost: (postId: string) => void;
  onStartChat?: (authorId: string) => void;
  onBack: () => void;
}

export default function AuthorProfile({ authorId, user, onNavigate, onSelectPost, onStartChat, onBack }: AuthorProfileProps) {
  const [author, setAuthor] = useState<AppUser | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followingLoading, setFollowingLoading] = useState(false);

  // Modal states for followers & following lists
  const [showFollowersModal, setShowFollowersModal] = useState(false);
  const [showFollowingModal, setShowFollowingModal] = useState(false);
  const [followersList, setFollowersList] = useState<Follow[]>([]);
  const [followingList, setFollowingList] = useState<Follow[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, { username: string; avatar: string }>>({});
  const [modalLoading, setModalLoading] = useState(false);

  // 1. Fetch Author Profile info
  useEffect(() => {
    const fetchAuthorInfo = async () => {
      setLoading(true);
      try {
        const authorRef = doc(db, 'users', authorId);
        const authorSnap = await getDoc(authorRef);
        if (authorSnap.exists()) {
          setAuthor({
            firebaseUid: authorSnap.id,
            ...authorSnap.data()
          } as AppUser);
        } else {
          console.error("Author not found in database");
        }
      } catch (err) {
        console.error("Failed to fetch author profile info:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchAuthorInfo();
  }, [authorId]);

  // 2. Fetch Author's published posts
  useEffect(() => {
    const postsRef = collection(db, 'posts');
    const q = query(postsRef, where('authorId', '==', authorId), where('status', '==', 'published'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loaded = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Post[];
      // Sort descending by creation date
      loaded.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setPosts(loaded);
    }, (error) => {
      console.error("Failed to load author posts:", error);
      handleFirestoreError(error, OperationType.LIST, 'posts');
    });

    return () => unsubscribe();
  }, [authorId]);

  // 3. Listen to follow numbers and status
  useEffect(() => {
    // Listen to followers count
    const followersQuery = query(collection(db, 'follows'), where('followingId', '==', authorId));
    const unsubFollowers = onSnapshot(followersQuery, (snapshot) => {
      setFollowersCount(snapshot.size);
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Follow[];
      setFollowersList(list);
    }, (err) => console.error("Failed to fetch followers list:", err));

    // Listen to following count
    const followingQuery = query(collection(db, 'follows'), where('followerId', '==', authorId));
    const unsubFollowing = onSnapshot(followingQuery, (snapshot) => {
      setFollowingCount(snapshot.size);
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Follow[];
      setFollowingList(list);
    }, (err) => console.error("Failed to fetch following list:", err));

    return () => {
      unsubFollowers();
      unsubFollowing();
    };
  }, [authorId]);

  // Dynamically fetch and cache target users profiles to display real-time usernames/avatars
  useEffect(() => {
    const idsToFetch = new Set<string>();
    followersList.forEach(f => { if (f.followerId) idsToFetch.add(f.followerId); });
    followingList.forEach(f => { if (f.followingId) idsToFetch.add(f.followingId); });

    if (idsToFetch.size === 0) return;

    // Filter out IDs we already fetched
    const newIds = Array.from(idsToFetch).filter(id => !profilesMap[id]);
    if (newIds.length === 0) return;

    const fetchProfiles = async () => {
      try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('firebaseUid', 'in', newIds));
        const querySnapshot = await getDocs(q);
        const newProfiles: Record<string, { username: string; avatar: string }> = {};
        querySnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          newProfiles[docSnap.id] = {
            username: data.username || '',
            avatar: data.avatar || '',
          };
        });
        setProfilesMap(prev => ({
          ...prev,
          ...newProfiles
        }));
      } catch (err) {
        console.error("Failed to batch fetch user profiles for follows list:", err);
      }
    };

    fetchProfiles();
  }, [followersList, followingList]);

  // 4. Check if currently logged-in user is following this author
  useEffect(() => {
    if (!user || user.firebaseUid === authorId) {
      setIsFollowing(false);
      return;
    }

    const followDocId = `${user.firebaseUid}_${authorId}`;
    const followRef = doc(db, 'follows', followDocId);

    const unsub = onSnapshot(followRef, (snapshot) => {
      setIsFollowing(snapshot.exists());
    }, (err) => {
      console.error("Failed to check follow connection status:", err);
    });

    return () => unsub();
  }, [user, authorId]);

  const handleFollowToggle = async () => {
    if (!user || !author) return;
    setFollowingLoading(true);

    const followDocId = `${user.firebaseUid}_${author.firebaseUid}`;
    const followRef = doc(db, 'follows', followDocId);

    try {
      if (isFollowing) {
        await deleteDoc(followRef);
      } else {
        const followPayload: Follow = {
          followerId: user.firebaseUid,
          followerName: user.username,
          followerAvatar: user.avatar || '',
          followingId: author.firebaseUid,
          followingName: author.username,
          followingAvatar: author.avatar || '',
          createdAt: new Date().toISOString(),
        };
        await setDoc(followRef, followPayload);

        // Send a push notification securely
        try {
          await addDoc(collection(db, 'notifications'), {
            recipientId: author.firebaseUid,
            senderId: user.firebaseUid,
            senderName: user.username,
            senderAvatar: user.avatar || '',
            type: 'follow',
            title: '新增粉丝关注',
            body: `用户「${user.username}」已开始关注您！`,
            read: false,
            createdAt: new Date().toISOString(),
          });
        } catch (_) {}
      }
    } catch (err: any) {
      console.error("Failed to toggle follow:", err);
      alert("操作失败：" + (err.message || String(err)));
    } finally {
      setFollowingLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        <span className="text-gray-500 text-xs mt-3 font-semibold">正在查阅作者档案...</span>
      </div>
    );
  }

  if (!author) {
    return (
      <div className="max-w-xl mx-auto mt-20 p-8 text-center bg-white rounded-3xl border border-gray-100 shadow-sm">
        <h3 className="text-sm font-bold text-gray-800 font-display">未查找到该作者</h3>
        <p className="text-xs text-gray-400 mt-2">抱歉，无法找到该用户的信息。该账号可能已注销或被封锁。</p>
        <button
          onClick={onBack}
          className="mt-6 px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer"
        >
          返回大厅
        </button>
      </div>
    );
  }

  const totalReceivedLikes = posts.reduce((acc, p) => acc + (p.likes || 0), 0);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8 text-left animate-fade-in relative">
      {/* Back button */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 rounded-lg bg-white border border-gray-100 text-gray-500 hover:text-gray-700 transition-colors shadow-sm cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <span className="text-xs text-gray-400 font-bold">作者主页 / {author.username}</span>
      </div>

      {/* Profile Header */}
      {(() => {
        const isOwner = author.role === 'owner';
        const isAuthor = author.role === 'author';
        const authorLevel = author.level || 'normal';

        let cardClass = "bg-white rounded-3xl border border-gray-100 p-6 sm:p-10 shadow-sm flex flex-col md:flex-row items-center gap-6 sm:gap-8 relative overflow-hidden w-full text-left";
        let nameClass = "font-display font-bold text-gray-900 text-2xl sm:text-3xl leading-none";
        let textClass = "text-gray-500 text-xs sm:text-sm font-medium flex items-center justify-center md:justify-start gap-1";
        let metaClass = "text-gray-400 text-xs flex items-center justify-center md:justify-start gap-3";
        let ringClass = "h-24 w-24 sm:h-28 sm:w-28 rounded-full object-cover border-4 border-indigo-50 shadow-md shrink-0 ring-4 ring-indigo-50";
        let statsClass = "grid grid-cols-2 divide-x divide-gray-100 bg-gray-50/50 rounded-2xl border border-gray-100 p-3 text-center";
        let statsNumClass = "block font-display text-base font-bold text-gray-900";
        let statsLabelClass = "text-[10px] text-gray-500";
        let buttonFollowClass = "flex items-center gap-1 text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-100 px-3 py-1 rounded-lg transition-colors cursor-pointer";
        let buttonFollowSpanClass = "text-indigo-600 font-bold font-display";
        let levelBadge = null;
        let sparklesElement = null;
        let bioBanner = null;

        if (isOwner) {
          cardClass = "bg-gradient-to-br from-zinc-950 via-purple-950/90 to-zinc-900 rounded-3xl border-2 border-purple-550/80 p-6 sm:p-10 shadow-[0_20px_50px_rgba(168,85,247,0.25)] flex flex-col md:flex-row items-center gap-6 sm:gap-8 relative overflow-hidden w-full text-white text-left";
          nameClass = "font-display font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-300 text-2xl sm:text-3xl leading-none tracking-tight";
          textClass = "text-purple-200/80 text-xs sm:text-sm font-medium flex items-center justify-center md:justify-start gap-1";
          metaClass = "text-purple-300/65 text-xs flex items-center justify-center md:justify-start gap-3";
          ringClass = "h-24 w-24 sm:h-28 sm:w-28 rounded-full object-cover border-4 border-purple-500/30 shadow-md shrink-0 ring-4 ring-purple-500 ring-offset-2 ring-offset-zinc-950";
          statsClass = "grid grid-cols-2 divide-x divide-purple-500/10 bg-zinc-900/85 rounded-2xl border border-purple-550/20 p-3 text-center";
          statsNumClass = "block font-display text-base font-extrabold text-purple-300";
          statsLabelClass = "text-[10px] text-purple-200/60";
          buttonFollowClass = "flex items-center gap-1 text-purple-200 bg-purple-900/40 hover:bg-purple-900/65 border border-purple-800/50 px-3 py-1 rounded-lg transition-colors cursor-pointer";
          buttonFollowSpanClass = "text-purple-300 font-bold font-display";
          levelBadge = (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-600 text-white shadow-xs">
              👑 站长 / 平台主理人
            </span>
          );
          bioBanner = (
            <div className="text-[10px] sm:text-[11px] bg-purple-900/40 text-purple-200 font-semibold px-3 py-1.5 rounded-xl border border-purple-500/20 mt-1 max-w-md">
              🔮 站长：平台创办人兼全网最高管理员。统筹全站，真诚为您提供最好的阅读体验。
            </div>
          );
          sparklesElement = (
            <>
              <div className="absolute top-0 right-0 h-44 w-44 bg-gradient-to-br from-purple-550/15 to-transparent rounded-full -mr-16 -mt-16 pointer-events-none"></div>
              <Sparkles className="absolute h-6 w-6 text-purple-400/30 top-6 right-8 animate-pulse pointer-events-none" />
            </>
          );
        } else if (isAuthor) {
          if (authorLevel === 'vip') {
            cardClass = "bg-gradient-to-br from-amber-100/45 via-white to-orange-50/35 rounded-3xl border-2 border-amber-300 p-6 sm:p-10 shadow-[0_15px_35px_rgba(245,158,11,0.12)] flex flex-col md:flex-row items-center gap-6 sm:gap-8 relative overflow-hidden w-full text-left";
            nameClass = "font-display font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-550 via-amber-700 to-rose-600 text-2xl sm:text-3xl leading-none tracking-tight";
            textClass = "text-amber-850/90 text-xs sm:text-sm font-medium flex items-center justify-center md:justify-start gap-1";
            metaClass = "text-amber-600/70 text-xs flex items-center justify-center md:justify-start gap-3";
            ringClass = "h-24 w-24 sm:h-28 sm:w-28 rounded-full object-cover border-4 border-white shadow-md shrink-0 ring-4 ring-amber-400 ring-offset-2 ring-offset-amber-50 animate-pulse";
            statsClass = "grid grid-cols-2 divide-x divide-amber-200/40 bg-gradient-to-br from-amber-50/70 to-orange-50/40 rounded-2xl border border-amber-100 p-3 text-center shadow-2xs";
            statsNumClass = "block font-display text-base font-black text-amber-800";
            statsLabelClass = "text-[10px] text-amber-600/80";
            levelBadge = (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black bg-gradient-to-r from-amber-500 to-rose-500 text-white shadow-md border border-amber-400/30 animate-bounce">
                👑 特邀作者 (VIP Guest)
              </span>
            );
            bioBanner = (
              <div className="text-[10px] sm:text-[11px] bg-amber-50/70 text-amber-800 font-semibold px-3 py-1.5 rounded-xl border border-amber-100 mt-1 max-w-md">
                🏆 特邀专栏：平台重磅特邀常驻名家，作品享有最高置顶创作权益。
              </div>
            );
            sparklesElement = (
              <>
                <div className="absolute top-0 right-0 h-40 w-40 bg-gradient-to-br from-amber-200/30 to-transparent rounded-full -mr-16 -mt-16 pointer-events-none"></div>
                <Sparkles className="absolute h-5 w-5 text-amber-500/50 top-6 right-8 animate-pulse pointer-events-none" />
                <Sparkles className="absolute h-4 w-4 text-orange-400/40 bottom-6 right-1/4 animate-pulse pointer-events-none" />
              </>
            );
          } else if (authorLevel === 'signed') {
            cardClass = "bg-gradient-to-br from-emerald-50/60 via-white to-emerald-50/10 rounded-3xl border-2 border-emerald-250 p-6 sm:p-10 shadow-[0_8px_30px_rgba(16,185,129,0.06)] flex flex-col md:flex-row items-center gap-6 sm:gap-8 relative overflow-hidden w-full text-left";
            nameClass = "font-display font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 via-teal-700 to-emerald-950 text-2xl sm:text-3xl leading-none";
            textClass = "text-emerald-800/80 text-xs sm:text-sm font-medium flex items-center justify-center md:justify-start gap-1";
            metaClass = "text-emerald-600/60 text-xs flex items-center justify-center md:justify-start gap-3";
            ringClass = "h-24 w-24 sm:h-28 sm:w-28 rounded-full object-cover border-4 border-white shadow-md shrink-0 ring-4 ring-emerald-300";
            statsClass = "grid grid-cols-2 divide-x divide-emerald-100 bg-emerald-50/40 rounded-2xl border border-emerald-100/60 p-3 text-center";
            statsNumClass = "block font-display text-base font-bold text-emerald-800";
            statsLabelClass = "text-[10px] text-emerald-600";
            levelBadge = (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-emerald-600 text-white shadow-xs">
                ✒️ 签约作者 (Signed)
              </span>
            );
            bioBanner = (
              <div className="text-[10px] sm:text-[11px] bg-emerald-50/70 text-emerald-850 font-semibold px-3 py-1.5 rounded-xl border border-emerald-100 mt-1 max-w-md">
                ⭐️ 签约作家：平台官方深度签约作者，持续产出精选优质原创长文。
              </div>
            );
            sparklesElement = (
              <div className="absolute top-0 right-0 h-40 w-40 bg-gradient-to-br from-emerald-100/30 to-transparent rounded-full -mr-16 -mt-16 pointer-events-none"></div>
            );
          } else {
            cardClass = "bg-gradient-to-br from-indigo-50/50 via-white to-sky-50/30 rounded-3xl border border-indigo-100/80 p-6 sm:p-10 shadow-[0_4px_20px_rgba(99,102,241,0.02)] flex flex-col md:flex-row items-center gap-6 sm:gap-8 relative overflow-hidden w-full text-left";
            nameClass = "font-display font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-sky-850 text-2xl sm:text-3xl leading-none";
            textClass = "text-indigo-800/70 text-xs sm:text-sm font-medium flex items-center justify-center md:justify-start gap-1";
            metaClass = "text-indigo-400 text-xs flex items-center justify-center md:justify-start gap-3";
            ringClass = "h-24 w-24 sm:h-28 sm:w-28 rounded-full object-cover border-4 border-white shadow-md shrink-0 ring-4 ring-indigo-150";
            statsClass = "grid grid-cols-2 divide-x divide-indigo-100 bg-indigo-50/20 rounded-2xl border border-indigo-100/40 p-3 text-center";
            statsNumClass = "block font-display text-base font-bold text-indigo-700";
            statsLabelClass = "text-[10px] text-indigo-500";
            levelBadge = (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100/60 shadow-2xs">
                📖 普通作者
              </span>
            );
            bioBanner = (
              <div className="text-[10px] sm:text-[11px] bg-indigo-50/50 text-indigo-700 font-semibold px-3 py-1.5 rounded-xl border border-indigo-100/50 mt-1 max-w-md">
                ✒️ 普通作者：已开启专属阅读专栏创作权限，产出精品优质原创短文。
              </div>
            );
            sparklesElement = (
              <div className="absolute top-0 right-0 h-40 w-40 bg-gradient-to-br from-indigo-100/20 to-transparent rounded-full -mr-16 -mt-16 pointer-events-none"></div>
            );
          }
        } else {
          levelBadge = (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-gray-100 text-gray-700 border border-gray-200">
              尊享读者
            </span>
          );
          sparklesElement = (
            <div className="absolute top-0 right-0 h-40 w-40 bg-gradient-to-br from-gray-100 to-transparent rounded-full -mr-16 -mt-16 pointer-events-none opacity-40"></div>
          );
        }

        return (
          <div className={cardClass}>
            {sparklesElement}

            <img
              src={author.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'}
              alt={author.username}
              className={ringClass}
            />

            <div className="space-y-3 text-center md:text-left flex-grow">
              <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3 justify-center md:justify-start">
                <h2 className={nameClass}>
                  {author.username}
                </h2>
                {levelBadge}
              </div>

              <p className={textClass}>
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  加入于: {new Date(author.createdAt).toLocaleDateString()}
                </span>
                {author.birthday && (
                  <span className="flex items-center gap-1 font-mono">
                    🎂 生日: {author.birthday}
                  </span>
                )}
              </p>

              {bioBanner}

              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 text-xs font-semibold pt-1">
                <button
                  onClick={() => setShowFollowingModal(true)}
                  className={buttonFollowClass}
                >
                  <span className={buttonFollowSpanClass}>{followingCount}</span>
                  <span className={`${isOwner ? 'text-purple-300/60' : 'text-gray-400'} font-medium`}>关注中</span>
                </button>
                <button
                  onClick={() => setShowFollowersModal(true)}
                  className={buttonFollowClass}
                >
                  <span className={buttonFollowSpanClass}>{followersCount}</span>
                  <span className={`${isOwner ? 'text-purple-300/60' : 'text-gray-400'} font-medium`}>粉丝</span>
                </button>
              </div>
            </div>

            {/* Right Buttons or Stats panel */}
            <div className="flex flex-col gap-4 w-full md:w-auto shrink-0 text-center sm:text-left items-stretch md:items-end z-10">
              <div className={statsClass}>
                <div className="px-3">
                  <span className={statsNumClass}>{posts.length}</span>
                  <span className={statsLabelClass}>公开发表</span>
                </div>
                <div className="px-3">
                  <span className={statsNumClass}>{totalReceivedLikes}</span>
                  <span className={statsLabelClass}>所获赞数</span>
                </div>
              </div>

              <div className="flex gap-2">
                {user && user.firebaseUid !== author.firebaseUid && (
                  <>
                    <button
                      onClick={handleFollowToggle}
                      disabled={followingLoading}
                      className={`flex-1 py-2 px-4 rounded-xl text-xs font-bold shadow-2xs hover:shadow transition-all cursor-pointer flex items-center justify-center gap-1 ${
                        isFollowing
                          ? 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                          : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                      }`}
                    >
                      {followingLoading ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : isFollowing ? (
                        '已关注'
                      ) : (
                        '关注作者'
                      )}
                    </button>

                    {onStartChat && (
                      <button
                        onClick={() => onStartChat(author.firebaseUid)}
                        className="p-2 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 text-indigo-600 rounded-xl transition-all cursor-pointer"
                        title="发送私信"
                      >
                        <MessageSquare className="h-4 w-4" />
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Publications feed */}
      <div className="space-y-4">
        <h3 className="font-display font-bold text-gray-900 text-lg flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-indigo-600" />
          作者公开发表的作品 ({posts.length})
        </h3>

        {posts.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-3xl border border-gray-100 shadow-sm">
            <BookOpen className="h-8 w-8 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-400 text-xs">该作者暂未公开发表任何博文作品。</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {posts.map((post) => {
              const textContent = post.content || '';
              const cleanSummary = textContent
                .replace(/[#*`_~]/g, '') // Remove Markdown syntax characters
                .slice(0, 100) + (textContent.length > 100 ? '...' : '');

              return (
                <div
                  key={post.id}
                  onClick={() => onSelectPost(post.id)}
                  className="group bg-white rounded-2xl border border-gray-100 p-4 shadow-3xs hover:shadow-2xs hover:border-gray-200 transition-all duration-300 flex flex-col justify-between cursor-pointer"
                >
                  <div className="space-y-3.5">
                    <div className="aspect-video rounded-xl overflow-hidden border border-gray-100 bg-gray-50 relative shrink-0">
                      <ImageWrapper
                        src={post.coverImage || post.images?.[0] || 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=400&q=80'}
                        alt={post.title}
                        width={400}
                        isR18={post.isR18}
                        className="w-full h-full object-cover transition-transform group-hover:scale-102"
                        placeholderClassName="w-full h-full"
                      />
                      {post.isR18 && (
                        <span className="absolute top-2 left-2 bg-rose-600 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded shadow-2xs">
                          R18
                        </span>
                      )}
                    </div>

                    <div className="space-y-1">
                      <h4 className="font-bold text-gray-950 line-clamp-1 group-hover:text-indigo-600 transition-colors text-sm font-display">
                        {post.title}
                      </h4>
                      <p className="text-[11px] text-gray-400 line-clamp-2 leading-relaxed">
                        {cleanSummary}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-50 flex items-center justify-between text-[10px] text-gray-400 font-semibold">
                    <span>{new Date(post.createdAt).toLocaleDateString()}</span>
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-0.5">
                        <Eye className="h-3 w-3" />
                        {post.views || 0}
                      </span>
                      <span className="flex items-center gap-0.5 text-rose-500">
                        <Heart className="h-3 w-3 fill-rose-500 text-rose-500" />
                        {post.likes || 0}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Followers Modal */}
      {showFollowersModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-xs" onClick={() => setShowFollowersModal(false)} />
          <div className="bg-white rounded-3xl border border-gray-100 shadow-xl max-w-md w-full max-h-[480px] overflow-hidden flex flex-col z-10 animate-fade-in relative text-left">
            <div className="p-5 border-b border-gray-50 flex items-center justify-between">
              <h3 className="font-display font-bold text-gray-900 text-sm">粉丝列表 ({followersCount})</h3>
              <button
                onClick={() => setShowFollowersModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto divide-y divide-gray-50 flex-1">
              {followersList.length === 0 ? (
                <div className="text-center py-16 text-gray-400 italic text-xs">暂无粉丝关注该作者</div>
              ) : (
                followersList.map((f) => {
                  const liveProfile = profilesMap[f.followerId] || {
                    username: f.followerName,
                    avatar: f.followerAvatar
                  };
                  return (
                    <div key={f.id} className="py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={liveProfile.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'}
                          alt={liveProfile.username}
                          className="h-9 w-9 rounded-full object-cover border border-gray-100"
                        />
                        <div>
                          <span className="font-bold text-xs text-gray-900 block">{liveProfile.username}</span>
                          <span className="text-[9px] text-gray-400 font-mono">关注于：{new Date(f.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    <button
                      onClick={() => {
                        setShowFollowersModal(false);
                        // Redirect to the follower's profile
                        onSelectPost(''); // Clear selected post id
                        onNavigate('author-profile');
                        // Wait, we need to pass the follower ID up!
                        // Let's make sure this is handled nicely
                        window.location.hash = `#author-${f.followerId}`; // Or another way
                        // Let's use custom triggering! Since we are in the same component, we can just switch the authorId in parent state!
                        // In AuthorProfileProps we have onBack. We can trigger navigating to another author profile if needed.
                        // Let's pass the selection up by having a navigation action.
                        // To allow deep browsing, let's trigger a route or re-render!
                        // Let's handle this in App.tsx.
                        const detailBtn = document.getElementById(`nav-profile-${f.followerId}`);
                        if (detailBtn) {
                          detailBtn.click();
                        }
                      }}
                      id={`nav-profile-trigger-${f.followerId}`}
                      className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                    >
                      查看
                    </button>
                    {/* Hidden trigger helper to pass back up to App */}
                    <button
                      id={`nav-profile-${f.followerId}`}
                      onClick={() => {
                        setShowFollowersModal(false);
                        // Trigger parent state update
                        // We will add this handler nicely
                        const customEvent = new CustomEvent('navigate-to-author', { detail: f.followerId });
                        window.dispatchEvent(customEvent);
                      }}
                      className="hidden"
                    />
                  </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Following Modal */}
      {showFollowingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-xs" onClick={() => setShowFollowingModal(false)} />
          <div className="bg-white rounded-3xl border border-gray-100 shadow-xl max-w-md w-full max-h-[480px] overflow-hidden flex flex-col z-10 animate-fade-in relative text-left">
            <div className="p-5 border-b border-gray-50 flex items-center justify-between">
              <h3 className="font-display font-bold text-gray-900 text-sm">关注中的作者列表 ({followingCount})</h3>
              <button
                onClick={() => setShowFollowingModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto divide-y divide-gray-50 flex-1">
              {followingList.length === 0 ? (
                <div className="text-center py-16 text-gray-400 italic text-xs">暂无关注中的作者</div>
              ) : (
                followingList.map((f) => {
                  const liveProfile = profilesMap[f.followingId] || {
                    username: f.followingName,
                    avatar: f.followingAvatar
                  };
                  return (
                    <div key={f.id} className="py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={liveProfile.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'}
                          alt={liveProfile.username}
                          className="h-9 w-9 rounded-full object-cover border border-gray-100"
                        />
                        <div>
                          <span className="font-bold text-xs text-gray-900 block">{liveProfile.username}</span>
                          <span className="text-[9px] text-gray-400 font-mono">关注于：{new Date(f.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setShowFollowingModal(false);
                          const customEvent = new CustomEvent('navigate-to-author', { detail: f.followingId });
                          window.dispatchEvent(customEvent);
                        }}
                        className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                      >
                        查看
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
