'use client';

import { getCookie } from 'cookies-next';
import React, { Suspense, useEffect, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';
import { LuCheck as CheckIcon, LuMinus as MinusIcon } from 'react-icons/lu';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import useSWR from 'swr';
import { useMediaQuery } from 'react-responsive';

type Product = {
  name: string;
  description: string;
  prices: {
    id: string;
    amount: number;
    currency: string;
    interval: string;
    interval_count: number;
    usage_type: string;
  }[];
  priceAnnual: string;
  marketing_features: { name: string }[];
  isMostPopular: boolean;
};

type PricingCardProps = Product & {
  isAnnual?: boolean;
  flatRate?: boolean;
  price: {
    id: string;
    amount: number;
    currency: string;
    interval: string;
    interval_count: number;
    usage_type: string;
  };
};

export function PricingTable() {
  const {
    data: pricingData,
    isLoading,
    error,
  } = useSWR(
    '/products',
    async () =>
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
        ? (
            await axios.get(`${process.env.NEXT_PUBLIC_AGIXT_SERVER}/v1/products`, {
              headers: {
                Authorization: getCookie('jwt'),
              },
            })
          ).data
            .map((x: any) => ({ ...x }))
            .sort((a: any, b: any) => (a.last_name > b.last_name ? 1 : -1))
        : [],
    {
      fallbackData: [],
    },
  );
  
  const isMobile = useMediaQuery({ maxWidth: 768 });
  const isTablet = useMediaQuery({ minWidth: 769, maxWidth: 1024 });
  
  return (
    <>
      {pricingData.length > 0 && (
        <div className="w-full px-4">
          <p className='mt-1 text-muted-foreground text-center'>
            Whatever your status, our offers evolve according to your needs.
          </p>

          <div className={`flex ${isMobile ? 'flex-col' : 'md:flex-row'} items-center md:items-stretch justify-center max-w-6xl gap-4 mx-auto my-10`}>
            {pricingData.map((product: Product) => (
              <PricingCard key={product.name} price={product.prices[0]} {...product} />
            ))}
          </div>
        </div>
      )}
    </>
  );
}

export function PricingCard({
  name,
  description,
  price,
  marketing_features,
  priceAnnual,
  isMostPopular,
  flatRate = false,
  isAnnual = false,
}: PricingCardProps) {
  const [quantity, setQuantity] = useState(1);
  const isMobile = useMediaQuery({ maxWidth: 768 });
  
  return (
    <Card
      className={cn(
        isMobile ? 'w-full' : 'w-full max-w-sm flex-1',
        'border-muted',
        isMostPopular ? 'mb-4 shadow-lg bg-primary text-primary-foreground' : 'mt-2',
      )}
    >
      <CardHeader className='pb-2 text-center'>
        {isMostPopular && (
          <Badge className='self-center mb-3 uppercase w-max bg-primary-foreground text-primary'>Most popular</Badge>
        )}
        <CardTitle className={isMostPopular ? '!mb-7' : 'mb-7'}>{name}</CardTitle>
        {flatRate && (
          <span className='text-5xl font-bold'>
            {isAnnual
              ? priceAnnual
              : `$${price.amount / 100}${price.currency.toLocaleUpperCase()} / ${price.interval_count} ${price.interval}`}
          </span>
        )}
      </CardHeader>
      <CardDescription className={cn(
        isMostPopular ? 'text-primary-foreground' : '',
        'text-center px-4'
      )}>
        {description}
      </CardDescription>
      <CardContent>
        <ul className={cn(
          'mt-7 space-y-2.5 text-sm',
          isMobile ? 'px-2' : ''
        )}>
          {marketing_features?.map((feature) => (
            <li className='flex space-x-2' key={feature.name}>
              {feature.name.startsWith('-') ? (
                <MinusIcon className='flex-shrink-0 mt-0.5 h-4 w-4' />
              ) : (
                <CheckIcon className='flex-shrink-0 mt-0.5 h-4 w-4' />
              )}
              <span className={isMostPopular ? 'text-primary-foreground' : 'text-muted-foreground'}>{feature.name}</span>
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter className='flex flex-col gap-4'>
        {getCookie('jwt') ? (
          <>
            <Label htmlFor='quantity' className={isMostPopular ? 'text-primary-foreground' : ''}>Initial Users</Label>
            <Input 
              id='quantity' 
              type='number' 
              value={quantity} 
              onChange={(e) => setQuantity(Number(e.target.value))}
              className={isMostPopular ? 'bg-primary-foreground/10 border-primary-foreground/20' : ''}
            />

            <Button
              className={cn(
                'w-full',
                isMostPopular ? 'text-primary bg-primary-foreground hover:bg-primary-foreground/90' : 'text-foreground'
              )}
              variant={'outline'}
              onClick={async () => {
                const checkout_uri = (
                  await axios.post(
                    process.env.NEXT_PUBLIC_AGIXT_SERVER + '/v1/checkout',
                    {
                      cart: [
                        {
                          price: price.id,
                          quantity: quantity,
                        },
                      ],
                    },
                    {
                      headers: {
                        Authorization: getCookie('jwt'),
                      },
                    },
                  )
                ).data.detail;
                window.location.href = checkout_uri;
              }}
            >
              Sign up
            </Button>
          </>
        ) : (
          <Link href='/user' className='w-full'>
            <Button 
              className={cn(
                'w-full',
                isMostPopular ? 'text-primary bg-primary-foreground hover:bg-primary-foreground/90' : 'text-foreground'
              )} 
              variant={'outline'}
            >
              Sign up
            </Button>
          </Link>
        )}
      </CardFooter>
    </Card>
  );
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      'stripe-pricing-table': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    }
  }
}

export default function Subscribe({ searchParams }: { searchParams: any }): JSX.Element {
  const isMobile = useMediaQuery({ maxWidth: 768 });
  
  return (
    <>
      {process.env.NEXT_PUBLIC_STRIPE_PRICING_TABLE_ID ? (
        <Suspense fallback={<p>Loading pricing...</p>}>
          <div id='stripe-box' className={isMobile ? 'overflow-x-auto max-w-[95vw]' : ''}>
            <script async src='https://js.stripe.com/v3/pricing-table.js' />
            <stripe-pricing-table
              pricing-table-id={process.env.NEXT_PUBLIC_STRIPE_PRICING_TABLE_ID ?? ''}
              publishable-key={process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ''}
              customer-session-client-secret={searchParams?.customer_session}
              customer-email={searchParams?.customer_session ? undefined : searchParams?.email || getCookie('email')}
            />
          </div>
        </Suspense>
      ) : (
        <PricingTable />
      )}
    </>
  );
}