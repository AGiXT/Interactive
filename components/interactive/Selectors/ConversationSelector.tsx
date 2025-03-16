'use client';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { setCookie } from 'cookies-next';
import React, { useContext, useEffect, useState } from 'react';
import { LuChevronDown, LuChevronUp, LuDownload, LuPlus, LuPencil, LuTrash2 } from 'react-icons/lu';
import { InteractiveConfigContext } from '../InteractiveConfigContext';

interface ConversationHistory {
  conversation_name: string;
  messages: Array<{
    message: string;
  }>;
}

interface Conversation {
  id: string;
  conversation_name: string;
  has_notifications?: boolean;
}

export default function ConversationSelector(): React.JSX.Element {
  const [dropDownOpen, setDropDownOpen] = useState(false);
  const state = useContext(InteractiveConfigContext);
  const [conversationData, setConversationData] = useState<Conversation[]>([]);
  const [currentAgentName, setCurrentAgentName] = useState<string>('');
  const [currentConversation, setCurrentConversation] = useState<ConversationHistory | null>(null);
  const [openRenameConversation, setOpenRenameConversation] = useState(false);
  const [changedConversation, setChangedConversation] = useState('-');
  const [loading, setLoading] = useState(false);
  const [openDeleteConversation, setOpenDeleteConversation] = useState(false);

  useEffect(() => {
    if (state?.overrides?.conversation) {
      setChangedConversation(state.overrides.conversation);
      setCookie('agixt-conversation', state.overrides.conversation, {
        domain: process.env.NEXT_PUBLIC_COOKIE_DOMAIN,
      });
    }
  }, [state?.overrides?.conversation]);

  useEffect(() => {
    const fetchConversations = async () => {
      if (!state?.agixt) return;
      
      try {
        // Get current agent first
        const agents = await state.agixt.getAgents();
        const currentAgent = agents.find((agent: any) => agent.default) || agents[0];
        if (currentAgent) {
          setCurrentAgentName(currentAgent.agent_name);
        } else {
          console.error('No agent found');
        }
        setLoading(true);
        const conversations = await state.agixt.getConversations(true);
        setConversationData(conversations.map(conv => ({
          id: conv.id || conv.conversation_name,
          conversation_name: conv.conversation_name
        })));

        if (state.overrides?.conversation) {
          const history = await state.agixt.getConversation(state.overrides.conversation);
          setCurrentConversation(history);
        }
      } catch (error) {
        console.error('Error fetching conversations:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchConversations();
  }, [state?.agixt, state?.overrides?.conversation]);

  const handleAddConversation = async (): Promise<void> => {
    if (!state?.mutate) return;

    state.mutate((oldState: any) => ({
      ...oldState,
      overrides: { ...oldState.overrides, conversation: '-' },
    }));
  };

  const handleRenameConversation = async (magic: boolean = true): Promise<void> => {
    if (!state?.overrides?.conversation || !state?.agixt || !currentAgentName) return;

    const response = await state.agixt.renameConversation(
      currentAgentName,
      state.overrides.conversation,
      magic ? '-' : changedConversation,
    );
    
    if (state.agixt) {
      const conversations = await state.agixt.getConversations(true);
      setConversationData(conversations.map(conv => ({
        id: conv.id || conv.conversation_name,
        conversation_name: conv.conversation_name
      })));
    }

    if (!response.startsWith('Error')) {
      setOpenRenameConversation(false);
    }
  };

  const handleDeleteConversation = async (): Promise<void> => {
    if (!state?.overrides?.conversation || !state?.agixt || !state?.mutate) return;
    
    await state.agixt.deleteConversation(state.overrides.conversation);
    const conversations = await state.agixt.getConversations(true);
    setConversationData(conversations.map(conv => ({
      id: conv.id || conv.conversation_name,
      conversation_name: conv.conversation_name
    })));

    state.mutate((oldState: any) => ({
      ...oldState,
      overrides: {
        ...oldState.overrides,
        conversation: '-',
      },
    }));
    setOpenDeleteConversation(false);
  };

  const handleExportConversation = async (): Promise<void> => {
    if (currentConversation) {
      const element = document.createElement('a');
      const file = new Blob([JSON.stringify(currentConversation)], { type: 'application/json' });
      element.href = URL.createObjectURL(file);
      element.download = `${currentConversation.conversation_name}.json`;
      document.body.appendChild(element);
      element.click();
    }
  };

  return (
    <div className='flex items-center flex-grow w-full'>
      <div className='relative w-full'>
        <Select
          open={dropDownOpen}
          onOpenChange={setDropDownOpen}
          disabled={loading || !conversationData || conversationData.length === 0}
          value={changedConversation}
          onValueChange={(value) =>
            state?.mutate?.((oldState: any) => ({
              ...oldState,
              overrides: { ...oldState.overrides, conversation: value },
            }))
          }
        >
          <SelectTrigger className=''>
            <SelectValue placeholder='Select a Conversation' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='-'>- New Conversation -</SelectItem>
            {conversationData &&
              conversationData.map((conversation) => (
                <SelectItem key={conversation.id} value={conversation.conversation_name}>
                  {conversation.has_notifications && '(-) '}
                  {conversation.conversation_name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <div className='absolute top-0 bottom-0 right-0 flex items-center h-full pr-2 space-x-1'>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant='ghost' size='icon' className='w-6 h-6' onClick={handleAddConversation}>
                  <LuPlus />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Add Conversation</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant='ghost' size='icon' className='w-6 h-6' onClick={() => setOpenRenameConversation(true)}>
                  <LuPencil />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Rename Conversation</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant='ghost' size='icon' className='w-6 h-6' onClick={handleExportConversation}>
                  <LuDownload />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Export Conversation</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant='ghost' size='icon' className='w-6 h-6' onClick={() => setOpenDeleteConversation(true)}>
                  <LuTrash2 />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Delete Conversation</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant='ghost' size='icon' className='w-6 h-6' onClick={() => setDropDownOpen((prev) => !prev)}>
                  {dropDownOpen ? <LuChevronUp /> : <LuChevronDown />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Open Dropdown</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      <Dialog open={openDeleteConversation} onOpenChange={setOpenDeleteConversation}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Conversation</DialogTitle>
            <DialogDescription>Are you sure you want to delete this conversation?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant='outline' onClick={() => setOpenDeleteConversation(false)}>
              Cancel
            </Button>
            <Button onClick={handleDeleteConversation}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openRenameConversation} onOpenChange={setOpenRenameConversation}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Conversation</DialogTitle>
          </DialogHeader>
          <Input
            id='name'
            value={changedConversation}
            onChange={(e) => setChangedConversation(e.target.value)}
            placeholder='New Conversation Name'
          />
          <DialogFooter>
            <Button variant='outline' onClick={() => setOpenRenameConversation(false)}>
              Cancel
            </Button>
            <Button onClick={() => handleRenameConversation(false)}>Rename</Button>
            <Button onClick={() => handleRenameConversation(true)}>Generate a Name</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
