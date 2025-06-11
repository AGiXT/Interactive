import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Volume2, Play, Pause, Loader2 } from 'lucide-react';
import { useAudioContext } from './AudioContext';

interface AudioPlayerProps {
  src: string;
  autoplay?: boolean;
}

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export default function AudioPlayer({ src, autoplay = false }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [audio] = useState(new Audio());
  const [canAutoplay, setCanAutoplay] = useState(false);
  const audioIdRef = useRef<string>(`audio-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);

  const { currentlyPlaying, setCurrentlyPlaying, registerAudioPlayer, unregisterAudioPlayer } = useAudioContext();

  // Register this audio player with the context
  useEffect(() => {
    const audioId = audioIdRef.current;
    registerAudioPlayer(audioId, autoplay, setCanAutoplay, audio);

    return () => {
      unregisterAudioPlayer(audioId);
    };
  }, [autoplay, registerAudioPlayer, unregisterAudioPlayer, audio]);

  // Cleanup audio element on unmount
  useEffect(() => {
    return () => {
      audio.pause();
      if (audioSrc) {
        URL.revokeObjectURL(audioSrc);
      }
    };
  }, [audio, audioSrc]);

  // Effect to handle global audio state changes
  useEffect(() => {
    if (currentlyPlaying && currentlyPlaying !== audioIdRef.current && isPlaying) {
      // Another audio is playing, pause this one
      audio.pause();
      setIsPlaying(false);
    }
  }, [currentlyPlaying, isPlaying, audio]);

  useEffect(() => {
    const loadAudio = async () => {
      try {
        const response = await fetch(src);
        if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        setAudioSrc(url);
      } catch (err: any) {
        setError(`Error loading audio: ${err.message}`);
        setLoading(false);
      }
    };
    loadAudio();
  }, [src]);

  useEffect(() => {
    if (!audioSrc) return;

    const handleCanPlay = async () => {
      setLoading(false);
      // Only attempt autoplay if this player has been granted permission
      if (autoplay && canAutoplay) {
        try {
          await audio.play();
          setIsPlaying(true);
          setCurrentlyPlaying(audioIdRef.current);
        } catch (err: any) {
          console.warn('Autoplay blocked:', err.message);
        }
      }
    };
    const handleError = (e: any) => {
      console.error('Audio error:', e, audio.error);
      setError(`Audio error: ${audio.error?.message || 'Unknown error'}`);
      setLoading(false);
    };

    const handleLoadMetadata = () => setDuration(audio.duration);
    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentlyPlaying(null);
    };

    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('error', handleError);
    audio.addEventListener('loadedmetadata', handleLoadMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    audio.src = audioSrc;
    audio.load();

    return () => {
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('loadedmetadata', handleLoadMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      URL.revokeObjectURL(audioSrc);
    };
  }, [audio, audioSrc, autoplay, canAutoplay, setCurrentlyPlaying]);

  const togglePlay = async () => {
    try {
      if (isPlaying) {
        audio.pause();
        setCurrentlyPlaying(null);
      } else {
        // When manually playing, we always get permission (this overrides autoplay coordination)
        await audio.play();
        setCurrentlyPlaying(audioIdRef.current);
      }
      setIsPlaying(!isPlaying);
    } catch (err: any) {
      setError(`Playback failed: ${err.message}`);
    }
  };

  const handleSliderChange = (value: number[]) => {
    const newTime = value[0];
    setCurrentTime(newTime);
    audio.currentTime = newTime;
  };

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0];
    setVolume(newVolume);
    audio.volume = newVolume;
  };

  if (loading)
    return (
      <div className='flex items-center justify-center p-4 gap-2'>
        <Loader2 className='h-6 w-6 animate-spin' />
        <span>Loading audio...</span>
      </div>
    );

  if (error)
    return (
      <div className='text-red-500 p-4 border rounded bg-red-50'>
        <p>{error}</p>
        <button onClick={() => window.location.reload()} className='mt-2 text-sm underline'>
          Reload page
        </button>
      </div>
    );

  return (
    <div className='flex items-center gap-4 w-full max-w-xl p-4 bg-background rounded-lg border'>
      <Button variant='ghost' size='icon' onClick={togglePlay} className='h-8 w-8'>
        {isPlaying ? <Pause size={20} /> : <Play size={20} />}
      </Button>

      <span className='text-sm min-w-16'>{formatTime(currentTime)}</span>

      <div className='flex-1'>
        <Slider
          value={[currentTime]}
          max={duration || 100}
          step={0.1}
          onValueChange={handleSliderChange}
          className='w-full'
        />
      </div>

      <span className='text-sm min-w-16'>{formatTime(duration || 0)}</span>

      <div className='flex items-center gap-2'>
        <Volume2 size={20} />
        <Slider value={[volume]} max={1} step={0.1} onValueChange={handleVolumeChange} className='w-20' />
      </div>
    </div>
  );
}
