import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, onSnapshot, getDoc, setDoc, collection, query, where, orderBy, limit, updateDoc, writeBatch, deleteDoc, getDocs } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { AppUser, Notification } from './types';
import Login from './components/Login';
import Register from './components/Register';
import Home from './components/Home';
import Write from './components/Write';
import PostDetail from './components/PostDetail';
import Admin from './components/Admin';
import Profile from './components/Profile';
import Settings from './components/Settings';
import Onboarding from './components/Onboarding';
import Bookshelf from './components/Bookshelf';
import Messages from './components/Messages';
import AuthorProfile from './components/AuthorProfile';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, User, Shield, Compass, LogOut, Settings as SettingsIcon, Loader2, Bell, BellRing, Heart, UserPlus, Check, Trash2, Bookmark, MessageSquare, ShieldAlert, Menu, X } from 'lucide-react';
import { safeLocalStorage, safeSessionStorage } from './utils/safeStorage';

export default function App() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [firestoreError, setFirestoreError] = useState<string | null>(null);
  const [route, setRoute] = useState<string>('home'); // 'home', 'login', 'register', 'write', 'profile', 'admin', 'settings', 'post-detail', 'bookshelf', 'messages', 'author-profile'
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [activeMessageUserId, setActiveMessageUserId] = useState<string | null>(null);
  const [selectedAuthorId, setSelectedAuthorId] = useState<string | null>(null);
  const [prevRoute, setPrevRoute] = useState<string>('home');

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  const isCreatingProfileRef = React.useRef(false);
  const bootstrapTimerRef = React.useRef<any>(null);

  // 1.2. Listen to real-time notifications when the user is authenticated
  useEffect(() => {
    if (!firebaseUser) {
      setNotifications([]);
      return;
    }

    const notifRef = collection(db, 'notifications');
    const q = query(
      notifRef,
      where('recipientId', '==', firebaseUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Notification[] = [];
      snapshot.forEach((docSnap) => {
        list.push({
          id: docSnap.id,
          ...docSnap.data()
        } as Notification);
      });
      
      // Sort locally in memory to avoid needing a composite index
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setNotifications(list.slice(0, 50));

      // Trigger standard HTML5 system desktop notifications for newly added unread notifications
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          const diffMs = Date.now() - new Date(data.createdAt).getTime();
          if (!data.read && diffMs < 15000) {
            if ('Notification' in window && window.Notification.permission === 'granted') {
              new window.Notification(data.title || '您有新的消息', {
                body: data.body,
                icon: data.senderAvatar || '/icon.png'
              });
            }
          }
        }
      });

    }, (err) => {
      console.error("Listening notifications failed:", err);
    });

    return () => unsubscribe();
  }, [firebaseUser]);

  const handleMarkAsRead = async (notifId: string) => {
    try {
      const notifDocRef = doc(db, 'notifications', notifId);
      await updateDoc(notifDocRef, { read: true });
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const unreadList = notifications.filter(n => !n.read);
      if (unreadList.length === 0) return;
      
      const batch = writeBatch(db);
      unreadList.forEach(n => {
        const docRef = doc(db, 'notifications', n.id);
        batch.update(docRef, { read: true });
      });
      await batch.commit();
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    }
  };

  const handleDeleteNotification = async (notifId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const notifDocRef = doc(db, 'notifications', notifId);
      // Wait, deleteDoc is not imported in App.tsx! We should import it, or use setDoc with empty or deleteDoc.
      // Let's check imports in App.tsx. Currently we have setDoc, updateDoc.
      // Wait, we can import deleteDoc, or use it if imported. Let's make sure deleteDoc is imported. Let's see the import.
      // In line 3 we have: import { doc, onSnapshot, getDoc, setDoc, collection, query, where, orderBy, limit, updateDoc, writeBatch } from 'firebase/firestore';
      // Let's edit the import to include deleteDoc too! Let's do that cleanly.
      const batch = writeBatch(db);
      const docRef = doc(db, 'notifications', notifId);
      batch.delete(docRef);
      await batch.commit();
    } catch (err) {
      console.error("Failed to delete notification:", err);
    }
  };

  // 1. Listen to Firebase authentication status
  useEffect(() => {
    let activeSnapshotUnsubscribe: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      // Unsubscribe from any previous profile snapshot listener to prevent leaks
      if (activeSnapshotUnsubscribe) {
        activeSnapshotUnsubscribe();
        activeSnapshotUnsubscribe = null;
      }

      setFirebaseUser(fbUser);
      if (!fbUser) {
        setUser(null);
        setRoute('login');
        setAuthLoading(false);
        setFirestoreError(null);
        isCreatingProfileRef.current = false;
        if (bootstrapTimerRef.current) {
          clearTimeout(bootstrapTimerRef.current);
          bootstrapTimerRef.current = null;
        }
      } else {
        // Feed user document from Firestore dynamically
        setProfileLoading(true);
        const userRef = doc(db, 'users', fbUser.uid);
        
        // Listen in real-time to user profile changes
        activeSnapshotUnsubscribe = onSnapshot(userRef, (snapshot: any) => {
          if (snapshot.exists()) {
            setUser({
              ...snapshot.data(),
            } as AppUser);
            // Default logged-in navigation
            if (route === 'login' || route === 'register') {
              setRoute('home');
            }
            setProfileLoading(false);
            setAuthLoading(false);
            setFirestoreError(null);
          } else {
            // If the document does not exist but is loaded from cache (offline replication),
            // wait for the server response before initiating auto-bootstrap to avoid "client offline" error
            if (snapshot.metadata.fromCache) {
              console.log("[Auto-Bootstrap] Profile missing in local cache; holding for server verification...");
              return;
            }

            if (isCreatingProfileRef.current) {
              return;
            }

            isCreatingProfileRef.current = true;
            console.warn("Firestore User profile document missing or creating...");

            if (bootstrapTimerRef.current) {
              clearTimeout(bootstrapTimerRef.current);
            }

            // Non-blocking auto-creation with deliberate delay to prevent lockout or race condition errors
            bootstrapTimerRef.current = setTimeout(async () => {
              try {
                // Check if user is still logged in before writing
                if (auth.currentUser) {
                  const emailVal = fbUser.email || '';
                  const isBootstrapOwner = emailVal.toLowerCase().trim() === 'zhoyilee@gmail.com';
                  const initialRole = isBootstrapOwner ? 'owner' : 'reader';
                  const payload = {
                    firebaseUid: fbUser.uid,
                    email: emailVal.toLowerCase().trim(),
                    username: fbUser.displayName || `读者_${fbUser.uid.slice(0, 6)}`,
                    birthday: '',
                    avatar: fbUser.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
                    role: initialRole,
                    createdAt: new Date().toISOString(),
                    onboarded: false,
                  };
                  
                  // Writing directly using setDoc (Firestore automatically buffers writes locally when completely offline)
                  await setDoc(userRef, payload, { merge: true });
                  console.log("[Auto-Bootstrap] Successfully initialized missing user profile in Firestore.");
                }
              } catch (bootstrapErr: any) {
                isCreatingProfileRef.current = false; // Allow retry on subsequent cycles if write fails
                const errMsg = bootstrapErr?.message || String(bootstrapErr);
                if (errMsg.includes('offline') || errMsg.includes('client is offline')) {
                  console.warn("Auto-bootstrap profile failed during delay (offline/buffered):", bootstrapErr);
                } else {
                  console.error("Auto-bootstrap profile failed during write:", bootstrapErr);
                  setFirestoreError(`初始化用户配置失败: ${errMsg}`);
                }
              }
            }, 1000);
          }
        }, (err) => {
          const errMsg = err?.message || String(err);
          if (errMsg.includes('offline') || errMsg.includes('client is offline')) {
            console.warn("Listening user's profile failed (offline):", err);
          } else {
            console.error("Listening user's profile failed:", err);
          }
          setProfileLoading(false);
          setAuthLoading(false);
          // Set error instead of crashing the React App
          setFirestoreError(err.message || String(err));
        });
      }
    });

    return () => {
      unsubscribe();
      if (activeSnapshotUnsubscribe) {
        activeSnapshotUnsubscribe();
      }
    };
  }, []);

  // Listen to custom event for inner author profile routing
  useEffect(() => {
    const handleNavigateToAuthor = (e: Event) => {
      const authorId = (e as CustomEvent).detail;
      if (authorId) {
        setPrevRoute(route);
        setSelectedAuthorId(authorId);
        setRoute('author-profile');
      }
    };
    window.addEventListener('navigate-to-author', handleNavigateToAuthor);
    return () => {
      window.removeEventListener('navigate-to-author', handleNavigateToAuthor);
    };
  }, [route]);

  // Handle URL route mapping on startup (e.g. /authorName/123456)
  useEffect(() => {
    const handleUrlRoute = async () => {
      const pathParts = window.location.pathname.split('/').filter(Boolean);
      if (pathParts.length === 2) {
        const [authorName, shortId] = pathParts;
        if (/^\d{6}$/.test(shortId)) {
          try {
            const postsRef = collection(db, 'posts');
            const q = query(postsRef, where('shortId', '==', shortId));
            const snap = await getDocs(q);
            if (!snap.empty) {
              const matchedPostDoc = snap.docs[0];
              setSelectedPostId(matchedPostDoc.id);
              setRoute('post-detail');
            } else {
              console.warn("Post with shortId not found:", shortId);
            }
          } catch (err) {
            console.error("Failed to fetch post by shortId:", err);
          }
        }
      } else if (pathParts.length === 1 && pathParts[0] === 'bookshelf') {
        setRoute('bookshelf');
      } else if (pathParts.length === 1 && pathParts[0] === 'messages') {
        setRoute('messages');
      } else if (pathParts.length === 1 && pathParts[0] === 'profile') {
        setRoute('profile');
      } else if (pathParts.length === 1 && pathParts[0] === 'settings') {
        setRoute('settings');
      } else if (pathParts.length === 1 && pathParts[0] === 'admin') {
        setRoute('admin');
      }
    };
    handleUrlRoute();
  }, []);

  // Sync state changes with the browser URL
  useEffect(() => {
    if (route === 'home') {
      window.history.pushState(null, '', '/');
    } else if (route === 'bookshelf') {
      window.history.pushState(null, '', '/bookshelf');
    } else if (route === 'messages') {
      window.history.pushState(null, '', '/messages');
    } else if (route === 'profile') {
      window.history.pushState(null, '', '/profile');
    } else if (route === 'admin') {
      window.history.pushState(null, '', '/admin');
    } else if (route === 'settings') {
      window.history.pushState(null, '', '/settings');
    }
  }, [route]);

  const handleSelectAuthor = (authorId: string) => {
    setPrevRoute(route);
    setSelectedAuthorId(authorId);
    setRoute('author-profile');
  };

  // 1.5. Protect copyright rights / 禁止右键和复制，特定条件除外
  useEffect(() => {
    // Disable right click / contextmenu globally unless targeting writing panels or dedicated forms
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target;
      if (!target || !(target instanceof Element)) return;
      
      const isCreatorOrForm = 
        target.closest('#write-page') || 
        target.closest('#write-post-container') ||
        target.closest('#onboarding-form') ||
        target.closest('#settings-form') ||
        target.closest('.allow-right-click');

      if (isCreatorOrForm) {
        return;
      }
      e.preventDefault();
    };

    // Disable standard copy operations globally except for the author writer interface or form inputs
    const handleCopy = (e: ClipboardEvent) => {
      const target = e.target;
      if (!target || !(target instanceof Element)) return;
      
      const isCreatorWrite = 
        target.closest('#write-page') || 
        target.closest('#write-post-container') ||
        target.closest('.allow-copy') || 
        target.closest('input') || 
        target.closest('textarea') || 
        target.closest('[contenteditable="true"]');

      if (!isCreatorWrite) {
        e.preventDefault();
      }
    };

    // Disable paste operations generally, but definitely allow inside inputs and textareas (such as search bar, etc.)
    const handlePaste = (e: ClipboardEvent) => {
      const target = e.target;
      if (!target || !(target instanceof Element)) return;

      const isInputOrTextArea = 
        target.closest('input') || 
        target.closest('textarea') || 
        target.closest('[contenteditable="true"]') ||
        target.closest('#write-page') ||
        target.closest('#write-post-container') ||
        target.closest('.allow-paste');

      if (!isInputOrTextArea) {
        e.preventDefault();
      }
    };

    window.addEventListener('contextmenu', handleContextMenu, { capture: true });
    window.addEventListener('copy', handleCopy, { capture: true });
    window.addEventListener('paste', handlePaste, { capture: true });

    return () => {
      window.removeEventListener('contextmenu', handleContextMenu, { capture: true });
      window.removeEventListener('copy', handleCopy, { capture: true });
      window.removeEventListener('paste', handlePaste, { capture: true });
    };
  }, []);

  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [route]);

  const handleLogout = async () => {
    setAuthLoading(true);
    
    // 1. Perform Firebase client signOut
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Firebase sign out error:", err);
    }

    // 2. Clear standard memory states
    setUser(null);
    setFirebaseUser(null);
    setSelectedPostId(null);
    setEditingPostId(null);
    
    // 3. Clear localStorage and sessionStorage entirely to purge active states
    try {
      safeLocalStorage.clear();
      safeSessionStorage.clear();
    } catch (storageErr) {
      console.error("Error clearing local/session storage:", storageErr);
    }

    // 4. Forcefully purge IndexedDB databases (especially Firebase & Firestore persistence)
    try {
      if (window.indexedDB && typeof window.indexedDB.databases === 'function') {
        const dbs = await window.indexedDB.databases();
        for (const dbInfo of dbs) {
          if (dbInfo.name) {
            console.log(`Deleting IndexedDB database: ${dbInfo.name}`);
            window.indexedDB.deleteDatabase(dbInfo.name);
          }
        }
      } else if (window.indexedDB) {
        // Fallback for browsers or clients without window.indexedDB.databases support
        window.indexedDB.deleteDatabase('firebaseLocalStorageDb');
        window.indexedDB.deleteDatabase('firestore/[DEFAULT]/secret-reading/main');
        window.indexedDB.deleteDatabase('firestore/[DEFAULT]/secret-reading');
      }
    } catch (idbErr) {
      console.error("Error purging IndexedDB databases:", idbErr);
    }
    
    // 5. Navigate softly to the clean login screen and fully reload to wipe any remaining contexts
    setRoute('login');
    setAuthLoading(false);
    window.location.reload();
  };

  const handleAuthSuccess = () => {
    setRoute('home');
  };

  const handleSelectPost = (postId: string) => {
    setSelectedPostId(postId);
    setRoute('post-detail');
  };

  const handleEditPost = (postId: string) => {
    setEditingPostId(postId);
    setRoute('write');
  };

  // Rendering screen based on state
  const renderContent = () => {
    if (firestoreError) {
      return (
        <div className="max-w-2xl mx-auto px-4 py-12" id="firestore-offline-troubleshooter">
          <div className="bg-white rounded-3xl p-8 border border-amber-100 shadow-md space-y-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-amber-50 rounded-2xl text-amber-600">
                <Shield className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Firestore 数据库连接受阻</h3>
                <p className="text-xs font-semibold text-amber-600 mt-1 uppercase tracking-wider font-mono">
                  Error Code: Client Offline / Network Blocked
                </p>
              </div>
            </div>

            <div className="text-sm text-gray-600 space-y-3 leading-relaxed">
              <p>
                已成功通过 Google 账户验证，但在向您的 Firebase Firestore 数据库获取或注册个人轮廓时失败。返回的错误信息为：<br />
                <code className="block bg-gray-50 border border-gray-100 p-2.5 rounded-lg text-xs font-mono text-rose-600 font-bold overflow-x-auto my-2">
                  {firestoreError}
                </code>
              </p>
              
              <div className="space-y-4 border-t border-gray-100 pt-4 mt-4">
                <h4 className="font-bold text-gray-900">🛠️ 解决此问题的核心自查步骤：</h4>
                <ol className="list-decimal list-inside space-y-3 text-xs text-gray-500 font-medium">
                  <li>
                    <strong className="text-gray-800">确认已在 Firebase 项目中开通 Cloud Firestore：</strong><br />
                    进入 <a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">Firebase Console</a> ➔ 选中您的项目 <span className="font-mono bg-zinc-100 px-1 py-0.5 rounded text-zinc-800 font-bold">secret-reading</span> ➔ 点击左侧“Firestore Database” ➔ 点击 “Create database” 创建数据库。数据库 ID 需为默认的 <span className="font-mono bg-zinc-100 px-1 py-0.5 rounded text-zinc-800 font-bold">(default)</span>。
                  </li>
                  <li>
                    <strong className="text-gray-800">检查安全规则 (Rules) 是否处于拒绝状态：</strong><br />
                    点击 Firestore 里的 “Rules” 标签，确保没有被全盘拒绝。测试及轻量开发时，您可以临时配置为：<br />
                    <code className="block bg-zinc-50 p-2 rounded text-[11px] font-mono mt-1 text-gray-600 border border-zinc-100 leading-normal">
                      {"rules_version = '2';\nservice cloud.firestore {\n  match /databases/{database}/documents {\n    match /{document=**} {\n      allow read, write: if request.auth != null;\n    }\n  }\n}"}
                    </code>
                  </li>
                  <li>
                    <strong className="text-gray-800">核对 Authorized Domains (授权域名)：</strong><br />
                    在 Firebase Console ➔ <strong>Authentication</strong> ➔ <strong>Settings</strong> ➔ <strong>Authorized domains</strong> 下，确保将当前所在的域名 <span className="font-mono bg-zinc-100 px-1 py-0.5 rounded text-zinc-800 font-bold">{window.location.hostname}</span> 与 <span className="font-mono bg-zinc-100 px-1 py-0.5 rounded text-zinc-800 font-bold">ais-pre-qv6cbjsvnatdqixps5cced-1001959589862.asia-southeast1.run.app</span> 添加进去。
                  </li>
                </ol>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-100">
              <button
                onClick={() => {
                  setFirestoreError(null);
                  setAuthLoading(true);
                  // Quick reload trick for profile watcher
                  const currentFbUser = firebaseUser;
                  setFirebaseUser(null);
                  setTimeout(() => {
                    setFirebaseUser(currentFbUser);
                  }, 100);
                }}
                className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl text-xs transition-all shadow-sm shadow-indigo-600/15 flex items-center justify-center gap-2 cursor-pointer"
              >
                🔄 重新尝试连接
              </button>
              
              <button
                onClick={() => {
                  // Bypass with elegant local sandbox mock user
                  const mockDevUser: AppUser = {
                    firebaseUid: firebaseUser?.uid || 'mock-admin-uid',
                    email: firebaseUser?.email || 'zhoyilee@gmail.com',
                    username: firebaseUser?.displayName || '特邀体验官 (本地沙盒)',
                    birthday: '2026-06-22',
                    avatar: firebaseUser?.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
                    role: (firebaseUser?.email || '').toLowerCase().trim() === 'zhoyilee@gmail.com' ? 'owner' : 'reader',
                    createdAt: new Date().toISOString()
                  };
                  setUser(mockDevUser);
                  setFirestoreError(null);
                  setProfileLoading(false);
                  setAuthLoading(false);
                  setRoute('home');
                }}
                className="flex-1 py-3 px-4 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-2xl text-xs transition-all border border-emerald-100/60 flex items-center justify-center gap-2 cursor-pointer"
              >
                🎮 本地沙盒试用模式 ➔
              </button>
            </div>
            
            <p className="text-center text-[10px] text-gray-400">
              💡 提示：本地沙盒模式不依赖任何数据库，您可以直接进入浏览、测试和操作。
            </p>
          </div>
        </div>
      );
    }

    if (authLoading || profileLoading) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center" id="app-loading-screen">
          <Loader2 className="h-9 w-9 animate-spin text-indigo-600 mb-4" />
          <p className="text-sm font-medium text-gray-500">正在进入私密阅读专栏，请稍候...</p>
        </div>
      );
    }

    // Determine if user requires onboarding setup
    const needsOnboarding = user && user.onboarded !== true;

    if (user && user.status === 'frozen') {
      return (
        <div className="max-w-xl mx-auto mt-20 p-8 text-center bg-white rounded-3xl border border-red-100 shadow-xl animate-fade-in">
          <div className="h-14 w-14 bg-red-50 text-red-650 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-bold font-display text-gray-900">您的账户已被暂时冻结</h2>
          <p className="text-gray-500 mt-3 text-sm leading-relaxed">
            经平台管理员核实，您的账号由于涉嫌违反社区作品交流守则或遭受多位读者举报，现已被执行冻结封禁。
            <br />
            如有疑问，请点击下方退出账号，或联系站长进行申诉处理。
          </p>
          <button
            onClick={() => handleLogout()}
            className="mt-8 px-5 py-2.5 bg-gray-100 hover:bg-gray-150 text-gray-700 font-bold rounded-xl text-xs transition-all cursor-pointer"
          >
            退出账号
          </button>
        </div>
      );
    }

    if (needsOnboarding) {
      return <Onboarding user={user} onComplete={() => setRoute('home')} />;
    }

    switch (route) {
      case 'login':
        return <Login onNavigate={setRoute} onSuccess={handleAuthSuccess} />;
      case 'register':
        return <Register onNavigate={setRoute} onSuccess={handleAuthSuccess} />;
      case 'home':
        return <Home user={user} onNavigate={setRoute} onSelectPost={handleSelectPost} onSelectAuthor={handleSelectAuthor} />;
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
            onStartChat={(authorId) => {
              setActiveMessageUserId(authorId);
              setRoute('messages');
            }}
            onSelectAuthor={handleSelectAuthor}
          />
        );
      case 'author-profile':
        return (
          <AuthorProfile
            authorId={selectedAuthorId || ''}
            user={user}
            onNavigate={setRoute}
            onSelectPost={handleSelectPost}
            onStartChat={(authorId) => {
              setActiveMessageUserId(authorId);
              setRoute('messages');
            }}
            onBack={() => setRoute(prevRoute || 'home')}
          />
        );
      case 'admin':
        return <Admin user={user} onNavigate={setRoute} onSelectPost={handleSelectPost} />;
      case 'profile':
        return <Profile user={user} onNavigate={setRoute} onSelectPost={handleSelectPost} onEditPost={handleEditPost} onSelectAuthor={handleSelectAuthor} />;
      case 'settings':
        return <Settings user={user} onBack={() => setRoute('home')} />;
      case 'bookshelf':
        return <Bookshelf user={user} onNavigate={setRoute} onSelectPost={handleSelectPost} />;
      case 'messages':
        return <Messages user={user} onNavigate={setRoute} recipientId={activeMessageUserId} />;
      default:
        return <Home user={user} onNavigate={setRoute} onSelectPost={handleSelectPost} onSelectAuthor={handleSelectAuthor} />;
    }
  };

  const isAuthPage = route === 'login' || route === 'register';
  const needsOnboarding = user && user.onboarded !== true;

  return (
    <div className="min-h-screen flex flex-col bg-[#fafafa]">
      {/* Dynamic Header / Navigation Bar */}
      {!isAuthPage && user && !needsOnboarding && (
        <>
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
                className={`hidden md:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${route === 'home' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'}`}
              >
                <Compass className="h-4 w-4" />
                <span>专栏推荐</span>
              </button>

              <button
                onClick={() => setRoute('bookshelf')}
                className={`hidden md:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${route === 'bookshelf' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'}`}
              >
                <Bookmark className="h-4 w-4" />
                <span>我的书架</span>
              </button>

              <button
                onClick={() => {
                  setActiveMessageUserId(null); // Clear any preselected recipient on direct click
                  setRoute('messages');
                }}
                className={`hidden md:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${route === 'messages' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'}`}
              >
                <MessageSquare className="h-4 w-4" />
                <span>私人来信</span>
              </button>

              {user.role === 'owner' && (
                <button
                  onClick={() => setRoute('admin')}
                  className={`hidden md:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${route === 'admin' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'}`}
                >
                  <Shield className="h-4 w-4" />
                  <span>管理后台</span>
                </button>
              )}

              <button
                onClick={() => setRoute('profile')}
                className={`hidden md:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${route === 'profile' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'}`}
              >
                <User className="h-4 w-4" />
                <span>个人中心</span>
              </button>

              {/* Notification Bell with Badge */}
              <div className="relative">
                <button
                  onClick={() => {
                    setShowNotifications(!showNotifications);
                    if ('Notification' in window && window.Notification.permission === 'default') {
                      window.Notification.requestPermission();
                    }
                  }}
                  title="通知中心"
                  className={`p-2 rounded-xl transition-all relative ${showNotifications ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`}
                >
                  {notifications.some(n => !n.read) ? (
                    <BellRing className="h-4.5 w-4.5 text-indigo-600 animate-pulse" />
                  ) : (
                    <Bell className="h-4.5 w-4.5" />
                  )}
                  {notifications.filter(n => !n.read).length > 0 && (
                    <span className="absolute -top-1 -right-1 bg-rose-600 text-white font-bold text-[9px] min-w-4 h-4 rounded-full flex items-center justify-center px-1 border border-white">
                      {notifications.filter(n => !n.read).length}
                    </span>
                  )}
                </button>

                {/* Notifications Dropdown Panel */}
                <AnimatePresence>
                  {showNotifications && (
                    <>
                      {/* Click outside overlay */}
                      <div className="fixed inset-0 z-40 cursor-default" onClick={() => setShowNotifications(false)} />
                      
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl border border-gray-150/70 shadow-xl z-50 overflow-hidden flex flex-col max-h-[480px]"
                      >
                        {/* Header */}
                        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-zinc-50/50">
                          <h4 className="font-display font-bold text-gray-900 text-sm flex items-center gap-1.5">
                            通知中心
                            {notifications.filter(n => !n.read).length > 0 && (
                              <span className="bg-rose-50 text-rose-700 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                                {notifications.filter(n => !n.read).length}条未读
                              </span>
                            )}
                          </h4>
                          {notifications.filter(n => !n.read).length > 0 && (
                            <button
                              onClick={handleMarkAllAsRead}
                              className="text-xs text-indigo-600 hover:text-indigo-700 font-bold hover:underline"
                            >
                              全部已读
                            </button>
                          )}
                        </div>

                        {/* List */}
                        <div className="overflow-y-auto divide-y divide-gray-50 flex-grow scrollbar-thin">
                          {notifications.length === 0 ? (
                            <div className="py-12 px-4 text-center">
                              <Bell className="h-8 w-8 text-gray-350 mx-auto mb-2" />
                              <p className="text-xs font-semibold text-gray-400">暂无任何通知</p>
                              <p className="text-[10px] text-gray-300 mt-1">关注作者或收到点赞时会在此通知</p>
                            </div>
                          ) : (
                            notifications.map((notif) => (
                              <div
                                key={notif.id}
                                onClick={() => {
                                  handleMarkAsRead(notif.id);
                                  if (notif.postId) {
                                    handleSelectPost(notif.postId);
                                  }
                                  setShowNotifications(false);
                                }}
                                className={`p-3.5 flex gap-3 transition-colors cursor-pointer text-left ${notif.read ? 'bg-white hover:bg-zinc-50/60' : 'bg-indigo-50/20 hover:bg-indigo-50/45 border-l-2 border-indigo-600'}`}
                              >
                                {notif.senderAvatar ? (
                                  <img
                                    src={notif.senderAvatar}
                                    alt="Avatar"
                                    referrerPolicy="no-referrer"
                                    className="h-8 w-8 rounded-full object-cover shrink-0 border border-zinc-100"
                                  />
                                ) : (
                                  <div className="h-8 w-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs shrink-0">
                                    {notif.senderName?.slice(0, 1) || '系'}
                                  </div>
                                )}
                                
                                <div className="flex-1 min-w-0 space-y-1">
                                  <div className="flex items-center justify-between gap-1.5">
                                    <span className="font-bold text-[11px] text-gray-800 truncate">
                                      {notif.senderName}
                                    </span>
                                    <span className="text-[9px] text-gray-400 font-medium shrink-0 font-mono">
                                      {new Date(notif.createdAt).toLocaleDateString()}
                                    </span>
                                  </div>
                                  <p className="text-xs font-semibold text-gray-900 leading-snug">
                                    {notif.title}
                                  </p>
                                  <p className="text-[11px] text-gray-500 leading-relaxed font-medium break-words">
                                    {notif.body}
                                  </p>
                                </div>

                                <div className="flex flex-col justify-between items-end shrink-0 gap-2">
                                  <button
                                    onClick={(e) => handleDeleteNotification(notif.id, e)}
                                    className="p-1 rounded text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                    title="删除此通知"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                  {!notif.read && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleMarkAsRead(notif.id);
                                      }}
                                      className="p-1 rounded text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                                      title="设为已读"
                                    >
                                      <Check className="h-3 w-3" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))
                          )}
                        </div>

                        {/* Footer info explaining browser pushes */}
                        <div className="p-3 border-t border-gray-100 bg-zinc-50/40 text-[10px] text-gray-400 flex items-center justify-between font-medium">
                          <span>🔔 开启浏览器桌面通知，即使离开页面也能收到推送。</span>
                          <button
                            onClick={() => {
                              if ('Notification' in window) {
                                window.Notification.requestPermission().then(permission => {
                                  alert(permission === 'granted' ? '桌面通知授权成功！' : '桌面通知授权已被拒绝，请在浏览器设置中开启。');
                                });
                              }
                            }}
                            className="text-indigo-600 font-bold hover:underline font-display"
                          >
                            立即开启
                          </button>
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>

              <button
                onClick={() => setRoute('settings')}
                title="个人资料设置"
                className={`hidden md:inline-flex p-2 rounded-xl transition-all ${route === 'settings' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`}
              >
                <SettingsIcon className="h-4.5 w-4.5" />
              </button>

              <div className="hidden md:block h-4 w-px bg-gray-200 mx-1 sm:mx-2"></div>

              <button
                onClick={() => setShowLogoutDialog(true)}
                title="登出当前账户"
                className="hidden md:inline-flex p-2 rounded-xl text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
                id="logout-button-nav"
              >
                <LogOut className="h-4.5 w-4.5" />
              </button>

              {/* Hamburger Menu Trigger for Mobile */}
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                title="打开菜单"
                className="inline-flex md:hidden p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-all cursor-pointer"
              >
                <Menu className="h-4.5 w-4.5" />
              </button>
            </nav>
          </div>
        </header>

        {/* Mobile Slide-Out Navigation Drawer */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsMobileMenuOpen(false)}
                className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs md:hidden"
              />

              {/* Drawer panel */}
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                className="fixed top-0 right-0 bottom-0 z-50 w-72 max-w-[85vw] bg-white shadow-2xl md:hidden border-l border-gray-100 flex flex-col text-left"
              >
                {/* Header inside drawer */}
                <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-zinc-50/50">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-sm">
                      秘
                    </div>
                    <span className="font-display font-extrabold text-sm text-gray-900">
                      功能导航
                    </span>
                  </div>
                  <button
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all cursor-pointer"
                  >
                    <X className="h-4.5 w-4.5" />
                  </button>
                </div>

                {/* Content Links inside drawer */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  <button
                    onClick={() => { setRoute('home'); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${route === 'home' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-600 hover:bg-gray-50'}`}
                  >
                    <Compass className="h-4.5 w-4.5" />
                    <span>专栏推荐</span>
                  </button>

                  <button
                    onClick={() => { setRoute('bookshelf'); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${route === 'bookshelf' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-600 hover:bg-gray-50'}`}
                  >
                    <Bookmark className="h-4.5 w-4.5" />
                    <span>我的书架</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveMessageUserId(null);
                      setRoute('messages');
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${route === 'messages' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-600 hover:bg-gray-50'}`}
                  >
                    <MessageSquare className="h-4.5 w-4.5" />
                    <span>私人来信</span>
                  </button>

                  {user.role === 'owner' && (
                    <button
                      onClick={() => { setRoute('admin'); }}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${route === 'admin' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                      <Shield className="h-4.5 w-4.5" />
                      <span>管理后台</span>
                    </button>
                  )}

                  <button
                    onClick={() => { setRoute('profile'); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${route === 'profile' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-600 hover:bg-gray-50'}`}
                  >
                    <User className="h-4.5 w-4.5" />
                    <span>个人中心</span>
                  </button>

                  <div className="h-px bg-gray-100 my-3"></div>

                  <button
                    onClick={() => { setRoute('settings'); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${route === 'settings' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-600 hover:bg-gray-50'}`}
                  >
                    <SettingsIcon className="h-4.5 w-4.5" />
                    <span>个人资料设置</span>
                  </button>

                  <button
                    onClick={() => { setShowLogoutDialog(true); setIsMobileMenuOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50/50 transition-all cursor-pointer text-left"
                  >
                    <LogOut className="h-4.5 w-4.5" />
                    <span>安全注销账户</span>
                  </button>
                </div>

                {/* Profile brief footer inside drawer */}
                <div className="p-4 border-t border-gray-100 bg-zinc-50/50 flex items-center gap-3">
                  {user.avatar ? (
                    <img src={user.avatar} className="h-9 w-9 rounded-full object-cover border border-zinc-250 shadow-3xs" alt="Avatar" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="h-9 w-9 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs shrink-0">
                      {user.username?.slice(0, 1) || 'U'}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-gray-800 truncate leading-tight">{user.username}</p>
                    <p className="text-[10px] text-gray-400 font-medium truncate mt-0.5">{user.email || '未绑定邮箱'}</p>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
        </>
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
            <span className="font-medium">© 2026 私密阅读专栏. 阮梅230 刻晴95.</span>
            <div className="flex items-center gap-3 font-semibold text-gray-500">
              <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-mono">Firebase Online</span>
              <button onClick={() => setRoute('settings')} className="hover:text-indigo-600 hover:underline">
                个人资料设置
              </button>
            </div>
          </div>
        </footer>
      )}

      {/* 安全注销确认模态框 */}
      <AnimatePresence>
        {showLogoutDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs" id="logout-confirm-modal">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-gray-100/60"
            >
              <div className="flex items-center gap-3 text-rose-600 mb-3" id="logout-modal-title">
                <div className="p-2.5 bg-rose-50 rounded-xl">
                  <LogOut className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">安全注销账号</h3>
              </div>
              
              <p className="text-sm text-gray-500 mb-6 leading-relaxed" id="logout-modal-desc">
                您确定要安全退出当前阅读账号吗？此操作将妥善关闭当前的 Firebase 回话并跳转回至登录界面。
              </p>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowLogoutDialog(false)}
                  className="flex-1 py-2.5 bg-gray-50 hover:bg-gray-100 text-gray-600 font-semibold rounded-xl text-xs transition-all cursor-pointer"
                  id="cancel-logout-btn"
                >
                  取消
                </button>
                <button
                  onClick={() => {
                    setShowLogoutDialog(false);
                    handleLogout();
                  }}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl text-xs transition-all cursor-pointer shadow-sm shadow-rose-600/10"
                  id="confirm-logout-btn"
                >
                  确认登出
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
