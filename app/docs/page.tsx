import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import { SidebarPage } from '@/components/jrg/appwrapper/SidebarPage';
import MarkdownBlock from '@/components/interactive/Chat/Message/MarkdownBlock';
import fs from 'fs';
import path from 'path';

export default function DocsPage() {
  // Read README content for the main page
  const readmePath = path.join(process.cwd(), 'docs', 'README.md');
  let content = '';
  try {
    content = fs.readFileSync(readmePath, 'utf8');
  } catch (error) {
    content = '# AGiXT Documentation\n\nWelcome to AGiXT Documentation. Choose a topic from the sidebar to get started.';
  }

  return (
    <div className="container mx-auto p-4">
      <div className="mb-4">
        <Link href="/">
          <Button variant="ghost" className="gap-2">
            <ChevronLeft className="h-4 w-4" />
            Back to Home
          </Button>
        </Link>
      </div>
      <div className="prose dark:prose-invert max-w-none">
        <MarkdownBlock content={content} />
      </div>
    </div>
  );
}