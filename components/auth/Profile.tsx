'use client';
import axios from 'axios';
import { deleteCookie, getCookie } from 'cookies-next';
import { ReactNode, useState } from 'react';
import useSWR from 'swr';
import { useRouter } from 'next/navigation';
import { useAuthentication } from '@/components/auth/Router';
import { DynamicFormFieldValueTypes } from '@/components/layout/dynamic-form/DynamicForm';
import { Button } from '@/components/ui/button';
import { mutate } from 'swr';
import DynamicForm from '@/components/layout/dynamic-form/DynamicForm';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';

export const Profile = ({
  isLoading,
  error,
  data,
  router,
  authConfig,
  userDataSWRKey,
  responseMessage,
  userUpdateEndpoint,
  setResponseMessage,
}: {
  isLoading: boolean;
  error: any;
  data: any;
  router: any;
  authConfig: any;
  userDataSWRKey: string;
  responseMessage: string;
  userUpdateEndpoint: string;
  setResponseMessage: (message: string) => void;
}) => {
  return (
    <div>
      <div className='mb-4'>
        <Alert>
          <AlertTitle>Early Access Software</AlertTitle>
          <AlertDescription>
            This is an early-access deployment of open-source software. You may encounter problems or &quot;bugs&quot;. If
            you do, please make note of your most recent actions and{' '}
            <Link
              className='text-info hover:underline'
              href='https://github.com/AGiXT/AGiXT-Interactive/issues/new?template=bug_report_prod.yml'
            >
              let us know by making a report here
            </Link>
            . Your understanding as we build towards the future is much appreciated.
          </AlertDescription>
        </Alert>
      </div>
      <div>
        <h3 className='text-lg font-medium'>Profile</h3>
        <p className='text-sm text-muted-foreground'>Apply basic changes to your profile</p>
      </div>
      <Separator className='my-4' />
      {isLoading ? (
        <p>Loading Current Data...</p>
      ) : error ? (
        <p>{error.message}</p>
      ) : (data.missing_requirements && Object.keys(data.missing_requirements).length === 0) ||
        !data.missing_requirements ? (
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
              Go to {authConfig.appName}
            </Button>,
          ]}
          onConfirm={async (data) => {
            const updateResponse = (
              await axios
                .put(
                  `${authConfig.authServer}${userUpdateEndpoint}`,
                  {
                    ...Object.entries(data).reduce((acc, [key, value]) => {
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
          {data.missing_requirements.some((obj) => Object.keys(obj).some((key) => key === 'verify_email')) && (
            <p className='text-xl'>Please check your email and verify it using the link provided.</p>
          )}
          {data.missing_requirements.some((obj) =>
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
              onConfirm={async (data) => {
                const updateResponse = (
                  await axios
                    .put(
                      `${authConfig.authServer}${userUpdateEndpoint}`,
                      {
                        ...data,
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
                await mutate(userDataSWRKey);
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
  );
};

export type ManageProps = {
  userDataSWRKey?: string;
  userDataEndpoint?: string;
  userUpdateEndpoint?: string;
  userPasswordChangeEndpoint?: string;
};

export default function Manage({
  userDataSWRKey = '/user',
  userDataEndpoint = '/v1/user',
  userUpdateEndpoint = '/v1/user',
}: ManageProps): ReactNode {
  const [responseMessage, setResponseMessage] = useState('');
  type User = {
    missing_requirements?: {
      [key: string]: {
        type: 'number' | 'boolean' | 'text' | 'password';
        value: DynamicFormFieldValueTypes;
        validation?: (value: DynamicFormFieldValueTypes) => boolean;
      };
    };
  };
  const router = useRouter();
  const authConfig = useAuthentication();
  const { data, error, isLoading } = useSWR<User, any, string>(userDataSWRKey, async () => {
    return (
      await axios.get(`${authConfig.authServer}${userDataEndpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: getCookie('jwt'),
        },
        validateStatus: (status) => [200, 403].includes(status),
      })
    ).data;
  });

  return (
    <div className='w-full'>
      <main className='flex min-h-[calc(100vh_-_theme(spacing.16))] flex-1 flex-col gap-4 bg-transparent p-4 md:gap-8 md:p-10'>
        <div className='flex justify-between w-full max-w-6xl gap-2 mx-auto'>
          {authConfig.manage.heading && <h2 className='text-3xl font-semibold'>{authConfig.manage.heading}</h2>}
          <Button
            key='done'
            onClick={() => {
              router.push('/chat');
            }}
          >
            Go to {authConfig.appName}
          </Button>
        </div>
        <Profile
          {...{
            isLoading,
            error,
            data,
            router,
            authConfig,
            userDataSWRKey,
            responseMessage,
            userUpdateEndpoint,
            setResponseMessage,
          }}
        />
      </main>
    </div>
  );
}
