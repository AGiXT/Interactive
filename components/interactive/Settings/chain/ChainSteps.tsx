'use client';

import { useInteractiveConfig } from '@/components/interactive/InteractiveConfigContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PlusCircle as LuPlusCircle } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useChain } from '@/components/interactive/hooks/useChain';
import ChainStep from '@/components/interactive/Settings/chain/ChainStep';

export default function ChainSteps() {
  const searchParams = useSearchParams();
  const context = useInteractiveConfig();
  const { data: chainData, mutate, error } = useChain(searchParams.get('chain') ?? undefined);

  const handleAdd = async () => {
    if (!chainData) return;
    const lastStep = chainData.steps.length === 0 ? undefined : chainData.steps[chainData.steps.length - 1];
    await context.agixt.addStep(
      chainData.chainName,
      chainData.steps.length + 1,
      lastStep ? lastStep.agentName : context.agent,
      lastStep ? lastStep.promptType : 'Prompt',
      lastStep
        ? lastStep.prompt
        : {
            prompt_name: '',
            prompt_category: 'Default',
          },
    );
    mutate();
  };

  return (
    <div className='space-y-4'>
      {chainData?.steps &&
        chainData.steps.map((step, index) => (
          <Card key={index}>
            <CardContent>
              <ChainStep
                {...step}
                agent_name={step.agentName}
                step_type={step.prompt.chainName ? 'Chain' : step.prompt.commandName ? 'Command' : 'Prompt'}
                step_object={step.prompt}
                last_step={chainData.steps.length === index + 1}
              />
            </CardContent>
          </Card>
        ))}
      <div className='flex items-center'>
        <Button onClick={handleAdd} variant='outline' className='flex items-center'>
          <LuPlusCircle className='mr-2 h-4 w-4' />
          Add Step
        </Button>
      </div>
    </div>
  );
}
