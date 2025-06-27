'use client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import axios from 'axios';
import { getCookie } from 'cookies-next';
import { LuCheck, LuPencil, LuPlus } from 'react-icons/lu';
import { useCompanies, useCompany } from '@/components/interactive/useUser';
import { Label } from '@/components/ui/label';
import { ColumnDef } from '@tanstack/react-table';
import { Check, Mail, MoreHorizontal, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useContext, useEffect } from 'react';
import useSWR from 'swr';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DataTable } from '@/components/conversation/Message/data-table';
import { DataTableColumnHeader } from '@/components/conversation/Message/data-table/data-table-column-header';
import { InteractiveConfigContext } from '@/components/interactive/InteractiveConfigContext';
import { SidebarPage } from '@/components/layout/SidebarPage';

interface User {
  email: string;
  first_name: string;
  id: string;
  last_name: string;
  role: string;
  role_id: number;
}

const ROLES = [
  { id: 2, name: 'Admin' },
  { id: 3, name: 'User' },
];

interface Invitation {
  id: string;
  company_id: string;
  email: string;
  inviter_id: string;
  role_id: number;
  is_accepted: boolean;
  created_at: string;
  invitation_link: string;
}

function useInvitations(company_id?: string) {
  const state = useContext(InteractiveConfigContext);
  return useSWR<Invitation[]>(
    company_id ? `/invitations/${company_id}` : '/invitations',
    async () => await state.agixt.getInvitations(company_id),
    {
      fallbackData: [],
    },
  );
}

function useActiveCompany() {
  const state = useContext(InteractiveConfigContext);
  const { data: companyData } = useCompany();
  return useSWR<any>(
    [`/companies`, companyData?.id ?? null],
    async () => {
      if (!companyData?.id) return null;
      
      const companies = await state.agixt.getCompanies();
      const user = await axios.get(`${process.env.NEXT_PUBLIC_AGIXT_SERVER}/v1/user`, {
        headers: {
          Authorization: getCookie('jwt'),
        },
      });
      const target = companies.filter((company: any) => company.id === companyData.id)[0];
      if (target) {
        target.my_role = user.data.companies.filter((company: any) => company.id === companyData.id)[0]?.role_id;
      }
      return target;
    },
    {
      fallbackData: null,
    },
  );
}

export const TeamUsers = () => {
  const [email, setEmail] = useState('');
  const [roleId, setRoleId] = useState('3');
  const [mounted, setMounted] = useState(false);
  const { data: activeCompany, mutate } = useActiveCompany();
  const { data: invitationsData, mutate: mutateInvitations } = useInvitations(activeCompany?.id);
  const [responseMessage, setResponseMessage] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div>Loading...</div>;
  }

  const users_columns: ColumnDef<User>[] = [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && 'indeterminate')}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label='Select all'
          className='translate-y-[2px]'
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label='Select row'
          className='translate-y-[2px]'
        />
      ),
      enableSorting: false,
      enableHiding: false,
      size: 50,
      minSize: 50,
    },
    {
      accessorKey: 'first_name',
      header: ({ column }) => <DataTableColumnHeader column={column} title='First Name' />,
      cell: ({ row }) => {
        return (
          <div className='flex space-x-2'>
            <span className='truncate font-medium'>{row.getValue('first_name')}</span>
          </div>
        );
      },
      meta: {
        headerName: 'First Name',
      },
      size: 150,
      minSize: 120,
      maxSize: 200,
    },
    {
      accessorKey: 'last_name',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Last Name' />,
      cell: ({ row }) => {
        return (
          <div className='flex items-center'>
            <span>{row.getValue('last_name')}</span>
          </div>
        );
      },
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id));
      },
      meta: {
        headerName: 'Last Name',
      },
      size: 150,
      minSize: 120,
      maxSize: 200,
    },
    {
      accessorKey: 'email',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Email' />,
      cell: ({ row }) => {
        return (
          <div className='flex items-center'>
            <span className='truncate'>{row.getValue('email')}</span>
          </div>
        );
      },
      meta: {
        headerName: 'Email',
      },
      minSize: 200,
      size: 400,
      maxSize: 600,
    },
    {
      accessorKey: 'role',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Role' />,
      cell: ({ row }) => {
        const role = row.getValue('role') as string;
        return (
          <div className='flex items-center'>
            <Badge variant='outline' className='capitalize'>
              {role?.replace('_', ' ')}
            </Badge>
          </div>
        );
      },
      meta: {
        headerName: 'Role',
      },
      size: 120,
      minSize: 100,
      maxSize: 150,
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const router = useRouter();

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className='flex h-8 w-8 p-0 items-center justify-center rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground'>
                <MoreHorizontal className='w-4 h-4' />
                <span className='sr-only'>Open menu</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end' className='w-[160px]'>
              <DropdownMenuLabel>User Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => router.push(`/users/${row.original.id}`)}>View Details</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={(e) => {
                  const data = {
                    role_id: 3,
                    company_id: activeCompany?.id,
                    user_id: row.original.id,
                  };
                  axios
                    .put(`${process.env.NEXT_PUBLIC_AGIXT_SERVER}/v1/user/role`, data, {
                      headers: {
                        Authorization: getCookie('jwt'),
                        'Content-Type': 'application/json',
                      },
                    })
                    .then((response) => {
                      mutate();
                      setResponseMessage('User Role updated successfully!');
                    })
                    .catch((error: any) => {
                      setResponseMessage(error.response?.data?.detail || 'Failed to update user role');
                    });
                }}
              >
                Change Role To User
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={(e) => {
                  const data = {
                    role_id: 2,
                    company_id: activeCompany?.id,
                    user_id: row.original.id,
                  };
                  axios
                    .put(`${process.env.NEXT_PUBLIC_AGIXT_SERVER}/v1/user/role`, data, {
                      headers: {
                        Authorization: getCookie('jwt'),
                        'Content-Type': 'application/json',
                      },
                    })
                    .then((response) => {
                      mutate();
                      setResponseMessage('User Role updated successfully!');
                    })
                    .catch((error: any) => {
                      setResponseMessage(error.response?.data?.detail || 'Failed to update user role');
                    });
                }}
              >
                Change Role To Company Admin
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={(e) => {
                  const data = {
                    role_id: 1,
                    company_id: activeCompany?.id,
                    user_id: row.original.id,
                  };
                  axios
                    .put(`${process.env.NEXT_PUBLIC_AGIXT_SERVER}/v1/user/role`, data, {
                      headers: {
                        Authorization: getCookie('jwt'),
                        'Content-Type': 'application/json',
                      },
                    })
                    .then((response) => {
                      mutate();
                      setResponseMessage('User Role updated successfully!');
                    })
                    .catch((error: any) => {
                      setResponseMessage(error.response?.data?.detail || 'Failed to update user role');
                    });
                }}
              >
                Change Role To Tenant Admin
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={(e) => {
                  const data = {
                    role_id: 4,
                    company_id: activeCompany?.id,
                    user_id: row.original.id,
                  };
                  axios
                    .put(`${process.env.NEXT_PUBLIC_AGIXT_SERVER}/v1/user/role`, data, {
                      headers: {
                        Authorization: getCookie('jwt'),
                        'Content-Type': 'application/json',
                      },
                    })
                    .then((response) => {
                      mutate();
                      setResponseMessage('User Role updated successfully!');
                    })
                    .catch((error: any) => {
                      setResponseMessage(error.response?.data?.detail || 'Failed to update user role');
                    });
                }}
              >
                Change Role To Child
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className='text-destructive'
                onClick={(e) => {
                  axios
                    .delete(
                      `${process.env.NEXT_PUBLIC_AGIXT_SERVER}/v1/companies/${activeCompany?.id}/users/${row.original.id}`,
                      {
                        headers: {
                          'Content-Type': 'application/json',
                          Authorization: getCookie('jwt'),
                        },
                      },
                    )
                    .then(() => {
                      mutate();
                      setResponseMessage('User deleted successfully!');
                    })
                    .catch((error: any) => {
                      setResponseMessage(error.response?.data?.detail || 'Failed to delete user');
                    });
                }}
              >
                Delete User
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
      enableHiding: true,
      enableSorting: false,
      meta: {
        headerName: 'Actions',
      },
      size: 80,
      minSize: 80,
    },
  ];

  const invitations_columns: ColumnDef<Invitation>[] = [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && 'indeterminate')}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label='Select all'
          className='translate-y-[2px]'
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label='Select row'
          className='translate-y-[2px]'
        />
      ),
      enableSorting: false,
      enableHiding: false,
      size: 50,
      minSize: 50,
    },
    {
      accessorKey: 'email',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Email' />,
      cell: ({ row }) => {
        return (
          <div className='flex items-center space-x-2'>
            <Mail className='w-4 h-4 text-muted-foreground' />
            <span className='font-medium'>{row.getValue('email')}</span>
          </div>
        );
      },
      meta: {
        headerName: 'Email',
      },
      minSize: 200,
      size: 400,
      maxSize: 600,
    },
    {
      accessorKey: 'role_id',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Role' />,
      cell: ({ row }) => {
        const roleMap = {
          1: 'Root Admin',
          2: 'Team Admin',
          3: 'User',
        };
        return (
          <div className='flex items-center'>
            <span>{roleMap[row.getValue('role_id') as keyof typeof roleMap]}</span>
          </div>
        );
      },
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id));
      },
      meta: {
        headerName: 'Role',
      },
      size: 120,
      minSize: 100,
      maxSize: 150,
    },
    {
      accessorKey: 'is_accepted',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Status' />,
      cell: ({ row }) => {
        const isAccepted = row.getValue('is_accepted');
        return (
          <div className='flex items-center'>
            <Badge variant={isAccepted ? 'default' : 'secondary'}>
              {isAccepted ? <Check className='w-3 h-3 mr-1' /> : <X className='w-3 h-3 mr-1' />}
              {isAccepted ? 'Accepted' : 'Pending'}
            </Badge>
          </div>
        );
      },
      meta: {
        headerName: 'Status',
      },
      size: 100,
      minSize: 80,
      maxSize: 120,
    },
    {
      accessorKey: 'created_at',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Sent Date' />,
      cell: ({ row }) => {
        const date = new Date(row.getValue('created_at'));
        const formattedDate = date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });
        return (
          <div className='flex items-center'>
            <span>{formattedDate}</span>
          </div>
        );
      },
      meta: {
        headerName: 'Sent Date',
      },
      size: 120,
      minSize: 100,
      maxSize: 150,
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const router = useRouter();

        const copyInviteLink = (link: string) => {
          navigator.clipboard.writeText(link);
          setResponseMessage('Invite link copied to clipboard!');
        };

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className='flex h-8 w-8 p-0 items-center justify-center rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground'>
                <MoreHorizontal className='w-4 h-4' />
                <span className='sr-only'>Open menu</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end' className='w-[160px]'>
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => copyInviteLink(row.original.invitation_link)}>
                Copy Invite Link
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => router.push(`/invitation/${row.original.id}`)}>
                View Details
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className='text-destructive'
                onClick={async () => {
                  try {
                    await axios.delete(`${process.env.NEXT_PUBLIC_AGIXT_SERVER}/v1/invitation/${row.original.id}`, {
                      headers: {
                        Authorization: getCookie('jwt'),
                      },
                    });
                    mutateInvitations();
                    setResponseMessage('Invitation cancelled successfully!');
                  } catch (error: any) {
                    setResponseMessage(error.response?.data?.detail || 'Failed to cancel invitation');
                  }
                }}
              >
                Cancel Invitation
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
      enableHiding: false,
      enableSorting: false,
      meta: {
        headerName: 'Actions',
      },
      size: 80,
      minSize: 80,
    },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setResponseMessage('Please enter an email to invite.');
      return;
    }
    try {
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_AGIXT_SERVER}/v1/invitations`,
        {
          email: email,
          role_id: parseInt(roleId),
          company_id: activeCompany?.id,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: getCookie('jwt'),
          },
        },
      );
      mutateInvitations();
      if (response.status === 200) {
        if (response.data?.id) {
          setResponseMessage(
            `Invitation sent successfully! The invite link is ${process.env.NEXT_PUBLIC_APP_URI}/?invitation_id=${response.data.id}&email=${email}`,
          );
        } else {
          setResponseMessage('Invitation sent successfully!');
        }
        setEmail('');
      }
    } catch (error: any) {
      setResponseMessage(error.response?.data?.detail || 'Failed to send invitation');
    }
  };

  return (
    <div className='space-y-6'>
      <div>
        <h4 className='text-md font-medium mb-3'>{activeCompany?.name} Current Users</h4>
        <div className='w-full'>
          <div className='rounded-md border'>
            <DataTable data={activeCompany?.users || []} columns={users_columns} />
          </div>
        </div>
      </div>
      
      <div className='border-t pt-6'>
        <form onSubmit={handleSubmit} className='space-y-4'>
          <h4 className='text-md font-medium'>Invite Users to {activeCompany?.name}</h4>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <div className='space-y-2'>
              <Label htmlFor='email'>Email Address</Label>
              <Input
                id='email'
                type='email'
                placeholder='user@example.com'
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='role'>Role</Label>
              <Select value={roleId} onValueChange={setRoleId}>
                <SelectTrigger>
                  <SelectValue placeholder='Select a role' />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((role) => (
                    <SelectItem key={role.id} value={role.id.toString()}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button type='submit' disabled={!email}>
            Send Invitation
          </Button>
        </form>
      </div>
      
      {invitationsData && invitationsData.length > 0 && (
        <div className='border-t pt-6'>
          <h4 className='text-md font-medium mb-3'>Pending Invitations</h4>
          <div className='w-full'>
            <div className='rounded-md border'>
              <DataTable data={invitationsData} columns={invitations_columns} />
            </div>
          </div>
        </div>
      )}
      
      {responseMessage && (
        <div className='p-3 bg-muted rounded-md'>
          <p className='text-sm'>{responseMessage}</p>
          <Button 
            variant='ghost' 
            size='sm' 
            onClick={() => setResponseMessage('')}
            className='mt-2'
          >
            Dismiss
          </Button>
        </div>
      )}
    </div>
  );
};

export default function TeamPage() {
  const [email, setEmail] = useState('');
  const [roleId, setRoleId] = useState('3');
  const [renaming, setRenaming] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newParent, setNewParent] = useState('');
  const [newName, setNewName] = useState('');
  const [mounted, setMounted] = useState(false);
  const { data: companyData } = useCompanies();
  const { data: activeCompany, mutate } = useCompany();
  const [responseMessage, setResponseMessage] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div>Loading...</div>;
  }

  const handleConfirm = async () => {
    if (renaming) {
      try {
        await axios.put(
          `${process.env.NEXT_PUBLIC_AGIXT_SERVER}/v1/companies/${activeCompany?.id}`,
          { name: newName },
          {
            headers: {
              Authorization: getCookie('jwt'),
              'Content-Type': 'application/json',
            },
          },
        );
        setRenaming(false);
        mutate();
        setResponseMessage('Company name updated successfully!');
      } catch (error: any) {
        setResponseMessage(error.response?.data?.detail || 'Failed to update company name');
      }
    } else {
      try {
        const newResponse = await axios.post(
          `${process.env.NEXT_PUBLIC_AGIXT_SERVER}/v1/companies`,
          { name: newName, agent_name: newName + ' Agent', ...(newParent ? { parent_company_id: newParent } : {}) },
          {
            headers: {
              Authorization: getCookie('jwt'),
              'Content-Type': 'application/json',
            },
          },
        );
        mutate();
        setResponseMessage('Company created successfully!');
      } catch (error: any) {
        setResponseMessage(error.response?.data?.detail || 'Failed to create company');
      }
      setCreating(false);
    }
  };

  return (
    <SidebarPage title='Team Management'>
      <div className='px-6 py-4 space-y-6'>
        <div className='flex items-center justify-start gap-2'>
          {renaming || creating ? (
            <>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className='w-64'
                placeholder='Enter new name'
              />
              {creating && (
                <Select value={newParent} onValueChange={(value) => setNewParent(value)}>
                  <SelectTrigger className='w-64'>
                    <SelectValue placeholder='(Optional) Select a Parent Company' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Parent Company</SelectLabel>
                      <SelectItem value='-'>[NONE]</SelectItem>
                      {companyData?.map((child: any) => (
                        <SelectItem key={child.id} value={child.id}>
                          {child.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              )}
            </>
          ) : (
            <h3 className='text-lg font-medium'>{activeCompany?.name}</h3>
          )}

          <TooltipProvider>
            <div className='flex gap-2'>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={() => {
                      if (renaming) {
                        handleConfirm();
                      } else {
                        setRenaming(true);
                        setNewName(activeCompany?.name || '');
                      }
                    }}
                    disabled={creating}
                    size='icon'
                    variant='ghost'
                  >
                    {renaming ? <LuCheck className='h-4 w-4' /> : <LuPencil className='h-4 w-4' />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{renaming ? 'Confirm rename' : 'Rename'}</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={() => {
                      if (creating) {
                        handleConfirm();
                      } else {
                        setCreating(true);
                        setNewName('');
                      }
                    }}
                    disabled={renaming}
                    size='icon'
                    variant='ghost'
                  >
                    {creating ? <LuCheck className='h-4 w-4' /> : <LuPlus className='h-4 w-4' />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{creating ? 'Confirm create' : 'Create new'}</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </div>
        
        <TeamUsers />
        
        {responseMessage && (
          <div className='p-3 bg-muted rounded-md'>
            <p className='text-sm'>{responseMessage}</p>
            <Button 
              variant='ghost' 
              size='sm' 
              onClick={() => setResponseMessage('')}
              className='mt-2'
            >
              Dismiss
            </Button>
          </div>
        )}
      </div>
    </SidebarPage>
  );
}
