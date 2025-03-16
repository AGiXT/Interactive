export type MarkdownBlockProps = {
  children: string;
};

type BlockType = 'codeblock' | 'code' | 'latex' | 'latex-display' | undefined;

type Segment = {
  type?: BlockType;
  content: string;
};

function reprocess(processed: Segment[], rule: any, type: BlockType) {
  return processed
    .map((value) => {
      if (value.type === undefined) {
        const result = rule(value.content).map((value: string, index: number) => ({
          type: index % 2 === 1 ? type : undefined,
          content: value,
        }));
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
  processed = reprocess(processed, (content: string) => splitUnEscaped(content, '$$'), 'latex-display');
  
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
  
  return processed;
}
