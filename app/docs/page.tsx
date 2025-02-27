'use server';

import fs from 'fs';
import path from 'path';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import { SidebarPage } from '@/components/jrg/appwrapper/SidebarPage';
import MarkdownBlock from '@/components/interactive/Chat/Message/MarkdownBlock';

function getAllMarkdownFiles(dir: string): string[] {
  const files: string[] = [];
  const items = fs.readdirSync(dir);

  items.forEach(item => {
    const fullPath = path.join(dir, item);
    if (fs.statSync(fullPath).isDirectory()) {
      files.push(...getAllMarkdownFiles(fullPath));
    } else if (item.endsWith('.md')) {
      files.push(fullPath);
    }
  });

  return files;
}

async function getContent(slug: string[]) {
  try {
    // If no specific slug, concatenate all markdown files
    if (!slug || slug.length === 0) {
        const docsPath = path.join(process.cwd(), 'docs-agixt'); // Path to AGiXT docs
        const markdownFiles = getAllMarkdownFiles(docsPath);
        const allContent = markdownFiles.map(file => {
            const content = fs.readFileSync(file, 'utf8');
            const relativePath = path.relative(docsPath, file);
            // Extract filename without extension for heading
            const filename = path.basename(relativePath, '.md');
            return `## ${filename}\n\n${content}\n\n---\n\n`; // Use filename for heading
        });
        return allContent.join('\n');
    }

    // Otherwise load specific file
    const filePath = path.join(process.cwd(), 'docs-agixt', `${slug.join('/')}.md`); // Path to AGiXT docs
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    console.error('Error reading markdown file:', error);
    return '# Error\nFailed to load documentation content.';
  }
}

export default async function DocPage({
  params,
}: {
  params: { slug: string[] }
}) {
  const content = await getContent(params.slug || []);

  return (
    <SidebarPage title="Documentation">
      <div className="w-full">
        <div className="mb-4">
          <Link href="/docs">
            <Button variant="ghost" className="gap-2">
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
        </div>
        <div className="prose dark:prose-invert w-full">
          <MarkdownBlock content={content} />
        </div>
      </div>
    </SidebarPage>
  );
}
