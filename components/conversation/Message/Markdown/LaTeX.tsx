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

// Function to process nested itemize and enumerate lists into HTML
const processNestedLists = (content: string): string => {
  // Clean up and prepare content
  let result = content.trim();
  
  // Function to recursively process lists with proper HTML structure
  const processListsRecursively = (text: string): string => {
    let processedText = text;
    let hasChanges = true;
    
    // Continue processing until no more changes are made
    while (hasChanges) {
      hasChanges = false;
      const originalText = processedText;
      
      // Process innermost lists (those without nested begin/end)
      processedText = processedText.replace(
        /\\begin\{(itemize|enumerate)\}((?:(?!\\begin\{(?:itemize|enumerate)\}).)*?)\\end\{\1\}/gs,
        (match, listType, content) => {
          hasChanges = true;
          
          // Split by \item and clean up
          const parts = content.split(/\\item\s+/);
          const items = parts.slice(1).filter((item: string) => item.trim()); // Skip first empty part
          
          if (listType === 'itemize') {
            const listItems = items.map((item: string) => {
              const cleanItem = item.trim().replace(/\n\s*$/, ''); // Remove trailing whitespace
              return `<li>${cleanItem}</li>`;
            }).join('');
            return `<ul class="latex-itemize">${listItems}</ul>`;
          } else {
            const listItems = items.map((item: string) => {
              const cleanItem = item.trim().replace(/\n\s*$/, ''); // Remove trailing whitespace
              return `<li>${cleanItem}</li>`;
            }).join('');
            return `<ol class="latex-enumerate">${listItems}</ol>`;
          }
        }
      );
      
      // If no changes were made, we're done
      if (processedText === originalText) {
        hasChanges = false;
      }
    }
    
    return processedText;
  };
  
  result = processListsRecursively(result);
  
  // Clean up any remaining LaTeX artifacts
  result = result.replace(/\\begin\{[^}]+\}/g, ''); // Remove any remaining \begin commands
  result = result.replace(/\\end\{[^}]+\}/g, '');   // Remove any remaining \end commands
  result = result.replace(/\\item\s+/g, '');        // Remove any remaining \item commands
  result = result.replace(/\n\s*\n\s*\n/g, '\n\n'); // Clean up excessive whitespace
  result = result.trim();
  
  return result;
};

// Function to process complex LaTeX documents that MathJax can't handle
const processComplexLatex = (content: string): string => {
  let processed = content;
  
  // Handle document structure - extract content between \begin{document} and \end{document}
  const documentMatch = processed.match(/\\begin\{document\}([\s\S]*?)\\end\{document\}/);
  if (documentMatch) {
    processed = documentMatch[1];
  }
  
  // Remove all document structure commands completely
  processed = processed.replace(/\\documentclass[^\n]*/g, '');
  processed = processed.replace(/\\usepackage[^\n]*/g, '');
  processed = processed.replace(/\\begin\{document\}/g, '');
  processed = processed.replace(/\\end\{document\}/g, '');
  
  // Handle title, author, date - process but remove commands
  processed = processed.replace(/\\title\{([^}]*)\}/g, '**$1**\n\n');
  processed = processed.replace(/\\author\{([^}]*)\}/g, '*By: $1*\n\n');
  processed = processed.replace(/\\date\{([^}]*)\}/g, '*Date: $1*\n\n');
  processed = processed.replace(/\\maketitle/g, '');
  
  // Handle sections - process but remove commands
  processed = processed.replace(/\\section\{([^}]*)\}/g, '## $1\n\n');
  processed = processed.replace(/\\subsection\{([^}]*)\}/g, '### $1\n\n');
  processed = processed.replace(/\\subsubsection\{([^}]*)\}/g, '#### $1\n\n');
  processed = processed.replace(/\\paragraph\{([^}]*)\}/g, '**$1**\n\n');
  
  // Handle inparaitem (inline lists) - create seamless inline flow
  processed = processed.replace(/\\begin\{inparaitem\}([\s\S]*?)\\end\{inparaitem\}/g, (match, content) => {
    const items = content.split(/\\item\s*/).filter((item: string) => item.trim());
    const cleanItems = items.map((item: string, index: number) => {
      let cleanItem = item.trim();
      // Remove trailing comma or period if present
      cleanItem = cleanItem.replace(/[,.]\s*$/, '');
      // Add proper punctuation for inline flow
      if (index === items.length - 1) {
        // Last item - keep any existing punctuation or add period
        if (!/[.!?]$/.test(cleanItem)) {
          cleanItem += '.';
        }
      } else {
        // Not last item - ensure comma separation
        cleanItem += ',';
      }
      return cleanItem;
    });
    return cleanItems.join(' ');
  });
  
  // Handle compactitem and similar inline environments
  processed = processed.replace(/\\begin\{compactitem\}([\s\S]*?)\\end\{compactitem\}/g, (match, content) => {
    const items = content.split(/\\item\s*/).filter((item: string) => item.trim());
    const cleanItems = items.map((item: string) => item.trim());
    return cleanItems.join(' • ');
  });
  
  // Handle nested itemize and enumerate environments - this will completely hide structural commands
  processed = processNestedLists(processed);
  
  // Handle text formatting - process but remove commands
  processed = processed.replace(/\\textbf\{([^}]*)\}/g, '**$1**');
  processed = processed.replace(/\\textit\{([^}]*)\}/g, '*$1*');
  processed = processed.replace(/\\emph\{([^}]*)\}/g, '*$1*');
  
  // Handle bullet symbols and inline formatting
  processed = processed.replace(/\\textbullet\{\}/g, '•');
  processed = processed.replace(/\\textbullet/g, '•');
  processed = processed.replace(/\\bullet/g, '•');
  processed = processed.replace(/\\cdot/g, '·');
  processed = processed.replace(/\\circ/g, '◦');
  
  // Handle manual list separators for inline formatting
  processed = processed.replace(/\s*[-*]\s+/g, ' • '); // Convert hyphens/asterisks to bullets
  processed = processed.replace(/\s*--\s+/g, ' – '); // Convert double hyphens to en-dash
  processed = processed.replace(/\s*---\s+/g, ' — '); // Convert triple hyphens to em-dash
  
  // Handle spacing around punctuation for inline lists
  processed = processed.replace(/,\s*([•·◦])/g, ', $1'); // Proper spacing after commas
  processed = processed.replace(/([•·◦])\s*,/g, '$1,'); // Remove space before commas after bullets
  processed = processed.replace(/([•·◦])\s+/g, '$1 '); // Ensure single space after bullets
  
  // Remove any remaining LaTeX commands that weren't processed
  processed = processed.replace(/\\[a-zA-Z]+\*?(\[[^\]]*\])?(\{[^}]*\})?/g, '');
  processed = processed.replace(/\\\\/g, '\n'); // Handle line breaks
  
  // Clean up whitespace and artifacts
  processed = processed.replace(/\n\s*\n\s*\n/g, '\n\n'); // Remove excessive line breaks
  processed = processed.replace(/^\s+|\s+$/gm, ''); // Trim lines
  processed = processed.replace(/\n{3,}/g, '\n\n'); // Limit consecutive line breaks
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
      // Check if content contains HTML (lists)
      const hasHTML = processedContent.includes('<ul') || processedContent.includes('<ol');
      
      if (hasHTML) {
        // Render as HTML with LaTeX styling
        return (
          <div
            className={display ? 'block my-4 latex-content' : 'inline latex-content'}
            dangerouslySetInnerHTML={{ __html: processedContent }}
          />
        );
      } else {
        // Render as plain text if no HTML
        return (
          <div className={display ? 'block my-4 whitespace-pre-wrap' : 'inline whitespace-pre-wrap'}>
            {processedContent}
          </div>
        );
      }
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