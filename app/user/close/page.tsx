'use client';
import { useEffect } from 'react';

export type CloseProps = {};

export function Close() {
  useEffect(() => {
    window.close();
  }, []);

  return null;
}
