'use client';
import React, { useState, ReactNode, useEffect } from 'react';
import {
  InteractiveConfigContext,
  InteractiveConfigDefault,
  InteractiveConfig,
} from '@/components/interactive/InteractiveConfigContext';
import AGiXTSDK from '@/lib/sdk';

export default function InteractiveConfigContextWrapper({
  initialState = InteractiveConfigDefault,
  children,
}: {
  requireKey?: boolean;
  initialState?: InteractiveConfig;
  children: ReactNode;
}): React.JSX.Element {
  const agixt: AGiXTSDK = new AGiXTSDK();
  // Used to determine whether to render the app or not (populates with any fetch errors from tryFetch calls).
  const [InteractiveConfigState, setInteractiveConfigState] = useState<InteractiveConfig>({
    // Default state and initializes the SDK
    ...InteractiveConfigDefault,
    ...initialState,
    // Overridden in context provider.
    agixt: agixt,
    mutate: null,
  } as InteractiveConfig);
  return (
    <InteractiveConfigContext.Provider
      value={{ ...InteractiveConfigState, agixt: agixt, mutate: setInteractiveConfigState }}
    >
      {children}
    </InteractiveConfigContext.Provider>
  );
}
