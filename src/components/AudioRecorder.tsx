'use client';

import React, { useState, useRef, useEffect } from 'react';
import styles from './AudioRecorder.module.css';

interface AudioRecorderProps {
    onRecordingComplete: (audioBlob: Blob, duration_sec: number) => void;
    disabled?: boolean;
    silenceDuration?: number; // ms to wait after speech stops
    autoStop?: boolean; // enable VAD
    minVolume?: number; // 0-255 threshold
}

export default function AudioRecorder({
    onRecordingComplete,
    disabled,
    silenceDuration = 1500,
    autoStop = true,
    minVolume = 5
}: AudioRecorderProps) {
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [isListeningForSilence, setIsListeningForSilence] = useState(false);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);

    // VAD Refs
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
    const speechDetectedRef = useRef(false);
    const animationFrameRef = useRef<number | null>(null);

    // Timer Logic
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
            stopVAD();
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
                mediaRecorderRef.current.stop();
            }
        };
    }, []);

    const stopVAD = () => {
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        if (audioContextRef.current) {
            audioContextRef.current.close().catch(e => console.error(e));
            audioContextRef.current = null;
        }
        speechDetectedRef.current = false;
        setIsListeningForSilence(false);
    };

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
                onRecordingComplete(blob, recordingTime);
                stopVAD();
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setIsRecording(true);

            // Start VAD if enabled
            if (autoStop) {
                setupVAD(stream);
            }

        } catch (err: any) {
            console.error('Error accessing microphone:', err);
            if (err.name === 'NotAllowedError' || err.name === 'SecurityError') {
                alert('Microphone recording was blocked. Please check permissions.');
            }
        }
    };

    const setupVAD = async (stream: MediaStream) => {
        try {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            const audioCtx = new AudioContextClass();
            if (audioCtx.state === 'suspended') {
                await audioCtx.resume();
            }
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 512;

            const source = audioCtx.createMediaStreamSource(stream);
            source.connect(analyser);

            audioContextRef.current = audioCtx;
            analyserRef.current = analyser;
            sourceRef.current = source;
            speechDetectedRef.current = false;
            setIsListeningForSilence(true);

            monitorAudio();
        } catch (e) {
            console.error("VAD Setup Failed", e);
        }
    };

    const monitorAudio = () => {
        if (!analyserRef.current || !mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') return;

        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyserRef.current.getByteFrequencyData(dataArray);

        // Calculate average volume or max
        let maxVol = 0;
        for (let i = 0; i < bufferLength; i++) {
            if (dataArray[i] > maxVol) maxVol = dataArray[i];
        }

        if (maxVol > minVolume) {
            // Speech active
            speechDetectedRef.current = true;
            // Reset silence timer
            if (silenceTimerRef.current) {
                clearTimeout(silenceTimerRef.current);
                silenceTimerRef.current = null;
            }
        } else {
            // Silence
            if (speechDetectedRef.current && !silenceTimerRef.current) {
                // Start silence timer
                silenceTimerRef.current = setTimeout(() => {
                    // Stop recording!
                    stopRecording();
                }, silenceDuration);
            }
        }

        animationFrameRef.current = requestAnimationFrame(monitorAudio);
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
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
            {isRecording && (
                <div className={styles.statusText}>
                    {isListeningForSilence
                        ? (speechDetectedRef.current ? "Listening..." : "Speak now...")
                        : "Recording..."}
                </div>
            )}
        </div>
    );
}
