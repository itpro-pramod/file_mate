import axios from 'axios';
import {
  AgentRunDetail,
  AgentRunSummary,
  AuthResponse,
  ChatResponse,
  ExpensePolicy,
  ExpenseReportDetail,
  FinanceAnalytics,
  FinanceQueueItem,
  IntelligenceContextData,
  IntelligenceConversationItem,
  IntelligenceMessageItem,
  IntelligenceResponse,
  IntelligenceSuggestion,
  LLMSettings,
  PaginatedExpenseReports,
  PendingAction,
  ProjectCreateInput,
  ProjectPortalItem,
  User,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export const apiClient = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to inject JWT Bearer Token
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('filemate_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor to catch 401
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear token and redirect to login if unauthorized
      localStorage.removeItem('filemate_token');
      localStorage.removeItem('filemate_user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export const api = {
  // Authentication
  login: async (email: string, password: string): Promise<AuthResponse> => {
    const res = await apiClient.post<AuthResponse>('/auth/login', { email, password });
    return res.data;
  },

  logout: async (): Promise<void> => {
    try {
      await apiClient.post('/auth/logout');
    } finally {
      localStorage.removeItem('filemate_token');
      localStorage.removeItem('filemate_user');
    }
  },

  getMe: async (): Promise<User> => {
    const res = await apiClient.get<User>('/auth/me');
    return res.data;
  },

  // Agent Chat
  processChat: async (message: string, traceId?: string): Promise<ChatResponse> => {
    const res = await apiClient.post<ChatResponse>('/chat', { message, trace_id: traceId });
    return res.data;
  },

  uploadReceipt: async (file: File | Blob, projectCode?: string, caption?: string, fileName?: string): Promise<ChatResponse> => {
    const formData = new FormData();
    formData.append('file', file, fileName || (file as File).name || 'receipt.png');
    if (projectCode) formData.append('project_code', projectCode);
    if (caption) formData.append('caption', caption);

    const res = await apiClient.post<ChatResponse>('/chat/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data;
  },

  getReceiptUrl: (filename: string): string => {
    if (!filename) return '';
    const cleanName = filename.split('/').pop() || filename;
    return `${API_BASE_URL}/api/expenses/receipts/${encodeURIComponent(cleanName)}`;
  },

  confirmScannedReceipt: async (params: {
    receipt_filename: string;
    project_code: string;
    merchant: string;
    category: string;
    amount: number;
    currency?: string;
    date: string;
    notes?: string;
  }): Promise<ChatResponse> => {
    const res = await apiClient.post<ChatResponse>('/chat/confirm-scanned', params);
    return res.data;
  },

  getSampleReceipts: async (): Promise<
    Array<{
      id: string;
      name: string;
      filename: string;
      format: string;
      category: string;
      amount: number;
      currency: string;
      project_hint: string;
      description: string;
    }>
  > => {
    const res = await apiClient.get('/chat/sample-receipts');
    return res.data;
  },

  getChatTrace: async (traceId: string): Promise<ChatResponse> => {
    const res = await apiClient.get<ChatResponse>(`/chat/${traceId}`);
    return res.data;
  },

  // Actions & Approval
  getPendingActions: async (): Promise<PendingAction[]> => {
    const res = await apiClient.get<PendingAction[]>('/actions/pending');
    return res.data;
  },

  getAction: async (id: string): Promise<PendingAction> => {
    const res = await apiClient.get<PendingAction>(`/actions/${id}`);
    return res.data;
  },

  approveAction: async (id: string, justification?: string): Promise<any> => {
    const res = await apiClient.post(`/actions/${id}/approve`, { justification });
    return res.data;
  },

  editAction: async (id: string, revisedData: Record<string, any>): Promise<PendingAction> => {
    const res = await apiClient.post<PendingAction>(`/actions/${id}/edit`, revisedData);
    return res.data;
  },

  rejectAction: async (id: string, reason?: string): Promise<PendingAction> => {
    const res = await apiClient.post<PendingAction>(`/actions/${id}/reject`, {
      rejection_reason: reason || 'Rejected by user',
    });
    return res.data;
  },

  // Runs & Observability
  getRuns: async (
    search?: string,
    status?: string,
    limit = 10,
    offset = 0,
    module?: string
  ): Promise<AgentRunSummary[]> => {
    const params: Record<string, any> = { limit, offset };
    if (search) params.search = search;
    if (status && status !== 'all') params.status = status;
    if (module && module !== 'all') params.module = module;
    const res = await apiClient.get<AgentRunSummary[]>('/runs', { params });
    return res.data;
  },

  getRunDetail: async (traceId: string): Promise<AgentRunDetail> => {
    const res = await apiClient.get<AgentRunDetail>(`/runs/${traceId}`);
    return res.data;
  },

  getRunLogs: async (traceId: string): Promise<any[]> => {
    const res = await apiClient.get<any[]>(`/runs/${traceId}/logs`);
    return res.data;
  },

  // Policy & Responsible AI / OWASP
  getPolicies: async (): Promise<ExpensePolicy[]> => {
    const res = await apiClient.get<ExpensePolicy[]>('/policy');
    return res.data;
  },

  getOwaspCompliance: async (): Promise<any> => {
    const res = await apiClient.get('/policy/owasp-compliance');
    return res.data;
  },

  getResponsibleAIEvaluation: async (): Promise<any> => {
    const res = await apiClient.get('/policy/responsible-ai');
    return res.data;
  },

  // Submitted Expenses
  getExpenseReports: async (
    search?: string,
    status?: string,
    limit = 10,
    offset = 0,
    projectCode?: string
  ): Promise<PaginatedExpenseReports> => {
    const params: Record<string, any> = { limit, offset };
    if (search) params.search = search;
    if (status && status !== 'all') params.status = status;
    if (projectCode && projectCode !== 'all') params.project_code = projectCode;
    const res = await apiClient.get<PaginatedExpenseReports>('/expenses/reports', { params });
    return res.data;
  },

  getExpenseReportDetail: async (reportIdentifier: string): Promise<ExpenseReportDetail> => {
    const res = await apiClient.get<ExpenseReportDetail>(`/expenses/reports/${reportIdentifier}`);
    return res.data;
  },

  // Projects Portal (Option A)
  getProjectsPortal: async (): Promise<ProjectPortalItem[]> => {
    const res = await apiClient.get<ProjectPortalItem[]>('/projects');
    return res.data;
  },

  getProjectDetail: async (code: string): Promise<ProjectPortalItem> => {
    const res = await apiClient.get<ProjectPortalItem>(`/projects/${code}`);
    return res.data;
  },

  toggleProjectStatus: async (code: string): Promise<ProjectPortalItem> => {
    const res = await apiClient.post<ProjectPortalItem>(`/projects/${code}/toggle-status`);
    return res.data;
  },

  createProject: async (data: ProjectCreateInput): Promise<ProjectPortalItem> => {
    const res = await apiClient.post<ProjectPortalItem>('/projects', data);
    return res.data;
  },

  // Finance Persona Specific
  getFinanceQueue: async (): Promise<FinanceQueueItem[]> => {
    const res = await apiClient.get<FinanceQueueItem[]>('/expenses/finance/queue');
    return res.data;
  },

  submitFinanceDecision: async (
    reportIdentifier: string,
    decision: 'approved' | 'rejected',
    notes?: string
  ): Promise<ExpenseReportDetail> => {
    const res = await apiClient.post<ExpenseReportDetail>(
      `/expenses/reports/${reportIdentifier}/finance-decision`,
      { decision, notes }
    );
    return res.data;
  },

  getFinanceAnalytics: async (): Promise<FinanceAnalytics> => {
    const res = await apiClient.get<FinanceAnalytics>('/expenses/finance/analytics');
    return res.data;
  },

  // Settings
  getLLMSettings: async (): Promise<LLMSettings> => {
    const res = await apiClient.get<LLMSettings>('/settings/llm');
    return res.data;
  },

  updateLLMSettings: async (provider: string): Promise<LLMSettings> => {
    const res = await apiClient.put<LLMSettings>('/settings/llm', { provider });
    return res.data;
  },

  checkLLMHealth: async (): Promise<any> => {
    const res = await apiClient.post('/settings/llm/health');
    return res.data;
  },

  // Expense Intelligence Copilot
  askIntelligenceChat: async (
    message: string,
    conversationId?: string,
    traceId?: string
  ): Promise<IntelligenceResponse> => {
    const res = await apiClient.post<IntelligenceResponse>('/intelligence/chat', {
      message,
      conversation_id: conversationId,
      trace_id: traceId,
    });
    return res.data;
  },

  getIntelligenceSuggestions: async (): Promise<IntelligenceSuggestion[]> => {
    const res = await apiClient.get<IntelligenceSuggestion[]>('/intelligence/suggestions');
    return res.data;
  },

  getIntelligenceContext: async (): Promise<IntelligenceContextData> => {
    const res = await apiClient.get<IntelligenceContextData>('/intelligence/context');
    return res.data;
  },

  getIntelligenceConversations: async (): Promise<IntelligenceConversationItem[]> => {
    const res = await apiClient.get<IntelligenceConversationItem[]>('/intelligence/conversations');
    return res.data;
  },

  createIntelligenceConversation: async (
    title?: string
  ): Promise<{ id: string; title: string; persona: string }> => {
    const params = title ? { title } : {};
    const res = await apiClient.post('/intelligence/conversations', null, { params });
    return res.data;
  },

  getIntelligenceConversationHistory: async (
    conversationId: string
  ): Promise<{ conversation: { id: string; title: string }; messages: IntelligenceMessageItem[] }> => {
    const res = await apiClient.get(`/intelligence/conversations/${conversationId}`);
    return res.data;
  },

  deleteIntelligenceConversation: async (conversationId: string): Promise<void> => {
    await apiClient.delete(`/intelligence/conversations/${conversationId}`);
  },

  submitIntelligenceFeedback: async (
    messageId: string,
    traceId: string,
    rating: 'thumbs_up' | 'thumbs_down',
    comment?: string
  ): Promise<void> => {
    await apiClient.post('/intelligence/feedback', {
      message_id: messageId,
      trace_id: traceId,
      rating,
      comment,
    });
  },
};
