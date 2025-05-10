'use client';

import {
  BookOpen,
  Bot,
  GraduationCap,
  Link as LuLink,
  Puzzle,
  Rocket,
  Settings,
  SquareLibrary,
  User,
  Users,
  VenetianMask,
  Workflow,
  ListTodo,
} from 'lucide-react';
import { TbMessageCirclePlus } from 'react-icons/tb';
type NestedItem = {
  title: string;
  url: string;
};

export type SubItem = {
  max_role?: number;
  title: string;
  icon?: any;
  url: string;
  queryParams?: object;
  items?: NestedItem[];
};

export type Item = {
  title: string;
  url?: string;
  icon?: any;
  isActive?: boolean;
  queryParams?: object;
  items?: SubItem[];
  roleThreshold?: number;
};

export const items: Item[] = [
  {
    title: 'New Chat',
    url: '/chat',
    icon: TbMessageCirclePlus,
    isActive: true,
  },
  {
    title: 'Automation',
    icon: LuLink,
    items: [
      {
        title: 'Automation Chains',
        icon: Workflow,
        url: '/settings/chains',
      },
      {
        title: 'Prompt Library',
        icon: SquareLibrary,
        url: '/settings/prompts',
      },
      {
        title: 'Tasks',
        icon: ListTodo,
        url: '/tasks',
      },
    ],
    roleThreshold: 3,
  },
  {
    title: 'Agent Management',
    icon: Bot,
    items: [
      {
        title: 'Training',
        icon: GraduationCap,
        url: '/settings/training',
        queryParams: {
          mode: 'user',
        },
      },
      {
        title: 'Extensions',
        icon: Puzzle,
        url: '/settings/extensions',
        queryParams: {
          mode: 'user',
        },
      },
      {
        title: 'Abilities',
        icon: Workflow,
        url: '/settings/abilities',
        queryParams: {
          mode: 'user',
        },
      },
      {
        title: 'Settings',
        icon: Settings,
        url: '/settings',
      },
    ],
    roleThreshold: 3,
  },
  {
    title: 'Team',
    icon: Users,
    items: [
      {
        title: 'Team Management',
        icon: User,
        url: '/team',
      },
      {
        title: 'Agent Training',
        icon: GraduationCap,
        url: '/settings/training',
        queryParams: {
          mode: 'company',
        },
      },
      {
        title: 'Agent Extensions',
        icon: Puzzle,
        url: '/settings/extensions',
        queryParams: {
          mode: 'company',
        },
      },
      {
        title: 'Agent Abilities',
        icon: Workflow,
        url: '/settings/abilities',
        queryParams: {
          mode: 'company',
        },
      },
      {
        title: 'Agent Settings',
        icon: Settings,
        url: '/settings',
        queryParams: {
          mode: 'company',
        },
      },
    ],
    roleThreshold: 2,
  },
  {
    title: 'Documentation',
    icon: BookOpen,
    items: [
      {
        title: 'Getting Started',
        icon: Rocket,
        url: '/docs',
        items: [
          { title: 'Introduction', url: '/docs/0-Introduction' },
          { title: 'Quick Start', url: '/docs/1-Getting started/0-Quick Start' },
          { title: 'Environment', url: '/docs/1-Getting started/1-Environment Variables' },
          { title: 'Examples', url: '/docs/1-Getting started/2-Examples' },
          { title: 'Things to Consider', url: '/docs/1-Getting started/3-Things to Consider' },
          { title: 'Preinstalled ISOs', url: '/docs/1-Getting started/4-Preinstalled ISOs' },
          { title: 'Support', url: '/docs/1-Getting started/Support' },
        ],
      },
      {
        title: 'Core Concepts',
        icon: BookOpen,
        url: '/docs',
        items: [
          { title: 'Core Concepts', url: '/docs/2-Concepts/0-Core Concepts' },
          { title: 'Processes and Frameworks', url: '/docs/2-Concepts/01-Processes and Frameworks' },
          { title: 'Providers', url: '/docs/2-Concepts/02-Providers' },
          { title: 'Agents', url: '/docs/2-Concepts/03-Agents' },
          { title: 'Chat Completions', url: '/docs/2-Concepts/04-Chat Completions' },
          { title: 'Extension Commands', url: '/docs/2-Concepts/05-Extension Commands' },
          { title: 'Prompts', url: '/docs/2-Concepts/06-Prompts' },
          { title: 'Chains', url: '/docs/2-Concepts/07-Chains' },
          { title: 'Conversations', url: '/docs/2-Concepts/07-Conversations' },
          { title: 'Agent Training', url: '/docs/2-Concepts/09-Agent Training' },
          { title: 'Agent Interactions', url: '/docs/2-Concepts/10-Agent Interactions' },
          { title: 'Extensions', url: '/docs/2-Concepts/11-Extensions' },
        ],
      },
      {
        title: 'Providers',
        icon: Bot,
        url: '/docs',
        items: [
          { title: 'ezLocalai', url: '/docs/3-Providers/0-ezLocalai' },
          { title: 'Anthropic Claude', url: '/docs/3-Providers/1-Anthropic Claude' },
          { title: 'Azure OpenAI', url: '/docs/3-Providers/2-Azure OpenAI' },
          { title: 'xAI', url: '/docs/3-Providers/3-xAI' },
          { title: 'Google', url: '/docs/3-Providers/4-Google' },
          { title: 'Hugging Face', url: '/docs/3-Providers/5-Hugging Face' },
          { title: 'OpenAI', url: '/docs/3-Providers/6-OpenAI' },
          { title: 'GPT4Free', url: '/docs/3-Providers/7-GPT4Free' },
        ],
      },
      {
        title: 'Authentication',
        icon: VenetianMask,
        url: '/docs',
        items: [
          { title: 'Amazon', url: '/docs/4-Authentication/amazon' },
          { title: 'GitHub', url: '/docs/4-Authentication/github' },
          { title: 'Google', url: '/docs/4-Authentication/google' },
          { title: 'Microsoft', url: '/docs/4-Authentication/microsoft' },
        ],
      },
      {
        title: 'Reference',
        icon: BookOpen,
        url: '/docs',
        items: [
          { title: 'Cryptocurrency', url: '/docs/5-Reference/2-Cryptocurrency' },
          { title: 'API Reference', url: '/docs/5-Reference/0-API Reference' },
          { title: 'Privacy Policy', url: '/docs/5-Reference/1-Privacy Policy' },
          { title: 'Social Media', url: '/docs/5-Reference/3-Social Media' },
        ],
      },
    ],
    roleThreshold: 3,
  },
];
