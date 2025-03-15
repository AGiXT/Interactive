import React, { ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import CodeBlock from './Markdown/CodeBlock';
import LatexBlock from './Markdown/LatexBlock';
import InlineLatex from './Markdown/InlineLaTeX';
import MarkdownHeading from './Markdown/Heading';
import MarkdownLink from './Markdown/Link';
import MarkdownImage from './Markdown/Image';
import { RendererXSV } from './Markdown/Code/XSV';
import textToMarkdown from './Markdown/Preprocessor';

export type MarkdownBlockProps = {
  content: string;
  chatItem?: { role: string; timestamp: string; message: string };
  setLoading?: (loading: boolean) => void;
};
export default function MarkdownBlock({ content, chatItem, setLoading }: MarkdownBlockProps): ReactNode {
  const renderMessage = (message: string): string => {
    return message
      ? message
          .replace(/\n/g, ' \n') // Add a space before each newline character
          .split('\n') // Split the message into lines.
          .map((line: string) => (line.trim() ? line : '\\')) // Replace empty lines (containing only \n)  with backslash.
          .join('\n') // Recombine the split lines with newlines.
          .replaceAll(/[^\\\n]\n\\\n/g, '\n\n') // Change the first slash following a line into a double linebreak.
          .replace(/[\n\\]+$/, '') // Remove any newlines or backslashes at the end of the message.
          .replace(/^[\n\\]+/, '')
      : ''; // Remove any newlines or backslashes at the beginning of the message.
  };

  const timestamp = chatItem
    ? chatItem.timestamp.replace(/ /g, '-').replace(/:/g, '-').replace(/,/g, '')
    : new Date().toLocaleString().replace(/\D/g, '');
  const fileName = chatItem ? `${chatItem.role}-${timestamp.split('.')[0]}` : `${timestamp.split('.')[0]}`;

  function parseMarkdownTable(markdown: string) {
    const tableLines = markdown.split('\n').filter((line) => line.includes('|'));
    if (tableLines.length === 0) return null;

    const headers = tableLines[0]
      .split('|')
      .map((header) => header.trim())
      .filter(Boolean);

    const rows = tableLines.slice(2).map((rowLine) =>
      rowLine
        .split('|')
        .map((cell) => cell.trim())
        .filter(Boolean)
    );

    return { headers, rows };
  }
  try {
    return (
      // Switch to https://github.com/ariabuckles/simple-markdown ?
      textToMarkdown(content.toString()).map((segment) =>
        segment.type === undefined ? (
          <ReactMarkdown
            key={segment.content}
            remarkPlugins={[[remarkGfm]]}
            className='react-markdown'
            // disallowedElements={['code']}
            components={{
              h1({ children }) {
                return <MarkdownHeading tag='h1'>{children}</MarkdownHeading>;
              },
              h2({ children }) {
                return <MarkdownHeading tag='h2'>{children}</MarkdownHeading>;
              },
              h3({ children }) {
                return <MarkdownHeading tag='h3'>{children}</MarkdownHeading>;
              },
              h4({ children }) {
                return <MarkdownHeading tag='h4'>{children}</MarkdownHeading>;
              },
              h5({ children }) {
                return <MarkdownHeading tag='h5'>{children}</MarkdownHeading>;
              },
              h6({ children }) {
                return <MarkdownHeading tag='h6'>{children}</MarkdownHeading>;
              },
              p({ children }) {
                return <p className='my-4'>{children}</p>;
              },
              a({ children, ...props }) {
                return <MarkdownLink {...props}>{children}</MarkdownLink>;
              },
              ul({ children }) {
                return <ul className='p-0 ml-6 list-disc list-outside'>{children}</ul>;
              },
              ol({ children }) {
                return <ol className='p-0 ml-8 list-decimal list-outside'>{children}</ol>;
              },
              li({ children }) {
                return <li className='my-1'>{children}</li>;
              },
              table() {
                const tableData = parseMarkdownTable(segment.content);
                if (!tableData) return null;

                // Convert table data to XSV format
                const xsvData = [
                  // Headers row
                  tableData.headers.join(','),
                  // Data rows
                  ...tableData.rows.map(row => row.join(','))
                ];

                return (
                  <div className="my-4">
                    <RendererXSV
                      xsvData={xsvData}
                      separator=","
                      setLoading={setLoading}
                    />
                  </div>
                );
              },
              code({ children }) {
                return (
                  <span className='inline p-1 mx-1 font-mono rounded-lg text-muted-foreground bg-muted'>{children}</span>
                );
              },
              img({ src, alt }) {
                return <MarkdownImage src={src} alt={alt} />;
              },
              code({ node, inline, className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || '');
                if (match && match[1] === 'latex') {
                  return <LatexBlock>{String(children).replace(/\n$/, '')}</LatexBlock>;
                }
                return inline ? (
                  <span className='inline p-1 mx-1 font-mono rounded-lg text-muted-foreground bg-muted'>{children}</span>
                ) : (
                  <CodeBlock inline={false} fileName="">{String(children)}</CodeBlock>
                );
              },
              text({ children }) {
                const text = String(children);
                if (!text.includes('$')) return children;
                
                const parts = text.split(/(\$[^\$]+\$)/g);
                return (
                  <>
                    {parts.map((part, i) => {
                      if (part.startsWith('$') && part.endsWith('$')) {
                        const latex = part.slice(1, -1);
                        return <InlineLatex key={i}>{latex}</InlineLatex>;
                      }
                      return part;
                    })}
                  </>
                );
              },
            }}
          >
            {renderMessage(segment.content)}
          </ReactMarkdown>
        ) : (
          <CodeBlock key={segment.content} inline={segment.type === 'code'} fileName={fileName}>
            {segment.content}
          </CodeBlock>
        ),
      )
    );
  } catch (e) {
    console.error(e);
    return renderMessage(content).toString();
  }
}
