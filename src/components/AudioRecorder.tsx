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

    // Auto-start logic
    useEffect(() => {
        if (!disabled && !isRecording) {
            startRecording();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Run once on mount

    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            if (mediaRecorderRef.current && isRecording) {
                mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
            }
        };
    }, [isRecording]);

    const startRecording = async () => {
        try {
            // Mobile Safari check / standard getUserMedia
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });

            let mimeType = 'audio/webm';
            if (MediaRecorder.isTypeSupported('audio/mp4')) {
                mimeType = 'audio/mp4'; // iOS Safari prefer
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
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setIsRecording(true);
            setRecordingTime(0);

            if (timerRef.current) clearInterval(timerRef.current);
            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);

        } catch (err: any) {
            console.error('Error accessing microphone:', err);
            // Alert user on mobile if this fails so they know WHY it's 0:00
            alert(`Microphone Error: ${err.message || err.name}. Please ensure permissions are allowed.`);
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
            {/* Timer Display */}
            <div className={styles.timerLarge}>
                {formatTime(recordingTime)}
            </div>

            <div className={styles.controls}>
                {!isRecording ? (
                    <button
                        className={styles.recordButton}
                        onClick={startRecording}
                        disabled={disabled}
                    >
                        <div className={styles.micIcon}>🎤</div>
                        <span>Tap to Record</span>
                    </button>
                ) : (
                    <button
                        className={`${styles.recordButton} ${styles.stopButton}`}
                        onClick={stopRecording}
                    >
                        <div className={styles.stopIcon} />
                    </button>
                )}
            </div>
            {isRecording && <div className={styles.statusText}>Recording...</div>}
        </div>
    );
}
