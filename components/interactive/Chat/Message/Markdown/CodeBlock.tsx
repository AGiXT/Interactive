'use client';
import React, { ReactNode, useState, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { a11yDark, a11yLight } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import { Copy, Download } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import 'katex/dist/katex.min.css';
import Latex from 'react-latex-next';
import { getCookie } from 'cookies-next';
import MarkdownBlock from '../MarkdownBlock';
import { DataTable } from '../data-table';
import { createColumns } from '../data-table/data-table-columns';
import Mermaid from './Code/Mermaid';
import { parseXSVData } from './Code/ParseXSVData';
import TabPanel from './TabPanel';

const fileExtensions: Record<string, string> = {
  '': 'txt',
  text: 'txt',
  python: 'py',
  javascript: 'js',
  typescript: 'ts',
  html: 'html',
  css: 'css',
  json: 'json',
  yaml: 'yaml',
  markdown: 'md',
  shell: 'sh',
  bash: 'sh',
  sql: 'sql',
  java: 'java',
  c: 'c',
  cpp: 'cpp',
  csharp: 'cs',
  go: 'go',
  rust: 'rs',
  php: 'php',
  ruby: 'rb',
  perl: 'pl',
  lua: 'lua',
  r: 'r',
  swift: 'swift',
  kotlin: 'kt',
  scala: 'scala',
  clojure: 'clj',
  elixir: 'ex',
  erlang: 'erl',
  haskell: 'hs',
  ocaml: 'ml',
  pascal: 'pas',
  scheme: 'scm',
  coffeescript: 'coffee',
  fortran: 'f',
  julia: 'jl',
  lisp: 'lisp',
  prolog: 'pro',
  vbnet: 'vb',
  dart: 'dart',
  fsharp: 'fs',
  groovy: 'groovy',
  perl6: 'pl',
  powershell: 'ps1',
  puppet: 'pp',
  qml: 'qml',
  racket: 'rkt',
  sas: 'sas',
  tsv: 'tsv',
  flow: 'flow',
  mermaid: 'mermaid',
  sequence: 'sequence',
  gantt: 'gantt',
  verilog: 'v',
  vhdl: 'vhd',
  apex: 'cls',
  matlab: 'm',
  nim: 'nim',
  csv: 'csv',
  xml: 'xml',
  latex: 'latex',
};

type LanguageRendererProps = {
  content: string;
  setLoading?: (loading: boolean) => void;
};

const languageRenders: Record<string, (content: string, setLoading?: (loading: boolean) => void) => ReactNode> = {
  markdown: (content: string) => <MarkdownBlock content={content} />,
  html: (content: string) => <div dangerouslySetInnerHTML={{ __html: content }} />,
  csv: (content: string, setLoading?: (loading: boolean) => void) => {
    const csvData = (
      Array.isArray(content)
        ? content.length > 1
          ? content
          : content[0]
        : content
            .split('\n')
            .filter((row: string) => row.trim())
            .map((row: string) => row.trim())
    )
      .filter((row: string) => row.trim())
      .map((row: string) => row.trim());

    const result = parseXSVData(csvData, ',');

    if ('error' in result) {
      return <div>Error: {result.error}</div>;
    }

    return <DataTable columns={createColumns(result.columns)} data={result.rows} />;
  },
  tsv: (content: string, setLoading?: (loading: boolean) => void) => {
    const tsvData = (Array.isArray(content) ? (content.length > 1 ? content : content[0]) : content.split('\n'))
      .filter((row: string) => row.trim())
      .map((row: string) => row.trim());

    const result = parseXSVData(tsvData, '\t');

    if ('error' in result) {
      return <div>Error: {result.error}</div>;
    }

    return <DataTable columns={createColumns(result.columns)} data={result.rows} />;
  },
  gantt: (content: string) => <Mermaid chart={`gantt\n${content}`} />,
  sequence: (content: string) => <Mermaid chart={`sequenceDiagram\n${content}`} />,
  flow: (content: string) => <Mermaid chart={`flowchart TD\n${content}`} />,
  mermaid: (content: string) => <Mermaid chart={content} />,
  latex: (content: string) => <Latex>{content}</Latex>,
};

export type CodeBlockProps = {
  inline?: boolean;
  children?: string;
  language?: string;
  fileName?: string;
  setLoading?: (loading: boolean) => void;
};

export default function CodeBlock({
  inline = false,
  children = '',
  language = 'Text',
  fileName,
  setLoading,
  ...props
}: CodeBlockProps): ReactNode {
  const codeBlockRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState(0);
  const [isOpen, setIsOpen] = useState(true);

  if (inline) {
    return <span className='bg-gray-200 dark:bg-gray-700 rounded-md px-1 py-0.5 font-mono'>{children}</span>;
  }

  if (!language || language === 'Text') {
    const languages = Object.keys(fileExtensions);
    const contentLines = children.split('\n');
    const potentialLanguage = contentLines[0].trim().toLowerCase();
    
    // Handle Mermaid specific syntax
    if (contentLines[0].trim() === 'graph TD' || contentLines[0].trim() === 'graph TB') {
      language = 'mermaid';
    } else if (contentLines[0].trim() === 'sequenceDiagram') {
      language = 'sequence';
    } else if (contentLines[0].trim() === 'gantt') {
      language = 'gantt';
    } else if (contentLines[0].trim().startsWith('flowchart')) {
      language = 'flow';
    } else if (languages.includes(potentialLanguage)) {
      language = potentialLanguage;
      children = children.substring(children.indexOf('\n') + 1);
    }
  }

  const fileNameWithExtension = `${fileName || 'code'}.${fileExtensions[language.toLowerCase()] || 'txt'}`;

  const copyCode = () => {
    if (codeBlockRef.current) {
      const actualCode = codeBlockRef.current.querySelector('code')?.cloneNode(true) as HTMLElement;
      actualCode.querySelectorAll('.react-syntax-highlighter-line-number').forEach((el) => el.remove());
      navigator.clipboard.writeText(actualCode.innerText);
    }
  };

  const downloadCode = () => {
    if (codeBlockRef.current) {
      const actualCode = codeBlockRef.current.querySelector('code')?.cloneNode(true) as HTMLElement;
      actualCode.querySelectorAll('.react-syntax-highlighter-line-number').forEach((el) => el.remove());
      const element = document.createElement('a');
      const file = new Blob([actualCode.innerText], { type: 'text/plain;charset=utf-8' });
      element.href = URL.createObjectURL(file);
      element.download = fileNameWithExtension;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    }
  };

  const languageKey = language.toLowerCase();
  const hasCustomRenderer = languageKey in languageRenders;

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className={`my-2 overflow-hidden border rounded-lg bg-background transition-all duration-300 ease-in-out ${isOpen ? 'w-full' : 'inline-block'}`}
    >
      <div className='relative flex items-center justify-between pr-4 border-b-2 border-border'>
        <CollapsibleTrigger className='p-2 hover:bg-muted'>
          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'transform rotate-180' : ''}`} />
        </CollapsibleTrigger>

        {hasCustomRenderer && (
          <div className='flex'>
            <button className={`px-4 py-2 ${tab === 0 ? 'bg-muted' : ''}`} onClick={() => setTab(0)}>
              Rendered
            </button>
            <button className={`px-4 py-2 ${tab === 1 ? 'bg-muted' : ''}`} onClick={() => setTab(1)}>
              Source
            </button>
          </div>
        )}
        <div className='flex items-center'>
          <button onClick={copyCode} className='p-2 rounded-full hover:bg-muted'>
            <Copy className='w-5 h-5' />
          </button>
          <button onClick={downloadCode} className='p-2 rounded-full hover:bg-muted'>
            <Download className='w-5 h-5' />
          </button>
          <span className='ml-2 text-sm'>
            {fileNameWithExtension || 'text.txt'} | {language || ''}
          </span>
        </div>
      </div>

      <CollapsibleContent className='transition-all duration-300 ease-in-out'>
        {hasCustomRenderer && (
          <TabPanel value={tab} index={0}>
            <div className='code-container'>{(languageRenders[languageKey] as (content: string, setLoading?: (loading: boolean) => void) => ReactNode)(children, setLoading)}</div>
          </TabPanel>
        )}

        <TabPanel value={tab} index={hasCustomRenderer ? 1 : 0}>
          <div className='code-container' ref={codeBlockRef}>
            {languageKey in fileExtensions ? (
              <SyntaxHighlighter
                {...props}
                language={languageKey}
                style={getCookie('theme')?.includes('dark') ? a11yDark : a11yLight}
                showLineNumbers
                wrapLongLines
              >
                {children}
              </SyntaxHighlighter>
            ) : (
              <code className='code-block'>{children}</code>
            )}
          </div>
        </TabPanel>
      </CollapsibleContent>
    </Collapsible>
  );
}
