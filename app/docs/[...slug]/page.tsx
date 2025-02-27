import fs from 'fs';
import path from 'path';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { SidebarPage } from '@/components/jrg/appwrapper/SidebarPage';
import MarkdownBlock from '@/components/interactive/Chat/Message/MarkdownBlock';

export default function DocPage({
  params,
}: {
  params: { slug: string[] }
}) {
  const slug = params.slug.join('/');
  const filePath = path.join(process.cwd(), 'app/docs', `${slug}.md`);
  let content = '';

  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    console.error('Error reading markdown file:', error);
    content = '# Error\nFailed to load documentation content.';
  }

  return (
    <SidebarPage title="Documentation" className="p-4">
      <div className="mb-4">
        <Link href="/docs">
          <Button variant="ghost" className="gap-2">
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>
        </Link>
      </div>
      <MarkdownBlock content={content} />
    </SidebarPage>
  );
}