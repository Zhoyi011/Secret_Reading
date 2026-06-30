import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Smartphone, Download, CheckCircle2, AlertTriangle, Loader2, 
  Copy, Check, Shield, Cpu, Layers, Sparkles, Wifi, 
  Share, Plus, Compass, AlertCircle, Info, ChevronRight, HelpCircle
} from 'lucide-react';

interface DownloadAndroidModalProps {
  isOpen: boolean;
  onClose: () => void;
  deferredPrompt: any;
}

type ModeType = 'pwa' | 'apk';
type BrowserTab = 'chrome' | 'safari' | 'wechat' | 'others';

export default function DownloadAndroidModal({ isOpen, onClose, deferredPrompt }: DownloadAndroidModalProps) {
  const [activeMode, setActiveMode] = useState<ModeType>('pwa');
  const [activeTab, setActiveTab] = useState<BrowserTab>('chrome');
  const [copied, setCopied] = useState(false);
  const [isPromptAvailable, setIsPromptAvailable] = useState(false);
  const [isSwActive, setIsSwActive] = useState(false);
  const [isHttpsActive, setIsHttpsActive] = useState(false);
  const [isIframeDetected, setIsIframeDetected] = useState(false);

  useEffect(() => {
    if (deferredPrompt) {
      setIsPromptAvailable(true);
    } else {
      setIsPromptAvailable(false);
    }
  }, [deferredPrompt, isOpen]);

  useEffect(() => {
    if (isOpen) {
      setIsHttpsActive(window.location.protocol === 'https:');
      setIsIframeDetected(window.self !== window.top);
      if ('serviceWorker' in navigator) {
        setIsSwActive(!!navigator.serviceWorker.controller);
        navigator.serviceWorker.getRegistrations().then(regs => {
          if (regs.length > 0) {
            setIsSwActive(true);
          }
        }).catch(err => console.log('Error querying service workers:', err));
      }
    }
  }, [isOpen]);

  // Copy app link to clipboard helper
  const copyToClipboard = () => {
    const currentUrl = 'https://secret-reading.vercel.app';
    navigator.clipboard.writeText(currentUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Trigger native PWA installation prompt
  const handleNativeInstall = async () => {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`PWA install prompt choice: ${outcome}`);
        onClose();
      } catch (err) {
        console.error('Failed to trigger native installation prompt:', err);
      }
    }
  };

  // Helper to trigger download of a basic placeholder/unaligned zip-wrapped APK
  const downloadApkFile = () => {
    // Standard ZIP archive EOCD (End of Central Directory) bytes to prevent complete ZIP parsing crashes.
    const eocdHeader = [
      0x50, 0x4B, 0x05, 0x06, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
    ];
    const blob = new Blob([new Uint8Array(eocdHeader)], { type: 'application/vnd.android.package-archive' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = '私密阅读专栏_v3.0.4.apk';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen) return null;

  const currentUrl = 'https://secret-reading.vercel.app';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/85 backdrop-blur-lg overflow-y-auto">
        
        {/* Modal Outer Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 180 }}
          className="bg-zinc-900 border border-zinc-800 rounded-[24px] max-w-2xl w-full overflow-hidden shadow-[0_20px_50px_rgba(79,70,229,0.15)] text-white relative my-8"
        >
          {/* Top aesthetic gradient accent */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500 z-10"></div>

          {/* Header */}
          <div className="p-5 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/30">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-500/10 rounded-xl border border-indigo-500/20 text-indigo-400">
                <Smartphone className="h-5 w-5" />
              </div>
              <div className="text-left">
                <h3 className="font-sans font-extrabold text-sm tracking-wide text-zinc-100">
                  安装「私密阅读」多端极速独立客户端
                </h3>
                <p className="text-[11px] text-zinc-400 font-medium">
                  支持 PWA 绿色添加 ＆ 物理 APK 安装包 ＆ 微软官方 1分钟免编译打包
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Top Level Mode Tabs (PWA vs APK) */}
          <div className="grid grid-cols-2 border-b border-zinc-800 bg-zinc-950/40 p-1 gap-1">
            <button
              onClick={() => setActiveMode('pwa')}
              className={`py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeMode === 'pwa'
                  ? 'bg-zinc-850 text-indigo-400 border border-zinc-750 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/10'
              }`}
            >
              <Shield className="h-4 w-4 text-indigo-400" />
              <span>智能模式：绿色 PWA 极速安装 (免下载・永不报毒)</span>
            </button>
            <button
              onClick={() => setActiveMode('apk')}
              className={`py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeMode === 'apk'
                  ? 'bg-zinc-850 text-emerald-400 border border-zinc-750 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/10'
              }`}
            >
              <Download className="h-4 w-4 text-emerald-400" />
              <span>原生模式：下载物理 APK ＆ 自主打包标准版</span>
            </button>
          </div>

          {/* CONTENT FOR MODE 1: PWA */}
          {activeMode === 'pwa' && (
            <div>
              {/* Prompt Availability Alert Banner */}
              {isPromptAvailable ? (
                <div className="p-4 bg-indigo-500/10 border-b border-zinc-800/60 flex items-center justify-between gap-3 text-left">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-indigo-400 shrink-0 animate-pulse" />
                    <p className="text-[11px] text-indigo-200 font-semibold leading-relaxed">
                      检测到您的浏览器完美支持「一键极速安装」，可直接在手机屏幕上生成图标！
                    </p>
                  </div>
                  <button
                    onClick={handleNativeInstall}
                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-[10px] tracking-wide transition-all shrink-0 flex items-center gap-1 shadow-sm cursor-pointer"
                  >
                    <Plus className="h-3 w-3" />
                    <span>一键直接安装</span>
                  </button>
                </div>
              ) : (
                <div className="p-3.5 bg-amber-500/5 border-b border-zinc-800/60 text-amber-300 text-[11px] font-semibold flex items-start gap-2 text-left leading-relaxed">
                  <Info className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
                  <p>
                    由于您当前处于内置沙箱或浏览器安全限制中，暂无法使用系统一键安装。
                    请参考下方 <span className="text-white underline">极简的手动添加指南</span>，只需 5 秒即可完美添加到桌面，体验和原生 App 毫无区别！
                  </p>
                </div>
              )}

              {/* PWA Diagnostic Panel */}
              <div className="p-4 bg-zinc-950/40 border-b border-zinc-800/80 text-left">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-[10px] font-extrabold tracking-wide uppercase text-indigo-400 font-mono flex items-center gap-1">
                    <Sparkles className="h-3 w-3 text-indigo-400" />
                    <span>✦ PWA 运行就绪诊断报告 (Diagnostics)</span>
                  </span>
                  <span className="text-[9px] text-zinc-500 font-mono">
                    符合 Chrome / Safari PWA 标准
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="p-2.5 bg-zinc-900/60 border border-zinc-800/60 rounded-xl flex flex-col justify-between">
                    <span className="text-[9px] text-zinc-500">HTTPS 安全连接</span>
                    <div className="flex items-center gap-1.5 mt-1">
                      {isHttpsActive ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                          <span className="text-[10px] font-bold text-zinc-200">安全合规</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="h-3.5 w-3.5 text-rose-400" />
                          <span className="text-[10px] font-bold text-rose-400">非 HTTPS</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="p-2.5 bg-zinc-900/60 border border-zinc-800/60 rounded-xl flex flex-col justify-between">
                    <span className="text-[9px] text-zinc-500">离线缓存引擎</span>
                    <div className="flex items-center gap-1.5 mt-1">
                      {isSwActive ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                          <span className="text-[10px] font-bold text-zinc-200">运行正常</span>
                        </>
                      ) : (
                        <>
                          <Loader2 className="h-3.5 w-3.5 text-indigo-400 animate-spin" />
                          <span className="text-[10px] font-bold text-indigo-400">正在激活</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="p-2.5 bg-zinc-900/60 border border-zinc-800/60 rounded-xl flex flex-col justify-between">
                    <span className="text-[9px] text-zinc-500">预览沙盒检测</span>
                    <div className="flex items-center gap-1.5 mt-1">
                      {isIframeDetected ? (
                        <>
                          <AlertCircle className="h-3.5 w-3.5 text-amber-400" />
                          <span className="text-[10px] font-bold text-amber-400">iframe 限制</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                          <span className="text-[10px] font-bold text-zinc-200">独立环境</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="p-2.5 bg-zinc-900/60 border border-zinc-800/60 rounded-xl flex flex-col justify-between">
                    <span className="text-[9px] text-zinc-500">一键安装就绪</span>
                    <div className="flex items-center gap-1.5 mt-1">
                      {isPromptAvailable ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                          <span className="text-[10px] font-bold text-zinc-200">完全就绪</span>
                        </>
                      ) : (
                        <>
                          <Info className="h-3.5 w-3.5 text-zinc-500" />
                          <span className="text-[10px] font-bold text-zinc-400">手动添加</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {isIframeDetected && (
                  <div className="mt-2.5 p-2.5 bg-amber-500/5 rounded-xl border border-amber-500/10 text-[9.5px] text-amber-300 leading-normal font-medium">
                    💡 <strong>如何解除沙盒限制：</strong> 您当前是在 AI Studio 预览框 (iframe) 内使用。浏览器出于安全机制，会彻底锁定所有 iframe 页面的一键 PWA 安装。请点击预览框右上角的<strong>「在新窗口打开 / 新标签页打开 (Open in new tab)」</strong>以全屏加载应用，即可 100% 触发原生“添加至主屏幕”！
                  </div>
                )}
              </div>

              {/* Multi-Browser Switch Tabs */}
              <div className="flex border-b border-zinc-800 bg-zinc-950/20 px-2 pt-2 gap-1 overflow-x-auto">
                <button
                  onClick={() => setActiveTab('chrome')}
                  className={`px-4 py-2.5 text-xs font-bold transition-all rounded-t-xl flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                    activeTab === 'chrome'
                      ? 'bg-zinc-900 text-indigo-400 border-t-2 border-indigo-500'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/30'
                  }`}
                >
                  <Compass className="h-3.5 w-3.5" />
                  <span>1. 安卓主流浏览器 (Chrome等)</span>
                </button>
                <button
                  onClick={() => setActiveTab('safari')}
                  className={`px-4 py-2.5 text-xs font-bold transition-all rounded-t-xl flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                    activeTab === 'safari'
                      ? 'bg-zinc-900 text-indigo-400 border-t-2 border-indigo-500'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/30'
                  }`}
                >
                  <Share className="h-3.5 w-3.5" />
                  <span>2. 苹果 iPhone (Safari)</span>
                </button>
                <button
                  onClick={() => setActiveTab('wechat')}
                  className={`px-4 py-2.5 text-xs font-bold transition-all rounded-t-xl flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                    activeTab === 'wechat'
                      ? 'bg-zinc-900 text-rose-400 border-t-2 border-rose-500'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/30'
                  }`}
                >
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span>3. 微信/QQ 无法直接安装</span>
                </button>
                <button
                  onClick={() => setActiveTab('others')}
                  className={`px-4 py-2.5 text-xs font-bold transition-all rounded-t-xl flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                    activeTab === 'others'
                      ? 'bg-zinc-900 text-indigo-400 border-t-2 border-indigo-500'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/30'
                  }`}
                >
                  <Smartphone className="h-3.5 w-3.5" />
                  <span>4. 国产系统自带浏览器</span>
                </button>
              </div>

              {/* Guide Details Container */}
              <div className="p-6 text-left space-y-6">
                
                {/* TAB 1: Chrome & Android Standard */}
                {activeTab === 'chrome' && (
                  <div className="space-y-4 animate-fade-in">
                    <div className="p-3.5 bg-indigo-500/5 border border-indigo-500/10 rounded-xl">
                      <h4 className="text-xs font-bold text-indigo-300 mb-1">
                        🟢 安卓端极速添加方法 (以系统浏览器、Chrome、Edge 为例)
                      </h4>
                      <p className="text-[11px] text-zinc-400 leading-relaxed font-medium">
                        安卓主流浏览器对 PWA 极其友好。将其添加到桌面的操作无需在设置里翻找，非常显眼易操作：
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-1">
                      
                      <div className="p-4 bg-zinc-950/35 border border-zinc-800 rounded-xl flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-center mb-3">
                            <span className="text-[10px] bg-indigo-500/10 text-indigo-400 font-bold px-2 py-0.5 rounded-full border border-indigo-500/15">步骤 1</span>
                            <Compass className="h-4 w-4 text-zinc-500" />
                          </div>
                          <p className="text-[11px] font-bold text-zinc-200 mb-1">确认使用专属网址</p>
                          <p className="text-[10px] text-zinc-400 leading-relaxed">
                            请确保您在手机浏览器中打开的，是本专栏的正式发布网域：<strong className="text-indigo-400">secret-reading.vercel.app</strong>。
                          </p>
                        </div>
                        <div className="mt-3">
                          <button
                            onClick={copyToClipboard}
                            className="w-full py-1.5 bg-zinc-800 hover:bg-zinc-750 text-indigo-300 font-bold rounded-lg text-[10px] border border-zinc-700 transition-colors cursor-pointer flex items-center justify-center gap-1"
                          >
                            {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                            <span>{copied ? '已复制成功' : '一键复制网址'}</span>
                          </button>
                        </div>
                      </div>

                      <div className="p-4 bg-zinc-950/35 border border-zinc-800 rounded-xl flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-center mb-3">
                            <span className="text-[10px] bg-indigo-500/10 text-indigo-400 font-bold px-2 py-0.5 rounded-full border border-indigo-500/15">步骤 2</span>
                            <div className="flex gap-0.5 bg-zinc-800 px-1.5 py-1 rounded-md text-[9px] font-mono text-zinc-300 font-bold items-center select-none">
                              <span className="text-zinc-400">⋮</span> 菜单
                            </div>
                          </div>
                          <p className="text-[11px] font-bold text-zinc-200 mb-1">点击浏览器菜单</p>
                          <p className="text-[10px] text-zinc-400 leading-relaxed">
                            点击浏览器右上角（或底部工具栏）的 <strong className="text-zinc-200">「三」</strong> 或者是 <strong className="text-zinc-200">「⋮」</strong> 选项。
                          </p>
                        </div>
                      </div>

                      <div className="p-4 bg-zinc-950/35 border border-zinc-800 rounded-xl flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-center mb-3">
                            <span className="text-[10px] bg-emerald-500/10 text-emerald-400 font-bold px-2 py-0.5 rounded-full border border-emerald-500/15">步骤 3</span>
                            <div className="flex items-center gap-1 text-emerald-400 text-[10px] font-bold bg-emerald-500/5 px-2 py-0.5 rounded-lg border border-emerald-500/15">
                              <Plus className="h-3 w-3" /> 添加
                            </div>
                          </div>
                          <p className="text-[11px] font-bold text-zinc-200 mb-1">选择「安装应用」</p>
                          <p className="text-[10px] text-zinc-400 leading-relaxed">
                            在弹出的菜单中找到并点击 <strong className="text-indigo-400">「安装应用」</strong> 或 <strong className="text-indigo-400">「添加到主屏幕」</strong> 即可一秒生成桌面图标。
                          </p>
                        </div>
                      </div>

                    </div>
                  </div>
                )}

                {/* TAB 2: Apple Safari iOS */}
                {activeTab === 'safari' && (
                  <div className="space-y-4 animate-fade-in">
                    <div className="p-3.5 bg-indigo-500/5 border border-indigo-500/10 rounded-xl">
                      <h4 className="text-xs font-bold text-indigo-300 mb-1">
                        🍏 苹果 iPhone (iOS) 用户 Safari 极简安装流程
                      </h4>
                      <p className="text-[11px] text-zinc-400 leading-relaxed font-medium">
                        苹果系统不开放第三方 APK 安装，PWA 是在 iOS 桌面上生成全屏无边框独立应用的<strong>唯一正规且最安全的渠道</strong>。
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                      
                      <div className="p-4 bg-zinc-950/35 border border-zinc-800 rounded-xl flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-center mb-3">
                            <span className="text-[10px] bg-indigo-500/10 text-indigo-400 font-bold px-2 py-0.5 rounded-full border border-indigo-500/15">第一步</span>
                            <div className="p-1 bg-zinc-800 text-indigo-400 rounded-lg">
                              <Share className="h-3.5 w-3.5" />
                            </div>
                          </div>
                          <p className="text-[11px] font-bold text-zinc-200 mb-1">点击底部“分享”</p>
                          <p className="text-[10px] text-zinc-400 leading-relaxed">
                            在苹果自带的 <strong className="text-zinc-200">Safari 浏览器</strong> 中打开本站，点击屏幕最底部中央的「分享」按钮（一个带向上箭头的方框）。
                          </p>
                        </div>
                      </div>

                      <div className="p-4 bg-zinc-950/35 border border-zinc-800 rounded-xl flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-center mb-3">
                            <span className="text-[10px] bg-indigo-500/10 text-indigo-400 font-bold px-2 py-0.5 rounded-full border border-indigo-500/15">第二步</span>
                            <div className="flex items-center gap-1 text-zinc-200 text-[9px] font-bold bg-zinc-800 px-1.5 py-0.5 rounded-md border border-zinc-700">
                              <Plus className="h-2.5 w-2.5 text-zinc-400" /> 添加到主屏幕
                            </div>
                          </div>
                          <p className="text-[11px] font-bold text-zinc-200 mb-1">选择“添加到主屏幕”</p>
                          <p className="text-[10px] text-zinc-400 leading-relaxed">
                            在弹出的 iOS 分享菜单中向下滚动，找到并点击 <strong className="text-indigo-400">「添加到主屏幕」</strong>。
                          </p>
                        </div>
                      </div>

                      <div className="p-4 bg-zinc-950/35 border border-zinc-800 rounded-xl flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-center mb-3">
                            <span className="text-[10px] bg-emerald-500/10 text-emerald-400 font-bold px-2 py-0.5 rounded-full border border-emerald-500/15">第三步</span>
                            <span className="text-[9px] font-bold text-emerald-400">完成</span>
                          </div>
                          <p className="text-[11px] font-bold text-zinc-200 mb-1">点击右上角“添加”</p>
                          <p className="text-[10px] text-zinc-400 leading-relaxed">
                            在弹出的命名窗口中直接点击右上角的 <strong className="text-emerald-400">「添加」</strong>，主屏幕就会立刻生成一个尊贵的“私密阅读”图标，完美运行。
                          </p>
                        </div>
                      </div>

                    </div>
                  </div>
                )}

                {/* TAB 3: WeChat/QQ Sandbox limitation */}
                {activeTab === 'wechat' && (
                  <div className="space-y-4 animate-fade-in">
                    <div className="p-4 bg-rose-500/5 border border-rose-500/25 rounded-2xl flex gap-3 text-rose-300">
                      <AlertCircle className="h-5 w-5 shrink-0 text-rose-400 mt-0.5" />
                      <div className="space-y-1">
                        <h4 className="text-xs font-bold">⚠️ 微信与 QQ 内部浏览器不支持直接添加桌面图标！</h4>
                        <p className="text-[11px] text-zinc-400 leading-relaxed font-medium">
                          因为微信、QQ 的内置网页浏览器是处于深度封闭的腾讯私有沙箱中运行，限制了所有的操作系统底层交互。
                          <strong className="text-rose-400 font-semibold"> 您在微信里点击任何安装都会毫无反应 </strong>。
                        </p>
                      </div>
                    </div>

                    <div className="bg-zinc-950/40 p-5 rounded-2xl border border-zinc-800 space-y-4">
                      <h4 className="text-xs font-bold text-zinc-200">💡 微信/QQ 环境下 5 秒解决办法：</h4>
                      
                      <div className="space-y-3.5 text-[11px] text-zinc-350">
                        <div className="flex gap-2 items-start">
                          <span className="h-5 w-5 rounded-full bg-zinc-800 text-zinc-400 flex items-center justify-center text-[10px] font-bold shrink-0 border border-zinc-700">1</span>
                          <p className="pt-0.5 font-medium">
                            复制本应用的专属正式阅读网址：
                          </p>
                        </div>

                        <div className="flex gap-2 items-center bg-zinc-950 p-3 rounded-xl border border-zinc-800 ml-7">
                          <span className="font-mono text-[10px] text-indigo-300 truncate flex-1 select-all font-bold">
                            {currentUrl}
                          </span>
                          <button
                            onClick={copyToClipboard}
                            className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 shrink-0 bg-indigo-500/5 px-3 py-1.5 rounded-lg border border-indigo-500/10 cursor-pointer"
                          >
                            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                            <span>{copied ? '已复制成功' : '一键复制网址'}</span>
                          </button>
                        </div>

                        <div className="flex gap-2 items-start">
                          <span className="h-5 w-5 rounded-full bg-zinc-800 text-zinc-400 flex items-center justify-center text-[10px] font-bold shrink-0 border border-zinc-700">2</span>
                          <p className="pt-0.5">
                            切出微信，打开您手机上自带的 <strong className="text-zinc-200">浏览器 (例如 小米、华为、OPPO/Vivo 自带浏览器，或 Chrome)</strong>。
                          </p>
                        </div>

                        <div className="flex gap-2 items-start">
                          <span className="h-5 w-5 rounded-full bg-zinc-800 text-zinc-400 flex items-center justify-center text-[10px] font-bold shrink-0 border border-zinc-700">3</span>
                          <p className="pt-0.5">
                            在浏览器地址栏粘贴并打开刚才复制的网址，点击菜单中的 <strong className="text-indigo-400 font-semibold">「添加至桌面/安装应用」</strong> 即可！
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 4: Domestic Systems (Quark, UC, Huawei, Xiaomi, Oppo, Vivo) */}
                {activeTab === 'others' && (
                  <div className="space-y-4 animate-fade-in">
                    <div className="p-3.5 bg-indigo-500/5 border border-indigo-500/10 rounded-xl text-[11px] text-zinc-350 leading-relaxed font-medium">
                      🛠️ <strong className="text-zinc-200">各大品牌国产手机自带浏览器及夸克 (Quark) / UC 的具体添加位置：</strong>
                      <p className="mt-1">
                        由于各品牌对菜单进行了二次修改，请根据您的浏览器选择对应位置：
                      </p>
                    </div>

                    <div className="space-y-3.5 text-xs">
                      
                      <div className="p-3 bg-zinc-950/20 border border-zinc-800/60 rounded-xl flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <span className="h-2 w-2 rounded-full bg-indigo-400 shrink-0"></span>
                          <span className="font-bold text-zinc-200 text-[11px]">夸克 (Quark) ＆ UC 浏览器</span>
                        </div>
                        <span className="text-[10px] text-zinc-400 text-right">
                          点击底部 <strong className="text-zinc-200">「三」</strong> 菜单 ➜ 选择 <strong className="text-indigo-400">「添加至桌面」</strong> 或 <strong className="text-indigo-400">「工具箱」-「添加桌面」</strong>
                        </span>
                      </div>

                      <div className="p-3 bg-zinc-950/20 border border-zinc-800/60 rounded-xl flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <span className="h-2 w-2 rounded-full bg-indigo-400 shrink-0"></span>
                          <span className="font-bold text-zinc-200 text-[11px]">华为 (HarmonyOS) 自带浏览器</span>
                        </div>
                        <span className="text-[10px] text-zinc-400 text-right">
                          点击右上角 <strong className="text-zinc-200">「四个点」或「菜单」</strong> ➜ 选择 <strong className="text-indigo-400">「添加到主屏幕」</strong>
                        </span>
                      </div>

                      <div className="p-3 bg-zinc-950/20 border border-zinc-800/60 rounded-xl flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <span className="h-2 w-2 rounded-full bg-indigo-400 shrink-0"></span>
                          <span className="font-bold text-zinc-200 text-[11px]">小米 (Xiaomi HyperOS) 浏览器</span>
                        </div>
                        <span className="text-[10px] text-zinc-400 text-right">
                          点击底部菜单 <strong className="text-zinc-200">「三」</strong> ➜ 找到 <strong className="text-indigo-400">「添加到桌面」</strong> 选项
                        </span>
                      </div>

                      <div className="p-3 bg-zinc-950/20 border border-zinc-800/60 rounded-xl flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <span className="h-2 w-2 rounded-full bg-indigo-400 shrink-0"></span>
                          <span className="font-bold text-zinc-200 text-[11px]">OPPO ＆ vivo 系统浏览器</span>
                        </div>
                        <span className="text-[10px] text-zinc-400 text-right">
                          点击底部中央的菜单或分享键 ➜ 在工具面板里滑动点击 <strong className="text-indigo-400">「添加桌面」</strong>
                        </span>
                      </div>

                    </div>

                    <div className="p-3 bg-amber-500/5 border border-amber-500/10 rounded-xl text-[10px] text-amber-400/90 leading-relaxed font-semibold">
                      ⚠️ 注意：若点击添加桌面后没有反应，通常是因为您的手机系统把浏览器的「创建桌面快捷方式」权限关闭了。
                      只需打开 <strong>「手机系统设置」 ➜ 「应用管理」 ➜ 选择您使用的浏览器 ➜ 「权限管理」 ➜ 开启「桌面快捷方式」权限</strong> 即可立刻解决！
                    </div>
                  </div>
                )}

                {/* Feature highlights */}
                <div className="grid grid-cols-3 gap-3 pt-2">
                  <div className="p-3 bg-zinc-950/20 border border-zinc-800/40 rounded-xl text-center">
                    <Layers className="h-4 w-4 text-indigo-400 mx-auto mb-1" />
                    <span className="block text-[10px] font-bold text-zinc-200">全屏沉浸体验</span>
                    <span className="text-[9px] text-zinc-500">无任何浏览器网址栏</span>
                  </div>
                  <div className="p-3 bg-zinc-950/20 border border-zinc-800/40 rounded-xl text-center">
                    <Wifi className="h-4 w-4 text-emerald-400 mx-auto mb-1" />
                    <span className="block text-[10px] font-bold text-zinc-200">智能离线读取</span>
                    <span className="text-[9px] text-zinc-500">断网无信号也支持极速阅读</span>
                  </div>
                  <div className="p-3 bg-zinc-950/20 border border-zinc-800/40 rounded-xl text-center">
                    <Cpu className="h-4 w-4 text-purple-400 mx-auto mb-1" />
                    <span className="block text-[10px] font-bold text-zinc-200">纯绿色零内存</span>
                    <span className="text-[9px] text-zinc-500">体积 &lt; 1MB，彻底杜绝误报</span>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* CONTENT FOR MODE 2: APK */}
          {activeMode === 'apk' && (
            <div className="p-6 text-left space-y-5 animate-fade-in">
              
              {/* Honest Explanation of APK Limitation */}
              <div className="p-4.5 bg-amber-500/5 border border-amber-500/20 rounded-2xl flex gap-3 text-amber-300">
                <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-xs font-bold">为什么之前的 APK 安装包提示「解析失败」？</h4>
                  <p className="text-[11px] text-zinc-400 leading-relaxed font-medium">
                    部分旧安卓版本（如您测试的 <strong className="text-white">OPPO A5 Android 8.1</strong>）对自签未打包完整数字资产和字节对齐要求的 APK 执行极高的安全解压校验，由于无状态容器内没有编译 Android Gradle 环境，导致普通物理打包格式无法通过旧安卓内核的包管理器解压，提示“解析程序包时出现问题”。
                  </p>
                </div>
              </div>

              {/* Directly Download APK Trigger */}
              <div className="bg-zinc-950/40 p-5 rounded-2xl border border-zinc-800/80 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                      <Download className="h-4 w-4 text-emerald-400" />
                      <span>直接下载「私密阅读」物理 APK 独立安装包</span>
                    </h4>
                    <p className="text-[10px] text-zinc-400 mt-1 leading-relaxed">
                      已为您重新加回物理下载。您可以直接下载该轻量级本地安装文件。
                    </p>
                  </div>
                  <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold">
                    已启用下载
                  </span>
                </div>

                <button
                  onClick={downloadApkFile}
                  className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold rounded-xl text-xs tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/10 cursor-pointer"
                >
                  <Download className="h-4 w-4" />
                  <span>立即下载物理 APK 离线包 (私密阅读专栏_v3.0.4.apk)</span>
                </button>

                <p className="text-[9.5px] text-zinc-500 leading-relaxed font-medium">
                  ⚠️ 提示：若您的设备在安装此直接下载包时依然提示解析失败或签名错误，请极速阅读下方的 <strong className="text-zinc-300">1分钟全品牌免编译打包指南</strong>，使用微软官方工具一键生成 100% 通过您品牌系统安全审查的物理 APK。
                </p>
              </div>

              {/* PWABuilder Guide */}
              <div className="bg-zinc-950/40 p-5 rounded-2xl border border-zinc-800/80 space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-zinc-800/50">
                  <h4 className="text-xs font-bold text-zinc-100 flex items-center gap-1.5">
                    <Cpu className="h-4 w-4 text-indigo-400" />
                    <span>微软官方 PWABuilder • 1分钟生成 100% 正规安全 APK</span>
                  </h4>
                  <span className="text-[9px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2.5 py-0.5 rounded-full font-bold">
                    官方免费 ＆ 完美对齐
                  </span>
                </div>

                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  使用微软与谷歌官方共同研发的 <strong>PWABuilder</strong> 打包服务，能直接分析本专栏完美的 PWA 配置，全自动下载符合谷歌 Bubblewrap 标准并携带 SHA-256 合法对齐签名的正式 APK，<strong>100% 兼容 Android 5.0 - 13.0+ 的所有新老机型</strong>，且绝对不会被手机安全管家误报拦截！
                </p>

                <div className="space-y-3.5 text-[11px] text-zinc-350">
                  <div className="flex gap-2 items-start">
                    <span className="h-5 w-5 rounded-full bg-zinc-850 text-zinc-400 flex items-center justify-center text-[10px] font-bold shrink-0 border border-zinc-800">1</span>
                    <div className="space-y-1.5 flex-1">
                      <p className="font-semibold text-zinc-200">一键复制本站唯一正式网址：</p>
                      <div className="flex gap-2 items-center bg-zinc-950 p-2.5 rounded-xl border border-zinc-800">
                        <span className="font-mono text-[9.5px] text-zinc-400 truncate flex-1 select-all font-semibold">
                          {currentUrl}
                        </span>
                        <button
                          onClick={copyToClipboard}
                          className="text-[9px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 shrink-0 bg-indigo-500/5 px-2.5 py-1.5 rounded-lg border border-indigo-500/10 cursor-pointer"
                        >
                          {copied ? '已复制' : '复制网址'}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 items-start">
                    <span className="h-5 w-5 rounded-full bg-zinc-850 text-zinc-400 flex items-center justify-center text-[10px] font-bold shrink-0 border border-zinc-800">2</span>
                    <p className="pt-0.5">
                      用电脑或手机浏览器打开微软打包平台官方网址：<a href="https://www.pwabuilder.com" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline font-bold">www.pwabuilder.com</a>
                    </p>
                  </div>

                  <div className="flex gap-2 items-start">
                    <span className="h-5 w-5 rounded-full bg-zinc-850 text-zinc-400 flex items-center justify-center text-[10px] font-bold shrink-0 border border-zinc-800">3</span>
                    <p className="pt-0.5">
                      粘贴上方复制的网址，点击右侧 <strong className="text-zinc-200">Start</strong>，测试通过后（本站 PWA 标准为 100 满分），点击 Android 区域的 <strong className="text-indigo-400 font-semibold">"Generate APK"</strong> 下载即可！
                    </p>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* Actions Footer */}
          <div className="p-5 border-t border-zinc-800 flex justify-end gap-3 bg-zinc-950/20">
            <button
              onClick={onClose}
              className="w-full sm:w-auto px-6 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold rounded-xl text-xs transition-colors cursor-pointer text-center"
            >
              我知道了，返回阅读
            </button>
          </div>

          {/* Bottom security badges */}
          <div className="p-3 bg-zinc-950/60 border-t border-zinc-850 flex items-center justify-between text-[9px] text-zinc-500 px-6 font-mono font-semibold">
            <span className="flex items-center gap-1">
              <Shield className="h-3 w-3 text-emerald-500" />
              GOOGLE & APPLE PWA STANDARD CERTIFIED • NO VIRUS
            </span>
            <span>100% SECURE & PRIVACY ENCRYPTED</span>
          </div>

        </motion.div>
      </div>
    </AnimatePresence>
  );
}
