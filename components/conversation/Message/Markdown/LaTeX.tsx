import React from 'react';
import 'katex/dist/katex.min.css';
import katex from 'katex';

interface LaTeXProps {
  children: string;
  display?: boolean;
}

export default function LaTeX({ children, display = false }: LaTeXProps) {
  let html;
  try {
    html = katex.renderToString(children, {
      displayMode: display,
      throwOnError: false,
      trust: true,
      strict: false
    });
  } catch (error) {
    console.error("Error rendering LaTeX:", error, "Content:", children);
    return (
      <span className={display ? 'block my-4 text-center text-red-500' : 'inline text-red-500'}>
        [LaTeX rendering failed: Unsupported content. Please check console for details.]
      </span>
    );
  }

  return (
    <span
      className={display ? 'block my-4 text-center' : 'inline'}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}