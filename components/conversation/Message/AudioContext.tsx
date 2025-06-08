'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface AudioContextType {
  currentlyPlaying: string | null;
  setCurrentlyPlaying: (audioId: string | null) => void;
  stopAllAudio: () => void;
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

  const setCurrentlyPlaying = useCallback((audioId: string | null) => {
    setCurrentlyPlayingState(audioId);
  }, []);

  const stopAllAudio = useCallback(() => {
    setCurrentlyPlayingState(null);
  }, []);

  const value = {
    currentlyPlaying,
    setCurrentlyPlaying,
    stopAllAudio,
  };

  return <AudioContext.Provider value={value}>{children}</AudioContext.Provider>;
};
