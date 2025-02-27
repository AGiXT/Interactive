import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import { SidebarPage } from '@/components/jrg/appwrapper/SidebarPage';
import MarkdownBlock from '@/components/interactive/Chat/Message/MarkdownBlock';
import fs from 'fs';
import path from 'path';

// Define documentation sections based on the AGiXT docs structure
const sections = [
  {
    title: 'Getting Started',
    items: [
      { title: 'Quick Start', slug: '1-Getting started/0-Quick Start' },
      { title: 'Environment Variables', slug: '1-Getting started/1-Environment Variables' },
      { title: 'Examples', slug: '1-Getting started/3-Examples' },
      { title: 'Things to Consider', slug: '1-Getting started/4-Things to Consider' },
      { title: 'Preinstalled ISOs', slug: '1-Getting started/5-Preinstalled ISOs' },
      { title: 'Support', slug: '1-Getting started/Support' },
    ],
  },
  {
    title: 'Concepts',
    items: [
      { title: 'Core Concepts', slug: '2-Concepts/0-Core Concepts' },
      { title: 'Processes and Frameworks', slug: '2-Concepts/01-Processes and Frameworks' },
      { title: 'Providers', slug: '2-Concepts/02-Providers' },
      { title: 'Agents', slug: '2-Concepts/03-Agents' },
      { title: 'Chat Completions', slug: '2-Concepts/04-Chat Completions' },
      { title: 'Extension Commands', slug: '2-Concepts/05-Extension Commands' },
      { title: 'Prompts', slug: '2-Concepts/06-Prompts' },
      { title: 'Chains', slug: '2-Concepts/07-Chains' },
      { title: 'Conversations', slug: '2-Concepts/07-Conversations' },
      { title: 'Agent Training', slug: '2-Concepts/09-Agent Training' },
      { title: 'Agent Interactions', slug: '2-Concepts/10-Agent Interactions' },
      { title: 'Extensions', slug: '2-Concepts/11-Extensions' },
    ],
  },
  {
    title: 'Providers',
    items: [
      { title: 'ezLocalai', slug: '3-Providers/0-ezLocalai' },
      { title: 'Anthropic Claude', slug: '3-Providers/1-Anthropic Claude' },
      { title: 'Azure OpenAI', slug: '3-Providers/2-Azure OpenAI' },
      { title: 'xAI', slug: '3-Providers/3-xAI' },
      { title: 'Google', slug: '3-Providers/4-Google' },
      { title: 'Hugging Face', slug: '3-Providers/5-Hugging Face' },
      { title: 'OpenAI', slug: '3-Providers/6-OpenAI' },
      { title: 'GPT4Free', slug: '3-Providers/7-GPT4Free' },
    ],
  },
  {
    title: 'Authentication',
    items: [
      { title: 'Amazon', slug: '4-Authentication/amazon' },
      { title: 'GitHub', slug: '4-Authentication/github' },
      { title: 'Google', slug: '4-Authentication/google' },
      { title: 'Microsoft', slug: '4-Authentication/microsoft' },
    ],
  },
];

export default function DocsPage() {
  // Read README content for the main page
  const readmePath = path.join(process.cwd(), 'app/docs', 'README.md');
  let content = '';
  try {
    content = fs.readFileSync(readmePath, 'utf8');
  } catch (error) {
    content = '# AGiXT Documentation';
  }

  return (
    <SidebarPage title="Documentation" className="p-4">
      <div className="mb-4">
        <Link href="/">
          <Button variant="ghost" className="gap-2">
            <ChevronLeft className="h-4 w-4" />
            Back to Home
          </Button>
        </Link>
      </div>
      
      {/* Main content section */}
      <div className="grid md:grid-cols-[300px_1fr] gap-6">
        {/* Navigation sidebar */}
        <nav className="space-y-6">
          {sections.map((section) => (
            <div key={section.title}>
              <h2 className="font-semibold mb-2">{section.title}</h2>
              <ul className="space-y-2">
                {section.items.map((item) => (
                  <li key={item.slug}>
                    <Link 
                      href={`/docs/${item.slug}`}
                      className="text-sm text-muted-foreground hover:text-primary hover:underline block py-1"
                    >
                      {item.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* Content area */}
        <div className="min-w-0">
          <MarkdownBlock content={content} />
        </div>
      </div>
    </SidebarPage>
  );
}