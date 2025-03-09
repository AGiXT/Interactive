import { useEffect } from 'react';

export function useAssertion(uri: string, message: string, dependencies: any[]) {
  let assertion = false;
  try {
    new URL(uri);
    assertion = true;
  } catch {
    assertion = false;
  }
  useEffect(() => {
    if (!assertion) throw new Error('Assertion Failure: ' + (message ?? 'No message provided.'));
  }, [assertion, message, dependencies]);
}
