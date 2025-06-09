'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode, useRef } from 'react';

interface AudioPlayerInstance {
  id: string;
  wantsAutoplay: boolean;
  createdAt: number;
  setCanAutoplay: (canAutoplay: boolean) => void;
}

interface AudioContextType {
  currentlyPlaying: string | null;
  setCurrentlyPlaying: (audioId: string | null) => void;
  stopAllAudio: () => void;
  registerAudioPlayer: (id: string, wantsAutoplay: boolean, setCanAutoplay: (canAutoplay: boolean) => void) => void;
  unregisterAudioPlayer: (id: string) => void;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export const useAudioContext = () => {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error('useAudioContext must be used within an AudioProvider');
  }
  return context;
};

interface AudioProviderProps {
  children: ReactNode;
}

export const AudioProvider: React.FC<AudioProviderProps> = ({ children }) => {
  const [currentlyPlaying, setCurrentlyPlayingState] = useState<string | null>(null);
  const audioPlayersRef = useRef<Map<string, AudioPlayerInstance>>(new Map());
  const autoplayTimerRef = useRef<NodeJS.Timeout | null>(null);

  const setCurrentlyPlaying = useCallback((audioId: string | null) => {
    setCurrentlyPlayingState(audioId);
  }, []);

  const stopAllAudio = useCallback(() => {
    setCurrentlyPlayingState(null);
  }, []);

  const registerAudioPlayer = useCallback((
    id: string, 
    wantsAutoplay: boolean, 
    setCanAutoplay: (canAutoplay: boolean) => void
  ) => {
    const player: AudioPlayerInstance = {
      id,
      wantsAutoplay,
      createdAt: Date.now(),
      setCanAutoplay,
    };
    
    audioPlayersRef.current.set(id, player);

    // If this player wants autoplay, we need to determine if it should be allowed
    if (wantsAutoplay) {
      // Clear any existing timer
      if (autoplayTimerRef.current) {
        clearTimeout(autoplayTimerRef.current);
      }

      // Set a short delay to allow for other audio players to register
      // The last one to register within this timeframe will get autoplay
      autoplayTimerRef.current = setTimeout(() => {
        // Find the most recent audio player that wants autoplay
        let mostRecentPlayer: AudioPlayerInstance | null = null;
        
        for (const player of audioPlayersRef.current.values()) {
          if (player.wantsAutoplay) {
            if (!mostRecentPlayer || player.createdAt > mostRecentPlayer.createdAt) {
              mostRecentPlayer = player;
            }
          }
        }

        // Grant autoplay permission only to the most recent player
        for (const player of audioPlayersRef.current.values()) {
          if (player.wantsAutoplay) {
            player.setCanAutoplay(player.id === mostRecentPlayer?.id);
          }
        }
      }, 100); // Small delay to allow multiple players to register
    }
  }, []);

  const unregisterAudioPlayer = useCallback((id: string) => {
    audioPlayersRef.current.delete(id);
    
    // If this was the currently playing audio, clear it
    if (currentlyPlaying === id) {
      setCurrentlyPlaying(null);
    }
  }, [currentlyPlaying, setCurrentlyPlaying]);

  const value = {
    currentlyPlaying,
    setCurrentlyPlaying,
    stopAllAudio,
    registerAudioPlayer,
    unregisterAudioPlayer,
  };

  return <AudioContext.Provider value={value}>{children}</AudioContext.Provider>;
};
