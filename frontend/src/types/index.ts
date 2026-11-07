export interface User {
  id: string;
  email: string;
  full_name: string;
  employee_id: string;
  role: string;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface ExpenseExtraction {
  date: string;
  merchant: string;
  category: string;
  amount: number;
  currency: string;
  project_code: string;
  notes?: string;
  justification?: string;
  receipt_path?: string;
}

export interface PendingAction {
  id: string;
  trace_id: string;
  employee_id: string;
  action_type: string;
  tool_name: string;
  exact_payload: Record<string, any>;
  payload_hash: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXECUTED' | 'EXPIRED' | 'INVALIDATED' | 'FAILED';
  exception_flag: boolean;
  policy_violation_details?: string;
  justification?: string;
  rejection_reason?: string;
  execution_result?: Record<string, any>;
  created_at: string;
  expires_at: string;
  approved_at?: string;
  rejected_at?: string;
  executed_at?: string;
}

export interface ChatResponse {
  trace_id: string;
  agent_message: string;
  extracted_expense?: ExpenseExtraction;
  extracted_data?: Record<string, any>;
  pending_action?: PendingAction;
  policy_status: 'compliant' | 'exception' | 'violation' | 'none';
  policy_message?: string;
  duplicate_warning?: string;
  status: 'Approved' | 'Pending' | 'Rejected' | 'Failed' | 'Blocked' | 'Out of Scope' | 'Guardrail' | 'AwaitingProject';
  thought_time_seconds?: number;
  report_id?: string;
  receipt_filename?: string;
  receipt_path?: string;
  needs_project_selection?: boolean;
  available_projects?: Array<{ code: string; name: string }>;
}

export interface TimelineStep {
  step_number: number;
  title: string;
  description: string;
  timestamp: string;
  status: 'success' | 'failed' | 'pending' | 'info';
  latency_ms?: number;
}

export interface ToolCall {
  id: string;
  tool_name: string;
  input_arguments?: Record<string, any>;
  output_result?: Record<string, any>;
  status: string;
  latency_ms: number;
  created_at: string;
}

export interface LLMCall {
  id: string;
  provider: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  latency_ms: number;
  success: boolean;
  error_message?: string;
  created_at: string;
}

export interface AgentRunSummary {
  trace_id: string;
  request_text: string;
  status: string;
  module?: string;
  intent?: string;
  created_at: string;
  latency_ms?: number;
  total_tokens: number;
  employee_id: string;
  report_id?: string;
}

export interface AgentRunDetail {
  trace_id: string;
  employee_id: string;
  request_text: string;
  status: string;
  module?: string;
  intent?: string;
  created_at: string;
  start_time: string;
  end_time?: string;
  latency_ms?: number;
  total_tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
  outcome_summary?: string;
  report_id?: string;
  extracted_data?: Record<string, any>;
  timeline: TimelineStep[];
  tool_calls: ToolCall[];
  llm_calls: LLMCall[];
  pending_actions: PendingAction[];
}

export interface ExpensePolicy {
  id: string;
  category: string;
  limit_amount?: number;
  limit_type: string;
  rule_description: string;
  currency: string;
}

export interface LLMSettings {
  active_provider: string;
  openai_configured: boolean;
  openai_model: string;
  azure_configured: boolean;
  azure_model: string;
  azure_endpoint_configured: boolean;
  app_version: string;
}

export interface ExpenseLineItem {
  id: string;
  report_id: string;
  date: string;
  merchant: string;
  category: string;
  amount: number;
  currency: string;
  project_code: string;
  notes?: string;
  exception_flag: boolean;
  justification?: string;
  receipt_path?: string;
  created_at: string;
}

export interface ExpenseReportSummaryItem {
  id: string;
  report_number: string;
  employee_id: string;
  employee_name?: string;
  status: string;
  total_amount: number;
  currency: string;
  created_at: string;
  submitted_at?: string;
  approved_by?: string;
  approved_at?: string;
  finance_notes?: string;
  lines_count: number;
  project_codes: string[];
  has_exception: boolean;
  trace_id?: string;
}

export interface PaginatedExpenseReports {
  items: ExpenseReportSummaryItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface ExpenseReportDetail {
  id: string;
  report_number: string;
  employee_id: string;
  employee_name?: string;
  employee_email?: string;
  status: string;
  total_amount: number;
  currency: string;
  created_at: string;
  submitted_at?: string;
  approved_by?: string;
  approved_at?: string;
  finance_notes?: string;
  lines: ExpenseLineItem[];
  trace_id?: string;
  project_details?: {
    code: string;
    name: string;
    status: string;
    budget_remaining: number;
  };
}

export interface FinanceQueueItem {
  id: string;
  report_number: string;
  employee_id: string;
  employee_name?: string;
  employee_email?: string;
  status: string;
  total_amount: number;
  currency: string;
  submitted_at?: string;
  created_at: string;
  lines_count: number;
  project_codes: string[];
  has_exception: boolean;
  is_high_value: boolean;
  trace_id?: string;
}

export interface FinanceAnalytics {
  total_pending_liability: number;
  pending_count: number;
  total_approved_spend: number;
  approved_count: number;
  total_rejected_spend: number;
  rejected_count: number;
  exception_count: number;
  high_value_count: number;
  spend_by_category: Record<string, number>;
  spend_by_project: Record<string, number>;
}

export interface ProjectExpenseItem {
  id: string;
  report_id: string;
  report_number: string;
  employee_id: string;
  employee_name?: string;
  date: string;
  merchant: string;
  category: string;
  amount: number;
  currency: string;
  notes?: string;
  exception_flag: boolean;
  justification?: string;
  status: string;
}

export interface ProjectPortalItem {
  code: string;
  name: string;
  status: string;
  initial_budget: number;
  budget_remaining: number;
  total_billed: number;
  burn_percentage: number;
  expense_count: number;
  client: string;
  billing_guidelines: string;
  description: string;
  expenses: ProjectExpenseItem[];
}

export interface ProjectCreateInput {
  code: string;
  name: string;
  status?: string;
  initial_budget: number;
  client?: string;
  billing_guidelines?: string;
  description?: string;
}

// ----------------------------------------------------
// EXPENSE INTELLIGENCE COPILOT TYPES
// ----------------------------------------------------

export interface SummaryCardItem {
  label: string;
  value: string | number;
  icon?: string;
  color?: string;
  subtext?: string;
}

export interface ChartDataItem {
  name: string;
  value: number;
  percentage?: number;
  color?: string;
  [key: string]: any;
}

export interface PolicyCheckItem {
  label: string;
  status: 'passed' | 'failed' | 'warning';
  note?: string;
}

export interface TableColumn {
  key: string;
  label: string;
  format?: 'currency' | 'date' | 'status' | 'policy_status' | 'string' | 'number';
}

export interface IntelligenceBlock {
  block_type:
    | 'summary_cards'
    | 'donut_chart'
    | 'pie_chart'
    | 'bar_chart'
    | 'policy_exception_box'
    | 'table'
    | 'conclusion_callout';
  // block_type === 'summary_cards'
  cards?: SummaryCardItem[];
  // block_type === 'donut_chart' | 'pie_chart' | 'bar_chart'
  title?: string;
  total_amount?: string;
  data?: ChartDataItem[];
  x_key?: string;
  y_key?: string;
  // block_type === 'policy_exception_box'
  amount?: string;
  date?: string;
  merchant?: string;
  category?: string;
  checklist?: PolicyCheckItem[];
  // block_type === 'table'
  columns?: TableColumn[];
  rows?: Record<string, any>[];
  // block_type === 'conclusion_callout'
  text?: string;
  status?: 'success' | 'warning' | 'info' | 'danger';
}

export interface IntelligenceExecutionSummary {
  latency_ms: number;
  total_tokens: number;
  tool_calls_count: number;
  tools_used: string[];
  provider: string;
  model: string;
}

export interface IntelligenceResponse {
  trace_id: string;
  status: string;
  answer: string;
  response_type: string;
  blocks: IntelligenceBlock[];
  follow_up_questions?: string[];
  execution_summary?: IntelligenceExecutionSummary;
}

export interface IntelligenceSuggestion {
  label: string;
  prompt: string;
  icon: string;
  category?: string;
  description?: string;
}

export interface IntelligenceContextData {
  persona: {
    name: string;
    employee_id: string;
    role: string;
    explanation: string;
  };
  metrics: {
    total_consultants: number;
    active_projects: number;
    total_reports: number;
    total_spend_formatted: string;
    total_spend_raw: number;
    policy_exceptions: number;
  };
  quick_actions: {
    label: string;
    prompt: string;
  }[];
}

export interface IntelligenceMessageItem {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  response_type?: string;
  blocks?: IntelligenceBlock[];
  trace_id?: string;
  follow_up_questions?: string[];
  execution_summary?: IntelligenceExecutionSummary;
  created_at: string;
}

export interface IntelligenceConversationItem {
  id: string;
  title: string;
  persona: string;
  created_at: string;
  updated_at: string;
  message_count: number;
}

