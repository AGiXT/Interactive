'use client';

import { SidebarPage } from '@/components/layout/SidebarPage';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/conversation/Message/data-table';
import { ColumnDef } from '@tanstack/react-table';
import useSWR, { mutate } from 'swr';
import axios from 'axios';
import { getCookie } from 'cookies-next';
import { useState, useMemo } from 'react';
import { LuPlus, LuPencil, LuTrash2, LuCalendar, LuListTodo } from 'react-icons/lu';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { DataTableColumnHeader } from '@/components/conversation/Message/data-table/data-table-column-header';
import { toast } from '@/components/layout/toast';

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
}

// Define columns for the DataTable
const columns: ColumnDef<Task>[] = [
  {
    accessorKey: 'title',
    header: ({ column }) =><DataTableColumnHeader column={column} title='Title' />,
    cell: ({ row }) =>row.getValue('title'),
  },
  {
    accessorKey: 'description',
    header: ({ column }) =><DataTableColumnHeader column={column} title='Description' />,
    cell: ({ row }) =>row.getValue('description'),
  },
  {
    accessorKey: 'due_date',
    header: ({ column }) =><DataTableColumnHeader column={column} title='Due Date' />,
    cell: ({ row }) =>{
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
    header: ({ column }) =><DataTableColumnHeader column={column} title='Priority' />,
    cell: ({ row }) =>row.getValue('priority') || '-',
  },
  {
    accessorKey: 'is_reoccurring',
    header: ({ column }) =><DataTableColumnHeader column={column} title='Reoccurring' />,
    cell: ({ row }) =>(row.getValue('is_reoccurring') ? 'Yes' : 'No'),
  },
  {
    accessorKey: 'frequency',
    header: ({ column }) =><DataTableColumnHeader column={column} title='Frequency' />,
    cell: ({ row }) =>row.getValue('frequency') || '-',
  },
  {
    id: 'actions',
    header: () =><span>Actions</span>,
    cell: ({ row }) =>{
      const task = row.original;
      const [modifyDialogOpen, setModifyDialogOpen] = useState(false);
      const [modifyFormData, setModifyFormData] = useState<Partial<Task>>(task);

      const handleModify = async () =>{
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
          toast({ title: 'Error', description: error.response?.data?.detail || 'Failed to modify task.', variant: 'destructive' });
        }
      };

      return (<div className='flex items-center gap-2'><Dialog open={modifyDialogOpen} onOpenChange={setModifyDialogOpen}><DialogTrigger asChild><Button variant='ghost' size='icon' onClick={() =>setModifyFormData(task)}><LuPencil className='h-4 w-4' /></Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Modify Task</DialogTitle></DialogHeader><div className='grid gap-4 py-4'><div className='space-y-2'><Label htmlFor='modify-title'>Title</Label><Input
                    id='modify-title'
                    value={modifyFormData.title || ''}
                    onChange={(e) =>setModifyFormData({ ...modifyFormData, title: e.target.value })}
                  /></div><div className='space-y-2'><Label htmlFor='modify-description'>Description</Label><Textarea
                    id='modify-description'
                    value={modifyFormData.description || ''}
                    onChange={(e) =>setModifyFormData({ ...modifyFormData, description: e.target.value })}
                  /></div><div className='space-y-2'><Label htmlFor='modify-due-date'>Due Date</Label><Input
                    id='modify-due-date'
                    type='datetime-local'
                    value={modifyFormData.due_date ? new Date(modifyFormData.due_date).toISOString().slice(0, 16) : ''}
                    onChange={(e) =>setModifyFormData({ ...modifyFormData, due_date: e.target.value })}
                  /></div><div className='space-y-2'><Label htmlFor='modify-estimated-hours'>Estimated Hours</Label><Input
                    id='modify-estimated-hours'
                    type='number'
                    value={modifyFormData.estimated_hours || ''}
                    onChange={(e) =>setModifyFormData({ ...modifyFormData, estimated_hours: e.target.value })}
                  /></div><div className='space-y-2'><Label htmlFor='modify-priority'>Priority</Label><Input
                    id='modify-priority'
                    type='number'
                    value={modifyFormData.priority || ''}
                    onChange={(e) =>setModifyFormData({ ...modifyFormData, priority: e.target.value })}
                  /></div></div><DialogFooter><Button variant='outline' onClick={() =>setModifyDialogOpen(false)}>Cancel</Button><Button onClick={handleModify}>Save Changes</Button></DialogFooter></DialogContent></Dialog></div>);
    },
  },
];

const fetchTasks = async () =>{
  const response = await axios.get(`${process.env.NEXT_PUBLIC_AGIXT_SERVER}/v1/tasks`, {
    headers: { Authorization: getCookie('jwt') },
  });
  // API returns { tasks: [...] }, extract the array
  return response.data.tasks || [];
};

export default function TasksPage() {
  const { data: tasks, error, isLoading } = useSWR('/v1/tasks', fetchTasks);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [isReoccurring, setIsReoccurring] = useState(false);
  const [createFormData, setCreateFormData] = useState<Partial<Task>>({});
    const [selectedConversationId, setSelectedConversationId] = useState<string | null>('');

  const handleCreate = async () =>{
      try {
        const endpoint = isReoccurring ? '/v1/reoccurring_task' : '/v1/task';
        let assignedConversationId = selectedConversationId;

        if (assignedConversationId === 'new') {
          const agentName = getCookie('agixt-agent') || process.env.NEXT_PUBLIC_AGIXT_AGENT || "XT";
          const state = useContext(InteractiveConfigContext);
          if (!state?.agixt) {
              toast({ title: 'Error', description: 'SDK not initialized.', variant: 'destructive' });
              return;
          }

          const newConvName = '-';
          const newConvResponse = await state.agixt.newConversation(agentName, newConvName);
          assignedConversationId = newConvResponse.id;

          mutate('/conversations');
        }

        const payload = isReoccurring
          ? {
              agent_name: "XT",
              title: createFormData.title,
              task_description: createFormData.description,
              start_date: createFormData.start_date,
              end_date: createFormData.end_date,
              frequency: createFormData.frequency,
              conversation_id: assignedConversationId || undefined,
            }
          : {
              agent_name: "XT",
              title: createFormData.title,
              task_description: createFormData.description,
              days: createFormData.days || 0,
              hours: createFormData.hours || 0,
              minutes: createFormData.minutes || 5,
              conversation_id: assignedConversationId || undefined,
            };

        await axios.post(
          `${process.env.NEXT_PUBLIC_AGIXT_SERVER}${endpoint}`,
          payload,
          {
            headers: { Authorization: getCookie('jwt') },
          },
        );
        mutate('/v1/tasks');
        setCreateDialogOpen(false);
        setCreateFormData({});
        setSelectedConversationId('');
        setIsReoccurring(false);
        toast({ title: 'Success', description: 'Task created successfully.' });
      } catch (error: any) {
        toast({ title: 'Error', description: error.response?.data?.detail || 'Failed to create task.', variant: 'destructive' });
      }
    };

  return (<SidebarPage title='Tasks'><div className='space-y-4'><div className='flex justify-end'><Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}><DialogTrigger asChild><Button><LuPlus className='h-4 w-4 mr-2' />Create New Task</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Create New Task</DialogTitle></DialogHeader><div className='grid gap-4 py-4'><div className='space-y-2'><Label htmlFor='create-title'>Title</Label><Input
                    id='create-title'
                    value={createFormData.title || ''}
                    onChange={(e) =>setCreateFormData({ ...createFormData, title: e.target.value })}
                  /></div><div className='space-y-2'><Label htmlFor='create-description'>Description</Label><Textarea
                    id='create-description'
                    value={createFormData.description || ''}
                    onChange={(e) =>setCreateFormData({ ...createFormData, description: e.target.value })}
                  /></div><div className='space-y-2'><Label htmlFor='create-conversation-select'>Assign to Conversation (Optional)</Label><Select
                                        value={selectedConversationId || ''}
                                        onValueChange={(value) =>setSelectedConversationId(value)}
                                      ><SelectTrigger id='create-conversation-select'><SelectValue placeholder='Select or create conversation' /></SelectTrigger><SelectContent><SelectItem value=''>- None -</SelectItem><SelectItem value='new'>- Create New Conversation -</SelectItem>{conversations?.map((conv) =>(<SelectItem key={conv.id} value={conv.id}>{conv.name}</SelectItem>))}</SelectContent></Select></div><div className='flex items-center space-x-2'>
                    id='is-reoccurring'
                    checked={isReoccurring}
                    onCheckedChange={(checked) =>setIsReoccurring(!!checked)}
                  /><Label htmlFor='is-reoccurring'>Reoccurring Task</Label></div>{isReoccurring ? (<><div className='space-y-2'><Label htmlFor='create-start-date'>Start Date</Label><Input
                        id='create-start-date'
                        type='date'
                        value={createFormData.start_date || ''}
                        onChange={(e) =>setCreateFormData({ ...createFormData, start_date: e.target.value })}
                      /></div><div className='space-y-2'><Label htmlFor='create-end-date'>End Date</Label><Input
                        id='create-end-date'
                        type='date'
                        value={createFormData.end_date || ''}
                        onChange={(e) =>setCreateFormData({ ...createFormData, end_date: e.target.value })}
                      /></div><div className='space-y-2'><Label htmlFor='create-frequency'>Frequency</Label><Select
                        value={createFormData.frequency || ''}
                        onValueChange={(value) =>setCreateFormData({ ...createFormData, frequency: value })}
                      ><SelectTrigger id='create-frequency'><SelectValue placeholder='Select frequency' /></SelectTrigger><SelectContent><SelectItem value='daily'>Daily</SelectItem><SelectItem value='weekly'>Weekly</SelectItem><SelectItem value='monthly'>Monthly</SelectItem><SelectItem value='yearly'>Yearly</SelectItem></SelectContent></Select></div></>) : (<><div className='space-y-2'><Label htmlFor='create-days'>Days from now</Label><Input
                        id='create-days'
                        type='number'
                        value={createFormData.days || 0}
                        onChange={(e) =>setCreateFormData({ ...createFormData, days: Number(e.target.value) })}
                      /></div><div className='space-y-2'><Label htmlFor='create-hours'>Hours from now</Label><Input
                        id='create-hours'
                        type='number'
                        value={createFormData.hours || 0}
                        onChange={(e) =>setCreateFormData({ ...createFormData, hours: Number(e.target.value) })}
                      /></div><div className='space-y-2'><Label htmlFor='create-minutes'>Minutes from now</Label><Input
                        id='create-minutes'
                        type='number'
                        value={createFormData.minutes || 5}
                        onChange={(e) =>setCreateFormData({ ...createFormData, minutes: Number(e.target.value) })}
                      /></div></>)}</div><DialogFooter><Button variant='outline' onClick={() =>setCreateDialogOpen(false)}>Cancel</Button><Button onClick={handleCreate}>Create Task</Button></DialogFooter></DialogContent></Dialog></div>{isLoading ? (<p>Loading tasks...</p>) : error ? (<p className='text-destructive'>Error loading tasks: {error.message}</p>) : (<DataTable columns={columns} data={tasks || []} />)}</div></SidebarPage>);
}
import { useContext } from 'react';
import { InteractiveConfigContext } from '@/components/interactive/InteractiveConfigContext';
