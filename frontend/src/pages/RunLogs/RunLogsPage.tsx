import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Typography,
} from '@mui/material';
import {
  Check,
  CheckCircle,
  Copy,
  Download,
  FileCode,
  FileSpreadsheet,
  Layers,
  RefreshCw,
  Search,
  Shield,
  Terminal,
} from 'lucide-react';
import { api } from '../../services/api';
import { AgentRunSummary } from '../../types';

export const RunLogsPage: React.FC = () => {
  const [runs, setRuns] = useState<AgentRunSummary[]>([]);
  const [selectedTraceId, setSelectedTraceId] = useState<string>('');
  const [logs, setLogs] = useState<any[]>([]);
  const [loadingRuns, setLoadingRuns] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchRuns();
  }, []);

  const fetchRuns = async () => {
    setLoadingRuns(true);
    try {
      const data = await api.getRuns(undefined, undefined, 20, 0);
      setRuns(data);
      if (data.length > 0) {
        setSelectedTraceId(data[0].trace_id);
        fetchLogs(data[0].trace_id);
      }
    } catch (e) {
      console.error('Failed to fetch runs for logs page', e);
    } finally {
      setLoadingRuns(false);
    }
  };

  const fetchLogs = async (traceId: string) => {
    if (!traceId) return;
    setLoadingLogs(true);
    try {
      const logEntries = await api.getRunLogs(traceId);
      setLogs(logEntries);
    } catch (e) {
      console.error('Failed to fetch logs for trace', traceId, e);
      setLogs([]);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleSelectTrace = (traceId: string) => {
    setSelectedTraceId(traceId);
    fetchLogs(traceId);
  };

  const handleCopyJSON = () => {
    if (!logs || logs.length === 0) return;
    navigator.clipboard.writeText(JSON.stringify(logs, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownloadJSON = () => {
    if (!logs || logs.length === 0) return;
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(logs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `run-logs-${selectedTraceId.substring(0, 8)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const getEventBadgeColor = (eventType: string) => {
    switch (eventType) {
      case 'RUN_STARTED':
      case 'RUN_COMPLETED':
        return { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' };
      case 'TOOL_CALL':
        return { bg: '#F5F3FF', text: '#6D28D9', border: '#DDD6FE' };
      case 'PENDING_ACTION_CREATED':
        return { bg: '#EEF2FF', text: '#4338CA', border: '#C7D2FE' };
      case 'HUMAN_APPROVAL_EXECUTED':
        return { bg: '#ECFDF5', text: '#065F46', border: '#A7F3D0' };
      case 'HUMAN_REJECTION':
        return { bg: '#FEF2F2', text: '#991B1B', border: '#FECACA' };
      case 'PROMPT_INJECTION_FLAGGED':
        return { bg: '#FFFBEB', text: '#B45309', border: '#FDE68A' };
      default:
        return { bg: '#F1F5F9', text: '#475569', border: '#CBD5E1' };
    }
  };

  const selectedRun = runs.find((r) => r.trace_id === selectedTraceId);

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: '#0F172A', mb: 0.5 }}>
            Run Logs & Audit Explorer
          </Typography>
          <Typography variant="body1" sx={{ color: '#64748B' }}>
            Structured JSON event telemetry (Deliverable D4). Reconstruct tool calls, tokens, latencies, and approvals.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Button
            variant="outlined"
            onClick={fetchRuns}
            startIcon={<RefreshCw size={16} />}
            sx={{ textTransform: 'none', borderRadius: 2, fontWeight: 600 }}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            onClick={handleDownloadJSON}
            disabled={logs.length === 0}
            startIcon={<Download size={16} />}
            sx={{ textTransform: 'none', borderRadius: 2, fontWeight: 600 }}
          >
            Download JSON
          </Button>
        </Box>
      </Box>

      {/* Main Grid */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '340px 1fr' }, gap: 3 }}>
        {/* Left: Trace Selector & Metadata */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <Card sx={{ p: 2.5, borderRadius: 3, border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#334155', mb: 1.5 }}>
              SELECT EXECUTION TRACE
            </Typography>

            {loadingRuns ? (
              <Box sx={{ py: 3, textAlign: 'center' }}>
                <CircularProgress size={24} />
              </Box>
            ) : runs.length === 0 ? (
              <Alert severity="info" sx={{ borderRadius: 2 }}>
                No recorded runs yet. Submit an expense in the Assistant tab.
              </Alert>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {runs.map((run) => {
                  const isSelected = run.trace_id === selectedTraceId;
                  return (
                    <Box
                      key={run.trace_id}
                      onClick={() => handleSelectTrace(run.trace_id)}
                      sx={{
                        p: 1.5,
                        borderRadius: 2,
                        cursor: 'pointer',
                        border: '1px solid',
                        borderColor: isSelected ? '#2563EB' : '#F1F5F9',
                        bgcolor: isSelected ? '#EFF6FF' : '#FFFFFF',
                        transition: 'all 0.15s ease',
                        '&:hover': {
                          borderColor: '#93C5FD',
                          bgcolor: isSelected ? '#EFF6FF' : '#F8FAFC',
                        },
                      }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                        <Typography
                          variant="caption"
                          sx={{
                            fontFamily: 'monospace',
                            fontWeight: 700,
                            color: isSelected ? '#1D4ED8' : '#0F172A',
                          }}
                        >
                          {run.trace_id.substring(0, 8)}...
                        </Typography>
                        <Chip
                          label={run.status}
                          size="small"
                          sx={{
                            height: 20,
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            bgcolor: run.status === 'Approved' ? '#DCFCE7' : run.status === 'Pending' ? '#FEF3C7' : '#FEE2E2',
                            color: run.status === 'Approved' ? '#15803D' : run.status === 'Pending' ? '#B45309' : '#B91C1C',
                          }}
                        />
                      </Box>
                      <Typography
                        variant="body2"
                        sx={{
                          fontSize: '0.8rem',
                          color: '#64748B',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {run.request_text}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1.5, mt: 1, fontSize: '0.72rem', color: '#94A3B8' }}>
                        <span>{run.latency_ms || 0} ms</span>
                        <span>•</span>
                        <span>{run.total_tokens || 0} tokens</span>
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            )}
          </Card>

          {/* Trace Summary Card */}
          {selectedRun && (
            <Card sx={{ p: 2.5, borderRadius: 3, border: '1px solid #E2E8F0', bgcolor: '#F8FAFC' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#334155', mb: 1.5 }}>
                TRACE TELEMETRY SUMMARY
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, fontSize: '0.85rem' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748B' }}>Trace ID:</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{selectedRun.trace_id.substring(0, 12)}...</span>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748B' }}>Employee ID:</span>
                  <span style={{ fontWeight: 600 }}>{selectedRun.employee_id}</span>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748B' }}>Outcome:</span>
                  <span style={{ fontWeight: 600 }}>{selectedRun.status}</span>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748B' }}>Total Latency:</span>
                  <span style={{ fontWeight: 600 }}>{selectedRun.latency_ms || 0} ms</span>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748B' }}>Total Tokens:</span>
                  <span style={{ fontWeight: 600 }}>{selectedRun.total_tokens || 0}</span>
                </Box>
                {selectedRun.report_id && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748B' }}>Report Number:</span>
                    <span style={{ fontWeight: 700, color: '#2563EB' }}>{selectedRun.report_id}</span>
                  </Box>
                )}
              </Box>
            </Card>
          )}
        </Box>

        {/* Right: Event Timeline & JSON Output */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          {/* Events Stream Overview */}
          <Card sx={{ p: 2.5, borderRadius: 3, border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Terminal size={18} color="#2563EB" />
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  Structured Event Flow ({logs.length} events)
                </Typography>
              </Box>
              <Button
                size="small"
                variant="outlined"
                onClick={handleCopyJSON}
                startIcon={copied ? <Check size={14} color="#15803D" /> : <Copy size={14} />}
                sx={{ textTransform: 'none', borderRadius: 2 }}
              >
                {copied ? 'Copied!' : 'Copy JSON'}
              </Button>
            </Box>

            {loadingLogs ? (
              <Box sx={{ py: 6, textAlign: 'center' }}>
                <CircularProgress size={32} />
              </Box>
            ) : logs.length === 0 ? (
              <Alert severity="info" sx={{ borderRadius: 2 }}>
                Select a trace from the left panel to inspect its event logs.
              </Alert>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 3 }}>
                {logs.map((log, index) => {
                  const badge = getEventBadgeColor(log.event_type || '');
                  return (
                    <Box
                      key={index}
                      sx={{
                        p: 1.5,
                        borderRadius: 2,
                        bgcolor: '#FFFFFF',
                        border: '1px solid #E2E8F0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 2,
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Typography
                          variant="caption"
                          sx={{
                            fontFamily: 'monospace',
                            color: '#94A3B8',
                            width: 24,
                            textAlign: 'right',
                          }}
                        >
                          #{index + 1}
                        </Typography>
                        <Chip
                          label={log.event_type}
                          size="small"
                          sx={{
                            height: 22,
                            fontWeight: 700,
                            fontSize: '0.75rem',
                            bgcolor: badge.bg,
                            color: badge.text,
                            border: `1px solid ${badge.border}`,
                          }}
                        />
                        <Typography variant="body2" sx={{ fontSize: '0.85rem', color: '#334155', fontWeight: 500 }}>
                          {log.tool_name ? `Tool: ${log.tool_name}` : log.details ? log.details : log.request_text ? log.request_text : ''}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        {log.latency_ms !== undefined && (
                          <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600 }}>
                            {log.latency_ms} ms
                          </Typography>
                        )}
                        <Typography variant="caption" sx={{ color: '#94A3B8', fontFamily: 'monospace' }}>
                          {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : ''}
                        </Typography>
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            )}

            <Divider sx={{ my: 2 }} />

            {/* Formatted Raw JSON Box */}
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#334155', mb: 1 }}>
              RAW DELIVERABLE D4 JSON PAYLOAD
            </Typography>
            <Box
              sx={{
                p: 2,
                borderRadius: 2,
                bgcolor: '#0F172A',
                color: '#E2E8F0',
                fontFamily: 'monospace',
                fontSize: '0.82rem',
                maxHeight: 400,
                overflowY: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}
            >
              {logs.length > 0 ? JSON.stringify(logs, null, 2) : '// No logs loaded'}
            </Box>
          </Card>
        </Box>
      </Box>
    </Box>
  );
};
