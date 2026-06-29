import React from 'react';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { BookOpen, ShieldCheck, ArrowLeft, HelpCircle } from 'lucide-react';
import { safeLocalStorage } from '../utils/safeStorage';

interface RegisterProps {
  onNavigate: (route: string) => void;
  onSuccess: () => void;
}

export default function Register({ onNavigate, onSuccess }: RegisterProps) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleGoogleSignUp = async () => {
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
      console.error("Google sign up failed:", err);
      let errMsg = "注册失败，请返回并重试";
      const errorStr = (err.code || '') + ' ' + (err.message || '');
      
      if (errorStr.includes('auth/unauthorized-domain') || errorStr.includes('unauthorized-domain')) {
        const currentDomain = window.location.hostname;
        errMsg = `【网域授权未配置】\n由于您切换了自定义 Firebase 项目，您必须允许当前域名访问您的 Firebase Authentication 接口。\n\n请前往 Firebase Console 控制台：\n1. 点击左侧进入 "Authentication" (身份验证)\n2. 点击 "Settings" (设置) 选项卡\n3. 在左栏中选择 "Authorized domains" (授权网域) -> 点击 "Add domain" (添加网域)\n4. 将以下域名添加进去：\n👉 ${currentDomain}\n👉 secret-reading.vercel.app\n\n添加完成后刷新此页面，即可成功通过 Google SSO 一键录入注册！`;
      } else if (errorStr.includes('the client is offline') || errorStr.includes('offline')) {
        errMsg = `【数据库关联读取受阻（离线）】\n已成功连接 Google 账户认证，但在向您的 Cloud Firestore 数据库写入用户初始化档案时，返回 “客户端离线” 连接错误。\n\n请执行以下自查步骤：\n1. 确保在您的 Firebase 控制台中已激活 "Firestore Database" 的默认数据库（ID 为 (default)）。\n2. 前往 Firestore "Rules" (安全规则) 界面，确认当前读写规则是否允许已验证的用户录入数据（例如设置：allow read, write: if request.auth != null;）。\n3. 确认您的网络配置支持访问 Google 服务。`;
      } else if (err.code === 'auth/operation-not-allowed') {
        errMsg = "Google 登录方式在您的 Firebase 控制台中尚未启用。请前往 Firebase Console ➔ Authentication ➔ Sign-in method，并在提供商中开启 Google 选项。";
      } else if (err.code === 'auth/popup-blocked') {
        errMsg = "注册窗口被浏览器拦截，请允许弹窗后重试";
      } else if (err.message) {
        errMsg = err.message;
      }
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-6 bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
        <div className="flex flex-col items-center text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 mb-4 shadow-xs">
            <BookOpen className="h-6 w-6" />
          </div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-gray-900">
            邮箱账户注册已停用
          </h2>
          <p className="mt-2 text-sm text-gray-500 font-medium max-w-xs">
            由于常规邮箱注册不受当前项目支持，现已永久关闭。请使用 Google SSO 一键登录，系统将自动录入并为您注册读者身份。
          </p>
        </div>

        {error && (
          <div className="rounded-xl bg-rose-50 border border-rose-100 p-4 text-xs text-rose-800 font-medium whitespace-pre-line" id="register-error-container">
            {error}
          </div>
        )}

        <div className="space-y-4 pt-2">
          {/* Main Google sign-in button */}
          <button
            type="button"
            onClick={handleGoogleSignUp}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-5 py-3.5 border border-indigo-100 hover:border-indigo-300 rounded-2xl text-sm font-bold text-indigo-950 bg-white hover:bg-indigo-50/40 active:scale-[0.99] transition-all disabled:opacity-50 shadow-sm cursor-pointer"
            id="google-signup-btn"
          >
            {loading ? (
              <span className="flex items-center gap-1">正在连接 Google 安全网关...</span>
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
                <span>直接通过 Google SSO 自动创建并登录</span>
              </>
            )}
          </button>

          <div className="flex items-center gap-2 text-center text-[11px] text-gray-500 justify-center bg-gray-50 p-3 rounded-xl border border-gray-100/60 font-semibold">
            <ShieldCheck className="h-4.5 w-4.5 text-indigo-600 shrink-0" />
            <span>采用 Google 原生单点登录，不保存任何第三方明文密码</span>
          </div>
        </div>

        <div className="pt-2 border-t border-gray-100 flex justify-between items-center text-xs">
          <button
            type="button"
            onClick={() => onNavigate('login')}
            className="font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer transition-colors"
            id="register-back-to-login-btn"
          >
            <ArrowLeft className="h-4 w-4" /> 返回登录页
          </button>

          <span className="text-[11px] text-gray-400">私密阅读专栏安全系统</span>
        </div>
      </div>
    </div>
  );
}
