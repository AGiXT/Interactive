import { LuArrowLeft as ArrowLeft } from 'react-icons/lu';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { SidebarInset } from '@/components/ui/sidebar';
import Link from 'next/link';

interface AuthCardProps extends React.PropsWithChildren {
  showBackButton?: boolean;
  title: string;
  description: string;
  responseMessage?: string;
}

export default function AuthCard({ children, showBackButton, title, description, responseMessage }: AuthCardProps) {
  return (
    <SidebarInset className='flex flex-col w-full h-full'>
      <header
        className='sticky top-0 flex items-center justify-between gap-4 px-4 border-b md:px-6 bg-muted min-h-16'
        style={{ paddingTop: 'env(safe-area-inset-top', height: 'calc(3.5rem + env(safe-area-inset-top))' }}
      >
        <div className='flex items-center'>
          <Link href='/' className='flex items-center gap-2 text-lg font-semibold md:text-lg text-foreground'>
            <span className=''>{process.env.NEXT_PUBLIC_APP_NAME}</span>
          </Link>
        </div>
      </header>
      <div className='flex flex-col items-center justify-center flex-1 w-full'>
        <Card className='max-w-md mx-auto min-w-96'>
          <CardHeader>
            <div className='flex items-center justify-between'>
              <div className='min-w-8'>
                {showBackButton && (
                  <Button variant='ghost' size='icon' className='w-8 h-8' onClick={() => window.history.back()}>
                    <ArrowLeft className='w-5 h-5' />
                    <span className='sr-only'>Go back</span>
                  </Button>
                )}
              </div>
              <CardTitle className='text-2xl'>{title}</CardTitle>
              <div className='w-8' /> {/* Spacer for alignment */}
            </div>
            <CardDescription className='text-center'>{description}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className='grid gap-6'>{children}</div>
            {responseMessage && <ResponseMessage>{responseMessage}</ResponseMessage>}
          </CardContent>
        </Card>
      </div>
    </SidebarInset>
  );
}

export const ResponseMessage = ({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) => {
  return (
    <div className={cn('mt-4 text-sm text-center text-destructive', className)} {...props}>
      {children}
    </div>
  );
};
AuthCard.ResponseMessage = ResponseMessage;
