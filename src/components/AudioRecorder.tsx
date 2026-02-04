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

    // Timer Logic: Reactive to isRecording state
    useEffect(() => {
        let interval: NodeJS.Timeout | null = null;
        if (isRecording) {
            setRecordingTime(0);
            interval = setInterval(() => {
                setRecordingTime((prev) => prev + 1);
            }, 1000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [isRecording]);

    // Auto-start logic
    useEffect(() => {
        if (!disabled && !isRecording) {
            startRecording();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Cleanup Logic
    useEffect(() => {
        return () => {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
                mediaRecorderRef.current.stop();
            }
        };
    }, []);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });

            let mimeType = 'audio/webm';
            if (MediaRecorder.isTypeSupported('audio/mp4')) {
                mimeType = 'audio/mp4';
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
            // Timer is handled by useEffect now

        } catch (err: any) {
            console.error('Error accessing microphone:', err);
            // On iOS Safari, auto-play policies might block this.
            // If it fails, we assume user must tap manually.
            if (err.name === 'NotAllowedError' || err.name === 'SecurityError') {
                alert('Microphone recording was blocked or requires permission. Please tap the microphone button to start.');
            } else {
                // Squelch other errors or show subtle UI if needed
            }
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            // This triggers onstop event
            mediaRecorderRef.current.stop();
            setIsRecording(false);
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
