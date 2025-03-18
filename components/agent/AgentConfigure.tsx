'use client';

import { useInteractiveConfig } from '@/components/idiot/interactive/InteractiveConfigContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useEffect, useState } from 'react';
import { useAgent } from '@/components/idiot/interactive/hooks/useAgent';
import { useProvider } from '@/components/idiot/interactive/hooks/useProvider';
import { Switch } from '@/components/ui/switch';

interface ExtendedSettings {
  tts?: boolean;
  create_image?: boolean;
  websearch?: boolean;
  websearch_depth?: number;
  analyze_user_input?: boolean;
  provider?: string;
}

type AgentSettings = ExtendedSettings & Record<string, any>;

export default function AgentConfigure() {
  const context = useInteractiveConfig();
  const { data: agentData, mutate } = useAgent(false);
  const { data: providerData } = useProvider(agentData?.settings?.provider || 'default');

  const [provider, setProvider] = useState(agentData?.agent?.settings?.find(s => s.name === 'provider')?.value || '');
  const [agentState, setAgentState] = useState<AgentSettings>(
    (agentData?.agent?.settings || []).reduce((acc, setting) => ({
      ...acc,
      [setting.name]: setting.value
    }), {
      provider: '',
    })
  );

  useEffect(() => {
    if (agentData) {
      const settings = agentData.agent?.settings || [];
      setProvider(settings.find(s => s.name === 'provider')?.value || '');
      setAgentState(settings.reduce((acc, setting) => ({
        ...acc,
        [setting.name]: setting.value
      }), {}));
    }
  }, [agentData]);

  const handleConfigure = async () => {
    const agentName = agentData?.agent?.name;
    if (!agentName) return;
    
    await context.agixt.updateAgentSettings(agentName, {
      provider: provider,
      ...agentState,
    });
    mutate();
  };

  const handleToggleExtension = async (key: string, value: boolean, additionalSettings = {}) => {
    const newSettings = {
      ...agentState,
      [key]: value,
      ...additionalSettings,
    };
    const agentName = agentData?.agent?.name;
    if (!agentName) return;
    await context.agixt.updateAgentSettings(agentName, {
      provider: provider,
      ...newSettings,
    });
    mutate();
  };

  const renderFields = (dictionary: Record<string, any>) => {
    return (
      dictionary &&
      Object.entries(dictionary).map(([key, value]) => (
        <div key={key} className='mb-4'>
          <Label htmlFor={key}>{key}</Label>
          <Input
            id={key}
            value={value as string}
            onChange={(e) => setAgentState({ ...agentState, [key]: e.target.value })}
          />
        </div>
      ))
    );
  };

  const renderFieldsNested = (dictionary: Record<string, Record<string, any>>) => {
    return (
      dictionary &&
      Object.entries(dictionary).map(([key, value]) => (
        <Card key={key} className='mb-4'>
          <CardContent>
            <h3 className='text-lg font-semibold mb-2'>{key}</h3>
            {renderFields(value)}
          </CardContent>
        </Card>
      ))
    );
  };

  if (!agentData) return <div>Loading...</div>;

  return (
    <div className='space-y-6'>
      <div>
        <h2 className='text-xl font-semibold mb-4'>Quick Settings</h2>
        <Card className='mb-4'>
          <CardContent className='space-y-4 pt-4'>
            <div className='flex items-center justify-between'>
              <div>
                <Label className='text-base'>Text to Speech</Label>
                <p className='text-sm text-muted-foreground'>Convert text responses to spoken audio output</p>
              </div>
              <Switch
                checked={agentState.tts === true}
                onCheckedChange={(checked) => handleToggleExtension('tts', checked)}
              />
            </div>

            <div className='flex items-center justify-between'>
              <div>
                <Label className='text-base'>Image Generation</Label>
                <p className='text-sm text-muted-foreground'>Create AI-generated images from text descriptions</p>
              </div>
              <Switch
                checked={agentState.create_image === true}
                onCheckedChange={(checked) => handleToggleExtension('create_image', checked)}
              />
            </div>

            <div className='flex items-center justify-between'>
              <div>
                <Label className='text-base'>Web Search</Label>
                <p className='text-sm text-muted-foreground'>Search and reference current web content</p>
              </div>
              <Switch
                checked={agentState.websearch === true}
                onCheckedChange={(checked) => 
                  handleToggleExtension('websearch', checked, {
                    websearch_depth: checked ? (agentState.websearch_depth || 2) : undefined
                  })
                }
              />
            </div>

            <div className='flex items-center justify-between'>
              <div>
                <Label className='text-base'>File Analysis</Label>
                <p className='text-sm text-muted-foreground'>Analyze uploaded files and documents for insights</p>
              </div>
              <Switch
                checked={agentState.analyze_user_input === true}
                onCheckedChange={(checked) => handleToggleExtension('analyze_user_input', checked)}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className='grid grid-cols-2 gap-4'>
        {renderFields(agentState)}
      </div>

      <div>
        <h2 className='text-xl font-semibold mb-2'>Provider Settings</h2>
        <div className='grid grid-cols-2 gap-4'>
          {renderFields({
            provider,
            ...(providerData || {})
          })}
        </div>
      </div>

      <div>
        <h2 className='text-xl font-semibold mb-2'>Extension Settings</h2>
        {renderFieldsNested({})}
      </div>

      <Button onClick={handleConfigure}>Save Agent Configuration</Button>
    </div>
  );
}
