import React, { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { AppUser } from '../types';
import ImageUploader from './ImageUploader';
import { 
  BookOpen, 
  User, 
  Compass, 
  Sparkles, 
  ShieldCheck, 
  ArrowRight, 
  ArrowLeft, 
  Loader2, 
  CheckCircle,
  Smile,
  Calendar
} from 'lucide-react';
import { mongoClient } from '../lib/mongoClient';

interface OnboardingProps {
  user: AppUser;
  onComplete: () => void;
}

// Predefined modern, high-quality, eye-safe unsplash avatar presets
const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80', // Editorial Portrait Female
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80', // Editorial Portrait Male
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80', // Creative Pink Soft
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=150&q=80', // Creative Clean Blue
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80'  // Clean Tech Corporate
];

export default function Onboarding({ user, onComplete }: OnboardingProps) {
  const [step, setStep] = useState(1);
  const totalSteps = 3;

  // Profile Form States initialized with existing firebase SSO details if available
  const [username, setUsername] = useState(user.username || '');
  const [birthday, setBirthday] = useState(user.birthday || '');
  const [avatar, setAvatar] = useState(user.avatar || '');
  const [hasUploadedAvatar, setHasUploadedAvatar] = useState(() => {
    if (user.avatar && !user.avatar.includes('unsplash.com/photo-1534528741775-53994a69daeb')) {
      return true;
    }
    return false;
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleNext = () => {
    if (step < totalSteps) {
      setStep(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (step > 1) {
      setStep(prev => prev - 1);
    }
  };

  const handleSubmit = async () => {
    if (!username.trim()) {
      setError("请填写一个您中意的用户名/显示昵称（必填）");
      return;
    }
    if (!avatar || !hasUploadedAvatar) {
      setError("请通过下方的上传器裁剪并上传您的个性化头像（必须）");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Sync profile updates directly to FireStore
      const userRef = doc(db, 'users', user.firebaseUid);
      const updatePayload = {
        username: username.trim(),
        birthday: birthday || '',
        avatar: avatar,
        onboarded: true, // Mark user as fully onboarded
      };

      await updateDoc(userRef, updatePayload);

      // 2. Refresh local client-simulated MongoDB cluster as well to ensure parity
      try {
        mongoClient.saveUserSettings(user.firebaseUid, {
          username: username.trim(),
          birthday: birthday,
          avatar: avatar,
          email: user.email,
          role: user.role
        });
      } catch (mongoErr) {
        console.warn("Client-side simulation Mongo sync bypassed:", mongoErr);
      }

      // 3. Complete onboarding
      onComplete();
    } catch (err: any) {
      console.error("Failed to complete onboarding profile setup:", err);
      setError("保存您的首选配置失败，请检校后重试：" + (err.message || String(err)));
      handleFirestoreError(err, OperationType.WRITE, `users/${user.firebaseUid}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4 py-12" id="onboarding-flow-container">
      <div className="bg-white rounded-3xl max-w-2xl w-full border border-gray-100 p-6 sm:p-10 shadow-xl space-y-8 relative overflow-hidden">
        
        {/* Subtle decorative background glow */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-indigo-50/40 to-transparent rounded-full blur-2xl -z-10 pointer-events-none" />
        
        {/* Top Progress & Stepper Bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 bg-gray-50 px-3.5 py-1.5 rounded-full border border-gray-100">
            <span className="text-[10px] font-bold text-indigo-600 font-mono">STEP 0{step}</span>
            <span className="text-[9px] font-bold text-gray-400">/ 03</span>
          </div>
          
          <div className="flex gap-1.5">
            {[1, 2, 3].map((s) => (
              <div 
                key={s} 
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  s === step 
                    ? 'w-8 bg-indigo-600' 
                    : s < step 
                      ? 'w-4 bg-indigo-200' 
                      : 'w-2 bg-gray-200'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Step Contents */}
        {step === 1 && (
          <div className="space-y-6 animate-fade-in" id="onboarding-step-1">
            <div className="space-y-2">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 shadow-2xs">
                <BookOpen className="h-5.5 w-5.5" />
              </div>
              <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight font-display">
                欢迎加入「私密阅读」专栏
              </h2>
              <p className="text-xs text-gray-500 font-medium font-sans">
                这是一个专注提供全能排版、纯净阅读、及随笔发表的个人数字图书馆。
              </p>
            </div>

            <div className="space-y-4 pt-2">
              <div className="flex gap-3.5 p-4 bg-gray-50/50 rounded-2xl border border-gray-100/50">
                <span className="text-lg">🎯</span>
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-gray-800">100% 纯净无广告生态</h4>
                  <p className="text-[11px] leading-relaxed text-gray-400">
                    不含任何干扰小组件、不追踪不健康的Cookies，只为您精选排版卓越、带有纯粹文学与科技思考的心得。
                  </p>
                </div>
              </div>

              <div className="flex gap-3.5 p-4 bg-gray-50/50 rounded-2xl border border-gray-100/50">
                <span className="text-lg">🛡️</span>
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-gray-800">本地双模融合数据库</h4>
                  <p className="text-[11px] leading-relaxed text-gray-400">
                    整合了 Cloud Firestore 的高可靠性云服务与本地模拟沙盒双层备份。离线或网速恶劣下，仍支持无损缓存及自动本地排序。
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 animate-fade-in" id="onboarding-step-2">
            <div className="space-y-2">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 shadow-2xs">
                <Compass className="h-5.5 w-5.5" />
              </div>
              <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight font-display">
                快速了解核心模块的使用
              </h2>
              <p className="text-xs text-gray-500 font-medium font-sans">
                只需三秒，掌握如何在这片净土里开始阅读与创作：
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="p-4 border border-zinc-100 rounded-2xl text-center space-y-2 flex flex-col justify-between">
                <div>
                  <span className="text-xl block mb-1">📖</span>
                  <h4 className="text-xs font-bold text-gray-900">探索专栏推荐</h4>
                  <p className="text-[10px] text-gray-400 leading-normal mt-1">
                    在首页点击任何发表作品即可进入沉浸式 Markdown 阅读模式。
                  </p>
                </div>
                <span className="text-[9px] font-bold text-indigo-500 bg-indigo-50 py-1 rounded-lg block font-mono">
                  Browse
                </span>
              </div>

              <div className="p-4 border border-zinc-100 rounded-2xl text-center space-y-2 flex flex-col justify-between">
                <div>
                  <span className="text-xl block mb-1">✍️</span>
                  <h4 className="text-xs font-bold text-gray-900">自由撰写发表</h4>
                  <p className="text-[10px] text-gray-400 leading-normal mt-1">
                    具备创作者(Author)角色后，可在个人中心撰写博文，支持实时全屏排版。
                  </p>
                </div>
                <span className="text-[9px] font-bold text-emerald-500 bg-emerald-50 py-1 rounded-lg block font-mono">
                  Writing
                </span>
              </div>

              <div className="p-4 border border-zinc-100 rounded-2xl text-center space-y-2 flex flex-col justify-between">
                <div>
                  <span className="text-xl block mb-1">💖</span>
                  <h4 className="text-xs font-bold text-gray-900">点赞与赞赏互动</h4>
                  <p className="text-[10px] text-gray-400 leading-normal mt-1">
                    每位读者均能点赞或取消点赞，我们集成了全新的云端及本地原子级事务。
                  </p>
                </div>
                <span className="text-[9px] font-bold text-pink-500 bg-pink-50 py-1 rounded-lg block font-mono">
                  Interact
                </span>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6 animate-fade-in" id="onboarding-step-3">
            <div className="space-y-2">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 shadow-2xs">
                <Smile className="h-5.5 w-5.5" />
              </div>
              <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight font-display">
                最后一页：精美个性化设定
              </h2>
              <p className="text-xs text-gray-500 font-medium font-sans">
                请配置您的读者档案，确定后将在整个阅读社区通用：
              </p>
            </div>

            {error && (
              <div className="rounded-xl bg-rose-50 border border-rose-100 p-3.5 text-[11px] text-rose-800 font-medium leading-relaxed">
                {error}
              </div>
            )}

            <div className="space-y-5">
              {/* Form Input fields */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-gray-700 flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-indigo-500" />
                  <span>显示笔名 / 用户名 <span className="text-rose-500 font-bold">*必填</span></span>
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="请输入您的社区显示笔名 / 用户昵称"
                  maxLength={24}
                  required
                  className="block w-full rounded-xl border border-gray-200 py-2.5 px-3.5 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all font-sans font-medium"
                />
              </div>

              {/* Birthday Input Field */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-gray-700 flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-indigo-500" />
                  <span>出生日期 / 生日 <span className="text-gray-400 font-normal">（选填）</span></span>
                </label>
                <input
                  type="date"
                  value={birthday}
                  onChange={(e) => setBirthday(e.target.value)}
                  className="block w-full rounded-xl border border-gray-200 py-2.5 px-3.5 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all font-sans font-medium"
                />
              </div>

              {/* Avatar Preset List Selector */}
              <div className="space-y-2">
                <label className="block text-[11px] font-bold text-gray-700">推荐高级预设头像 / Preset Avatars</label>
                <div className="flex items-center gap-3">
                  <div className="relative shrink-0 mr-1">
                    {avatar ? (
                      <img
                        src={avatar}
                        alt="Avatar Preview"
                        className="w-14 h-14 rounded-full object-cover border-2 border-indigo-200 shadow-sm"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = PRESET_AVATARS[0];
                        }}
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50 text-gray-400 text-xs font-bold">
                        未设置
                      </div>
                    )}
                    {avatar && (
                      <span className="absolute -bottom-1 -right-1 bg-emerald-500 text-white rounded-full p-0.5 border border-white text-[7px] font-bold font-mono">
                        LIVE
                      </span>
                    )}
                  </div>

                  <div className="flex gap-2 p-2 bg-gray-50/50 rounded-2xl border border-gray-100/50 flex-wrap flex-grow justify-start items-center">
                    {PRESET_AVATARS.map((url, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setAvatar(url);
                          setHasUploadedAvatar(true);
                        }}
                        className={`w-9 h-9 rounded-full overflow-hidden border-2 transition-all hover:scale-105 cursor-pointer flex shrink-0 ${
                          avatar === url ? 'border-indigo-600 scale-105 shadow-md shadow-indigo-600/15' : 'border-transparent opacity-75 hover:opacity-100'
                        }`}
                      >
                        <img src={url} className="w-full h-full object-cover" alt={`preset-${idx}`} />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Drag & Drop Upload Block */}
              <div className="bg-zinc-50/50 rounded-2xl border border-zinc-100 p-4">
                <ImageUploader 
                  onUploadSuccess={(url) => {
                    setAvatar(url);
                    setHasUploadedAvatar(true);
                  }}
                  label="或者本地自定义上传 & 圆框裁剪（必填，支持拖拽）"
                />
              </div>
            </div>
          </div>
        )}

        {/* Footer Buttons Slider Navigation */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-50">
          <button
            type="button"
            disabled={step === 1 || loading}
            onClick={handlePrev}
            className={`inline-flex items-center gap-1.5 px-4.5 py-2.5 rounded-xl text-xs font-bold transition-all border shrink-0 ${
              step === 1 
                ? 'opacity-0 pointer-events-none' 
                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 cursor-pointer disabled:opacity-50'
            }`}
          >
            <ArrowLeft className="h-4 w-4" />
            上一步
          </button>

          {step < totalSteps ? (
            <button
              type="button"
              onClick={handleNext}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-md shadow-indigo-600/10 cursor-pointer"
            >
              继续
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={loading}
              onClick={handleSubmit}
              className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-md shadow-indigo-600/15 cursor-pointer disabled:opacity-50 font-display"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  正在配置档案并开启系统...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 text-emerald-300 shrink-0" />
                  保存并开启阅读旅程 ➔
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
