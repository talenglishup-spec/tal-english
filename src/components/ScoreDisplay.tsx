import React from 'react';

interface ScoreDisplayProps {
  score: number | null;
  transcript?: string;
  answer: string;
}

export default function ScoreDisplay({ score, transcript, answer }: ScoreDisplayProps) {
  if (score === null) {
    return null; // Don't show anything if no recording yet
  }

  let scoreColorClass = 'text-red-500';
  if (score >= 80) {
    scoreColorClass = 'text-green-500';
  } else if (score >= 50) {
    scoreColorClass = 'text-yellow-500';
  }

  return (
    <div className="flex flex-col items-center gap-6 p-6 bg-white rounded-xl shadow-md w-full max-w-md mx-auto mt-4">
      <div className="flex flex-col items-center">
        <span className="text-gray-500 text-sm uppercase tracking-wider font-semibold mb-2">Score</span>
        <div className={`text-6xl font-black ${scoreColorClass}`}>
          {score}
        </div>
      </div>

      <div className="flex flex-col gap-3 w-full mt-4 border-t pt-4">
        {transcript && (
          <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
            <span className="text-xs font-bold text-gray-400 block mb-1 uppercase">You said</span>
            <p className="text-gray-800 italic">"{transcript}"</p>
          </div>
        )}
        <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
          <span className="text-xs font-bold text-blue-400 block mb-1 uppercase">Answer</span>
          <p className="text-blue-900 font-medium">"{answer}"</p>
        </div>
      </div>
    </div>
  );
}
