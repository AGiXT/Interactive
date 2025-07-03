import React from 'react';
import { MathJax, MathJaxContext } from 'better-react-mathjax';

interface LaTeXProps {
  children: string;
  display?: boolean;
}

// MathJax configuration to support LaTeX environments like itemize
const config = {
  loader: { load: ["[tex]/html"] },
  tex: {
    packages: { "[+]": ["html"] },
    inlineMath: [
      ["$", "$"],
      ["\\(", "\\)"]
    ],
    displayMath: [
      ["$$", "$$"],
      ["\\[", "\\]"]
    ],
    processEscapes: true,
    processEnvironments: true
  },
  options: {
    enableMenu: false
  }
};

export default function LaTeX({ children, display = false }: LaTeXProps) {
  // Process the LaTeX content to ensure proper math delimiters
  const processLatexContent = (content: string): string => {
    // Remove existing delimiters if they exist
    let processedContent = content.replace(/^\$\$/, '').replace(/\$\$$/, '');
    processedContent = processedContent.replace(/^\$/, '').replace(/\$$/, '');
    processedContent = processedContent.replace(/^\\?\[/, '').replace(/\\?\]$/, '');
    processedContent = processedContent.replace(/^\\?\(/, '').replace(/\\?\)$/, '');
    
    // Add appropriate delimiters based on display mode
    if (display) {
      // For display math, wrap in \[ ... \] delimiters
      return `\\[${processedContent}\\]`;
    } else {
      // For inline math, wrap in \( ... \) delimiters
      return `\\(${processedContent}\\)`;
    }
  };

  const processedContent = processLatexContent(children);

  return (
    <MathJaxContext config={config}>
      <MathJax 
        className={display ? 'block my-4 text-center' : 'inline'}
        inline={!display}
      >
        {processedContent}
      </MathJax>
    </MathJaxContext>
  );
}