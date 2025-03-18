'use client';

import axios from 'axios';
import { getCookie } from 'cookies-next';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useAgent } from '@/components/idiot/interactive/hooks/useAgent';
import Extension from '@/components/agent/extension';
import { ConnectedServices } from '@/components/agent/ConnectedServices';
import { useCompany } from '@/components/idiot/useUser';

// Types remain the same
type Command = {
  friendly_name: string;
  description: string;
  command_name: string;
  command_args: Record<string, string>;
  enabled?: boolean;
  extension_name?: string;
};

type Extension = {
  extension_name: string;
  description: string;
  settings: string[];
  commands: Command[];
};

type ErrorState = {
  type: 'success' | 'error';
  message: string;
} | null;

interface ExtensionSettings {
  agent_name: string;
  settings: Record<string, string>;
}

export function Extensions() {
  // Add type for agent data
  interface AgentData {
    agent: {
      settings: { value: string; name: string; }[];
      status: boolean | null;
      companyId: string;
      default: boolean;
      id: string;
      name: string;
    } | null;
    commands: string[];
    extensions?: Extension[];
  }
  
  const { data: agentData, mutate: mutateAgent } = useAgent<AgentData>();
  const [searchText, setSearchText] = useState('');
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [error, setError] = useState<ErrorState>(null);
  const agent_name = getCookie('agixt-agent') || process.env.NEXT_PUBLIC_AGIXT_AGENT;
  const { data: activeCompany, mutate: mutateCompany } = useCompany();

  const searchParams = useSearchParams();
  // Get connected third-party extensions
  const extensions: Extension[] = searchParams.get('mode') === 'company' ? [] : (agentData?.extensions || []);

  // Categorize extensions for the available tab
  const categorizeExtensions = (exts: Extension[]) => {
    return {
      // Connected extensions are those with settings and at least one command
      connectedExtensions: filterExtensions(
        exts.filter((ext) => ext.settings?.length > 0 && ext.commands?.length > 0),
        searchText,
      ),
      // Available extensions are those with settings that aren't connected yet
      availableExtensions: filterExtensions(
        exts.filter((ext) => ext.settings?.length > 0 && !ext.commands?.length),
        searchText,
      ),
    };
  };

  const handleSaveSettings = async (extensionName: string, settings: Record<string, string>) => {
    try {
      setError(null);
      const response = await axios.put<{ status: number; data: any }>(
        `${process.env.NEXT_PUBLIC_AGIXT_SERVER}/api/agent/${agent_name}`,
        {
          agent_name: agent_name,
          settings: settings,
        } as ExtensionSettings,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: getCookie('jwt'),
          },
        },
      );

      if (response.status === 200) {
        setError({
          type: 'success',
          message: 'Extension connected successfully!',
        });
        window.location.reload();
      }
    } catch (error: any) {
      setError({
        type: 'error',
        message: error.response?.data?.detail || error.message || 'Failed to connect extension',
      });
    }
  };

  const handleDisconnect = async (extension: Extension) => {
    const emptySettings = extension.settings.reduce((acc, setting) => ({ ...acc, [setting]: '' }), {});
    await handleSaveSettings(extension.extension_name, emptySettings);
  };

  function filterExtensions(extensions: Extension[], text: string): Extension[] {
    return !text
      ? extensions
      : extensions.filter(
          (ext: Extension) =>
            ext.extension_name.toLowerCase().includes(text?.toLowerCase()) ||
            ext.description.toLowerCase().includes(text.toLowerCase()),
        );
  }

  const { connectedExtensions, availableExtensions } = categorizeExtensions(extensions);
  return (
    <div className='space-y-6'>
      <div className='grid gap-4'>
        <p className='text-sm text-muted-foreground'>
          Manage your connected third-party extensions that grant your agent additional capabilities through abilities.
        </p>
        {searchParams.get('mode') !== 'company' && <ConnectedServices />}
        {connectedExtensions.map((extension) => (
          <Extension
            key={extension.extension_name}
            extension={extension}
            connected
            onDisconnect={handleDisconnect}
            settings={settings}
            onConnect={handleSaveSettings}
            setSettings={setSettings}
            error={error}
          />
        ))}

        {availableExtensions.map((extension) => (
          <Extension
            key={extension.extension_name}
            extension={extension}
            onDisconnect={handleDisconnect}
            connected={false}
            onConnect={handleSaveSettings}
            settings={settings}
            setSettings={setSettings}
            error={error}
          />
        ))}
      </div>
    </div>
  );
}

export default Extensions;
