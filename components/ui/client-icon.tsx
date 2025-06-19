'use client';

import { useEffect, useState } from 'react';
import { LucideIcon } from 'lucide-react';

interface ClientIconProps {
  icon: LucideIcon;
  className?: string;
  fallback?: React.ReactNode;
}

/**
 * A wrapper component for Lucide icons that prevents hydration mismatches
 * by suppressing hydration warnings and only rendering the icon after client mount
 */
export function ClientIcon({ icon: Icon, className, fallback = null }: ClientIconProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // During SSR and initial render, show a placeholder
  if (!isMounted) {
    return (
      <span
        className={className || 'w-4 h-4'}
        style={{
          display: 'inline-block',
          width: '1rem',
          height: '1rem',
          minWidth: '1rem',
          minHeight: '1rem',
        }}
        aria-hidden="true"
        suppressHydrationWarning
      >
        {fallback}
      </span>
    );
  }

  // After mounting on client, render the actual icon
  return <Icon className={className} suppressHydrationWarning />;
}
