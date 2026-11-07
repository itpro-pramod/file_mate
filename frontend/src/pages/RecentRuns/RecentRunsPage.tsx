import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Avatar,
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
  InputAdornment,
  MenuItem,
  Select,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Activity,
  Calendar,
  CheckCircle,
  Clock,
  Copy,
  Cpu,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Layers,
  RotateCw,
  Search,
  Sparkles,
  User,
  Wrench,
  X,
} from 'lucide-react';
import { api } from '../../services/api';
import { AgentRunDetail, AgentRunSummary } from '../../types';

export const RecentRunsPage: React.FC = () => {
  const navigate = useNavigate();
  const [runs, setRuns] = useState<AgentRunSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const [runDetail, setRunDetail] = useState<AgentRunDetail | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerTab, setDrawerTab] = useState(0);

  useEffect(() => {
    fetchRuns();
  }, [statusFilter, moduleFilter]);

  const fetchRuns = async () => {
    setLoading(true);
    try {
      const data = await api.getRuns(search, statusFilter, 20, 0, moduleFilter);
      setRuns(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchRuns();
  };

  const handleOpenDetail = async (traceId: string) => {
    setSelectedTraceId(traceId);
    setDrawerLoading(true);
    try {
      const detail = await api.getRunDetail(traceId);
      setRunDetail(detail);
    } catch (e) {
      console.error(e);
    } finally {
      setDrawerLoading(false);
    }
  };

  const handleCloseDetail = () => {
    setSelectedTraceId(null);
    setRunDetail(null);
  };

  const handleCopyTrace = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Trace ID copied to clipboard!');
  };

  const handleDownloadLogs = async (traceId: string) => {
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
      alert('Failed to download logs.');
    }
  };

  const getStatusChip = (status: string) => {
    switch (status) {
      case 'Approved':
        return <Chip label="Approved" size="small" sx={{ bgcolor: '#ECFDF5', color: '#059669', fontWeight: 600 }} />;
      case 'Pending':
        return <Chip label="Pending" size="small" sx={{ bgcolor: '#FFFBEB', color: '#D97706', fontWeight: 600 }} />;
      case 'Rejected':
        return <Chip label="Rejected" size="small" sx={{ bgcolor: '#FEF2F2', color: '#DC2626', fontWeight: 600 }} />;
      case 'Blocked':
        return <Chip label="Blocked" size="small" sx={{ bgcolor: '#FEE2E2', color: '#991B1B', fontWeight: 600 }} />;
      case 'Out of Scope':
        return <Chip label="Out of Scope" size="small" sx={{ bgcolor: '#FFEDD5', color: '#C2410C', fontWeight: 600 }} />;
      case 'Guardrail':
        return <Chip label="Guardrail" size="small" sx={{ bgcolor: '#F3E8FF', color: '#7E22CE', fontWeight: 600 }} />;
      default:
        return <Chip label={status} size="small" sx={{ bgcolor: '#F1F5F9', color: '#475569', fontWeight: 600 }} />;
    }
  };

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto' }}>
      {/* Top Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: '#0F172A', mb: 0.5 }}>
            Recent Runs
          </Typography>
          <Typography variant="body1" sx={{ color: '#64748B' }}>
            View your recent conversations, tool calls, approvals and outcomes.
          </Typography>
        </Box>
        <Button
          variant="outlined"
          onClick={fetchRuns}
          startIcon={<RotateCw size={16} />}
          sx={{ borderRadius: 2, fontWeight: 600, color: '#2563EB', borderColor: '#BFDBFE' }}
        >
          Refresh
        </Button>
      </Box>

      {/* Filter and Search Bar */}
      <Card sx={{ p: 2, mb: 3, borderRadius: 3, border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <form onSubmit={handleSearchSubmit} style={{ flexGrow: 1, minWidth: 260 }}>
          <TextField
            fullWidth
            size="small"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by trace ID or request text..."
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={18} color="#94A3B8" />
                </InputAdornment>
              ),
            }}
          />
        </form>

        <Select
          size="small"
          value={moduleFilter}
          onChange={(e) => setModuleFilter(e.target.value)}
          sx={{ minWidth: 160 }}
        >
          <MenuItem value="all">All Modules</MenuItem>
          <MenuItem value="EXPENSE_ASSISTANT">Expense Assistant</MenuItem>
          <MenuItem value="EXPENSE_INTELLIGENCE">Expense Intelligence</MenuItem>
        </Select>

        <Select
          size="small"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          sx={{ minWidth: 140 }}
        >
          <MenuItem value="all">All Statuses</MenuItem>
          <MenuItem value="Approved">Approved</MenuItem>
          <MenuItem value="Pending">Pending</MenuItem>
          <MenuItem value="Rejected">Rejected</MenuItem>
          <MenuItem value="Failed">Failed</MenuItem>
          <MenuItem value="Blocked">Blocked</MenuItem>
          <MenuItem value="Out of Scope">Out of Scope</MenuItem>
          <MenuItem value="Guardrail">Guardrail</MenuItem>
        </Select>

        <Box sx={{ color: '#64748B', fontSize: '0.875rem', fontWeight: 600, ml: 'auto' }}>
          {runs.length} runs found
        </Box>
      </Card>

      {/* Table Card */}
      <Card sx={{ borderRadius: 3, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        <TableContainer>
          <Table>
            <TableHead sx={{ bgcolor: '#F8FAFC' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.8rem' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <FileText size={14} color="#2563EB" /> TRACE ID
                  </Box>
                </TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.8rem' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <Layers size={14} color="#64748B" /> MODULE
                  </Box>
                </TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.8rem' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <Search size={14} color="#64748B" /> REQUEST / QUERY
                  </Box>
                </TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.8rem' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <Calendar size={14} color="#64748B" /> DATE & TIME
                  </Box>
                </TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.8rem' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <Activity size={14} color="#64748B" /> STATUS
                  </Box>
                </TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.8rem' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <Clock size={14} color="#64748B" /> LATENCY
                  </Box>
                </TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.8rem' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <Cpu size={14} color="#64748B" /> TOKENS
                  </Box>
                </TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.8rem' }} align="right">
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.75 }}>
                    <Eye size={14} color="#64748B" /> ACTIONS
                  </Box>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 6 }}>
                    <CircularProgress size={28} />
                  </TableCell>
                </TableRow>
              ) : runs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 6, color: '#94A3B8' }}>
                    No execution runs found.
                  </TableCell>
                </TableRow>
              ) : (
                runs.map((r) => {
                  const dateStr = new Date(r.created_at).toLocaleString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                  const isIntel = r.module === 'EXPENSE_INTELLIGENCE';
                  return (
                    <TableRow
                      key={r.trace_id}
                      hover
                      sx={{ cursor: 'pointer', '&:last-child td, &:last-child th': { border: 0 } }}
                      onClick={() => navigate(`/runs/${r.trace_id}`)}
                    >
                      <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600, color: '#2563EB' }}>
                        {r.trace_id.slice(0, 8)}
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={isIntel ? '✨ Intelligence' : '🤖 Assistant'}
                          sx={{
                            height: 22,
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            bgcolor: isIntel ? '#EFF6FF' : '#F1F5F9',
                            color: isIntel ? '#2563EB' : '#475569',
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ maxWidth: 280, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {r.request_text}
                      </TableCell>
                      <TableCell sx={{ color: '#64748B', fontSize: '0.85rem' }}>{dateStr}</TableCell>
                      <TableCell>{getStatusChip(r.status)}</TableCell>
                      <TableCell sx={{ color: '#475569', fontSize: '0.85rem' }}>
                        {r.latency_ms ? `${(r.latency_ms / 1000).toFixed(1)} s` : '—'}
                      </TableCell>
                      <TableCell sx={{ color: '#475569', fontSize: '0.85rem' }}>{r.total_tokens}</TableCell>
                      <TableCell align="right">
                        <Tooltip title="View Details" arrow>
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/runs/${r.trace_id}`);
                            }}
                            sx={{
                              bgcolor: '#EFF6FF',
                              color: '#2563EB',
                              border: '1px solid #BFDBFE',
                              borderRadius: 2,
                              p: 0.8,
                              '&:hover': {
                                bgcolor: '#2563EB',
                                color: '#FFFFFF',
                              },
                            }}
                          >
                            <Eye size={16} />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* Centered Modal for Run Details with Smooth Vertical Scrolling */}
      <Dialog
        open={Boolean(selectedTraceId)}
        onClose={handleCloseDetail}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 3, p: 1 },
        }}
      >
        {drawerLoading || !runDetail ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
            <CircularProgress size={32} />
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            {/* Modal Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2, pb: 1 }}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>Run Details</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                  <Typography variant="caption" sx={{ fontFamily: 'monospace', color: '#64748B' }}>
                    {runDetail.trace_id}
                  </Typography>
                  <IconButton size="small" onClick={() => handleCopyTrace(runDetail.trace_id)}>
                    <Copy size={13} color="#94A3B8" />
                  </IconButton>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                {getStatusChip(runDetail.status)}
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => {
                    handleCloseDetail();
                    navigate(`/runs/${runDetail.trace_id}`);
                  }}
                  endIcon={<ExternalLink size={14} />}
                  sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 2 }}
                >
                  Full Page View
                </Button>
                <IconButton onClick={handleCloseDetail} size="small">
                  <X size={18} />
                </IconButton>
              </Box>
            </Box>

            {/* Tabs */}
            <Box sx={{ px: 2 }}>
              <Tabs value={drawerTab} onChange={(_, val) => setDrawerTab(val)} sx={{ borderBottom: '1px solid #E2E8F0', mb: 2 }}>
                <Tab label="Overview" sx={{ textTransform: 'none', fontWeight: 600 }} />
                <Tab label="Timeline" sx={{ textTransform: 'none', fontWeight: 600 }} />
                <Tab label="Tool Calls" sx={{ textTransform: 'none', fontWeight: 600 }} />
                <Tab label="Logs (JSON)" sx={{ textTransform: 'none', fontWeight: 600 }} />
              </Tabs>
            </Box>

            {/* Modal Content Body with Safe Vertical Scrolling */}
            <DialogContent sx={{ maxHeight: '68vh', overflowY: 'auto', p: 2.5 }}>
              {drawerTab === 0 && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                  {/* Request */}
                  <Card sx={{ p: 2, bgcolor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748B', display: 'block', mb: 0.8 }}>
                      REQUEST
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#0F172A', whiteSpace: 'pre-wrap' }}>
                      {runDetail.request_text}
                    </Typography>
                  </Card>

                  {/* Extracted Expense */}
                  {runDetail.extracted_data && (
                    <Card sx={{ p: 2, border: '1px solid #E2E8F0' }}>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748B', display: 'block', mb: 1.5 }}>
                        EXTRACTED EXPENSE
                      </Typography>
                      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1.5 }}>
                        <Box>
                          <Typography variant="caption" sx={{ color: '#94A3B8' }}>Merchant</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{runDetail.extracted_data.merchant || '—'}</Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" sx={{ color: '#94A3B8' }}>Category</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{runDetail.extracted_data.category || '—'}</Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" sx={{ color: '#94A3B8' }}>Amount</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>₹ {runDetail.extracted_data.amount?.toLocaleString('en-IN')}</Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" sx={{ color: '#94A3B8' }}>Date</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{runDetail.extracted_data.date || '—'}</Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" sx={{ color: '#94A3B8' }}>Project</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{runDetail.extracted_data.project_code || '—'}</Typography>
                        </Box>
                      </Box>
                    </Card>
                  )}

                  {/* Outcome */}
                  <Card sx={{ p: 2, bgcolor: runDetail.status === 'Approved' ? '#ECFDF5' : '#F8FAFC', border: '1px solid #E2E8F0' }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748B', display: 'block', mb: 0.5 }}>
                      OUTCOME
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: runDetail.status === 'Approved' ? '#059669' : '#0F172A' }}>
                      {runDetail.outcome_summary || runDetail.status}
                    </Typography>
                    {runDetail.report_id && (
                      <Typography variant="caption" sx={{ color: '#047857', display: 'block', mt: 0.5 }}>
                        Report ID: {runDetail.report_id}
                      </Typography>
                    )}
                  </Card>

                  {/* Run Summary */}
                  <Card sx={{ p: 2, border: '1px solid #E2E8F0' }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748B', display: 'block', mb: 1.5 }}>
                      RUN SUMMARY
                    </Typography>
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1 }}>
                      <Box>
                        <Typography variant="caption" sx={{ color: '#94A3B8' }}>Latency</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {runDetail.latency_ms ? `${(runDetail.latency_ms / 1000).toFixed(1)}s` : '—'}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" sx={{ color: '#94A3B8' }}>Input</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>{runDetail.prompt_tokens}</Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" sx={{ color: '#94A3B8' }}>Output</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>{runDetail.completion_tokens}</Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" sx={{ color: '#94A3B8' }}>Total</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>{runDetail.total_tokens}</Typography>
                      </Box>
                    </Box>
                  </Card>
                </Box>
              )}

              {drawerTab === 1 && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {runDetail.timeline.map((step) => (
                    <Box key={step.step_number} sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                      <Box
                        sx={{
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          bgcolor: step.status === 'success' ? '#10B981' : step.status === 'failed' ? '#EF4444' : '#2563EB',
                          color: '#FFFFFF',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        {step.step_number}
                      </Box>
                      <Box sx={{ flexGrow: 1 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{step.title}</Typography>
                        <Typography variant="body2" sx={{ color: '#64748B', fontSize: '0.85rem' }}>{step.description}</Typography>
                        <Box sx={{ display: 'flex', gap: 2, mt: 0.5 }}>
                          <Typography variant="caption" sx={{ color: '#94A3B8' }}>{step.timestamp}</Typography>
                          {step.latency_ms !== null && step.latency_ms !== undefined && (
                            <Typography variant="caption" sx={{ color: '#10B981', fontWeight: 600 }}>{step.latency_ms} ms</Typography>
                          )}
                        </Box>
                      </Box>
                    </Box>
                  ))}
                </Box>
              )}

              {drawerTab === 2 && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {runDetail.tool_calls.length === 0 ? (
                    <Typography variant="body2" sx={{ color: '#94A3B8' }}>No tool calls executed for this run.</Typography>
                  ) : (
                    runDetail.tool_calls.map((tc) => (
                      <Card key={tc.id} sx={{ p: 2, border: '1px solid #E2E8F0' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#2563EB' }}>
                            {tc.tool_name}
                          </Typography>
                          <Chip label={`${tc.latency_ms} ms`} size="small" sx={{ fontSize: '0.75rem' }} />
                        </Box>
                        <Typography variant="caption" sx={{ color: '#64748B', display: 'block', mb: 0.5 }}>
                          Arguments:
                        </Typography>
                        <Box sx={{ p: 1, bgcolor: '#F8FAFC', borderRadius: 1, fontSize: '0.75rem', fontFamily: 'monospace', mb: 1 }}>
                          {JSON.stringify(tc.input_arguments, null, 2)}
                        </Box>
                        <Typography variant="caption" sx={{ color: '#64748B', display: 'block', mb: 0.5 }}>
                          Result:
                        </Typography>
                        <Box sx={{ p: 1, bgcolor: '#F8FAFC', borderRadius: 1, fontSize: '0.75rem', fontFamily: 'monospace' }}>
                          {JSON.stringify(tc.output_result, null, 2)}
                        </Box>
                      </Card>
                    ))
                  )}
                </Box>
              )}

              {drawerTab === 3 && (
                <Box>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<Download size={14} />}
                    onClick={() => handleDownloadLogs(runDetail.trace_id)}
                    sx={{ mb: 2 }}
                  >
                    Download Log (JSON)
                  </Button>
                  <Box
                    component="pre"
                    sx={{
                      p: 2,
                      bgcolor: '#0F172A',
                      color: '#38BDF8',
                      borderRadius: 2,
                      fontSize: '0.75rem',
                      fontFamily: 'monospace',
                      overflowX: 'auto',
                      maxHeight: 500,
                    }}
                  >
                    {JSON.stringify(runDetail, null, 2)}
                  </Box>
                </Box>
              )}
            </DialogContent>

            {/* Bottom Actions */}
            <Box sx={{ p: 2, borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between' }}>
              <Button
                variant="outlined"
                size="small"
                onClick={() => {
                  handleCloseDetail();
                  navigate(`/runs/${runDetail.trace_id}`);
                }}
                endIcon={<ExternalLink size={14} />}
              >
                Full Page View
              </Button>
              <Button
                variant="contained"
                size="small"
                onClick={() => handleDownloadLogs(runDetail.trace_id)}
                startIcon={<Download size={14} />}
              >
                Download Log
              </Button>
            </Box>
          </Box>
        )}
      </Dialog>
    </Box>
  );
};
