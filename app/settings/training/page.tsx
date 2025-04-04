'use client';
import { useCompany } from '@/components/interactive/useUser';
import { SidebarPage } from '@/components/layout/SidebarPage';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { getCookie } from 'cookies-next';
import { useSearchParams } from 'next/navigation';
import React, { useEffect, useRef, useState } from 'react';
import {
  LuBrain as Brain,
  LuFile,
  LuImage,
  LuLink,
  LuMessageSquare,
  LuMic,
  LuNewspaper,
  LuThumbsUp,
  LuYoutube,
  LuTrash2 as Trash2,
  LuUpload as Upload,
  LuCircleFadingPlus as PlusCircle,
} from 'react-icons/lu';

interface SourceDisplayProps {
  source: string;
  onDelete: (source: string) => void;
}

const getSourceInfo = (
  source: string,
): {
  icon: React.ComponentType;
  label: string;
  description: string;
} => {
  if (source.startsWith('file ')) {
    const fileName = source.split('/').pop() || source;
    return {
      icon: LuFile,
      label: fileName,
      description: 'Uploaded file',
    };
  }
  if (source.startsWith('user input')) {
    return {
      icon: LuMessageSquare,
      label: 'User Conversation',
      description: 'Saved chat engagement',
    };
  }
  if (source.startsWith('http://') || source.startsWith('https://')) {
    return {
      icon: LuLink,
      label: source.replace('http://', '').replace('https://', ''),
      description: 'Web resource',
    };
  }
  if (source.startsWith('audio')) {
    return {
      icon: LuMic,
      label: 'Audio Transcript',
      description: source.replace('audio ', ''),
    };
  }
  if (source.startsWith('image')) {
    return {
      icon: LuImage,
      label: 'Image Description',
      description: source.replace('image ', ''),
    };
  }
  if (source.startsWith('reflection from feedback')) {
    return {
      icon: LuThumbsUp,
      label: 'AI Reflection',
      description: source.replace('reflection from feedback ', ''),
    };
  }
  if (source.startsWith('From arXiv article:')) {
    return {
      icon: LuNewspaper,
      label: 'arXiv Article',
      description: source.replace('From arXiv article: ', ''),
    };
  }
  if (source.startsWith('From YouTube video:')) {
    return {
      icon: LuYoutube,
      label: 'YouTube Transcript',
      description: source.replace('From YouTube video: ', ''),
    };
  }

  // Default case
  return {
    icon: LuFile,
    label: source,
    description: 'External source',
  };
};

const SourceDisplay: React.FC<SourceDisplayProps> = ({ source, onDelete }) => {
  const { icon: Icon, label, description } = getSourceInfo(source);

  return (
    <div className='flex items-center justify-between p-3 transition-colors border rounded-lg bg-card hover:bg-accent/50'>
      <div className='flex items-center flex-1 min-w-0 gap-3'>
        <div className='flex items-center justify-center w-8 h-8 rounded-lg bg-muted'>
          <Icon className='w-4 h-4' />
        </div>
        <div className='flex-1 min-w-0'>
          <h4 className='font-medium truncate'>{label}</h4>
          <p className='text-sm truncate text-muted-foreground'>{description}</p>
        </div>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant='ghost' size='icon'>
            <Trash2 className='w-4 h-4 text-destructive' />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end'>
          <DropdownMenuItem className='text-destructive' onClick={() => onDelete(source)}>
            Confirm Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

const COLLECTION_NUMBER = '0';
const DEFAULT_AGENT = 'XT';

interface AutoResizeTextareaProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder: string;
}

export const AutoResizeTextarea: React.FC<AutoResizeTextareaProps> = ({ value, onChange, placeholder }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [value]);

  return (
    <div tabIndex={-1}>
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className='min-h-[200px] resize-none overflow-hidden'
      />
    </div>
  );
};

export default function Training() {
  const searchParams = useSearchParams();
  const { data: company } = useCompany();
  const [userPersona, setUserPersona] = useState<string>('');
  const [companyPersona, setCompanyPersona] = useState<string>('');
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [userExternalSources, setUserExternalSources] = useState<string[]>([]);
  const [companyExternalSources, setCompanyExternalSources] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const { data: activeCompany } = useCompany();

  // New state for URL learning
  const [learnUrl, setLearnUrl] = useState<string>('');
  const [isLearningUrl, setIsLearningUrl] = useState(false);
  const [urlProgress, setUrlProgress] = useState(0);

  const apiKey = getCookie('jwt') || '';
  const apiServer = process.env.NEXT_PUBLIC_AGIXT_SERVER as string;
  const agentName = getCookie('agixt-agent') || process.env.NEXT_PUBLIC_AGIXT_AGENT || DEFAULT_AGENT;
  useEffect(() => {
    if (activeCompany?.id || searchParams.get('mode') !== 'company') {
      fetchCompanyData();
    }
  }, [activeCompany?.id, searchParams.get('mode') !== 'company']);

  const fetchCompanyData = async () => {
    setLoading(true);
    try {
      const url =
        searchParams.get('mode') === 'company'
          ? `${apiServer}/api/agent/${agentName}/persona/${activeCompany?.id}`
          : `${apiServer}/api/agent/${agentName}/persona`;

      const personaResponse = await fetch(url, {
        headers: { Authorization: apiKey },
      });

      if (personaResponse.ok) {
        const personaData = await personaResponse.json();
        if (searchParams.get('mode') === 'company') {
          setCompanyPersona(personaData.message === 'None' ? '' : personaData.message || '');
        } else {
          setUserPersona(personaData.message === 'None' ? '' : personaData.message || '');
        }
      }

      const sourcesUrl =
        searchParams.get('mode') === 'company'
          ? `${apiServer}/api/agent/${agentName}/memory/external_sources/${COLLECTION_NUMBER}/${activeCompany?.id}`
          : `${apiServer}/api/agent/${agentName}/memory/external_sources/${COLLECTION_NUMBER}`;

      const sourcesResponse = await fetch(sourcesUrl, {
        headers: { Authorization: apiKey },
      });

      if (sourcesResponse.ok) {
        const sourcesData = await sourcesResponse.json();
        const sources = sourcesData['external_sources'] || [];
        if (searchParams.get('mode') === 'company') {
          setCompanyExternalSources(Array.isArray(sources) ? sources : []);
        } else {
          setUserExternalSources(Array.isArray(sources) ? sources : []);
        }
      }
    } catch (err) {
      setError('Failed to fetch training data');
    } finally {
      setLoading(false);
    }
  };

  const handlePersonaUpdate = async () => {
    try {
      const response = await fetch(
        searchParams.get('mode') === 'company'
          ? `${apiServer}/api/agent/${agentName}/persona/${activeCompany?.id}`
          : `${apiServer}/api/agent/${agentName}/persona`,
        {
          method: 'PUT',
          headers: {
            Authorization: apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            persona: searchParams.get('mode') === 'company' ? companyPersona : userPersona,
            company_id: searchParams.get('mode') === 'company' ? activeCompany?.id : null,
            // user: searchParams.get('mode') === 'company',
          }),
        },
      );

      if (!response.ok) {
        throw new Error('Failed to update persona');
      }
      setSuccess(`Successfully updated ${searchParams.get('mode') === 'company' ? 'company' : 'user'} mandatory context`);
      await fetchCompanyData();
    } catch (err) {
      setError('Failed to update persona');
    }
  };

  const handleUploadDocument = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingDocument(true);
    setUploadProgress(0);
    setError(null);
    setSuccess(null);

    try {
      const fileString = await file.text();
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 10, 90));
      }, 200);

      const response = await fetch(
        searchParams.get('mode') === 'company'
          ? `${apiServer}/api/agent/${agentName}/learn/file/${activeCompany?.id}`
          : `${apiServer}/api/agent/${agentName}/learn/file`,
        {
          method: 'POST',
          headers: {
            Authorization: apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            file_name: file.name,
            file_content: fileString,
            collection_number: COLLECTION_NUMBER,
            company_id: searchParams.get('mode') === 'company' ? activeCompany?.id : null,
          }),
        },
      );

      clearInterval(progressInterval);

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      // Ensure 100% progress and update page
      setUploadProgress(100);
      setSuccess(`Successfully uploaded ${file.name}`);

      // Reset upload state and re-enable interactions
      await new Promise((resolve) => setTimeout(resolve, 500)); // Short delay for UX
      await fetchCompanyData(); // Refresh sources

      // Reset upload-related states
      setUploadingDocument(false);
      setUploadProgress(0);

      // Clear file input
      if (e.target) {
        e.target.value = '';
      }
    } catch (error) {
      setError('Error uploading file');
      setUploadingDocument(false);
      setUploadProgress(0);
    } finally {
      setUploadingDocument(false);
      setTimeout(() => setUploadProgress(0), 1000);
    }
  };

  // Improvements for URL learning
  const handleLearnUrl = async () => {
    if (!learnUrl || !learnUrl.startsWith('http')) {
      setError('Please enter a valid URL');
      return;
    }

    setIsLearningUrl(true);
    setUrlProgress(0);
    setError(null);
    setSuccess(null);

    try {
      const progressInterval = setInterval(() => {
        setUrlProgress((prev) => Math.min(prev + 5, 90));
      }, 500);

      const response = await fetch(
        searchParams.get('mode') === 'company'
          ? `${apiServer}/api/agent/${agentName}/learn/url/${activeCompany?.id}`
          : `${apiServer}/api/agent/${agentName}/learn/url`,
        {
          method: 'POST',
          headers: {
            Authorization: apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: learnUrl,
            collection_number: '0',
          }),
        },
      );

      clearInterval(progressInterval);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to learn from URL');
      }

      // Ensure 100% progress and update page
      setUrlProgress(100);
      setSuccess(`Successfully learned from ${learnUrl}`);

      // Short delay for UX
      await new Promise((resolve) => setTimeout(resolve, 500));
      await fetchCompanyData(); // Refresh sources

      // Reset URL learning states
      setLearnUrl(''); // Clear the URL input after success
      setIsLearningUrl(false);
      setUrlProgress(0);
    } catch (error: any) {
      setError(error.message || 'Error learning from URL');
      setIsLearningUrl(false);
      setUrlProgress(0);
    }
  };

  // Improvements for document deletion
  const handleDeleteDocument = async (source: string) => {
    try {
      setError(null);
      setSuccess(null);

      const response = await fetch(`${apiServer}/api/agent/${agentName}/memories/external_source`, {
        method: 'DELETE',
        headers: {
          Authorization: apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          external_source: source,
          collection_number: COLLECTION_NUMBER,
          company_id: searchParams.get('mode') === 'company' ? activeCompany?.id : null,
        }),
      });

      if (!response.ok) {
        throw new Error('Delete failed');
      }

      // Set success message
      setSuccess(`Successfully deleted ${source}`);

      // Short delay for UX
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Refresh the sources list
      await fetchCompanyData();
    } catch (error) {
      setError('Failed to delete document');
    }
  };

  return (
    <SidebarPage title='Training'>
      <div className='max-w-screen-lg mx-auto space-y-6'>
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <Brain className='w-5 h-5' />
              {searchParams.get('mode') === 'company' ? (company?.name ?? 'Company') + ' Agent Training' : 'Agent Training'}
            </CardTitle>
          </CardHeader>
          <CardContent className='space-y-6'>
            {/* Status Messages */}
            {error && (
              <Alert variant='destructive'>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {success && (
              <Alert>
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            )}

            {/* Mandatory Context Section */}
            <div className='space-y-4'>
              <h3 className='text-lg font-medium'>Mandatory Context</h3>
              <p className='mt-2 text-sm text-muted-foreground'>
                Think of mandatory context as your agent's permanent memory and personal instruction manual. Information
                added here is included in
                <strong> every conversation</strong>, allowing you to:
                <ul className='mt-2 ml-6 list-disc space-y-1'>
                  <li>Store information that you want the agent to remember about you or anything else</li>
                  <li>Store team contact details (emails, GitHub usernames, nicknames, etc)</li>
                  <li>Define your communication preferences</li>
                  <li>Create shortcuts for repetitive workflows</li>
                  <li>Add domain-specific knowledge unique to your needs</li>
                  <li>Customize response formats or special features (like language lessons)</li>
                </ul>
                The more specific details you provide, the more personalized and efficient your agent becomes.
              </p>
              <AutoResizeTextarea
                value={searchParams.get('mode') === 'company' ? companyPersona : userPersona}
                onChange={(e) =>
                  searchParams.get('mode') === 'company' ? setCompanyPersona(e.target.value) : setUserPersona(e.target.value)
                }
                placeholder={`Enter details your agent should always remember (team contacts, preferences, workflows, etc.)...`}
              />
              <Button
                type='button'
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handlePersonaUpdate();
                }}
                className='w-full'
              >
                Update Mandatory Context
              </Button>
            </div>

            {/* Document Upload Section */}
            <div className='space-y-4'>
              <h3 className='text-lg font-medium'>Training Documents</h3>
              <p className='mt-2 text-sm text-muted-foreground'>
                Upload documents that contain knowledge you want the AI to learn from. The AI will intelligently reference
                these documents during conversations when relevant, enhancing its responses with specific information from
                your uploads. This is great for teaching the AI about your projects, policies, or any specific knowledge
                base.
              </p>

              {/* Upload Interface */}
              <div className='flex items-center gap-4'>
                <Button
                  variant='outline'
                  className='w-full'
                  onClick={() => document.getElementById('file-upload')?.click()}
                  disabled={uploadingDocument}
                >
                  <Upload className='w-4 h-4 mr-2' />
                  Upload Document
                </Button>
                <input
                  id='file-upload'
                  type='file'
                  className='hidden'
                  onChange={handleUploadDocument}
                  accept='.pdf,.docx,.doc,.xlsx,.xls,.pptx,.ppt,.txt,.md,.jpg,.jpeg,.png,.gif'
                  disabled={uploadingDocument}
                />
              </div>

              {/* Upload Progress */}
              {uploadProgress > 0 && (
                <div className='space-y-2'>
                  <div className='flex justify-between text-sm text-muted-foreground'>
                    <span>Uploading...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} className='h-2' />
                </div>
              )}
            </div>

            {/* Learn from URL Section - Now standalone */}
            <div className='space-y-4 border-t pt-6'>
              <h3 className='text-lg font-medium'>Learn From URL</h3>
              <p className='mt-2 text-sm text-muted-foreground'>
                Extract and learn from content at a specific URL. The AI will process the webpage content and make it
                available for reference in conversations.
              </p>

              <div className='space-y-4 p-4 border rounded-md bg-background/50'>
                <div className='flex flex-col space-y-2'>
                  <label htmlFor='learn-url' className='text-sm font-medium'>
                    URL to Learn From
                  </label>
                  <Input
                    id='learn-url'
                    placeholder='https://example.com/article'
                    value={learnUrl}
                    onChange={(e) => setLearnUrl(e.target.value)}
                    disabled={isLearningUrl}
                  />
                </div>
                <Button type='button' onClick={handleLearnUrl} disabled={isLearningUrl || !learnUrl} className='w-full'>
                  {isLearningUrl ? (
                    <>Processing URL...</>
                  ) : (
                    <>
                      <PlusCircle className='w-4 h-4 mr-2' />
                      Learn from URL
                    </>
                  )}
                </Button>

                {/* URL Processing Progress */}
                {urlProgress > 0 && (
                  <div className='space-y-2'>
                    <div className='flex justify-between text-sm text-muted-foreground'>
                      <span>Processing URL...</span>
                      <span>{urlProgress}%</span>
                    </div>
                    <Progress value={urlProgress} className='h-2' />
                  </div>
                )}
              </div>
            </div>

            {/* Documents List */}
            <div className='space-y-4 border-t pt-6'>
              <h3 className='text-lg font-medium'>Learned Sources</h3>
              {loading ? (
                <div className='text-center text-muted-foreground'>Loading documents...</div>
              ) : (searchParams.get('mode') === 'company' ? companyExternalSources : userExternalSources).length === 0 ? (
                <div className='text-center text-muted-foreground'>No documents uploaded yet</div>
              ) : (
                <div className='grid gap-2'>
                  {(searchParams.get('mode') === 'company' ? companyExternalSources : userExternalSources).map((source) => (
                    <SourceDisplay key={source} source={source} onDelete={handleDeleteDocument} />
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </SidebarPage>
  );
}
