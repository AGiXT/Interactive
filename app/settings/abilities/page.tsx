'use client';

import axios from 'axios';
import { getCookie, setCookie } from 'cookies-next';
import { useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useMediaQuery } from 'react-responsive';
import { useAgent } from '@/components/interactive/useAgent';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import MarkdownBlock from '@/components/conversation/Message/MarkdownBlock';
import { useCompany } from '@/components/interactive/useUser';
import { Input } from '@/components/ui/input';
import { SidebarPage } from '@/components/layout/SidebarPage';

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

export default function Abilities() {
  // Responsive media queries
  const isSmallScreen = useMediaQuery({ maxWidth: 640 });
  const isMediumScreen = useMediaQuery({ maxWidth: 768 });
  const isLargeScreen = useMediaQuery({ minWidth: 1024 });
  
  // Get responsive text sizes based on screen size
  const getTitleSize = () => {
    if (isSmallScreen) return 'text-base';
    if (isMediumScreen) return 'text-md';
    return 'text-lg';
  };
  
  const getHeadingSize = () => {
    if (isSmallScreen) return 'text-sm';
    if (isMediumScreen) return 'text-base';
    return 'text-lg';
  };
  
  const getDescriptionSize = () => {
    if (isSmallScreen) return 'text-xs';
    return 'text-sm';
  };
  
  // Get responsive grid based on screen size
  const getGridCols = () => {
    if (isSmallScreen) return 'grid-cols-1';
    if (isMediumScreen) return 'grid-cols-1';
    if (isLargeScreen) return 'grid-cols-2';
    return 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-3';
  };

  const { data: agentData, mutate: mutateAgent } = useAgent();
  const [searchText, setSearchText] = useState('');
  const [error, setError] = useState<ErrorState>(null);
  const [showEnabledOnly, setShowEnabledOnly] = useState(false);
  const agent_name = getCookie('agixt-agent') || process.env.NEXT_PUBLIC_AGIXT_AGENT;
  const { data: activeCompany, mutate: mutateCompany } = useCompany();
  const searchParams = useSearchParams();

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

  const handleToggleCommand = async (commandName: string, enabled: boolean) => {
    try {
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

      if (result.status === 200) {
        if (searchParams.get('mode') === 'company') {
          mutateCompany();
        } else {
          mutateAgent();
        }
      }
    } catch (error) {
      console.error('Failed to toggle command:', error);
      setError({
        type: 'error',
        message: 'Failed to toggle command. Please try again.',
      });
    }
  };

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
      <div className='space-y-4 md:space-y-6'>
        <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2 sm:mb-4 gap-2'>
          <h3 className={`${getTitleSize()} font-medium`}>Enabled Abilities</h3>
          <div className='flex items-center gap-2'>
            <Label htmlFor='show-enabled-only' className={getDescriptionSize()}>Show Enabled Only</Label>
            <Switch id='show-enabled-only' checked={showEnabledOnly} onCheckedChange={setShowEnabledOnly} />
          </div>
        </div>

        <div className='space-y-4'>
          <Input 
            placeholder='Search...' 
            value={searchText} 
            onChange={(e) => setSearchText(e.target.value)}
            className='w-full'
          />

          {/* AGiXT Core Features Card - Only show if not in company mode and matches filters */}
          {searchParams.get('mode') !== 'company' && filteredOverrides.length > 0 && (
            <Card>
              <CardHeader className='p-3 sm:p-4 md:p-6'>
                <CardTitle className={getTitleSize()}>Agent Capabilities</CardTitle>
                <CardDescription className={getDescriptionSize()}>Core features and capabilities</CardDescription>
              </CardHeader>
              <CardContent className='space-y-3 sm:space-y-4 p-3 sm:p-4 md:p-6'>
                <div className={`grid ${getGridCols()} gap-3 sm:gap-4`}>
                  {filteredOverrides.map(([key, extension]) => (
                    <Card key={key} className='p-2 sm:p-4 border border-border/50'>
                      <div className='flex items-center mb-1 sm:mb-2'>
                        <Switch checked={overrideStates[key] || false} onCheckedChange={() => handleToggleOverride(key)} />
                        <div className='flex items-center ml-2'>
                          <h4 className={`${getHeadingSize()} font-medium`}>{extension.label}</h4>
                        </div>
                      </div>
                      <div className={`${getDescriptionSize()} break-words`}>
                        <MarkdownBlock content={extension.description} />
                      </div>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Standard Extensions */}
          {extensionsWithCommands.length === 0 && filteredOverrides.length === 0 ? (
            <Alert>
              <AlertDescription className={getDescriptionSize()}>
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
                    <CardHeader className='p-3 sm:p-4 md:p-6'>
                      <CardTitle className={getTitleSize()}>{extension.extension_name}</CardTitle>
                      <CardDescription className={getDescriptionSize()}>
                        <MarkdownBlock content={extension.description || 'No description available'} />
                      </CardDescription>
                    </CardHeader>
                    <CardContent className='space-y-3 sm:space-y-4 p-3 sm:p-4 md:p-6'>
                      <div className={`grid ${getGridCols()} gap-3 sm:gap-4`}>
                        {filteredCommands.map((command) => (
                          <Card key={command.command_name} className='p-2 sm:p-4 border border-border/50 overflow-hidden'>
                            <div className='flex items-center mb-1 sm:mb-2'>
                              <Switch
                                checked={command.enabled}
                                onCheckedChange={(checked) => handleToggleCommand(command.friendly_name, checked)}
                              />
                              <h4 className={`${getHeadingSize()} font-medium ml-2`}>{command.friendly_name}</h4>
                            </div>
                            <div className={`${getDescriptionSize()} break-words`}>
                              <MarkdownBlock 
                                content={command.description?.split('\nArgs')[0] || 'No description available'} 
                              />
                            </div>
                          </Card>
                        ))}
                      </div>
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