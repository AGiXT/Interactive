'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cookies } from 'next/headers';

export default function ImportConversation() {
  const [file, setFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
    }
  };

  const handleImport = async () => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target?.result as string;
      const conversations = JSON.parse(content);
      await fetch(`${process.env.NEXT_PUBLIC_AGIXT_SERVER}/api/conversation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cookies().get('jwt')?.value}`,
        },
        body: JSON.stringify({
          conversation_name: `Imported_${Date.now()}`,
          conversation_content: conversations.interactions.map((i: any) => ({
            role: i.role,
            message: i.message,
          })),
        }),
      });
      window.location.reload();
    };
    reader.readAsText(file);
  };

  return (
    <div className="mb-4">
      <input type="file" accept="application/json" onChange={handleFileChange} />
      <Button onClick={handleImport} disabled={!file} className="ml-2">
        Import Conversation
      </Button>
    </div>
  );
}