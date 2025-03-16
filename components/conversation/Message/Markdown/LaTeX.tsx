import React from 'react';
import 'katex/dist/katex.min.css';
import katex from 'katex';

interface LaTeXProps {
  children: string;
  display?: boolean;
}

export default function LaTeX({ children, display = false }: LaTeXProps) {
  const html = katex.renderToString(children, {
    displayMode: display,
    throwOnError: false,
    trust: true,
    strict: false
  });

  return (
    <span 
      className={display ? 'block my-4 text-center' : 'inline'}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}