'use client';
import { getCookie } from 'cookies-next';
import { redirect } from 'next/navigation';
import { PricingTable } from '@/components/auth/Subscribe';
import { ThemeToggle } from '@/components/layout/themes';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import React, { useState } from 'react';
import {
  LuDatabase as Database,
  LuMessageSquare as MessageSquare,
  LuFileText as FileText,
  LuSend as Send,
} from 'react-icons/lu';
import { BarChart3 } from 'lucide-react';

const features = [
  {
    title: 'Natural Language Queries',
    description: 'Ask complex questions in plain English and receive detailed analyses and visualizations.',
  },
  {
    title: 'Multi-Database Integration',
    description: 'Seamlessly connect to SQLite, MySQL, or PostgreSQL databases. Cross-database analysis coming soon!',
  },
  {
    title: 'Predictive Analytics',
    description: 'Leverage machine learning models to forecast trends and make data-driven decisions.',
  },
  {
    title: 'Automated Reporting',
    description: 'Schedule and generate comprehensive reports with key insights and visualizations.',
  },
  {
    title: 'Anomaly Detection',
    description: 'Automatically identify outliers and unusual patterns in your data.',
  },
  {
    title: 'Collaborative Insights',
    description: 'Share and discuss findings with team members in real-time.',
  },
];

const steps = [
  {
    icon: <Database className='w-6 h-6' />,
    title: '1. Connect Your Data',
    description: 'Securely connect your database(s) to our platform with ease.',
  },
  {
    icon: <MessageSquare className='w-6 h-6' />,
    title: '2. Ask Questions',
    description: 'Interact with our AI using natural language to query your data.',
  },
  {
    icon: <BarChart3 className='w-6 h-6' />,
    title: '3. AI Analysis',
    description: 'Our advanced AI analyzes your data and generates valuable insights.',
  },
  {
    icon: <FileText className='w-6 h-6' />,
    title: '4. Receive Insights',
    description: 'Get detailed reports, visualizations, and actionable recommendations.',
  },
];

const conversation = [
  {
    role: 'user',
    content: 'What were our top-selling products last quarter?',
  },
  {
    role: 'ai',
    content:
      'Based on the sales data from Q3, your top 3 products were: 1. Product A: $1.2M in revenue 2. Product B: $950K in revenue 3. Product C: $780K in revenue Would you like to see a breakdown by month or compare to previous quarters?',
  },
  {
    role: 'user',
    content: 'Yes, please show me a monthly trend for these products.',
  },
  {
    role: 'ai',
    content:
      "Certainly! I've generated a line chart showing the monthly sales trend for Products A, B, and C over the last quarter. The chart indicates that Product A had a significant spike in August, while Products B and C showed steady growth throughout the quarter.",
  },
];

function ExampleChat() {
  const [messages, setMessages] = useState(conversation);
  const [input, setInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      setMessages([...messages, { role: 'user', content: input }]);
      setInput('');
      // Simulate AI response
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            role: 'system',
            content: "I'm analyzing your request. Please allow me a moment to process the data and generate insights.",
          },
        ]);
      }, 1000);
    }
  };

  return (
    <div className='flex flex-col justify-center max-w-md mx-auto'>
      <div className='border rounded-lg shadow-sm bg-background'>
        <div className='flex flex-col space-y-1.5 p-6'>
          <h3 className='text-2xl font-semibold leading-none tracking-tight'>Example Conversation</h3>
          <p className='text-sm text-muted-foreground'>Ask questions and get insights from your data</p>
        </div>
        <div className='p-6 pt-0'>
          <div className='space-y-4'>
            {messages.map((message, index) => (
              <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`rounded-lg px-4 py-2 max-w-[80%] ${message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
                >
                  <p className='text-sm'>{message.content}</p>
                </div>
              </div>
            ))}
          </div>
          <form onSubmit={handleSubmit} className='flex items-center mt-4 space-x-2'>
            <Input placeholder='Type your question...' value={input} onChange={(e) => setInput(e.target.value)} />
            <Button type='submit'>
              <Send className='w-4 h-4' />
              <span className='sr-only'>Send</span>
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
export default function Home(searchParams: { searchParams: { [key: string]: string | string[] | undefined } }) {
  if (getCookie('jwt')) {
    redirect('/chat');
  }

  return (
    <div style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} className='w-full'>
      <header
        className='sticky top-0 flex items-center justify-between gap-4 px-4 border-b md:px-6 bg-muted min-h-16'
        style={{ paddingTop: 'env(safe-area-inset-top)', height: 'calc(3.5rem + env(safe-area-inset-top))' }}
      >
        <div className='flex items-center'>
          <Link href='/' className='flex items-center gap-2 text-lg font-semibold md:text-lg text-foreground'>
            <span className=''>{process.env.NEXT_PUBLIC_APP_NAME}</span>
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
        <section className='py-24 text-foreground bg-gradient-to-r from-primary-700 to-primary-900'>
          <div className='container px-6 mx-auto text-center'>
            <h1 className='mb-4 text-4xl font-bold md:text-6xl'>Your AI-Powered Business Intelligence Partner</h1>
            <p className='mb-8 text-xl'>Unlock deep insights from your databases with natural language conversations</p>
            <Link
              href='/user/login'
              className='inline-block px-6 py-3 font-semibold transition duration-300 border rounded-lg bg-primary text-primary-foreground hover:bg-primary-50'
            >
              Get Started Now
            </Link>
          </div>
        </section>
        <img src='/PoweredBy_AGiXT.svg' alt='Powered by AGiXT' className='w-32 mx-auto' />
        <section id='features' className='py-20 bg-background'>
          <div className='container px-6 mx-auto'>
            <h2 className='mb-12 text-3xl font-bold text-center'>Advanced Analytics at Your Fingertips</h2>
            <div className='grid grid-cols-1 gap-12 md:grid-cols-3'>
              {features.map((feature, index) => (
                <div key={index} className='p-6 rounded-lg shadow-md bg-secondary-50'>
                  <h3 className='mb-4 text-xl font-semibold text-primary-700'>{feature.title}</h3>
                  <p>{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section className='max-w-6xl p-4 mx-auto'>
          <div className='grid gap-6 lg:grid-cols-[1fr,400px] lg:gap-12 xl:grid-cols-[1fr,450px]'>
            <div className='flex flex-col justify-center space-y-4 md:justify-start'>
              <div className='flex flex-col items-center space-y-2'>
                <h2 className='text-3xl font-bold tracking-tighter sm:text-5xl'>How It Works</h2>
                <p className='max-w-[600px] text-gray-500 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed dark:text-gray-400 text-center'>
                  Unlock deep insights from your databases with natural language conversations. Here&apos;s how you can get
                  started:
                </p>
              </div>
              <div className='py-10 m-auto space-y-6 w-fit'>
                {steps.map((step, index) => (
                  <div key={index} className='flex items-center space-x-4'>
                    <div className='flex items-center justify-center w-12 h-12 text-white rounded-full bg-primary'>
                      {step.icon}
                    </div>
                    <div className='space-y-1'>
                      <h3 className='text-xl font-bold'>{step.title}</h3>
                      <p className='text-sm text-gray-500 dark:text-gray-400'>{step.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <ExampleChat />
          </div>
        </section>
        <section className='py-20 text-foreground bg-primary-800'>
          <div className='container px-6 mx-auto text-center'>
            <h2 className='mb-4 text-3xl font-bold'>Ready to Unlock the Full Potential of Your Data?</h2>
            <p className='mb-8 text-xl'>Start today and experience the power of AI-driven business intelligence.</p>
            <Link href='/user/login'>
              <Button size='lg'>Get Started Now</Button>
            </Link>
          </div>
        </section>
        <div className='flex flex-col items-center justify-center'>
          <PricingTable />
        </div>
        <section id='contact' className='py-20 bg-background'>
          <div className='w-full max-w-2xl mx-auto space-y-8'>
            <div className='space-y-2'>
              <h1 className='text-3xl font-bold'>Contact Us</h1>
              <p className='text-gray-500 dark:text-gray-400'>Please fill in the form below to get in touch.</p>
            </div>
            <div className='space-y-4'>
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
              <Button type='submit'>Submit</Button>
            </div>
          </div>
        </section>
        <div className='flex flex-col items-center justify-center'>
          <Link href='/docs/5-Reference/1-Privacy Policy'>Privacy Policy</Link>
        </div>
      </main>
    </div>
  );
}
