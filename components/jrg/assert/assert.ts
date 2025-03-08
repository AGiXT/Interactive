import { useEffect } from 'react';

export default function assert(test: boolean, message?: string | undefined) {
  if (!test) throw new Error('Assertion Failure: ' + (message ?? 'No message provided.'));
}

export function useAssertion(uri: string, message: string, dependencies: any[]) {
  let assertion = false;
  try {
    new URL(uri);
    assertion = true;
  } catch {
    assertion = false;
  }
  useEffect(() => {
    assert(assertion, message);
  }, [assertion, message, dependencies]);
}
