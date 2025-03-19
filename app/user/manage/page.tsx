'use client';
import axios from 'axios';
import { deleteCookie, getCookie } from 'cookies-next';
import { ReactNode, useState } from 'react';
import useSWR, { mutate } from 'swr';
import { useRouter } from 'next/navigation';
import { DynamicFormFieldValueTypes } from '@/components/layout/dynamic-form/DynamicForm';
import { Button } from '@/components/ui/button';
import DynamicForm from '@/components/layout/dynamic-form/DynamicForm';
import { Separator } from '@/components/ui/separator';
import { SidebarPage } from '@/components/layout/SidebarPage';

export default function Manage(): ReactNode {
  const [responseMessage, setResponseMessage] = useState('');
  const router = useRouter();

  type User = {
    missing_requirements?: {
      [key: string]: {
        type: 'number' | 'boolean' | 'text' | 'password';
        value: DynamicFormFieldValueTypes;
        validation?: (value: DynamicFormFieldValueTypes) => boolean;
      };
    };
  };

  const { data, error, isLoading } = useSWR<User, any, string>('/user', async () => {
    return (
      await axios.get(`${process.env.NEXT_PUBLIC_AGIXT_SERVER}/v1/user`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: getCookie('jwt'),
        },
        validateStatus: (status) => [200, 403].includes(status),
      })
    ).data;
  });

  return (
    <SidebarPage title='Account Management'>
      <div>
        <div>
          <h3 className='text-lg font-medium'>Profile</h3>
          <p className='text-sm text-muted-foreground'>Apply basic changes to your profile</p>
        </div>
        <Separator className='my-4' />
        {isLoading ? (
          <p>Loading Current Data...</p>
        ) : error ? (
          <p>{error.message}</p>
        ) : (data?.missing_requirements && Object.keys(data.missing_requirements).length === 0) ||
          !data?.missing_requirements ? (
          <DynamicForm
            toUpdate={data}
            submitButtonText='Update'
            excludeFields={[
              'id',
              'agent_id',
              'missing_requirements',
              'email',
              'subscription',
              'stripe_id',
              'ip_address',
              'companies',
            ]}
            readOnlyFields={['input_tokens', 'output_tokens']}
            additionalButtons={[
              <Button key='done' className='col-span-2' onClick={() => router.push('/chat')}>
                Go to {process.env.NEXT_PUBLIC_APP_NAME}
              </Button>,
            ]}
            onConfirm={async (formData) => {
              const updateResponse = (
                await axios
                  .put(
                    `${process.env.NEXT_PUBLIC_AGIXT_SERVER}/v1/user`,
                    {
                      ...Object.entries(formData).reduce((acc, [key, value]) => {
                        return value ? { ...acc, [key]: value } : acc;
                      }, {}),
                    },
                    {
                      headers: {
                        'Content-Type': 'application/json',
                        Authorization: getCookie('jwt'),
                      },
                    },
                  )
                  .catch((exception: any) => exception.response)
              ).data;
              setResponseMessage(updateResponse.detail.toString());
              await mutate('/user');
            }}
          />
        ) : (
          <>
            {data?.missing_requirements?.some((obj) => Object.keys(obj).some((key) => key === 'verify_email')) && (
              <p className='text-xl'>Please check your email and verify it using the link provided.</p>
            )}
            {data?.missing_requirements?.some((obj) =>
              Object.keys(obj).some((key) => !['verify_email', 'verify_sms'].includes(key)),
            ) && (
              <DynamicForm
                submitButtonText='Submit Missing Information'
                fields={Object.entries(data.missing_requirements).reduce((acc, [key, value]) => {
                  // @ts-expect-error This is a valid assignment.
                  acc[Object.keys(value)[0]] = { type: Object.values(value)[0] };
                  return acc;
                }, {})}
                excludeFields={['verify_email', 'verify_sms']}
                onConfirm={async (formData) => {
                  const updateResponse = (
                    await axios
                      .put(
                        `${process.env.NEXT_PUBLIC_AGIXT_SERVER}/v1/user`,
                        {
                          ...formData,
                        },
                        {
                          headers: {
                            'Content-Type': 'application/json',
                            Authorization: getCookie('jwt'),
                          },
                        },
                      )
                      .catch((exception: any) => exception.response)
                  ).data;
                  if (updateResponse.detail) {
                    setResponseMessage(updateResponse.detail.toString());
                  }
                  await mutate('/user');
                  if (data.missing_requirements && Object.keys(data.missing_requirements).length === 0) {
                    const redirect = getCookie('href') ?? '/';
                    deleteCookie('href');
                    router.push(redirect);
                  }
                }}
              />
            )}
            {responseMessage && <p>{responseMessage}</p>}
          </>
        )}
      </div>
    </SidebarPage>
  );
}
