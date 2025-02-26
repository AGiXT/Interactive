'use client';

import React, { useEffect, useState } from 'react';
import mermaid from 'mermaid';
import log from '@/components/jrg/next-log/log';

interface MermaidProps {
  chart: string;
}

let mermaidCount = 0;

const Mermaid: React.FC<MermaidProps> = ({ chart }) => {
  const [isClient, setIsClient] = useState(false);
  const [elementId] = useState(() => `mermaid-${++mermaidCount}`);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;

    try {
      mermaid.initialize({
        startOnLoad: false,
        theme: document.documentElement.classList.contains('dark') ? 'dark' : 'default',
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

  if (!isClient) {
    return null;
  }

  return (
    <div className="overflow-auto">
      <pre className="mermaid" id={elementId}>
        {chart}
      </pre>
    </div>
  );
};

export default Mermaid;
