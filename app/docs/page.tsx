'use server';

import fs from 'fs';
import path from 'path';
import { SidebarPage } from '@/components/idiot/appwrapper/SidebarPage';
import MarkdownBlock from '@/components/interactive/Chat/Message/MarkdownBlock';

async function getContent(slug: string[]) {
  try {
    // If no specific slug, use the Introduction page
    if (!slug || slug.length === 0) {
      const introPath = path.join(process.cwd(), 'docs-agixt', '0-Introduction.md');
      return fs.readFileSync(introPath, 'utf8');
    }

    // Otherwise load specific file
    const filePath = path.join(process.cwd(), 'docs-agixt', `${slug.join('/')}.md`);
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    console.error('Error reading markdown file:', error);
    return '# Error\nFailed to load documentation content.';
  }
}

export default async function DocPage({ params }: { params: { slug: string[] } }) {
  const content = await getContent(params.slug || []);

  return (
    <SidebarPage title='Documentation'>
      <div className='mx-auto px-4'>
        <article className='prose dark:prose-invert prose-sm sm:prose-base lg:prose-lg overflow-x-hidden'>
          <MarkdownBlock content={content} />
        </article>
      </div>
    </SidebarPage>
  );
}
