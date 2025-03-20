import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Hero } from '@/components/home/hero';
import { Features } from '@/components/home/features';
import { HowItWorks } from '@/components/home/how-it-works';
import { PricingTable } from '@/components/auth/Subscribe';
import { Contact } from '@/components/home/contact';
import { CallToAction } from '@/components/home/call-to-action';
import { ThemeToggle } from '@/components/layout/themes';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function Home(searchParams: { searchParams: { [key: string]: string | string[] | undefined } }) {
  if (cookies().has('jwt')) {
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
          <ThemeToggle initialTheme={cookies().get('theme')?.value} />
          <Link href='/user'>
            <Button size='lg' className='px-4 rounded-full'>
              Login or Register
            </Button>
          </Link>
        </div>
      </header>
      <main>
        <Hero />
        <img src='/PoweredBy_AGiXT.svg' alt='Powered by AGiXT' className='w-32 mx-auto' />
        <Features />
        <HowItWorks />

        <CallToAction />
        <div className='flex flex-col items-center justify-center'>
          <PricingTable />
        </div>
        <Contact />
        <div className='flex flex-col items-center justify-center'>
          <Link href='/docs/5-Reference/1-Privacy Policy'>Privacy Policy</Link>
        </div>
      </main>
    </div>
  );
}
