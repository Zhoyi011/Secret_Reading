import React, { useState } from 'react';
import { Save, Cloud, ShieldCheck, HelpCircle, Check, Loader2 } from 'lucide-react';

interface SettingsProps {
  onBack: () => void;
}

export default function Settings({ onBack }: SettingsProps) {
  const [cloudName, setCloudName] = useState(localStorage.getItem('CLOUDINARY_CLOUD_NAME') || '');
  const [uploadPreset, setUploadPreset] = useState(localStorage.getItem('CLOUDINARY_UPLOAD_PRESET') || '');
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('CLOUDINARY_CLOUD_NAME', cloudName.trim());
    localStorage.setItem('CLOUDINARY_UPLOAD_PRESET', uploadPreset.trim());
    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
      onBack();
    }, 1000);
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <div className="bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
          <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
            <Cloud className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display font-bold text-gray-900 text-lg">外部图床配置 (Cloudinary Settings)</h2>
            <p className="text-xs text-gray-400 mt-0.5">配置个人 Cloudinary 证书即可将注册头像与文章配图保存至云端。</p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">Cloudinary Cloud Name (云服务商标识)</label>
            <input
              type="text"
              value={cloudName}
              onChange={(e) => setCloudName(e.target.value)}
              placeholder="e.g. dxyz123ab"
              className="mt-1 block w-full rounded-xl border border-gray-300 py-2.5 px-3.5 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 shadow-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">Unsigned Upload Preset (免签名上传预设器)</label>
            <input
              type="text"
              value={uploadPreset}
              onChange={(e) => setUploadPreset(e.target.value)}
              placeholder="e.g. public_unsigned_preset"
              className="mt-1 block w-full rounded-xl border border-gray-300 py-2.5 px-3.5 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 shadow-sm"
            />
          </div>

          <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100/30 flex gap-3">
            <ShieldCheck className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
            <div className="text-[11px] text-indigo-900/80 leading-relaxed">
              <span className="font-bold block text-indigo-950 mb-0.5">如何获取 Cloud Preset：</span>
              1. 注册并登录 <a href="https://cloudinary.com" target="_blank" rel="noreferrer" className="underline font-bold text-indigo-600">Cloudinary 官网</a>。<br />
              2. 在 Settings ➔ Upload ➔ <span className="font-semibold">Upload Presets</span> 中新增一个预设，并将 Signing Mode 设置为 <span className="font-bold text-indigo-700">Unsigned</span> 复选保存。<br />
              3. 将 Cloud Name 和 Upload Preset 复制填入上方保存，即可开启自动云端贴图上传！若不进行配置，我们会启动<b>优雅的本地备选文件加载器</b>，不影响正常的使用与发文操作。
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onBack}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 transition-colors text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm"
            >
              {isSaved ? (
                <>
                  <Check className="h-4 w-4" />
                  已保存配置
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  保存并应用
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
