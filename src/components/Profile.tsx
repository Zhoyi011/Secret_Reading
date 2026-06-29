import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, onSnapshot, setDoc, doc, addDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { AppUser, Post, Follow, AuthorApplication } from '../types';
import { User, Calendar, BookOpen, Clock, Edit2, Shield, Heart, HeartOff, PenTool, Users, X, Loader2, Sparkles, Cloud, CheckCircle, AlertCircle, Smartphone, Bell, Settings } from 'lucide-react';
import ImageWrapper from './ImageWrapper';
import { getDriveAccessToken, connectGoogleDrive, searchOrCreateFolder, backupPostToDrive } from '../utils/googleDrive';

interface ProfileProps {
  user: AppUser | null;
  onNavigate: (route: string) => void;
  onSelectPost: (postId: string) => void;
  onEditPost: (postId: string) => void;
  onSelectAuthor?: (authorId: string) => void;
}

export default function Profile({ user, onNavigate, onSelectPost, onEditPost, onSelectAuthor }: ProfileProps) {
  const [myPosts, setMyPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [followersList, setFollowersList] = useState<Follow[]>([]);
  const [followingList, setFollowingList] = useState<Follow[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, { username: string; avatar: string }>>({});
  const [showFollowersModal, setShowFollowersModal] = useState(false);
  const [showFollowingModal, setShowFollowingModal] = useState(false);

  // Google Drive Backup integration states
  const [driveToken, setDriveToken] = useState<string | null>(getDriveAccessToken());
  const [backingUpAll, setBackingUpAll] = useState(false);
  const [backupIndex, setBackupIndex] = useState(0);
  const [backupMessage, setBackupMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Native Android & PWA Notification states
  const [notifPermission, setNotifPermission] = useState<string>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return window.Notification.permission;
    }
    return 'unsupported';
  });
  const [testNotifDelay, setTestNotifDelay] = useState<string>('5000');
  const [isTestingNotif, setIsTestingNotif] = useState(false);
  const [testNotifCountdown, setTestNotifCountdown] = useState<number>(0);

  useEffect(() => {
    setDriveToken(getDriveAccessToken());
  }, []);

  // Author application states
  const [application, setApplication] = useState<AuthorApplication | null>(null);
  const [loadingApp, setLoadingApp] = useState(true);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [applyBio, setApplyBio] = useState(''); // 申请理由
  const [applySample, setApplySample] = useState(''); // 创作简介
  const [isSubmittingApp, setIsSubmittingApp] = useState(false);

  // Listen to author application status
  useEffect(() => {
    if (!user) return;
    setLoadingApp(true);
    const q = query(collection(db, 'author_applications'), where('userId', '==', user.firebaseUid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const apps = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() })) as AuthorApplication[];
        apps.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setApplication(apps[0]);
      } else {
        setApplication(null);
      }
      setLoadingApp(false);
    }, (error) => {
      console.error("Failed to load author application:", error);
      setLoadingApp(false);
    });
    return () => unsubscribe();
  }, [user]);

  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!applyBio.trim()) {
      alert("请输入申请理由");
      return;
    }
    setIsSubmittingApp(true);
    try {
      const now = new Date().toISOString();
      const payload: AuthorApplication = {
        id: user.firebaseUid,
        userId: user.firebaseUid,
        username: user.username,
        email: user.email,
        bio: applyBio,
        sampleContent: applySample,
        status: 'pending',
        createdAt: now,
      };

      await setDoc(doc(db, 'author_applications', user.firebaseUid), payload);

      // Notify all owners
      const ownersQuery = query(collection(db, 'users'), where('role', '==', 'owner'));
      const ownersSnap = await getDocs(ownersQuery);
      const notifyPromises = ownersSnap.docs.map((ownerDoc) => {
        return addDoc(collection(db, 'notifications'), {
          recipientId: ownerDoc.id,
          senderId: user.firebaseUid,
          senderName: user.username,
          senderAvatar: user.avatar || '',
          type: 'system',
          title: '收到新的作者入驻申请 📝',
          body: `用户「${user.username}」申请成为作者，理由：${applyBio}`,
          read: false,
          createdAt: now
        });
      });
      await Promise.all(notifyPromises);

      alert("申请提交成功！站长将会在24小时内为您审核。");
      setShowApplyModal(false);
    } catch (err: any) {
      console.error("Failed to submit application:", err);
      alert("申请提交失败: " + err.message);
    } finally {
      setIsSubmittingApp(false);
    }
  };

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

  const handleConnectDrive = async () => {
    try {
      const token = await connectGoogleDrive();
      setDriveToken(token);
      setBackupMessage({
        type: 'success',
        text: '🎉 Google Drive 授权连接成功！已获取云端备份许可。'
      });
      setTimeout(() => setBackupMessage(null), 3000);
    } catch (err: any) {
      setBackupMessage({
        type: 'error',
        text: `授权连接失败: ${err.message || err}`
      });
      setTimeout(() => setBackupMessage(null), 4500);
    }
  };

  const handleDisconnectDrive = () => {
    const confirmDisc = window.confirm("确定要断开 Google Drive 连接吗？下次备份时需要重新授权。");
    if (confirmDisc) {
      import('../utils/googleDrive').then((module) => {
        module.setDriveAccessToken(null);
        setDriveToken(null);
        setBackupMessage({
          type: 'success',
          text: '已成功断开 Google Drive 连接。'
        });
        setTimeout(() => setBackupMessage(null), 3000);
      });
    }
  };

  const handleBackupAll = async () => {
    if (!driveToken || myPosts.length === 0 || backingUpAll) return;
    
    setBackingUpAll(true);
    setBackupIndex(0);
    try {
      const folderId = await searchOrCreateFolder(driveToken);
      
      for (let i = 0; i < myPosts.length; i++) {
        setBackupIndex(i + 1);
        await backupPostToDrive(driveToken, myPosts[i], folderId);
      }
      
      setBackupMessage({
        type: 'success',
        text: `🎉 全盘备份成功！共备份了 ${myPosts.length} 篇作品至 Google Drive 专属备份文件夹！`
      });
    } catch (err: any) {
      console.error("Batch backup failed:", err);
      if (err?.message?.includes('授权失效') || err?.status === 401) {
        setDriveToken(null);
        setBackupMessage({
          type: 'error',
          text: 'Google Drive 授权已失效，请重新连接后重试。'
        });
      } else {
        setBackupMessage({
          type: 'error',
          text: `全盘备份失败: ${err.message || err}`
        });
      }
    } finally {
      setBackingUpAll(false);
      setTimeout(() => setBackupMessage(null), 5000);
    }
  };

  const handleRequestNotifPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setBackupMessage({
        type: 'error',
        text: '您的浏览器或设备环境暂不支持原生的 System Notification。'
      });
      setTimeout(() => setBackupMessage(null), 3000);
      return;
    }

    try {
      const permission = await window.Notification.requestPermission();
      setNotifPermission(permission);
      if (permission === 'granted') {
        setBackupMessage({
          type: 'success',
          text: '🎉 原生通知通道授权成功！应用已可在手机系统状态栏发送消息。'
        });
      } else if (permission === 'denied') {
        setBackupMessage({
          type: 'error',
          text: '系统通知权限已被禁用。请在安卓的「应用设置 -> 权限/通知管理」中手动开启。'
        });
      }
      setTimeout(() => setBackupMessage(null), 3000);
    } catch (err: any) {
      console.error('Request permission failed:', err);
    }
  };

  const handleTriggerTestNotification = () => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      alert('未检测到运行中的 Service Worker，请在移动浏览器环境直接运行此 PWA 应用。');
      return;
    }

    if (notifPermission !== 'granted') {
      alert('请先点击下方的「激活系统通知权限」授予通知授权。');
      return;
    }

    const delayMs = parseInt(testNotifDelay, 10);
    setIsTestingNotif(true);

    if (delayMs > 0) {
      setTestNotifCountdown(delayMs / 1000);
      const interval = setInterval(() => {
        setTestNotifCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            setIsTestingNotif(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      setIsTestingNotif(false);
    }

    // Trigger message dispatch to Service Worker
    navigator.serviceWorker.ready.then((reg) => {
      if (reg.active) {
        reg.active.postMessage({
          type: 'TRIGGER_TEST_NOTIFICATION',
          payload: {
            title: '🔔 您的私密阅读专栏 • 系统消息',
            body: delayMs > 0
              ? `🚀 延时推送诊断成功！这证明即使您锁屏或退至后台，系统级通知也运作完美！`
              : `🌟 即时通知测试成功！系统级通知通道已全线打通。`,
            delay: delayMs,
            url: '/'
          }
        });
      } else {
        alert('Service Worker 激活中，请稍后刷新重试。');
        setIsTestingNotif(false);
      }
    }).catch((err) => {
      console.error('Ready sw registration error:', err);
      setIsTestingNotif(false);
    });
  };

  useEffect(() => {
    if (!user) return;

    // Listen to followers count and list
    const followersQuery = query(collection(db, 'follows'), where('followingId', '==', user.firebaseUid));
    const unsubFollowers = onSnapshot(followersQuery, (snapshot) => {
      setFollowersCount(snapshot.size);
      const list = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      })) as Follow[];
      setFollowersList(list);
    }, (err) => console.error("Failed to fetch followers:", err));

    // Listen to following count and list
    const followingQuery = query(collection(db, 'follows'), where('followerId', '==', user.firebaseUid));
    const unsubFollowing = onSnapshot(followingQuery, (snapshot) => {
      setFollowingCount(snapshot.size);
      const list = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      })) as Follow[];
      setFollowingList(list);
    }, (err) => console.error("Failed to fetch following:", err));

    return () => {
      unsubFollowers();
      unsubFollowing();
    };
  }, [user]);

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
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8 animate-fade-in text-left">
      {/* User info card */}
      {(() => {
        const isOwner = user.role === 'owner' || user.email === 'zhoyilee@gmail.com';
        const isAuthor = user.role === 'author';
        const authorLevel = user.level || 'normal';

        let cardClass = "bg-white rounded-3xl border border-gray-100 p-6 sm:p-10 shadow-sm flex flex-col md:flex-row items-center gap-6 sm:gap-8 relative overflow-hidden w-full text-left";
        let nameClass = "font-display font-bold text-gray-900 text-2xl sm:text-3xl leading-none";
        let textClass = "text-gray-500 text-xs sm:text-sm font-medium flex items-center justify-center md:justify-start gap-1";
        let metaClass = "text-gray-400 text-xs flex items-center justify-center md:justify-start gap-3";
        let ringClass = "h-24 w-24 sm:h-28 sm:w-28 rounded-full object-cover border-4 border-indigo-50 shadow-md shrink-0 ring-4 ring-indigo-50";
        let statsClass = "grid grid-cols-3 divide-x divide-gray-100 bg-gray-50/50 rounded-2xl border border-gray-100 p-4 shrink-0 w-full md:w-auto text-center";
        let statsNumClass = "block font-display text-lg font-bold text-gray-900";
        let statsLabelClass = "text-[10px] text-gray-500";
        let levelBadge = null;
        let sparklesElement = null;
        let bioBanner = null;

        if (isOwner) {
          cardClass = "bg-gradient-to-br from-zinc-950 via-purple-950/90 to-zinc-900 rounded-3xl border-2 border-purple-550/80 p-6 sm:p-10 shadow-[0_20px_50px_rgba(168,85,247,0.25)] flex flex-col md:flex-row items-center gap-6 sm:gap-8 relative overflow-hidden w-full text-white text-left";
          nameClass = "font-display font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-300 text-2xl sm:text-3xl leading-none tracking-tight";
          textClass = "text-purple-200/80 text-xs sm:text-sm font-medium flex items-center justify-center md:justify-start gap-1";
          metaClass = "text-purple-300/65 text-xs flex items-center justify-center md:justify-start gap-3";
          ringClass = "h-24 w-24 sm:h-28 sm:w-28 rounded-full object-cover border-4 border-purple-500/30 shadow-md shrink-0 ring-4 ring-purple-500 ring-offset-2 ring-offset-zinc-950";
          statsClass = "grid grid-cols-3 divide-x divide-purple-500/10 bg-zinc-900/85 rounded-2xl border border-purple-500/20 p-4 shrink-0 w-full md:w-auto text-center";
          statsNumClass = "block font-display text-lg font-extrabold text-purple-300";
          statsLabelClass = "text-[10px] text-purple-200/60";
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
            statsClass = "grid grid-cols-3 divide-x divide-amber-200/40 bg-gradient-to-br from-amber-50/70 to-orange-50/40 rounded-2xl border border-amber-100 p-4 shrink-0 w-full md:w-auto text-center shadow-2xs";
            statsNumClass = "block font-display text-lg font-black text-amber-800";
            statsLabelClass = "text-[10px] text-amber-600/80";
            levelBadge = (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black bg-gradient-to-r from-amber-500 to-rose-500 text-white shadow-md border border-amber-400/30 animate-bounce">
                👑 特邀作者 (VIP Guest)
              </span>
            );
            bioBanner = (
              <div className="text-[10px] sm:text-[11px] bg-amber-50/70 text-amber-800 font-semibold px-3 py-1.5 rounded-xl border border-amber-100 mt-1 max-w-md">
                🏆 特邀专栏：平台重磅特邀常驻名家，享有最高层级置顶与深度专栏特权。
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
            statsClass = "grid grid-cols-3 divide-x divide-emerald-100 bg-emerald-50/40 rounded-2xl border border-emerald-100/60 p-4 shrink-0 w-full md:w-auto text-center";
            statsNumClass = "block font-display text-lg font-bold text-emerald-800";
            statsLabelClass = "text-[10px] text-emerald-600";
            levelBadge = (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-emerald-600 text-white shadow-xs">
                ✒️ 签约作者 (Signed)
              </span>
            );
            bioBanner = (
              <div className="text-[10px] sm:text-[11px] bg-emerald-50/70 text-emerald-850 font-semibold px-3 py-1.5 rounded-xl border border-emerald-100 mt-1 max-w-md">
                ⭐️ 签约作家：平台官方认证深度签约创作者，享有定时发布等创作特权。
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
            statsClass = "grid grid-cols-3 divide-x divide-indigo-100 bg-indigo-50/20 rounded-2xl border border-indigo-100/40 p-4 shrink-0 w-full md:w-auto text-center";
            statsNumClass = "block font-display text-lg font-bold text-indigo-700";
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
              src={user.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'}
              alt={user.username}
              className={ringClass}
            />

            <div className="space-y-3 text-center md:text-left flex-grow">
              <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3 justify-center md:justify-start">
                <h2 className={nameClass}>
                  {user.username}
                </h2>
                {levelBadge}
              </div>

              <p className={textClass}>
                <User className="h-4 w-4 shrink-0 opacity-70" />
                <span>邮箱: {user.email}</span>
              </p>

              <p className={metaClass}>
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 shrink-0" />
                  加入于: {new Date(user.createdAt).toLocaleDateString()}
                </span>
              </p>

              {bioBanner}

              <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-xs font-semibold pt-1">
                <button
                  type="button"
                  onClick={() => setShowFollowingModal(true)}
                  className={`flex items-center gap-1 border px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                    isOwner 
                      ? 'text-purple-200 bg-purple-900/40 border-purple-800/50 hover:bg-purple-900/65' 
                      : 'text-gray-600 bg-gray-50 border-gray-100 hover:bg-gray-100'
                  }`}
                >
                  <span className={`${isOwner ? 'text-purple-300' : 'text-indigo-600'} font-bold font-display`}>{followingCount}</span>
                  <span className={`${isOwner ? 'text-purple-300/60' : 'text-gray-400'} font-medium`}>关注中</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowFollowersModal(true)}
                  className={`flex items-center gap-1 border px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                    isOwner 
                      ? 'text-purple-200 bg-purple-900/40 border-purple-800/50 hover:bg-purple-900/65' 
                      : 'text-gray-600 bg-gray-50 border-gray-100 hover:bg-gray-100'
                  }`}
                >
                  <span className={`${isOwner ? 'text-purple-300' : 'text-indigo-600'} font-bold font-display`}>{followersCount}</span>
                  <span className={`${isOwner ? 'text-purple-300/60' : 'text-gray-400'} font-medium`}>粉丝</span>
                </button>
              </div>
            </div>

            {/* Stats card banner */}
            <div className={statsClass}>
              <div className="px-3">
                <span className={statsNumClass}>{publishedCount}</span>
                <span className={statsLabelClass}>已发文章</span>
              </div>
              <div className="px-3">
                <span className={statsNumClass}>{draftCount}</span>
                <span className={statsLabelClass}>保存草稿</span>
              </div>
              <div className="px-3">
                <span className={statsNumClass}>{totalReceivedLikes}</span>
                <span className={statsLabelClass}>获赞总计</span>
              </div>
            </div>
          </div>
        );
      })()}

      {user.role === 'reader' && (
        <div className="bg-gradient-to-r from-indigo-50/50 to-purple-50/25 rounded-3xl border border-indigo-100/60 p-6 sm:p-8 space-y-4 text-left shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <h3 className="font-display font-bold text-gray-900 text-base sm:text-lg flex items-center gap-2">
                <PenTool className="h-5 w-5 text-indigo-600 animate-pulse" />
                申请成为专栏作者 🖋️
              </h3>
              <p className="text-xs text-gray-600 leading-relaxed max-w-2xl font-sans">
                开启您的创作之旅！审核通过成为本站签约作者后，即可解锁完备的创作者全套套件：撰写博文发布、文章定时发布、全自由的封面图片裁剪上传和精美的专属个人展台。
              </p>
            </div>
            
            {!application && (
              <button
                onClick={() => {
                  setApplyBio('');
                  setApplySample('');
                  setShowApplyModal(true);
                }}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-sm transition-all hover:scale-102 cursor-pointer shrink-0"
              >
                立即提交申请
              </button>
            )}
          </div>

          {application && application.status === 'pending' && (
            <div className="bg-amber-50/70 border border-amber-200/50 rounded-2xl p-4 space-y-2 font-sans">
              <p className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
                <Clock className="h-4 w-4 animate-pulse" />
                您的专栏作者申请正在审批中 (待站长处理) ⏳
              </p>
              <div className="text-xs text-gray-600 space-y-1 bg-white/50 p-3 rounded-xl border border-amber-100/30">
                <p><span className="font-bold text-gray-800">申请理由（原因）：</span>{application.bio}</p>
                {application.sampleContent && <p><span className="font-bold text-gray-800">创作代表作/简介：</span>{application.sampleContent}</p>}
                <p className="text-[10px] text-gray-400 font-mono mt-1">提交日期：{new Date(application.createdAt).toLocaleString()}</p>
              </div>
            </div>
          )}

          {application && application.status === 'rejected' && (
            <div className="bg-rose-50/70 border border-rose-200/50 rounded-2xl p-4 space-y-3 font-sans">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-bold text-rose-800 flex items-center gap-1.5">
                  <X className="h-4 w-4 shrink-0" />
                  您的申请未通过审批 📨
                </p>
                <button
                  onClick={() => {
                    setApplyBio(application.bio || '');
                    setApplySample(application.sampleContent || '');
                    setShowApplyModal(true);
                  }}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[10px] font-bold transition-all cursor-pointer shadow-sm hover:scale-102"
                >
                  修改申请并重新提交
                </button>
              </div>
              <div className="text-xs text-gray-600 space-y-1">
                <div className="bg-white/80 p-3 rounded-xl border border-rose-100/30 text-xs text-rose-950 leading-relaxed">
                  <span className="font-bold text-rose-900 block mb-1">站长拒绝原因：</span>
                  {(application as any).rejectReason || '未提供具体拒绝原因'}
                </div>
                <p className="text-[10px] text-gray-400 font-mono mt-1">处理日期：{new Date(application.createdAt).toLocaleString()}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Google Drive Backup Panel for Authors/Owners */}
      {(user.role === 'author' || user.role === 'owner') && (
        <div className="bg-gradient-to-r from-indigo-50/20 via-white to-blue-50/10 rounded-3xl border border-gray-150 p-6 space-y-4 shadow-3xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-indigo-50/85 text-indigo-600 rounded-2xl shrink-0">
                <Cloud className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h3 className="font-display font-bold text-gray-900 text-base flex items-center gap-2">
                  <span>Google Drive 自动备份管理</span>
                  {driveToken ? (
                    <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-[10px] font-black px-2 py-0.5 rounded-full border border-emerald-100">
                      ● 已授权连接
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 bg-gray-50 text-gray-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-gray-100">
                      未连接
                    </span>
                  )}
                </h3>
                <p className="text-xs text-gray-500 font-medium leading-relaxed max-w-2xl font-sans">
                  作为创作者，您可以轻松连接您的个人 Google Drive 云盘。一键安全备份全站所有个人的作品草稿和发布稿件为精美的 Markdown 格式，防止任何本地及设备故障导致内容丢失。
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 sm:self-center shrink-0">
              {!driveToken ? (
                <button
                  type="button"
                  onClick={handleConnectDrive}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Cloud className="h-4 w-4" />
                  连接 Google Drive
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={backingUpAll || myPosts.length === 0}
                    onClick={handleBackupAll}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {backingUpAll ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>正在备份 ({backupIndex}/{myPosts.length})...</span>
                      </>
                    ) : (
                      <>
                        <Cloud className="h-4 w-4" />
                        <span>一键备份全部作品 ({myPosts.length}篇)</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    disabled={backingUpAll}
                    onClick={handleDisconnectDrive}
                    className="px-3 py-2 border border-gray-200 hover:border-gray-300 bg-white text-gray-500 hover:text-gray-700 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                  >
                    断开连接
                  </button>
                </>
              )}
            </div>
          </div>

          {backupMessage && (
            <div className={`p-4 rounded-2xl flex items-start gap-2.5 text-xs font-semibold leading-normal ${
              backupMessage.type === 'success' 
                ? 'bg-emerald-50 border border-emerald-100/60 text-emerald-800' 
                : 'bg-rose-50 border border-rose-100/60 text-rose-800'
            }`}>
              {backupMessage.type === 'success' ? (
                <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
              )}
              <span>{backupMessage.text}</span>
            </div>
          )}

          {backingUpAll && (
            <div className="space-y-1.5 bg-indigo-50/30 p-4 rounded-2xl border border-indigo-100/30">
              <div className="flex justify-between items-center text-[10px] text-indigo-700 font-extrabold uppercase font-mono">
                <span>云端同步进度 (Google Drive Backup Status)</span>
                <span>{Math.round((backupIndex / myPosts.length) * 100)}%</span>
              </div>
              <div className="w-full bg-indigo-100/50 h-2.5 rounded-full overflow-hidden">
                <div 
                  className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                  style={{ width: `${(backupIndex / myPosts.length) * 100}%` }}
                />
              </div>
              <p className="text-[10px] text-gray-400 font-medium">
                正在上传: 「{myPosts[backupIndex - 1]?.title}」... 请勿关闭页面。
              </p>
            </div>
          )}
        </div>
      )}

      {/* PWA 绿色客户端桌面安装与系统级通知中心 */}
      <div className="bg-gradient-to-r from-zinc-50 via-white to-indigo-50/5 rounded-3xl border border-gray-150 p-6 space-y-6 shadow-3xs">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-3 bg-indigo-50/80 text-indigo-600 rounded-2xl shrink-0">
              <Smartphone className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h3 className="font-display font-bold text-gray-900 text-base flex items-center gap-2">
                <span>PWA 绿色桌面端极速安装与通知中心</span>
                <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 text-[10px] font-black px-2 py-0.5 rounded-full border border-indigo-100 animate-pulse">
                  绿色纯净无毒
                </span>
              </h3>
              <p className="text-xs text-gray-500 font-medium leading-relaxed max-w-2xl font-sans">
                本应用已完全适配谷歌 ＆ 苹果 PWA (Progressive Web App) 标准，支持直接将本应用一键添加至您的手机主屏幕。添加后它将像普通 APP 一样独立全屏运行，并享有系统级通知权限。
              </p>
            </div>
          </div>
        </div>

        {/* System permission display and activation buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Permission Card */}
          <div className="p-4 bg-white rounded-2xl border border-gray-100 space-y-3.5 shadow-3xs">
            <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider font-mono flex items-center gap-1.5">
              <Settings className="h-3.5 w-3.5 text-indigo-500" />
              <span>通知权限与通道状态</span>
            </h4>
            
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 font-semibold">Android 系统通道状态：</span>
              {notifPermission === 'granted' ? (
                <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-xs font-bold px-2.5 py-1 rounded-lg border border-emerald-100">
                  🟢 运行中（已授权）
                </span>
              ) : notifPermission === 'denied' ? (
                <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 text-xs font-bold px-2.5 py-1 rounded-lg border border-rose-100">
                  🔴 已禁用（拒绝接收）
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 text-xs font-bold px-2.5 py-1 rounded-lg border border-amber-100">
                  🟡 待激活（默认）
                </span>
              )}
            </div>

            <p className="text-[11px] text-gray-400 font-medium leading-relaxed">
              {notifPermission === 'granted' 
                ? '恭喜，通知通道已完全打开！您可以在安卓设备的「应用通知管理」中看到本应用，并在此处精细化调整该通知通道是否静音、是否震动、是否置顶等。' 
                : '如果已安装应用后仍然收不到通知，请长按您的桌面的“私密阅读”图标 -> 应用信息 -> 通知管理 -> 开启所有通知选项开关。'}
            </p>

            {notifPermission !== 'granted' && (
              <button
                type="button"
                onClick={handleRequestNotifPermission}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Bell className="h-4 w-4" />
                立即激活原生系统通知权限
              </button>
            )}
          </div>

          {/* Diagnostic Test Card */}
          <div className="p-4 bg-white rounded-2xl border border-gray-100 space-y-3.5 shadow-3xs flex flex-col justify-between">
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider font-mono flex items-center gap-1.5">
                <Bell className="h-3.5 w-3.5 text-indigo-500" />
                <span>原生系统级通知诊断（测试）</span>
              </h4>
              
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-gray-500 font-semibold shrink-0">发送延时：</span>
                <select
                  value={testNotifDelay}
                  onChange={(e) => setTestNotifDelay(e.target.value)}
                  disabled={isTestingNotif}
                  className="bg-gray-50 border border-gray-200 text-gray-800 font-bold py-1 px-2.5 rounded-lg text-xs outline-hidden focus:border-indigo-500"
                >
                  <option value="0">⚡️ 立即发送通知</option>
                  <option value="5000">⏳ 延时 5 秒发送（推荐锁屏测试）</option>
                </select>
              </div>

              <p className="text-[11px] text-gray-400 font-medium leading-relaxed">
                {testNotifDelay === '5000' 
                  ? '💡 点击测试按钮后，建议立即将您的安卓设备完全锁屏，或按下 Home 键返回桌面。5 秒后系统将直接在您手机顶部推送高优先级横幅通知，证明后台进程接通！' 
                  : '💡 点击测试按钮后，应用会在系统通知栏立即推送一条消息，这不需要依赖复杂的第三方消息队列。'}
              </p>
            </div>

            <button
              type="button"
              disabled={isTestingNotif || notifPermission !== 'granted'}
              onClick={handleTriggerTestNotification}
              className="w-full py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 disabled:bg-gray-50 disabled:text-gray-400 border border-indigo-100/30 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {isTestingNotif ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                  <span>{testNotifCountdown > 0 ? `将在 ${testNotifCountdown} 秒后发送...` : '正在推送...'}</span>
                </>
              ) : (
                <>
                  <Bell className="h-4 w-4" />
                  <span>发送测试系统通知</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Installation Guide */}
        <div className="p-4.5 bg-indigo-50/20 border border-indigo-100/30 rounded-2xl space-y-3.5">
          <h4 className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
            <Smartphone className="h-4 w-4" />
            <span>📲 「免下载 PWA 桌面独立版」极速安装与防误报说明（兼容 5.0 - 13.0+ 安卓 ＆ 苹果）</span>
          </h4>
          <div className="text-[11px] text-indigo-950 font-semibold bg-white/70 p-3 rounded-xl border border-indigo-100 space-y-1.5 leading-relaxed">
            <p className="text-indigo-800">🔒 为什么推荐安装「PWA 桌面独立版」而不是打包普通 APK？</p>
            <ul className="list-disc pl-4 space-y-1 text-gray-600 font-medium">
              <li><strong className="text-indigo-700">100% 绿色安全，免遭误报：</strong> 现代安卓系统（特别是华为/小米/OPPO等）对未上架应用商店、无昂贵企业证书的个人自建 APK 进行极为严苛甚至武断的“风险软件/不安全软件”拦截和警告。PWA 运行于浏览器沙箱内，<strong className="text-emerald-600">绝对不会触发任何手机病毒或风险提示</strong>。</li>
              <li><strong className="text-indigo-700">完美原生体验：</strong> 安装后会在手机桌面生成独立精美图标，以全屏沉浸、无浏览器网址栏的模式独立运行。它像普通 APK 一样拥有独立的任务切换窗口，支持离线加载与系统通知推送！</li>
              <li><strong className="text-indigo-700">极致轻量，不占内存：</strong> 相比动辄几十MB的安装包，PWA 仅占用不到 1MB，且启动极速。</li>
            </ul>
          </div>
          <ol className="text-[11px] text-gray-600 leading-relaxed font-semibold space-y-1.5 list-decimal pl-4.5">
            <li>
              使用您安卓手机上的系统自带浏览器或推荐的 <span className="text-indigo-600 font-bold">Chrome 浏览器</span> 打开本站（即当前的 Shared App URL）。
            </li>
            <li>
              点击浏览器右上角或底部的菜单选项（如 Chrome 的 <span className="font-bold text-gray-800">「⋮」</span>），在弹出的菜单中选择 <span className="text-indigo-600 font-bold">「安装应用」</span>（部分浏览器可能显示为「添加到主屏幕」或「添加至桌面」）。
            </li>
            <li>
              手机系统会自动为您在主屏幕上创建该应用的精美图标。此时，它已经转化为一个 <span className="text-indigo-650 font-bold">无需传统下载的、系统级独立的专栏应用</span>！
            </li>
            <li>
              <span className="font-bold text-gray-950">关于通知与通道权限：</span>
              首次启动或点击上方的“激活权限”按钮时，请允许通知授权。随后，您随时可以长按桌面应用图标选择 <span className="font-bold text-gray-800">「应用信息」-「通知管理」</span>，根据个人喜好开启或调整通知横幅、锁屏显示等选项。
            </li>
          </ol>
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
                  <div className="h-12 w-20 rounded-lg overflow-hidden border border-gray-100 shrink-0">
                    <ImageWrapper
                      src={post.coverImage || post.images?.[0] || 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=150&q=80'}
                      alt={post.title}
                      width={150}
                      isR18={post.isR18}
                      className="w-full h-full object-cover"
                      placeholderClassName="w-full h-full"
                    />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors font-display text-sm leading-snug line-clamp-1 flex items-center gap-1.5">
                      {post.isR18 && (
                        <span className="shrink-0 bg-rose-100 text-rose-700 text-[9px] font-extrabold px-1.5 py-0.5 rounded-md uppercase tracking-wider font-mono">
                          R18
                        </span>
                      )}
                      <span>{post.title}</span>
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
                <div className="text-center py-16 text-gray-400 italic text-xs">暂无粉丝关注您</div>
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
                    {onSelectAuthor && (
                      <button
                        onClick={() => {
                          setShowFollowersModal(false);
                          onSelectAuthor(f.followerId);
                        }}
                        className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                      >
                        查看
                      </button>
                    )}
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
              <h3 className="font-display font-bold text-gray-900 text-sm">关注中的作者 ({followingCount})</h3>
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
                      {onSelectAuthor && (
                        <button
                          onClick={() => {
                            setShowFollowingModal(false);
                            onSelectAuthor(f.followingId);
                          }}
                          className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                        >
                          查看
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Author Application Form Modal */}
      {showApplyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-xs" onClick={() => setShowApplyModal(false)} />
          <div className="bg-white rounded-3xl border border-gray-100 shadow-xl max-w-lg w-full overflow-hidden flex flex-col z-10 animate-fade-in text-left font-sans">
            <div className="p-5 border-b border-gray-50 flex items-center justify-between bg-gradient-to-r from-indigo-50/25 to-purple-50/10">
              <div className="flex items-center gap-2">
                <PenTool className="h-5 w-5 text-indigo-600 animate-pulse" />
                <h3 className="font-display font-bold text-gray-900 text-sm">申请入驻签约作者</h3>
              </div>
              <button
                onClick={() => setShowApplyModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleApplySubmit} className="p-6 space-y-4 overflow-y-auto max-h-[520px]">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-gray-700">1. 申请理由 / 创作计划 <span className="text-rose-500">*</span></label>
                <span className="text-[10px] text-gray-400 block pb-1">简要阐述您申请开通作者权限的动机和发文计划（如：同人方向、更新频次等）</span>
                <textarea
                  required
                  value={applyBio}
                  onChange={(e) => setApplyBio(e.target.value)}
                  placeholder="例：我计划在专栏发布以《未定事件簿》和《原神》为主的乙女/双向奔赴向同人博文，计划每周至少双更。希望能借此平台和更多同好进行同人创作交流。"
                  rows={4}
                  className="allow-paste w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-3 text-xs text-gray-850 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all resize-none"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-gray-700">2. 个人简介 / 代表作（可选）</label>
                <span className="text-[10px] text-gray-400 block pb-1">提供您的过往代表作品片段、大纲，或者您在其他同人网站的个人主页链接</span>
                <textarea
                  value={applySample}
                  onChange={(e) => setApplySample(e.target.value)}
                  placeholder="例：曾在某站发表过3篇万字完结同人，主打治愈与救赎风格，具有稳定的写作水平。附上简介：主打温暖微甜的双向奔赴..."
                  rows={5}
                  className="allow-paste w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-3 text-xs text-gray-850 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3 border-t border-gray-50">
                <button
                  type="button"
                  onClick={() => setShowApplyModal(false)}
                  className="px-4 py-2 border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingApp}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-400 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  {isSubmittingApp && <Loader2 className="h-3 w-3 animate-spin" />}
                  {isSubmittingApp ? '正在提交...' : '确认并提交申请'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
