import React from 'react';
import { Message, KnowledgeFile } from '../types';
import ChatBox from '../components/ChatBox';

interface ChatPageProps {
  messages: Message[];
  onSendMessage: (text: string) => void;
  isLoading: boolean;
  activeLlm: 'gemini' | 'local';
  workspaceFiles: KnowledgeFile[];
  fontSize: 'small' | 'medium' | 'large';
  removeResearchMode: boolean;
  onToggleResearchMode: (val: boolean) => void;
  onUploadFile: (file: { name: string; size: string; type: string; contentBase64?: string }) => void;
}

export default function ChatPage({
  messages,
  onSendMessage,
  isLoading,
  activeLlm,
  workspaceFiles,
  fontSize,
  removeResearchMode,
  onToggleResearchMode,
  onUploadFile
}: ChatPageProps) {
  return (
    <div className="flex-1 h-full flex flex-col overflow-hidden">
      <ChatBox
        messages={messages}
        onSendMessage={onSendMessage}
        isLoading={isLoading}
        activeLlm={activeLlm}
        workspaceFiles={workspaceFiles}
        fontSize={fontSize}
        removeResearchMode={removeResearchMode}
        onToggleResearchMode={onToggleResearchMode}
        onUploadFile={onUploadFile}
      />
    </div>
  );
}
