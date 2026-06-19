import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from './firebase';
import { AppUser } from './types';
import Login from './components/Login';
import Register from './components/Register';
import Home from './components/Home';
import Write from './components/Write';
import PostDetail from './components/PostDetail';
import Admin from './components/Admin';
import Profile from './components/Profile';
import Settings from './components/Settings';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, User, Shield, Compass, LogOut, Settings as SettingsIcon, PenTool, Loader2 } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [route, setRoute] = useState<string>('home'); // 'home', 'login', 'register', 'write', 'profile', 'admin', 'settings', 'post-detail'
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);

  // 1. Listen to Firebase authentication status
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      setFirebaseUser(fbUser);
      if (!fbUser) {
        setUser(null);
        setRoute('login');
        setAuthLoading(false);
      } else {
        // Feed user document from Firestore dynamically
        setProfileLoading(true);
        const userRef = doc(db, 'users', fbUser.uid);
        
        // Listen in real-time to user profile changes (especially role modifications by owners!)
        const unmountSnap = onSnapshot(userRef, (snapshot) => {
          if (snapshot.exists()) {
            setUser({
              ...snapshot.data(),
            } as AppUser);
            // Default logged-in navigation
            if (route === 'login' || route === 'register') {
              setRoute('home');
            }
          } else {
            // Profile doc doesn't exist yet, wait
            console.warn("Firestore User profile document missing or creating...");
          }
          setProfileLoading(false);
          setAuthLoading(false);
        }, (err) => {
          console.error("Listening user's profile failed:", err);
          setProfileLoading(false);
          setAuthLoading(false);
        });

        return () => unmountSnap();
      }
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    if (confirm("确定要安全退出当前阅读账户吗？")) {
      await signOut(auth);
      setRoute('login');
    }
  };

  const handleSelectPost = (postId: string) => {
    setSelectedPostId(postId);
    setRoute('post-detail');
  };

  const handleEditPost = (postId: string) => {
    setEditingPostId(postId);
    setRoute('write');
  };

  const handleWriteNavigate = () => {
    setEditingPostId(null);
    setRoute('write');
  };

  // Rendering screen based on state
  const renderContent = () => {
    if (authLoading || profileLoading) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center" id="app-loading-screen">
          <Loader2 className="h-9 w-9 animate-spin text-indigo-600 mb-4" />
          <p className="text-sm font-medium text-gray-500">正在进入私密阅读专栏，请稍候...</p>
        </div>
      );
    }

    switch (route) {
      case 'login':
        return <Login onNavigate={setRoute} onSuccess={() => setRoute('home')} />;
      case 'register':
        return <Register onNavigate={setRoute} onSuccess={() => setRoute('home')} />;
      case 'home':
        return <Home user={user} onNavigate={setRoute} onSelectPost={handleSelectPost} />;
      case 'write':
        return <Write user={user} draftId={editingPostId} onNavigate={setRoute} />;
      case 'post-detail':
        return (
          <PostDetail
            postId={selectedPostId || ''}
            user={user}
            onNavigate={setRoute}
            onEditPost={handleEditPost}
            onBack={() => setRoute('home')}
          />
        );
      case 'admin':
        return <Admin user={user} onNavigate={setRoute} onSelectPost={handleSelectPost} />;
      case 'profile':
        return <Profile user={user} onNavigate={setRoute} onSelectPost={handleSelectPost} onEditPost={handleEditPost} />;
      case 'settings':
        return <Settings onBack={() => setRoute('home')} />;
      default:
        return <Home user={user} onNavigate={setRoute} onSelectPost={handleSelectPost} />;
    }
  };

  const isAuthPage = route === 'login' || route === 'register';

  return (
    <div className="min-h-screen flex flex-col bg-[#fafafa]">
      {/* Dynamic Header / Navigation Bar */}
      {!isAuthPage && user && (
        <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100/80 shadow-xs" id="app-nav-bar">
          <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
            {/* Title / Logo */}
            <div
              onClick={() => setRoute('home')}
              className="flex items-center gap-2 cursor-pointer group hover:opacity-90 transition-opacity"
            >
              <div className="h-9 w-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold tracking-wider shadow-sm shadow-indigo-600/20 group-hover:scale-105 transition-transform">
                秘
              </div>
              <div>
                <span className="block font-display font-extrabold text-sm text-gray-900 tracking-tight leading-none">
                  私密阅读
                </span>
                <span className="block font-sans text-[10px] text-gray-400 font-bold mt-1 uppercase tracking-wider">
                  PREMIUM READING
                </span>
              </div>
            </div>

            {/* Menu options block */}
            <nav className="flex items-center gap-1 sm:gap-2">
              <button
                onClick={() => setRoute('home')}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${route === 'home' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'}`}
              >
                <Compass className="h-4 w-4" />
                <span className="hidden md:inline">专栏推荐</span>
              </button>

              {user.role === 'owner' && (
                <button
                  onClick={() => setRoute('admin')}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${route === 'admin' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'}`}
                >
                  <Shield className="h-4 w-4" />
                  <span className="hidden md:inline">管理后台</span>
                </button>
              )}

              <button
                onClick={() => setRoute('profile')}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${route === 'profile' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'}`}
              >
                <User className="h-4 w-4" />
                <span className="hidden md:inline">个人中心</span>
              </button>

              <button
                onClick={() => setRoute('settings')}
                title="图床证书设置"
                className={`p-2 rounded-xl transition-all ${route === 'settings' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`}
              >
                <SettingsIcon className="h-4.5 w-4.5" />
              </button>

              <div className="h-4 w-px bg-gray-200 mx-1 sm:mx-2"></div>

              <button
                onClick={handleLogout}
                title="登出当前账户"
                className="p-2 rounded-xl text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-all"
              >
                <LogOut className="h-4.5 w-4.5" />
              </button>
            </nav>
          </div>
        </header>
      )}

      {/* Primary body view wrapper with standard animations */}
      <main className="flex-grow">
        <AnimatePresence mode="wait">
          <motion.div
            key={route + (selectedPostId || '') + (editingPostId || '')}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.18, ease: "easeInOut" }}
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Simple footer indicator */}
      {!isAuthPage && (
        <footer className="py-6 text-center text-[10px] text-gray-400 border-t border-gray-100/60 bg-white">
          <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2.5">
            <span className="font-medium">© 2026 私密阅读专栏. 享受阅读的纯粹与宁静.</span>
            <div className="flex items-center gap-3 font-semibold text-gray-500">
              <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-mono">Firebase Online</span>
              <button onClick={() => setRoute('settings')} className="hover:text-indigo-600 hover:underline">
                图床证书对接
              </button>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
