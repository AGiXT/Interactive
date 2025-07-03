export type MarkdownBlockProps = {
  children: string;
};

type BlockType = 'codeblock' | 'code' | 'latex' | 'latex-display' | undefined;

type Segment = {
  type?: BlockType;
  content: string;
};

function reprocess(processed: Segment[], rule: any, type: BlockType, keepDelimiters = false) {
  return processed
    .map((value) => {
      if (value.type === undefined) {
        const result = rule(value.content).map((value: string, index: number) => {
          const isContent = index % 2 === 1;
          return {
            type: isContent ? type : undefined,
            content: isContent && keepDelimiters ? `$$${value}$$` : value,
          };
        });
        if (result.length % 2 !== 1) {
          throw new Error(`Unterminated ${type} detected in content: ${value.content}!`);
        }
        return result.filter((segment: Segment) => segment.content);
      } else {
        return [value];
      }
    })
    .flat();
}

function splitUnEscaped(text: string, delimiter: string) {
  return text
    .replaceAll('\\' + delimiter, '´')
    .split(delimiter)
    .map((section) => section.replaceAll('´', '\\' + delimiter));
}

// Function to handle escaped dollar signs and LaTeX blocks
function processLaTeX(text: string): Segment[] {
  let processed: Segment[] = [{ content: text }];
  
  // First process display math with \[ ... \] delimiters
  processed = reprocess(processed, (content: string) => splitUnEscaped(content, '\\['), 'latex-display');
  processed = reprocess(processed, (content: string) => splitUnEscaped(content, '\\]'), 'latex-display');
  
  // Then process display math ($$) to avoid conflicts with inline math
  processed = reprocess(processed, (content: string) => splitUnEscaped(content, '$$'), 'latex-display', true);
  
  // Process inline math with \( ... \) delimiters
  processed = reprocess(processed, (content: string) => splitUnEscaped(content, '\\('), 'latex');
  processed = reprocess(processed, (content: string) => splitUnEscaped(content, '\\)'), 'latex');
  
  // Then process inline math ($)
  processed = reprocess(processed, (content: string) => splitUnEscaped(content, '$'), 'latex');
  
  // Process LaTeX environments (like itemize, enumerate, etc.)
  processed = processLaTeXEnvironments(processed);
  
  return processed;
}

// Function to detect and process LaTeX environments
function processLaTeXEnvironments(segments: Segment[]): Segment[] {
  return segments.map(segment => {
    if (segment.type === undefined) {
      const content = segment.content;
      
      // Look for LaTeX environments (itemize, enumerate, document, etc.)
      const envPattern = /\\begin\{([^}]+)\}[\s\S]*?\\end\{\1\}/g;
      
      // Look for LaTeX document structure
      const docPattern = /\\documentclass[\s\S]*?(?=\\begin\{document\}|$)|\\begin\{document\}[\s\S]*?\\end\{document\}/g;
      
      // Combine patterns to find all LaTeX structures
      const allMatches: Array<{ match: RegExpMatchArray; type: 'env' | 'doc' }> = [];
      
      // Find environment matches
      let envMatch;
      while ((envMatch = envPattern.exec(content)) !== null) {
        allMatches.push({ match: envMatch, type: 'env' });
      }
      
      // Find document structure matches
      let docMatch;
      while ((docMatch = docPattern.exec(content)) !== null) {
        allMatches.push({ match: docMatch, type: 'doc' });
      }
      
      if (allMatches.length > 0) {
        // Sort matches by position
        allMatches.sort((a, b) => a.match.index! - b.match.index!);
        
        const result: Segment[] = [];
        let lastIndex = 0;
        
        allMatches.forEach(({ match }) => {
          // Add text before the LaTeX structure
          if (match.index! > lastIndex) {
            const beforeText = content.slice(lastIndex, match.index);
            if (beforeText.trim()) {
              result.push({ content: beforeText });
            }
          }
          
          // Add the LaTeX structure as display LaTeX
          result.push({
            type: 'latex-display',
            content: match[0]
          });
          
          lastIndex = match.index! + match[0].length;
        });
        
        // Add remaining text after the last LaTeX structure
        if (lastIndex < content.length) {
          const afterText = content.slice(lastIndex);
          if (afterText.trim()) {
            result.push({ content: afterText });
          }
        }
        
        return result;
      }
    }
    return [segment];
  }).flat();
}

export default function textToMarkdown(text: string) {
  // Process code blocks first
  let processed = reprocess([{ content: text }], (content: string) => splitUnEscaped(content, '```'), 'codeblock');
  
  // Then process LaTeX for non-code segments
  processed = processed.map((segment) => {
    if (segment.type === undefined) {
      return processLaTeX(segment.content);
    }
    return [segment];
  }).flat();
  
  return processed;
}
