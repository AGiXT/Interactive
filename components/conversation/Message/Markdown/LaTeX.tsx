import React from 'react';
import { MathJax, MathJaxContext } from 'better-react-mathjax';
import { DataTable } from '../data-table'; // Corrected path
import { createColumns, type ColumnData } from '../data-table/data-table-columns'; // Corrected path & added ColumnData type import

interface LaTeXProps {
  children: string;
  display?: boolean;
}

// Renamed and updated function to handle both itemize and enumerate
const latexListToMarkdown = (text: string): string => {
  const lines = text.split('\n');
  const resultLines: string[] = [];
  type ListState = { type: 'itemize' | 'enumerate'; counter: number };
  const listStateStack: ListState[] = []; // Stack to manage nesting
  let nestingLevel = 0;
  const indentation = '  '; // 2 spaces per level

  for (let i = 0; i < lines.length; i++) {
    const originalLine = lines[i];
    const trimmedLine = originalLine.trim();

    // Match \begin{itemize} or \begin{enumerate}
    const beginMatch = trimmedLine.match(/^\\begin\{(itemize|enumerate)\}/);
    if (beginMatch) {
      const listType = beginMatch[1] as 'itemize' | 'enumerate';
      listStateStack.push({ type: listType, counter: 0 });
      nestingLevel++;
      continue; // Don't add this line to output
    }

    // Match \end{itemize} or \end{enumerate}
    const endMatch = trimmedLine.match(/^\\end\{(itemize|enumerate)\}/);
    if (endMatch) {
      if (nestingLevel > 0) {
        listStateStack.pop();
        nestingLevel--;
      }
      continue; // Don't add this line to output
    }

    // Match \item inside a list environment
    const itemMatch = trimmedLine.match(/^\\item(?:\s+(.*))?$/);
    if (nestingLevel > 0 && itemMatch && listStateStack.length > 0) {
      const itemContent = itemMatch[1] || '';
      const currentState = listStateStack[listStateStack.length - 1];
      const currentIndentation = indentation.repeat(nestingLevel - 1);
      let marker: string;

      if (currentState.type === 'enumerate') {
        currentState.counter++;
        marker = `${currentState.counter}.`;
      } else {
        marker = '-';
      }
      resultLines.push(`${currentIndentation}${marker} ${itemContent}`);
    } else {
      // Keep lines that are not list controls or items within a list environment
      if (!beginMatch && !endMatch) {
         // Basic handling for multi-line content within items: add with current indent
         // A more robust parser would be needed for complex cases.
         if (nestingLevel > 0 && !itemMatch && originalLine.trim() !== '') {
             const currentIndentation = indentation.repeat(nestingLevel);
             resultLines.push(`${currentIndentation}${originalLine.trim()}`); // Indent continuation lines
         } else if (nestingLevel === 0) {
             resultLines.push(originalLine); // Keep lines outside any list environment
         }
         // Implicitly skip empty lines within lists for cleaner output, unless needed.
      }
    }
  }

  return resultLines.join('\n');
};

// Function to convert LaTeX tabular to Markdown table string
const latexTabularToMarkdownTable = (text: string): string => {
  const tabularRegex = /\\begin\{tabular\}\s*\{.*?\}([\s\S]*?)\\end\{tabular\}/gs;
  let lastIndex = 0;
  let resultString = ''; // Build the result string directly
  let match;

  while ((match = tabularRegex.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      resultString += text.substring(lastIndex, match.index);
    }

    const tabularContent = match[1].trim();
    const rows = tabularContent.split(/\\\\\s*/).filter(row => row.trim() !== ''); // Split rows by \\

    if (rows.length > 0) {
      const headerCells = rows[0].split('&').map(cell => cell.trim());
      const numColumns = headerCells.length;
      let markdownTable = `| ${headerCells.join(' | ')} |\n`;
      markdownTable += `| ${Array(numColumns).fill('---').join(' | ')} |\n`;
      for (let i = 1; i < rows.length; i++) {
        const dataCells = rows[i].split('&').map(cell => cell.trim());
        while (dataCells.length < numColumns) {
          dataCells.push('');
        }
        markdownTable += `| ${dataCells.slice(0, numColumns).join(' | ')} |\n`;
      }
      resultString += markdownTable.trim(); // Add the converted table
    } else {
      resultString += match[0]; // Add original match if parsing failed
    }
    lastIndex = tabularRegex.lastIndex;
  }

  // Add any remaining text after the last match
  if (lastIndex < text.length) {
    resultString += text.substring(lastIndex);
  }

  // If no tables were found, the loop wouldn't run, and lastIndex would be 0.
  if (lastIndex === 0) {
      return text; // Return original text if no tables found
  }

  return resultString;
};



export default function LaTeX({ children, display = false }: LaTeXProps) {
  // Since the preprocessor may have removed delimiters, re-add them based on display or inline mode
  // const content = children.trim(); // No longer needed, preprocessor keeps delimiters
  // const formattedContent = display ? `$$${content}$$` : `$${content}$`; // No longer needed
  const rawContent = children; // Use children directly as it contains delimiters
  // Process LaTeX: first convert tables, then convert lists
  const contentAfterTables = latexTabularToMarkdownTable(rawContent);
  const processedContent = latexListToMarkdown(contentAfterTables);
  // Check if the processed content is likely a Markdown table
  const isMarkdownTable = /\|\s*-{3,}\s*\|/.test(processedContent);

  // If it's a Markdown table, parse it and render using DataTable
  if (isMarkdownTable) {
    try {
      const lines = processedContent.trim().split('\n');
      if (lines.length < 2) { // Need at least header and separator
        console.error("Invalid Markdown table format (not enough lines):", processedContent);
        return <span className="text-red-500">Invalid Table Format</span>;
      }

      // Extract headers (from the first line)
      const headerCells = lines[0]
        .split('|')
        .map(cell => cell.trim())
        .filter(cell => cell !== ''); // Remove empty strings from start/end pipes

      if (headerCells.length === 0) {
        console.error("Could not parse table headers:", lines[0]);
        return <span className="text-red-500">Invalid Table Header</span>;
      }

      // Create data objects (from line 2 onwards, skipping separator)
      const data = lines.slice(2) // Skip header and separator line
        .map(rowLine => {
          const cells = rowLine
            .split('|')
            .map(cell => cell.trim())
            .filter(cell => cell !== ''); // Remove empty strings from start/end pipes

          // Ensure the number of cells matches the number of headers
          if (cells.length !== headerCells.length) {
             console.warn("Row cell count mismatch:", cells, "Headers:", headerCells, "Line:", rowLine);
             // Pad with empty strings if necessary, or handle as error
             while (cells.length < headerCells.length) cells.push('');
             // Alternatively, skip row or return error:
             // return null;
          }


          const rowObject: { [key: string]: string } = {};
          headerCells.forEach((header, index) => {
            rowObject[header] = cells[index] || ''; // Assign cell value or empty string if missing
          });
          return rowObject;
        })
        .filter(obj => obj !== null && Object.values(obj).some(val => val !== '')); // Filter out nulls (if skipping rows) and empty rows

      // Map header strings to ColumnData objects
      const columnData: ColumnData[] = headerCells.map(header => ({
        field: header, // Use header as the field key for the data object
        headerName: header // Use header as the display name
      }));

      // Generate columns using the imported function
      const columns = createColumns(columnData);

      // Render the DataTable
      return <DataTable columns={columns} data={data} />;
    } catch (error) {
       console.error("Error parsing Markdown table or rendering DataTable:", error, "Content:", processedContent);
       return <span className="text-red-500">Error Rendering Table</span>;
    }
  }

  // Configuration for MathJax
  const config = {
    loader: { load: ["input/tex", "output/chtml"] },
    tex: {
      inlineMath: [['$', '$'], ['\\(', '\\)']],
      displayMath: [['$$', '$$'], ['\\[', '\\]']],
      processEscapes: true,
      processEnvironments: true
    },
    chtml: {
      scale: 1.0
    }
  };

  try {
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
  } catch (error) {
    console.error("Error rendering LaTeX with MathJax:", error, "Content:", children);
    return (
      <span className={display ? 'block my-4 text-center text-red-500' : 'inline text-red-500'}>
        LaTeX rendering failed: Unsupported content or syntax error.
      </span>
    );
  }
}