'use client';

import axios from 'axios';
import { getCookie } from 'cookies-next';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useAgent } from '../hooks/useAgent';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import MarkdownBlock from '@/components/interactive/Chat/Message/MarkdownBlock';
import { useCompany } from '@/components/idiot/auth/hooks/useUser';
import { Input } from '@/components/ui/input';

// Types remain the same
type Command = {
  friendly_name: string;
  description: string;
  command_name: string;
  command_args: Record<string, string>;
  enabled?: boolean;
  extension_name?: string;
};

type ErrorState = {
  type: 'success' | 'error';
  message: string;
} | null;

export function Abilities() {
  const { data: agentData, mutate: mutateAgent } = useAgent();
  const [searchText, setSearchText] = useState('');
  const [error, setError] = useState<ErrorState>(null);
  const [showEnabledOnly, setShowEnabledOnly] = useState(false);
  const agent_name = getCookie('agixt-agent') || process.env.NEXT_PUBLIC_AGIXT_AGENT;
  const { data: activeCompany, mutate: mutateCompany } = useCompany();
  const searchParams = useSearchParams();
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

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between mb-4'>
        <h3 className='text-lg font-medium'>Enabled Abilities</h3>
        <div className='flex items-center gap-2'>
          <Label htmlFor='show-enabled-only'>Show Enabled Only</Label>
          <Switch id='show-enabled-only' checked={showEnabledOnly} onCheckedChange={setShowEnabledOnly} />
        </div>
      </div>

      {extensionsWithCommands.length === 0 ? (
        <Alert>
          <AlertDescription>
            No extensions are currently enabled. Enable extensions to see their abilities here.
          </AlertDescription>
        </Alert>
      ) : (
        <div className='grid gap-4'>
          <Input placeholder='Search...' value={searchText} onChange={(e) => setSearchText(e.target.value)} />
          {extensionsWithCommands
            .sort((a, b) => a.extension_name.localeCompare(b.extension_name))
            .map((extension) => (
              <Card key={extension.extension_name}>
                <CardHeader>
                  <CardTitle>{extension.extension_name}</CardTitle>
                  <CardDescription>
                    <MarkdownBlock content={extension.description || 'No description available'} />
                  </CardDescription>
                </CardHeader>
                <CardContent className='space-y-4'>
                  {extension.commands
                    .filter((command) =>
                      [command.command_name, command.extension_name, command.friendly_name, command.description].some(
                        (value) => value?.toLowerCase().includes(searchText.toLowerCase()),
                      ),
                    )
                    .filter((command) => !showEnabledOnly || command.enabled)
                    .map((command) => (
                      <Card key={command.command_name} className='p-4 border border-border/50'>
                        <div className='flex items-center mb-2'>
                          <Switch
                            checked={command.enabled}
                            onCheckedChange={(checked) => handleToggleCommand(command.friendly_name, checked)}
                          />
                          <h4 className='text-lg font-medium'>&nbsp;&nbsp;{command.friendly_name}</h4>
                        </div>
                        <MarkdownBlock content={command.description?.split('\nArgs')[0] || 'No description available'} />
                      </Card>
                    ))}
                </CardContent>
              </Card>
            ))}
        </div>
      )}
    </div>
  );
}

export default Abilities;
