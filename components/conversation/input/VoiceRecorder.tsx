import React, { useState, useRef, useCallback, useEffect } from 'react';
import { LuMic as Mic, LuSquare as Square } from 'react-icons/lu';
import { getCookie } from 'cookies-next';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
// Tooltip removed to fix infinite re-render issues
import { useCompany } from '@/components/interactive/useUser';

export interface VoiceRecorderProps {
  onSend: (message: string | object, uploadedFiles?: { [x: string]: string }) => Promise<void>;
  disabled: boolean;
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ onSend, disabled }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const silenceTimer = useRef<NodeJS.Timeout | null>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const stream = useRef<MediaStream | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const animationFrame = useRef<number>();
  const [ptt, setPtt] = useState(false);
  const { data: company } = useCompany();

  const AUDIO_WEBM = 'audio/webm';

  // Interface for window with voice debug
  interface WindowWithVoiceDebug extends Window {
    voiceDebugRun?: boolean;
    webkitAudioContext?: typeof AudioContext;
  }

  // Helper function to get supported MIME type
  const getSupportedMimeType = (): string => {
    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
      return 'audio/webm;codecs=opus';
    }
    if (MediaRecorder.isTypeSupported(AUDIO_WEBM)) {
      return AUDIO_WEBM;
    }
    if (MediaRecorder.isTypeSupported('audio/mp4')) {
      return 'audio/mp4';
    }
    if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
      return 'audio/ogg;codecs=opus';
    }
    if (MediaRecorder.isTypeSupported('audio/ogg')) {
      return 'audio/ogg';
    }
    return AUDIO_WEBM;
  };

  // Helper function to setup audio analysis
  const setupAudioAnalysis = async (audioStream: MediaStream): Promise<void> => {
    if (ptt) return;

    try {
      const AudioContextClass = window.AudioContext || (window as WindowWithVoiceDebug).webkitAudioContext;
      audioContext.current = new AudioContextClass();

      if (audioContext.current.state === 'suspended') {
        await audioContext.current.resume();
      }

      const source = audioContext.current.createMediaStreamSource(audioStream);
      analyser.current = audioContext.current.createAnalyser();
      analyser.current.fftSize = 256;
      source.connect(analyser.current);

      animationFrame.current = requestAnimationFrame(analyzeAudio);
    } catch (audioError) {
      console.warn('Audio analysis setup failed, continuing without silence detection:', audioError);
    }
  };

  // Helper function to setup MediaRecorder
  const setupMediaRecorder = (audioStream: MediaStream, mimeType: string): void => {
    mediaRecorder.current = new MediaRecorder(audioStream, { mimeType });
    audioChunks.current = [];

    mediaRecorder.current.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.current.push(event.data);
      }
    };

    mediaRecorder.current.onstop = () => {
      const audioBlob = new Blob(audioChunks.current, {
        type: mediaRecorder.current?.mimeType || mimeType,
      });

      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Audio = reader.result as string;
        const extension = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('ogg') ? 'ogg' : 'webm';

        // Create message object with TTS enabled for children
        const messageObject = company?.roleId === 4 || getCookie('agixt-tts') === 'true' ? { tts: 'true' } : '';

        onSend(messageObject, {
          [`recording.${extension}`]: base64Audio,
        });
      };
      reader.readAsDataURL(audioBlob);

      audioChunks.current = [];
    };

    mediaRecorder.current.onerror = (event) => {
      console.error('MediaRecorder error:', event);
      setError('Recording failed');
      stopRecording();
    };
  };

  // Helper function to handle errors with user-friendly messages
  const handleRecordingError = (err: unknown): void => {
    console.error('Error starting recording:', err);
    const errorMessage = err instanceof Error ? err.message : 'Failed to start recording';

    if (errorMessage.includes('Permission denied') || errorMessage.includes('NotAllowedError')) {
      setError('Microphone permission denied. Please enable microphone access and try again.');
    } else if (errorMessage.includes('NotFoundError') || errorMessage.includes('DevicesNotFoundError')) {
      setError('No microphone found. Please connect a microphone and try again.');
    } else if (errorMessage.includes('NotSupportedError')) {
      setError('Recording not supported in this browser. Try Chrome, Firefox, or Safari.');
    } else {
      setError(errorMessage);
    }

    stopRecording();
  };

  // Modern stopRecording using MediaRecorder API
  const stopRecording = useCallback(() => {
    if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
      mediaRecorder.current.stop();
    }

    if (stream.current) {
      stream.current.getTracks().forEach((track) => track.stop());
      stream.current = null;
    }

    if (audioContext.current) {
      audioContext.current.close();
      audioContext.current = null;
    }

    if (animationFrame.current) {
      cancelAnimationFrame(animationFrame.current);
      animationFrame.current = undefined;
    }

    if (silenceTimer.current) {
      clearTimeout(silenceTimer.current);
      silenceTimer.current = null;
    }

    analyser.current = null;
    setIsRecording(false);
    setError(null);
  }, []);

  const detectSilence = useCallback(
    (dataArray: Uint8Array) => {
      const sum = dataArray.reduce((a, b) => a + b, 0);
      const average = sum / dataArray.length;

      if (average < 5) {
        if (silenceTimer.current === null) {
          silenceTimer.current = setTimeout(() => {
            stopRecording();
          }, 1000);
        }
      } else {
        if (silenceTimer.current) {
          clearTimeout(silenceTimer.current);
          silenceTimer.current = null;
        }
      }
    },
    [stopRecording],
  );

  const analyzeAudio = useCallback(() => {
    if (!analyser.current) return;

    const dataArray = new Uint8Array(analyser.current.frequencyBinCount);
    analyser.current.getByteFrequencyData(dataArray);
    detectSilence(dataArray);

    animationFrame.current = requestAnimationFrame(analyzeAudio);
  }, [detectSilence]);

  const startRecording = useCallback(async () => {
    try {
      setError(null);

      // Check if MediaRecorder is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('MediaRecorder API is not supported in this browser');
      }

      // Request microphone access
      const audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
      });

      stream.current = audioStream;

      // Setup audio analysis for silence detection
      await setupAudioAnalysis(audioStream);

      // Setup MediaRecorder
      const mimeType = getSupportedMimeType();
      console.log('Using MediaRecorder with mimeType:', mimeType);

      setupMediaRecorder(audioStream, mimeType);

      // Start recording
      mediaRecorder.current?.start(100);
      setIsRecording(true);
    } catch (err) {
      handleRecordingError(err);
    }
  }, [setupAudioAnalysis, getSupportedMimeType, setupMediaRecorder, handleRecordingError]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Check if both Left Ctrl and Backquote are currently pressed
      if (event.getModifierState('Control') && event.code === 'Backquote' && !isRecording && !event.repeat) {
        setPtt(true);
        startRecording();
      }
    },
    [isRecording, startRecording],
  );

  const handleKeyUp = useCallback(
    (event: KeyboardEvent) => {
      // Stop recording when either key is released
      if (['ControlLeft', 'Backquote'].includes(event.code) && ptt) {
        stopRecording();
        setPtt(false);
      }
    },
    [ptt, stopRecording],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, [stopRecording]);

  const buttonTitle = error ? `Recording Error: ${error}` : isRecording ? 'Stop recording' : 'Start recording';

  return (
    <Button
      onClick={isRecording ? stopRecording : startRecording}
      disabled={disabled}
      title={buttonTitle}
      className={cn(
        'transition-all duration-300 ease-in-out rounded-full',
        isRecording ? 'w-10 bg-red-500 hover:bg-red-600' : 'w-10',
        error && 'border-2 border-red-500',
      )}
      size='icon'
      variant='ghost'
    >
      {isRecording ? <Square className='w-5 h-5' /> : <Mic className='w-5 h-5' />}
    </Button>
  );
};
