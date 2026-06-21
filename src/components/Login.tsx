import React, { useState } from 'react';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { Loader2, BookOpen, ShieldCheck, HelpCircle, Sparkles } from 'lucide-react';

interface LoginProps {
  onNavigate: (route: string) => void;
  onSuccess: () => void;
}

export default function Login({ onNavigate, onSuccess }: LoginProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 mb-4 shadow-xs">
            <BookOpen className="h-6 w-6" />
          </div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-gray-900">
            欢迎回到私密阅读空间
          </h2>
          <p className="mt-2 text-sm text-gray-500 font-medium max-w-xs">
            由于常规邮箱注册已停用，现在请通过 Google 账户一键完成安全快捷的正规登录。
          </p>
        </div>

        {error && (
          <div className="rounded-xl bg-rose-50 border border-rose-100 p-4 text-xs text-rose-800 font-medium whitespace-pre-line" id="login-error-container">
            {error}
          </div>
        )}

        <div className="space-y-4 pt-2">
          {/* Main Google sign-in button */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-5 py-3.5 border border-indigo-100 hover:border-indigo-300 rounded-2xl text-sm font-bold text-indigo-950 bg-white hover:bg-indigo-50/40 active:scale-[0.99] transition-all disabled:opacity-50 shadow-sm cursor-pointer"
            id="google-sign-in-btn"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
            ) : (
              <>
                <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
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
                <span>使用 Google 账号一键安全登录</span>
              </>
            )}
          </button>
          
          <div className="flex items-center gap-2 text-center text-[11px] text-gray-500 justify-center bg-gray-50 p-3 rounded-xl border border-gray-100/60 font-semibold">
            <ShieldCheck className="h-4.5 w-4.5 text-indigo-600 shrink-0" />
            <span>新用户首次通过 Google 登录，将自动生成读者账户</span>
          </div>
        </div>

        {/* Dynamic developer/sandbox warning */}
        <div className="border-t border-gray-100 pt-5 mt-2 space-y-4">
          <div className="bg-amber-50/60 p-3.5 rounded-xl border border-amber-100 flex gap-2.5">
            <HelpCircle className="h-4.5 w-4.5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-[11px] text-amber-950 font-medium leading-relaxed">
              <span className="font-bold block text-amber-900 mb-0.5">Firebase 登录异常提示</span>
              若遇到 Google 登录报错，通常是因为在您当前的 Firebase 后台尚未开通 Google 登录提供者，您可进入控制面板完成自助开通。
            </div>
          </div>

          <div className="bg-gradient-to-tr from-indigo-50/40 to-indigo-50/70 p-4 rounded-xl border border-indigo-100/30 text-center">
            <span className="text-[11px] font-bold text-indigo-950 block mb-2.5 flex items-center justify-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-indigo-600 animate-pulse" />
              免配置沙盒极速预览 (推荐开发者测试)
            </span>
            <div className="grid grid-cols-3 gap-2 text-[10px]">
              <button
                onClick={() => handleEnterSandbox('owner')}
                className="py-2 px-1.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 transition-all text-white font-bold rounded-lg flex items-center justify-center shadow-xs cursor-pointer"
                id="sandbox-owner-btn"
              >
                一键站长
              </button>
              <button
                onClick={() => handleEnterSandbox('author')}
                className="py-2 px-1.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 transition-all text-white font-bold rounded-lg flex items-center justify-center shadow-xs cursor-pointer"
                id="sandbox-author-btn"
              >
                一键作者
              </button>
              <button
                onClick={() => handleEnterSandbox('reader')}
                className="py-2 px-1.5 bg-gray-700 hover:bg-gray-600 active:scale-95 transition-all text-white font-bold rounded-lg flex items-center justify-center shadow-xs cursor-pointer"
                id="sandbox-reader-btn"
              >
                金牌读者
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
