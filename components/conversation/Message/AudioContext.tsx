'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';

interface AudioPlayerInstance {
  id: string;
  wantsAutoplay: boolean;
  createdAt: number;
  setCanAutoplay: (canAutoplay: boolean) => void;
  audioElement?: HTMLAudioElement;
}

interface AudioContextType {
  currentlyPlaying: string | null;
  setCurrentlyPlaying: (audioId: string | null) => void;
  stopAllAudio: () => void;
  registerAudioPlayer: (
    id: string,
    wantsAutoplay: boolean,
    setCanAutoplay: (canAutoplay: boolean) => void,
    audioElement?: HTMLAudioElement,
  ) => void;
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
  const pathname = usePathname();
  const prevPathnameRef = useRef(pathname);

  const setCurrentlyPlaying = useCallback((audioId: string | null) => {
    setCurrentlyPlayingState(audioId);
  }, []);

  const stopAllAudio = useCallback(() => {
    // Actually pause all audio elements
    for (const player of audioPlayersRef.current.values()) {
      if (player.audioElement) {
        player.audioElement.pause();
      }
    }
    setCurrentlyPlayingState(null);
  }, []);

  // Handle page/route changes
  useEffect(() => {
    if (pathname !== prevPathnameRef.current) {
      // Stop all audio when navigating to a different page
      stopAllAudio();

      // Clear the timer to prevent autoplay coordination from previous page
      if (autoplayTimerRef.current) {
        clearTimeout(autoplayTimerRef.current);
        autoplayTimerRef.current = null;
      }

      // Clear all registered players from previous page
      audioPlayersRef.current.clear();

      prevPathnameRef.current = pathname;
    }
  }, [pathname, stopAllAudio]);

  const findMostRecentAutoplayPlayer = useCallback(() => {
    let mostRecentPlayer: AudioPlayerInstance | null = null;

    for (const player of audioPlayersRef.current.values()) {
      if (player.wantsAutoplay && (!mostRecentPlayer || player.createdAt > mostRecentPlayer.createdAt)) {
        mostRecentPlayer = player;
      }
    }

    return mostRecentPlayer;
  }, []);

  const grantAutoplayPermissions = useCallback((mostRecentPlayer: AudioPlayerInstance | null) => {
    for (const player of audioPlayersRef.current.values()) {
      if (player.wantsAutoplay) {
        player.setCanAutoplay(player.id === mostRecentPlayer?.id);
      }
    }
  }, []);

  const registerAudioPlayer = useCallback(
    (
      id: string,
      wantsAutoplay: boolean,
      setCanAutoplay: (canAutoplay: boolean) => void,
      audioElement?: HTMLAudioElement,
    ) => {
      const player: AudioPlayerInstance = {
        id,
        wantsAutoplay,
        createdAt: Date.now(),
        setCanAutoplay,
        audioElement,
      };

      audioPlayersRef.current.set(id, player);

      // If this player wants autoplay, coordinate with other players
      if (wantsAutoplay) {
        // Clear any existing timer
        if (autoplayTimerRef.current) {
          clearTimeout(autoplayTimerRef.current);
        }

        // Set a delay to allow for other audio players to register
        // Increased delay for better coordination during page transitions
        autoplayTimerRef.current = setTimeout(() => {
          const mostRecentPlayer = findMostRecentAutoplayPlayer();
          grantAutoplayPermissions(mostRecentPlayer);
        }, 200); // Increased delay for better page transition handling
      }
    },
    [findMostRecentAutoplayPlayer, grantAutoplayPermissions],
  );

  const unregisterAudioPlayer = useCallback(
    (id: string) => {
      audioPlayersRef.current.delete(id);

      // If this was the currently playing audio, clear it
      if (currentlyPlaying === id) {
        setCurrentlyPlaying(null);
      }
    },
    [currentlyPlaying, setCurrentlyPlaying],
  );

  const value = {
    currentlyPlaying,
    setCurrentlyPlaying,
    stopAllAudio,
    registerAudioPlayer,
    unregisterAudioPlayer,
  };

  return <AudioContext.Provider value={value}>{children}</AudioContext.Provider>;
};
