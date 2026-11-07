import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import {
  ArrowLeft,
  Calendar,
  CheckCircle,
  Clock,
  Coins,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileCode,
  FileSpreadsheet,
  Folder,
  MapPin,
  ShieldCheck,
  Tag,
  User,
  X,
} from 'lucide-react';
import { api } from '../../services/api';
import { AgentRunDetail } from '../../types';

export const RunDetailsPage: React.FC = () => {
  const { traceId } = useParams<{ traceId: string }>();
  const navigate = useNavigate();

  const [detail, setDetail] = useState<AgentRunDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tabIndex, setTabIndex] = useState(0);
  const [isRawDataOpen, setIsRawDataOpen] = useState(false);

  useEffect(() => {
    if (traceId) {
      fetchDetail(traceId);
    }
  }, [traceId]);

  const fetchDetail = async (id: string) => {
    setLoading(true);
    try {
      const data = await api.getRunDetail(id);
      setDetail(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyTrace = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Trace ID copied to clipboard!');
  };

  const handleDownloadLogs = async () => {
    if (!traceId) return;
    try {
      const logs = await api.getRunLogs(traceId);
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(logs, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `run-log-${traceId}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (e) {
      alert('Failed to download JSON log.');
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress size={36} />
      </Box>
    );
  }

  if (!detail) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h6" color="error">Run details not found for {traceId}</Typography>
        <Button variant="outlined" sx={{ mt: 2 }} onClick={() => navigate('/runs')}>
          Back to Runs
        </Button>
      </Box>
    );
  }

  const dateStr = new Date(detail.created_at).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const estimatedCost = (detail.prompt_tokens * 0.00000015 + detail.completion_tokens * 0.0000006).toFixed(4);

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto' }}>
      {/* Back Link */}
      <Button
        startIcon={<ArrowLeft size={16} />}
        onClick={() => navigate('/runs')}
        sx={{ color: '#2563EB', fontWeight: 600, mb: 1, p: 0, textTransform: 'none' }}
      >
        Back to Runs
      </Button>

      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: '#0F172A', mb: 0.5 }}>
            Run Details
          </Typography>
          <Typography variant="body1" sx={{ color: '#64748B' }}>
            Complete view of the agent run, including tool calls, guardrails, approvals and logs.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Button
            variant="outlined"
            startIcon={<Download size={16} />}
            onClick={handleDownloadLogs}
            sx={{ borderRadius: 2, fontWeight: 600 }}
          >
            Download Log (JSON)
          </Button>
          <Button
            variant="outlined"
            startIcon={<Eye size={16} />}
            onClick={() => setIsRawDataOpen(true)}
            sx={{ borderRadius: 2, fontWeight: 600 }}
          >
            View Raw Data
          </Button>
        </Box>
      </Box>

      {/* Summary Banner Bar */}
      <Card sx={{ p: 2.5, mb: 3.5, borderRadius: 3, border: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="caption" sx={{ color: '#94A3B8', fontWeight: 600 }}>TRACE ID</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600, color: '#0F172A' }}>
              {detail.trace_id}
            </Typography>
            <IconButton size="small" onClick={() => handleCopyTrace(detail.trace_id)}>
              <Copy size={14} color="#94A3B8" />
            </IconButton>
          </Box>
        </Box>

        <Box>
          <Typography variant="caption" sx={{ color: '#94A3B8', fontWeight: 600 }}>MODULE</Typography>
          <Box sx={{ mt: 0.2 }}>
            <Chip
              label={detail.module === 'EXPENSE_INTELLIGENCE' ? '✨ Expense Intelligence' : '🤖 Expense Assistant'}
              size="small"
              sx={{
                bgcolor: detail.module === 'EXPENSE_INTELLIGENCE' ? '#EFF6FF' : '#F1F5F9',
                color: detail.module === 'EXPENSE_INTELLIGENCE' ? '#2563EB' : '#475569',
                fontWeight: 700,
              }}
            />
          </Box>
        </Box>

        <Box>
          <Typography variant="caption" sx={{ color: '#94A3B8', fontWeight: 600 }}>STATUS</Typography>
          <Box sx={{ mt: 0.2 }}>
            <Chip
              label={detail.status}
              size="small"
              sx={{
                bgcolor: detail.status === 'Approved' ? '#ECFDF5' : detail.status === 'Pending' ? '#FFFBEB' : '#FEF2F2',
                color: detail.status === 'Approved' ? '#059669' : detail.status === 'Pending' ? '#D97706' : '#DC2626',
                fontWeight: 700,
              }}
            />
          </Box>
        </Box>

        <Box>
          <Typography variant="caption" sx={{ color: '#94A3B8', fontWeight: 600 }}>DATE & TIME</Typography>
          <Typography variant="body2" sx={{ fontWeight: 600, color: '#0F172A' }}>{dateStr}</Typography>
        </Box>

        <Box>
          <Typography variant="caption" sx={{ color: '#94A3B8', fontWeight: 600 }}>LATENCY</Typography>
          <Typography variant="body2" sx={{ fontWeight: 700, color: '#0F172A' }}>
            {detail.latency_ms ? `${(detail.latency_ms / 1000).toFixed(1)} s` : '—'}
          </Typography>
        </Box>

        <Box>
          <Typography variant="caption" sx={{ color: '#94A3B8', fontWeight: 600 }}>TOTAL TOKENS</Typography>
          <Typography variant="body2" sx={{ fontWeight: 700, color: '#0F172A' }}>{detail.total_tokens}</Typography>
        </Box>
      </Card>

      {/* Two Column Layout: Tabs on left, Overview Cards on right */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '2.1fr 1fr' }, gap: 3.5 }}>
        {/* Left Side: Tabs */}
        <Box>
          <Tabs value={tabIndex} onChange={(_, val) => setTabIndex(val)} sx={{ borderBottom: '1px solid #E2E8F0', mb: 3 }}>
            <Tab label="Timeline" sx={{ textTransform: 'none', fontWeight: 600 }} />
            <Tab label="Tool Calls" sx={{ textTransform: 'none', fontWeight: 600 }} />
            <Tab label="Messages" sx={{ textTransform: 'none', fontWeight: 600 }} />
            <Tab label="Logs (JSON)" sx={{ textTransform: 'none', fontWeight: 600 }} />
          </Tabs>

          {/* Timeline Tab */}
          {tabIndex === 0 && (
            <Card sx={{ p: 3, borderRadius: 3, border: '1px solid #E2E8F0' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>Execution Timeline</Typography>
                <Chip
                  label={`Total time: ${detail.latency_ms ? (detail.latency_ms / 1000).toFixed(1) : 0} seconds`}
                  size="small"
                  sx={{ bgcolor: '#EFF6FF', color: '#1D4ED8', fontWeight: 600 }}
                />
              </Box>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                {detail.timeline.map((step) => (
                  <Box key={step.step_number} sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                    <Box
                      sx={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        bgcolor: step.status === 'success' ? '#10B981' : step.status === 'failed' ? '#EF4444' : '#2563EB',
                        color: '#FFFFFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        flexShrink: 0,
                      }}
                    >
                      {step.step_number}
                    </Box>

                    <Box sx={{ flexGrow: 1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0F172A' }}>
                          {step.title}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <Typography variant="caption" sx={{ color: '#94A3B8' }}>{step.timestamp}</Typography>
                          {step.latency_ms !== null && step.latency_ms !== undefined && (
                            <Chip label={`✓ ${step.latency_ms} ms`} size="small" sx={{ bgcolor: '#ECFDF5', color: '#059669', fontSize: '0.75rem', fontWeight: 600 }} />
                          )}
                        </Box>
                      </Box>
                      <Typography variant="body2" sx={{ color: '#64748B', mt: 0.3 }}>
                        {step.description}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Box>
            </Card>
          )}

          {/* Tool Calls Tab */}
          {tabIndex === 1 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {detail.tool_calls.length === 0 ? (
                <Card sx={{ p: 4, textAlign: 'center', color: '#94A3B8' }}>No tool calls executed for this run.</Card>
              ) : (
                detail.tool_calls.map((tc) => (
                  <Card key={tc.id} sx={{ p: 2.5, borderRadius: 3, border: '1px solid #E2E8F0' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#2563EB' }}>
                        {tc.tool_name}
                      </Typography>
                      <Chip label={`${tc.latency_ms} ms`} size="small" sx={{ bgcolor: '#EFF6FF', color: '#1D4ED8', fontWeight: 600 }} />
                    </Box>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569', display: 'block', mb: 0.5 }}>
                      INPUT ARGUMENTS
                    </Typography>
                    <Box component="pre" sx={{ p: 1.5, bgcolor: '#F8FAFC', borderRadius: 2, fontSize: '0.8rem', fontFamily: 'monospace', mb: 2, overflowX: 'auto' }}>
                      {JSON.stringify(tc.input_arguments, null, 2)}
                    </Box>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569', display: 'block', mb: 0.5 }}>
                      OUTPUT RESULT
                    </Typography>
                    <Box component="pre" sx={{ p: 1.5, bgcolor: '#F8FAFC', borderRadius: 2, fontSize: '0.8rem', fontFamily: 'monospace', overflowX: 'auto' }}>
                      {JSON.stringify(tc.output_result, null, 2)}
                    </Box>
                  </Card>
                ))
              )}
            </Box>
          )}

          {/* Messages Tab */}
          {tabIndex === 2 && (
            <Card sx={{ p: 3, borderRadius: 3, border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: 3 }}>
              <Box sx={{ p: 2, bgcolor: '#F8FAFC', borderRadius: 2 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: '#2563EB' }}>USER REQUEST</Typography>
                <Typography variant="body1" sx={{ mt: 0.5, color: '#0F172A', whiteSpace: 'pre-wrap' }}>
                  {detail.request_text}
                </Typography>
              </Box>

              <Box sx={{ p: 2, bgcolor: '#EFF6FF', borderRadius: 2 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: '#1D4ED8' }}>AGENT RESPONSE</Typography>
                <Typography variant="body1" sx={{ mt: 0.5, color: '#0F172A', whiteSpace: 'pre-wrap' }}>
                  {detail.outcome_summary || 'Response processed.'}
                </Typography>
              </Box>
            </Card>
          )}

          {/* Logs JSON Tab */}
          {tabIndex === 3 && (
            <Card sx={{ p: 2.5, borderRadius: 3, border: '1px solid #E2E8F0' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Structured Trace Log (JSON)</Typography>
                <Button size="small" variant="outlined" startIcon={<Download size={14} />} onClick={handleDownloadLogs}>
                  Export JSON
                </Button>
              </Box>
              <Box
                component="pre"
                sx={{
                  p: 2,
                  bgcolor: '#0F172A',
                  color: '#38BDF8',
                  borderRadius: 2,
                  fontSize: '0.8rem',
                  fontFamily: 'monospace',
                  overflowX: 'auto',
                  maxHeight: 600,
                }}
              >
                {JSON.stringify(detail, null, 2)}
              </Box>
            </Card>
          )}
        </Box>

        {/* Right Side: Detail Cards */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          {/* User Request */}
          <Card sx={{ p: 2.5, borderRadius: 3, border: '1px solid #E2E8F0' }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748B', display: 'block', mb: 1 }}>
              USER REQUEST
            </Typography>
            <Typography variant="body2" sx={{ color: '#0F172A', whiteSpace: 'pre-wrap' }}>
              {detail.request_text}
            </Typography>
          </Card>

          {/* Extracted Expense */}
          {detail.extracted_data && (
            <Card sx={{ p: 2.5, borderRadius: 3, border: '1px solid #E2E8F0' }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748B', display: 'block', mb: 1.5 }}>
                EXTRACTED EXPENSE
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1.5 }}>
                <Box>
                  <Typography variant="caption" sx={{ color: '#94A3B8' }}>Merchant</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{detail.extracted_data.merchant || '—'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: '#94A3B8' }}>Category</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{detail.extracted_data.category || '—'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: '#94A3B8' }}>Amount</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>₹ {detail.extracted_data.amount?.toLocaleString('en-IN')}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: '#94A3B8' }}>Currency</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{detail.extracted_data.currency || 'INR'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: '#94A3B8' }}>Date</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{detail.extracted_data.date || '—'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: '#94A3B8' }}>Project</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{detail.extracted_data.project_code || '—'}</Typography>
                </Box>
              </Box>
            </Card>
          )}

          {/* Policy & Validation */}
          <Card sx={{ p: 2.5, borderRadius: 3, border: '1px solid #E2E8F0' }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748B', display: 'block', mb: 1.5 }}>
              POLICY & VALIDATION
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
              <CheckCircle size={20} color="#059669" />
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600, color: '#065F46' }}>
                  {detail.status === 'Approved' ? 'Expense is within policy limits.' : 'Policy evaluated.'}
                </Typography>
                <Typography variant="caption" sx={{ color: '#64748B' }}>
                  No exceptions or additional justification required.
                </Typography>
              </Box>
            </Box>
          </Card>

          {/* Outcome */}
          <Card sx={{ p: 2.5, bgcolor: detail.status === 'Approved' ? '#ECFDF5' : '#F8FAFC', borderRadius: 3, border: '1px solid #E2E8F0' }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748B', display: 'block', mb: 1 }}>
              OUTCOME
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 700, color: detail.status === 'Approved' ? '#059669' : '#0F172A' }}>
              {detail.outcome_summary || detail.status}
            </Typography>
            {detail.report_id && (
              <Box sx={{ mt: 1.5 }}>
                <Typography variant="caption" sx={{ color: '#047857', fontWeight: 600, display: 'block' }}>
                  Report ID: {detail.report_id}
                </Typography>
              </Box>
            )}
          </Card>

          {/* Token Usage & Cost */}
          <Card sx={{ p: 2.5, borderRadius: 3, border: '1px solid #E2E8F0' }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748B', display: 'block', mb: 1.5 }}>
              TOKEN USAGE
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1 }}>
              <Box>
                <Typography variant="caption" sx={{ color: '#94A3B8' }}>Input</Typography>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>{detail.prompt_tokens}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" sx={{ color: '#94A3B8' }}>Output</Typography>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>{detail.completion_tokens}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" sx={{ color: '#94A3B8' }}>Total</Typography>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>{detail.total_tokens}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" sx={{ color: '#94A3B8' }}>Cost (USD)</Typography>
                <Typography variant="body2" sx={{ fontWeight: 700, color: '#059669' }}>${estimatedCost}</Typography>
              </Box>
            </Box>
          </Card>
        </Box>
      </Box>

      {/* Raw Data Centered Dialog */}
      <Dialog
        open={isRawDataOpen}
        onClose={() => setIsRawDataOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 3, p: 1 },
        }}
      >
        <DialogTitle sx={{ fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Raw Execution Data (JSON)
          <IconButton size="small" onClick={() => setIsRawDataOpen(false)}>
            <X size={18} />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ maxHeight: '70vh', overflowY: 'auto', p: 2.5 }}>
          <Box
            component="pre"
            sx={{
              p: 2,
              bgcolor: '#0F172A',
              color: '#38BDF8',
              borderRadius: 2,
              fontSize: '0.8rem',
              fontFamily: 'monospace',
              overflowX: 'auto',
              maxHeight: 480,
              m: 0,
            }}
          >
            {JSON.stringify(detail, null, 2)}
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
  );
};
