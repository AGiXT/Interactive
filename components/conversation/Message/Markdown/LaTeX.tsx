import React from 'react';
import { MathJax, MathJaxContext } from 'better-react-mathjax';
import { parse } from 'csv-parse/sync'; // Added for CSV parsing
// Removed DataTable related imports as we'll render CSV as LaTeX table

interface LaTeXProps {
  children: string;
  display?: boolean;
}


// Helper function to detect simple CSV-like structure
// Returns the detected delimiter or null
const detectCSVDelimiter = (text: string): ',' | '\t' | ';' | null => {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return null; // Need at least header and one data row

  const potentialDelimiters = [',', '\t', ';'] as const;
  let detectedDelimiter: ',' | '\t' | ';' | null = null;
  let consistentColumnCount = -1;

  for (const delimiter of potentialDelimiters) {
    const headerColumns = lines[0].split(delimiter).length;
    if (headerColumns < 1) continue; // Allow single column

    let isConsistent = true;
    for (let i = 0; i < lines.length; i++) { // Check all lines including header
      if (lines[i].trim() === '') continue; // Skip empty lines
      const currentColumnCount = lines[i].split(delimiter).length;

      // Allow trailing delimiters by checking if the last cell is empty
      const endsWithDelimiter = lines[i].endsWith(delimiter);
      const expectedColumns = endsWithDelimiter ? currentColumnCount + 1 : currentColumnCount;

      if (i === 0) {
          // Initialize consistentColumnCount based on the header
          consistentColumnCount = expectedColumns;
      } else if (expectedColumns !== consistentColumnCount) {
          // If any data row has a different number of columns than the header
          isConsistent = false;
          break;
      }
    }

    if (isConsistent && consistentColumnCount > 0) { // Ensure at least one column
      // Additional check: avoid misinterpreting simple lists like "a,b,c" on one line
      if (lines.length === 1 && consistentColumnCount > 1) {
         // Single line with multiple columns could be CSV, keep delimiter
      } else if (lines.length < 2) {
          // If only one line, it's ambiguous, don't treat as CSV table
          isConsistent = false;
      }

      if (isConsistent) {
          detectedDelimiter = delimiter;
          break; // Found a consistent delimiter
      }
    }
  }

   // Basic check: ensure the detected structure isn't just single words per line if no delimiter found
   if (!detectedDelimiter && lines.length >= 2 && lines.every(line => !line.includes(',') && !line.includes('\t') && !line.includes(';'))) {
       // Heuristic: If multiple lines and no common delimiters, treat as single-column data.
       // We need a way to represent this. Let's return a special marker or handle it in parseCSV.
       // For now, let's NOT automatically treat it as CSV to avoid lists.
       // Revisit if single-column CSV detection is crucial.
       return null;
   }


  return detectedDelimiter;
};


// Function to convert CSV string to LaTeX tabular string
const csvStringToLatexTable = (csvString: string, delimiter: string): string => {
  try {
    // Assuming the first row is headers
    const records = parse(csvString, {
      delimiter: delimiter,
      columns: true, // Automatically use the first row as headers
      skip_empty_lines: true,
      trim: true,
    });

    if (!records || records.length === 0) {
      return '\\textit{Empty or invalid CSV data}';
    }

    const headers = Object.keys(records[0]);
    const numColumns = headers.length;
    const columnFormat = Array(numColumns).fill('l').join(''); // Default to left-aligned

    const escapeLatex = (str: string) => String(str ?? '').replace(/([&%$#_{}])/g, '\\$1'); // Basic escaping, ensure string conversion

    let latex = `\\begin{tabular}{${columnFormat}}\n\\toprule\n`;
    latex += headers.map(header => `\\textbf{${escapeLatex(header)}}`).join(' & ') + ' \\\\\n\\midrule\n';

    records.forEach((row: Record<string, string>) => {
      const rowValues = headers.map(header => escapeLatex(row[header])); // Use escaped value
      latex += rowValues.join(' & ') + ' \\\\\n';
    });

    latex += `\\bottomrule\n\\end{tabular}`;
    return latex;
  } catch (error: any) { // Catch specific error type if possible
    console.error(`Error processing CSV string:`, error);
    const escapeLatex = (str: string) => String(str ?? '').replace(/([&%$#_{}])/g, '\\$1'); // Ensure string conversion
    return `\\textit{Error processing CSV: ${escapeLatex(error.message)}}`;
  }
};


export default function LaTeX({ children, display = false }: LaTeXProps) {
  const rawContent = children;
  let contentToRender = rawContent; // Default to original content

  // --- START CHANGE ---
  // Attempt to strip LaTeX delimiters ($$, $) for processing
  let contentForProcessing = rawContent.trim();
  let wasStripped = false; // Flag to track if delimiters were removed
  if (display) { // Display math uses $$
    if (contentForProcessing.startsWith('$$') && contentForProcessing.endsWith('$$')) {
      contentForProcessing = contentForProcessing.substring(2, contentForProcessing.length - 2).trim();
      wasStripped = true;
    } else if (contentForProcessing.startsWith('```latex\n')) { // Handle ```latex blocks
        contentForProcessing = contentForProcessing.substring(8).trim();
        if (contentForProcessing.endsWith('```')) {
            contentForProcessing = contentForProcessing.substring(0, contentForProcessing.length - 3).trim();
        }
        wasStripped = true; // Treat as stripped display math
    }
  } else { // Inline math uses $
    if (contentForProcessing.startsWith('$') && contentForProcessing.endsWith('$')) {
      contentForProcessing = contentForProcessing.substring(1, contentForProcessing.length - 1).trim();
      wasStripped = true;
    }
  }

  // Only attempt CSV conversion for display blocks *after* stripping
  if (display && wasStripped) {
    // Check for CSV data within the stripped content
    const csvDelimiter = detectCSVDelimiter(contentForProcessing);
    if (csvDelimiter) {
      // If CSV detected, convert it to a LaTeX table string
      const latexTable = csvStringToLatexTable(contentForProcessing, csvDelimiter);
      // Wrap in display math environment
      contentToRender = `$$${latexTable}$$`;
      // NOTE: We re-wrap with $$ because MathJax needs the delimiters for the generated table
    }
    // else: If not CSV, but delimiters were stripped...
    else {
        // Check if the stripped content looks like a full document
        if (contentForProcessing.includes('\\documentclass') || contentForProcessing.includes('\\begin{document}')) {
            // It's a full document, MathJax can't render it. Render as code block.
            return (
                <div className="relative my-4">
                    <pre className="block p-4 bg-gray-100 dark:bg-gray-800 overflow-x-auto rounded text-sm">
                        <code>{contentForProcessing}</code>
                    </pre>
                    <div className="text-xs text-red-500 mt-1 absolute bottom-1 right-1 bg-white dark:bg-black px-1 rounded opacity-80">
                        Note: Full LaTeX documents cannot be rendered. Displaying source.
                    </div>
                </div>
            );
        } else {
            // Assume it's regular math content stripped from delimiters
            contentToRender = contentForProcessing;
        }
    }
  } else if (!display && wasStripped) {
      // For inline math, if delimiters were stripped, use the stripped content
      // Add similar check for full documents if needed, though less likely inline
      if (contentForProcessing.includes('\\documentclass') || contentForProcessing.includes('\\begin{document}')) {
           return (
                <span className="inline text-red-500 font-mono text-xs p-1 bg-red-100 rounded">
                    Error: Full LaTeX documents cannot be rendered inline.
                </span>
            );
      } else {
        contentToRender = contentForProcessing;
      }
  }
  // else: If delimiters were not stripped (e.g., malformed input or standard $..$ / $$..$$),
  // render the original rawContent and let MathJax find the delimiters itself.
  // --- END CHANGE ---


  // Configure and render with MathJax
  const config = {
    loader: { load: ["input/tex", "output/chtml", "[tex]/require", "[tex]/ams"] }, // Added require & ams
    tex: {
      inlineMath: [['$', '$'], ['\\(', '\\)']],
      displayMath: [['$$', '$$'], ['\\[', '\\]']],
      processEscapes: true,
      processEnvironments: true,
      packages: {'[+]': ['require', 'ams', 'boldsymbol']}, // Load ams, require, boldsymbol
      tags: 'ams' // Use AMS numbering for equations
    },
    chtml: {
      scale: 1.0,
      matchFontHeight: true // Improve font matching
    }
    // Removed incorrect startup block
  };

  try {
     return (
      <MathJaxContext config={config}>
        <MathJax
          className={display ? 'block my-4 text-center' : 'inline'}
          inline={!display}
          key={rawContent} // Add key to force re-render on content change if needed
        >
          {/* Render the potentially modified content (original or generated LaTeX table) */}
          {contentToRender}
        </MathJax>
      </MathJaxContext>
    );
  } catch (error) {
    console.error("Error rendering LaTeX with MathJax:", error, "Content:", contentToRender); // Log contentToRender on error
    return (
      <span className={display ? 'block my-4 text-center text-red-500' : 'inline text-red-500'}>
        LaTeX rendering failed: Unsupported content or syntax error.
      </span>
    );
  }
}