'use client';

import { useInteractiveConfig } from '@/components/interactive/InteractiveConfigContext';
import { useEffect, useState, useCallback, useRef } from 'react';
import { SidebarInset } from '@/components/ui/sidebar';
import React from 'react';
import { Overrides } from '@/components/interactive/InteractiveConfigContext';
import { useConversations } from '@/components/interactive/useConversation';
import { useRouter } from 'next/navigation';
import { toast } from '@/components/layout/toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Chat } from '@/components/conversation/conversation';
import {
  Edit,
  Download,
  Trash,
  ChevronDown,
  Copy,
  Check,
  Plus,
  Loader2,
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { mutate } from 'swr';
import { getCookie } from 'cookies-next';

export type FormProps = {
  fieldOverrides?: { [key: string]: React.ReactNode };
  formContext?: object;
  additionalFields?: { [key: string]: React.ReactNode };
  additionalOutputButtons: { [key: string]: React.ReactNode };
  onSubmit?: (data: object) => void;
};

export type UIProps = {
  showSelectorsCSV?: string;
  enableFileUpload?: boolean;
  enableVoiceInput?: boolean;
  alternateBackground?: 'primary' | 'secondary';
  footerMessage?: string;
  showOverrideSwitchesCSV?: string;
};

export type AGiXTInteractiveProps = {
  overrides?: Overrides;
  uiConfig?: UIProps;
};

const AGiXTInteractive = ({
  overrides = {
    mode: 'prompt',
  },
  uiConfig = {},
}: AGiXTInteractiveProps): React.JSX.Element => {
  const uiConfigWithEnv = React.useMemo(
    () => ({
      showRLHF: process.env.NEXT_PUBLIC_AGIXT_RLHF === 'true',
      footerMessage: process.env.NEXT_PUBLIC_AGIXT_FOOTER_MESSAGE || '',
      showOverrideSwitchesCSV: process.env.NEXT_PUBLIC_AGIXT_SHOW_OVERRIDE_SWITCHES || '',
      alternateBackground: 'primary' as 'primary' | 'secondary',
      showSelectorsCSV: process.env.NEXT_PUBLIC_AGIXT_SHOW_SELECTION,
      enableVoiceInput: process.env.NEXT_PUBLIC_AGIXT_VOICE_INPUT_ENABLED === 'true',
      enableFileUpload: process.env.NEXT_PUBLIC_AGIXT_FILE_UPLOAD_ENABLED === 'true',
      enableMessageDeletion: process.env.NEXT_PUBLIC_AGIXT_ALLOW_MESSAGE_DELETION === 'true',
      enableMessageEditing: process.env.NEXT_PUBLIC_AGIXT_ALLOW_MESSAGE_EDITING === 'true',
      ...uiConfig,
    }),
    [uiConfig],
  );
  return <Chat {...uiConfigWithEnv} {...overrides} />;
};

export function ConvSwitch({ id }: { id: string }) {
  const interactiveConfig = useInteractiveConfig();
  const prevIdRef = useRef(id);

  useEffect(() => {
    if (id !== prevIdRef.current && interactiveConfig?.mutate) {
      prevIdRef.current = id;
      interactiveConfig.mutate((oldState) => {
        if (oldState.overrides.conversation !== id) {
          return {
            ...oldState,
            overrides: { ...oldState.overrides, conversation: id || '-' },
          };
        }
        return oldState;
      });
    }
  }, [id, interactiveConfig]);

  return null;
}

export default function Home({ params }: { params: { id: string[] } }) {
  const router = useRouter();
  const interactiveConfig = useInteractiveConfig();
  const conversationId = params.id?.[0] || '';
  const { data: conversations = [], mutate: mutateConversations } = useConversations();
  const conversationSWRPath = '/conversation/';

  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [currentNewName, setCurrentNewName] = useState('');
  const [isActionDropdownOpen, setIsActionDropdownOpen] = useState(false);
  const [isCopySuccess, setIsCopySuccess] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Keep track if we've already done the initial state sync
  const hasInitializedRef = useRef(false);

  // Find the current conversation
  const currentConversation = React.useMemo(() => {
    return conversations.find(conv => conv.id === conversationId);
  }, [conversationId, conversations]);
  
  const conversationName = currentConversation?.name !== '-' ? currentConversation?.name : '';
  
  // This effect ensures that when navigating to /chat (empty conversation),
  // the conversation is reset in the state
  useEffect(() => {
    if (!hasInitializedRef.current && interactiveConfig?.mutate) {
      hasInitializedRef.current = true;
      
      // Force a reset if we're at the root /chat path
      if (!conversationId && interactiveConfig.overrides.conversation !== '-') {
        interactiveConfig.mutate((oldState) => ({
          ...oldState,
          overrides: { ...oldState.overrides, conversation: '-' },
        }));
        
        // Force an invalidation of any existing conversation data
        mutate(conversationSWRPath + interactiveConfig.overrides.conversation);
      }
    }
  }, [conversationId, interactiveConfig]);

  const handleNewConversation = useCallback(() => {
    if (interactiveConfig?.mutate) {
      // Set the conversation to '-' to indicate a new conversation
      interactiveConfig.mutate((oldState) => ({
        ...oldState, 
        overrides: { ...oldState.overrides, conversation: '-' },
      }));
      
      // Force an invalidation of any existing conversation data
      mutate(conversationSWRPath + interactiveConfig.overrides.conversation);
    }
    
    // Navigate to root chat path
    router.push('/chat');
  }, [router, interactiveConfig]);

  const handleRenameClick = useCallback(() => {
    setCurrentNewName(conversationName || '');
    setIsRenameDialogOpen(true);
    setIsActionDropdownOpen(false);
  }, [conversationName]);

  const handleCopyLink = useCallback(() => {
    if (!conversationId) return;
    const url = `${window.location.origin}/chat/${conversationId}`;
    navigator.clipboard
      .writeText(url)
      .then(() => {
        setIsCopySuccess(true);
        setTimeout(() => setIsCopySuccess(false), 2000);
        toast({ title: 'Success', description: 'Chat link copied to clipboard' });
      })
      .catch(() => {
        toast({ title: 'Error', description: 'Failed to copy link', variant: 'destructive' });
      });
    setIsActionDropdownOpen(false);
  }, [conversationId]);

  const handleRename = useCallback(
    async (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      if (!conversationId || !currentNewName.trim() || isProcessing || !interactiveConfig?.agixt) return;

      setIsProcessing(true);
      try {
        const agentName = getCookie('agixt-agent') || process.env.NEXT_PUBLIC_AGIXT_AGENT || 'AGiXT';
        await interactiveConfig.agixt.renameConversation(agentName, conversationId, currentNewName.trim());
        await mutateConversations();
        await mutate(conversationSWRPath + conversationId);
        setIsRenameDialogOpen(false);
        toast({ title: 'Success', description: 'Conversation renamed successfully' });
      } catch (error) {
        toast({ title: 'Error', description: 'Failed to rename conversation', variant: 'destructive' });
      } finally {
        setIsProcessing(false);
      }
    },
    [conversationId, currentNewName, interactiveConfig, mutateConversations, isProcessing]
  );

  const handleExport = useCallback(async () => {
    if (!conversationId || isProcessing || !interactiveConfig?.agixt) return;
    setIsProcessing(true);
    try {
      const conversationData = await interactiveConfig.agixt.getConversation('', conversationId);
      const exportFilename = `${conversationName || 'conversation'}_${conversationId.substring(0,8)}.json`;
      const blob = new Blob([JSON.stringify(conversationData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = exportFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: 'Success', description: `Conversation exported as ${exportFilename}` });
      setIsActionDropdownOpen(false);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to export conversation', variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  }, [conversationId, conversationName, interactiveConfig, isProcessing]);

  const handleDelete = useCallback(async () => {
    if (!conversationId || isProcessing || !interactiveConfig?.agixt) return;
    if (!window.confirm('Are you sure you want to delete this conversation? This action cannot be undone.')) {
      setIsActionDropdownOpen(false);
      return;
    }
    setIsProcessing(true);
    try {
      const agentName = getCookie('agixt-agent') || process.env.NEXT_PUBLIC_AGIXT_AGENT || 'AGiXT';
      await interactiveConfig.agixt.deleteConversation(conversationId, agentName);
      await mutateConversations();
      await mutate(conversationSWRPath + conversationId);

      if (interactiveConfig.mutate) {
        interactiveConfig.mutate((oldState) => ({
          ...oldState,
          overrides: { ...oldState.overrides, conversation: '-' },
        }));
      }
      router.push('/chat');
      toast({ title: 'Success', description: 'Conversation deleted successfully' });
      setIsActionDropdownOpen(false);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete conversation', variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  }, [conversationId, interactiveConfig, mutateConversations, router, isProcessing]);

  return (
    <>
      <SidebarInset>
        <header
          className="flex shrink-0 items-center justify-between gap-2 px-4 sm:px-6 transition-[width,height] ease-linear w-full sticky top-0 z-20 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b"
          style={{ paddingTop: 'env(safe-area-inset-top)', height: 'calc(3.5rem + env(safe-area-inset-top))' }}
        >
          <div className="flex items-center h-full md:hidden">
            <SidebarTrigger className="size-9" />
            <Separator orientation="vertical" className="h-4 ml-2" />
          </div>
          
          <div className="flex-grow flex items-center justify-center overflow-hidden">
            <h1 className="text-lg font-medium truncate" title={conversationName || "New Chat"}>
              {conversationName || "New Chat"}
            </h1>
          </div>

          <div className="flex items-center h-full gap-1 sm:gap-2">
            {/* New Conversation button is always visible */}
            <Button variant="outline" size="icon" title="New Blank Conversation" onClick={handleNewConversation} disabled={isProcessing} className="size-9">
                <Plus className="h-4 w-4" />
            </Button>
            
            {/* Actions for existing conversations */}
            {conversationId && (
              <>
                {/* Visible buttons on larger screens */}
                <div className="hidden sm:flex items-center gap-1 sm:gap-2">
                  <Button variant="outline" size="icon" onClick={handleRenameClick} title="Rename Conversation" disabled={isProcessing} className="size-9">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={handleExport} title="Export Conversation" disabled={isProcessing} className="size-9">
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={handleDelete} title="Delete Conversation" className="hover:bg-destructive/10 size-9" disabled={isProcessing}>
                    <Trash className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={handleCopyLink} title="Copy Link" disabled={isProcessing} className="size-9">
                    {isCopySuccess ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>

                {/* Dropdown menu for smaller screens */}
                <DropdownMenu open={isActionDropdownOpen} onOpenChange={setIsActionDropdownOpen}>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="sm:hidden size-9" title="More actions">
                      <ChevronDown className="h-5 w-5 opacity-75" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem onClick={handleRenameClick} disabled={isProcessing}>
                      <Edit className="mr-2 h-4 w-4" />
                      <span>Rename</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleExport} disabled={isProcessing}>
                      <Download className="mr-2 h-4 w-4" />
                      <span>Export</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleCopyLink} disabled={isProcessing}>
                      {isCopySuccess ? <Check className="mr-2 h-4 w-4 text-green-500" /> : <Copy className="mr-2 h-4 w-4" />}
                      <span>Copy Link</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleDelete} className="text-destructive focus:text-destructive" disabled={isProcessing}>
                      <Trash className="mr-2 h-4 w-4" />
                      <span>Delete</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
            {currentConversation?.attachmentCount > 0 && (
              <div className="ml-2 hidden md:block">
                <span className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs font-medium">
                  {currentConversation.attachmentCount} attachment{currentConversation.attachmentCount !== 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>
        </header>

        <main
          className={cn('flex flex-col flex-1 gap-6 px-6 py-4')}
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 5rem)' }} 
        >
          <ConvSwitch id={conversationId} />
          <AGiXTInteractive
            uiConfig={{
              showChatThemeToggles: false,
              enableVoiceInput: true,
              footerMessage: '',
              alternateBackground: 'primary',
            }}
            overrides={{
              conversation: conversationId,
            }}
          />
        </main>
      </SidebarInset>

      <Dialog
        open={isRenameDialogOpen}
        onOpenChange={(open) => {
          if (!isProcessing) setIsRenameDialogOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Conversation</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRename}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={currentNewName}
                  onChange={(e) => setCurrentNewName(e.target.value)}
                  autoFocus
                  disabled={isProcessing}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsRenameDialogOpen(false)} disabled={isProcessing}>
                Cancel
              </Button>
              <Button type="submit" disabled={isProcessing || !currentNewName.trim()}>
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save changes'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}