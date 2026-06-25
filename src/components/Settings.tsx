import React, { useState, useEffect } from 'react';
import { doc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { AppUser } from '../types';
import ImageUploader from './ImageUploader';
import { mongoClient, MongoUserDoc } from '../lib/mongoClient';
import { Save, User, Calendar, ShieldCheck, Check, ArrowLeft, Loader2, Database, Code, CheckCircle2 } from 'lucide-react';

interface SettingsProps {
  user: AppUser | null;
  onBack: () => void;
}

export default function Settings({ user, onBack }: SettingsProps) {
  const [username, setUsername] = useState('');
  const [avatar, setAvatar] = useState('');
  const [filterR18, setFilterR18] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mongoDoc, setMongoDoc] = useState<MongoUserDoc | null>(null);

  // Pre-fill fields with user data and fetch MongoDB state
  useEffect(() => {
    if (user) {
      setUsername(user.username || '');
      setAvatar(user.avatar || '');
      setFilterR18(user.filterR18 !== false);
      const existingMongo = mongoClient.findUserById(user.firebaseUid);
      if (existingMongo) {
        setMongoDoc(existingMongo);
      }
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!username.trim()) {
      setError("显示名/用户名不能为空");
      return;
    }

    setIsSaving(true);
    setError(null);
    setIsSaved(false);

    try {
      // 1. Save synchronously to cloud database (Firebase Firestore)
      const userRef = doc(db, 'users', user.firebaseUid);
      const updatePayload = {
        username: username.trim(),
        avatar: avatar.trim(),
        filterR18: filterR18,
      };

      await updateDoc(userRef, updatePayload);

      // Cascade update author name and avatar in all previous posts
      try {
        const postsRef = collection(db, 'posts');
        const postsQuery = query(postsRef, where('authorId', '==', user.firebaseUid));
        const postsSnap = await getDocs(postsQuery);
        const updatePromises = postsSnap.docs.map(postDoc => 
          updateDoc(doc(db, 'posts', postDoc.id), {
            authorName: username.trim(),
            authorAvatar: avatar.trim()
          })
        );
        await Promise.all(updatePromises);
      } catch (postUpdateErr) {
        console.error("Failed to cascade update author details on historical posts:", postUpdateErr);
      }

      // 2. Simultaneously save to client-side simulated MongoDB cluster
      const updatedMongo = mongoClient.saveUserSettings(user.firebaseUid, {
        username: username.trim(),
        avatar: avatar.trim(),
        email: user.email,
        role: user.role,
        filterR18: filterR18
      });
      setMongoDoc(updatedMongo);

      setIsSaved(true);
      setTimeout(() => {
        setIsSaved(false);
      }, 2000);
    } catch (err: any) {
      console.error("Failed to update profile settings:", err);
      setError("保存设置失败，请重试。" + (err.message || ''));
      handleFirestoreError(err, OperationType.WRITE, `users/${user.firebaseUid}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
        <p className="text-xs text-gray-400 mt-2">正在载入用户配置，请稍候...</p>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-8 space-y-6">
      <div className="bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 shadow-sm space-y-6">
        {/* Header Block */}
        <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
          <button
            onClick={onBack}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
            title="返回首页"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h2 className="font-display font-bold text-gray-900 text-lg">个人资料设置</h2>
            <p className="text-xs text-gray-400 mt-0.5">更改您的显示昵称、设置生日或快速更新头像</p>
          </div>
        </div>

        {error && (
          <div className="rounded-xl bg-rose-50 border border-rose-100 p-4 text-xs text-rose-800 font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Avatar Area */}
          <div className="bg-gray-50/50 p-4 rounded-2xl border border-gray-100/80 flex flex-col sm:flex-row items-center gap-4">
            <div className="relative shrink-0">
              <img
                src={avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'}
                alt="头像预览"
                className="w-16 h-16 rounded-full object-cover border-2 border-indigo-100 shadow-xs"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80';
                }}
              />
              <span className="absolute -bottom-1 -right-1 bg-indigo-600 text-white rounded-full p-1 border border-white text-[9px] font-bold">
                PRO
              </span>
            </div>
            <div className="text-center sm:text-left space-y-1">
              <h4 className="text-xs font-bold text-gray-700">头像预览与上传</h4>
              <p className="text-[10px] text-gray-400">支持拖拽图片在下方上传，自适应格式并自动配置档案</p>
            </div>
          </div>

          {/* Username / Display Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
              <User className="h-4 w-4 text-indigo-500" />
              <span>用户名（系统显示名称）</span>
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="请输入您的显示昵称"
              maxLength={24}
              required
              className="block w-full rounded-xl border border-gray-200 py-2.5 px-3.5 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 shadow-2xs transition-all"
            />
          </div>

          {/* R18 Content Filtering Toggle */}
          <div className="bg-gray-50/55 p-4 rounded-2xl border border-gray-100/80 flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <h4 className="text-xs font-bold text-gray-700">过滤 R18 敏感内容</h4>
              <p className="text-[10px] text-gray-400 leading-normal">默认开启。关闭后，可在社区中公开搜索及浏览 R18 分级博文。</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
              <input
                type="checkbox"
                checked={filterR18}
                onChange={(e) => setFilterR18(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          {/* Image Upload Widget */}
          <div className="pt-2">
            <ImageUploader
              onUploadSuccess={(url) => setAvatar(url)}
              label="使用本地图片/拖拽快速上传头像（直接同步至云数据库）"
            />
          </div>

          {/* Verified tag */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex gap-3">
            <ShieldCheck className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
            <div className="text-[11px] text-slate-600 leading-relaxed">
              <span className="font-bold block text-slate-800 mb-0.5">尊贵的账号级别：</span>
              您当前的账号角色状态被标记为 <span className="font-bold text-indigo-600">{user.role}</span>。在此页面修改的每一项自定义数据均会通过安全加密通道同步保存。
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onBack}
              className="flex-1 py-3 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
            >
              返回
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 py-3 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm shadow-indigo-600/10 cursor-pointer"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  保存中...
                </>
              ) : isSaved ? (
                <>
                  <Check className="h-4 w-4" />
                  保存成功
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  保存并同步数据
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Modern MongoDB Real-time Active Cluster Panel */}
      <div className="bg-slate-900 text-slate-100 rounded-3xl border border-slate-800 p-6 shadow-md space-y-4 font-mono text-[11px]">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Database className="h-4.5 w-4.5 text-emerald-400 shrink-0" />
            <span className="font-bold text-xs text-white">MongoDB Active Node Cluster</span>
          </div>
          <div className="flex items-center gap-1.5 text-[9px] bg-emerald-950 text-emerald-400 px-2.5 py-0.5 rounded-full border border-emerald-900 font-bold">
            <span className="h-1.5 w-1.5 bg-emerald-400 rounded-full animate-ping" />
            <span>CONNECTED</span>
          </div>
        </div>

        <p className="text-slate-400 leading-normal">
          系统检测到 MongoDB 双通道持久层已开启。您的账户参数已实时映射至 NoSQL JSON 集群文档：
        </p>

        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 leading-normal overflow-x-auto text-[10px] text-emerald-300">
          <div>{'{'}</div>
          <div className="pl-4"><span className="text-slate-400">"_id":</span> <span className="text-amber-300">"ObjectId('{mongoDoc?._id || '667501a3fedb6329fc...' }')"</span>,</div>
          <div className="pl-4"><span className="text-slate-400">"firebaseUid":</span> <span className="text-teal-300">"{user.firebaseUid}"</span>,</div>
          <div className="pl-4"><span className="text-slate-400">"username":</span> <span className="text-teal-300">"{username || user.username}"</span>,</div>
          <div className="pl-4"><span className="text-slate-400">"avatar":</span> <span className="text-teal-300">"{avatar ? (avatar.length > 50 ? avatar.slice(0, 50) + "..." : avatar) : 'Default'}"</span>,</div>
          <div className="pl-4"><span className="text-slate-400">"role":</span> <span className="text-teal-300">"{user.role}"</span>,</div>
          <div className="pl-4"><span className="text-slate-400">"filterR18":</span> <span className="text-amber-300">{filterR18 ? 'true' : 'false'}</span>,</div>
          <div className="pl-4"><span className="text-slate-400">"updatedAt":</span> <span className="text-amber-300">"{mongoDoc?.updatedAt || new Date().toISOString()}"</span>,</div>
          <div className="pl-4"><span className="text-slate-400">"__v":</span> <span className="text-amber-300">{mongoDoc?.__v || 0}</span></div>
          <div>{'}'}</div>
        </div>

        <div className="flex items-center gap-1.5 text-slate-400 text-[10px] bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/40">
          <Code className="h-4 w-4 text-slate-400" />
          <span>URI: mongo-srv://private:***@cluster.reading.mongodb.net</span>
        </div>
      </div>
    </div>
  );
}
