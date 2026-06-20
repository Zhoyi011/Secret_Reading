import React, { useState } from 'react';
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { KeyRound, Mail, Loader2, BookOpen, ShieldCheck, HelpCircle, Sparkles } from 'lucide-react';

interface LoginProps {
  onNavigate: (route: string) => void;
  onSuccess: () => void;
}

export default function Login({ onNavigate, onSuccess }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("请填写完所有必填项");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      localStorage.removeItem('local_mock_user');
      await signInWithEmailAndPassword(auth, email, password);
      onSuccess();
    } catch (err: any) {
      console.error("Login failed:", err);
      let errMsg = "登录失败，请检查您的邮箱和密码";
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        errMsg = "邮箱或密码错误";
      } else if (err.code === 'auth/invalid-email') {
        errMsg = "无效的邮箱地址";
      } else if (err.code === 'auth/operation-not-allowed') {
        errMsg = "Firebase 认证操作不被允许 (请在控制台启用 Email/Password 认证卡片)";
      }
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      localStorage.removeItem('local_mock_user');
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      const userRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        const emailVal = user.email || '';
        const isBootstrapOwner = emailVal.toLowerCase().trim() === 'zhoyilee@gmail.com';
        const initialRole = isBootstrapOwner ? 'owner' : 'reader';
        
        const payload = {
          firebaseUid: user.uid,
          email: emailVal.toLowerCase().trim(),
          username: user.displayName || `读者_${user.uid.slice(0, 6)}`,
          birthday: '',
          avatar: user.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
          role: initialRole,
          createdAt: new Date().toISOString(),
        };
        
        try {
          await setDoc(userRef, payload);
        } catch (fError) {
          handleFirestoreError(fError, OperationType.WRITE, `users/${user.uid}`);
        }
      }
      
      onSuccess();
    } catch (err: any) {
      console.error("Google sign in failed:", err);
      let errMsg = "谷歌登录失败，请重试";
      if (err.code === 'auth/operation-not-allowed') {
        errMsg = "Google 登录方式在您的 Firebase 控制台中尚未启用。请前往 Firebase Console ➔ Authentication ➔ Sign-in method，启用 Google 选项。";
      } else if (err.code === 'auth/popup-blocked') {
        errMsg = "登录窗口被浏览器拦截，请允许弹窗后重试";
      } else if (err.code === 'auth/popup-closed-by-user') {
        errMsg = "您已关闭登录小窗口，未能完成登录";
      } else if (err.message) {
        errMsg = err.message;
      }
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleEnterSandbox = (role: 'owner' | 'author' | 'reader') => {
    const mockUser = {
      firebaseUid: `mock-uid-${Date.now()}`,
      email: role === 'owner' ? 'zhoyilee@gmail.com' : `${role}@sandbox.com`,
      username: role === 'owner' ? '站长大拿 (Sandbox)' : role === 'author' ? '专栏写手 (Sandbox)' : '金牌读者 (Sandbox)',
      birthday: '2000-01-01',
      avatar: role === 'owner' 
        ? 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80'
        : 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80',
      role: role,
      createdAt: new Date().toISOString(),
    };
    localStorage.setItem('local_mock_user', JSON.stringify(mockUser));
    onSuccess();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-6 bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
        <div className="flex flex-col items-center text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 mb-4">
            <BookOpen className="h-6 w-6" />
          </div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-gray-900">
            欢迎回到私密阅读空间
          </h2>
          <p className="mt-2 text-sm text-gray-500 font-medium">
            请输入您的凭据以访问专属文学园地
          </p>
        </div>

        <form className="space-y-4 font-sans" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-xs text-red-800 font-medium whitespace-pre-line">
              {error}
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label htmlFor="email-address" className="sr-only">
                电子邮箱
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                  <Mail className="h-5 w-5" />
                </div>
                <input
                  id="email-address"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full rounded-xl border border-gray-300 py-3 pl-10 pr-3 text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm"
                  placeholder="您的电子邮箱 (@...)"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="sr-only">
                密码
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                  <KeyRound className="h-5 w-5" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full rounded-xl border border-gray-300 py-3 pl-10 pr-3 text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm"
                  placeholder="密码"
                />
              </div>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative flex w-full justify-center rounded-xl bg-indigo-600 px-3 py-3 text-sm font-semibold text-white hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 focus:outline-none transition-all disabled:opacity-50 shadow-sm shadow-indigo-100"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                "登录账户 (Real Firebase)"
              )}
            </button>
          </div>
        </form>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-100"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-2.5 text-gray-400 font-bold tracking-wider">
              或使用更安全快捷的登录
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2.5 px-4 py-3 border border-gray-200 hover:border-gray-300 rounded-xl text-xs font-bold text-gray-700 bg-white hover:bg-gray-50 active:scale-[0.99] transition-all disabled:opacity-[0.55] shadow-xs"
        >
          <svg className="h-4.5 w-4.5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M23.745 12.27c0-.77-.07-1.54-.19-2.27H12v4.51h6.6c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.68-5.17 3.68-8.82z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.97-1.08 7.96-2.91l-3.86-3c-1.08.72-2.45 1.16-4.1 1.16-3.15 0-5.81-2.13-6.76-5.01H1.32v3.1c2 3.97 6.11 6.66 10.68 6.66z"
            />
            <path
              fill="#FBBC05"
              d="M5.24 14.24a7.19 7.19 0 0 1 0-4.48V6.66H1.32a11.956 11.956 0 0 0 0 10.68l3.92-3.1z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.43 0 3.32 2.69 1.32 6.66l3.92 3.1c.95-2.88 3.61-5.01 6.76-5.01z"
            />
          </svg>
          Google 账户一键安全登录
        </button>

        <div className="text-center text-xs text-gray-500 mt-4 leading-relaxed font-semibold">
          还没有账户？{" "}
          <button
            onClick={() => onNavigate('register')}
            className="font-bold text-indigo-600 hover:text-indigo-500 hover:underline focus:outline-none"
          >
            立即注册
          </button>
        </div>

        {/* Dynamic developer/sandbox warning */}
        <div className="border-t border-gray-100 pt-4 mt-2 space-y-3">
          <div className="bg-amber-50/70 p-3.5 rounded-xl border border-amber-100 flex gap-2.5">
            <HelpCircle className="h-4.5 w-4.5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-[11px] text-amber-950 font-medium leading-relaxed">
              <span className="font-bold block text-amber-900 mb-0.5">Firebase Auth 认证限制帮助</span>
              若遇到 <code className="bg-white/80 px-1 py-0.5 rounded text-red-700">auth/operation-not-allowed</code> 错误，说明该登录渠道在您的 Firebase 实例中未在后台启用。请参照指导启用它们。
            </div>
          </div>

          <div className="bg-indigo-50/40 p-4 rounded-xl border border-indigo-100/30 text-center">
            <span className="text-[11px] font-bold text-indigo-900 block mb-2 flex items-center justify-center gap-1">
              <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
              沙盒免受限制快速测试选项
            </span>
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <button
                onClick={() => handleEnterSandbox('owner')}
                className="py-1.5 px-2 bg-indigo-600 hover:bg-indigo-500 active:scale-95 transition-all text-white font-semibold rounded-lg flex items-center justify-center gap-1 shadow-xs"
              >
                一键登录站长 (Owner)
              </button>
              <button
                onClick={() => handleEnterSandbox('author')}
                className="py-1.5 px-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 transition-all text-white font-semibold rounded-lg flex items-center justify-center gap-1 shadow-xs"
              >
                一键登录写手 (Author)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
