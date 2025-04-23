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
  
  // First process display math ($$) to avoid conflicts with inline math
  processed = reprocess(processed, (content: string) => splitUnEscaped(content, '$$'), 'latex-display', false);
  
  // Then process inline math ($)
  processed = reprocess(processed, (content: string) => splitUnEscaped(content, '$'), 'latex');
  
  return processed;
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
