import React, { useState, useEffect, useRef } from 'react';
import { collection, doc, setDoc, getDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import ImageUploader from './ImageUploader';
import { AppUser } from '../types';
import { Image as ImageIcon, Save, CheckCircle, FileText, ArrowLeft, Loader2, Play, Eye, Edit3 } from 'lucide-react';

interface WriteProps {
  user: AppUser | null;
  draftId?: string | null;
  onNavigate: (route: string) => void;
}

export default function Write({ user, draftId, onNavigate }: WriteProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [status, setStatus] = useState<'draft' | 'published'>('draft');
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');

  const currentPostIdRef = useRef<string>(draftId || doc(collection(db, 'posts')).id);

  // Load existing article draft or post if editing
  useEffect(() => {
    if (draftId) {
      const loadPost = async () => {
        try {
          const postRef = doc(db, 'posts', draftId);
          const postSnap = await getDoc(postRef);
          if (postSnap.exists()) {
            const data = postSnap.data();
            setTitle(data.title || '');
            setContent(data.content || '');
            setImages(data.images || []);
            setStatus(data.status || 'draft');
            currentPostIdRef.current = draftId;
          }
        } catch (err) {
          console.error("Failed to load article draft:", err);
        }
      };
      loadPost();
    }
  }, [draftId]);

  // Autosave timer: every 30 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      if (title.trim() || content.trim()) {
        autoSaveDraft();
      }
    }, 30000);

    return () => clearInterval(timer);
  }, [title, content, images]);

  const autoSaveDraft = async () => {
    if (!user) return;
    setSaveStatus('saving');
    try {
      const postRef = doc(db, 'posts', currentPostIdRef.current);
      const now = new Date().toISOString();
      const payload = {
        id: currentPostIdRef.current,
        title: title || '未命名草稿',
        content: content || '',
        authorId: user.firebaseUid,
        authorName: user.username,
        images: images,
        likes: 0,
        likers: [],
        status: 'draft' as const,
        createdAt: now,
        updatedAt: now,
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

    setIsSaving(true);
    try {
      const postRef = doc(db, 'posts', currentPostIdRef.current);
      const now = new Date().toISOString();
      
      // Load current document to keep total likes or keep it secure
      let likes = 0;
      let likers: string[] = [];
      try {
        const snap = await getDoc(postRef);
        if (snap.exists()) {
          likes = snap.data().likes || 0;
          likers = snap.data().likers || [];
        }
      } catch (_) {}

      const payload = {
        id: currentPostIdRef.current,
        title,
        content,
        authorId: user.firebaseUid,
        authorName: user.username,
        images,
        likes,
        likers,
        status: 'published' as const,
        createdAt: now,
        updatedAt: now,
      };

      try {
        await setDoc(postRef, payload);
      } catch (fError) {
        handleFirestoreError(fError, OperationType.WRITE, `posts/${currentPostIdRef.current}`);
      }

      setSaveStatus('saved');
      alert("文章发布成功！");
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

        // Start local reader or direct setup to upload it in the background
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64Url = reader.result as string;
          // Put direct upload placeholder
          const placeholder = `\n![正在上传图片...](${base64Url})\n`;
          setContent((prev) => prev + placeholder);

          // Find Cloudinary configs
          const cloudName = localStorage.getItem('CLOUDINARY_CLOUD_NAME') || '';
          const uploadPreset = localStorage.getItem('CLOUDINARY_UPLOAD_PRESET') || '';

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
                  // Replace placeholder with secure Cloudinary URL
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

  // Guard routing access: must be author/owner
  if (!user || (user.role !== 'author' && user.role !== 'owner')) {
    return (
      <div className="max-w-xl mx-auto mt-20 p-8 text-center bg-white rounded-2xl border border-gray-100">
        <h3 className="text-lg font-bold text-gray-900 font-display">无权访问</h3>
        <p className="text-gray-500 mt-2 text-sm">写作页仅限作者 (Author) 或管理员 (Owner) 访问。请联系站长开通权限。</p>
        <button
          onClick={() => onNavigate('home')}
          className="mt-6 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-500 transition-colors"
        >
          返回首页
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header operations */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('home')}
            className="p-2 rounded-lg bg-white border border-gray-100 text-gray-500 hover:text-gray-700 transition-colors shadow-sm"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-2xl font-bold font-display text-gray-900">创作文章</h1>
            <p className="text-sm text-gray-500">
              撰写精彩内容，分享深刻见解。支持 Markdown 语法与图片粘贴。
            </p>
          </div>
        </div>

        {/* Sync / Autosave Indicator */}
        <div className="flex items-center gap-3 self-end md:self-auto">
          <span className="text-xs text-gray-500">
            {saveStatus === 'saving' && (
              <span className="flex items-center gap-1.5 text-indigo-600">
                <Loader2 className="h-3 w-3 animate-spin" />
                正在保存草稿...
              </span>
            )}
            {saveStatus === 'saved' && (
              <span className="flex items-center gap-1.5 text-emerald-600 font-medium">
                <CheckCircle className="h-3.5 w-3.5" />
                保存于 {lastSaved || '刚刚'}
              </span>
            )}
            {saveStatus === 'error' && (
              <span className="text-rose-600">草稿保存失败</span>
            )}
            {saveStatus === 'idle' && lastSaved && (
              <span className="text-gray-400">草稿已存</span>
            )}
          </span>

          <button
            type="button"
            onClick={handleManualSave}
            title="手动保存草稿"
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 hover:border-gray-300 rounded-lg text-xs font-semibold text-gray-600 bg-white transition-all hover:bg-gray-50"
          >
            <Save className="h-3.5 w-3.5" />
            存草稿
          </button>

          <button
            onClick={handlePublish}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-500 transition-all shadow-sm active:scale-95 disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            发布文章
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Editor Main Segment */}
        <div className="lg:col-span-2 space-y-4">
          <input
            type="text"
            required
            placeholder="文章标题..."
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
                  className={`flex items-center gap-1 px-4 py-2 text-xs font-medium border-b-2 transition-colors ${activeTab === 'edit' ? 'border-indigo-600 text-indigo-600 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                  <Edit3 className="h-3 w-3" />
                  编辑
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('preview')}
                  className={`flex items-center gap-1 px-4 py-2 text-xs font-medium border-b-2 transition-colors ${activeTab === 'preview' ? 'border-indigo-600 text-indigo-600 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                  <Eye className="h-3 w-3" />
                  预览
                </button>
              </div>
              <span className="text-[10px] text-gray-400 px-3 cursor-default hidden sm:inline">
                支持拖拽或粘贴图片
              </span>
            </div>

            {activeTab === 'edit' ? (
              <textarea
                value={content}
                onPaste={handlePaste}
                onChange={(e) => setContent(e.target.value)}
                placeholder="撰写你的故事、想法、见解... 点击上方预览可渲染 markdown！"
                className="w-full min-h-[400px] border-none p-4 text-sm font-sans text-gray-700 resize-y focus:outline-none focus:ring-0 placeholder-gray-400 leading-relaxed"
              />
            ) : (
              <div className="p-6 prose max-w-none text-gray-800 min-h-[400px] bg-white overflow-y-auto">
                {content.trim() ? (
                  <div className="markdown-body">
                    {/* Render with very clean elements */}
                    <div className="markdown-body">
                      {/* Simple direct renderer snippet or standard ReactMarkdown */}
                      <div className="whitespace-pre-wrap leading-relaxed select-text font-serif">
                        {content}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm italic">这里什么都还没有噢...</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Image Upload Area */}
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-gray-900 font-display flex items-center gap-1.5">
              <ImageIcon className="h-4 w-4 text-gray-500" />
              文章配图列表 ({images.length})
            </h3>
            <p className="text-xs text-gray-400">
              这里上传的图片可以用作文章封面。同时，在左侧编辑框粘贴或拖入图片也能直接插入文章。
            </p>

            <ImageUploader
              label="添加附属封面图"
              onUploadSuccess={handleAuxImageAdded}
            />

            {images.length > 0 && (
              <div className="grid grid-cols-2 gap-2 pt-2">
                {images.map((img, idx) => (
                  <div key={idx} className="group relative aspect-video rounded-lg overflow-hidden border border-gray-100">
                    <img src={img} alt="Post Attachment" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeAuxImage(idx)}
                      className="absolute top-1 right-1 p-1 rounded-full bg-red-600/80 hover:bg-red-600 text-white opacity-0 group-hover:opacity-100 transition-opacity outline-none text-[10px]"
                    >
                      删除
                    </button>
                    <span className="absolute bottom-1 left-1 bg-black/50 text-white text-[9px] px-1 py-0.5 rounded">
                      封面图 {idx + 1}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200/50">
            <h4 className="text-xs font-semibold text-gray-700 font-display mb-1.5">💡 小窍门 (Markdown 支持)</h4>
            <ul className="text-[11px] text-gray-500 space-y-1 list-disc list-inside leading-relaxed">
              <li>使用 <code className="bg-gray-100 px-1 rounded text-red-500"># 标题</code> 增加主标题</li>
              <li>使用 <code className="bg-gray-100 px-1 rounded text-red-500">## 标题</code> 增加二级标题</li>
              <li>使用 <code className="bg-gray-100 px-1 rounded text-red-500">**加粗**</code> 将字形加粗</li>
              <li>在左侧直接 <kbd className="bg-gray-100 px-1 rounded font-mono shadow-sm">Ctrl+V</kbd> 粘贴外部截图，即可快速上传与排版噢！</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
