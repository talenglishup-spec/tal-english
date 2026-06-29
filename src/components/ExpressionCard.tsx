import React, { useRef, useState } from 'react';

interface ExpressionCardProps {
  lcode: string;
  english: string;
  korean: string;
  situation: string;
  pronunciationHint?: string;
  audioUrl?: string;
}

export default function ExpressionCard({
  lcode,
  english,
  korean,
  situation,
  pronunciationHint,
  audioUrl
}: ExpressionCardProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const handlePlay = () => {
    if (audioRef.current && audioUrl) {
      if (isPlaying) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col items-center p-8 w-full max-w-md mx-auto relative group transition-all duration-300 hover:shadow-2xl">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-400 to-indigo-500" />
      
      <div className="w-full flex justify-between items-start mb-6">
        <span className="bg-blue-100 text-blue-800 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">
          {lcode}
        </span>
        {audioUrl && (
          <button 
            onClick={handlePlay}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-md ${
              isPlaying 
                ? 'bg-indigo-600 text-white animate-pulse' 
                : 'bg-white text-indigo-600 hover:bg-indigo-50'
            }`}
          >
            {/* Minimal Play icon representation if lucide is missing, else replace with lucide-react */}
            <svg 
              className="w-5 h-5 ml-1" 
              fill="currentColor" 
              viewBox="0 0 20 20"
            >
              <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
            </svg>
            <audio ref={audioRef} src={audioUrl} onEnded={handleEnded} />
          </button>
        )}
      </div>

      <div className="text-center flex-grow flex flex-col justify-center mb-6">
        <h2 className="text-5xl font-extrabold text-gray-900 tracking-tight leading-tight mb-2">
          {english}
        </h2>
        {pronunciationHint && (
          <p className="text-gray-400 font-medium tracking-wide mb-4">
            [{pronunciationHint}]
          </p>
        )}
      </div>

      <div className="w-full space-y-3 pt-6 border-t border-gray-100">
        <div className="flex items-start gap-2">
          <span className="text-blue-500 font-semibold text-sm shrink-0 mt-0.5">의미</span>
          <p className="text-gray-700 font-medium text-lg">{korean}</p>
        </div>
        <div className="flex items-start gap-2">
          <span className="text-blue-500 font-semibold text-sm shrink-0 mt-0.5">상황</span>
          <p className="text-gray-600 text-sm leading-relaxed">{situation}</p>
        </div>
      </div>
    </div>
  );
}
