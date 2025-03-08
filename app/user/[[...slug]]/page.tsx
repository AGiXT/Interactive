import AuthRouter from '@/components/idiot/auth/Router';

export default function UserRouter(props: any) {
  return (
    <AuthRouter
      {...props}
      corePagesConfig={{
        register: {
          props: {
            additionalFields: ['first_name', 'last_name'],
          },
        },
      }}
    />
  );
}
