import React, { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import ImageUploader from './ImageUploader';
import { User, Mail, KeyRound, Calendar, Loader2, Sparkles } from 'lucide-react';

interface RegisterProps {
  onNavigate: (route: string) => void;
  onSuccess: () => void;
}

const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=150&q=80'
];

export default function Register({ onNavigate, onSuccess }: RegisterProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [birthday, setBirthday] = useState('');
  const [avatar, setAvatar] = useState(PRESET_AVATARS[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !username || !birthday) {
      setError("请填写完所有必选或必填字段");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Firebase authentication account creation
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 2. Determine initial role based on bootstrapping email
      const isBootstrapOwner = email.toLowerCase().trim() === 'zhoyilee@gmail.com';
      const initialRole = isBootstrapOwner ? 'owner' : 'reader';

      // 3. Save User metadata to MongoDB/Firestore representation
      const userRef = doc(db, 'users', user.uid);
      const payload = {
        firebaseUid: user.uid,
        email: email.toLowerCase().trim(),
        username,
        birthday,
        avatar,
        role: initialRole,
        createdAt: new Date().toISOString(),
      };

      try {
        await setDoc(userRef, payload);
      } catch (fError) {
        handleFirestoreError(fError, OperationType.WRITE, `users/${user.uid}`);
      }

      onSuccess();
    } catch (err: any) {
      console.error("Registration failed:", err);
      let errMsg = err.message || "注册失败，请稍后重试";
      if (err.code === 'auth/email-already-in-use') {
        errMsg = "此电子邮箱已被注册";
      } else if (err.code === 'auth/weak-password') {
        errMsg = "密码强度不足，请至少设置 6 位字符";
      } else if (err.code === 'auth/invalid-email') {
        errMsg = "电子邮箱格式错误";
      } else {
        // Parse custom firestore or other thrown messages
        try {
          const parsed = JSON.parse(err.message);
          if (parsed.error) {
            errMsg = `账号登录成功，但个人资料初始化失败：${parsed.error}`;
          }
        } catch {
          // Keep err.message
        }
      }
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="w-full max-w-xl space-y-6 bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex flex-col items-center text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 mb-2">
            <Sparkles className="h-6 w-6" />
          </div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-gray-900">
            创建您的阅读账户
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            加入高品质阅读社区，探索精彩视界
          </p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
              {error}
            </div>
          )}

          <div className="space-y-4">
            {/* Username */}
            <div>
              <label className="block text-sm font-medium text-gray-700">用户名</label>
              <div className="relative mt-1">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                  <User className="h-5 w-5" />
                </div>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="block w-full rounded-xl border border-gray-300 py-2.5 pl-10 pr-3 text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm"
                  placeholder="极光朗读者"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700">电子邮箱</label>
              <div className="relative mt-1">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                  <Mail className="h-5 w-5" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full rounded-xl border border-gray-300 py-2.5 pl-10 pr-3 text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm"
                  placeholder="reader@example.com"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700">安全密码</label>
              <div className="relative mt-1">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                  <KeyRound className="h-5 w-5" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full rounded-xl border border-gray-300 py-2.5 pl-10 pr-3 text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm"
                  placeholder="至少6位数字或英文字符"
                />
              </div>
            </div>

            {/* Birthday */}
            <div>
              <label className="block text-sm font-medium text-gray-700">您的生日</label>
              <div className="relative mt-1">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                  <Calendar className="h-5 w-5" />
                </div>
                <input
                  type="date"
                  required
                  value={birthday}
                  onChange={(e) => setBirthday(e.target.value)}
                  className="block w-full rounded-xl border border-gray-300 py-2.5 pl-10 pr-3 text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm"
                />
              </div>
            </div>

            {/* Avatar picker / uploader */}
            <div className="pt-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">选择头像 (可点击预设头像或自己上传)</label>
              <div className="flex flex-wrap gap-3 mb-4 items-center">
                {PRESET_AVATARS.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setAvatar(p)}
                    className={`relative rounded-full p-0.5 transition-all outline-none ${avatar === p ? 'ring-2 ring-indigo-600 scale-110 shadow-sm' : 'hover:scale-105 opacity-85'}`}
                  >
                    <img src={p} alt="Preset Profile Avatar" className="h-11 w-11 rounded-full object-cover" />
                  </button>
                ))}
                {avatar && !PRESET_AVATARS.includes(avatar) && (
                  <div className="relative rounded-full p-0.5 ring-2 ring-indigo-600 scale-110">
                    <img src={avatar} alt="Custom User Profile Avatar" className="h-11 w-11 rounded-full object-cover" />
                  </div>
                )}
              </div>

              <ImageUploader
                label="上传自定义头像 (对接 Cloudinary / 本地上传)"
                onUploadSuccess={(url) => setAvatar(url)}
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex w-full justify-center rounded-xl bg-indigo-600 px-3 py-3 text-sm font-semibold text-white hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 focus:outline-none transition-all disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                "立即注册账户"
              )}
            </button>
          </div>
        </form>

        <div className="text-center text-sm text-gray-500 mt-4">
          已经有账户了？{" "}
          <button
            onClick={() => onNavigate('login')}
            className="font-medium text-indigo-600 hover:text-indigo-500 hover:underline focus:outline-none"
          >
            立即登录
          </button>
        </div>
      </div>
    </div>
  );
}
