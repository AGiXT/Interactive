import React from 'react';
import 'katex/dist/katex.min.css';
import Latex from 'react-latex-next';

interface LaTeXProps {
  children: string;
  display?: boolean;
}

export default function LaTeX({ children, display = false }: LaTeXProps) {
  // If display mode, wrap in $$ for block equations
  const formula = display ? `$$${children}$$` : `$${children}$`;
  
  return (
    <span className={display ? 'block my-4 text-center' : 'inline'}>
      <Latex>{formula}</Latex>
    </span>
  );
}