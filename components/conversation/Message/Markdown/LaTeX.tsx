import React from 'react';
import { MathJax, MathJaxContext } from 'better-react-mathjax';

interface LaTeXProps {
  children: string;
  display?: boolean;
}

// MathJax configuration optimized for math expressions and basic environments
const config = {
  loader: { 
    load: ["[tex]/html", "[tex]/ams", "[tex]/newcommand", "[tex]/configmacros", "[tex]/action"] 
  },
  tex: {
    packages: { 
      "[+]": ["html", "ams", "newcommand", "configmacros", "action"] 
    },
    inlineMath: [
      ["$", "$"],
      ["\\(", "\\)"]
    ],
    displayMath: [
      ["$$", "$$"],
      ["\\[", "\\]"]
    ],
    processEscapes: true,
    processEnvironments: true,
    macros: {
      "\\item": "\\text{• }",
      "\\begin{itemize}": "\\begin{array}{l}",
      "\\end{itemize}": "\\end{array}",
      "\\begin{enumerate}": "\\begin{array}{l}",
      "\\end{enumerate}": "\\end{array}",
      "\\begin{inparaitem}": "",
      "\\end{inparaitem}": "",
      "\\begin{document}": "",
      "\\end{document}": "",
      "\\documentclass": ["", 1],
      "\\usepackage": ["", 1],
      "\\maketitle": "",
      "\\title": ["", 1],
      "\\author": ["", 1],
      "\\date": ["", 1],
      "\\section": ["\\text{\\textbf{#1}}\\\\", 1],
      "\\subsection": ["\\text{\\textbf{#1}}\\\\", 1],
      "\\subsubsection": ["\\text{\\textbf{#1}}\\\\", 1],
      "\\textbf": ["\\mathbf{\\text{#1}}", 1],
      "\\textit": ["\\mathit{\\text{#1}}", 1],
      "\\emph": ["\\mathit{\\text{#1}}", 1],
      "\\paragraph": ["\\text{\\textbf{#1}}", 1],
      "\\subparagraph": ["\\text{\\textbf{#1}}", 1]
    }
  },
  options: {
    enableMenu: false
  }
};

// Function to process complex LaTeX documents that MathJax can't handle
const processComplexLatex = (content: string): string => {
  let processed = content;
  
  // Handle document structure
  processed = processed.replace(/\\documentclass\{[^}]*\}/g, '');
  processed = processed.replace(/\\usepackage(\[[^\]]*\])?\{[^}]*\}/g, '');
  processed = processed.replace(/\\begin\{document\}/g, '');
  processed = processed.replace(/\\end\{document\}/g, '');
  
  // Handle title, author, date
  processed = processed.replace(/\\title\{([^}]*)\}/g, '**$1**\n\n');
  processed = processed.replace(/\\author\{([^}]*)\}/g, '*By: $1*\n\n');
  processed = processed.replace(/\\date\{([^}]*)\}/g, '*Date: $1*\n\n');
  processed = processed.replace(/\\maketitle/g, '');
  
  // Handle sections
  processed = processed.replace(/\\section\{([^}]*)\}/g, '## $1\n\n');
  processed = processed.replace(/\\subsection\{([^}]*)\}/g, '### $1\n\n');
  processed = processed.replace(/\\subsubsection\{([^}]*)\}/g, '#### $1\n\n');
  processed = processed.replace(/\\paragraph\{([^}]*)\}/g, '**$1**\n\n');
  
  // Handle inparaitem (inline lists)
  processed = processed.replace(/\\begin\{inparaitem\}([\s\S]*?)\\end\{inparaitem\}/g, (match, content) => {
    const items = content.split(/\\item\s*/).filter((item: string) => item.trim());
    return items.join(', ').replace(/,\s*$/, '');
  });
  
  // Handle itemize and enumerate environments
  processed = processed.replace(/\\begin\{itemize\}([\s\S]*?)\\end\{itemize\}/g, (match, content) => {
    const items = content.split(/\\item\s*/).filter((item: string) => item.trim());
    return '\n' + items.map((item: string) => `• ${item.trim()}`).join('\n') + '\n';
  });
  
  processed = processed.replace(/\\begin\{enumerate\}([\s\S]*?)\\end\{enumerate\}/g, (match, content) => {
    const items = content.split(/\\item\s*/).filter((item: string) => item.trim());
    return '\n' + items.map((item: string, index: number) => `${index + 1}. ${item.trim()}`).join('\n') + '\n';
  });
  
  // Handle text formatting
  processed = processed.replace(/\\textbf\{([^}]*)\}/g, '**$1**');
  processed = processed.replace(/\\textit\{([^}]*)\}/g, '*$1*');
  processed = processed.replace(/\\emph\{([^}]*)\}/g, '*$1*');
  
  // Clean up extra whitespace
  processed = processed.replace(/\n{3,}/g, '\n\n');
  processed = processed.trim();
  
  return processed;
};

// Function to check if content is a complex LaTeX document
const isComplexLatexDocument = (content: string): boolean => {
  return (
    content.includes('\\documentclass') ||
    content.includes('\\begin{document}') ||
    content.includes('\\begin{itemize}') ||
    content.includes('\\begin{enumerate}') ||
    content.includes('\\begin{inparaitem}') ||
    /\\usepackage\{[^}]*paralist[^}]*\}/.test(content) ||
    /\\section\{|\\subsection\{|\\title\{|\\author\{/.test(content)
  );
};

export default function LaTeX({ children, display = false }: LaTeXProps) {
  // Check if this is a complex LaTeX document that needs special processing
  if (isComplexLatexDocument(children)) {
    const processedContent = processComplexLatex(children);
    
    // If the processed content still contains math expressions, render them
    const hasMath = /\$.*?\$|\\\[.*?\\\]|\\\(.*?\\\)|\\begin\{(equation|align|gather|multline)\}/.test(processedContent);
    
    if (hasMath) {
      return (
        <MathJaxContext config={config}>
          <div className={display ? 'block my-4' : 'inline'}>
            <MathJax>
              {processedContent}
            </MathJax>
          </div>
        </MathJaxContext>
      );
    } else {
      // Render as plain text/markdown if no math
      return (
        <div className={display ? 'block my-4 whitespace-pre-wrap' : 'inline whitespace-pre-wrap'}>
          {processedContent}
        </div>
      );
    }
  }

  // For regular math expressions, use standard MathJax processing
  const processLatexContent = (content: string): string => {
    // Remove existing delimiters if they exist
    let processedContent = content.replace(/^\$\$/, '').replace(/\$\$$/, '');
    processedContent = processedContent.replace(/^\$/, '').replace(/\$$/, '');
    processedContent = processedContent.replace(/^\\?\[/, '').replace(/\\?\]$/, '');
    processedContent = processedContent.replace(/^\\?\(/, '').replace(/\\?\)$/, '');
    
    // Check if content contains LaTeX environments
    const hasEnvironments = /\\begin\{[^}]+\}|\\end\{[^}]+\}/.test(processedContent);
    
    // If it contains environments or is display mode, treat as display math
    if (hasEnvironments || display) {
      return `\\[${processedContent}\\]`;
    } else {
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