import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Avatar,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  Paper,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  AlertTriangle,
  ArrowRight,
  BarChart2,
  Bot,
  Briefcase,
  Check,
  CheckCheck,
  ChevronDown,
  Clock,
  Compass,
  FileSpreadsheet,
  FileText,
  FolderGit2,
  HelpCircle,
  IndianRupee,
  Layers,
  Paperclip,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  StopCircle,
  User,
  Users,
  Zap,
} from 'lucide-react';
import { ExpenseIntelligenceResponseRenderer } from '../../components/Intelligence/ExpenseIntelligenceResponseRenderer';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../services/api';
import {
  IntelligenceContextData,
  IntelligenceResponse,
  IntelligenceSuggestion,
} from '../../types';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  timestamp: string;
  response?: IntelligenceResponse;
  trace_id?: string;
}

export const ExpenseIntelligencePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, login } = useAuth();
  const isFinance = user?.role === 'Finance Controller';

  // State: Initial messages are strictly empty (No dummy data or pre-generated responses)
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentStage, setCurrentStage] = useState<string>('');
  const [suggestions, setSuggestions] = useState<IntelligenceSuggestion[]>([]);
  const [contextData, setContextData] = useState<IntelligenceContextData | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, currentStage]);

  // Load live suggestions & context on mount / persona change
  useEffect(() => {
    loadSuggestionsAndContext();
    // Reset conversation feed when switching users/persona so clean slate is maintained
    setMessages([]);
  }, [user]);

  const loadSuggestionsAndContext = async () => {
    try {
      const [suggs, ctx] = await Promise.all([
        api.getIntelligenceSuggestions(),
        api.getIntelligenceContext(),
      ]);
      setSuggestions(suggs);
      setContextData(ctx);
    } catch (e) {
      console.error('Failed to load intelligence initial data', e);
    }
  };

  const handleSendMessage = async (queryText?: string) => {
    const text = queryText || inputValue;
    if (!text.trim() || loading) return;

    const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsgId = `user-${Date.now()}`;
    const newUserMsg: ChatMessage = {
      id: userMsgId,
      sender: 'user',
      content: text,
      timestamp: timeString,
    };

    setMessages((prev) => [...prev, newUserMsg]);
    if (!queryText) setInputValue('');
    setLoading(true);
    setCurrentStage('Understanding your question...');

    // Set up AbortController for stop button
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      // Use SSE Streaming for real-time Copilot stage progression
      const token = localStorage.getItem('filemate_token');
      const response = await fetch('/api/intelligence/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: text,
          conversation_id: conversationId,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let finalResult: IntelligenceResponse | null = null;

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.trim()) continue;
            const eventMatch = line.match(/^event:\s*(\w+)/);
            const dataMatch = line.match(/data:\s*(.+)$/m);

            if (eventMatch && dataMatch) {
              const eventName = eventMatch[1];
              try {
                const data = JSON.parse(dataMatch[1]);
                if (data.stage_label || data.message) {
                  setCurrentStage(data.stage_label || data.message);
                }

                if (eventName === 'response_completed' || eventName === 'agent_blocked') {
                  finalResult = data as IntelligenceResponse;
                }
              } catch (err) {
                console.error('Error parsing SSE data', err);
              }
            }
          }
        }
      }

      // If SSE did not yield a final response object, fallback to direct POST
      if (!finalResult) {
        finalResult = await api.askIntelligenceChat(text, conversationId || undefined);
      }

      const asstTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const newAsstMsg: ChatMessage = {
        id: `asst-${Date.now()}`,
        sender: 'assistant',
        content: finalResult.answer || 'Query completed.',
        timestamp: asstTime,
        response: finalResult,
        trace_id: finalResult.trace_id,
      };

      setMessages((prev) => [...prev, newAsstMsg]);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('Query aborted by user');
      } else {
        console.error('Intelligence query failed', err);
        // Fallback directly to non-streaming endpoint
        try {
          const fallbackRes = await api.askIntelligenceChat(text, conversationId || undefined);
          const asstTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          setMessages((prev) => [
            ...prev,
            {
              id: `asst-${Date.now()}`,
              sender: 'assistant',
              content: fallbackRes.answer,
              timestamp: asstTime,
              response: fallbackRes,
              trace_id: fallbackRes.trace_id,
            },
          ]);
        } catch (e2: any) {
          const asstTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          setMessages((prev) => [
            ...prev,
            {
              id: `asst-err-${Date.now()}`,
              sender: 'assistant',
              content:
                e2.response?.data?.detail ||
                'Unable to retrieve expense intelligence. Please check permissions or try again.',
              timestamp: asstTime,
            },
          ]);
        }
      }
    } finally {
      setLoading(false);
      setCurrentStage('');
      abortControllerRef.current = null;
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setLoading(false);
      setCurrentStage('');
    }
  };

  const getSuggestionIcon = (iconName: string) => {
    switch (iconName) {
      case 'user':
        return <User size={15} color="#2563EB" />;
      case 'layers':
        return <Layers size={15} color="#2563EB" />;
      case 'file':
        return <FileText size={15} color="#2563EB" />;
      case 'alert':
        return <AlertTriangle size={15} color="#D97706" />;
      case 'clock':
        return <Clock size={15} color="#2563EB" />;
      default:
        return <Sparkles size={15} color="#2563EB" />;
    }
  };

  const initials = user?.full_name
    ? user.full_name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
    : 'RM';

  const firstName = user?.full_name ? user.full_name.split(' ')[0] : 'there';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)' }}>
      {/* 1. Header Bar */}
      <Box
        sx={{
          pb: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #E2E8F0',
          flexShrink: 0,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: 2,
              background: 'linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)',
            }}
          >
            <Sparkles size={20} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800, color: '#0F172A', lineHeight: 1.2 }}>
              Expense Intelligence Copilot
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748B', fontSize: '0.8rem' }}>
              Ask anything about expenses, policies, projects, or consultants. Get secure, data-backed answers and insights.
            </Typography>
          </Box>
        </Box>

        {/* Top Right Action */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Button
            size="small"
            variant="outlined"
            onClick={() => setMessages([])}
            startIcon={<RotateCcw size={14} />}
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.8rem',
              borderColor: '#CBD5E1',
              color: '#64748B',
              bgcolor: '#FFFFFF',
              px: 1.5,
              py: 0.5,
              '&:hover': { bgcolor: '#F8FAFC', color: '#0F172A', borderColor: '#94A3B8' },
            }}
          >
            New Conversation
          </Button>
        </Box>
      </Box>

      {/* 2. Main 2-Column Body (Left: Chat Stream, Right: Context Panel) */}
      <Box sx={{ display: 'flex', flexGrow: 1, overflow: 'hidden', pt: 2, gap: 2.5 }}>
        {/* CENTER / LEFT CHAT AREA */}
        <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0 }}>
          {/* Try Asking Bar (Quick horizontal chips on top) */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.25,
              pb: 2,
              overflowX: 'auto',
              flexShrink: 0,
              '&::-webkit-scrollbar': { height: 4 },
              '&::-webkit-scrollbar-thumb': { bgcolor: '#CBD5E1', borderRadius: 2 },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexShrink: 0 }}>
              <Sparkles size={16} color="#475569" />
              <Typography variant="body2" sx={{ fontWeight: 700, color: '#1E293B', fontSize: '0.83rem' }}>
                Try asking:
              </Typography>
            </Box>

            {suggestions.slice(0, 4).map((sug, idx) => (
              <Button
                key={idx}
                size="small"
                variant="outlined"
                onClick={() => handleSendMessage(sug.prompt)}
                startIcon={getSuggestionIcon(sug.icon)}
                sx={{
                  flexShrink: 0,
                  textTransform: 'none',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  bgcolor: '#FFFFFF',
                  borderColor: '#E2E8F0',
                  color: '#334155',
                  borderRadius: 2,
                  py: 0.6,
                  px: 1.25,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                  '&:hover': {
                    bgcolor: '#F8FAFC',
                    borderColor: '#2563EB',
                    color: '#2563EB',
                  },
                }}
              >
                {sug.label}
              </Button>
            ))}
          </Box>

          {/* Messages & Questions Launcher Container */}
          <Box
            sx={{
              flexGrow: 1,
              overflowY: 'auto',
              pr: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: 3,
            }}
          >
            {/* If no questions asked yet: Show clean Prepopulated Questions Launcher (Zero dummy responses) */}
            {messages.length === 0 && (
              <Box sx={{ my: 'auto', py: 4, maxWidth: 840, mx: 'auto', width: '100%' }}>
                {/* Hero Greeting Box */}
                <Box sx={{ textAlign: 'center', mb: 4 }}>
                  <Box
                    sx={{
                      width: 52,
                      height: 52,
                      borderRadius: 3,
                      background: 'linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)',
                      color: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mx: 'auto',
                      mb: 2,
                      boxShadow: '0 4px 14px rgba(37, 99, 235, 0.3)',
                    }}
                  >
                    <Sparkles size={28} />
                  </Box>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: '#0F172A', mb: 1 }}>
                    How can I help with your expense intelligence, {firstName}?
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#64748B', maxWidth: 620, mx: 'auto', lineHeight: 1.5 }}>
                    {isFinance
                      ? 'Ask questions about consultant spending trends, project budget utilizations, policy exceptions, or audit trails. Choose a prepopulated question below from live company data, or enter your own query.'
                      : 'Ask questions about your submitted expenses, project budget allocations, or reimbursement policies. Choose a question below based on your actual submissions, or enter your own query.'}
                  </Typography>
                </Box>

                {/* Prepopulated Questions Cards Grid (Real dynamic questions from SQLite) */}
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                    gap: 2,
                  }}
                >
                  {suggestions.map((sug, idx) => (
                    <Card
                      key={idx}
                      elevation={0}
                      onClick={() => handleSendMessage(sug.prompt)}
                      sx={{
                        p: 2.25,
                        borderRadius: 3,
                        border: '1px solid #E2E8F0',
                        bgcolor: '#FFFFFF',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                        '&:hover': {
                          borderColor: '#2563EB',
                          bgcolor: '#F8FAFC',
                          boxShadow: '0 4px 12px rgba(37, 99, 235, 0.08)',
                          transform: 'translateY(-2px)',
                        },
                      }}
                    >
                      <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.25 }}>
                          <Box
                            sx={{
                              width: 32,
                              height: 32,
                              borderRadius: 2,
                              bgcolor: '#EFF6FF',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            {getSuggestionIcon(sug.icon)}
                          </Box>
                          {sug.category && (
                            <Chip
                              size="small"
                              label={sug.category}
                              sx={{
                                height: 20,
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                bgcolor: '#F1F5F9',
                                color: '#475569',
                                borderRadius: 1.5,
                              }}
                            />
                          )}
                        </Box>
                        <Typography variant="body1" sx={{ fontWeight: 700, color: '#0F172A', fontSize: '0.92rem', mb: 0.5 }}>
                          {sug.label}
                        </Typography>
                        {sug.description && (
                          <Typography variant="body2" sx={{ color: '#64748B', fontSize: '0.78rem', lineHeight: 1.4 }}>
                            {sug.description}
                          </Typography>
                        )}
                      </Box>

                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 2, color: '#2563EB' }}>
                        <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.75rem' }}>
                          Ask Copilot
                        </Typography>
                        <ArrowRight size={13} />
                      </Box>
                    </Card>
                  ))}
                </Box>
              </Box>
            )}

            {/* When questions have been asked: Render User and Assistant messages */}
            {messages.map((msg) => {
              const isUser = msg.sender === 'user';
              return (
                <Box
                  key={msg.id}
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: isUser ? 'flex-end' : 'flex-start',
                    width: '100%',
                  }}
                >
                  {isUser ? (
                    /* User Message Bubble */
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25, maxWidth: '80%' }}>
                      <Box
                        sx={{
                          bgcolor: '#EBF3FF',
                          border: '1px solid #D0E2FF',
                          borderRadius: '16px 16px 2px 16px',
                          p: 1.75,
                          boxShadow: '0 1px 3px rgba(37, 99, 235, 0.04)',
                        }}
                      >
                        <Typography variant="body1" sx={{ color: '#0F172A', fontSize: '0.92rem', fontWeight: 500 }}>
                          {msg.content}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5, mt: 0.5 }}>
                          <Typography variant="caption" sx={{ color: '#64748B', fontSize: '0.7rem' }}>
                            {msg.timestamp}
                          </Typography>
                          <CheckCheck size={14} color="#2563EB" />
                        </Box>
                      </Box>
                      <Avatar
                        sx={{
                          width: 32,
                          height: 32,
                          bgcolor: isFinance ? '#2563EB' : '#10B981',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          flexShrink: 0,
                          mt: 0.5,
                        }}
                      >
                        {initials}
                      </Avatar>
                    </Box>
                  ) : (
                    /* Assistant Message Block */
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, width: '100%' }}>
                      <Box
                        sx={{
                          width: 34,
                          height: 34,
                          borderRadius: '50%',
                          bgcolor: '#2563EB',
                          color: '#FFFFFF',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          mt: 0.25,
                        }}
                      >
                        <Bot size={20} />
                      </Box>

                      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        {msg.response ? (
                          <ExpenseIntelligenceResponseRenderer
                            response={msg.response}
                            messageId={msg.id}
                            onFollowUpClick={(prompt) => handleSendMessage(prompt)}
                          />
                        ) : (
                          <Box
                            sx={{
                              p: 2,
                              borderRadius: 2.5,
                              bgcolor: '#FFFFFF',
                              border: '1px solid #E2E8F0',
                            }}
                          >
                            <Typography variant="body1" sx={{ color: '#1E293B', fontSize: '0.92rem', whiteSpace: 'pre-line' }}>
                              {msg.content}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', mt: 1 }}>
                              <Typography variant="caption" sx={{ color: '#94A3B8', fontSize: '0.7rem' }}>
                                {msg.timestamp}
                              </Typography>
                            </Box>
                          </Box>
                        )}
                      </Box>
                    </Box>
                  )}
                </Box>
              );
            })}

            {/* Live Copilot Stage Progression Indicator */}
            {loading && (
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, width: '100%', mt: 1 }}>
                <Box
                  sx={{
                    width: 34,
                    height: 34,
                    borderRadius: '50%',
                    bgcolor: '#2563EB',
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Bot size={20} />
                </Box>

                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    borderRadius: 2.5,
                    border: '1px solid #DBEAFE',
                    background: 'linear-gradient(135deg, #F0F6FF 0%, #FAF5FF 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    flexGrow: 1,
                  }}
                >
                  <CircularProgress size={18} sx={{ color: '#2563EB' }} />
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#1E3A8A' }}>
                      {currentStage || 'Copilot is analyzing financial records...'}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#64748B' }}>
                      Checking permissions • Selecting tools • Querying database
                    </Typography>
                  </Box>
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    onClick={handleStop}
                    startIcon={<StopCircle size={14} />}
                    sx={{ textTransform: 'none', borderRadius: 1.5, fontSize: '0.75rem' }}
                  >
                    Stop
                  </Button>
                </Paper>
              </Box>
            )}

            <div ref={messagesEndRef} />
          </Box>

          {/* Bottom Chat Input Bar */}
          <Box
            sx={{
              pt: 2,
              pb: 1,
              bgcolor: '#F8FAFC',
              borderTop: '1px solid #E2E8F0',
              flexShrink: 0,
            }}
          >
            <Paper
              elevation={0}
              component="form"
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              sx={{
                p: '4px 8px',
                display: 'flex',
                alignItems: 'center',
                borderRadius: 3,
                border: '1px solid #CBD5E1',
                bgcolor: '#FFFFFF',
                boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                '&:focus-within': {
                  borderColor: '#2563EB',
                  boxShadow: '0 0 0 3px rgba(37, 99, 235, 0.1)',
                },
              }}
            >
              <Tooltip title="Attach reference document / receipt (mock)">
                <IconButton sx={{ p: '8px', color: '#64748B' }}>
                  <Paperclip size={18} />
                </IconButton>
              </Tooltip>

              <TextField
                fullWidth
                variant="standard"
                placeholder="Ask about expenses, policies, projects, or consultants..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                disabled={loading}
                InputProps={{
                  disableUnderline: true,
                  sx: { fontSize: '0.9rem', color: '#0F172A', px: 1 },
                }}
              />

              <IconButton
                type="submit"
                disabled={!inputValue.trim() || loading}
                sx={{
                  p: '10px',
                  bgcolor: '#2563EB',
                  color: '#FFFFFF',
                  '&:hover': { bgcolor: '#1D4ED8' },
                  '&.Mui-disabled': { bgcolor: '#E2E8F0', color: '#94A3B8' },
                  borderRadius: 2.5,
                  ml: 0.5,
                }}
              >
                <Send size={16} />
              </IconButton>
            </Paper>
          </Box>
        </Box>

        {/* RIGHT CONTEXT PANEL (100% Real Database Values, No Dummy Fallbacks) */}
        <Box
          sx={{
            width: 310,
            flexShrink: 0,
            display: { xs: 'none', lg: 'flex' },
            flexDirection: 'column',
            gap: 2,
            overflowY: 'auto',
          }}
        >
          {/* Card 1: You're chatting as */}
          <Card
            elevation={0}
            sx={{
              p: 2.5,
              pb: 3,
              borderRadius: 2.5,
              border: '1px solid #E2E8F0',
              bgcolor: '#FFFFFF',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              overflow: 'visible',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <ShieldCheck size={18} color="#2563EB" />
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0F172A' }}>
                You're chatting as
              </Typography>
            </Box>

            <Chip
              label={`✦ ${user?.role || 'Finance Controller'}`}
              size="small"
              sx={{
                bgcolor: isFinance ? '#EFF6FF' : '#ECFDF5',
                color: isFinance ? '#2563EB' : '#059669',
                fontWeight: 700,
                fontSize: '0.75rem',
                border: isFinance ? '1px solid #BFDBFE' : '1px solid #A7F3D0',
                mb: 1.5,
              }}
            />

            <Typography
              variant="body2"
              sx={{
                color: '#334155',
                fontSize: '0.84rem',
                lineHeight: 1.55,
                fontWeight: 500,
                wordBreak: 'break-word',
              }}
            >
              {contextData?.persona.explanation ||
                (isFinance
                  ? 'You can view and analyze expenses for all consultants, projects, and policies.'
                  : 'You can view and analyze your own expenses, assigned projects, and policies.')}
            </Typography>
          </Card>

          {/* Card 2: Data at a Glance (From Real SQLite DB) */}
          <Card
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: 2.5,
              border: '1px solid #E2E8F0',
              bgcolor: '#FFFFFF',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <BarChart2 size={18} color="#2563EB" />
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0F172A' }}>
                Data at a Glance
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.75 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Users size={16} color="#64748B" />
                  <Typography variant="body2" sx={{ color: '#475569', fontSize: '0.82rem' }}>
                    Total Consultants
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{ fontWeight: 700, color: '#0F172A' }}>
                  {contextData ? contextData.metrics.total_consultants : '—'}
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <FolderGit2 size={16} color="#64748B" />
                  <Typography variant="body2" sx={{ color: '#475569', fontSize: '0.82rem' }}>
                    Active Projects
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{ fontWeight: 700, color: '#0F172A' }}>
                  {contextData ? contextData.metrics.active_projects : '—'}
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <FileText size={16} color="#64748B" />
                  <Typography variant="body2" sx={{ color: '#475569', fontSize: '0.82rem' }}>
                    Total Expense Reports
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{ fontWeight: 700, color: '#0F172A' }}>
                  {contextData ? contextData.metrics.total_reports : '—'}
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <IndianRupee size={16} color="#64748B" />
                  <Typography variant="body2" sx={{ color: '#475569', fontSize: '0.82rem' }}>
                    Total Spend
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{ fontWeight: 700, color: '#0F172A' }}>
                  {contextData ? contextData.metrics.total_spend_formatted : '—'}
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AlertTriangle size={16} color="#DC2626" />
                  <Typography variant="body2" sx={{ color: '#475569', fontSize: '0.82rem' }}>
                    Policy Exceptions
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{ fontWeight: 700, color: '#DC2626' }}>
                  {contextData ? contextData.metrics.policy_exceptions : '—'}
                </Typography>
              </Box>
            </Box>
          </Card>

          {/* Card 3: Quick Actions (Clickable Prompts) */}
          <Card
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: 2.5,
              border: '1px solid #E2E8F0',
              bgcolor: '#FFFFFF',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Zap size={18} color="#2563EB" />
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0F172A' }}>
                Quick Actions
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {(contextData?.quick_actions || []).map((action, idx) => (
                <Button
                  key={idx}
                  size="small"
                  variant="outlined"
                  fullWidth
                  onClick={() => handleSendMessage(action.prompt)}
                  sx={{
                    justifyContent: 'flex-start',
                    textTransform: 'none',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: '#334155',
                    borderColor: '#E2E8F0',
                    borderRadius: 2,
                    py: 1,
                    px: 1.5,
                    '&:hover': {
                      bgcolor: '#F8FAFC',
                      borderColor: '#2563EB',
                      color: '#2563EB',
                    },
                  }}
                >
                  {action.label}
                </Button>
              ))}
            </Box>
          </Card>
        </Box>
      </Box>
    </Box>
  );
};
