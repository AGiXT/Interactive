import React from 'react';
import Latex from 'react-latex-next';

interface LatexBlockProps {
  children: string;
}

export default function LatexBlock({ children }: LatexBlockProps): React.JSX.Element {
  return (
    <div className="my-2 overflow-x-auto">
      <Latex>{children}</Latex>
    </div>
  );
}