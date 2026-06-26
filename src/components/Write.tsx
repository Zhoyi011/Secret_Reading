import React, { useState, useEffect, useRef } from 'react';
import { doc, getDoc, updateDoc, deleteDoc, setDoc, addDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { AppUser, Post } from '../types';
import { ArrowLeft, Save, Play, Loader2, Image as ImageIcon, Crop, RotateCcw, Edit3, Eye, ShieldAlert, CheckCircle, Tag, Calendar, Search, Check, X, Plus, BookOpen } from 'lucide-react';
import ImageUploader from './ImageUploader';
import ImageCropper from './ImageCropper';

// Safe localStorage implementation to handle Safari Private mode or sandbox environments
const safeLocalStorage = {
  getItem(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch (_) {
      return null;
    }
  },
  setItem(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch (_) {}
  },
  removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (_) {}
  }
};

interface WriteProps {
  user: AppUser | null;
  draftId?: string | null;
  onNavigate: (route: string) => void;
}

const TAG_CATEGORIES: Record<string, string[]> = {
  '内容主题': ['纯爱', '虐恋', '病娇', '黑化', '救赎', '先婚后爱', '破镜重圆', '暗恋成真', '替身文学', '强制爱', '养成系', '双向奔赴', '恨海情天', '宿命感'],
  '关系设定': ['师生', '师徒（年上）', '师徒（年下）', '上司下属', '青梅竹马', '天降', '骨科（亲）', '骨科（伪）', '宿敌', '主仆', '老板员工', '教授学生', '继亲', '叔侄', '义兄弟/义姐妹'],
  '场景风格': ['架空', '现代', '古代', '民国', '星际', '末世', '西幻', '东方玄幻', 'ABO', '哨兵向导', '穿越', '重生', '系统', '无限流', '娱乐圈', '电竞', '校园', '职场', '黑道', '悬疑'],
  '特殊属性': ['微肉', '中肉', '重肉', '纯肉', '前戏为主', '后入', '骑乘', '口交', '足交', '乳交', 'SM', '捆绑', '强制', '催眠', '触手', '兽人', '人外', '产乳', '怀孕', '双性', '扶她', '女攻男受', '男攻女受', '互攻'],
  '结局倾向': ['甜', '微虐', '大虐', '先虐后甜', '先甜后虐', '开放式结局', 'HE', 'BE', '意难平']
};

const AVAILABLE_TAGS = Object.values(TAG_CATEGORIES).flat();

export default function Write({ user, draftId, onNavigate }: WriteProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [isR18, setIsR18] = useState(false);
  const [status, setStatus] = useState<'draft' | 'published'>('draft');
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [coverImage, setCoverImage] = useState('');
  const [croppingCoverUrl, setCroppingCoverUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');

  // New features
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showTagModal, setShowTagModal] = useState(false);
  const [tagSearchQuery, setTagSearchQuery] = useState('');
  const [activeTagTab, setActiveTagTab] = useState<string>('全部');
  const [publishAt, setPublishAt] = useState<string>('');
  const [isPinned, setIsPinned] = useState<boolean>(false);

  // Series/连载 states
  const [seriesId, setSeriesId] = useState('');
  const [seriesTitle, setSeriesTitle] = useState('');
  const [seriesOrder, setSeriesOrder] = useState<number>(1);
  const [authorSeries, setAuthorSeries] = useState<any[]>([]);
  const [isCreatingNewSeries, setIsCreatingNewSeries] = useState(false);
  const [newSeriesTitle, setNewSeriesTitle] = useState('');
  const [newSeriesDesc, setNewSeriesDesc] = useState('');
  const [creatingSeriesLoading, setCreatingSeriesLoading] = useState(false);

  // Fetch author series
  useEffect(() => {
    if (!user) return;
    const loadAuthorSeries = async () => {
      try {
        const q = query(collection(db, 'series'), where('authorId', '==', user.firebaseUid));
        const snap = await getDocs(q);
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setAuthorSeries(list);
      } catch (err) {
        console.error("Failed to load author series list:", err);
      }
    };
    loadAuthorSeries();
  }, [user]);

  const currentPostIdRef = useRef<string>(draftId || doc(collection(db, 'posts')).id);
  const isCreatingProfileRef = useRef<boolean>(false);

  // Load existing draft or set up a new document ID
  useEffect(() => {
    const loadPost = async () => {
      if (!user) return;

      let dbTitle = '';
      let dbContent = '';
      let dbImages: string[] = [];
      let dbCoverImage = '';
      let dbStatus: 'draft' | 'published' = 'draft';
      let dbIsR18 = false;
      let dbTags: string[] = [];
      let dbPublishAt = '';
      let dbIsPinned = false;
      let dbSeriesId = '';
      let dbSeriesTitle = '';
      let dbSeriesOrder = 1;

      if (draftId) {
        try {
          const postRef = doc(db, 'posts', draftId);
          const postSnap = await getDoc(postRef);
          if (postSnap.exists()) {
            const data = postSnap.data();
            dbTitle = data.title || '';
            dbContent = data.content || '';
            dbImages = data.images || [];
            dbCoverImage = data.coverImage || '';
            dbStatus = data.status || 'draft';
            dbIsR18 = data.isR18 || false;
            dbTags = data.tags || [];
            dbPublishAt = data.publishAt || '';
            dbIsPinned = data.isPinned || false;
            dbSeriesId = data.seriesId || '';
            dbSeriesTitle = data.seriesTitle || '';
            dbSeriesOrder = data.seriesOrder !== undefined ? data.seriesOrder : 1;
            currentPostIdRef.current = draftId;
          }
        } catch (err) {
          console.error("Failed to load article draft:", err);
        }
      }

      // Restore from local cached autosave if available and newer/unsaved
      const cacheKey = draftId ? `pending_draft_${user.firebaseUid}_${draftId}` : `pending_draft_${user.firebaseUid}_new`;
      const cached = safeLocalStorage.getItem(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed && (
            parsed.title !== dbTitle || 
            parsed.content !== dbContent || 
            parsed.isR18 !== dbIsR18 || 
            parsed.coverImage !== dbCoverImage || 
            parsed.images?.length !== dbImages.length ||
            parsed.tags?.length !== dbTags.length
          )) {
            setTitle(parsed.title || '');
            setContent(parsed.content || '');
            setImages(parsed.images || dbImages);
            setCoverImage(parsed.coverImage || dbCoverImage);
            setIsR18(parsed.isR18 !== undefined ? parsed.isR18 : dbIsR18);
            setSelectedTags(parsed.tags || dbTags);
            setPublishAt(parsed.publishAt || dbPublishAt);
            setStatus(dbStatus);
            console.log("[DraftRecovery] Restored unsaved modifications from local storage.");
            return;
          }
        } catch (e) {
          console.error("Failed to parse local draft cache:", e);
        }
      }

      setTitle(dbTitle);
      setContent(dbContent);
      setImages(dbImages);
      setCoverImage(dbCoverImage);
      setIsR18(dbIsR18);
      setSelectedTags(dbTags);
      setPublishAt(dbPublishAt);
      setIsPinned(dbIsPinned);
      setStatus(dbStatus);
      setSeriesId(dbSeriesId);
      setSeriesTitle(dbSeriesTitle);
      setSeriesOrder(dbSeriesOrder);
    };

    loadPost();
  }, [draftId, user]);

  // Synchronize current inputs directly to localStorage cache on every change
  useEffect(() => {
    if (!user) return;
    if (title.trim() || content.trim()) {
      const cacheKey = draftId ? `pending_draft_${user.firebaseUid}_${draftId}` : `pending_draft_${user.firebaseUid}_new`;
      safeLocalStorage.setItem(cacheKey, JSON.stringify({
        title,
        content,
        images,
        coverImage,
        isR18,
        tags: selectedTags,
        publishAt,
        isPinned,
        seriesId,
        seriesTitle,
        seriesOrder,
        updatedAt: new Date().toISOString()
      }));
    }
  }, [title, content, images, coverImage, isR18, selectedTags, publishAt, isPinned, seriesId, seriesTitle, seriesOrder, user, draftId]);

  // Autosave timer: every 30 seconds to the cloud Firestore DB
  useEffect(() => {
    const timer = setInterval(() => {
      if (title.trim() || content.trim()) {
        autoSaveDraft();
      }
    }, 30000);

    return () => clearInterval(timer);
  }, [title, content, images, coverImage, isR18, selectedTags, publishAt]);

  const autoSaveDraft = async () => {
    if (!user) return;
    setSaveStatus('saving');
    try {
      const now = new Date().toISOString();
      
      let existingShortId = '';
      const postRef = doc(db, 'posts', currentPostIdRef.current);
      try {
        const snap = await getDoc(postRef);
        if (snap.exists()) {
          existingShortId = snap.data().shortId || '';
        }
      } catch (_) {}

      if (!existingShortId) {
        existingShortId = Math.floor(100000 + Math.random() * 900000).toString();
      }

      const payload = {
        id: currentPostIdRef.current,
        title: title || '未命名草稿',
        content: content || '',
        authorId: user.firebaseUid,
        authorName: user.username,
        authorAvatar: user.avatar || '',
        images: images,
        coverImage: coverImage,
        status: 'draft' as const,
        createdAt: now,
        updatedAt: now,
        isR18: isR18,
        tags: selectedTags,
        publishAt: publishAt || null,
        isPinned: isPinned || false,
        shortId: existingShortId,
        seriesId: seriesId || null,
        seriesTitle: seriesId ? seriesTitle : null,
        seriesOrder: seriesId ? Number(seriesOrder) || 1 : null,
      };

      await setDoc(postRef, payload, { merge: true });

      setLastSaved(new Date().toLocaleTimeString());
      setSaveStatus('saved');
    } catch (err) {
      console.error("Autosave draft failed:", err);
      setSaveStatus('error');
    }
  };

  const handleManualSave = async () => {
    setIsSaving(true);
    await autoSaveDraft();
    setIsSaving(false);
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!title.trim()) {
      alert("请输入文章标题");
      return;
    }
    if (!content.trim()) {
      alert("请输入文章内容");
      return;
    }
    if (selectedTags.length < 3 || selectedTags.length > 5) {
      alert(`每篇文章必须选择 3-5 个标签！您目前选择了 ${selectedTags.length} 个标签。`);
      return;
    }

    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      const isScheduled = publishAt && new Date(publishAt) > new Date();
      
      let likes = 0;
      let likers: string[] = [];
      let existingShortId = '';

      const postRef = doc(db, 'posts', currentPostIdRef.current);
      try {
        const snap = await getDoc(postRef);
        if (snap.exists()) {
          likes = snap.data().likes || 0;
          likers = snap.data().likers || [];
          existingShortId = snap.data().shortId || '';
        }
      } catch (_) {}

      if (!existingShortId) {
        existingShortId = Math.floor(100000 + Math.random() * 900000).toString();
      }

      const payload = {
        id: currentPostIdRef.current,
        title,
        content,
        authorId: user.firebaseUid,
        authorName: user.username,
        authorAvatar: user.avatar || '',
        images: images,
        coverImage: coverImage,
        likes,
        likers,
        status: 'published' as const,
        createdAt: now,
        updatedAt: now,
        isR18: isR18,
        tags: selectedTags,
        publishAt: publishAt || null,
        isPinned: isPinned || false,
        shortId: existingShortId,
        seriesId: seriesId || null,
        seriesTitle: seriesId ? seriesTitle : null,
        seriesOrder: seriesId ? Number(seriesOrder) || 1 : null,
      };

      try {
        await setDoc(postRef, payload);
        const cacheKey = draftId ? `pending_draft_${user.firebaseUid}_${draftId}` : `pending_draft_${user.firebaseUid}_new`;
        safeLocalStorage.removeItem(cacheKey);

        // Notify followers of new published post (if published immediately)
        if (!isScheduled) {
          try {
            const followsRef = collection(db, 'follows');
            const q = query(followsRef, where('followingId', '==', user.firebaseUid));
            const querySnapshot = await getDocs(q);
            const notifyPromises = querySnapshot.docs.map((docSnap) => {
              const followData = docSnap.data();
              const notifPayload = {
                recipientId: followData.followerId,
                senderId: user.firebaseUid,
                senderName: user.username,
                senderAvatar: user.avatar || '',
                type: 'new_post',
                title: '关注作者发布了新博文',
                body: `您关注的作者「${user.username}」发布了新文章《${title}》`,
                postId: currentPostIdRef.current,
                postTitle: title,
                read: false,
                createdAt: new Date().toISOString(),
              };
              return addDoc(collection(db, 'notifications'), notifPayload);
            });
            await Promise.all(notifyPromises);
          } catch (notifErr) {
            console.error("Failed to push notifications to followers:", notifErr);
          }
        }

      } catch (fError) {
        handleFirestoreError(fError, OperationType.WRITE, `posts/${currentPostIdRef.current}`);
      }

      setSaveStatus('saved');
      alert(isScheduled ? `文章成功定时在 ${new Date(publishAt).toLocaleString()} 发布！` : "文章发布成功！");
      onNavigate('home');
    } catch (err: any) {
      console.error("Failed to publish post:", err);
      alert("发布失败: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Pasting image support inside textarea
  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (!file) continue;

        e.preventDefault(); // Stop default paste action

        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64Url = reader.result as string;
          const placeholder = `\n![正在上传图片...](${base64Url})\n`;
          setContent((prev) => prev + placeholder);

          const cloudName = safeLocalStorage.getItem('CLOUDINARY_CLOUD_NAME') || '';
          const uploadPreset = safeLocalStorage.getItem('CLOUDINARY_UPLOAD_PRESET') || '';

          if (cloudName && uploadPreset) {
            try {
              const formData = new FormData();
              formData.append('file', file);
              formData.append('upload_preset', uploadPreset);

              const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
                method: 'POST',
                body: formData,
              });

              if (response.ok) {
                const data = await response.json();
                if (data.secure_url) {
                  setContent((prev) => prev.replace(placeholder, `\n![粘贴图片](${data.secure_url})\n`));
                  setImages((prev) => [...prev, data.secure_url]);
                }
              }
            } catch (err) {
              console.error("Paste upload failed:", err);
            }
          }
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handleAuxImageAdded = (url: string) => {
    setImages((prev) => [...prev, url]);
  };

  const removeAuxImage = (indexToRemove: number) => {
    setImages((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  // Guard routing access: must be author/owner
  if (!user || (user.role !== 'author' && user.role !== 'owner')) {
    return (
      <div className="max-w-xl mx-auto mt-20 p-8 text-center bg-white rounded-2xl border border-gray-100 animate-fade-in">
        <h3 className="text-lg font-bold text-gray-900 font-display">无权访问</h3>
        <p className="text-gray-500 mt-2 text-sm">写作页仅限作者 (Author) 或管理员 (Owner) 访问。请联系站长开通权限。</p>
        <button
          onClick={() => onNavigate('home')}
          className="mt-6 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-500 transition-colors cursor-pointer"
        >
          返回首页
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 animate-fade-in">
      {/* Header operations */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8 text-left">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('home')}
            className="p-2 rounded-lg bg-white border border-gray-100 text-gray-500 hover:text-gray-700 transition-colors shadow-sm cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-2xl font-bold font-display text-gray-900">创作专栏博文</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              撰写精彩内容，选择最应景的标签，或定时发布给您关注的读者们。
            </p>
          </div>
        </div>

        {/* Sync / Autosave Indicator */}
        <div className="flex items-center gap-3 self-end md:self-auto">
          <span className="text-xs text-gray-500">
            {saveStatus === 'saving' && (
              <span className="flex items-center gap-1.5 text-indigo-600">
                <Loader2 className="h-3 w-3 animate-spin" />
                正在自动备份草稿...
              </span>
            )}
            {saveStatus === 'saved' && (
              <span className="flex items-center gap-1.5 text-emerald-600 font-medium">
                <CheckCircle className="h-3.5 w-3.5" />
                已备份于 {lastSaved || '刚刚'}
              </span>
            )}
            {saveStatus === 'error' && (
              <span className="text-rose-600">云草稿自动备份失败</span>
            )}
            {saveStatus === 'idle' && lastSaved && (
              <span className="text-gray-450">已存草稿</span>
            )}
          </span>

          <button
            type="button"
            onClick={handleManualSave}
            title="手动保存云端草稿"
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 hover:border-gray-350 rounded-lg text-xs font-semibold text-gray-600 bg-white transition-all hover:bg-gray-50 cursor-pointer shadow-2xs"
          >
            <Save className="h-3.5 w-3.5" />
            存草稿
          </button>

          <button
            onClick={handlePublish}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-500 transition-all shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            发布博文
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Editor Main Segment */}
        <div className="lg:col-span-2 space-y-4">
          <input
            type="text"
            required
            placeholder="请输入文章标题..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-lg font-bold font-display text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
          />

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {/* Tabs for Markdown */}
            <div className="flex border-b border-gray-100 bg-gray-50/50 px-2 justify-between items-center">
              <div className="flex">
                <button
                  type="button"
                  onClick={() => setActiveTab('edit')}
                  className={`flex items-center gap-1 px-4 py-2 text-xs font-medium border-b-2 transition-colors cursor-pointer ${activeTab === 'edit' ? 'border-indigo-600 text-indigo-600 bg-white font-bold' : 'border-transparent text-gray-500 hover:text-gray-75'}`}
                >
                  <Edit3 className="h-3 w-3" />
                  编辑正文
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('preview')}
                  className={`flex items-center gap-1 px-4 py-2 text-xs font-medium border-b-2 transition-colors cursor-pointer ${activeTab === 'preview' ? 'border-indigo-600 text-indigo-600 bg-white font-bold' : 'border-transparent text-gray-500 hover:text-gray-75'}`}
                >
                  <Eye className="h-3 w-3" />
                  即时预览
                </button>
              </div>
              <span className="text-[10px] text-gray-400 px-3 cursor-default hidden sm:inline font-semibold">
                支持直接拖拽、粘贴截图排版
              </span>
            </div>

            {activeTab === 'edit' ? (
              <textarea
                value={content}
                onPaste={handlePaste}
                onChange={(e) => setContent(e.target.value)}
                placeholder="撰写你的故事、想法、同人设定或见解... 支持标准 Markdown 与直接粘贴外部图片！"
                className="allow-paste w-full min-h-[420px] border-none p-4 text-sm font-sans text-gray-700 resize-y focus:outline-none focus:ring-0 placeholder-gray-400 leading-relaxed"
              />
            ) : (
              <div className="p-6 prose max-w-none text-gray-800 min-h-[420px] bg-white overflow-y-auto text-left">
                {content.trim() ? (
                  <div className="markdown-body">
                    <div className="whitespace-pre-wrap leading-relaxed select-text font-serif text-sm">
                      {content}
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-400 text-xs italic">这里还没有内容，快在编辑标签中写几句吧！</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Tags Panel */}
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-gray-950 uppercase tracking-wider font-display flex items-center gap-1.5">
              <Tag className="h-4 w-4 text-indigo-500" />
              文章分类标签
            </h3>
            {selectedTags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {selectedTags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-100/60 animate-in fade-in zoom-in-95 duration-100"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className="p-0.5 hover:bg-indigo-100 text-indigo-500 hover:text-indigo-800 rounded-md transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-[11px] italic">点击下方按钮添加文章分类标签，最多 5 个</p>
            )}

            <button
              type="button"
              onClick={() => setShowTagModal(true)}
              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-gray-50 hover:bg-gray-100 text-gray-600 hover:text-gray-850 rounded-xl text-xs font-bold transition-all border border-gray-200/60 cursor-pointer shadow-3xs"
            >
              <Plus className="h-3.5 w-3.5 text-indigo-500" />
              选择分类标签
            </button>
          </div>

          {/* Author Signing and High-level Permissions Panel */}
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-gray-950 uppercase tracking-wider font-display flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-indigo-500" />
              高级发布与文章管理
            </h3>
            
            {/* Author Level Badge */}
            <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-between">
              <span className="text-[11px] font-bold text-gray-500">当前创作者签约等级:</span>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                user?.level === 'vip' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                user?.level === 'signed' ? 'bg-indigo-100 text-indigo-800 border border-indigo-200' :
                'bg-gray-100 text-gray-700'
              }`}>
                {user?.level === 'vip' ? '👑 特邀作家' :
                 user?.level === 'signed' ? '✒️ 签约作家' :
                 '📖 普通作者'}
              </span>
            </div>

            {/* Scheduled Publish Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-gray-700">定时发布时间</label>
                {(user?.level !== 'signed' && user?.level !== 'vip') && (
                  <span className="text-[9px] text-indigo-600 bg-indigo-50 font-semibold px-1.5 py-0.5 rounded">🔒 签约专属</span>
                )}
              </div>
              <input
                type="datetime-local"
                disabled={user?.level !== 'signed' && user?.level !== 'vip'}
                value={publishAt}
                onChange={(e) => setPublishAt(e.target.value)}
                className="block w-full rounded-xl border border-gray-200 p-2.5 text-xs text-gray-850 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 font-medium font-mono disabled:opacity-55 disabled:bg-gray-50/50"
              />
              {publishAt && (user?.level === 'signed' || user?.level === 'vip') && (
                <div className="flex items-center justify-between text-[10px] text-gray-450 pt-1">
                  <span>预计：{new Date(publishAt).toLocaleString()}</span>
                  <button
                    type="button"
                    onClick={() => setPublishAt('')}
                    className="text-rose-600 hover:underline font-bold"
                  >
                    重置为立即发布
                  </button>
                </div>
              )}
            </div>

            {/* Pinned to Top Section */}
            <div className="border-t border-gray-100 pt-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-gray-700">作品置顶选项</label>
                {user?.level !== 'vip' && (
                  <span className="text-[9px] text-amber-600 bg-amber-50 font-semibold px-1.5 py-0.5 rounded">🔒 特邀专属</span>
                )}
              </div>
              
              <label className="flex items-center gap-2 p-2.5 rounded-xl border border-gray-150/80 hover:bg-gray-50/30 transition-all cursor-pointer">
                <input
                  type="checkbox"
                  disabled={user?.level !== 'vip'}
                  checked={isPinned}
                  onChange={(e) => setIsPinned(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4 border-gray-300 disabled:opacity-50"
                />
                <div className="text-left">
                  <span className="block text-xs font-bold text-gray-800">在您的个人主页置顶显示</span>
                  <span className="block text-[9px] text-gray-400">将本作品永久固定在您的主页作品列表顶端。</span>
                </div>
              </label>
            </div>
          </div>

          {/* Series / Serialization Setup Panel */}
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-gray-950 uppercase tracking-wider font-display flex items-center gap-1.5">
              <BookOpen className="h-4 w-4 text-indigo-500" />
              系列与连载设定
            </h3>
            <p className="text-[11px] text-gray-400 leading-normal">
              可以将此文归属于您创建的特定小说系列中（如《星落》），以支持上一章/下一章导航和系列目录展示。
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">选择隶属系列</label>
                <select
                  value={seriesId}
                  onChange={(e) => {
                    const selId = e.target.value;
                    setSeriesId(selId);
                    if (selId === '') {
                      setSeriesTitle('');
                    } else {
                      const found = authorSeries.find(s => s.id === selId);
                      setSeriesTitle(found ? found.title : '');
                    }
                  }}
                  className="block w-full rounded-xl border border-gray-200 p-2.5 text-xs text-gray-805 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 font-medium"
                >
                  <option value="">-- 不关联系列 (独立作品) --</option>
                  {authorSeries.map((s) => (
                    <option key={s.id} value={s.id}>《{s.title}》</option>
                  ))}
                </select>
              </div>

              {seriesId && (
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">章节排序序号 (如第 1 篇、第 2 篇)</label>
                  <input
                    type="number"
                    min="1"
                    value={seriesOrder}
                    onChange={(e) => setSeriesOrder(Math.max(1, Number(e.target.value) || 1))}
                    className="block w-full rounded-xl border border-gray-200 p-2.5 text-xs text-gray-850 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 font-medium font-mono"
                  />
                  <p className="text-[9px] text-gray-400 mt-1">
                    系统将根据该数字从小到大排列连载文章并生成导航。
                  </p>
                </div>
              )}

              {/* Create New Series Action */}
              {!isCreatingNewSeries ? (
                <button
                  type="button"
                  onClick={() => setIsCreatingNewSeries(true)}
                  className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-gray-50 hover:bg-gray-100 text-gray-600 hover:text-gray-850 rounded-xl text-xs font-bold transition-all border border-gray-200/60 cursor-pointer shadow-3xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  新建小说/文章系列
                </button>
              ) : (
                <div className="bg-gray-50/50 p-4.5 rounded-xl border border-gray-200/60 space-y-3 animate-in fade-in zoom-in-95 duration-150">
                  <h4 className="text-[11px] font-bold text-gray-800 flex items-center justify-between">
                    <span>新建系列专栏</span>
                    <button
                      type="button"
                      onClick={() => setIsCreatingNewSeries(false)}
                      className="text-gray-400 hover:text-gray-600 font-bold"
                    >
                      取消
                    </button>
                  </h4>
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="系列名称 (如：星落)"
                      value={newSeriesTitle}
                      onChange={(e) => setNewSeriesTitle(e.target.value)}
                      className="block w-full rounded-lg border border-gray-200 p-2 text-xs text-gray-850 bg-white focus:outline-none"
                    />
                    <textarea
                      placeholder="系列简介，简要介绍这一连载故事..."
                      value={newSeriesDesc}
                      onChange={(e) => setNewSeriesDesc(e.target.value)}
                      className="block w-full rounded-lg border border-gray-200 p-2 text-xs text-gray-850 bg-white focus:outline-none h-16 resize-none"
                    />
                    <button
                      type="button"
                      disabled={creatingSeriesLoading}
                      onClick={async () => {
                        if (!newSeriesTitle.trim()) {
                          alert("请输入系列名称");
                          return;
                        }
                        setCreatingSeriesLoading(true);
                        try {
                          const newRef = doc(collection(db, 'series'));
                          await setDoc(newRef, {
                            id: newRef.id,
                            title: newSeriesTitle.trim(),
                            description: newSeriesDesc.trim(),
                            authorId: user.firebaseUid,
                            authorName: user.username,
                            createdAt: new Date().toISOString()
                          });
                          
                          // Refresh series
                          const q = query(collection(db, 'series'), where('authorId', '==', user.firebaseUid));
                          const snap = await getDocs(q);
                          const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                          setAuthorSeries(list);
                          
                          // Select the newly created series
                          setSeriesId(newRef.id);
                          setSeriesTitle(newSeriesTitle.trim());
                          
                          // Clear state
                          setNewSeriesTitle('');
                          setNewSeriesDesc('');
                          setIsCreatingNewSeries(false);
                        } catch (err) {
                          console.error("Failed to create series:", err);
                          alert("创建系列失败，请检查数据库权限或重试");
                        } finally {
                          setCreatingSeriesLoading(false);
                        }
                      }}
                      className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50 cursor-pointer shadow-3xs"
                    >
                      {creatingSeriesLoading ? "正在创建..." : "确认创建系列"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar Image Upload Area */}
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-gray-950 uppercase tracking-wider font-display flex items-center gap-1.5">
              <ImageIcon className="h-4 w-4 text-indigo-500" />
              文章配图 & 封面管理 ({images.length})
            </h3>
            <p className="text-[11px] text-gray-400">
              您可以拖拽/粘贴/上传最多多张高清配图。默认第一张会自动作为封面卡片的背景噢。
            </p>

            <ImageUploader
              label="添加高清配图"
              onUploadSuccess={handleAuxImageAdded}
              enableCrop={false}
            />

            {images.length > 0 && (
              <div className="border-t border-gray-100 pt-3 space-y-3">
                <h4 className="text-[11px] font-bold text-gray-800 uppercase tracking-wider font-display flex items-center gap-1.5">
                  <Crop className="h-3.5 w-3.5 text-indigo-500" />
                  自主裁剪/更换列表封面
                </h4>

                <div className="bg-gray-50/75 p-3 rounded-xl border border-gray-100 flex flex-col items-center gap-2.5">
                  <div className="relative aspect-video w-full max-w-[180px] rounded-lg overflow-hidden border border-gray-200 bg-white">
                    <img 
                      src={coverImage || images[0]} 
                      alt="Current Cover" 
                      className="w-full h-full object-cover" 
                    />
                    <div className="absolute top-1 left-1 bg-indigo-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-xs">
                      选定封面
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full justify-center">
                    <button
                      type="button"
                      onClick={() => setCroppingCoverUrl(coverImage || images[0])}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-bold shadow-xs transition-colors cursor-pointer"
                    >
                      <Crop className="h-3 w-3" />
                      自由裁切
                    </button>
                    {coverImage && (
                      <button
                        type="button"
                        onClick={() => setCoverImage('')}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-gray-200 hover:border-gray-300 text-gray-650 bg-white rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                      >
                        <RotateCcw className="h-3 w-3" />
                        重置原始
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-1 pt-1">
                  <span className="text-[10px] font-bold text-gray-500 block">点击缩略图选择展示封面：</span>
                  <div className="grid grid-cols-4 gap-1.5">
                    {images.map((img, idx) => {
                      const isSelected = (coverImage === img || (!coverImage && idx === 0));
                      return (
                        <div key={idx} className="relative aspect-square rounded-md overflow-hidden border group">
                          <button
                            type="button"
                            onClick={() => {
                              setCoverImage(img);
                            }}
                            className={`w-full h-full p-0 border-0 outline-none transition-all ${
                              isSelected 
                                ? 'ring-2 ring-indigo-600 opacity-100' 
                                : 'opacity-60 hover:opacity-100'
                            }`}
                          >
                            <img src={img} alt={`Img ${idx}`} className="w-full h-full object-cover" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeAuxImage(idx)}
                            className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-red-650 hover:bg-red-700 text-white opacity-0 group-hover:opacity-100 transition-opacity outline-none text-[8px]"
                            title="从文章中移除此图片"
                          >
                            X
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* R18 Content Rating Panel */}
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-gray-950 uppercase tracking-wider font-display flex items-center gap-1.5">
              <ShieldAlert className="h-4 w-4 text-rose-500 shrink-0" />
              受众分级过滤设置
            </h3>
            <p className="text-[11px] text-gray-400 leading-normal">
              为营造健康自主的安全环境，若文章包含任何成人（18+）、极端虐心等特定情节，请务必标记为 R18 级。
            </p>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setIsR18(false)}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                  !isR18 
                    ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-2xs font-bold' 
                    : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                }`}
              >
                全年龄 (All Ages)
              </button>
              <button
                type="button"
                onClick={() => setIsR18(true)}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                  isR18 
                    ? 'bg-rose-50 border-rose-200 text-rose-700 shadow-2xs font-bold' 
                    : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                }`}
              >
                R18 (限制级)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Cropper Modal for Custom Cover adjustment */}
      {croppingCoverUrl && (
        <ImageCropper
          imageSrc={croppingCoverUrl}
          onCropComplete={(croppedBase64) => {
            setCoverImage(croppedBase64);
            setCroppingCoverUrl(null);
          }}
          onCancel={() => {
            setCroppingCoverUrl(null);
          }}
        />
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
                  <h3 className="text-base font-bold text-gray-900 font-display">选择文章标签分类</h3>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  选择贴切的标签能够显著提升读者浏览与精准推荐效率。请从以下分类中选择 <span className="font-bold text-indigo-600">3-5 个标签</span>。
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowTagModal(false)}
                className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
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
                  placeholder="搜索标签（例如：师徒、微肉、古代、甜...）"
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
                          onClick={() => toggleTag(tag)}
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
                              onClick={() => toggleTag(tag)}
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
                  <span className="text-xs text-gray-500 font-semibold">当前已选择:</span>
                  <span className={`text-xs font-bold ${
                    selectedTags.length >= 3 && selectedTags.length <= 5 ? 'text-emerald-600' : 'text-rose-500'
                  }`}>
                    {selectedTags.length} 个标签 {selectedTags.length < 3 && '(最少 3 个)'} {selectedTags.length > 5 && '(最多 5 个)'}
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
                    <span className="text-[10px] text-gray-400 italic">未选择任何标签</span>
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
                  清空已选
                </button>
                <button
                  type="button"
                  onClick={() => setShowTagModal(false)}
                  className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    selectedTags.length >= 3 && selectedTags.length <= 5
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'
                      : 'bg-indigo-600/50 text-white/95 hover:bg-indigo-600'
                  }`}
                >
                  确认并应用 ({selectedTags.length}个)
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
