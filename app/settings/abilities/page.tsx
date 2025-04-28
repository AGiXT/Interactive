'use client';

import axios from 'axios';
import { getCookie, setCookie } from 'cookies-next';
import { useSearchParams } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import { useAgent } from '@/components/interactive/useAgent';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import MarkdownBlock from '@/components/conversation/Message/MarkdownBlock';
import { useCompany } from '@/components/interactive/useUser';
import { Input } from '@/components/ui/input';
import { SidebarPage } from '@/components/layout/SidebarPage';
import { useToast } from '@/components/layout/toast';

// Define override extensions (moved from Extension.jsx)
const OVERRIDE_EXTENSIONS = {
  'text-to-speech': {
    name: 'tts',
    label: 'Text to Speech',
    description: 'Convert text responses to spoken audio output with each response.',
  },
  'web-search': {
    name: 'websearch',
    label: 'Web Search',
    description: 'Search and reference current web content with each request.',
  },
  'image-generation': {
    name: 'create-image',
    label: 'Image Generation',
    description: 'Enable the assistant to generate images based on user prompts.',
  },
  analysis: {
    name: 'analyze-user-input',
    label: 'Data Analysis',
    description:
      'Analyze uploaded files, documents, available data, and user input to solve math problems, create graphs, and create and run code to analyze data.',
  },
};

type ErrorState = {
  type: 'success' | 'error';
  message: string;
} | null;

type Command = {
  command_name: string;
  extension_name: string;
  friendly_name: string;
  description?: string;
  enabled: boolean;
};

export default function Abilities() {
  const { data: agentData, mutate: mutateAgent } = useAgent();
  const [searchText, setSearchText] = useState('');
  const [error, setError] = useState<ErrorState>(null);
  const [showEnabledOnly, setShowEnabledOnly] = useState(false);
  const agent_name = getCookie('agixt-agent') || process.env.NEXT_PUBLIC_AGIXT_AGENT;
  const { data: activeCompany, mutate: mutateCompany } = useCompany();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  // Track loading commands and their original states
  const [commandStates, setCommandStates] = useState<
    Record<
      string,
      {
        loading: boolean;
        originalState: boolean;
        currentState: boolean;
      }
    >
  >({});

  // State for override extensions
  const [overrideStates, setOverrideStates] = useState<Record<string, boolean>>({});

  // Initialize override extension states
  useEffect(() => {
    const states = Object.entries(OVERRIDE_EXTENSIONS).reduce(
      (acc, [key, value]) => {
        acc[key] = getCookie(`agixt-${value.name}`) === 'true';
        return acc;
      },
      {} as Record<string, boolean>,
    );

    setOverrideStates(states);
  }, []);

  // Filter extensions for the enabled commands view
  const extensions = searchParams.get('mode') === 'company' ? activeCompany?.extensions || [] : agentData?.extensions || [];
  const extensionsWithCommands = extensions.filter((ext) => ext.commands?.length > 0);

  // Add a function to ensure consistent behavior between single and batch operations
  const delayedMutation = async () => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    if (searchParams.get('mode') === 'company') {
      await mutateCompany();
    } else {
      await mutateAgent();
    }
  };

  // Handle toggle function for individual commands
  const handleToggleCommand = useCallback(
    async (commandName: string, enabled: boolean) => {
      // Store the original state before attempting to change
      const originalState = commandStates[commandName]?.currentState ?? false;

      // Immediately update command state with loading and optimistic state
      setCommandStates((prev) => ({
        ...prev,
        [commandName]: {
          loading: true,
          originalState: originalState,
          currentState: enabled,
        },
      }));

      try {
        // Make the actual API call
        const result = await axios.patch(
          searchParams.get('mode') === 'company'
            ? `${process.env.NEXT_PUBLIC_AGIXT_SERVER}/v1/companies/${activeCompany?.id}/command`
            : `${process.env.NEXT_PUBLIC_AGIXT_SERVER}/api/agent/${agent_name}/command`,
          {
            command_name: commandName,
            enable: enabled,
          },
          {
            headers: {
              Authorization: getCookie('jwt'),
            },
          },
        );

        // Handle success
        if (result.status === 200) {
          // Show success toast
          toast({
            title: 'Command updated',
            description: `${commandName} was ${enabled ? 'enabled' : 'disabled'} successfully.`,
          });

          // Update final state on success
          setCommandStates((prev) => ({
            ...prev,
            [commandName]: {
              loading: false,
              originalState: enabled,
              currentState: enabled,
            },
          }));

          // Use the consistent delay function for mutation
          delayedMutation().catch(console.error);
        } else {
          throw new Error('API request failed');
        }
      } catch (error) {
        console.error('Failed to toggle command:', error);

        // Show error toast
        toast({
          title: 'Error updating command',
          description: `Failed to ${enabled ? 'enable' : 'disable'} ${commandName}.`,
          variant: 'destructive',
        });

        // Revert to original state on failure
        setCommandStates((prev) => ({
          ...prev,
          [commandName]: {
            loading: false,
            originalState: originalState,
            currentState: originalState,
          },
        }));
      }
    },
    [agent_name, activeCompany, mutateAgent, mutateCompany, searchParams, toast, delayedMutation, commandStates],
  );

  // Create a version of the toggle handler that prevents concurrent toggles
  const safeToggleCommand = useCallback(
    (commandName: string, enabled: boolean) => {
      // If the command is already loading, don't trigger another toggle
      if (commandStates[commandName]?.loading) return;

      // Handle the toggle
      handleToggleCommand(commandName, enabled);
    },
    [handleToggleCommand, commandStates],
  );

  // Handle override extension toggle
  const handleToggleOverride = (extensionKey: string) => {
    const extension = OVERRIDE_EXTENSIONS[extensionKey];
    const newState = !overrideStates[extensionKey];

    setCookie(`agixt-${extension.name}`, newState.toString(), {
      domain: process.env.NEXT_PUBLIC_COOKIE_DOMAIN,
    });

    setOverrideStates((prev) => ({
      ...prev,
      [extensionKey]: newState,
    }));
  };

  // Check if an override extension matches the search text
  const overrideMatchesSearch = (key: string, extension: (typeof OVERRIDE_EXTENSIONS)[keyof typeof OVERRIDE_EXTENSIONS]) => {
    return (
      !searchText ||
      key.toLowerCase().includes(searchText.toLowerCase()) ||
      extension.label.toLowerCase().includes(searchText.toLowerCase()) ||
      extension.description.toLowerCase().includes(searchText.toLowerCase())
    );
  };

  // Filter overrides based on search and showEnabledOnly
  const filteredOverrides = Object.entries(OVERRIDE_EXTENSIONS)
    .filter(([key, extension]) => overrideMatchesSearch(key, extension))
    .filter(([key]) => !showEnabledOnly || overrideStates[key]);

  return (
    <SidebarPage title='Abilities'>
      <div className='space-y-6'>
        {error && (
          <Alert variant={error.type === 'error' ? 'destructive' : 'default'}>
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        )}

        <div className='flex items-center justify-between mb-4'>
          <h3 className='text-lg font-medium'>Enabled Abilities</h3>
          <div className='flex items-center gap-2'>
            <Label htmlFor='show-enabled-only'>Show Enabled Only</Label>
            <Switch id='show-enabled-only' checked={showEnabledOnly} onCheckedChange={setShowEnabledOnly} />
          </div>
        </div>

        <div className='grid gap-4'>
          <Input placeholder='Search...' value={searchText} onChange={(e) => setSearchText(e.target.value)} />

          {/* Standard Extensions */}
          {extensionsWithCommands.length === 0 && filteredOverrides.length === 0 ? (
            <Alert>
              <AlertDescription>
                No extensions are currently enabled. Enable extensions to see their abilities here.
              </AlertDescription>
            </Alert>
          ) : (
            extensionsWithCommands
              .sort((a, b) => a.extension_name.localeCompare(b.extension_name))
              .map((extension) => {
                const filteredCommands = extension.commands
                  .filter((command) =>
                    [command.command_name, command.extension_name, command.friendly_name, command.description].some(
                      (value) => value?.toLowerCase().includes(searchText.toLowerCase()),
                    ),
                  )
                  .filter((command) => !showEnabledOnly || command.enabled);

                if (filteredCommands.length === 0) return null;

                return (
                  <Card key={extension.extension_name}>
                    <CardHeader>
                      <CardTitle>{extension.extension_name}</CardTitle>
                      <CardDescription>
                        <MarkdownBlock content={extension.description || 'No description available'} />
                      </CardDescription>
                    </CardHeader>
                    <CardContent className='space-y-4'>
                      {filteredCommands.map((command) => {
                        // Determine the current state, prioritizing the command state tracking
                        const commandState = commandStates[command.friendly_name];
                        const isChecked = commandState ? commandState.currentState : command.enabled;
                        const isLoading = commandState?.loading ?? false;

                        return (
                          <Card key={command.command_name} className='p-4 border border-border/50'>
                            <div className='flex items-center mb-2'>
                              <Switch
                                checked={isChecked}
                                onCheckedChange={(checked) => safeToggleCommand(command.friendly_name, checked)}
                                disabled={isLoading}
                              />
                              <div className='flex items-center'>
                                <h4 className='text-lg font-medium ml-2'>{command.friendly_name}</h4>
                                {isLoading && (
                                  <div className='ml-2 h-5 w-5 animate-spin rounded-full border-4 border-blue-500 border-t-transparent'></div>
                                )}
                              </div>
                            </div>
                            <MarkdownBlock content={command.description?.split('\nArgs')[0] || 'No description available'} />
                          </Card>
                        );
                      })}
                    </CardContent>
                  </Card>
                );
              })
              .filter(Boolean)
          )}
        </div>
      </div>
    </SidebarPage>
  );
}
