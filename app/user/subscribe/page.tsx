'use client';
import Subscribe from '@/components/auth/Subscribe';

export default function Page({ searchParams }: { searchParams: { [key: string]: string | string[] | undefined } }) {
  return <Subscribe searchParams={searchParams} />;
}
