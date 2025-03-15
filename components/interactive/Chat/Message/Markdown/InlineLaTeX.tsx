import React from 'react';
import Latex from 'react-latex-next';

interface InlineLatexProps {
  children: string;
}

export default function InlineLatex({ children }: InlineLatexProps): React.JSX.Element {
  return (
    <span className="inline-block">
      <Latex>{children}</Latex>
    </span>
  );
}