'use client';

import React, { ReactNode } from 'react';
import Image from 'next/image';

export interface ImageProps {
  src?: string;
  alt?: string;
  className?: string;
  width?: string | number;
  height?: string | number;
  title?: string;
}

export default function MarkdownImage({ src, alt, className, width, height, title, ...props }: ImageProps): ReactNode {
  if (!src) return null;

  const isAGIXTServer = src.startsWith(process.env.NEXT_PUBLIC_AGIXT_SERVER as string);
  
  let isBadge = false;
  try {
    const url = new URL(src);
    const allowedHosts = ['shields.io'];
    isBadge = src.includes('badge') || allowedHosts.includes(url.host);
  } catch (e) {
    console.error(`Invalid URL: ${src}`);
  }
  let finalAlt = alt || '';
  let finalWidth = width;
  let finalHeight = height;

  // Parse size attributes from markdown ![alt](url =100x200)
  if (finalAlt) {
    const sizeMatch = finalAlt.match(/=(\d+)x(\d+)$/);
    if (sizeMatch) {
      finalWidth = sizeMatch[1];
      finalHeight = sizeMatch[2];
      finalAlt = finalAlt.replace(/=\d+x\d+$/, '').trim();
    }
  }

  // Handle markdown image dimensions in URL
  if (!finalWidth && !finalHeight && src) {
    const urlSizeMatch = src.match(/\s*=(\d+)x(\d+)$/);
    if (urlSizeMatch) {
      finalWidth = urlSizeMatch[1];
      finalHeight = urlSizeMatch[2];
    }
  }

  const imageStyle = {
    maxWidth: '100%',
    height: 'auto',
    ...(finalWidth && { width: finalWidth }),
    ...(finalHeight && { height: finalHeight })
  };

  const containerStyle = `
    relative inline-flex items-center justify-center
    ${isBadge ? 'h-6' : 'w-full max-w-full my-4'}
    ${className || ''}
  `.replace(/\s+/g, ' ').trim();

  const imageClassName = `
    rounded-md
    ${isBadge ? 'object-contain object-center' : 'object-contain object-left-top'}
    transition-opacity duration-300 ease-in-out
    hover:opacity-90
  `.replace(/\s+/g, ' ').trim();

  const handleError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    img.style.display = 'none';
    console.error(`Failed to load image: ${src}`);
  };

  return (
    <span className={containerStyle} {...props}>
      {isAGIXTServer ? (
        <Image
          src={src}
          alt={finalAlt}
          title={title || finalAlt}
          fill={!finalWidth && !finalHeight}
          width={finalWidth ? parseInt(String(finalWidth)) : undefined}
          height={finalHeight ? parseInt(String(finalHeight)) : undefined}
          className={imageClassName}
          loading="lazy"
          quality={90}
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          style={imageStyle}
          onError={handleError}
        />
      ) : (
        <img
          src={src}
          alt={finalAlt}
          title={title || finalAlt}
          className={imageClassName}
          loading="lazy"
          style={imageStyle}
          onError={handleError}
        />
      )}
    </span>
  );
}