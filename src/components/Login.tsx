import React, { useState } from 'react';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { Loader2, BookOpen, ShieldCheck } from 'lucide-react';
import { safeLocalStorage } from '../utils/safeStorage';

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
      safeLocalStorage.removeItem('local_mock_user');
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
          onboarded: false,
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
      const errorStr = (err.code || '') + ' ' + (err.message || '');
      
      if (errorStr.includes('auth/unauthorized-domain') || errorStr.includes('unauthorized-domain')) {
        const currentDomain = window.location.hostname;
        errMsg = `【网域授权未配置】\n由于您切换了自定义 Firebase 项目，您必须允许当前域名访问您的 Firebase Authentication 接口。\n\n请前往 Firebase Console 控制台：\n1. 点击左侧进入 "Authentication" (身份验证)\n2. 点击 "Settings" (设置) 选项卡\n3. 在左栏中选择 "Authorized domains" (授权网域) -> 点击 "Add domain" (添加网域)\n4. 将以下域名添加进去：\n👉 ${currentDomain}\n👉 secret-reading.vercel.app\n\n添加完成后刷新此页面，即可成功通过 Google SSO 验证登录！`;
      } else if (errorStr.includes('the client is offline') || errorStr.includes('offline')) {
        errMsg = `【数据库读取受阻（或处于离线/未初始化状态）】\n已成功连接 Google 账户验证，但在尝试请求您的 Cloud Firestore 数据库时返回“客户端离线/无法建立连接”错误。\n\n请执行以下自查步骤：\n1. 确保在您的 Firebase 控制台中已激活 "Firestore Database" 的默认数据库（ID 为 (default)）。\n2. 前往 Firestore "Rules" (安全规则) 界面，确认当前读写规则是否允许已验证的用户录入数据（例如设置：allow read, write: if request.auth != null;）。\n3. 确保本地网络没有代理拦截对 firestore.googleapis.com 结点的通信。`;
      } else if (err.code === 'auth/operation-not-allowed') {
        errMsg = "Google 登录方式在您的 Firebase 控制台中尚未启用。请通知管理员在 Firebase Console ➔ Authentication ➔ Sign-in method 里启用 Google 选项。";
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fafafa] px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-6 bg-white p-8 rounded-3xl shadow-xs border border-gray-100">
        <div className="flex flex-col items-center text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 mb-4 shadow-xs">
            <BookOpen className="h-6 w-6" />
          </div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-gray-900">
            欢迎回到私密阅读空间~
          </h2>
          <p className="mt-2 text-sm text-gray-500 font-medium max-w-xs">
            请通过 Google 账户登录。
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
            className="w-full flex items-center justify-center gap-3 px-5 py-3.5 border border-indigo-100 hover:border-indigo-300 rounded-2xl text-sm font-bold text-indigo-950 bg-white hover:bg-indigo-50/40 active:scale-[0.99] transition-all disabled:opacity-50 shadow-xs cursor-pointer"
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
                <span>使用 Google 账号</span>
              </>
            )}
          </button>
          
          <div className="flex items-center gap-2 text-center text-[11px] text-gray-500 justify-center bg-gray-50 p-3 rounded-xl border border-gray-100/60 font-semibold">
            <ShieldCheck className="h-4.5 w-4.5 text-indigo-600 shrink-0" />
            <span>采用 Google SS0 原生单点登录，不保存任何第三方明文密码</span>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-5 text-center text-[11px] text-gray-400">
          <span>私密阅读专栏 · 专属安全身份校验系统</span>
        </div>
      </div>
    </div>
  );
}
