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
        const parts = rule(value.content); // Get parts split by delimiter
        // Check for unterminated blocks *before* mapping.
        // Log error only if the delimiter count is unbalanced (even parts) AND there's more than one part
        // (meaning the delimiter was actually present but unterminated).
        if (parts.length % 2 === 0 && parts.length > 1) {
          console.error(`Unterminated ${type} detected in content: ${value.content}`);
          // Return the original segment to avoid breaking rendering completely
          return [value];
        }

        const result = parts.map((part: string, index: number) => {
          const isContent = index % 2 === 1;
          let finalContent = part;

          // If it's the content segment and we need to keep delimiters, reconstruct it.
          if (isContent && keepDelimiters) {
            const delimiter = type === 'latex-display' ? '$$' : '$';
            finalContent = `${delimiter}${part}${delimiter}`; // Add delimiters back
          }

          return {
            type: isContent ? type : undefined,
            content: finalContent, // Use the potentially reconstructed content
          };
        });

        // Filter out empty segments that might result from splitting
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
  
  // First process display math ($$) to avoid conflicts with inline math
  processed = reprocess(processed, (content: string) => splitUnEscaped(content, '$$'), 'latex-display', true); // Keep delimiters

  // Then process inline math ($)
  processed = reprocess(processed, (content: string) => splitUnEscaped(content, '$'), 'latex', false); // Do NOT keep delimiters for inline

  return processed;
}

export default function textToMarkdown(text: string) {
  // Process code blocks first
  let processed = reprocess([{ content: text }], (content: string) => splitUnEscaped(content, '```'), 'codeblock');

  // Refine codeblock segments: Check for 'latex' language identifier
  processed = processed.map(segment => {
    if (segment.type === 'codeblock' && segment.content.startsWith('latex\n')) {
      return {
        ...segment,
        type: 'latex-display', // Change type to render as LaTeX display block
        // Wrap the content with $$ for MathJax display math
        content: `$$${segment.content.substring(6)}$$`,
      };
    }
    return segment;
  });
  
  // Then process LaTeX math ($ and $$) for non-code, non-table segments
  processed = processed.map((segment) => {
    if (segment.type === undefined) {
      // Pass the content through processLaTeX which handles $ and $$
      return processLaTeX(segment.content);
    }
    return [segment];
  }).flat();
  
  // Process raw image URLs to convert them into markdown image syntax
  processed = processed.map((segment) => {
    if (segment.type === undefined) {
      const imageUrlRegex = /(https?:\/\/[^\s<>"']+\.(?:jpg|jpeg|png|gif|bmp|webp)(?:[^\s<>"']*))/gi;
      const contentWithImages = segment.content.replace(imageUrlRegex, '![Image]($1)');
      return [{ content: contentWithImages }];
    }
    return [segment];
  }).flat();
  
  return processed;
}
