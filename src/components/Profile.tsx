import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, onSnapshot, setDoc, doc, addDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { AppUser, Post, Follow, AuthorApplication } from '../types';
import { User, Calendar, BookOpen, Clock, Edit2, Shield, Heart, HeartOff, PenTool, Users, X, Loader2 } from 'lucide-react';
import ImageWrapper from './ImageWrapper';

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

          <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-xs font-semibold pt-1">
            <button
              type="button"
              onClick={() => setShowFollowingModal(true)}
              className="flex items-center gap-1 text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-100 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
            >
              <span className="text-indigo-600 font-bold font-display">{followingCount}</span>
              <span className="text-gray-400 font-medium">关注中</span>
            </button>
            <button
              type="button"
              onClick={() => setShowFollowersModal(true)}
              className="flex items-center gap-1 text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-100 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
            >
              <span className="text-indigo-600 font-bold font-display">{followersCount}</span>
              <span className="text-gray-400 font-medium">粉丝</span>
            </button>
          </div>
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
