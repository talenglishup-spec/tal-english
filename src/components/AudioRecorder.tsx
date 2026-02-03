'use client';

import React, { useState, useRef, useEffect } from 'react';
import styles from './AudioRecorder.module.css';

interface AudioRecorderProps {
    onRecordingComplete: (audioBlob: Blob) => void;
    disabled?: boolean;
}

export default function AudioRecorder({ onRecordingComplete, disabled }: AudioRecorderProps) {
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            // Determine efficient mime type for mobile
            let mimeType = 'audio/webm';
            if (MediaRecorder.isTypeSupported('audio/mp4')) {
                mimeType = 'audio/mp4'; // Better for iOS
            } else if (MediaRecorder.isTypeSupported('audio/aac')) {
                mimeType = 'audio/aac';
            }

            const mediaRecorder = new MediaRecorder(stream, { mimeType });
            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunksRef.current.push(e.data);
                }
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: mimeType });
                onRecordingComplete(blob);
                // Stop all tracks
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setIsRecording(true);
            setRecordingTime(0);

            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);

        } catch (err) {
            console.error('Error accessing microphone:', err);
            alert('Microphone access is required to record audio.');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            if (timerRef.current) clearInterval(timerRef.current);
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className={styles.container}>
            <div className={styles.visualizer}>
                {isRecording ? formatTime(recordingTime) : 'Ready'}
            </div>

            <div className={styles.controls}>
                {!isRecording ? (
                    <button
                        className={styles.recordButton}
                        onClick={startRecording}
                        disabled={disabled}
                        aria-label="Start Recording"
                    >
                        <svg viewBox="0 0 24 24">
                            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                        </svg>
                    </button>
                ) : (
                    <button
                        className={`${styles.recordButton} ${styles.recording}`}
                        onClick={stopRecording}
                        aria-label="Stop Recording"
                    >
                        <div style={{ width: '24px', height: '24px', background: 'white', borderRadius: '4px' }} />
                    </button>
                )}
            </div>
            <div className={styles.timer}>
                {isRecording ? 'Recording...' : 'Tap mic to record'}
            </div>
        </div>
    );
}
