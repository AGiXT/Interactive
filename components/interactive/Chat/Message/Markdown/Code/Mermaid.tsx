'use client';

import React, { useEffect, useState } from 'react';
import mermaid from 'mermaid';
import log from '@/components/idiot/next-log/log';

interface MermaidProps {
  chart: string;
}

let mermaidCount = 0;

const Mermaid: React.FC<MermaidProps> = ({ chart }) => {
  const [isClient, setIsClient] = useState(false);
  const [elementId] = useState(() => `mermaid-${++mermaidCount}`);
  const [scale, setScale] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;

    try {
      const isDark = document.documentElement.classList.contains('dark');
      mermaid.initialize({
        startOnLoad: false,
        theme: isDark ? 'dark' : 'default',
        themeVariables: {
          primaryColor: isDark ? '#525252' : '#737373',
          primaryTextColor: isDark ? '#E5E7EB' : '#1F2937',
          primaryBorderColor: isDark ? '#525252' : '#737373',
          lineColor: isDark ? '#525252' : '#737373',
          secondaryColor: isDark ? '#525252' : '#737373',
          tertiaryColor: isDark ? '#525252' : '#737373',
          textColor: isDark ? '#E5E7EB' : '#1F2937',
          mainBkg: isDark ? '#1F2937' : '#FFFFFF',
          nodeBorder: isDark ? '#525252' : '#737373',
          clusterBkg: isDark ? '#374151' : '#F3F4F6',
          labelBackgroundColor: isDark ? '#374151' : '#F3F4F6',
          noteTextColor: isDark ? '#E5E7EB' : '#1F2937',
          noteBkgColor: isDark ? '#374151' : '#F3F4F6',
          noteBorderColor: isDark ? '#525252' : '#737373',
          actorBorder: isDark ? '#525252' : '#737373',
          actorBkg: isDark ? '#374151' : '#F3F4F6',
          actorTextColor: isDark ? '#E5E7EB' : '#1F2937',
          actorLineColor: isDark ? '#525252' : '#737373',
          signalColor: isDark ? '#525252' : '#737373',
          signalTextColor: isDark ? '#E5E7EB' : '#1F2937',
          labelBoxBkgColor: isDark ? '#374151' : '#F3F4F6',
          labelBoxBorderColor: isDark ? '#525252' : '#737373',
          labelTextColor: isDark ? '#E5E7EB' : '#1F2937',
          loopTextColor: isDark ? '#E5E7EB' : '#1F2937',
          activationBorderColor: isDark ? '#525252' : '#737373',
          activationBkgColor: isDark ? '#374151' : '#F3F4F6',
          sequenceNumberColor: isDark ? '#E5E7EB' : '#1F2937',
        },
        securityLevel: 'loose',
        fontFamily: 'Fira Code',
      });

      void mermaid.run({
        querySelector: `#${elementId}`,
      });
    } catch (error) {
      console.error('Mermaid error:', error);
    }
  }, [isClient, elementId, chart]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const ZOOM_STEP = 0.25;
  const MIN_SCALE = 0.25;
  const MAX_SCALE = 3;

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY * -0.002;
    const newScale = Math.min(Math.max(MIN_SCALE, scale + delta), MAX_SCALE);
    setScale(newScale);
  };

  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + ZOOM_STEP, MAX_SCALE));
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(prev - ZOOM_STEP, MIN_SCALE));
  };

  if (!isClient) {
    return null;
  }

  return (
    <div className='relative border border-gray-200 dark:border-gray-700 rounded-lg p-4'>
      <div className='flex gap-2 mb-2'>
        <button
          onClick={handleZoomIn}
          className='px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-800 rounded hover:bg-gray-200 dark:hover:bg-gray-700'
          title='Zoom in'
        >
          +
        </button>
        <button
          onClick={handleZoomOut}
          className='px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-800 rounded hover:bg-gray-200 dark:hover:bg-gray-700'
          title='Zoom out'
        >
          -
        </button>
        <button
          onClick={() => {
            setScale(1);
            setPosition({ x: 0, y: 0 });
          }}
          className='px-2 py-1 text-sm bg-gray-100 dark:bg-gray-800 rounded hover:bg-gray-200 dark:hover:bg-gray-700'
        >
          Reset
        </button>
      </div>
      <div
        className='overflow-hidden cursor-move'
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <div
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transformOrigin: '0 0',
            transition: isDragging ? 'none' : 'transform 0.1s ease-out',
          }}
        >
          <pre className='mermaid' id={elementId}>
            {chart}
          </pre>
        </div>
      </div>
    </div>
  );
};

export default Mermaid;
