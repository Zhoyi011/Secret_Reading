import React, { useState, useEffect } from 'react';
import { collection, updateDoc, doc, deleteDoc, onSnapshot, addDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { AppUser, Post, AuthorApplication, Report } from '../types';
import { Users, BookOpen, ShieldAlert, KeyRound, Trash2, Calendar, Shield, ArrowLeft, Loader2, Edit3, Check, X, FileText, AlertTriangle } from 'lucide-react';
import ImageWrapper from './ImageWrapper';

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
  const [loadingApps, setLoadingApps] = useState(true);
  const [loadingReports, setLoadingReports] = useState(true);
  const [activeTab, setActiveTab] = useState<'users' | 'posts' | 'applications' | 'reports'>('users');
  const [applicationsList, setApplicationsList] = useState<AuthorApplication[]>([]);
  const [reportsList, setReportsList] = useState<Report[]>([]);
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

  // 3. Listen to author applications safely
  useEffect(() => {
    if (!isOwner) return;

    setLoadingApps(true);
    const appsRef = collection(db, 'author_applications');

    const unsubscribe = onSnapshot(appsRef, (snapshot) => {
      const loadedApps = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as AuthorApplication[];
      loadedApps.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setApplicationsList(loadedApps);
      setLoadingApps(false);
    }, (error) => {
      console.error("Failed to load author applications:", error);
      setLoadingApps(false);
    });

    return () => unsubscribe();
  }, [isOwner, refreshTrigger]);

  // 4. Listen to reports safely
  useEffect(() => {
    if (!isOwner) return;

    setLoadingReports(true);
    const reportsRef = collection(db, 'reports');

    const unsubscribe = onSnapshot(reportsRef, (snapshot) => {
      const loadedReports = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Report[];
      loadedReports.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setReportsList(loadedReports);
      setLoadingReports(false);
    }, (error) => {
      console.error("Failed to load reports:", error);
      setLoadingReports(false);
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

  const handleFreezeToggle = async (targetUser: AppUser) => {
    if (targetUser.email === 'zhoyilee@gmail.com') {
      setAdminDialog({
        show: true,
        type: 'info',
        title: "无法封禁本站站长",
        message: "站长主管理员账号拥有系统安全特权，不支持执行账户状态锁定。"
      });
      return;
    }

    const nextStatus = targetUser.status === 'frozen' ? 'active' : 'frozen';

    setAdminDialog({
      show: true,
      type: 'confirm_role',
      title: nextStatus === 'frozen' ? "⚠️ 确认实施账户封禁" : "✅ 确认解除封禁状态",
      message: `您正在请求将用户「${targetUser.username}」的账户状态变更为 [${nextStatus === 'frozen' ? '封禁冻结' : '正常活跃'}]。\n封禁后，该用户登录后将受到强制阻断，无法进行任何阅读与发文创作。`,
      onConfirm: async () => {
        setDialogLoading(true);
        try {
          const userRef = doc(db, 'users', targetUser.firebaseUid);
          await updateDoc(userRef, { status: nextStatus });
          setAdminDialog({
            show: true,
            type: 'success',
            title: "账户状态更新成功",
            message: `用户「${targetUser.username}」已成功配置为 [${nextStatus === 'frozen' ? '封禁/冻结' : '活跃/正常'}] 状态。`
          });
        } catch (err: any) {
          console.error("Failed to toggle freeze status:", err);
          setAdminDialog({
            show: true,
            type: 'error',
            title: "状态变更失败",
            message: "操作过程中报错: " + (err.message || String(err))
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

  const handleApproveApplication = async (app: AuthorApplication) => {
    setAdminDialog({
      show: true,
      type: 'confirm_role',
      title: "批准作者入驻申请",
      message: `确定要批准用户「${app.username}」的专栏作者入驻申请吗？\n批准后其角色将变更为作者，拥有撰写与定时发布等全套创作者权限，且系统会通知他该喜讯。`,
      onConfirm: async () => {
        setDialogLoading(true);
        try {
          const appRef = doc(db, 'author_applications', app.id);
          const userRef = doc(db, 'users', app.userId);

          // 1. Update application status to approved
          await updateDoc(appRef, { status: 'approved' });

          // 2. Update user role to 'author'
          await updateDoc(userRef, { role: 'author' });

          // 3. Create system notification for applicant
          await addDoc(collection(db, 'notifications'), {
            recipientId: app.userId,
            senderId: user?.firebaseUid || 'system',
            senderName: user?.username || '站长',
            senderAvatar: user?.avatar || '',
            type: 'system',
            title: '您的作者申请已通过！🎉',
            body: '恭喜！您的作者资质申请已被站长批准。现在您可以撰写和发表博文，开启您的同人创作专栏了！',
            read: false,
            createdAt: new Date().toISOString()
          });

          setAdminDialog({
            show: true,
            type: 'success',
            title: "入驻申请批准成功",
            message: `已成功将「${app.username}」升级为作者，并发送系统贺信。`
          });
        } catch (err: any) {
          console.error("Failed to approve application:", err);
          setAdminDialog({
            show: true,
            type: 'error',
            title: "批准操作失败",
            message: "操作失败：" + (err.message || String(err))
          });
        } finally {
          setDialogLoading(false);
        }
      }
    });
  };

  const handleRejectApplication = async (app: AuthorApplication) => {
    const rejectReason = prompt("请输入拒绝理由 (拒绝需要理由):");
    if (rejectReason === null) return; // cancelled
    if (!rejectReason.trim()) {
      alert("必须输入拒绝理由，否则无法拒绝。");
      return;
    }

    setAdminDialog({
      show: true,
      type: 'confirm_role',
      title: "拒绝作者入驻申请",
      message: `确定要拒绝用户「${app.username}」的入驻申请吗？\n拒绝理由：${rejectReason}`,
      onConfirm: async () => {
        setDialogLoading(true);
        try {
          const appRef = doc(db, 'author_applications', app.id);

          // 1. Update application status to rejected and set rejectReason
          await updateDoc(appRef, {
            status: 'rejected',
            rejectReason: rejectReason
          });

          // 2. Create system notification for applicant
          await addDoc(collection(db, 'notifications'), {
            recipientId: app.userId,
            senderId: user?.firebaseUid || 'system',
            senderName: user?.username || '站长',
            senderAvatar: user?.avatar || '',
            type: 'system',
            title: '您的作者申请未通过 📨',
            body: `抱歉，您的作者资质入驻申请已被站长拒绝。拒绝原因：${rejectReason}`,
            read: false,
            createdAt: new Date().toISOString()
          });

          setAdminDialog({
            show: true,
            type: 'success',
            title: "申请拒绝成功",
            message: `已拒绝「${app.username}」的入驻申请，并发送系统退信通知。`
          });
        } catch (err: any) {
          console.error("Failed to reject application:", err);
          setAdminDialog({
            show: true,
            type: 'error',
            title: "拒绝操作失败",
            message: "操作失败：" + (err.message || String(err))
          });
        } finally {
          setDialogLoading(false);
        }
      }
    });
  };

  const handleDismissReport = async (report: Report) => {
    setAdminDialog({
      show: true,
      type: 'confirm_role',
      title: "判定举报无效",
      message: `确定要将针对作品《${report.postTitle}》的举报（原因：${report.reason}）判定为「举报无效」吗？\n该操作将修改此举报状态，不影响博文。`,
      onConfirm: async () => {
        setDialogLoading(true);
        try {
          const reportRef = doc(db, 'reports', report.id);
          await updateDoc(reportRef, { status: 'invalid' });

          setAdminDialog({
            show: true,
            type: 'success',
            title: "判定成功",
            message: "已成功将该举报处理为「举报无效」。"
          });
        } catch (err: any) {
          console.error("Failed to dismiss report:", err);
          setAdminDialog({
            show: true,
            type: 'error',
            title: "操作失败",
            message: "操作失败：" + (err.message || String(err))
          });
        } finally {
          setDialogLoading(false);
        }
      }
    });
  };

  const handleResolveAndWarn = async (report: Report) => {
    const matchedPost = postsList.find(p => p.id === report.postId);
    const postTitle = matchedPost?.title || report.postTitle;

    setAdminDialog({
      show: true,
      type: 'confirm_delete',
      title: "删除博文并警告作者",
      message: `确定要针对作品《${postTitle}》执行违规处理吗？\n系统将执行：\n1. 彻底删除该博文\n2. 警告博文作者\n3. 将此举报标记为已处理。`,
      onConfirm: async () => {
        setDialogLoading(true);
        try {
          // 1. Delete the post
          const postRef = doc(db, 'posts', report.postId);
          await deleteDoc(postRef);

          // 2. Warn the author (send notification)
          const authorId = matchedPost?.authorId;
          if (authorId) {
            await addDoc(collection(db, 'notifications'), {
              recipientId: authorId,
              senderId: user?.firebaseUid || 'system',
              senderName: user?.username || '站长',
              senderAvatar: user?.avatar || '',
              type: 'system',
              title: '作品违规下架与警告通知 ⚠️',
              body: `抱歉，您的作品《${postTitle}》因涉嫌“${report.reason}”违规，已被管理员下架删除并通报警告。请严格遵守创作者守则，若再次发布违规作品，您的账号可能会被冻结。`,
              read: false,
              createdAt: new Date().toISOString()
            });
          }

          // 3. Update report status to resolved
          const reportRef = doc(db, 'reports', report.id);
          await updateDoc(reportRef, { status: 'resolved' });

          setAdminDialog({
            show: true,
            type: 'success',
            title: "处理成功",
            message: `已成功下架违规作品《${postTitle}》、警告作者${matchedPost ? `「${matchedPost.authorName}」` : ''}，并将此项举报结案。`
          });
        } catch (err: any) {
          console.error("Failed to resolve report and delete post:", err);
          setAdminDialog({
            show: true,
            type: 'error',
            title: "操作失败",
            message: "操作失败：" + (err.message || String(err))
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
        <div className="flex bg-gray-100 p-1 rounded-xl shadow-inner max-w-md shrink-0 self-start md:self-auto gap-1">
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${activeTab === 'users' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <Users className="h-3.5 w-3.5" />
            用户管理 ({usersList.length})
          </button>
          <button
            onClick={() => setActiveTab('posts')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${activeTab === 'posts' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <BookOpen className="h-3.5 w-3.5" />
            文章总览 ({postsList.length})
          </button>
          <button
            onClick={() => setActiveTab('applications')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${activeTab === 'applications' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <FileText className="h-3.5 w-3.5" />
            申请审核 ({applicationsList.filter(a => a.status === 'pending').length})
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${activeTab === 'reports' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            举报管理 ({reportsList.filter(r => r.status === 'pending').length})
          </button>
        </div>
      </div>

      {loadingUsers || loadingPosts || loadingApps || loadingReports ? (
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

          <div className="hidden md:block overflow-x-auto">
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
                        <span className="text-xs text-gray-400 italic font-semibold">超级管理员（我）</span>
                      ) : (
                        <div className="flex justify-end items-center gap-2">
                          <button
                            onClick={() => handleRoleToggle(target)}
                            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all shadow-sm cursor-pointer ${
                              target.role === 'reader' 
                                ? 'bg-indigo-600 border-indigo-700 hover:bg-indigo-550 text-white' 
                                : 'bg-white border-gray-200 hover:border-gray-300 text-gray-700'
                            }`}
                          >
                            <KeyRound className="h-3 w-3" />
                            {target.role === 'reader' ? '晋升授权作者' : '解除作者授权'}
                          </button>

                          <button
                            onClick={() => handleFreezeToggle(target)}
                            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all shadow-sm cursor-pointer ${
                              target.status === 'frozen'
                                ? 'bg-emerald-50 border-emerald-100 hover:bg-emerald-100 text-emerald-700'
                                : 'bg-rose-50 border-rose-100 hover:bg-rose-100 text-rose-700'
                            }`}
                          >
                            <ShieldAlert className="h-3 w-3" />
                            {target.status === 'frozen' ? '解除封禁' : '封禁账户'}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card Layout */}
          <div className="block md:hidden space-y-4 p-4 bg-gray-50/30">
            {usersList.map((target) => (
              <div key={target.firebaseUid} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <img
                      src={target.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'}
                      alt={target.username}
                      className="h-9 w-9 rounded-full object-cover border border-gray-200"
                    />
                    <div>
                      <h4 className="font-bold text-gray-950 text-sm">{target.username}</h4>
                      <p className="text-[10px] text-gray-400 font-mono">{new Date(target.createdAt).toLocaleDateString()} 注册</p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                    target.role === 'owner' ? 'bg-indigo-100 text-indigo-800' :
                    target.role === 'author' ? 'bg-emerald-100 text-emerald-800' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {target.role === 'owner' ? '管理员' : target.role === 'author' ? '作者' : '读者'}
                  </span>
                </div>
                
                <div className="text-xs text-gray-600 border-t border-gray-100 pt-2.5 flex items-center justify-between gap-2">
                  <span className="truncate max-w-[150px] font-medium">{target.email}</span>
                  <div className="flex flex-wrap gap-2.5">
                    {target.role === 'owner' ? (
                      <span className="text-[11px] text-gray-400 italic font-semibold">超级管理员（我）</span>
                    ) : (
                      <>
                        <button
                          onClick={() => handleRoleToggle(target)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-all shadow-sm cursor-pointer ${
                            target.role === 'reader' 
                              ? 'bg-indigo-600 border-indigo-700 hover:bg-indigo-550 text-white' 
                              : 'bg-white border-gray-200 hover:border-gray-300 text-gray-700'
                          }`}
                        >
                          <KeyRound className="h-3 w-3" />
                          {target.role === 'reader' ? '晋升作者' : '解除授权'}
                        </button>

                        <button
                          onClick={() => handleFreezeToggle(target)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-all shadow-sm cursor-pointer ${
                            target.status === 'frozen'
                              ? 'bg-emerald-50 border-emerald-100 hover:bg-emerald-100 text-emerald-700'
                              : 'bg-rose-50 border-rose-100 hover:bg-rose-100 text-rose-700'
                          }`}
                        >
                          <ShieldAlert className="h-3 w-3" />
                          {target.status === 'frozen' ? '解封' : '封禁'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : activeTab === 'posts' ? (
        /* Posts Admin Table Section */
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-5 border-b border-gray-100">
            <h3 className="font-display font-semibold text-gray-900">全站博文 & 草稿管理列表</h3>
            <p className="text-xs text-gray-400 mt-1">
              查看或永久删除站内存在的任何文章。
            </p>
          </div>

          <div className="hidden md:block overflow-x-auto">
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
                        <div className="h-10 w-16 rounded overflow-hidden border border-gray-200 shrink-0">
                          <ImageWrapper
                            src={post.images?.[0] || 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=150&q=80'}
                            alt={post.title}
                            width={150}
                            isR18={post.isR18}
                            className="w-full h-full object-cover"
                            placeholderClassName="w-full h-full"
                          />
                        </div>
                        <button
                          onClick={() => onSelectPost(post.id)}
                          className="font-semibold text-gray-900 hover:text-indigo-650 hover:underline text-left outline-none line-clamp-1 flex items-center gap-1.5"
                        >
                          {post.isR18 && (
                            <span className="shrink-0 bg-rose-100 text-rose-700 text-[9px] font-extrabold px-1.5 py-0.5 rounded-md uppercase tracking-wider font-mono">
                              R18
                            </span>
                          )}
                          <span>{post.title}</span>
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

          {/* Mobile Card Layout */}
          <div className="block md:hidden space-y-4 p-4 bg-gray-50/30">
            {postsList.map((post) => (
              <div key={post.id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="h-10 w-16 rounded overflow-hidden border border-gray-200 shrink-0">
                      <ImageWrapper
                        src={post.images?.[0] || 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=150&q=80'}
                        alt={post.title}
                        width={150}
                        isR18={post.isR18}
                        className="w-full h-full object-cover"
                        placeholderClassName="w-full h-full"
                      />
                    </div>
                    <div>
                      <button
                        onClick={() => onSelectPost(post.id)}
                        className="font-bold text-gray-950 text-xs text-left hover:underline line-clamp-1 flex items-center gap-1.5"
                      >
                        {post.isR18 && (
                          <span className="shrink-0 bg-rose-100 text-rose-700 text-[9px] font-extrabold px-1.5 py-0.5 rounded-md uppercase tracking-wider font-mono">
                            R18
                          </span>
                        )}
                        <span>{post.title}</span>
                      </button>
                      <p className="text-[10px] text-gray-400 mt-1">
                        作者: <span className="font-semibold text-gray-600">{post.authorName}</span>
                      </p>
                    </div>
                  </div>
                  
                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0 ${
                    post.status === 'published' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {post.status === 'published' ? '公开' : '草稿'}
                  </span>
                </div>
                
                <div className="text-[11px] text-gray-500 border-t border-gray-100 pt-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="font-mono">📅 {new Date(post.createdAt).toLocaleDateString()}</span>
                    <span>❤️ {post.likes || 0} 赞</span>
                  </div>
                  
                  <button
                    onClick={() => handlePostDelete(post)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-50 border border-rose-100 text-rose-600 hover:bg-rose-100 transition-all font-semibold text-[11px] shadow-sm"
                  >
                    <Trash2 className="h-3 w-3" />
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : activeTab === 'applications' ? (
        /* Applications Admin Table Section */
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden text-left font-sans">
          <div className="p-5 border-b border-gray-100">
            <h3 className="font-display font-semibold text-gray-900">作者入驻审批中心</h3>
            <p className="text-xs text-gray-400 mt-1">
              审批站内读者升级为作者的申请。批准申请将会自动变更其角色，并同步发送系统贺信。
            </p>
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/75 border-b border-gray-100 text-xs text-gray-500 font-bold uppercase tracking-wider">
                  <th className="py-4 px-6">申请用户</th>
                  <th className="py-4 px-6">申请理由 (Bio)</th>
                  <th className="py-4 px-6">个人简介/代表作</th>
                  <th className="py-4 px-6">申请状态</th>
                  <th className="py-4 px-6">申请时间</th>
                  <th className="py-4 px-6 text-right">审核操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {applicationsList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-gray-400 italic text-xs">
                      暂无任何作者入驻申请记录
                    </td>
                  </tr>
                ) : (
                  applicationsList.map((app) => (
                    <tr key={app.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-4 px-6">
                        <div>
                          <span className="font-bold text-gray-900 block">{app.username}</span>
                          <span className="text-[10px] text-gray-400 font-mono">{app.email}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-gray-650 max-w-xs break-words font-medium leading-relaxed">
                        {app.bio}
                      </td>
                      <td className="py-4 px-6 text-gray-650 max-w-xs break-words font-medium leading-relaxed">
                        {app.sampleContent || <span className="text-gray-300 italic">未填写</span>}
                      </td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          app.status === 'approved' ? 'bg-emerald-100 text-emerald-800' :
                          app.status === 'rejected' ? 'bg-rose-100 text-rose-800' :
                          'bg-amber-100 text-amber-800 animate-pulse'
                        }`}>
                          {app.status === 'approved' ? '已批准' :
                           app.status === 'rejected' ? '已拒绝' : '待审核'}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-gray-400 font-mono text-xs">
                        {new Date(app.createdAt).toLocaleString()}
                      </td>
                      <td className="py-4 px-6 text-right">
                        {app.status === 'pending' ? (
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleApproveApplication(app)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-600 hover:bg-emerald-100 transition-all font-semibold text-xs shadow-3xs cursor-pointer"
                            >
                              <Check className="h-3.5 w-3.5" />
                              批准
                            </button>
                            <button
                              onClick={() => handleRejectApplication(app)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-50 border border-rose-100 text-rose-600 hover:bg-rose-100 transition-all font-semibold text-xs shadow-3xs cursor-pointer"
                            >
                              <X className="h-3.5 w-3.5" />
                              拒绝
                            </button>
                          </div>
                        ) : app.status === 'rejected' && (app as any).rejectReason ? (
                          <span className="text-rose-500 font-medium text-xs block truncate max-w-[150px]" title={(app as any).rejectReason}>
                            拒绝理由：{(app as any).rejectReason}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">无可用操作</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Applications Cards */}
          <div className="block md:hidden space-y-4 p-4 bg-gray-50/30">
            {applicationsList.length === 0 ? (
              <div className="text-center py-12 text-gray-400 italic text-xs bg-white rounded-2xl border border-gray-100">
                暂无任何作者入驻申请记录
              </div>
            ) : (
              applicationsList.map((app) => (
                <div key={app.id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-3">
                  <div className="flex items-start justify-between gap-2 border-b border-gray-50 pb-2.5">
                    <div>
                      <span className="font-bold text-gray-900 block text-xs">{app.username}</span>
                      <span className="text-[10px] text-gray-400 font-mono">{app.email}</span>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold ${
                      app.status === 'approved' ? 'bg-emerald-100 text-emerald-800' :
                      app.status === 'rejected' ? 'bg-rose-100 text-rose-800' :
                      'bg-amber-100 text-amber-800 animate-pulse'
                    }`}>
                      {app.status === 'approved' ? '已通过' :
                       app.status === 'rejected' ? '已拒绝' : '待审核'}
                    </span>
                  </div>

                  <div className="text-xs text-gray-650 space-y-1">
                    <p><span className="font-bold text-gray-800">申请理由：</span>{app.bio}</p>
                    {app.sampleContent && <p><span className="font-bold text-gray-800">创作代表作/简介：</span>{app.sampleContent}</p>}
                    {app.status === 'rejected' && (app as any).rejectReason && (
                      <p className="bg-rose-50 text-rose-800 p-2 rounded-lg text-[11px] mt-1.5 leading-relaxed">
                        <span className="font-bold">站长拒绝原因：</span>{(app as any).rejectReason}
                      </p>
                    )}
                    <p className="text-[9px] text-gray-400 font-mono pt-1.5">提交时间：{new Date(app.createdAt).toLocaleString()}</p>
                  </div>

                  {app.status === 'pending' && (
                    <div className="pt-2.5 border-t border-gray-50 flex gap-2">
                      <button
                        onClick={() => handleApproveApplication(app)}
                        className="flex-1 inline-flex justify-center items-center gap-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm cursor-pointer"
                      >
                        <Check className="h-3 w-3" />
                        批准
                      </button>
                      <button
                        onClick={() => handleRejectApplication(app)}
                        className="flex-1 inline-flex justify-center items-center gap-1 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs shadow-sm cursor-pointer"
                      >
                        <X className="h-3 w-3" />
                        拒绝
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        /* Reports Admin Table Section */
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden text-left font-sans">
          <div className="p-5 border-b border-gray-100">
            <h3 className="font-display font-semibold text-gray-900">举报内容审核中心</h3>
            <p className="text-xs text-gray-400 mt-1">
              核实并处理读者对博文/配图的举报。可选择「举报无效」保留博文，或「删除博文+警告作者」进行违规下架处理。
            </p>
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/75 border-b border-gray-100 text-xs text-gray-500 font-bold uppercase tracking-wider">
                  <th className="py-4 px-6">举报博文</th>
                  <th className="py-4 px-6">举报原因</th>
                  <th className="py-4 px-6">详细描述</th>
                  <th className="py-4 px-6">举报人</th>
                  <th className="py-4 px-6">举报时间</th>
                  <th className="py-4 px-6">处理状态</th>
                  <th className="py-4 px-6 text-right">审核操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {reportsList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-gray-400 italic text-xs">
                      暂无任何用户举报记录
                    </td>
                  </tr>
                ) : (
                  reportsList.map((report) => (
                    <tr key={report.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-4 px-6">
                        <div>
                          <button
                            onClick={() => {
                              onSelectPost(report.postId);
                              onNavigate('post-detail');
                            }}
                            className="font-bold text-indigo-600 hover:text-indigo-800 text-left hover:underline block max-w-xs truncate"
                            title="点击查看博文详情"
                          >
                            {report.postTitle}
                          </button>
                          <span className="text-[9px] text-gray-400 font-mono">ID: {report.postId}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700">
                          {report.reason}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-gray-500 max-w-xs break-words leading-relaxed text-xs">
                        {report.details || <span className="text-gray-300 italic">无补充描述</span>}
                      </td>
                      <td className="py-4 px-6 text-xs text-gray-700">
                        <span className="font-semibold block">{report.reporterName}</span>
                        <span className="text-[10px] text-gray-400 font-mono">UID: {report.reporterId.substring(0, 8)}...</span>
                      </td>
                      <td className="py-4 px-6 text-gray-400 font-mono text-xs">
                        {new Date(report.createdAt).toLocaleString()}
                      </td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          report.status === 'resolved' ? 'bg-rose-100 text-rose-800' :
                          report.status === 'invalid' ? 'bg-gray-100 text-gray-600' :
                          'bg-amber-100 text-amber-800 animate-pulse'
                        }`}>
                          {report.status === 'resolved' ? '已删文警告' :
                           report.status === 'invalid' ? '已判定无效' : '待处理'}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        {report.status === 'pending' ? (
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleDismissReport(report)}
                              className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100 transition-all font-semibold text-xs shadow-3xs cursor-pointer"
                            >
                              <X className="h-3 w-3" />
                              举报无效
                            </button>
                            <button
                              onClick={() => handleResolveAndWarn(report)}
                              className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-rose-600 text-white hover:bg-rose-700 transition-all font-semibold text-xs shadow-3xs cursor-pointer"
                            >
                              <Trash2 className="h-3 w-3" />
                              删除并警告
                            </button>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs italic">
                            {report.status === 'resolved' ? '已下架博文并向作者发出通报警告' : '已判定为无效举报并归档'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Reports Cards */}
          <div className="block md:hidden space-y-4 p-4 bg-gray-50/30">
            {reportsList.length === 0 ? (
              <div className="text-center py-12 text-gray-400 italic text-xs bg-white rounded-2xl border border-gray-100">
                暂无任何用户举报记录
              </div>
            ) : (
              reportsList.map((report) => (
                <div key={report.id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-3">
                  <div className="flex items-start justify-between gap-2 border-b border-gray-50 pb-2.5">
                    <div className="min-w-0 flex-1">
                      <button
                        onClick={() => {
                          onSelectPost(report.postId);
                          onNavigate('post-detail');
                        }}
                        className="font-bold text-indigo-600 hover:text-indigo-800 text-xs text-left hover:underline block truncate"
                        title="点击查看博文详情"
                      >
                        《{report.postTitle}》
                      </button>
                      <p className="text-[9px] text-gray-400 mt-0.5">举报人: {report.reporterName}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold shrink-0 ${
                      report.status === 'resolved' ? 'bg-rose-100 text-rose-800' :
                      report.status === 'invalid' ? 'bg-gray-100 text-gray-600' :
                      'bg-amber-100 text-amber-800 animate-pulse'
                    }`}>
                      {report.status === 'resolved' ? '已删警告' :
                       report.status === 'invalid' ? '判定无效' : '待处理'}
                    </span>
                  </div>

                  <div className="text-xs text-gray-650 space-y-1">
                    <p>
                      <span className="font-bold text-gray-800">举报原因：</span>
                      <span className="inline-flex px-1.5 py-0.5 bg-rose-50 text-rose-700 rounded-md text-[10px] font-semibold">{report.reason}</span>
                    </p>
                    <p><span className="font-bold text-gray-800">补充描述：</span>{report.details || <span className="text-gray-300 italic">无</span>}</p>
                    <p className="text-[9px] text-gray-400 font-mono pt-1">提交时间：{new Date(report.createdAt).toLocaleString()}</p>
                  </div>

                  {report.status === 'pending' && (
                    <div className="pt-2.5 border-t border-gray-50 flex gap-2">
                      <button
                        onClick={() => handleDismissReport(report)}
                        className="flex-1 inline-flex justify-center items-center gap-1 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs shadow-sm cursor-pointer"
                      >
                        <X className="h-3 w-3" />
                        举报无效
                      </button>
                      <button
                        onClick={() => handleResolveAndWarn(report)}
                        className="flex-1 inline-flex justify-center items-center gap-1 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs shadow-sm cursor-pointer"
                      >
                        <Trash2 className="h-3 w-3" />
                        删除并警告
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
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
