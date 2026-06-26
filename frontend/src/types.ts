export interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  sources?: string[];
  suggestions?: string[];
  route?: 'CASUAL' | 'UNRELATED' | 'WEB_SEARCH' | 'DOCUMENT' | 'VECTOR_DB';
  routingReason?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  messages: Message[];
}

export interface KnowledgeFile {
  id: string;
  name: string;
  size: string;
  type: string;
  uploadDate: string;
  status: 'Indexed' | 'Indexing' | 'Failed';
  contentBase64?: string;
}

export interface UserSettings {
  activeLlm: 'gemini' | 'local';
  activeConnections: string[]; // List of file IDs that are currently connected in RAG
  fontSize: 'small' | 'medium' | 'large';
  removeResearchMode?: boolean;
}

export interface User {
  username: string;
  profilePic?: string;
  token?: string;
}
