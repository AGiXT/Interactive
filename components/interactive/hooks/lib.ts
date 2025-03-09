import { getCookie } from 'cookies-next';
import { GraphQLClient } from 'graphql-request';

export const createGraphQLClient = (): GraphQLClient =>
  new GraphQLClient(`${process.env.NEXT_PUBLIC_AGIXT_SERVER}/graphql`, {
    headers: { authorization: getCookie('jwt') || '' },
  });

export const chainMutations = (parentHook: any, originalMutate: () => Promise<any>) => {
  return async () => {
    await parentHook.mutate();
    return originalMutate();
  };
};
