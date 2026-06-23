import React, { useState, useEffect } from 'react';
import { collection, updateDoc, doc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { AppUser, Post } from '../types';
import { Users, BookOpen, ShieldAlert, KeyRound, Trash2, Calendar, Shield, ArrowLeft, Loader2, Edit3 } from 'lucide-react';

interface AdminProps {
  user: AppUser | null;
  onNavigate: (route: string) => void;
  onSelectPost: (postId: string) => void;
}

export default function Admin({ user, onNavigate, onSelectPost }: AdminProps) {
  const [usersList, setUsersList] = useState<AppUser[]>([]);
  const [postsList, setPostsList] = useState<Post[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [activeTab, setActiveTab] = useState<'users' | 'posts'>('users');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [dialogLoading, setDialogLoading] = useState(false);
  const [adminDialog, setAdminDialog] = useState<{
    show: boolean;
    type: 'confirm_role' | 'confirm_delete' | 'info' | 'success' | 'error';
    title: string;
    message: string;
    onConfirm?: () => Promise<void> | void;
  }>({ show: false, type: 'info', title: '', message: '' });

  // Verify access: Owner role only
  const isOwner = user && (user.role === 'owner' || user.email === 'zhoyilee@gmail.com');

  // 1. Listen or fetch users list safely
  useEffect(() => {
    if (!isOwner) return;

    setLoadingUsers(true);
    const usersRef = collection(db, 'users');
    
    const unsubscribe = onSnapshot(usersRef, (snapshot) => {
      const loadedUsers = snapshot.docs.map((d) => ({
        ...d.data(),
      })) as AppUser[];
      // Sort users by registration date descending
      loadedUsers.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setUsersList(loadedUsers);
      setLoadingUsers(false);
    }, (error) => {
      console.error("Failed to load users:", error);
      handleFirestoreError(error, OperationType.LIST, 'users');
      setLoadingUsers(false);
    });

    return () => unsubscribe();
  }, [isOwner, refreshTrigger]);

  // 2. Fetch posts list safely (including drafts!)
  useEffect(() => {
    if (!isOwner) return;

    setLoadingPosts(true);
    const postsRef = collection(db, 'posts');

    const unsubscribe = onSnapshot(postsRef, (snapshot) => {
      const loadedPosts = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Post[];
      loadedPosts.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setPostsList(loadedPosts);
      setLoadingPosts(false);
    }, (error) => {
      console.error("Failed to load posts inside admin panel:", error);
      handleFirestoreError(error, OperationType.LIST, 'posts');
      setLoadingPosts(false);
    });

    return () => unsubscribe();
  }, [isOwner, refreshTrigger]);

  const handleRoleToggle = async (targetUser: AppUser) => {
    if (targetUser.email === 'zhoyilee@gmail.com') {
      setAdminDialog({
        show: true,
        type: 'info',
        title: "无法修改权限",
        message: "站长主管理员 (Bootstrap Owner) 的权限属于终生默认拥有，不提供降级或修改。"
      });
      return;
    }

    const nextRole = targetUser.role === 'reader' ? 'author' : 'reader';
    
    setAdminDialog({
      show: true,
      type: 'confirm_role',
      title: "改变用户权限",
      message: `确定要将用户「${targetUser.username}」的权限从 ${targetUser.role} 修改为 ${nextRole} 吗？\n这将实时同步他的前台访问和发文撰写权力。`,
      onConfirm: async () => {
        setDialogLoading(true);
        try {
          const userRef = doc(db, 'users', targetUser.firebaseUid);
          try {
            await updateDoc(userRef, { role: nextRole });
          } catch (fError) {
            handleFirestoreError(fError, OperationType.UPDATE, `users/${targetUser.firebaseUid}`);
          }
          setAdminDialog({
            show: true,
            type: 'success',
            title: "修改成功",
            message: `用户「${targetUser.username}」已成功配置为 ${nextRole} 级别角色。`
          });
        } catch (err: any) {
          console.error("Failed to modify role:", err);
          setAdminDialog({
            show: true,
            type: 'error',
            title: "修改失败",
            message: "操作过程中报错：" + (err.message || String(err))
          });
        } finally {
          setDialogLoading(false);
        }
      }
    });
  };

  const handlePostDelete = async (post: Post) => {
    setAdminDialog({
      show: true,
      type: 'confirm_delete',
      title: "确认删除博文",
      message: `确定要永久删除博文「${post.title}」（作者: ${post.authorName}）吗？删除后在数据库里将永久不可恢复。`,
      onConfirm: async () => {
        setDialogLoading(true);
        try {
          const postRef = doc(db, 'posts', post.id);
          try {
            await deleteDoc(postRef);
          } catch (fError) {
            handleFirestoreError(fError, OperationType.DELETE, `posts/${post.id}`);
          }
          setAdminDialog({
            show: true,
            type: 'success',
            title: "文章已删除",
            message: "该文章已经在数据库及前端列表中彻底清空。"
          });
        } catch (err: any) {
          console.error("Failed to delete post from panel:", err);
          setAdminDialog({
            show: true,
            type: 'error',
            title: "删除失败",
            message: "操作过程中报错：" + (err.message || String(err))
          });
        } finally {
          setDialogLoading(false);
        }
      }
    });
  };

  // Safe Guard checks
  if (!isOwner) {
    return (
      <div className="max-w-xl mx-auto mt-20 p-8 text-center bg-white rounded-2xl border border-gray-100 shadow-sm">
        <ShieldAlert className="h-12 w-12 text-rose-500 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-gray-900 font-display">拒绝访问</h3>
        <p className="text-gray-500 mt-2 text-sm">此后台管理页面仅限本站创办人 (Owner) 访问！非特定管理者无法查看机密信息。</p>
        <button
          onClick={() => onNavigate('home')}
          className="mt-6 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-500 transition-colors shadow-sm"
        >
          返回社区首页
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Title Segment */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('home')}
            className="p-2 rounded-lg bg-white border border-gray-100 text-gray-500 hover:text-gray-700 transition-colors shadow-sm"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-2xl font-bold font-display text-gray-900 flex items-center gap-2">
              <Shield className="h-6 w-6 text-indigo-600" />
              后台管理系统 (Owner Mode)
            </h1>
            <p className="text-xs text-gray-500">
              审批作者资质、查看用户档案、编辑或下架任意博文。
            </p>
          </div>
        </div>

        {/* Tab filters */}
        <div className="flex bg-gray-100 p-1 rounded-xl shadow-inner max-w-xs shrink-0 self-start md:self-auto">
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${activeTab === 'users' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <Users className="h-3.5 w-3.5" />
            用户管理 ({usersList.length})
          </button>
          <button
            onClick={() => setActiveTab('posts')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${activeTab === 'posts' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <BookOpen className="h-3.5 w-3.5" />
            文章总览 ({postsList.length})
          </button>
        </div>
      </div>

      {loadingUsers || loadingPosts ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white border border-gray-100 rounded-3xl">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          <span className="text-xs text-gray-500 mt-4 font-semibold">正在同步管理数据...</span>
        </div>
      ) : activeTab === 'users' ? (
        /* Users Data Table Section */
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-5 border-b border-gray-100">
            <h3 className="font-display font-semibold text-gray-900">注册读者 & 本站作者列表</h3>
            <p className="text-xs text-gray-400 mt-1">
              可直接在列表操作中切换用户的角色 (Reader 读者 与 Author 作者)。
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/75 border-b border-gray-100 text-xs text-gray-500 font-bold uppercase tracking-wider">
                  <th className="py-4 px-6">用户名 & 头像</th>
                  <th className="py-4 px-6">电子邮箱</th>
                  <th className="py-4 px-6">当前角色</th>
                  <th className="py-4 px-6">注册日期</th>
                  <th className="py-4 px-6 text-right">角色变动操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {usersList.map((target) => (
                  <tr key={target.firebaseUid} className="hover:bg-gray-50/50 transition-colors">
                    <td className="py-4 px-6 flex items-center gap-3">
                      <img
                        src={target.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'}
                        alt={target.username}
                        className="h-9 w-9 rounded-full object-cover border border-gray-200"
                      />
                      <span className="font-semibold text-gray-900">{target.username}</span>
                    </td>
                    <td className="py-4 px-6 text-gray-600">{target.email}</td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
                        target.role === 'owner' ? 'bg-indigo-100 text-indigo-800' :
                        target.role === 'author' ? 'bg-emerald-100 text-emerald-800' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {target.role === 'owner' ? '创办者/超级管理员' :
                         target.role === 'author' ? '签约作家' : '普通读者'}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-gray-400 font-mono text-xs">
                      {new Date(target.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-4 px-6 text-right">
                      {target.role === 'owner' ? (
                        <span className="text-xs text-gray-400 italic">锁定中</span>
                      ) : (
                        <button
                          onClick={() => handleRoleToggle(target)}
                          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all shadow-sm ${
                            target.role === 'reader' 
                              ? 'bg-indigo-600 border-indigo-700 hover:bg-indigo-550 text-white' 
                              : 'bg-white border-gray-200 hover:border-gray-300 text-gray-700'
                          }`}
                        >
                          <KeyRound className="h-3 w-3" />
                          {target.role === 'reader' ? '晋升授权作者' : '解除作者授权'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Posts Admin Table Section */
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-5 border-b border-gray-100">
            <h3 className="font-display font-semibold text-gray-900">全站博文 & 草稿管理列表</h3>
            <p className="text-xs text-gray-400 mt-1">
              查看或永久删除站内存在的任何文章。
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/75 border-b border-gray-100 text-xs text-gray-500 font-bold uppercase tracking-wider">
                  <th className="py-4 px-6">配图 & 博文标题</th>
                  <th className="py-4 px-6">创作者</th>
                  <th className="py-4 px-6">发布状态</th>
                  <th className="py-4 px-6">点赞数</th>
                  <th className="py-4 px-6">创建时间</th>
                  <th className="py-4 px-6 text-right">管理操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {postsList.map((post) => (
                  <tr key={post.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <img
                          src={post.images?.[0] || 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=150&q=80'}
                          alt={post.title}
                          className="h-10 w-16 rounded object-cover border border-gray-200"
                        />
                        <button
                          onClick={() => onSelectPost(post.id)}
                          className="font-semibold text-gray-900 hover:text-indigo-650 hover:underline text-left outline-none line-clamp-1"
                        >
                          {post.title}
                        </button>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-gray-600 font-medium">{post.authorName}</td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold ${
                        post.status === 'published' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {post.status === 'published' ? '公开文案' : '草稿备忘'}
                      </span>
                    </td>
                    <td className="py-4 px-6 font-semibold text-gray-700">{post.likes || 0}</td>
                    <td className="py-4 px-6 text-gray-400 font-mono text-xs">
                      {new Date(post.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button
                        onClick={() => handlePostDelete(post)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-50 border border-rose-100 text-rose-600 hover:bg-rose-100 transition-all font-semibold text-xs shadow-sm"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        下架删除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Dynamic Unified Admin Dialog Overlay */}
      {adminDialog.show && (
        <div className="fixed inset-0 bg-zinc-950/45 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in" id="admin-unified-dialog">
          <div className="bg-white rounded-3xl max-w-md w-full border border-gray-100 p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-2xl ${
                adminDialog.type === 'confirm_delete' || adminDialog.type === 'error'
                  ? 'bg-rose-50 text-rose-600'
                  : adminDialog.type === 'success' 
                    ? 'bg-emerald-50 text-emerald-600'
                    : adminDialog.type === 'confirm_role'
                      ? 'bg-indigo-50 text-indigo-600'
                      : 'bg-amber-50 text-amber-600'
              }`}>
                {adminDialog.type === 'confirm_delete' && <Trash2 className="h-6 w-6" />}
                {adminDialog.type === 'error' && <ShieldAlert className="h-6 w-6" />}
                {adminDialog.type === 'success' && <Shield className="h-6 w-6 animate-pulse" />}
                {adminDialog.type === 'confirm_role' && <KeyRound className="h-6 w-6" />}
                {adminDialog.type === 'info' && <ShieldAlert className="h-6 w-6" />}
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-gray-900 font-display">{adminDialog.title}</h3>
                <p className="text-[10px] text-gray-400 uppercase font-mono font-bold tracking-wider">
                  {adminDialog.type.toUpperCase()}
                </p>
              </div>
            </div>

            <p className="text-xs leading-relaxed text-gray-400 whitespace-pre-wrap">
              {adminDialog.message}
            </p>

            <div className="flex gap-3 pt-2">
              {/* Only show 'Cancel' for confirmation dialog types */}
              {(adminDialog.type === 'confirm_role' || adminDialog.type === 'confirm_delete') ? (
                <>
                  <button
                    type="button"
                    disabled={dialogLoading}
                    onClick={() => setAdminDialog({ ...adminDialog, show: false })}
                    className="flex-1 py-3 px-4 bg-gray-50 hover:bg-gray-100 text-gray-700 font-bold rounded-2xl text-xs transition-colors border border-gray-100 flex items-center justify-center cursor-pointer disabled:opacity-50"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    disabled={dialogLoading}
                    onClick={async () => {
                      if (adminDialog.onConfirm) {
                        await adminDialog.onConfirm();
                      }
                    }}
                    className={`flex-1 py-3 px-4 font-bold rounded-2xl text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-md disabled:opacity-50 ${
                      adminDialog.type === 'confirm_delete'
                        ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/10'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/10'
                    }`}
                  >
                    {dialogLoading ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        正在执行...
                      </>
                    ) : (
                      <>
                        {adminDialog.type === 'confirm_delete' ? <Trash2 className="h-3.5 w-3.5" /> : <KeyRound className="h-3.5 w-3.5" />}
                        确认执行
                      </>
                    )}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setAdminDialog({ ...adminDialog, show: false });
                    setRefreshTrigger(prev => prev + 1); // Auto reload list state
                  }}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl text-xs transition-colors shadow-md shadow-indigo-600/10 flex items-center justify-center cursor-pointer"
                >
                  我知道了
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
