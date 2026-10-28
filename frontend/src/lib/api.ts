/**
 * DevResolve Frontend API Client
 * Handles HTTP requests, JWT token bearer injection, and SSE stream consumption.
 */

function normalizeApiBaseUrl(): string {
  let url = (import.meta.env.VITE_API_URL || 'http://localhost:8000/api').trim();
  while (url.endsWith('/')) {
    url = url.slice(0, -1);
  }
  if (!url.endsWith('/api')) {
    url = `${url}/api`;
  }
  return url;
}

export const API_BASE_URL = normalizeApiBaseUrl();

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
  project_name?: string;
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

export interface Integration {
  id: string;
  name: string;
  category: 'vcs' | 'monitoring' | 'cicd' | 'chat';
  description: string;
  status: 'connected' | 'disconnected' | 'syncing';
  lastSync?: string;
  iconBg: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'alert' | 'success' | 'info';
  time: string;
  read: boolean;
  actionUrl?: string;
}

export interface Ticket {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  created_at: string;
  estimated_resolution: string;
  assigned_team: string;
  user_email?: string;
  metadata?: Record<string, any>;
}

class ApiClient {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem('devresolve_token');
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('devresolve_token', token);
    } else {
      localStorage.removeItem('devresolve_token');
    }
  }

  getToken(): string | null {
    return this.token;
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
      if (response.status === 401) {
        const errorData = await response.json().catch(() => ({ detail: 'Unauthorized' }));
        const detail = errorData.detail || 'Unauthorized';
        if (typeof detail === 'string' && (detail.toLowerCase().includes('token') || detail.toLowerCase().includes('expired') || detail.toLowerCase().includes('subject'))) {
          this.setToken(null);
        }
        throw new Error(detail);
      }
      const errorData = await response.json().catch(() => ({ detail: 'Network error' }));
      throw new Error(errorData.detail || `Request failed with status ${response.status}`);
    }

    return response.json();
  }

  // Auth
  async login(email: string, password: string):Promise<{ access_token: string; user: any }> {
    const res = await this.request<{ access_token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(res.access_token);
    return res;
  }

  async register(email: string, password: string, displayName?: string): Promise<{ access_token: string; user: any }> {
    const res = await this.request<{ access_token: string; user: any }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, display_name: displayName }),
    });
    this.setToken(res.access_token);
    return res;
  }

  async requestSignupOtp(email: string, password: string, displayName?: string): Promise<{ status: string; message: string; email: string }> {
    return this.request<{ status: string; message: string; email: string }>('/auth/signup/request-otp', {
      method: 'POST',
      body: JSON.stringify({ email, password, display_name: displayName }),
    });
  }

  async verifySignupOtp(email: string, otp: string): Promise<{ access_token: string; user: any }> {
    const res = await this.request<{ access_token: string; user: any }>('/auth/signup/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ email, otp }),
    });
    this.setToken(res.access_token);
    return res;
  }

  async resendSignupOtp(email: string): Promise<{ status: string; message: string; email: string }> {
    return this.request<{ status: string; message: string; email: string }>('/auth/signup/resend-otp', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async oauthLogin(provider: 'github' | 'google', email?: string, displayName?: string): Promise<{ access_token: string; user: any }> {
    const res = await this.request<{ access_token: string; user: any }>('/auth/oauth', {
      method: 'POST',
      body: JSON.stringify({ provider, email, display_name: displayName }),
    });
    this.setToken(res.access_token);
    return res;
  }

  async forgotPassword(email: string): Promise<{ status: string; message: string }> {
    return this.request<{ status: string; message: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async verifyResetToken(token: string): Promise<{ valid: boolean; email?: string }> {
    return this.request<{ valid: boolean; email?: string }>(`/auth/verify-reset-token?token=${encodeURIComponent(token)}`);
  }

  async resetPassword(token: string, newPassword: string): Promise<{ status: string; message: string }> {
    return this.request<{ status: string; message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, new_password: newPassword }),
    });
  }

  async getProfile(): Promise<any> {
    return this.request('/auth/me');
  }

  // Health
  async checkHealth(): Promise<{ status: string; service: string; version: string }> {
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
  async getConversations(projectId?: string): Promise<{ conversations: Conversation[]; total: number }> {
    const query = projectId ? `?project_id=${projectId}` : '';
    return this.request(`/conversations${query}`);
  }

  async createConversation(
    projectId?: string,
    title?: string,
    initialMessage?: string,
    projectName?: string
  ): Promise<Conversation> {
    const validProjectId =
      projectId && projectId !== 'undefined' && projectId !== 'null' && projectId.trim() !== ''
        ? projectId.trim()
        : null;

    return this.request('/conversations', {
      method: 'POST',
      body: JSON.stringify({
        project_id: validProjectId,
        project_name: projectName,
        title: title || 'New Incident Investigation',
        initial_message: initialMessage,
      }),
    });
  }

  async getConversationDetail(conversationId: string): Promise<Conversation & { messages: Message[] }> {
    return this.request(`/conversations/${conversationId}`);
  }

  async deleteConversation(conversationId: string): Promise<void> {
    await this.request(`/conversations/${conversationId}`, {
      method: 'DELETE',
    });
  }

  async postMessage(
    conversationId: string,
    content: string,
    role: string = 'user',
    metadata?: any
  ): Promise<Message> {
    return this.request(`/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content, role, content_type: 'text', metadata }),
    });
  }

  // Integrations & MCP
  async getIntegrations(): Promise<Integration[]> {
    return this.request('/integrations');
  }

  async connectIntegration(platformId: string, credentials: Record<string, any>): Promise<Integration> {
    return this.request(`/integrations/${platformId}/connect`, {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  }

  async disconnectIntegration(platformId: string): Promise<Integration> {
    return this.request(`/integrations/${platformId}/disconnect`, {
      method: 'POST',
    });
  }

  async toggleIntegration(platformId: string): Promise<Integration> {
    return this.request(`/integrations/${platformId}/toggle`, { method: 'POST' });
  }

  async syncIntegration(platformId: string): Promise<Integration> {
    return this.request(`/integrations/${platformId}/sync`, { method: 'POST' });
  }

  async syncAllIntegrations(): Promise<{ status: string; synced_count: number; message: string }> {
    return this.request('/integrations/sync-all', { method: 'POST' });
  }

  async executeMcpTool(toolName: string, toolArguments: Record<string, any> = {}): Promise<any> {
    return this.request('/integrations/mcp/execute', {
      method: 'POST',
      body: JSON.stringify({ tool_name: toolName, arguments: toolArguments }),
    });
  }

  async getMcpManifest(): Promise<any> {
    return this.request('/integrations/mcp/manifest');
  }

  // GitHub MCP Repository Explorer
  async getGitHubRepos(): Promise<{ user: any; total: number; repos: any[] }> {
    return this.request('/integrations/github/repos');
  }

  async getGitHubBranches(repo: string): Promise<{ repo: string; branches: string[] }> {
    return this.request(`/integrations/github/branches?repo=${encodeURIComponent(repo)}`);
  }

  async importGitHubProject(
    repo: string,
    branch: string = 'main',
    projectName?: string
  ): Promise<{
    status: string;
    project_id: string;
    project_name: string;
    repository: string;
    branch: string;
    files_downloaded: number;
    ast_chunks_indexed: number;
    total_rag_chunks: number;
  }> {
    return this.request('/integrations/github/import-project', {
      method: 'POST',
      body: JSON.stringify({ repo, branch, project_name: projectName }),
    });
  }

  // AI & BYOK Settings
  async getAISettings(): Promise<{
    provider: string;
    model: string;
    has_key: boolean;
    masked_key: string;
    supported_models: Record<string, Array<{ id: string; name: string; context: string }>>;
    custom_endpoint: string;
    free_tier_tokens_used?: number;
    free_tier_limit?: number;
    is_free_tier?: boolean;
    free_tier_exceeded?: boolean;
    fallback_available?: boolean;
    fallback_provider?: string;
    provider_status?: {
      provider: string;
      status: 'healthy' | 'temporarily_rate_limited' | 'quota_exhausted';
      label: string;
      limit_type: string;
      is_rate_limited: boolean;
      is_exhausted: boolean;
      retry_after_seconds: number;
      message: string;
      recommendation?: string;
    };
    active_rate_limit_flags?: Array<{
      id: string;
      provider: string;
      model?: string;
      status_code: number;
      error_message: string;
      retry_after_seconds: number;
      recommendation: string;
    }>;
    is_current_provider_flagged?: boolean;
  }> {
    return this.request('/settings/ai');
  }

  async saveAISettings(
    provider: string,
    model: string,
    apiKey?: string,
    customEndpoint?: string
  ): Promise<any> {
    return this.request('/settings/ai', {
      method: 'POST',
      body: JSON.stringify({ provider, model, api_key: apiKey, custom_endpoint: customEndpoint }),
    });
  }

  async testAISettings(provider: string, model: string, apiKey?: string): Promise<{
    status: string;
    message: string;
    latency_ms?: number;
    rate_limit_flag?: any;
  }> {
    return this.request('/settings/ai/test', {
      method: 'POST',
      body: JSON.stringify({ provider, model, api_key: apiKey }),
    });
  }

  async getRateLimitFlags(): Promise<{
    status: string;
    has_rate_limit_raised: boolean;
    flags: Array<{
      id: string;
      provider: string;
      model?: string;
      status_code: number;
      error_message: string;
      retry_after_seconds: number;
      flagged_at: string;
      recommendation: string;
      is_active: boolean;
    }>;
  }> {
    return this.request('/settings/ai/rate-limits');
  }

  async clearRateLimitFlag(provider: string): Promise<{ status: string; cleared: boolean; message: string }> {
    return this.request('/settings/ai/rate-limits/clear', {
      method: 'POST',
      body: JSON.stringify({ provider }),
    });
  }

  async getAIStatus(): Promise<any> {
    return this.request('/settings/ai/status');
  }

  async replaceMasterGroqKey(key: string): Promise<{ status: string; message: string; masked_key?: string }> {
    return this.request('/settings/ai/master-key', {
      method: 'POST',
      body: JSON.stringify({ groq_api_key: key }),
    });
  }

  // RAG
  async queryRag(query: string, topK: number = 5): Promise<any> {
    return this.request('/rag/query', {
      method: 'POST',
      body: JSON.stringify({ query, top_k: topK }),
    });
  }

  async indexRagFile(filePath: string, content: string, retentionMode: 'temporary' | 'persistent' = 'persistent'): Promise<any> {
    return this.request('/rag/index', {
      method: 'POST',
      body: JSON.stringify({ file_path: filePath, content, retention_mode: retentionMode }),
    });
  }

  // Document Lifecycle & Storage Management
  async ingestDocument(doc: {
    name: string;
    content: string;
    retention_mode?: 'temporary' | 'persistent';
    source_type?: string;
    project_id?: string;
  }): Promise<{ status: string; document: any }> {
    return this.request('/rag/documents', {
      method: 'POST',
      body: JSON.stringify(doc),
    });
  }

  async getDocuments(projectId?: string): Promise<{
    status: string;
    total_documents: number;
    documents: Array<{
      id: string;
      name: string;
      source_type: string;
      retention_mode: 'temporary' | 'persistent';
      is_persistent: boolean;
      created_at: string;
      expires_at?: string;
      remaining_seconds?: number;
      time_remaining_label: string;
      retention_badge: string;
      file_size_bytes: number;
      chunk_count: number;
    }>;
  }> {
    const q = projectId ? `?project_id=${encodeURIComponent(projectId)}` : '';
    return this.request(`/rag/documents${q}`);
  }

  async convertDocumentToPersistent(docId: string): Promise<{ status: string; message: string; document: any }> {
    return this.request(`/rag/documents/${docId}/convert-persistent`, { method: 'POST' });
  }

  async deleteDocument(docId: string): Promise<{ status: string; message: string }> {
    return this.request(`/rag/documents/${docId}`, { method: 'DELETE' });
  }

  async triggerDocumentCleanup(): Promise<any> {
    return this.request('/rag/cleanup', { method: 'POST' });
  }

  // Notifications
  async getNotifications(): Promise<NotificationItem[]> {
    return this.request('/notifications');
  }

  async markNotificationRead(id: string): Promise<{ status: string }> {
    return this.request(`/notifications/${id}/read`, { method: 'POST' });
  }

  async markAllNotificationsRead(): Promise<{ status: string }> {
    return this.request('/notifications/read-all', { method: 'POST' });
  }

  async clearNotifications(): Promise<{ status: string }> {
    return this.request('/notifications/clear', { method: 'POST' });
  }

  // Support Tickets
  async createTicket(ticket: {
    title: string;
    description: string;
    priority?: string;
    category?: string;
    metadata?: Record<string, any>;
  }): Promise<Ticket> {
    return this.request('/tickets', {
      method: 'POST',
      body: JSON.stringify(ticket),
    });
  }

  async getTickets(): Promise<Ticket[]> {
    return this.request('/tickets');
  }

  // Ollama Health & Cloud Fallback
  async checkOllamaStatus(endpoint?: string): Promise<{
    is_installed: boolean;
    cli_path?: string;
    is_running: boolean;
    endpoint: string;
    models: string[];
    total_ram_gb: number;
    avail_ram_gb: number;
    error?: string;
    recommendation: string;
    active_provider: string;
    power_saving_active: boolean;
  }> {
    const query = endpoint ? `?endpoint=${encodeURIComponent(endpoint)}` : '';
    return this.request(`/settings/ai/ollama-status${query}`);
  }

  async switchToCloud(): Promise<{ status: string; message: string; config: any }> {
    return this.request('/settings/ai/switch-to-cloud', { method: 'POST' });
  }

  // Stream investigation SSE
  listenInvestigationStream(
    conversationId: string,
    projectName?: string,
    errorSummary?: string,
    onEvent?: (event: string, data: any) => void,
    onError?: (err: any) => void
  ): () => void {
    const params = new URLSearchParams();
    if (projectName) params.append('project_name', projectName);
    if (errorSummary) params.append('error_summary', errorSummary);

    const url = `${API_BASE_URL}/conversations/${conversationId}/stream?${params.toString()}`;
    const eventSource = new EventSource(url);

    const eventTypes = [
      'step_update',
      'evidence_found',
      'hypothesis_ready',
      'patch_generated',
      'test_results',
      'rate_limit_flag',
      'done',
    ];

    eventTypes.forEach((type) => {
      eventSource.addEventListener(type, (e: MessageEvent) => {
        try {
          const parsed = JSON.parse(e.data);
          if (onEvent) onEvent(type, parsed);
        } catch {
          if (onEvent) onEvent(type, e.data);
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
