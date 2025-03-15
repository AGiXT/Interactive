'use client';
import { Context, createContext, useContext } from 'react';
import AGiXTSDK from '@/lib/sdk';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ConfigDefault = {
  agixt: null,
  overrides: {
    mode: 'prompt',
    prompt: 'Think About It',
    promptCategory: 'Default',
    command: '',
    commandArgs: {},
    commandMessageArg: 'message',
    chain: '',
    chainRunConfig: {
      chainArgs: {},
      singleStep: false,
      fromStep: 0,
      allResponses: false,
    },
    contextResults: 0,
    shots: 0,
    websearchDepth: 0,
    injectMemoriesFromCollectionNumber: 0,
    conversationResults: 5,
    conversation: '-',
    conversationID: '',
    browseLinks: false,
    webSearch: false,
    insightAgentName: '',
    enableMemory: false,
  },
  mutate: null,
};

export type ChainConfig = {
  chainArgs: object;
  singleStep: boolean;
  fromStep: number;
  allResponses: boolean;
};
export type Overrides = {
  mode?: 'prompt' | 'chain' | 'command';
  prompt?: string;
  promptCategory?: string;
  command?: string;
  commandArgs?: object;
  commandMessageArg?: string;
  chain?: string;
  chainRunConfig?: ChainConfig;
  contextResults?: number;
  shots?: number;
  websearchDepth?: number;
  injectMemoriesFromCollectionNumber?: number;
  conversationResults?: number;
  conversation?: string;
  conversationID?: string;
  browseLinks?: boolean;
  webSearch?: boolean;
  insightAgentName?: string;
  enableMemory?: boolean;
};
export type InteractiveConfig = {
  agixt: AGiXTSDK;
  overrides?: Overrides;
  mutate?: (InteractiveConfig: any) => void | ((previous: InteractiveConfig) => InteractiveConfig);
};
export const InteractiveConfigContext: Context<InteractiveConfig> = createContext<InteractiveConfig>(
  ConfigDefault as unknown as InteractiveConfig,
);
export const InteractiveConfigDefault = ConfigDefault;

export const useInteractiveConfig = (): InteractiveConfig => {
  const context = useContext(InteractiveConfigContext);

  if (context === undefined) {
    throw new Error('No InteractiveConfigContext found');
  }

  return context;
};
