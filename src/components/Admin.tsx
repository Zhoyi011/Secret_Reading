import React, { useState, useEffect } from 'react';
import { collection, updateDoc, doc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { AppUser, Post } from '../types';
import { Users, BookOpen, ShieldAlert, KeyRound, Trash2, Calendar, Shield, ArrowLeft, Loader2, Edit3 } from 'lucide-react';
import { isSandbox, getMockUsers, updateMockUserRole, getMockPosts, deleteMockPost } from '../sandboxStorage';

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

  // Verify access: Owner role only
  const isOwner = user && (user.role === 'owner' || user.email === 'zhoyilee@gmail.com');

  // 1. Listen or fetch users list safely
  useEffect(() => {
    if (!isOwner) return;

    if (isSandbox()) {
      setLoadingUsers(true);
      const loadedUsers = getMockUsers();
      loadedUsers.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setUsersList(loadedUsers);
      setLoadingUsers(false);
      return;
    }

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

    if (isSandbox()) {
      setLoadingPosts(true);
      const loadedPosts = getMockPosts();
      loadedPosts.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setPostsList(loadedPosts);
      setLoadingPosts(false);
      return;
    }

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
      alert("站长主管理员 (Bootstrap Owner) 的权限不能被降级或修改");
      return;
    }

    const nextRole = targetUser.role === 'reader' ? 'author' : 'reader';
    if (!confirm(`确定要将用户「${targetUser.username}」的权限从 ${targetUser.role} 修改为 ${nextRole} 吗？`)) {
      return;
    }

    try {
      if (isSandbox()) {
        updateMockUserRole(targetUser.firebaseUid, nextRole);
        setRefreshTrigger((prev) => prev + 1);
        alert("权限更新成功 (沙盒模拟)！");
        return;
      }

      const userRef = doc(db, 'users', targetUser.firebaseUid);
      
      try {
        await updateDoc(userRef, { role: nextRole });
      } catch (fError) {
        handleFirestoreError(fError, OperationType.UPDATE, `users/${targetUser.firebaseUid}`);
      }

      alert("权限更新成功！");
    } catch (err: any) {
      console.error("Failed to modify role:", err);
      alert("修改失败: " + err.message);
    }
  };

  const handlePostDelete = async (post: Post) => {
    if (!confirm(`确定要永久删除博文「${post.title}」（作者: ${post.authorName}）吗？删除后不可恢复。`)) {
      return;
    }

    try {
      if (isSandbox()) {
        deleteMockPost(post.id);
        setRefreshTrigger((prev) => prev + 1);
        alert("文章已被成功删除 (沙盒环境)");
        return;
      }

      const postRef = doc(db, 'posts', post.id);
      
      try {
        await deleteDoc(postRef);
      } catch (fError) {
        handleFirestoreError(fError, OperationType.DELETE, `posts/${post.id}`);
      }

      alert("文章已被成功删除");
    } catch (err: any) {
      console.error("Failed to delete post from panel:", err);
      alert("删除失败: " + err.message);
    }
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
                  <th className="py-4 px-6">生日</th>
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
                    <td className="py-4 px-6 text-gray-500">{target.birthday || '未设置'}</td>
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
    </div>
  );
}
