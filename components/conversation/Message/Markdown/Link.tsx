'use client';

import React, { useRef, useMemo } from 'react';
import { cn } from '@/lib/utils';
import AudioPlayer from '@/components/conversation/Message/Audio';
// import Plyr from 'plyr-react';
// import 'plyr-react/plyr.css';

interface MediaProps {
  href: string;
}

const YoutubeEmbed: React.FC<MediaProps> = React.memo(({ href }) => {
  const embedUrl = useMemo(() => {
    const youtubeId = getYoutubeId(href);
    return youtubeId ? `https://www.youtube.com/embed/${youtubeId}` : null;
  }, [href]);

  if (!embedUrl) return null;

  return (
    <div className='w-96'>
      <div className='relative w-full aspect-video'>
        <iframe
          title={`YouTube video ${getYoutubeId(href)}`}
          className='absolute top-0 left-0 w-full h-full'
          src={embedUrl}
          allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'
          allowFullScreen
        />
      </div>
    </div>
  );
});

YoutubeEmbed.displayName = 'YoutubeEmbed';

const VideoPlayer: React.FC<MediaProps> = ({ href }) => (
  <div className='w-96'>
    <div className='relative w-full aspect-video'>
      {/* <Plyr
        source={{
          type: 'video',
          sources: [{ src: href, type: 'video/mp4' }],
        }}
        options={{
          controls: ['play', 'progress', 'current-time', 'mute', 'volume', 'fullscreen'],
        }}
      /> */}
      <video controls className='w-full h-full'>
        <source src={href} type='video/mp4' />
        Your browser does not support the video tag.
      </video>
    </div>
  </div>
);

const handleAnchorClick = (e: React.MouseEvent<HTMLAnchorElement>, targetRef: React.RefObject<HTMLAnchorElement>): void => {
  const href = e.currentTarget.getAttribute('href');
  if (href?.startsWith('#')) {
    e.preventDefault();
    targetRef.current?.scrollIntoView({ behavior: 'smooth' });
  }
};

const getYoutubeId = (url: string): string | null => {
  const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[7].length === 11 ? match[7] : null;
};

type MarkdownLinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement>;

const MarkdownLink: React.FC<MarkdownLinkProps> = React.memo(({ children, href, className, ...props }) => {
  const targetRef = useRef<HTMLAnchorElement>(null);
  const isExternal = href && !href.startsWith('#');
  
  // Memoize YouTube detection to prevent unnecessary recalculations
  const youtubeId = useMemo(() => {
    return href ? getYoutubeId(href) : null;
  }, [href]);
  
  const isVideo = href?.match(/\.(mp4|webm|ogg)$/i);
  const isAudio = href?.startsWith('http') && href?.match(/\.(wav|mp3|ogg|m4a|aac|flac)$/i);

  // Use the memoized YoutubeEmbed component for YouTube URLs
  if (youtubeId && href) {
    return <YoutubeEmbed href={href} />;
  }

  if (isAudio && href) {
    return (
      <div className='w-96 my-4'>
        <AudioPlayer src={href} autoplay={true} />
      </div>
    );
  }

  // if (isVideo) {
  //   return (
  //     <div className='w-96'>
  //       <div className='relative w-full aspect-video'>
  //         <Plyr
  //           source={{
  //             type: 'video',
  //             sources: [{ src: href, type: 'video/mp4' }],
  //           }}
  //           options={{
  //             controls: ['play', 'progress', 'current-time', 'mute', 'volume', 'fullscreen'],
  //           }}
  //         />
  //       </div>
  //     </div>
  //   );
  // }

  return (
    <a
      ref={targetRef}
      href={href}
      className={cn('underline hover:no-underline', className)}
      target={isExternal ? '_blank' : undefined}
      rel={isExternal ? 'noopener noreferrer' : undefined}
      // onClick={isExternal ? undefined : handleAnchorClick}
      {...props}
    >
      {children}
    </a>
  );
});

MarkdownLink.displayName = 'MarkdownLink';

export default MarkdownLink;
