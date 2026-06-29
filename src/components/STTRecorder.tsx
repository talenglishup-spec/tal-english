'use client';

import React, { useState, useRef } from 'react';
import { getSupabase } from '@/utils/supabase';

interface STTRecorderProps {
  answer: string;
  onScore: (result: { score: number; transcript: string }) => void;
  onRecording?: (isRecording: boolean) => void;
}

export default function STTRecorder({ answer, onScore, onRecording }: STTRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await handleAudioUpload(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      if (onRecording) onRecording(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('마이크 접근 권한이 필요합니다.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      setIsRecording(false);
      if (onRecording) onRecording(false);
    }
  };

  const handleAudioUpload = async (audioBlob: Blob) => {
    setIsLoading(true);
    try {
      const supabase = getSupabase();
      
      // Temporary player_id for Phase 2 spec until session logic is fully wired
      const playerId = 'standard';
      const timestamp = Date.now();
      const filePath = `${playerId}/${timestamp}.webm`;

      const { data, error: uploadError } = await supabase.storage
        .from('audio-player')
        .upload(filePath, audioBlob, {
          contentType: 'audio/webm',
        });

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from('audio-player')
        .getPublicUrl(filePath);

      const audioUrl = publicUrlData.publicUrl;

      // Call score API
      const response = await fetch('/api/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audio_url: audioUrl,
          answer: answer,
          player_id: playerId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get score');
      }

      const result = await response.json();
      onScore(result);
    } catch (error) {
      console.error('Error in audio processing pipeline:', error);
      alert('오디오 처리 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 p-4">
      {isLoading ? (
        <div className="text-blue-500 font-semibold animate-pulse">분석 중...</div>
      ) : (
        <button
          onClick={isRecording ? stopRecording : startRecording}
          className={`w-32 h-32 rounded-full flex items-center justify-center text-white text-xl font-bold transition-all shadow-lg ${
            isRecording ? 'bg-red-500 hover:bg-red-600 animate-pulse' : 'bg-blue-500 hover:bg-blue-600'
          }`}
        >
          {isRecording ? '완료' : '말하기'}
        </button>
      )}
    </div>
  );
}
