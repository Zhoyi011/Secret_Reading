import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Post, AppUser, Announcement, StoryBounty, CPVoteTheme, UserStreak, BountyClaim } from '../types';
import { Search, PenTool, LayoutGrid, List, Heart, Calendar, User as UserIcon, BookOpen, AlertCircle, Eye, Bookmark, Tag, SlidersHorizontal, Check, X, Megaphone, Sparkles, Star, Flame, Trophy, TrendingUp, Plus, ChevronRight, HelpCircle, Send, Award, Gift, Clock } from 'lucide-react';
import { searchMatches } from '../utils/chineseConverter';
import ImageWrapper from './ImageWrapper';
import { motion } from 'motion/react';
import AuthorDirectory from './AuthorDirectory';

interface HomeProps {
  user: AppUser | null;
  onNavigate: (route: string) => void;
  onSelectPost: (postId: string) => void;
  onSelectAuthor?: (authorId: string) => void;
}

const TAG_CATEGORIES: Record<string, string[]> = {
  '内容主题': ['纯爱', '虐恋', '病娇', '黑化', '救赎', '先婚后爱', '破镜重圆', '暗恋成真', '替身文学', '强制爱', '养成系', '双向奔赴', '恨海情天', '宿命感'],
  '关系设定': ['师生', '师徒（年上）', '师徒（年下）', '上司下属', '青梅竹马', '天降', '骨科（亲）', '骨科（伪）', '宿敌', '主仆', '老板员工', '教授学生', '继亲', '叔侄', '义兄弟/义姐妹'],
  '场景风格': ['架空', '现代', '古代', '民国', '星际', '末世', '西幻', '东方玄幻', 'ABO', '哨兵向导', '穿越', '重生', '系统', '无限流', '娱乐圈', '电竞', '校园', '职场', '黑道', '悬疑'],
  '特殊属性': ['微肉', '中肉', '重肉', '纯肉', '前戏为主', '后入', '骑乘', '口交', '足交', '乳交', 'SM', '捆绑', '强制', '催眠', '触手', '兽人', '人外', '产乳', '怀孕', '双性', '扶她', '女攻男受', '男攻女受', '互攻'],
  '结局倾向': ['甜', '微虐', '大虐', '先虐后甜', '先甜后虐', '开放式结局', 'HE', 'BE', '意难平']
};

const AVAILABLE_TAGS = Object.values(TAG_CATEGORIES).flat();

type SortOption = 'latest' | 'non-r18' | 'r18' | 'following' | 'hottest' | 'likes' | 'collects';

export default function Home({ user, onNavigate, onSelectPost, onSelectAuthor }: HomeProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [indexErrorLink, setIndexErrorLink] = useState<string | null>(null);

  // Advanced features state
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showTagModal, setShowTagModal] = useState(false);
  const [tagSearchQuery, setTagSearchQuery] = useState('');
  const [activeTagTab, setActiveTagTab] = useState<string>('全部');
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>('latest');
  
  // Announcements and local closed ones
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [closedAnnouncementIds, setClosedAnnouncementIds] = useState<string[]>([]);

  // Community tab & features states
  const [homeTab, setHomeTab] = useState<'posts' | 'community' | 'authors'>('posts');
  
  // 1. Reading Check-in (User Streak)
  const [streakInfo, setStreakInfo] = useState<UserStreak | null>(null);
  const [checkingIn, setCheckingIn] = useState(false);

  // 2. CP Monthly Theme Poll
  const [cpPoll, setCpPoll] = useState<CPVoteTheme | null>(null);
  const [votingId, setVotingId] = useState<string | null>(null);

  // 3. Story Bounties
  const [bounties, setBounties] = useState<StoryBounty[]>([]);
  const [showBountyModal, setShowBountyModal] = useState(false);
  const [newBountyTitle, setNewBountyTitle] = useState('');
  const [newBountyDesc, setNewBountyDesc] = useState('');
  const [newBountyPoints, setNewBountyPoints] = useState(50);
  const [bountySubmitting, setBountySubmitting] = useState(false);
  
  // Bounty Claims
  const [claimingBountyId, setClaimingBountyId] = useState<string | null>(null);
  const [claimTitle, setClaimTitle] = useState('');
  const [claimLink, setClaimLink] = useState('');
  const [claimComment, setClaimComment] = useState('');
  const [claimSubmitting, setClaimSubmitting] = useState(false);

  // 4. Reader Fan List & Trending
  const [topFansList, setTopFansList] = useState<{ userId: string; username: string; avatar: string; score: number }[]>([]);

  useEffect(() => {
    setLoading(true);

    const postsRef = collection(db, 'posts');
    
    // Proper indexed query
    const qProper = query(
      postsRef,
      where('status', '==', 'published'),
      orderBy('createdAt', 'desc')
    );

    // Unsorted fallback query
    const qFallback = query(
      postsRef,
      where('status', '==', 'published')
    );

    let unsubscribe: () => void = () => {};

    const startListener = (useFallback: boolean) => {
      if (unsubscribe) unsubscribe();

      const qToUse = useFallback ? qFallback : qProper;

      unsubscribe = onSnapshot(qToUse, (snapshot) => {
        const loadedPosts = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Post[];

        if (useFallback) {
          // Default sorting client-side
          loadedPosts.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        }
        setPosts(loadedPosts);
        setLoading(false);
      }, (error) => {
        const errorStr = (error.message || String(error)).toLowerCase();
        if (!useFallback && (errorStr.includes('index') || errorStr.includes('composite') || errorStr.includes('failed-precondition'))) {
          console.warn("Home component detected missing composite index. Falling back to client-side sorting gracefully...", error);
          setIndexErrorLink(
            `https://console.firebase.google.com/v1/r/project/secret-reading/firestore/indexes?create_composite=Ckxwcm9qZWN0cy9zZWNyZXQtcmVhZGluZy9kYXRhYmFzZXMvKGRlZmF1bHQpL2NvbGxlY3Rpb25Hcm91cHMvcG9zdHMvaW5kZXhlcy9fEAEaCgoGc3RhdHVzEAEaDQoJY3JlYXRlZEF0EAIaDAoIX19uYW1lX18QAg`
          );
          startListener(true);
        } else {
          console.error("Firestore loading posts failed:", error);
          handleFirestoreError(error, OperationType.LIST, 'posts');
          setLoading(false);
        }
      });
    };

    startListener(false);

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Listen to authors followed by current user
  useEffect(() => {
    if (!user) {
      setFollowingIds([]);
      return;
    }
    const q = query(collection(db, 'follows'), where('followerId', '==', user.firebaseUid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ids = snapshot.docs.map(doc => doc.data().followingId) as string[];
      setFollowingIds(ids);
    }, (error) => {
      console.error("Failed to load following in Home:", error);
    });
    return () => unsubscribe();
  }, [user]);

  // Listen to system announcements
  useEffect(() => {
    try {
      const closed = localStorage.getItem('closed_announcements');
      if (closed) {
        setClosedAnnouncementIds(JSON.parse(closed));
      }
    } catch (e) {
      console.error(e);
    }

    const q = query(
      collection(db, 'announcements'),
      where('active', '==', true)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loaded = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Announcement[];
      loaded.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setAnnouncements(loaded);
    }, (error) => {
      console.error("Failed to load announcements in Home:", error);
    });
    return () => unsubscribe();
  }, []);

  const handleCloseAnnouncement = (id: string) => {
    const updated = [...closedAnnouncementIds, id];
    setClosedAnnouncementIds(updated);
    try {
      localStorage.setItem('closed_announcements', JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
  };

  // ==========================================
  // COMMUNITY HUB & INTERACTIVE ENGINE LOGIC
  // ==========================================

  // 1. Listen to User Streak
  useEffect(() => {
    if (!user) {
      setStreakInfo(null);
      return;
    }
    const streakDocRef = doc(db, 'user_streaks', user.firebaseUid);
    const unsubscribe = onSnapshot(streakDocRef, (snap) => {
      if (snap.exists()) {
        setStreakInfo(snap.data() as UserStreak);
      } else {
        setStreakInfo(null);
      }
    }, (error) => {
      console.error("Failed to load streakInfo:", error);
    });
    return () => unsubscribe();
  }, [user]);

  // Streak Check-In action
  const handleCheckIn = async () => {
    if (!user) {
      alert("请先登录再参与每日打卡。");
      return;
    }
    setCheckingIn(true);
    try {
      const todayStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      const streakDocRef = doc(db, 'user_streaks', user.firebaseUid);
      
      let nextStreak = 1;
      let history: string[] = [];
      let badges: string[] = [];

      const currentSnap = await getDoc(streakDocRef);
      if (currentSnap.exists()) {
        const data = currentSnap.data() as UserStreak;
        history = data.history || [];
        badges = data.badges || [];
        
        if (history.includes(todayStr)) {
          alert("您今天已经打过卡啦！明天再来吧~ 💖");
          setCheckingIn(false);
          return;
        }

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().slice(0, 10);

        if (data.lastCheckedIn === yesterdayStr) {
          nextStreak = (data.streakCount || 0) + 1;
        } else if (data.lastCheckedIn === todayStr) {
          nextStreak = data.streakCount || 1;
        } else {
          nextStreak = 1;
        }
      }

      history.push(todayStr);
      
      // Award badges based on streak count
      if (nextStreak >= 1 && !badges.includes('初级书虫')) {
        badges.push('初级书虫');
      }
      if (nextStreak >= 3 && !badges.includes('同人真爱粉')) {
        badges.push('同人真爱粉');
      }
      if (nextStreak >= 7 && !badges.includes('狂热书圣')) {
        badges.push('狂热书圣');
      }

      await setDoc(streakDocRef, {
        id: user.firebaseUid,
        userId: user.firebaseUid,
        username: user.username,
        streakCount: nextStreak,
        lastCheckedIn: todayStr,
        history,
        badges,
        updatedAt: new Date().toISOString()
      });

      alert(`打卡成功！已连续打卡 ${nextStreak} 天！🎉 \n荣获称号：${badges[badges.length - 1] || '无'}`);
    } catch (error) {
      console.error("Check-in failed:", error);
      alert("打卡失败，请重试。");
    } finally {
      setCheckingIn(false);
    }
  };

  // 2. Listen to CP Poll
  useEffect(() => {
    const q = query(collection(db, 'cp_polls'), where('isActive', '==', true));
    const unsubscribe = onSnapshot(q, async (snap) => {
      if (!snap.empty) {
        const firstDoc = snap.docs[0];
        setCpPoll({ id: firstDoc.id, ...firstDoc.data() } as CPVoteTheme);
      } else {
        console.log("CP Polls empty; seeding default monthly theme...");
        const defaultPollId = 'monthly_theme_june_2026';
        const defaultPoll: Omit<CPVoteTheme, 'id'> = {
          title: '本月最虐CP Pick榜 💔',
          description: '本月主题：宿命对立与爱恨纠葛。谁才是你心中最意难平的同人CP？快为你心爱的CP投上宝贵的一票，前两名将获得全站特别推荐位！',
          isActive: true,
          candidates: [
            { id: 'cand_1', name: '【魔尊 × 仙尊】 苍溟 & 叶清歌', description: '高冷仙尊为苍生断念，偏执魔尊囚爱百年：“若毁这诸天能换你回头，吾愿万劫不复。”', votes: 124, voters: [] },
            { id: 'cand_2', name: '【双向卧底】 萧凛 & 陆言安', description: '身处深渊，心向微光。他们在刀刃上跳舞，在黑夜中紧拥：“下辈子，我们干干净净地相爱。”', votes: 98, voters: [] },
            { id: 'cand_3', name: '【病娇年下】 顾小野 & 傅廷深', description: '“傅先生，既然不能做你唯一的玫瑰，那就做刺入你骨血的荆棘吧。”', votes: 145, voters: [] }
          ],
          createdAt: new Date().toISOString()
        };
        try {
          await setDoc(doc(db, 'cp_polls', defaultPollId), defaultPoll);
        } catch (err) {
          console.error("Failed to seed CP poll:", err);
        }
      }
    }, (error) => {
      console.error("Failed to load CP Polls:", error);
    });
    return () => unsubscribe();
  }, []);

  // Handle CP Vote
  const handleVoteCP = async (candidateId: string) => {
    if (!user) {
      alert("请先登录再参与投票。");
      return;
    }
    if (!cpPoll) return;

    const hasVoted = cpPoll.candidates.some(cand => cand.voters && cand.voters.includes(user.firebaseUid));
    if (hasVoted) {
      alert("您本月已经投过票啦！每个主题限投一票。💖");
      return;
    }

    setVotingId(candidateId);
    try {
      const updatedCandidates = cpPoll.candidates.map(cand => {
        if (cand.id === candidateId) {
          return {
            ...cand,
            votes: (cand.votes || 0) + 1,
            voters: [...(cand.voters || []), user.firebaseUid]
          };
        }
        return cand;
      });

      const pollRef = doc(db, 'cp_polls', cpPoll.id);
      await updateDoc(pollRef, {
        candidates: updatedCandidates
      });

      alert("投票成功！感谢您的积极参与！🎉");
    } catch (err) {
      console.error("Voting failed:", err);
      alert("投票失败，请重试。");
    } finally {
      setVotingId(null);
    }
  };

  // 3. Listen to Story Bounties
  useEffect(() => {
    const q = query(collection(db, 'story_bounties'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const loaded: StoryBounty[] = [];
      snap.forEach(d => {
        loaded.push({ id: d.id, ...d.data() } as StoryBounty);
      });
      setBounties(loaded);
    }, (error) => {
      console.error("Failed to load story bounties:", error);
    });
    return () => unsubscribe();
  }, []);

  // Create new bounty
  const handleCreateBounty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!newBountyTitle.trim() || !newBountyDesc.trim()) {
      alert("请输入求文主题与详细描述。");
      return;
    }

    setBountySubmitting(true);
    try {
      const bountyData: Omit<StoryBounty, 'id'> = {
        userId: user.firebaseUid,
        username: user.username,
        avatar: user.avatar,
        title: newBountyTitle,
        description: newBountyDesc,
        rewardAmount: Number(newBountyPoints),
        status: 'open',
        claims: [],
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'story_bounties'), bountyData);
      
      setNewBountyTitle('');
      setNewBountyDesc('');
      setNewBountyPoints(50);
      setShowBountyModal(false);
      alert("发布求文悬赏成功！期待优秀的作者们接单~ 🎨");
    } catch (err) {
      console.error("Failed to post bounty:", err);
      alert("发布失败，请重试。");
    } finally {
      setBountySubmitting(false);
    }
  };

  // Submit Claim to Bounty
  const handleSubmitClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !claimingBountyId) return;
    if (!claimTitle.trim() || !claimComment.trim()) {
      alert("请输入应征作品标题与简短自荐语。");
      return;
    }

    setClaimSubmitting(true);
    try {
      const bountyRef = doc(db, 'story_bounties', claimingBountyId);
      const targetBounty = bounties.find(b => b.id === claimingBountyId);
      if (!targetBounty) return;

      const newClaim: BountyClaim = {
        id: `claim_${Date.now()}`,
        userId: user.firebaseUid,
        username: user.username,
        avatar: user.avatar,
        storyTitle: claimTitle,
        storyLink: claimLink,
        comment: claimComment,
        isAccepted: false,
        createdAt: new Date().toISOString()
      };

      const updatedClaims = [...(targetBounty.claims || []), newClaim];
      await updateDoc(bountyRef, {
        claims: updatedClaims
      });

      setClaimTitle('');
      setClaimLink('');
      setClaimComment('');
      setClaimingBountyId(null);
      alert("提交接单应征成功！已通知发布人进行审核评选。✨");
    } catch (err) {
      console.error("Failed to submit claim:", err);
      alert("接单失败，请重试。");
    } finally {
      setClaimSubmitting(false);
    }
  };

  // Accept a Claim
  const handleAcceptClaim = async (bountyId: string, claimId: string) => {
    if (!user) return;
    const bounty = bounties.find(b => b.id === bountyId);
    if (!bounty) return;

    if (bounty.userId !== user.firebaseUid && user.role !== 'owner') {
      alert("只有该悬赏的发布者可以选定中选作品。");
      return;
    }

    try {
      const updatedClaims = bounty.claims.map(c => {
        if (c.id === claimId) {
          return { ...c, isAccepted: true };
        }
        return c;
      });

      const bountyRef = doc(db, 'story_bounties', bountyId);
      await updateDoc(bountyRef, {
        claims: updatedClaims,
        status: 'claimed'
      });

      alert("成功选定并揭榜！悬赏任务已圆满达成！🎉");
    } catch (err) {
      console.error("Failed to accept claim:", err);
      alert("操作失败，请重试。");
    }
  };

  // Delete a Bounty (only creator or owner)
  const handleDeleteBounty = async (bountyId: string) => {
    if (!user) return;
    if (!window.confirm("确定要删除此求文悬赏吗？")) return;

    try {
      await deleteDoc(doc(db, 'story_bounties', bountyId));
      alert("悬赏已成功删除。");
    } catch (err) {
      console.error("Failed to delete bounty:", err);
    }
  };

  // 4. Live reader engagement / fans aggregator
  useEffect(() => {
    const q = query(collection(db, 'comments'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const counts: Record<string, { username: string; avatar: string; score: number }> = {};
      
      snap.forEach(d => {
        const comment = d.data();
        const uid = comment.userId;
        if (!uid) return;
        
        if (!counts[uid]) {
          counts[uid] = {
            username: comment.username || '匿名读者',
            avatar: comment.avatar || '',
            score: 0
          };
        }
        counts[uid].score += 10;
      });

      const compiled = Object.entries(counts).map(([uid, data]) => ({
        userId: uid,
        ...data
      }));

      compiled.sort((a, b) => b.score - a.score);
      setTopFansList(compiled.slice(0, 5));
    }, (error) => {
      console.error("Failed to compile fan leaderboard:", error);
    });
    return () => unsubscribe();
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 5) return '深夜好 🌌';
    if (hour < 12) return '早安 🌅';
    if (hour < 17) return '下午好 ☕';
    return '晚上好 🌃';
  };

  const filterR18Active = user?.filterR18 !== false; // defaults to true

  // Recommended posts (within the last 48 hours, respecting R18 filtering)
  const recommendedPosts = posts.filter((post) => {
    if (!post.isRecommended || !post.recommendedAt) return false;
    const recommendedTime = new Date(post.recommendedAt).getTime();
    const nowTime = new Date().getTime();
    const hoursDiff = (nowTime - recommendedTime) / (1000 * 60 * 60);
    if (hoursDiff > 48) return false;

    // Respect R18 filter
    if (filterR18Active && post.isR18) return false;
    if (sortBy === 'non-r18' && post.isR18) return false;

    // Must be published
    if (post.status !== 'published') return false;

    return true;
  });

  // Apply filtering and sorting dynamically
  const filteredPosts = posts
    .filter((post) => {
      // 1. R18 level restriction
      if (filterR18Active && post.isR18) {
        return false;
      }

      // If the selected mode is "non-r18" (正常博文), we strictly filter out post.isR18
      if (sortBy === 'non-r18' && post.isR18) {
        return false;
      }

      // If the selected mode is "r18" (R18特区), we strictly filter out !post.isR18 (only show R18 posts)
      if (sortBy === 'r18' && !post.isR18) {
        return false;
      }

      // 2. Scheduled posts check (Only author or admin can view future posts before release time)
      if (post.publishAt) {
        const isFuture = new Date(post.publishAt) > new Date();
        if (isFuture) {
          const isPostAuthor = user && post.authorId === user.firebaseUid;
          const isSiteAdmin = user && user.role === 'owner';
          if (!isPostAuthor && !isSiteAdmin) {
            return false;
          }
        }
      }

      // 3. Category/Tag selection (Multi-selection intersection search)
      if (selectedTags.length > 0) {
        const matchAll = selectedTags.every((t) => post.tags && post.tags.includes(t));
        if (!matchAll) return false;
      }

      // 4. Input search query
      return (
        searchMatches(search, post.title) ||
        searchMatches(search, post.authorName) ||
        searchMatches(search, post.content) ||
        (post.tags && post.tags.some(t => searchMatches(search, t)))
      );
    })
    .sort((a, b) => {
      // Followed authors priority sort
      if (sortBy === 'following') {
        const aFollowed = followingIds.includes(a.authorId) ? 1 : 0;
        const bFollowed = followingIds.includes(b.authorId) ? 1 : 0;
        if (aFollowed !== bFollowed) {
          return bFollowed - aFollowed;
        }
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      }

      // Apply multi-sort rules dynamically on the client side
      if (sortBy === 'hottest') {
        return (b.views || 0) - (a.views || 0);
      }
      if (sortBy === 'likes') {
        return (b.likes || 0) - (a.likes || 0);
      }
      if (sortBy === 'collects') {
        return (b.collects || 0) - (a.collects || 0);
      }
      // Fallback/Default latest
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 text-left animate-fade-in">
      {/* System Announcements */}
      {announcements.filter(ann => !closedAnnouncementIds.includes(ann.id)).map((ann) => (
        <div key={ann.id} className="mb-6 bg-indigo-55/45 bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4 shadow-3xs flex gap-3.5 relative overflow-hidden animate-fade-in group">
          <div className="absolute top-0 left-0 w-1 h-full bg-indigo-600"></div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 shrink-0">
            <Megaphone className="h-5 w-5 animate-bounce" style={{ animationDuration: '3s' }} />
          </div>
          <div className="flex-grow pr-6 space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[9px] bg-indigo-100 text-indigo-800 font-extrabold px-1.5 py-0.5 rounded-md uppercase tracking-wider font-sans">
                系统公告
              </span>
              <span className="text-[10px] text-gray-400 font-mono">
                {new Date(ann.createdAt).toLocaleDateString()}
              </span>
            </div>
            <h4 className="text-sm font-bold text-gray-900 font-display">{ann.title}</h4>
            <p className="text-xs text-gray-600 leading-relaxed font-sans whitespace-pre-wrap">{ann.content}</p>
          </div>
          <button
            onClick={() => handleCloseAnnouncement(ann.id)}
            className="absolute top-3 right-3 p-1.5 text-gray-400 hover:text-gray-655 hover:bg-gray-100 rounded-lg transition-all cursor-pointer"
            title="关闭公告"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}

      {indexErrorLink && (
        <div className="mb-6 p-4 bg-amber-50 rounded-2xl border border-amber-200 shadow-sm" id="composite-index-tip">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-gray-900 font-display">发现索引降级处理中</h4>
              <p className="text-xs text-gray-600 leading-relaxed font-sans">
                应用当前已自动降级为“本地多维组合排序算法”，完全不影响正常业务的使用。您也可以一键点此在您的 Firebase Console 生成此复合索引。
              </p>
              <div className="pt-1.5">
                <a
                  href={indexErrorLink}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-[10px] transition-colors cursor-pointer"
                >
                  ⚡ 点击创建复合索引
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Greetings area */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 bg-gradient-to-r from-indigo-50/60 to-purple-50/20 p-6 rounded-2xl border border-indigo-100/30">
        <div>
          <h2 className="font-display text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            {getGreeting()}，{user?.username || '朗读者'}
          </h2>
          <p className="text-gray-500 text-xs mt-1 leading-normal">
            今天也是绝佳的阅读日。让纸墨心香、同人与真知灼见治愈和指引心灵。
          </p>
        </div>

        {user && (user.role === 'author' || user.role === 'owner') && (
          <button
            onClick={() => onNavigate('write')}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white hover:bg-indigo-500 rounded-xl text-xs font-semibold shadow-sm hover:shadow transition-all group shrink-0 cursor-pointer"
          >
            <PenTool className="h-4 w-4 group-hover:rotate-12 transition-transform" />
            开始落笔写文
          </button>
        )}

        {user && user.role === 'reader' && (
          <button
            onClick={() => onNavigate('profile')}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-50 border border-amber-200 text-amber-800 hover:bg-amber-100 rounded-xl text-xs font-semibold shadow-sm hover:shadow transition-all group shrink-0 cursor-pointer"
          >
            <PenTool className="h-4 w-4 group-hover:rotate-12 transition-transform text-amber-600" />
            申请成为专栏作者 🖋️
          </button>
        )}
      </div>

      {/* Station Master Recommended Section */}
      {recommendedPosts.length > 0 && (
        <div className="mb-8 p-6 bg-gradient-to-br from-amber-50/40 via-amber-50/15 to-transparent border border-amber-200/50 rounded-2xl shadow-3xs animate-fade-in">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-6 w-6 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
              <Sparkles className="h-4 w-4 animate-pulse text-amber-655" />
            </div>
            <h3 className="font-display font-bold text-base text-amber-950 tracking-tight flex items-center gap-1.5">
              站长亲自推荐 🌟
            </h3>
            <span className="text-[10px] text-amber-800 bg-amber-100/60 px-2.5 py-0.5 rounded-full font-bold">
              精选博文限时特推 48 小时
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recommendedPosts.map((post) => {
              const coverImg = post.coverImage || (post.images && post.images.length > 0 ? post.images[0] : undefined);
              const cleanSummary = post.content
                ? post.content.replace(/[#*`[\]]/g, '').slice(0, 100) + '...'
                : '暂无文章摘要';
              
              return (
                <div
                  key={post.id}
                  onClick={() => onSelectPost(post.id)}
                  className="group relative flex gap-4 bg-white p-4 rounded-xl border border-amber-100/60 shadow-3xs hover:shadow-2xs transition-all duration-300 cursor-pointer overflow-hidden"
                >
                  <div className="absolute top-0 right-0 h-10 w-10 flex items-center justify-center overflow-hidden pointer-events-none">
                    <div className="absolute rotate-45 bg-amber-500 text-[8px] text-white font-extrabold py-0.5 px-4 translate-x-2.5 -translate-y-2.5">
                      推荐
                    </div>
                  </div>

                  {coverImg && (
                    <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-lg overflow-hidden shrink-0 border border-gray-100">
                      <ImageWrapper
                        src={coverImg}
                        alt={post.title}
                        width={200}
                        isR18={post.isR18}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        placeholderClassName="w-full h-full"
                      />
                    </div>
                  )}

                  <div className="flex-grow space-y-1 text-left min-w-0 pr-4">
                    <h4 className="font-display font-bold text-gray-900 group-hover:text-indigo-600 transition-colors line-clamp-1 text-xs sm:text-sm leading-snug flex items-center gap-1">
                      {post.isR18 && (
                        <span className="shrink-0 bg-rose-100 text-rose-700 text-[8px] font-extrabold px-1 rounded uppercase font-mono">
                          R18
                        </span>
                      )}
                      <span>{post.title}</span>
                    </h4>
                    <p className="text-gray-500 text-[11px] leading-relaxed line-clamp-2">
                      {cleanSummary}
                    </p>
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-[10px] font-semibold text-gray-655">
                        {post.authorName}
                      </span>
                      <span className="text-[9px] text-amber-600 font-medium">
                        推荐于 {post.recommendedAt ? new Date(post.recommendedAt).toLocaleDateString() : '近日'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Home Navigation Tabs Switcher */}
      <div className="flex gap-6 border-b border-gray-100 mb-8 mt-4 shrink-0 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setHomeTab('posts')}
          className={`pb-3 text-sm font-bold transition-all border-b-2 px-1 relative cursor-pointer shrink-0 ${
            homeTab === 'posts'
              ? 'border-indigo-600 text-indigo-650 font-extrabold'
              : 'border-transparent text-gray-400 hover:text-gray-655'
          }`}
        >
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            精选作品专区
          </div>
        </button>
        <button
          onClick={() => setHomeTab('community')}
          className={`pb-3 text-sm font-bold transition-all border-b-2 px-1 relative cursor-pointer shrink-0 ${
            homeTab === 'community'
              ? 'border-indigo-600 text-indigo-650 font-extrabold'
              : 'border-transparent text-gray-400 hover:text-gray-655'
          }`}
        >
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-indigo-500 animate-pulse" />
            同人互动广场
            <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-[8px] font-black bg-indigo-100 text-indigo-850">
              HOT
            </span>
          </div>
        </button>
        <button
          onClick={() => setHomeTab('authors')}
          className={`pb-3 text-sm font-bold transition-all border-b-2 px-1 relative cursor-pointer shrink-0 ${
            homeTab === 'authors'
              ? 'border-indigo-600 text-indigo-650 font-extrabold'
              : 'border-transparent text-gray-400 hover:text-gray-655'
          }`}
        >
          <div className="flex items-center gap-2">
            <UserIcon className="h-4 w-4 text-indigo-500" />
            创作者名录 / 搜索
            <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-[8px] font-black bg-indigo-100 text-indigo-850">
              NEW
            </span>
          </div>
        </button>
      </div>

      {homeTab === 'posts' && (
        <>
          {/* Category Tags selection bar */}
          <div className="mb-8 bg-white p-5 rounded-2xl border border-gray-100 shadow-2xs space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-indigo-500" />
                <span className="text-xs font-bold text-gray-900 font-display">多维标签筛选</span>
              </div>
              {selectedTags.length > 0 && (
                <button
                  onClick={() => setSelectedTags([])}
                  className="text-[10px] font-bold text-indigo-600 hover:text-indigo-500 hover:underline cursor-pointer"
                >
                  清除全部已选 ({selectedTags.length})
                </button>
              )}
            </div>

            {selectedTags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 p-3 bg-gray-50/50 rounded-xl border border-gray-100">
                {selectedTags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-100/60 animate-in fade-in zoom-in-95 duration-100"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => setSelectedTags(prev => prev.filter(t => t !== tag))}
                      className="p-0.5 hover:bg-indigo-100 text-indigo-500 hover:text-indigo-800 rounded-md transition-colors cursor-pointer"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 bg-gray-50/50 border border-dashed border-gray-250 rounded-xl">
                <span className="text-[11px] text-gray-400 font-medium">💡 当前未应用任何标签筛选，点击下方按钮开始多维过滤</span>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setTagSearchQuery('');
                setActiveTagTab('全部');
                setShowTagModal(true);
              }}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 px-4 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 hover:text-indigo-700 rounded-xl text-xs font-bold transition-all border border-indigo-100/55 cursor-pointer shadow-3xs"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              选择多维筛选标签 ({selectedTags.length > 0 ? `已选 ${selectedTags.length} 个` : '点击选择题材设定'})
            </button>
          </div>

          {/* Search and sort toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 bg-white p-4 rounded-2xl border border-gray-100 shadow-2xs">
            <div className="relative flex-1 max-w-md">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                <Search className="h-4 w-4" />
              </span>
              <input
                type="text"
                placeholder="搜索博文标题、正文、作者、标签..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="allow-paste w-full bg-gray-50/50 border border-gray-200 rounded-xl py-2 pl-9 pr-3 text-xs text-gray-850 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Multi-Sorting dropdown options */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-gray-400 font-sans uppercase">排序与过滤:</span>
                <select
                  id="sorting-and-filtering-select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="rounded-lg border border-gray-200 py-1.5 px-2 text-xs text-gray-650 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="latest">最新发布 📅</option>
                  <option value="non-r18">正常博文（无18） 🍃</option>
                  {!filterR18Active && (
                    <option value="r18">R18 🔞（已关闭过滤）</option>
                  )}
                  {user && (
                    <option value="following">关注作者优先 🌟</option>
                  )}
                  <option value="hottest">最热阅读 🔥</option>
                  <option value="likes">点赞最多 ❤️</option>
                  <option value="collects">最多收藏 📖</option>
                </select>
              </div>

              <div className="h-4 w-px bg-gray-200"></div>

              <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-xl shadow-inner">
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  title="网格排版"
                  className={`p-1.5 rounded-lg transition-all cursor-pointer ${viewMode === 'grid' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-75'}`}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  title="列表排版"
                  className={`p-1.5 rounded-lg transition-all cursor-pointer ${viewMode === 'list' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-75'}`}
                >
                  <List className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Main loading posts state */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
              <span className="text-gray-500 text-xs font-semibold mt-4">正在获取精品专栏博文...</span>
            </div>
          ) : filteredPosts.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 shadow-sm">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gray-50 text-gray-400 mb-4">
                <BookOpen className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-bold text-gray-900 font-display">空空如也</h3>
              <p className="text-xs text-gray-500 mt-2 max-w-sm mx-auto leading-relaxed">
                {search || selectedTags.length > 0 ? '当前筛选条件下暂无公开文章。切换题材或清空搜索词试试。' : '当前专栏还没有发布任何博文噢，快去写篇大作发布吧！'}
              </p>
              {(search || selectedTags.length > 0) && (
                <button
                  onClick={() => {
                    setSearch('');
                    setSelectedTags([]);
                  }}
                  className="mt-4 px-3.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  重置过滤器
                </button>
              )}
            </div>
          ) : (
            <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in" : "space-y-4 animate-fade-in"}>
              {filteredPosts.map((post) => {
                const hasCover = post.images && post.images.length > 0;
                const coverImage = post.coverImage || (hasCover ? post.images[0] : 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=800&q=80');
                const cleanSummary = post.content.replace(/[#*`_[\]()-]/g, '').slice(0, 80) + '...';

                const isFuture = post.publishAt && new Date(post.publishAt) > new Date();

                return (
                  <div
                    key={post.id}
                    onClick={() => onSelectPost(post.id)}
                    className={`group bg-white rounded-2xl overflow-hidden border border-gray-100 cursor-pointer shadow-2xs hover:shadow-sm transition-all duration-300 flex ${viewMode === 'grid' ? 'flex-col' : 'flex-col sm:flex-row h-auto sm:h-40'}`}
                  >
                    {/* Image Section */}
                    <div className={`relative overflow-hidden shrink-0 ${viewMode === 'grid' ? 'aspect-video w-full' : 'w-full sm:w-1/3 md:w-1/4 h-48 sm:h-full'}`}>
                      <ImageWrapper
                        src={coverImage}
                        alt={post.title}
                        width={500}
                        isR18={post.isR18}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-102"
                        placeholderClassName="w-full h-full"
                      />
                      
                      {/* Status badges */}
                      <div className="absolute top-2 left-2 flex flex-col gap-1.5">
                        {post.status === 'draft' && (
                          <span className="bg-amber-400 text-amber-950 text-[9px] px-2 py-0.5 rounded-full font-bold shadow-sm">
                            草稿
                          </span>
                        )}
                        {isFuture && (
                          <span className="bg-indigo-600 text-white text-[9px] px-2 py-0.5 rounded-full font-bold shadow-sm">
                            定时待发布
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Content Section */}
                    <div className="p-5 flex flex-col justify-between flex-grow text-left">
                      <div className="space-y-1.5">
                        <h3 className="font-display font-bold text-gray-900 group-hover:text-indigo-600 transition-colors line-clamp-1 text-sm sm:text-base leading-snug flex items-center gap-1.5 flex-wrap">
                          {post.isR18 && (
                            <span className="shrink-0 bg-rose-100 text-rose-700 text-[9px] font-extrabold px-1.5 py-0.5 rounded-md uppercase tracking-wider font-mono">
                              R18
                            </span>
                          )}
                          {post.isRecommended && post.recommendedAt && (new Date().getTime() - new Date(post.recommendedAt).getTime() < 48 * 60 * 60 * 1000) && (
                            <span className="shrink-0 bg-amber-50 text-amber-700 border border-amber-200/50 text-[9px] font-extrabold px-1.5 py-0.5 rounded-md flex items-center gap-0.5 shadow-3xs">
                              <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-500 animate-pulse" />
                              站长推荐
                            </span>
                          )}
                          <span>{post.title}</span>
                        </h3>
                        <p className="text-gray-500 text-[11px] sm:text-xs line-clamp-2 md:line-clamp-3 leading-relaxed">
                          {cleanSummary}
                        </p>
                      </div>

                      {/* Render Tags Chips directly on the Feed */}
                      {post.tags && post.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {post.tags.map((tg) => (
                            <span key={tg} className="bg-gray-100 text-gray-600 text-[9px] font-bold px-1.5 py-0.5 rounded">
                              #{tg}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-3.5 border-t border-gray-100 mt-4 text-[10px] text-gray-400">
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onSelectAuthor) onSelectAuthor(post.authorId);
                          }}
                          className="flex items-center gap-1.5 font-semibold text-gray-655 hover:text-indigo-600 transition-all cursor-pointer"
                          title="点击查看作者主页"
                        >
                          {post.authorAvatar ? (
                            <img
                              src={post.authorAvatar}
                              alt={post.authorName}
                              className="h-5 w-5 rounded-full object-cover border border-gray-100 shadow-3xs group-hover:scale-105 transition-all"
                            />
                          ) : (
                            <span className="p-0.5 bg-indigo-50 text-indigo-500 rounded-full">
                              <UserIcon className="h-3.5 w-3.5" />
                            </span>
                          )}
                          <span>{post.authorName}</span>
                        </div>

                        <div className="flex items-center gap-2.5 font-mono font-semibold">
                          {post.views !== undefined && (
                            <span className="flex items-center gap-0.5">
                              <Eye className="h-3 w-3" />
                              {post.views}
                            </span>
                          )}
                          <span className="flex items-center gap-0.5 text-rose-500">
                            <Heart className="h-3 w-3 fill-rose-500 text-rose-500" />
                            {post.likes || 0}
                          </span>
                          {post.collects !== undefined && post.collects > 0 && (
                            <span className="flex items-center gap-0.5 text-indigo-500">
                              <Bookmark className="h-3 w-3 fill-indigo-500 text-indigo-500" />
                              {post.collects}
                            </span>
                          )}
                          <span className="flex items-center gap-0.5">
                            <Calendar className="h-3 w-3" />
                            {new Date(post.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {homeTab === 'community' && (
        /* -------------------------------------------------------------
           同人互动广场 (COMMUNITY HUB) VIEWS
           ------------------------------------------------------------- */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in text-left">
          {/* Main Two-Column Left Area */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* 1. 每日阅读打卡 / 7-Day Streak challenge */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-2xs space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-rose-50 text-rose-600 rounded-xl">
                    <Flame className="h-5 w-5 animate-pulse text-rose-500" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 font-display">连续阅读打卡挑战</h3>
                    <p className="text-[10px] text-gray-400">每天阅读任意博文即在此打卡，连续打卡可获得尊贵虚拟成就称号勋章！</p>
                  </div>
                </div>
                
                <button
                  onClick={handleCheckIn}
                  disabled={checkingIn}
                  className={`px-5 py-2 rounded-xl text-xs font-black tracking-wide shadow-sm hover:shadow transition-all shrink-0 cursor-pointer ${
                    streakInfo?.history?.includes(new Date().toISOString().slice(0, 10))
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-not-allowed'
                      : 'bg-gradient-to-r from-rose-500 to-amber-500 text-white hover:opacity-90'
                  }`}
                >
                  {checkingIn ? (
                    <div className="flex items-center gap-1.5">
                      <Loader2 className="h-3 w-3 border-white shrink-0" />
                      记录中...
                    </div>
                  ) : streakInfo?.history?.includes(new Date().toISOString().slice(0, 10)) ? (
                    '✨ 今日已完成打卡'
                  ) : (
                    '🚀 立即今日打卡'
                  )}
                </button>
              </div>

              {/* 7 Days Progress bubbles */}
              <div className="grid grid-cols-7 gap-2.5 py-2.5">
                {[...Array(7)].map((_, i) => {
                  const dayNum = i + 1;
                  const currentStreak = streakInfo?.streakCount || 0;
                  const isCompleted = currentStreak >= dayNum;
                  
                  return (
                    <div
                      key={i}
                      className={`flex flex-col items-center justify-center p-2.5 rounded-xl border transition-all ${
                        isCompleted
                          ? 'bg-rose-50/50 border-rose-200 text-rose-600 shadow-3xs'
                          : 'bg-gray-50 border-gray-200/65 text-gray-400'
                      }`}
                    >
                      <span className="text-[9px] font-sans font-bold uppercase">DAY {dayNum}</span>
                      <div className="h-6 w-6 rounded-full flex items-center justify-center mt-1 bg-white border border-gray-150">
                        {isCompleted ? (
                          <Check className="h-3.5 w-3.5 text-rose-500 font-black" />
                        ) : (
                          <Clock className="h-3.5 w-3.5 text-gray-300" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Badges section */}
              <div className="bg-gray-50/60 rounded-xl p-4 border border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-gray-400 uppercase font-sans tracking-wider block">我的打卡数据 & 实绩</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-black text-rose-600 font-mono">{streakInfo?.streakCount || 0}</span>
                    <span className="text-xs text-gray-600 font-medium">天连续打卡里程碑</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-gray-400 uppercase font-sans tracking-wider block">已获得荣誉成就勋章</span>
                  <div className="flex flex-wrap gap-1.5">
                    {streakInfo?.badges && streakInfo.badges.length > 0 ? (
                      streakInfo.badges.map(badge => (
                        <span
                          key={badge}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-200 shadow-3xs animate-fade-in"
                        >
                          <Award className="h-3.5 w-3.5 text-rose-600" />
                          {badge}
                        </span>
                      ))
                    ) : (
                      <span className="text-[10px] text-gray-400 italic">暂无勋章，连续打卡1天、3天、7天将获得荣誉！</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 2. CP 投票 / Pick 榜 (Monthly CP Theme) */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-2xs space-y-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Heart className="h-5 w-5 text-indigo-600 fill-indigo-100" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900 font-display">月度热门 CP 投票 / Pick 榜</h3>
                  <p className="text-[10px] text-gray-400">本期主题：爱恨纠葛与宿命宿敌，快来为你最意难平的同人CP投上宝贵的一票！</p>
                </div>
              </div>

              {cpPoll ? (
                <div className="space-y-4 pt-1">
                  <div className="p-4 bg-indigo-50/30 rounded-xl border border-indigo-100/50">
                    <h4 className="text-xs font-black text-indigo-950 font-display mb-1">{cpPoll.title}</h4>
                    <p className="text-[11px] text-gray-600 leading-relaxed font-sans">{cpPoll.description}</p>
                  </div>

                  <div className="space-y-3.5">
                    {cpPoll.candidates.map((cand) => {
                      const totalVotes = cpPoll.candidates.reduce((sum, c) => sum + (c.votes || 0), 0) || 1;
                      const percentage = Math.round(((cand.votes || 0) / totalVotes) * 100);
                      const hasVotedThisPoll = cpPoll.candidates.some(c => c.voters && c.voters.includes(user?.firebaseUid || ''));
                      const userVotedThisCand = cand.voters && cand.voters.includes(user?.firebaseUid || '');

                      return (
                        <div key={cand.id} className="bg-gray-50/50 p-4 rounded-xl border border-gray-150/70 space-y-3 relative overflow-hidden group">
                          <div className="flex justify-between items-start gap-4">
                            <div className="space-y-0.5 text-left min-w-0">
                              <h5 className="text-xs font-extrabold text-gray-900 font-display flex items-center gap-1.5">
                                {cand.name}
                                {userVotedThisCand && (
                                  <span className="text-[8px] bg-indigo-100 text-indigo-850 px-1.5 py-0.5 rounded-md font-bold shrink-0">
                                    ★ 我的选择
                                  </span>
                                )}
                              </h5>
                              <p className="text-[10px] text-gray-500 leading-normal line-clamp-2">{cand.description}</p>
                            </div>

                            <button
                              onClick={() => handleVoteCP(cand.id)}
                              disabled={votingId !== null || hasVotedThisPoll}
                              className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all shrink-0 cursor-pointer ${
                                userVotedThisCand
                                  ? 'bg-indigo-600 text-white shadow-3xs'
                                  : hasVotedThisPoll
                                  ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
                                  : 'bg-white border border-indigo-200 text-indigo-655 hover:bg-indigo-50 shadow-3xs'
                              }`}
                            >
                              {votingId === cand.id ? (
                                <Loader2 className="h-3 w-3 border-indigo-600 shrink-0" />
                              ) : userVotedThisCand ? (
                                '已支持'
                              ) : (
                                '投票支持'
                              )}
                            </button>
                          </div>

                          {/* Progress bar */}
                          <div className="space-y-1 pt-1 shrink-0">
                            <div className="flex justify-between items-center text-[10px] text-gray-400 font-semibold font-mono">
                              <span>支持率 {percentage}%</span>
                              <span>{cand.votes || 0} 票</span>
                            </div>
                            <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-indigo-600 rounded-full transition-all duration-1000"
                                style={{ width: `${percentage}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic py-6 text-center">暂无进行中的 CP 投票主题...</p>
              )}
            </div>

            {/* 3. 求文悬赏与许愿广场 */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-2xs space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-amber-50 text-amber-600 rounded-xl">
                    <Gift className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 font-display">求文悬赏 / 读者许愿池</h3>
                    <p className="text-[10px] text-gray-400">找不到满意的题材？发布您的“求文悬赏”，广邀大触作者们揭榜应征执笔！</p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    if (!user) {
                      alert("请先登录。");
                      return;
                    }
                    setShowBountyModal(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 text-white hover:bg-amber-500 rounded-xl text-xs font-black transition-all cursor-pointer shadow-sm hover:shadow"
                >
                  <Plus className="h-3.5 w-3.5" />
                  发布悬赏求文
                </button>
              </div>

              {/* Bounties List */}
              <div className="space-y-4 pt-2">
                {bounties.length === 0 ? (
                  <div className="text-center py-10 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                    <p className="text-xs text-gray-400 italic">许愿池空空如也，快来发布第一个心仪的同人文章悬赏吧~</p>
                  </div>
                ) : (
                  bounties.map((bounty) => (
                    <div key={bounty.id} className="bg-white p-5 rounded-xl border border-gray-150 shadow-3xs space-y-4 text-left">
                      {/* Bounty Card Header */}
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex gap-2.5 items-center min-w-0 text-left">
                          <div className="h-8 w-8 rounded-full bg-gray-100 overflow-hidden shrink-0">
                            {bounty.avatar ? (
                              <img src={bounty.avatar} alt={bounty.username} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center bg-amber-50 text-amber-600 text-xs font-bold">
                                {bounty.username.slice(0, 1)}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                              {bounty.username}
                              <span className="text-[9px] text-gray-400 font-mono">
                                {new Date(bounty.createdAt).toLocaleDateString()}
                              </span>
                            </h4>
                            <p className="text-[10px] text-gray-400 font-medium">发起同人许愿</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black bg-amber-50 text-amber-800 border border-amber-100">
                            💰 {bounty.rewardAmount} 积分
                          </span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-extrabold ${
                            bounty.status === 'open'
                              ? 'bg-indigo-50 text-indigo-700'
                              : 'bg-emerald-50 text-emerald-700'
                          }`}>
                            {bounty.status === 'open' ? '招募中' : '已结单'}
                          </span>
                          {(bounty.userId === user?.firebaseUid || user?.role === 'owner') && (
                            <button
                              onClick={() => handleDeleteBounty(bounty.id)}
                              className="p-1 hover:bg-gray-100 text-gray-400 hover:text-rose-600 rounded-md transition-colors"
                              title="删除悬赏"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Title & Description */}
                      <div className="space-y-1.5 pl-0.5">
                        <h4 className="text-sm font-extrabold text-gray-900 font-display flex items-center gap-1.5">
                          🌟 {bounty.title}
                        </h4>
                        <p className="text-xs text-gray-650 leading-relaxed whitespace-pre-wrap">{bounty.description}</p>
                      </div>

                      {/* Claims (Entries) list */}
                      {bounty.claims && bounty.claims.length > 0 && (
                        <div className="bg-gray-50 p-4 rounded-xl space-y-3 border border-gray-100">
                          <span className="text-[10px] font-black text-gray-400 uppercase font-sans tracking-wide block border-b border-gray-200/50 pb-1.5">
                            📖 揭榜应征作品 ({bounty.claims.length})
                          </span>
                          
                          <div className="space-y-3">
                            {bounty.claims.map((claim) => (
                              <div key={claim.id} className="bg-white p-3 rounded-lg border border-gray-150 text-[11px] leading-relaxed relative group/claim">
                                <div className="flex justify-between items-start gap-4 mb-2">
                                  <div className="flex gap-1.5 items-center font-sans">
                                    <div className="h-5 w-5 rounded-full overflow-hidden shrink-0 bg-gray-100">
                                      {claim.avatar ? (
                                        <img src={claim.avatar} alt={claim.username} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                                      ) : (
                                        <div className="h-full w-full flex items-center justify-center bg-indigo-50 text-indigo-600 text-[8px] font-bold">
                                          {claim.username.slice(0, 1)}
                                        </div>
                                      )}
                                    </div>
                                    <span className="font-bold text-gray-850">{claim.username}</span>
                                    <span className="text-[9px] text-gray-400">
                                      应征于 {new Date(claim.createdAt).toLocaleDateString()}
                                    </span>
                                  </div>

                                  {claim.isAccepted ? (
                                    <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[9px] font-bold">
                                      🏆 已中选
                                    </span>
                                  ) : bounty.status === 'open' && (bounty.userId === user?.firebaseUid || user?.role === 'owner') ? (
                                    <button
                                      onClick={() => handleAcceptClaim(bounty.id, claim.id)}
                                      className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded text-[9px] font-bold transition-all cursor-pointer"
                                    >
                                      🏆 选定中选
                                    </button>
                                  ) : null}
                                </div>

                                <div className="space-y-1 text-left font-sans">
                                  <p className="text-gray-850">
                                    <span className="font-bold text-indigo-650">推荐/创作作品：</span>
                                    {claim.storyLink ? (
                                      <a href={claim.storyLink} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline font-bold">
                                        《{claim.storyTitle}》🔗
                                      </a>
                                    ) : (
                                      <span className="font-semibold text-gray-900">《{claim.storyTitle}》</span>
                                    )}
                                  </p>
                                  <p className="text-gray-500 italic mt-1">「 {claim.comment} 」</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Action to bid / claim */}
                      {bounty.status === 'open' && claimingBountyId !== bounty.id && (
                        <button
                          onClick={() => {
                            if (!user) {
                              alert("请先登录。");
                              return;
                            }
                            setClaimingBountyId(bounty.id);
                          }}
                          className="w-full py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-650 hover:text-indigo-700 text-xs font-extrabold rounded-xl transition-all border border-indigo-100/50 cursor-pointer"
                        >
                          ✍️ 我来揭榜 (提交推荐/写新文)
                        </button>
                      )}

                      {/* Collapsible Claim Form */}
                      {claimingBountyId === bounty.id && (
                        <form onSubmit={handleSubmitClaim} className="bg-indigo-50/40 p-4 rounded-xl border border-indigo-100/50 space-y-3">
                          <div className="flex justify-between items-center pb-1">
                            <span className="text-xs font-bold text-indigo-950">提交接单/应征信息</span>
                            <button
                              type="button"
                              onClick={() => setClaimingBountyId(null)}
                              className="text-[10px] text-gray-400 hover:text-gray-650"
                            >
                              取消
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-indigo-800">推荐/原创作品标题*</label>
                              <input
                                type="text"
                                placeholder="如：《宿命之引》"
                                value={claimTitle}
                                onChange={(e) => setClaimTitle(e.target.value)}
                                className="allow-paste block w-full rounded-lg border border-gray-250 bg-white p-2 text-xs focus:ring-1 focus:ring-indigo-500"
                                required
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-indigo-800">作品链接（选填）</label>
                              <input
                                type="text"
                                placeholder="可填站内或其他博文地址"
                                value={claimLink}
                                onChange={(e) => setClaimLink(e.target.value)}
                                className="allow-paste block w-full rounded-lg border border-gray-250 bg-white p-2 text-xs focus:ring-1 focus:ring-indigo-500"
                              />
                            </div>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-indigo-800">自荐或推荐寄语*</label>
                            <textarea
                              placeholder="说明该作品如何契合悬赏需求，或者简述您的应征大纲与创作特色..."
                              value={claimComment}
                              onChange={(e) => setClaimComment(e.target.value)}
                              className="allow-paste block w-full rounded-lg border border-gray-250 bg-white p-2 text-xs h-16 focus:ring-1 focus:ring-indigo-500"
                              required
                            ></textarea>
                          </div>

                          <button
                            type="submit"
                            disabled={claimSubmitting}
                            className="w-full py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-3xs"
                          >
                            {claimSubmitting ? '提交应征中...' : '确认应征并揭榜 ✨'}
                          </button>
                        </form>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>

          {/* Right Sidebar Community Panels */}
          <div className="space-y-8">
            
            {/* 4. 读者粉丝贡献榜 */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-2xs space-y-4 text-left">
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-amber-500" />
                <h3 className="text-sm font-bold text-gray-900 font-display">同人真爱粉丝榜</h3>
              </div>
              <p className="text-[10px] text-gray-400">根据热烈互动（评论次数、回复同好等）自动折算的本站活跃读者粉丝贡献度！</p>

              <div className="space-y-3 pt-2">
                {topFansList.length === 0 ? (
                  <p className="text-xs text-gray-400 italic py-4 text-center">暂无粉丝数据（快发表你的第一条热评吧）</p>
                ) : (
                  topFansList.map((fan, index) => {
                    const rank = index + 1;
                    return (
                      <div key={fan.userId} className="flex items-center justify-between p-2.5 hover:bg-gray-50 rounded-xl transition-all border border-transparent hover:border-gray-100">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {/* Rank Icon or Badge */}
                          <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                            rank === 1
                              ? 'bg-amber-100 text-amber-800'
                              : rank === 2
                              ? 'bg-slate-150 text-slate-700'
                              : rank === 3
                              ? 'bg-orange-100 text-orange-800'
                              : 'bg-gray-100 text-gray-500'
                          }`}>
                            {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank}
                          </div>

                          <div className="h-7 w-7 rounded-full bg-gray-150 overflow-hidden shrink-0">
                            {fan.avatar ? (
                              <img src={fan.avatar} alt={fan.username} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center bg-indigo-50 text-indigo-650 text-[10px] font-bold">
                                {fan.username.slice(0, 1)}
                              </div>
                            )}
                          </div>

                          <span className="text-xs font-bold text-gray-750 truncate max-w-[100px]">
                            {fan.username}
                          </span>
                        </div>

                        <span className="text-[10px] font-extrabold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full shrink-0">
                          🔥 {fan.score} 贡献度
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* 5. 热门飙升趋势榜 */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-2xs space-y-4 text-left">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-rose-500" />
                <h3 className="text-sm font-bold text-gray-900 font-display">热门飙升同人佳作</h3>
              </div>

              <div className="space-y-4 pt-1">
                {[...posts]
                  .sort((a, b) => ((b.views || 0) + (b.likes || 0) * 5) - ((a.views || 0) + (a.likes || 0) * 5))
                  .slice(0, 3)
                  .map((post, idx) => {
                    const rank = idx + 1;
                    return (
                      <div
                        key={post.id}
                        onClick={() => onSelectPost(post.id)}
                        className="flex gap-3 bg-gray-50/30 p-2.5 rounded-xl border border-gray-150/50 hover:border-indigo-150 shadow-3xs hover:shadow-2xs cursor-pointer transition-all duration-300 group"
                      >
                        <div className={`h-7 w-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
                          rank === 1
                            ? 'bg-rose-100 text-rose-800'
                            : rank === 2
                            ? 'bg-rose-50 text-rose-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {rank}
                        </div>

                        <div className="min-w-0 flex-grow text-left space-y-0.5">
                          <h4 className="text-xs font-bold text-gray-950 group-hover:text-indigo-650 transition-colors line-clamp-1 font-sans">
                            {post.title}
                          </h4>
                          <p className="text-[10px] text-gray-400">
                            作者: <span className="font-semibold text-gray-500">{post.authorName}</span>
                          </p>
                          <div className="flex items-center gap-2 pt-0.5 text-[9px] text-gray-400 font-medium">
                            <span className="flex items-center gap-0.5">
                              <Eye className="h-2.5 w-2.5" />
                              {post.views || 0}
                            </span>
                            <span className="flex items-center gap-0.5">
                              <Heart className="h-2.5 w-2.5 text-rose-500" />
                              {post.likes || 0}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

          </div>

          {/* Create Bounty Modal */}
          {showBountyModal && (
            <div className="fixed inset-0 bg-zinc-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-3xl max-w-md w-full border border-gray-100 shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150 text-left">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-amber-50 text-amber-600 rounded-xl">
                      <Gift className="h-5 w-5" />
                    </span>
                    <h3 className="text-base font-bold text-gray-900 font-display">发布求文悬赏 / 许愿</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowBountyModal(false)}
                    className="p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-650"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <form onSubmit={handleCreateBounty} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-700">悬赏求文主题*</label>
                    <input
                      type="text"
                      placeholder="例如：求一篇傲娇x忠犬的甜文 / 宿敌相爱相杀文"
                      value={newBountyTitle}
                      onChange={(e) => setNewBountyTitle(e.target.value)}
                      className="allow-paste block w-full rounded-xl border border-gray-250 p-2.5 text-xs focus:ring-1 focus:ring-indigo-500"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-700">详细需求描述*</label>
                    <textarea
                      placeholder="您可以描述具体的背景（如修仙、现代）、感情线发展、特定台词、或者想看的情节设定..."
                      value={newBountyDesc}
                      onChange={(e) => setNewBountyDesc(e.target.value)}
                      className="allow-paste block w-full rounded-xl border border-gray-250 p-2.5 text-xs h-28 focus:ring-1 focus:ring-indigo-500"
                      required
                    ></textarea>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-700">悬赏积分数量 (10 - 500)</label>
                    <input
                      type="number"
                      min="10"
                      max="500"
                      value={newBountyPoints}
                      onChange={(e) => setNewBountyPoints(Number(e.target.value))}
                      className="block w-full rounded-xl border border-gray-250 p-2.5 text-xs focus:ring-1 focus:ring-indigo-500"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={bountySubmitting}
                    className="w-full py-3 bg-amber-600 text-white rounded-xl text-xs font-bold hover:bg-amber-700 transition-all shadow-sm"
                  >
                    {bountySubmitting ? '正在发布许愿...' : '发布悬赏 💰'}
                  </button>
                </form>
              </div>
            </div>
          )}

        </div>
      )}

      {homeTab === 'authors' && (
        <AuthorDirectory currentUser={user} onSelectAuthor={onSelectAuthor || (() => {})} />
      )}

      {/* Premium Tag Selector Modal */}
      {showTagModal && (
        <div className="fixed inset-0 bg-zinc-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-2xl w-full border border-gray-100 shadow-2xl flex flex-col h-[85vh] max-h-[680px] overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-left">
            
            {/* Header */}
            <div className="p-6 border-b border-gray-100 flex items-start justify-between shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-xl">
                    <Tag className="h-5 w-5" />
                  </span>
                  <h3 className="text-base font-bold text-gray-900 font-display">选择筛选标签分类</h3>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  选择多个标签进行交集过滤（例如同时选择「甜」+「现代」将仅显示同时具有这两个标签的文章）。
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowTagModal(false)}
                className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-650 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Sub-header Controls: Search & Category tabs */}
            <div className="px-6 py-4 bg-gray-50/50 border-b border-gray-100 space-y-3.5 shrink-0">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="搜索标签（例如：师徒、古代、甜...）"
                  value={tagSearchQuery}
                  onChange={(e) => setTagSearchQuery(e.target.value)}
                  className="block w-full rounded-2xl border border-gray-200 pl-10 pr-4 py-2.5 text-xs text-gray-800 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-100/50 focus:border-indigo-300 transition-all font-medium"
                />
                {tagSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setTagSearchQuery('')}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 p-0.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-650 cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Category tabs */}
              {!tagSearchQuery && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  {['全部', ...Object.keys(TAG_CATEGORIES)].map((category) => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setActiveTagTab(category)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                        activeTagTab === category
                          ? 'bg-indigo-600 text-white shadow-3xs'
                          : 'bg-white border border-gray-200 text-gray-550 hover:bg-gray-100'
                      }`}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Scrollable Tags Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {tagSearchQuery ? (
                // Search Results
                <div className="space-y-3">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    搜索结果 ({
                      AVAILABLE_TAGS.filter(tag => tag.includes(tagSearchQuery)).length
                    } 个标签)
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {AVAILABLE_TAGS.filter(tag => tag.includes(tagSearchQuery)).map((tag) => {
                      const isSelected = selectedTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => {
                            setSelectedTags(prev => 
                              prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
                            );
                          }}
                          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-600 border-indigo-700 text-white shadow-xs'
                              : 'bg-white border-gray-200 text-gray-650 hover:bg-gray-50'
                          }`}
                        >
                          {tag}
                          {isSelected && <Check className="h-3.5 w-3.5 text-indigo-200" />}
                        </button>
                      );
                    })}
                    {AVAILABLE_TAGS.filter(tag => tag.includes(tagSearchQuery)).length === 0 && (
                      <p className="text-xs text-gray-450 italic py-4 w-full text-center">
                        没有找到匹配「{tagSearchQuery}」的标签，换个词试试吧
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                // Categorized list, filtered by active tab
                Object.entries(TAG_CATEGORIES)
                  .filter(([categoryName]) => activeTagTab === '全部' || activeTagTab === categoryName)
                  .map(([categoryName, tags]) => (
                    <div key={categoryName} className="space-y-2.5">
                      <span className="inline-flex items-center text-[10px] font-bold text-indigo-500 font-sans tracking-wide bg-indigo-50/70 px-2 py-0.5 rounded">
                        {categoryName}
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {tags.map((tag) => {
                          const isSelected = selectedTags.includes(tag);
                          return (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => {
                                setSelectedTags(prev => 
                                  prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
                                );
                              }}
                              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 cursor-pointer ${
                                isSelected
                                  ? 'bg-indigo-600 border-indigo-700 text-white shadow-xs'
                                  : 'bg-white border-gray-200 text-gray-650 hover:bg-gray-50'
                              }`}
                            >
                              {tag}
                              {isSelected && <Check className="h-3.5 w-3.5 text-indigo-200" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shrink-0">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-500 font-semibold">当前已选过滤标签:</span>
                  <span className="text-xs font-bold text-indigo-600">
                    {selectedTags.length} 个标签
                  </span>
                </div>
                {/* Micro-preview of selected items in footer */}
                <div className="flex flex-wrap gap-1 max-w-md">
                  {selectedTags.map(tag => (
                    <span key={tag} className="inline-flex items-center text-[9px] font-bold bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded-md border border-indigo-100/50">
                      {tag}
                    </span>
                  ))}
                  {selectedTags.length === 0 && (
                    <span className="text-[10px] text-gray-400 italic">全部文章（未设置标签过滤）</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTags([]);
                  }}
                  className="px-4 py-2 border border-gray-250 hover:bg-gray-100 text-gray-650 hover:text-gray-800 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                >
                  清空筛选
                </button>
                <button
                  type="button"
                  onClick={() => setShowTagModal(false)}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
                >
                  确认并应用筛选 ({selectedTags.length}个)
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

// Simple loader to replace missing imports
function Loader2({ className }: { className?: string }) {
  return <div className={`animate-spin rounded-full border-2 border-indigo-600 border-t-transparent ${className}`} />;
}
