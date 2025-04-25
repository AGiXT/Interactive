import React from 'react';
import { MathJax, MathJaxContext } from 'better-react-mathjax';

interface LaTeXProps {
  children: string;
  display?: boolean;
}

export default function LaTeX({ children, display = false }: LaTeXProps) {
  // Since the preprocessor may have removed delimiters, re-add them based on display or inline mode
  // const content = children.trim(); // No longer needed, preprocessor keeps delimiters
  // const formattedContent = display ? `$$${content}$$` : `$${content}$`; // No longer needed
  const content = children; // Use children directly as it contains delimiters

  // Configuration for MathJax
  const config = {
    loader: { load: ["input/tex", "output/chtml"] },
    tex: {
      inlineMath: [['$', '$'], ['\\(', '\\)']],
      displayMath: [['$$', '$$'], ['\\[', '\\]']],
      processEscapes: true,
      processEnvironments: true
    },
    chtml: {
      scale: 1.0
    }
  };

  try {
    return (
      <MathJaxContext config={config}>
        <MathJax
          className={display ? 'block my-4 text-center' : 'inline'}
          inline={!display}
        >
          {content}
        </MathJax>
      </MathJaxContext>
    );
  } catch (error) {
    console.error("Error rendering LaTeX with MathJax:", error, "Content:", children);
    return (
      <span className={display ? 'block my-4 text-center text-red-500' : 'inline text-red-500'}>
        LaTeX rendering failed: Unsupported content or syntax error.
      </span>
    );
  }
}