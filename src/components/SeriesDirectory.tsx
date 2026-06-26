import React from 'react';
import { Post, AppUser } from '../types';
import { BookOpen, Check, ArrowRight, BookMarked, Play } from 'lucide-react';

interface SeriesDirectoryProps {
  seriesId: string;
  seriesTitle: string;
  currentPostId: string;
  user: AppUser | null;
  onSelectPost: (postId: string) => void;
  chapters: Post[];
  userProgressMap: Record<string, number>;
}

export default function SeriesDirectory({
  seriesId,
  seriesTitle,
  currentPostId,
  user,
  onSelectPost,
  chapters,
  userProgressMap,
}: SeriesDirectoryProps) {
  if (chapters.length === 0) return null;

  // Calculate overall reading progress in this series
  const readChaptersCount = chapters.filter(ch => (userProgressMap[ch.id] || 0) >= 95).length;
  const overallPercentage = Math.round((readChaptersCount / chapters.length) * 100);

  return (
    <div className="bg-white border border-gray-150/80 rounded-2xl shadow-xs overflow-hidden text-left" id="series-directory-card">
      {/* Series Header */}
      <div className="bg-indigo-50/40 p-4 border-b border-gray-150/70">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-indigo-600 text-white rounded-lg">
            <BookOpen className="h-4 w-4" />
          </div>
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 font-display">
              连载/系列专栏
            </span>
            <h3 className="text-sm font-bold text-gray-950 font-display">
              《{seriesTitle}》
            </h3>
          </div>
        </div>

        {/* Reading Progress Summary */}
        {user && (
          <div className="mt-3 bg-white border border-gray-100 rounded-xl p-2.5 flex items-center justify-between gap-3 shadow-3xs">
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between text-[10px] text-gray-500 font-semibold mb-1">
                <span>系列阅读进度</span>
                <span className="text-indigo-600">{readChaptersCount} / {chapters.length} 篇 ({overallPercentage}%)</span>
              </div>
              <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                <div 
                  className="bg-indigo-600 h-full rounded-full transition-all duration-500"
                  style={{ width: `${overallPercentage}%` }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Chapters Table of Contents */}
      <div className="max-h-[320px] overflow-y-auto divide-y divide-gray-100">
        {chapters.map((ch, index) => {
          const isCurrent = ch.id === currentPostId;
          const progress = userProgressMap[ch.id] || 0;
          const isRead = progress >= 95;
          const isReading = progress > 0 && progress < 95;

          return (
            <button
              key={ch.id}
              onClick={() => onSelectPost(ch.id)}
              disabled={isCurrent}
              className={`w-full flex items-center justify-between p-3 text-left transition-all hover:bg-gray-50/75 select-none ${
                isCurrent 
                  ? 'bg-indigo-50/30 font-bold border-l-2 border-indigo-600 pl-2.5' 
                  : 'cursor-pointer'
              }`}
            >
              <div className="min-w-0 flex-1 flex items-start gap-2.5">
                {/* Order Index Badge */}
                <div className={`h-5 w-5 rounded-md flex items-center justify-center text-[10px] font-mono font-bold shrink-0 mt-0.5 ${
                  isCurrent 
                    ? 'bg-indigo-600 text-white' 
                    : 'bg-gray-100 text-gray-500'
                }`}>
                  {ch.seriesOrder || (index + 1)}
                </div>

                {/* Chapter Title */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className={`text-xs truncate ${isCurrent ? 'text-indigo-950 font-bold' : 'text-gray-800 font-medium'}`}>
                      {ch.title}
                    </p>
                    {ch.isR18 && (
                      <span className="px-1 py-0.2 bg-red-50 text-red-600 text-[8px] font-extrabold rounded-sm border border-red-100 scale-90 shrink-0">
                        R18
                      </span>
                    )}
                  </div>
                  
                  {/* Author / Wordcount or Meta info */}
                  <p className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1.5 font-medium">
                    <span>{new Date(ch.createdAt).toLocaleDateString()}</span>
                    <span>•</span>
                    <span>{ch.content.length} 字</span>
                  </p>
                </div>
              </div>

              {/* Status / Navigation indicator */}
              <div className="shrink-0 pl-2 flex items-center gap-1.5">
                {isCurrent ? (
                  <span className="text-[10px] font-extrabold text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded-md animate-pulse">
                    正在阅读
                  </span>
                ) : user ? (
                  isRead ? (
                    <span className="flex items-center gap-0.5 text-[9px] text-emerald-600 font-bold bg-emerald-50 border border-emerald-100/50 px-1.5 py-0.5 rounded-md">
                      <Check className="h-3 w-3 text-emerald-600 stroke-[3px]" />
                      已读完
                    </span>
                  ) : isReading ? (
                    <span className="text-[9px] text-amber-600 font-bold bg-amber-50 border border-amber-100/50 px-1.5 py-0.5 rounded-md">
                      已读 {Math.round(progress)}%
                    </span>
                  ) : (
                    <span className="text-[9px] text-gray-400 bg-gray-50 border border-gray-150/40 px-1.5 py-0.5 rounded-md">
                      未读
                    </span>
                  )
                ) : (
                  <ArrowRight className="h-3 w-3 text-gray-300" />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
