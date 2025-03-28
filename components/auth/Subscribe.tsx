'use client';

import { getCookie } from 'cookies-next';
import React, { Suspense } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';
import { LuCheck as CheckIcon, LuMinus as MinusIcon } from 'react-icons/lu';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import useSWR from 'swr';

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
  return (
    <>
      {pricingData.length > 0 && (
        <>
          <p className='mt-1 text-muted-foreground'>Whatever your status, our offers evolve according to your needs.</p>

          <div className='flex flex-col items-center max-w-4xl gap-4 px-3 mx-auto my-10 md:items-end md:flex-row'>
            {pricingData.map((product: Product) => (
              <PricingCard key={product.name} price={product.prices[0]} {...product} /> //isAnnual={isAnnual}
            ))}
          </div>
        </>
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
  return (
    <Card
      className={cn(
        'w-full max-w-96 border-muted',
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
              : `$${price.unit_amount / 100}${price.currency.toLocaleUpperCase()} / ${price.recurring.interval_count} ${price.recurring.interval}`}
          </span>
        )}
      </CardHeader>
      <CardDescription className={isMostPopular ? 'w-11/12 mx-auto text-primary-foreground' : 'text-center'}>
        {description}
      </CardDescription>
      <CardContent>
        <ul className='mt-7 space-y-2.5 text-sm'>
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
            <Label htmlFor='quantity'>Initial Users</Label>
            <Input id='quantity' type='number' value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />

            <Button
              className='w-full text-foreground'
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
            <Button className='w-full text-foreground' variant={'outline'}>
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
  return (
    <>
      {process.env.NEXT_PUBLIC_STRIPE_PRICING_TABLE_ID ? (
        <Suspense fallback={<p>Loading pricing...</p>}>
          <div id='stripe-box'>
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
