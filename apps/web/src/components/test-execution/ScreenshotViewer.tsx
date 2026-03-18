import { useState } from 'react';
import { Camera, X, ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
  screenshots: Array<{ stepIndex: number; url: string }>;
}

export function ScreenshotViewer({ screenshots }: Props) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  if (screenshots.length === 0) return null;

  return (
    <>
      <div className="space-y-2">
        <h3 className="flex items-center gap-2 text-sm font-medium text-gray-300">
          <Camera size={14} />
          스크린샷 ({screenshots.length})
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {screenshots.map((ss, i) => (
            <button
              key={i}
              onClick={() => setSelectedIndex(i)}
              className="group relative rounded-lg border border-gray-800 overflow-hidden hover:border-primary-600/50 transition-colors"
            >
              <img
                src={ss.url}
                alt={`${ss.stepIndex}단계`}
                className="w-full h-24 object-cover object-top"
              />
              <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-xs px-2 py-1 text-gray-300">
                #{ss.stepIndex}단계
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 라이트박스 */}
      {selectedIndex !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setSelectedIndex(null)}
        >
          <div className="relative max-w-4xl w-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setSelectedIndex(null)}
              className="absolute -top-10 right-0 p-1 text-gray-400 hover:text-white"
            >
              <X size={20} />
            </button>

            <img
              src={screenshots[selectedIndex].url}
              alt={`${screenshots[selectedIndex].stepIndex}단계`}
              className="w-full rounded-lg"
            />

            <div className="flex justify-between mt-3">
              <button
                onClick={() => setSelectedIndex(Math.max(0, selectedIndex - 1))}
                disabled={selectedIndex === 0}
                className="flex items-center gap-1 px-3 py-1 rounded text-sm bg-gray-800 hover:bg-gray-700 disabled:opacity-50"
              >
                <ChevronLeft size={14} /> 이전
              </button>
              <span className="text-sm text-gray-400">
                #{screenshots[selectedIndex].stepIndex}단계 ({selectedIndex + 1}/{screenshots.length})
              </span>
              <button
                onClick={() => setSelectedIndex(Math.min(screenshots.length - 1, selectedIndex + 1))}
                disabled={selectedIndex === screenshots.length - 1}
                className="flex items-center gap-1 px-3 py-1 rounded text-sm bg-gray-800 hover:bg-gray-700 disabled:opacity-50"
              >
                다음 <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
