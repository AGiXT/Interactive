// ./app/page.tsx
'use client';
import { getCookie } from 'cookies-next';
import { redirect } from 'next/navigation';
import { ThemeToggle } from '@/components/layout/themes';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import React, { useState } from 'react'; // Added useState
import {
  LuDatabase as Database,
  LuBrainCircuit as BrainCircuit,
  LuWebhook as Webhook,
  LuGitBranch as GitBranch,
  LuMemoryStick as MemoryStick,
  LuPuzzle as Puzzle,
  LuUsers as Users,
  LuShieldCheck as ShieldCheck,
  LuWorkflow as Workflow,
  LuSettings2 as Settings2,
  LuMessageSquare as MessageSquare,
  LuBarChart3 as BarChart3,
  LuFileText as FileText,
  LuCircleDollarSign, // Added Icon for Crypto
  LuSparkles, // Added Icon for Rewards
  LuTag, // Added Icon for Discounts
  LuWallet, // Added Icon for Wallet
  LuCopy, // Added Icon for Copy
  LuExternalLink, // Added Icon for External Link
  LuCheck, // Added Icon for Check
} from 'react-icons/lu';
import { PricingTable } from '@/components/auth/Subscribe';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'; // Added Card imports
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'; // Added Tooltip imports
import { toast } from '@/components/layout/toast'; // Added toast import

// Feature Lists (remain the same)
const coreFeatures = [
  // ... (keep existing coreFeatures)
  {
    icon: BrainCircuit,
    title: 'Agent Orchestration',
    description: 'Manage and coordinate multiple AI agents seamlessly across various tasks.',
  },
  {
    icon: Webhook,
    title: 'Multi-Provider Support',
    description: 'Integrate with OpenAI, Anthropic, Google Gemini, ezLocalai, Hugging Face, and more.',
  },
  {
    icon: Workflow,
    title: 'Chain Automation',
    description: 'Create complex, multi-step workflows linking prompts, commands, and other chains.',
  },
  {
    icon: Puzzle,
    title: 'Extensible Plugin System',
    description: 'Enhance agent capabilities with extensions for web browsing, database interaction, GitHub, and more.',
  },
  {
    icon: MemoryStick,
    title: 'Adaptive Memory',
    description: 'Combines long-term (vector DB) and short-term (conversation) memory for context-aware responses.',
  },
  {
    icon: Settings2,
    title: 'Advanced AI Modes',
    description: 'Utilize Smart Instruct & Smart Chat for AI-driven planning, research, and execution.',
  },
];

const integrationFeatures = [
  // ... (keep existing integrationFeatures)
  {
    icon: GitBranch,
    title: 'Developer Integrations',
    description: 'Connect with GitHub for code analysis, issue management, and automated PRs.',
  },
  {
    icon: Database,
    title: 'Data Integrations',
    description: 'Interact with SQL databases (PostgreSQL, MySQL, MSSQL) using natural language or direct queries.',
  },
  {
    icon: MessageSquare,
    title: 'Communication Tools',
    description: 'Integrate with Microsoft 365, Google Workspace, Discord, and SendGrid for seamless communication.',
  },
];

const managementFeatures = [
  // ... (keep existing managementFeatures)
  {
    icon: Users,
    title: 'Team Collaboration',
    description: 'Multi-tenant support with role-based access control for secure team usage.',
  },
  {
    icon: ShieldCheck,
    title: 'Secure & Configurable',
    description: 'Robust authentication (MFA, SSO), encrypted storage, and highly configurable settings.',
  },
  {
    icon: FileText,
    title: 'Comprehensive Management UI',
    description: 'Manage agents, prompts, chains, training data, and user settings through an intuitive web interface.',
  },
];

// How It Works steps (remain the same)
const steps = [
  // ... (keep existing steps)
  {
    icon: <Database className='w-6 h-6' />,
    title: '1. Configure Agents',
    description: 'Define agents, select AI providers, enable extensions, and set personas.',
  },
  {
    icon: <MessageSquare className='w-6 h-6' />,
    title: '2. Interact or Automate',
    description: 'Chat with agents, provide instructions, or execute automated chains.',
  },
  {
    icon: <BrainCircuit className='w-6 h-6' />,
    title: '3. AI Orchestration',
    description: 'AGiXT manages context, memory, commands, and provider interactions.',
  },
  {
    icon: <FileText className='w-6 h-6' />,
    title: '4. Receive Results',
    description: 'Get intelligent responses, completed tasks, generated content, or executed actions.',
  },
];

// $AGiXT Token Information
const agixtTokenAddress = 'F9TgEJLLRUKDRF16HgjUCdJfJ5BK6ucyiW8uJxVPpump'; // <--- IMPORTANT: REPLACE WITH ACTUAL ADDRESS
const solscanLink = `https://solscan.io/token/${agixtTokenAddress}`;
const explorerLink = `https://explorer.solana.com/address/${agixtTokenAddress}`;

const cryptoFeatures = [
  {
    icon: LuCircleDollarSign,
    title: 'Ecosystem Payments',
    description: 'Utilize $AGiXT for seamless payments for API usage, agent interactions, training, and premium features.',
  },
  {
    icon: LuTag,
    title: 'Exclusive Discounts',
    description: 'Unlock discounts on services and features when paying with the native $AGiXT token.',
  },
  {
    icon: LuSparkles,
    title: 'Rewards & Incentives',
    description: 'Earn $AGiXT by providing valuable feedback (RLHF) and contributing to the ecosystem.',
  },
  {
    icon: LuWallet,
    title: 'Integrated Wallets',
    description: 'Each user and agent gets a secure, integrated Solana wallet for easy token management.',
  },
];

// Helper function for copying text
const copyToClipboard = (text: string, successMessage: string) => {
  navigator.clipboard
    .writeText(text)
    .then(() => {
      toast({ title: 'Copied!', description: successMessage });
    })
    .catch((err) => {
      toast({ title: 'Error', description: 'Failed to copy.', variant: 'destructive' });
      console.error('Failed to copy text: ', err);
    });
};

export default function Home() {
  if (getCookie('jwt')) {
    redirect('/chat');
  }

  const [copied, setCopied] = useState(false);

  const handleCopyAddress = () => {
    copyToClipboard(agixtTokenAddress, 'Token address copied to clipboard.');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000); // Reset icon after 2 seconds
  };

  return (
    <div style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} className='w-full bg-background text-foreground'>
      {/* Header */}
      <header
        className='sticky top-0 z-30 flex items-center justify-between gap-4 px-4 border-b md:px-6 bg-muted min-h-16' // Added z-30
        style={{ paddingTop: 'env(safe-area-inset-top)', height: 'calc(3.5rem + env(safe-area-inset-top))' }}
      >
        <div className='flex items-center'>
          <Link href='/' className='flex items-center gap-2 text-lg font-semibold md:text-lg text-foreground'>
            <span className=''>{process.env.NEXT_PUBLIC_APP_NAME || 'AGiXT'}</span>
          </Link>
        </div>
        <div className='flex items-center gap-2'>
          <Link href='/docs'>
            <Button variant='ghost' size='lg' className='px-4'>
              Documentation
            </Button>
          </Link>
          <ThemeToggle initialTheme={getCookie('theme')?.value} />
          <Link href='/user'>
            <Button size='lg' className='px-4 rounded-full'>
              Login or Register
            </Button>
          </Link>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className='relative py-24 text-foreground bg-gradient-to-b from-background via-background to-muted/30'>
          {' '}
          {/* Adjusted gradient */}
          <div className='container relative z-10 px-6 mx-auto text-center'>
            {' '}
            {/* Added relative z-10 */}
            <h1 className='mb-4 text-4xl font-bold md:text-6xl'>AGiXT: Your Extensible AI Automation Platform</h1>
            <p className='mb-8 text-xl text-muted-foreground max-w-3xl mx-auto'>
              Orchestrate AI agents, manage instructions across diverse providers, and automate complex tasks with adaptive
              memory and a powerful plugin system. Now powered by the $AGiXT token on Solana.
            </p>
            <Link
              href='/user'
              className='inline-block px-8 py-3 text-lg font-semibold transition duration-300 border rounded-lg bg-primary text-primary-foreground hover:bg-primary/90'
            >
              Get Started Free
            </Link>
            <img src='/PoweredBy_AGiXT.svg' alt='Powered by AGiXT' className='w-32 mx-auto mt-10' />
          </div>
        </section>

        {/* Core Features Section */}
        <section id='features' className='py-20 bg-background'>
          <div className='container px-6 mx-auto'>
            <h2 className='mb-16 text-3xl font-bold text-center'>Powerful Features, Limitless Potential</h2>
            <div className='grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3'>
              {coreFeatures.map((feature, index) => (
                <Card
                  key={index}
                  className='flex flex-col items-center p-6 text-center shadow-sm hover:shadow-md transition-shadow'
                >
                  {' '}
                  {/* Used Card */}
                  <CardHeader className='p-0 mb-4'>
                    <feature.icon className='w-10 h-10 text-primary' />
                  </CardHeader>
                  <CardContent className='p-0'>
                    <h3 className='mb-2 text-xl font-semibold'>{feature.title}</h3>
                    <p className='text-muted-foreground'>{feature.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className='py-20 bg-muted/50'>
          {/* ... (keep existing How It Works section) ... */}
          <div className='container px-6 mx-auto'>
            <h2 className='mb-16 text-3xl font-bold text-center'>Simple Steps to Powerful AI Automation</h2>
            <div className='grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-4'>
              {steps.map((step, index) => (
                <div key={index} className='flex flex-col items-center text-center'>
                  <div className='flex items-center justify-center w-16 h-16 mb-4 rounded-full bg-primary text-primary-foreground'>
                    {step.icon}
                  </div>
                  <h3 className='mb-2 text-xl font-semibold'>{step.title}</h3>
                  <p className='text-muted-foreground'>{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* --- NEW: $AGiXT Token Section --- */}
        <section id='token' className='py-20 bg-gradient-to-br from-primary/5 via-background to-primary/5'>
          <div className='container px-6 mx-auto'>
            <div className='max-w-4xl mx-auto text-center'>
              <LuCircleDollarSign className='w-16 h-16 mx-auto mb-6 text-primary' />
              <h2 className='mb-4 text-3xl font-bold'>Fueling the AGiXT Ecosystem: The $AGiXT Token</h2>
              <p className='mb-10 text-lg text-muted-foreground'>
                $AGiXT is the official SPL utility token on the Solana blockchain, designed to power interactions, provide
                discounts, and reward contributions within the AGiXT platform.
              </p>
            </div>

            <div className='grid grid-cols-1 gap-8 mb-12 md:grid-cols-2 lg:grid-cols-4'>
              {cryptoFeatures.map((feature) => (
                <div
                  key={feature.title}
                  className='flex flex-col items-center p-6 text-center border rounded-lg shadow-sm bg-card'
                >
                  <feature.icon className='w-10 h-10 mb-4 text-primary' />
                  <h3 className='mb-2 text-xl font-semibold'>{feature.title}</h3>
                  <p className='text-muted-foreground'>{feature.description}</p>
                </div>
              ))}
            </div>

            <Card className='max-w-2xl p-6 mx-auto shadow-lg bg-card'>
              <CardHeader className='p-0 mb-4 text-center'>
                <CardTitle className='text-2xl'>Token Information</CardTitle>
              </CardHeader>
              <CardContent className='p-0 space-y-4'>
                <div className='flex flex-col items-center justify-between gap-2 p-4 border rounded-md md:flex-row bg-muted/50'>
                  <Label htmlFor='token-address' className='text-sm font-medium shrink-0'>
                    $AGiXT Token Address (Solana):
                  </Label>
                  <div className='flex items-center w-full gap-2 md:w-auto'>
                    <Input
                      id='token-address'
                      readOnly
                      value={agixtTokenAddress}
                      className='flex-grow font-mono text-xs truncate md:text-sm'
                      aria-label='AGiXT Token Address'
                    />
                    <TooltipProvider delayDuration={100}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant='outline' size='icon' onClick={handleCopyAddress} className='shrink-0'>
                            {copied ? <LuCheck className='w-4 h-4 text-green-500' /> : <LuCopy className='w-4 h-4' />}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Copy Address</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
                <div className='flex flex-col items-center justify-center gap-4 pt-2 md:flex-row'>
                  <Button variant='outline' asChild>
                    <a href={solscanLink} target='_blank' rel='noopener noreferrer'>
                      View on Solscan <LuExternalLink className='w-4 h-4 ml-2' />
                    </a>
                  </Button>
                  <Button variant='outline' asChild>
                    <a href={explorerLink} target='_blank' rel='noopener noreferrer'>
                      View on Solana Explorer <LuExternalLink className='w-4 h-4 ml-2' />
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
        {/* --- END: $AGiXT Token Section --- */}

        {/* Integrations Section */}
        <section className='py-20 bg-background'>
          {/* ... (keep existing Integrations section) ... */}
          <div className='container px-6 mx-auto'>
            <h2 className='mb-16 text-3xl font-bold text-center'>Seamless Integrations</h2>
            <div className='grid grid-cols-1 gap-8 md:grid-cols-3'>
              {integrationFeatures.map((feature, index) => (
                <Card
                  key={index}
                  className='flex flex-col items-center p-6 text-center shadow-sm hover:shadow-md transition-shadow'
                >
                  <CardHeader className='p-0 mb-4'>
                    <feature.icon className='w-10 h-10 text-primary' />
                  </CardHeader>
                  <CardContent className='p-0'>
                    <h3 className='mb-2 text-xl font-semibold'>{feature.title}</h3>
                    <p className='text-muted-foreground'>{feature.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Management Features Section */}
        <section className='py-20 bg-muted/50'>
          {/* ... (keep existing Management Features section) ... */}
          <div className='container px-6 mx-auto'>
            <h2 className='mb-16 text-3xl font-bold text-center'>Management & Security</h2>
            <div className='grid grid-cols-1 gap-8 md:grid-cols-3'>
              {managementFeatures.map((feature, index) => (
                <Card
                  key={index}
                  className='flex flex-col items-center p-6 text-center shadow-sm hover:shadow-md transition-shadow'
                >
                  <CardHeader className='p-0 mb-4'>
                    <feature.icon className='w-10 h-10 text-primary' />
                  </CardHeader>
                  <CardContent className='p-0'>
                    <h3 className='mb-2 text-xl font-semibold'>{feature.title}</h3>
                    <p className='text-muted-foreground'>{feature.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Call to Action Section */}
        <section className='py-20 text-white bg-primary'>
          {/* ... (keep existing CTA section) ... */}
          <div className='container px-6 mx-auto text-center'>
            <h2 className='mb-4 text-3xl font-bold'>Ready to Automate and Innovate with AI?</h2>
            <p className='mb-8 text-xl text-primary-foreground/90'>
              Join the AGiXT platform today and start building intelligent agents.
            </p>
            <Link href='/user'>
              <Button size='lg' variant='secondary' className='text-primary hover:bg-secondary/90'>
                Sign Up or Login
              </Button>
            </Link>
          </div>
        </section>

        {/* Pricing Section */}
        <section className='py-20 bg-background'>
          <div className='container px-6 mx-auto'>
            <h2 className='mb-4 text-3xl font-bold text-center'>Pricing Plans</h2>
            <p className='mb-10 text-lg text-center text-muted-foreground'>
              Choose a plan that suits your needs. Pay with traditional methods or use $AGiXT for discounts!
            </p>
            <div className='flex flex-col items-center justify-center'>
              <PricingTable />
            </div>
          </div>
        </section>

        {/* Contact Section */}
        <section id='contact' className='py-20 bg-muted/50'>
          {/* ... (keep existing Contact section) ... */}
          <div className='w-full max-w-2xl px-6 mx-auto space-y-8'>
            <div className='space-y-2 text-center'>
              <h2 className='text-3xl font-bold'>Contact Us</h2>
              <p className='text-muted-foreground'>Have questions? Fill out the form below to get in touch.</p>
            </div>
            <form className='space-y-4'>
              <div className='space-y-2'>
                <Label htmlFor='name'>Name</Label>
                <Input id='name' placeholder='Enter your name' />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='email'>Email</Label>
                <Input id='email' placeholder='Enter your email' type='email' />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='message'>Message</Label>
                <Textarea id='message' placeholder='Enter your message' className='min-h-[100px]' />
              </div>
              <Button type='submit' className='w-full'>
                Submit
              </Button>
            </form>
          </div>
        </section>

        {/* Footer Links */}
        <footer className='py-6 text-center bg-background'>
          <div className='flex justify-center gap-4'>
            <Link href='/docs/5-Reference/1-Privacy%20Policy' className='text-sm text-muted-foreground hover:underline'>
              Privacy Policy
            </Link>
            <Link href='/docs/5-Reference/2-Cryptocurrency' className='text-sm text-muted-foreground hover:underline'>
              $AGiXT Token Info
            </Link>
          </div>
        </footer>
      </main>
    </div>
  );
}
