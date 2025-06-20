'use client';

import { SidebarPage } from '@/components/layout/SidebarPage';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/conversation/Message/data-table';
import { ColumnDef } from '@tanstack/react-table';
import useSWR, { mutate } from 'swr';
import axios from 'axios';
import { getCookie } from 'cookies-next';
import { useState, useMemo } from 'react';
import { LuPlus, LuPencil, LuTrash2, LuCalendar, LuListTodo, LuCheck, LuChevronsUpDown, LuMessageSquare } from 'react-icons/lu';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { DataTableColumnHeader } from '@/components/conversation/Message/data-table/data-table-column-header';
import { toast } from '@/components/layout/toast';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { useConversations, type ConversationEdge } from '@/components/interactive/useConversation';
import { cn } from '@/lib/utils';
import AGiXTSDK from '@/lib/sdk';

// Define the Task interface based on expected data structure
interface Task {
  id: string; // Corresponds to task_id in API examples
  title: string;
  description: string; // Corresponds to task_description in API examples
  due_date?: string; // Optional for reoccurring, can be null
  estimated_hours?: string; // Optional
  priority?: string; // Optional
  is_reoccurring: boolean;
  frequency?: string; // For reoccurring tasks
  start_date?: string; // For reoccurring tasks
  end_date?: string; // For reoccurring tasks
  conversation_id?: string; // Optional
  // Additional properties for form handling
  days?: number; // For one-time tasks
  hours?: number; // For one-time tasks
  minutes?: number; // For one-time tasks
}

// Define columns for the DataTable
const columns: ColumnDef<Task>[] = [
  {
    accessorKey: 'title',
    header: ({ column }) => <DataTableColumnHeader column={column} title='Title' />,
    cell: ({ row }) => row.getValue('title'),
  },
  {
    accessorKey: 'description',
    header: ({ column }) => <DataTableColumnHeader column={column} title='Description' />,
    cell: ({ row }) => row.getValue('description'),
  },
  {
    accessorKey: 'due_date',
    header: ({ column }) => <DataTableColumnHeader column={column} title='Due Date' />,
    cell: ({ row }) => {
      const date = row.getValue('due_date') as string | undefined;
      // Format date if it exists, handle potential null/undefined
      try {
        return date ? new Date(date).toLocaleString() : '-';
      } catch {
        return date || '-'; // Fallback if date parsing fails
      }
    },
  },
  {
    accessorKey: 'priority',
    header: ({ column }) => <DataTableColumnHeader column={column} title='Priority' />,
    cell: ({ row }) => row.getValue('priority') || '-',
  },
  {
    accessorKey: 'is_reoccurring',
    header: ({ column }) => <DataTableColumnHeader column={column} title='Reoccurring' />,
    cell: ({ row }) => (row.getValue('is_reoccurring') ? 'Yes' : 'No'),
  },
  {
    accessorKey: 'frequency',
    header: ({ column }) => <DataTableColumnHeader column={column} title='Frequency' />,
    cell: ({ row }) => row.getValue('frequency') || '-',
  },
  {
    id: 'actions',
    header: () => <span>Actions</span>,
    cell: ({ row }) => {
      const task = row.original;
      const [modifyDialogOpen, setModifyDialogOpen] = useState(false);
      const [modifyFormData, setModifyFormData] = useState<Partial<Task>>(task);
      const [modifyFormErrors, setModifyFormErrors] = useState<{title?: string; description?: string}>({});

      const validateModifyForm = () => {
        const errors: {title?: string; description?: string} = {};
        
        if (!modifyFormData.title || modifyFormData.title.trim() === '') {
          errors.title = 'Title is required';
        }
        
        if (!modifyFormData.description || modifyFormData.description.trim() === '') {
          errors.description = 'Description is required';
        }
        
        setModifyFormErrors(errors);
        return Object.keys(errors).length === 0;
      };

      const handleModify = async () => {
        if (!validateModifyForm()) {
          return;
        }
        
        try {
          await axios.put(
            `${process.env.NEXT_PUBLIC_AGIXT_SERVER}/v1/task`,
            { task_id: task.id, ...modifyFormData },
            {
              headers: { Authorization: getCookie('jwt') },
            },
          );
          mutate('/v1/tasks'); // Refresh tasks list
          setModifyDialogOpen(false);
          toast({ title: 'Success', description: 'Task modified successfully.' });
        } catch (error: any) {
          toast({
            title: 'Error',
            description: error.response?.data?.detail || 'Failed to modify task.',
            variant: 'destructive',
          });
        }
      };

      return (
        <div className='flex items-center gap-2'>
          <Dialog open={modifyDialogOpen} onOpenChange={setModifyDialogOpen}>
            <DialogTrigger asChild>
              <Button variant='ghost' size='icon' onClick={() => setModifyFormData(task)}>
                <LuPencil className='h-4 w-4' />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Modify Task</DialogTitle>
              </DialogHeader>
              <div className='grid gap-4 py-4'>
                <div className='space-y-2'>
                  <Label htmlFor='modify-title'>Title <span className='text-red-500'>*</span></Label>
                  <Input
                    id='modify-title'
                    value={modifyFormData.title || ''}
                    onChange={(e) => {
                      setModifyFormData({ ...modifyFormData, title: e.target.value });
                      if (modifyFormErrors.title) {
                        setModifyFormErrors({ ...modifyFormErrors, title: undefined });
                      }
                    }}
                    className={modifyFormErrors.title ? 'border-red-500' : ''}
                  />
                  {modifyFormErrors.title && (
                    <p className='text-sm text-red-500'>{modifyFormErrors.title}</p>
                  )}
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='modify-description'>Description <span className='text-red-500'>*</span></Label>
                  <Textarea
                    id='modify-description'
                    value={modifyFormData.description || ''}
                    onChange={(e) => {
                      setModifyFormData({ ...modifyFormData, description: e.target.value });
                      if (modifyFormErrors.description) {
                        setModifyFormErrors({ ...modifyFormErrors, description: undefined });
                      }
                    }}
                    className={modifyFormErrors.description ? 'border-red-500' : ''}
                  />
                  {modifyFormErrors.description && (
                    <p className='text-sm text-red-500'>{modifyFormErrors.description}</p>
                  )}
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='modify-due-date'>Due Date</Label>
                  <Input
                    id='modify-due-date'
                    type='datetime-local'
                    value={modifyFormData.due_date ? new Date(modifyFormData.due_date).toISOString().slice(0, 16) : ''}
                    onChange={(e) => setModifyFormData({ ...modifyFormData, due_date: e.target.value })}
                  />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='modify-estimated-hours'>Estimated Hours</Label>
                  <Input
                    id='modify-estimated-hours'
                    type='number'
                    value={modifyFormData.estimated_hours || ''}
                    onChange={(e) => setModifyFormData({ ...modifyFormData, estimated_hours: e.target.value })}
                  />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='modify-priority'>Priority</Label>
                  <Input
                    id='modify-priority'
                    type='number'
                    value={modifyFormData.priority || ''}
                    onChange={(e) => setModifyFormData({ ...modifyFormData, priority: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant='outline' onClick={() => {
                  setModifyDialogOpen(false);
                  setModifyFormData(task);
                  setModifyFormErrors({});
                }}>
                  Cancel
                </Button>
                <Button
                  onClick={handleModify}
                  disabled={!modifyFormData.title?.trim() || !modifyFormData.description?.trim()}
                >
                  Save Changes
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      );
    },
  },
];

const fetchTasks = async () => {
  const response = await axios.get(`${process.env.NEXT_PUBLIC_AGIXT_SERVER}/v1/tasks`, {
    headers: { Authorization: getCookie('jwt') },
  });
  // API returns { tasks: [...] }, extract the array
  return response.data.tasks || [];
};

// ConversationSelector component integrated inline
interface ConversationSelectorProps {
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

function ConversationSelector({
  value,
  onValueChange,
  placeholder = 'Select a conversation...',
  disabled = false,
}: ConversationSelectorProps) {
  const [open, setOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  
  const { data: conversations, error, isLoading } = useConversations();
  
  const hyphenConversation = useMemo(() => {
    return conversations?.find((conv) => conv.name === '-');
  }, [conversations]);
  
  const selectedConversation = useMemo(() => {
    if (value === '-') {
      // If value is "-", return a dummy object for "Create New Conversation"
      return { id: '-', name: 'Create New Conversation', createdAt: new Date().toISOString(), attachmentCount: 0 };
    }
    return conversations?.find((conv) => conv.id === value);
  }, [conversations, value]);

  const handleSelect = (conversationId: string) => {
    onValueChange?.(conversationId);
    setOpen(false);
  };

  const handleNewConversation = async () => {
    // Always set conversation_id to "-" for new conversations
    onValueChange?.('-');
    setOpen(false);
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  return (
    <>
      <Button
        variant="outline"
        role="combobox"
        aria-expanded={open}
        aria-label="Select conversation"
        className={cn(
          'w-full justify-between',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        {selectedConversation ? (
          <div className="flex items-center gap-2 truncate">
            <LuMessageSquare className="h-4 w-4 shrink-0" />
            <span className="truncate">
              {selectedConversation.name}
            </span>
          </div>
        ) : (
          <span className="text-muted-foreground">{placeholder}</span>
        )}
        <LuChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search conversations..." />
        <CommandList>
          <CommandEmpty>
            {isLoading ? (
              <div className="text-center py-4">
                <div className="text-sm text-muted-foreground">Loading conversations...</div>
              </div>
            ) : error ? (
              <div className="text-center py-4">
                <div className="text-sm text-destructive">Error loading conversations</div>
              </div>
            ) : (
              <div className="text-center py-4">
                <div className="text-sm text-muted-foreground">No conversations found</div>
              </div>
            )}
          </CommandEmpty>
          

          <CommandGroup heading="Conversations">
            {/* Always show Create New Conversation option at the top */}
            <CommandItem
              key="create-new-conversation"
              value="create-new"
              onSelect={handleNewConversation}
              className="cursor-pointer"
            >
              <LuCheck
                className={cn(
                  'mr-2 h-4 w-4',
                  value === '-' ? 'opacity-100' : 'opacity-0'
                )}
              />
              <div className="flex flex-col gap-1 min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <LuMessageSquare className="h-4 w-4 shrink-0" />
                  <span className="font-medium truncate">Create New Conversation</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>Create new conversation</span>
                </div>
              </div>
            </CommandItem>

            {/* Show existing conversations, filter out any with name "-" since we handle them above */}
            {conversations && conversations.length > 0 &&
              conversations
                .filter((conversation) => conversation.name !== '-')
                .map((conversation) => (
                <CommandItem
                  key={conversation.id}
                  value={conversation.id}
                  onSelect={() => handleSelect(conversation.id)}
                  className="cursor-pointer"
                >
                  <LuCheck
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === conversation.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <div className="flex flex-col gap-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <LuMessageSquare className="h-4 w-4 shrink-0" />
                      <span className="font-medium truncate">
                        {conversation.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <LuCalendar className="h-3 w-3" />
                        <span>{formatDate(conversation.createdAt)}</span>
                      </div>
                      {conversation.attachmentCount > 0 && (
                        <span>{conversation.attachmentCount} attachment{conversation.attachmentCount !== 1 ? 's' : ''}</span>
                      )}
                    </div>
                  </div>
                </CommandItem>
              ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>

    </>
  );
}

export default function TasksPage() {
  const { data: tasks, error, isLoading } = useSWR('/v1/tasks', fetchTasks);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [isReoccurring, setIsReoccurring] = useState(false);
  const [createFormData, setCreateFormData] = useState<Partial<Task>>({});
  const [createFormErrors, setCreateFormErrors] = useState<{title?: string; description?: string}>({});

  const validateCreateForm = () => {
    const errors: {title?: string; description?: string} = {};
    
    if (!createFormData.title || createFormData.title.trim() === '') {
      errors.title = 'Title is required';
    }
    
    if (!createFormData.description || createFormData.description.trim() === '') {
      errors.description = 'Description is required';
    }
    
    setCreateFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreate = async () => {
    if (!validateCreateForm()) {
      return;
    }
    
    try {
      const endpoint = isReoccurring ? '/v1/reoccurring_task' : '/v1/task';
      const payload = isReoccurring
        ? {
            // Reoccurring payload
            agent_name: getCookie('agixt-agent'),
            title: createFormData.title,
            task_description: createFormData.description,
            start_date: createFormData.start_date,
            end_date: createFormData.end_date,
            frequency: createFormData.frequency,
            conversation_id: createFormData.conversation_id,
          }
        : {
            // One-time payload
            agent_name: getCookie('agixt-agent'),
            title: createFormData.title,
            task_description: createFormData.description,
            days: createFormData.days || 0,
            hours: createFormData.hours || 0,
            minutes: createFormData.minutes || 5, // Default to 5 minutes if not set
            conversation_id: createFormData.conversation_id,
          };

      await axios.post(`${process.env.NEXT_PUBLIC_AGIXT_SERVER}${endpoint}`, payload, {
        headers: { Authorization: getCookie('jwt') },
      });
      mutate('/v1/tasks'); // Refresh tasks list
      setCreateDialogOpen(false);
      setCreateFormData({}); // Clear form
      setIsReoccurring(false); // Reset toggle
      toast({ title: 'Success', description: 'Task created successfully.' });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.detail || 'Failed to create task.',
        variant: 'destructive',
      });
    }
  };

  return (
    <SidebarPage title='Tasks'>
      <div className='space-y-4'>
        <div className='flex justify-end'>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <LuPlus className='h-4 w-4 mr-2' />
                Create New Task
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Task</DialogTitle>
              </DialogHeader>
              <div className='grid gap-4 py-4'>
                <div className='space-y-2'>
                  <Label htmlFor='create-title'>Title <span className='text-red-500'>*</span></Label>
                  <Input
                    id='create-title'
                    value={createFormData.title || ''}
                    onChange={(e) => {
                      setCreateFormData({ ...createFormData, title: e.target.value });
                      if (createFormErrors.title) {
                        setCreateFormErrors({ ...createFormErrors, title: undefined });
                      }
                    }}
                    className={createFormErrors.title ? 'border-red-500' : ''}
                  />
                  {createFormErrors.title && (
                    <p className='text-sm text-red-500'>{createFormErrors.title}</p>
                  )}
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='create-description'>Description <span className='text-red-500'>*</span></Label>
                  <Textarea
                    id='create-description'
                    value={createFormData.description || ''}
                    onChange={(e) => {
                      setCreateFormData({ ...createFormData, description: e.target.value });
                      if (createFormErrors.description) {
                        setCreateFormErrors({ ...createFormErrors, description: undefined });
                      }
                    }}
                    className={createFormErrors.description ? 'border-red-500' : ''}
                  />
                  {createFormErrors.description && (
                    <p className='text-sm text-red-500'>{createFormErrors.description}</p>
                  )}
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='create-conversation-id'>Conversation (Optional)</Label>
                  <ConversationSelector
                    value={createFormData.conversation_id || ''}
                    onValueChange={(value) => setCreateFormData({ ...createFormData, conversation_id: value })}
                    placeholder='Select or create a conversation...'
                  />
                </div>
                <div className='flex items-center space-x-2'>
                  <Checkbox
                    id='is-reoccurring'
                    checked={isReoccurring}
                    onCheckedChange={(checked) => setIsReoccurring(!!checked)}
                  />
                  <Label htmlFor='is-reoccurring'>Reoccurring Task</Label>
                </div>
                {isReoccurring ? (
                  <>
                    <div className='space-y-2'>
                      <Label htmlFor='create-start-date'>Start Date</Label>
                      <Input
                        id='create-start-date'
                        type='date'
                        value={createFormData.start_date || ''}
                        onChange={(e) => setCreateFormData({ ...createFormData, start_date: e.target.value })}
                      />
                    </div>
                    <div className='space-y-2'>
                      <Label htmlFor='create-end-date'>End Date</Label>
                      <Input
                        id='create-end-date'
                        type='date'
                        value={createFormData.end_date || ''}
                        onChange={(e) => setCreateFormData({ ...createFormData, end_date: e.target.value })}
                      />
                    </div>
                    <div className='space-y-2'>
                      <Label htmlFor='create-frequency'>Frequency</Label>
                      <Select
                        value={createFormData.frequency || ''}
                        onValueChange={(value) => setCreateFormData({ ...createFormData, frequency: value })}
                      >
                        <SelectTrigger id='create-frequency'>
                          <SelectValue placeholder='Select frequency' />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value='daily'>Daily</SelectItem>
                          <SelectItem value='weekly'>Weekly</SelectItem>
                          <SelectItem value='monthly'>Monthly</SelectItem>
                          <SelectItem value='yearly'>Yearly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                ) : (
                  <>
                    <div className='space-y-2'>
                      <Label htmlFor='create-days'>Days from now</Label>
                      <Input
                        id='create-days'
                        type='number'
                        value={createFormData.days || 0}
                        onChange={(e) => setCreateFormData({ ...createFormData, days: Number(e.target.value) })}
                      />
                    </div>
                    <div className='space-y-2'>
                      <Label htmlFor='create-hours'>Hours from now</Label>
                      <Input
                        id='create-hours'
                        type='number'
                        value={createFormData.hours || 0}
                        onChange={(e) => setCreateFormData({ ...createFormData, hours: Number(e.target.value) })}
                      />
                    </div>
                    <div className='space-y-2'>
                      <Label htmlFor='create-minutes'>Minutes from now</Label>
                      <Input
                        id='create-minutes'
                        type='number'
                        value={createFormData.minutes || 5}
                        onChange={(e) => setCreateFormData({ ...createFormData, minutes: Number(e.target.value) })}
                      />
                    </div>
                  </>
                )}
              </div>
              <DialogFooter>
                <Button variant='outline' onClick={() => {
                  setCreateDialogOpen(false);
                  setCreateFormData({});
                  setCreateFormErrors({});
                  setIsReoccurring(false);
                }}>
                  Cancel
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={!createFormData.title?.trim() || !createFormData.description?.trim()}
                >
                  Create Task
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        {isLoading ? (
          <p>Loading tasks...</p>
        ) : error ? (
          <p className='text-destructive'>Error loading tasks: {error.message}</p>
        ) : (
          <DataTable columns={columns} data={tasks || []} />
        )}
      </div>
    </SidebarPage>
  );
}
