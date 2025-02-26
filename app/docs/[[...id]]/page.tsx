import { promises as fs } from 'fs'
import path from 'path'
import styles from './markdown.module.css'
import MarkdownBlock from '@/components/interactive/Chat/Message/MarkdownBlock';
import {
  SidebarProvider, 
  Sidebar, 
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub
} from '@/components/ui/sidebar'

const NAVIGATION_STRUCTURE: Array<{
  title: string;
  path?: string[];
  items?: any[];
  isSection?: boolean;
}> = [
  {
    title: 'GETTING STARTED',
    isSection: true,
    items: [
      { title: 'Introduction', path: [] }, // Maps to README.md
      { title: 'Quick Start', path: ['1-Getting started', '0-Quick Start'] },
      { title: 'Environment Variables', path: ['1-Getting started', '1-Environment Variables'] },
      { title: 'Examples', path: ['1-Getting started', '3-Examples'] },
      { title: 'Things to Consider', path: ['1-Getting started', '4-Things to Consider'] },
      { title: 'Preinstalled ISOs', path: ['1-Getting started', '5-Preinstalled ISOs'] }
    ]
  },
  {
    title: 'Support',
    path: ['1-Getting started', 'Support']
  },
  {
    title: 'CONCEPTS',
    isSection: true,
    items: [
      { title: 'Core Concepts', path: ['2-Concepts', '0-Core Concepts'] },
      { title: 'Processes and Frameworks', path: ['2-Concepts', '01-Processes and Frameworks'] }
    ]
  },
  {
    title: 'CORE CONCEPTS',
    isSection: true,
    items: [
      { title: 'Core Concepts', path: ['2-Concepts', '0-Core Concepts'] },
      { title: 'Processes and Frameworks', path: ['2-Concepts', '01-Processes and Frameworks'] },
      { title: 'Providers', path: ['2-Concepts', '02-Providers'] },
      { title: 'Agents', path: ['2-Concepts', '03-Agents'] },
      { title: 'Chat Completions', path: ['2-Concepts', '04-Chat Completions'] },
      { title: 'Extension Commands', path: ['2-Concepts', '05-Extension Commands'] },
      { title: 'Prompts', path: ['2-Concepts', '06-Prompts'] },
      { title: 'Chains', path: ['2-Concepts', '07-Chains'] },
      { title: 'Conversations', path: ['2-Concepts', '07-Conversations'] },
      { title: 'Agent Training', path: ['2-Concepts', '09-Agent Training'] },
      { title: 'Agent Interactions', path: ['2-Concepts', '10-Agent Interactions'] },
      { title: 'Extensions', path: ['2-Concepts', '11-Extensions'] }
    ]
  },
  {
    title: 'EXTENSIONS',
    isSection: true,
    items: [
      {
        title: 'PROVIDERS',
        isSection: true,
        items: [
          { title: 'LocalAI', path: ['3-Providers', '0-ezLocalai'] },
          { title: 'Anthropic Claude', path: ['3-Providers', '1-Anthropic Claude'] },
          { title: 'Azure OpenAI', path: ['3-Providers', '2-Azure OpenAI'] },
          { title: 'XAI', path: ['3-Providers', '3-xAI'] },
          { title: 'Google', path: ['3-Providers', '4-Google'] },
          { title: 'Hugging Face', path: ['3-Providers', '5-Hugging Face'] },
          { title: 'OpenAI', path: ['3-Providers', '6-OpenAI'] },
          { title: 'GPT4Free', path: ['3-Providers', '7-GPT4Free'] }
        ]
      }
    ]
  },
  {
    title: 'AUTHENTICATION',
    isSection: true,
    items: [
      { title: 'Amazon', path: ['4-Authentication', 'amazon'] },
      { title: 'GitHub', path: ['4-Authentication', 'github'] },
      { title: 'Google', path: ['4-Authentication', 'google'] },
      { title: 'Microsoft', path: ['4-Authentication', 'microsoft'] },
      { title: 'Oracle', path: ['4-Authentication', 'oracle'] }
    ]
  }
]

function NavItems({ items, currentPath, level = 0 }: {
  items: Array<{
    title: string;
    path?: string[];
    items?: any[];
    isSection?: boolean;
  }>;
  currentPath?: string[];
  level?: number;
}) {
  return (
    <>
      {items.map((item) => {
        if (item.items) {
          return (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton data-section={item.isSection}>
                {item.title}
              </SidebarMenuButton>
              <SidebarMenuSub>
                <NavItems items={item.items} currentPath={currentPath} level={level + 1} />
              </SidebarMenuSub>
            </SidebarMenuItem>
          )
        }

        const itemPath = item.path || []
        const isActive = currentPath?.join('/') === itemPath.join('/')
        const encodedPath = itemPath.map(segment => encodeURIComponent(segment))

        return (
          <SidebarMenuItem key={itemPath.join('/') || item.title}>
            <SidebarMenuButton asChild>
              <a 
                href={itemPath.length ? `/docs/${encodedPath.join('/')}` : '/docs'} 
                data-active={isActive}
              >
                {item.title}
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        )
      })}
    </>
  )
}

export default async function DocumentationPage({ params }: { params: { id?: string[] } }) {
  const fullPath = getFilePath(params)

  try {
    const content = await fs.readFile(fullPath, 'utf8')

    return (
      <SidebarProvider defaultLeftOpen={true} defaultRightOpen={false}>
        <div className="flex min-h-screen">
          <Sidebar className={styles.nav}>
            <SidebarHeader>
              <SidebarMenuButton asChild>
                <a href="/docs" className="text-sm font-medium px-2" data-active={!params.id}>
                  Documentation
                </a>
              </SidebarMenuButton>
            </SidebarHeader>
            <SidebarContent>
              <SidebarMenu>
                <NavItems items={NAVIGATION_STRUCTURE} currentPath={params.id} />
              </SidebarMenu>
            </SidebarContent>
          </Sidebar>
          
          <main className={styles.content}>
            <MarkdownBlock content={content} />
          </main>
        </div>
      </SidebarProvider>
    )
  } catch (error) {
    return (
      <SidebarProvider defaultLeftOpen={true} defaultRightOpen={false}>
        <div className="flex min-h-screen dark:bg-gray-900">
          <Sidebar className={styles.nav}>
            <SidebarHeader>
              <SidebarMenuButton asChild>
                <a href="/docs" className="text-sm font-medium px-2">
                  Documentation
                </a>
              </SidebarMenuButton>
            </SidebarHeader>
            <SidebarContent>
              <SidebarMenu>
                <NavItems items={NAVIGATION_STRUCTURE} currentPath={params.id} />
              </SidebarMenu>
            </SidebarContent>
          </Sidebar>
          
          <main className={styles.content}>
            <div className={styles.error}>
              <h1>Documentation Not Found</h1>
              <p>The requested documentation page could not be found.</p>
              <a href="/docs" className={styles.errorLink}>Return to Documentation</a>
            </div>
          </main>
        </div>
      </SidebarProvider>
    )
  }
}

function getFilePath(params: { id?: string[] }): string {
  if (!params.id) {
    return path.join(process.cwd(), 'docs-agixt', 'README.md')
  }

  // Decode URL-encoded segments
  const decodedPath = params.id.map(segment => decodeURIComponent(segment))
  // Check if the last segment ends with .md, if not append it
  const lastSegment = decodedPath[decodedPath.length - 1]
  if (!lastSegment.endsWith('.md')) {
    decodedPath[decodedPath.length - 1] = `${lastSegment}.md`
  }
  
  return path.join(process.cwd(), 'docs-agixt', ...decodedPath)
}