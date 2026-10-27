/**
 * DevResolve Frontend API Client
 * Handles HTTP requests, Supabase JWT bearer injection, and SSE stream consumption.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export interface Project {
  id: string;
  name: string;
  description?: string;
  slug: string;
  incident_count: number;
  open_incident_count: number;
  last_activity_at?: string;
  created_at: string;
}

export interface Conversation {
  id: string;
  project_id: string;
  creator_id: string;
  title: string;
  status: string;
  severity: string;
  message_count: number;
  last_message_at?: string;
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  sender_display_name: string;
  content: string;
  content_type: string;
  sequence_number: number;
  metadata?: Record<string, any>;
  created_at: string;
}

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Network error' }));
      throw new Error(errorData.detail || `Request failed with status ${response.status}`);
    }

    return response.json();
  }

  // Health
  async checkHealth(): Promise<{ status: string; app: string; version: string }> {
    return this.request('/health');
  }

  // Projects
  async getProjects(): Promise<{ projects: Project[]; total: number }> {
    return this.request('/projects');
  }

  async createProject(name: string, description?: string): Promise<Project> {
    return this.request('/projects', {
      method: 'POST',
      body: JSON.stringify({ name, description }),
    });
  }

  // Conversations
  async getConversations(projectId?: string): Promise<{ conversations: Conversation[] }> {
    const query = projectId ? `?project_id=${projectId}` : '';
    return this.request(`/conversations${query}`);
  }

  async createConversation(projectId: string, title?: string, initialMessage?: string): Promise<Conversation> {
    return this.request('/conversations', {
      method: 'POST',
      body: JSON.stringify({
        project_id: projectId,
        title: title || 'New Incident Investigation',
        initial_message: initialMessage,
      }),
    });
  }

  async getConversationDetail(conversationId: string): Promise<Conversation & { messages: Message[] }> {
    return this.request(`/conversations/${conversationId}`);
  }

  async postMessage(conversationId: string, content: string): Promise<Message> {
    return this.request(`/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content, content_type: 'text' }),
    });
  }

  // Stream investigation SSE
  listenInvestigationStream(
    conversationId: string,
    onEvent: (event: string, data: any) => void,
    onError?: (err: any) => void
  ): () => void {
    const url = `${API_BASE_URL}/conversations/${conversationId}/stream`;
    const eventSource = new EventSource(url);

    const eventTypes = [
      'step_update',
      'evidence_found',
      'hypothesis_ready',
      'patch_generated',
      'test_results',
      'done',
    ];

    eventTypes.forEach((type) => {
      eventSource.addEventListener(type, (e: MessageEvent) => {
        try {
          const parsed = JSON.parse(e.data);
          onEvent(type, parsed);
        } catch {
          onEvent(type, e.data);
        }
      });
    });

    eventSource.onerror = (err) => {
      if (onError) onError(err);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }
}

export const api = new ApiClient();
