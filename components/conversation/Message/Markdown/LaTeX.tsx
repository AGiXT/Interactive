import React, { ReactNode } from 'react';
import { MathJax, MathJaxContext } from 'better-react-mathjax';
// Removed unused 'parse' import from 'csv-parse/sync'

// --- START: Types and Parser moved from latexParser.ts ---

// Define ContentElement type union (no export needed)
type TextElement = { type: 'text'; value: string };
type SectionElement = { type: 'section'; level: number; starred: boolean; value: string };
type CenterStartElement = { type: 'center_start' };
type CenterEndElement = { type: 'center_end' };
type CsvAutoTabularElement = { type: 'csvautotabular'; value: string }; // Keep value for filename
type TextttElement = { type: 'texttt'; value: string }; // Added
// Removed MakeTitleElement

type ContentElement =
 | TextElement
 | SectionElement // Handles both \section and \section*
 | CenterStartElement
 | CenterEndElement
 | CsvAutoTabularElement
 | TextttElement; // Added
 // Removed MakeTitleElement

// Define ParsedLatexData interface (no export needed)
interface ParsedLatexData {
 documentclass: string | null;
 packages: string[];
 title?: string; // Added
 author?: string; // Added
 date?: string; // Added
 content: ContentElement[];
}

// Implement parseLatexSnippet function (no export needed)
function parseLatexSnippet(latexString: string): ParsedLatexData {
 let documentclass: string | null = null;
 const packages: string[] = [];
 let title: string | undefined = undefined;
 let author: string | undefined = undefined;
 let date: string | undefined = undefined;
 const content: ContentElement[] = [];

 // 1. Remove comments
 let processedString = latexString.replace(/%.*$/gm, '');

 // 2. Extract documentclass
 const docClassMatch = processedString.match(/\\documentclass(?:\[.*?\])?\{(.*?)\}/);
 if (docClassMatch) {
   documentclass = docClassMatch[1];
   processedString = processedString.replace(docClassMatch[0], ''); // Remove from string
 }

 // 3. Extract packages
 const packageRegex = /\\usepackage(?:\[.*?\])?\{(.*?)\}/g;
 let packageMatch;
 while ((packageMatch = packageRegex.exec(processedString)) !== null) {
   packages.push(packageMatch[1]);
 }
 // Remove package lines after extraction
 processedString = processedString.replace(/\\usepackage(?:\[.*?\])?\{.*?\}/g, '');

 // 4. Extract Preamble commands (title, author, date)
 const titleMatch = processedString.match(/\\title\{(.*?)\}/);
 if (titleMatch) {
     title = titleMatch[1];
     processedString = processedString.replace(titleMatch[0], '');
 }
 const authorMatch = processedString.match(/\\author\{(.*?)\}/);
 if (authorMatch) {
     author = authorMatch[1];
     processedString = processedString.replace(authorMatch[0], '');
 }
 const dateMatch = processedString.match(/\\date\{(.*?)\}/);
 if (dateMatch) {
     date = dateMatch[1];
     processedString = processedString.replace(dateMatch[0], '');
 }

 // 5. Find content within document environment
 const docContentMatch = processedString.match(/\\begin\{document\}([\s\S]*?)\\end\{document\}/);
 // If no \begin{document}, treat the whole remaining string as body
 const bodyContent = docContentMatch ? docContentMatch[1].trim() : processedString.trim();

 // 6. Sequentially parse body content
 // Define regexes for tokens we care about
 // Removed \maketitle from regex
 const tokenRegex = /(\\section\*?\{.*?\})|(\\begin\{center\})|(\\end\{center\})|(\\csvautotabular\{.*?\})|(\\texttt\{.*?\})/g;

 let lastIndex = 0;
 let match;

 while ((match = tokenRegex.exec(bodyContent)) !== null) {
   // Capture text between the last match and the current match
   if (match.index > lastIndex) {
     const text = bodyContent.substring(lastIndex, match.index).trim();
     if (text) {
       content.push({ type: 'text', value: text });
     }
   }

   // Process the matched token
   const token = match[0];
   if (token.startsWith('\\section')) {
     const sectionMatch = token.match(/\\section(\*?)\{(.*?)\}/);
     if (sectionMatch) {
       // Use existing SectionElement, differentiating starred/non-starred
       content.push({ type: 'section', level: 1, starred: sectionMatch[1] === '*', value: sectionMatch[2] });
     }
   } else if (token === '\\begin{center}') {
     content.push({ type: 'center_start' });
   } else if (token === '\\end{center}') {
     content.push({ type: 'center_end' });
   } else if (token.startsWith('\\csvautotabular')) {
      const csvMatch = token.match(/\\csvautotabular\{(.*?)\}/);
      if (csvMatch) {
        content.push({ type: 'csvautotabular', value: csvMatch[1] });
      }
   } else if (token.startsWith('\\texttt')) { // Added texttt handling
       // Extract raw content, handles \string correctly
       const textttMatch = token.match(/\\texttt\{([\s\S]*?)\}/);
       if (textttMatch) {
           content.push({ type: 'texttt', value: textttMatch[1] });
       }
   }
   // Removed \maketitle handler

   lastIndex = tokenRegex.lastIndex;
 }

 // Capture any remaining text after the last token
 if (lastIndex < bodyContent.length) {
   const text = bodyContent.substring(lastIndex).trim();
   if (text) {
     content.push({ type: 'text', value: text });
   }
 }


 return {
   documentclass,
   packages,
   title, // Added
   author, // Added
   date, // Added
   content,
 };
}

// --- END: Types and Parser moved from latexParser.ts ---


interface LaTeXProps {
  children: string;
  // display?: boolean; // Keep display prop for potential future use or context
}

// MathJax Configuration (remains the same)
const mathJaxConfig = {
  loader: { load: ["input/tex", "output/chtml", "[tex]/require", "[tex]/ams", "[tex]/boldsymbol"] },
  tex: {
    inlineMath: [['$', '$'], ['\\(', '\\)']],
    displayMath: [['$$', '$$'], ['\\[', '\\]']],
    processEscapes: true,
    processEnvironments: true,
    packages: {'[+]': ['require', 'ams', 'boldsymbol']},
    tags: 'ams'
  },
  chtml: {
    scale: 1.0,
    matchFontHeight: true
  }
};

// --- START: New Recursive Rendering Logic ---

interface RenderState {
  currentIndex: number;
  centerDepth: number;
}

function renderElements(elements: ContentElement[], state: RenderState): ReactNode[] {
  const rendered: ReactNode[] = [];
  let keyIndex = 0; // Unique key for list items

  while (state.currentIndex < elements.length) {
    const element = elements[state.currentIndex];
    const currentElementIndex = state.currentIndex; // Capture index before potential recursive calls modify it

    switch (element.type) {
      case 'text': {
        // Split text by double newlines and render each as a paragraph
        // Use MathJax for potential inline math within paragraphs
        const paragraphs = element.value.split(/\n\s*\n/);
        paragraphs.forEach((para, pIndex) => {
          if (para.trim()) { // Only render non-empty paragraphs
            rendered.push(
              <p key={`text-${currentElementIndex}-${pIndex}-${keyIndex++}`}>
                <MathJax inline={true}>{para}</MathJax>
              </p>
            );
          }
        });
        state.currentIndex++;
        break;
      }
      case 'section': { // Add braces for block scope
        // Render section* as h2, section as h3
        const SectionTag = element.starred ? 'h2' : 'h3';
        const sectionClasses = element.starred
            ? "text-xl font-semibold my-3 border-b pb-1" // Style for section* (h2)
            : "text-lg font-semibold my-2"; // Style for section (h3)
        rendered.push(
          <SectionTag key={`section-${currentElementIndex}-${keyIndex++}`} className={sectionClasses}>
            <MathJax inline={true}>{element.value}</MathJax> {/* Use MathJax for potential math in titles */}
          </SectionTag>
        );
        state.currentIndex++;
        break;
      } // Close braces

      case 'center_start': {
        state.currentIndex++; // Move past the start tag
        state.centerDepth++;
        // Recursively render content within the center block
        const centeredContent = renderElements(elements, state); // state is mutated by the call
        // The recursive call stops when it hits the matching end_center or end of elements
        rendered.push(
          <div key={`center-${currentElementIndex}-${keyIndex++}`} style={{ textAlign: 'center' }}>
            {centeredContent}
          </div>
        );
        // state.currentIndex is already advanced past the center block by the recursive call
        break;
      }
      case 'center_end':
        if (state.centerDepth > 0) {
          state.centerDepth--;
          state.currentIndex++;
          // This signals the end of the current recursive call for centering
          return rendered; // Return accumulated elements for this centered block
        } else {
          console.warn(`LaTeX Render: Encountered '\\end{center}' without matching '\\begin{center}' at index ${currentElementIndex}. Ignoring.`);
          state.currentIndex++; // Skip the unmatched end tag
        }
        break;

      case 'csvautotabular':
        // Render placeholder div
        rendered.push(
          <div key={`csv-${currentElementIndex}-${keyIndex++}`} className="border p-2 my-2 bg-gray-100 dark:bg-gray-800 text-center text-sm italic">
            [CSV Table Placeholder: {element.value}]
          </div>
        );
        state.currentIndex++;
        break;

      // Added texttt rendering
      case 'texttt':
        rendered.push(
          <code key={`texttt-${currentElementIndex}-${keyIndex++}`} className="font-mono bg-muted text-muted-foreground px-1 py-0.5 rounded text-sm">
            {/* Render raw value directly, do not process with MathJax */}
            {element.value}
          </code>
        );
        state.currentIndex++;
        break;

      // Removed maketitle case, handled in main component render

      default: {
        // Log warning for unknown types
        // Use 'never' to help TypeScript ensure all cases are handled
        const exhaustiveCheck: never = element;
        console.warn(`LaTeX Render: Encountered unknown element type at index ${currentElementIndex}:`, exhaustiveCheck);
        state.currentIndex++; // Move past the unknown element
        break;
      }
    }
  }

   // If we reach the end while still inside a center block, warn about mismatch
   if (state.centerDepth > 0 && state.currentIndex === elements.length) {
       console.warn(`LaTeX Render: Reached end of content with ${state.centerDepth} unmatched '\\begin{center}'.`);
   }


  return rendered;
}

// --- END: New Recursive Rendering Logic ---


export default function LaTeX({ children }: LaTeXProps) {
  const rawContent = children;
  const parsedData = parseLatexSnippet(rawContent);

  // Use the new rendering logic if parsing was successful (found elements or docclass)
  // Otherwise, fall back to rendering the raw content directly with MathJax.
  if (parsedData.documentclass || parsedData.packages.length > 0 || parsedData.content.length > 0) {
    const initialState: RenderState = { currentIndex: 0, centerDepth: 0 };
    const renderedContent = renderElements(parsedData.content, initialState);

    return (
      <MathJaxContext config={mathJaxConfig}>
        <div className="latex-parsed-content my-2 prose prose-sm dark:prose-invert max-w-none">
          {/* Render Preamble Info: Doc Class, Packages, Title, Author, Date */}
          {(parsedData.documentclass || parsedData.packages.length > 0 || parsedData.title || parsedData.author || parsedData.date) && (
            <div className="text-xs text-muted-foreground mb-3 border-b pb-2">
              {parsedData.documentclass && <span>Doc Class: <code>{parsedData.documentclass}</code></span>}
              {parsedData.documentclass && parsedData.packages.length > 0 && <span className="mx-2">|</span>}
              {parsedData.packages.length > 0 && <span>Packages: <code>{parsedData.packages.join(', ')}</code></span>}
            </div>
          )}

          {/* Render Title Block if title, author, or date exist */}
          {(parsedData.title || parsedData.author || parsedData.date) && (
            <div className="latex-title-block text-center my-4 border-y py-4">
              {parsedData.title && <h1 className="text-2xl font-bold mb-2"><MathJax inline={true}>{parsedData.title}</MathJax></h1>}
              {parsedData.author && <p className="text-lg mb-1"><MathJax inline={true}>{parsedData.author}</MathJax></p>}
              {parsedData.date && <p className="text-sm text-muted-foreground"><MathJax inline={true}>{parsedData.date}</MathJax></p>}
            </div>
          )}

          {/* Render the main parsed content */}
          {renderedContent}
        </div>
      </MathJaxContext>
    );

  } else {
    // Fallback: Render raw content using MathJax (for simple math expressions like $E=mc^2$)
    const trimmedContent = rawContent.trim();
    const isDisplay = (trimmedContent.startsWith('$$') && trimmedContent.endsWith('$$')) ||
                      (trimmedContent.startsWith('\\[') && trimmedContent.endsWith('\\]'));

     try {
         return (
          <MathJaxContext config={mathJaxConfig}>
            <MathJax
              className={isDisplay ? 'block my-4 text-center' : 'inline'}
              inline={!isDisplay}
              key={rawContent} // Use content as key for re-rendering on change
            >
              {/* Render raw content directly */}
              {rawContent}
            </MathJax>
          </MathJaxContext>
        );
     } catch (error) {
        console.error("Error rendering raw LaTeX with MathJax:", error, "Content:", rawContent);
        return (
          <span className={isDisplay ? 'block my-4 text-center text-red-500' : 'inline text-red-500'}>
            LaTeX rendering failed.
          </span>
        );
     }
  }
}