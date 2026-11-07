import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  InputAdornment,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  Calendar,
  Check,
  CheckCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  FileCheck,
  FileSpreadsheet,
  FileText,
  Filter,
  FolderGit2,
  IndianRupee,
  Lock,
  Receipt,
  RotateCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  User,
  X,
  XCircle,
} from 'lucide-react';
import { api } from '../../services/api';
import { ExpenseReportDetail, FinanceQueueItem } from '../../types';
import { CategoryChip, PolicyCheckChip, StatusBadge } from '../../components/common/UIBadges';
import { ReceiptViewerModal } from '../../components/common/ReceiptViewerModal';

export const FinanceApprovalsPage: React.FC = () => {
  const navigate = useNavigate();
  const [queue, setQueue] = useState<FinanceQueueItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'exceptions' | 'high_value'>('all');

  // Decision Modal state
  const [decisionModalOpen, setDecisionModalOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<FinanceQueueItem | null>(null);
  const [decisionAction, setDecisionAction] = useState<'approved' | 'rejected'>('approved');
  const [decisionNotes, setDecisionNotes] = useState('');
  const [actionSubmitting, setActionSubmitting] = useState(false);

  // Detail Drawer state
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [reportDetail, setReportDetail] = useState<ExpenseReportDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Receipt viewer state
  const [selectedReceipt, setSelectedReceipt] = useState<{
    path: string;
    merchant?: string;
    amount?: number;
    category?: string;
    date?: string;
  } | null>(null);

  useEffect(() => {
    fetchQueue();
  }, []);

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const data = await api.getFinanceQueue();
      setQueue(data);
    } catch (err) {
      console.error('Failed to fetch finance queue:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDecisionModal = (report: FinanceQueueItem, action: 'approved' | 'rejected') => {
    setSelectedReport(report);
    setDecisionAction(action);
    setDecisionNotes('');
    setDecisionModalOpen(true);
  };

  const handleExecuteDecision = async () => {
    if (!selectedReport) return;
    setActionSubmitting(true);
    try {
      await api.submitFinanceDecision(selectedReport.report_number, decisionAction, decisionNotes);
      setDecisionModalOpen(false);
      setSelectedReport(null);
      // Refresh queue
      await fetchQueue();
    } catch (err) {
      console.error('Failed to submit finance decision:', err);
    } finally {
      setActionSubmitting(false);
    }
  };

  const handleOpenDetail = async (reportNumber: string) => {
    setDetailLoading(true);
    setDetailDrawerOpen(true);
    try {
      const detail = await api.getExpenseReportDetail(reportNumber);
      setReportDetail(detail);
    } catch (err) {
      console.error('Failed to fetch report detail:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const formatCurrency = (amt: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(amt);
  };

  // Filtered queue
  const filteredQueue = queue.filter((item) => {
    const matchesSearch =
      !search ||
      item.report_number.toLowerCase().includes(search.toLowerCase()) ||
      (item.employee_name && item.employee_name.toLowerCase().includes(search.toLowerCase())) ||
      item.project_codes.some((p) => p.toLowerCase().includes(search.toLowerCase()));

    if (!matchesSearch) return false;
    if (filterType === 'exceptions') return item.has_exception;
    if (filterType === 'high_value') return item.is_high_value;
    return true;
  });

  const totalLiability = queue.reduce((sum, item) => sum + item.total_amount, 0);
  const exceptionCount = queue.filter((item) => item.has_exception).length;
  const highValueCount = queue.filter((item) => item.is_high_value).length;

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1400, mx: 'auto' }}>
      {/* Top Header */}
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { sm: 'center' }, gap: 2, mb: 3 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <FileCheck size={28} color="#2563EB" />
            <Typography variant="h5" sx={{ fontWeight: 700, color: '#0F172A' }}>
              Finance Controller Approvals Queue
            </Typography>
            <Chip
              label="Ravi Menon · E2087"
              size="small"
              sx={{ bgcolor: '#EFF6FF', color: '#1D4ED8', fontWeight: 700, border: '1px solid #BFDBFE' }}
            />
          </Box>
          <Typography variant="body2" sx={{ color: '#64748B', mt: 0.5 }}>
            Audit submitted reports, inspect employee justifications, and authorize disbursement.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Button
            variant="outlined"
            startIcon={<RotateCw size={16} />}
            onClick={fetchQueue}
            sx={{ textTransform: 'none', borderColor: '#CBD5E1', color: '#475569' }}
          >
            Refresh Queue
          </Button>
          <Button
            variant="contained"
            onClick={() => navigate('/finance/analytics')}
            sx={{ textTransform: 'none', bgcolor: '#0B192C', '&:hover': { bgcolor: '#1E293B' }, fontWeight: 600 }}
          >
            View Finance Analytics
          </Button>
        </Box>
      </Box>

      {/* Ravi's Governance Banner */}
      <Alert
        severity="info"
        icon={<ShieldCheck size={20} color="#2563EB" />}
        sx={{ mb: 3, borderRadius: 3, bgcolor: '#F0FDF4', border: '1px solid #BBF7D0' }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#166534' }}>
          Ravi's Governance Principles: Verifiable Audit & Secondary Approval Enforced
        </Typography>
        <Typography variant="body2" sx={{ color: '#14532D', mt: 0.5, fontSize: '0.85rem' }}>
          Consultants submit their drafts after employee confirmation. Final disbursement is sanctioned exclusively by Finance Controller sign-off. Reports with exceptions or amounts exceeding ₹10,000 INR require manager verification.
        </Typography>
      </Alert>

      {/* KPI Cards Row */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 2.5, mb: 3 }}>
        <Card sx={{ p: 2.5, borderRadius: 3, border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
            Pending Reports
          </Typography>
          <Typography variant="h4" sx={{ fontWeight: 700, color: queue.length > 0 ? '#2563EB' : '#059669', mt: 1 }}>
            {queue.length}
          </Typography>
          <Typography variant="caption" sx={{ color: '#64748B', mt: 0.5, display: 'block' }}>
            Awaiting Finance review
          </Typography>
        </Card>

        <Card sx={{ p: 2.5, borderRadius: 3, border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
            Total Liability
          </Typography>
          <Typography variant="h4" sx={{ fontWeight: 700, color: '#0F172A', mt: 1 }}>
            {formatCurrency(totalLiability)}
          </Typography>
          <Typography variant="caption" sx={{ color: '#64748B', mt: 0.5, display: 'block' }}>
            Pending reimbursement
          </Typography>
        </Card>

        <Card sx={{ p: 2.5, borderRadius: 3, border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
            Policy Exceptions
          </Typography>
          <Typography variant="h4" sx={{ fontWeight: 700, color: exceptionCount > 0 ? '#D97706' : '#64748B', mt: 1 }}>
            {exceptionCount}
          </Typography>
          <Typography variant="caption" sx={{ color: exceptionCount > 0 ? '#D97706' : '#64748B', mt: 0.5, display: 'block' }}>
            Requires justification audit
          </Typography>
        </Card>

        <Card sx={{ p: 2.5, borderRadius: 3, border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
            High-Value (&gt; ₹10k)
          </Typography>
          <Typography variant="h4" sx={{ fontWeight: 700, color: highValueCount > 0 ? '#7C3AED' : '#64748B', mt: 1 }}>
            {highValueCount}
          </Typography>
          <Typography variant="caption" sx={{ color: '#64748B', mt: 0.5, display: 'block' }}>
            Secondary manager approval
          </Typography>
        </Card>
      </Box>

      {/* Filter and Search Bar */}
      <Card sx={{ p: 2, mb: 3, borderRadius: 3, border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2, alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ width: { xs: '100%', md: 380 } }}>
            <TextField
              size="small"
              fullWidth
              placeholder="Search by report #, employee, project..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search size={18} color="#94A3B8" />
                  </InputAdornment>
                ),
              }}
            />
          </Box>

          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Chip
              label={`All Submissions (${queue.length})`}
              clickable
              onClick={() => setFilterType('all')}
              color={filterType === 'all' ? 'primary' : 'default'}
              variant={filterType === 'all' ? 'filled' : 'outlined'}
              sx={{ fontWeight: 600 }}
            />
            <Chip
              label={`Exceptions (${exceptionCount})`}
              clickable
              onClick={() => setFilterType('exceptions')}
              color={filterType === 'exceptions' ? 'warning' : 'default'}
              variant={filterType === 'exceptions' ? 'filled' : 'outlined'}
              sx={{ fontWeight: 600 }}
            />
            <Chip
              label={`High-Value > ₹10k (${highValueCount})`}
              clickable
              onClick={() => setFilterType('high_value')}
              color={filterType === 'high_value' ? 'secondary' : 'default'}
              variant={filterType === 'high_value' ? 'filled' : 'outlined'}
              sx={{ fontWeight: 600 }}
            />
          </Box>
        </Box>
      </Card>

      {/* Pending Queue Table */}
      <TableContainer component={Paper} sx={{ borderRadius: 3, border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <Table>
          <TableHead sx={{ bgcolor: '#F8FAFC' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.8rem' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <FileSpreadsheet size={15} color="#2563EB" />
                  REPORT #
                </Box>
              </TableCell>
              <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.8rem' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <User size={15} color="#64748B" />
                  SUBMITTER
                </Box>
              </TableCell>
              <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.8rem' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <Calendar size={15} color="#64748B" />
                  SUBMITTED DATE
                </Box>
              </TableCell>
              <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.8rem' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <FolderGit2 size={15} color="#64748B" />
                  PROJECT
                </Box>
              </TableCell>
              <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.8rem' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <Receipt size={15} color="#64748B" />
                  LINES
                </Box>
              </TableCell>
              <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.8rem' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <IndianRupee size={15} color="#059669" />
                  AMOUNT
                </Box>
              </TableCell>
              <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.8rem' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <ShieldCheck size={15} color="#64748B" />
                  AUDIT FLAGS
                </Box>
              </TableCell>
              <TableCell align="center" sx={{ fontWeight: 700, color: '#475569', fontSize: '0.8rem' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.75 }}>
                  <CheckCircle2 size={15} color="#2563EB" />
                  FINANCE DECISION
                </Box>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 6 }}>
                  <CircularProgress size={32} />
                  <Typography variant="body2" sx={{ color: '#64748B', mt: 1.5 }}>
                    Loading Finance queue...
                  </Typography>
                </TableCell>
              </TableRow>
            ) : filteredQueue.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 6 }}>
                  <CheckCircle size={40} color="#10B981" />
                  <Typography variant="body1" sx={{ color: '#0F172A', fontWeight: 600, mt: 1 }}>
                    All Caught Up!
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#64748B' }}>
                    There are no expense reports currently waiting for Finance approval.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              filteredQueue.map((item) => (
                <TableRow key={item.id} hover>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <FileSpreadsheet size={16} color="#2563EB" />
                      <Typography
                        variant="body2"
                        sx={{ fontWeight: 700, color: '#1D4ED8', cursor: 'pointer' }}
                        onClick={() => handleOpenDetail(item.report_number)}
                      >
                        {item.report_number}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#1E293B' }}>
                      {item.employee_name || item.employee_id}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#94A3B8' }}>
                      {item.employee_id}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ color: '#334155' }}>
                      {item.submitted_at
                        ? new Date(item.submitted_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                        : new Date(item.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {item.project_codes.map((p) => (
                      <Chip key={p} label={p} size="small" sx={{ fontWeight: 600, fontSize: '0.75rem' }} />
                    ))}
                  </TableCell>
                  <TableCell>
                    <Chip label={`${item.lines_count} lines`} size="small" variant="outlined" sx={{ fontSize: '0.75rem' }} />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#0F172A' }}>
                      {formatCurrency(item.total_amount)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                      {item.has_exception && (
                        <Chip
                          icon={<AlertTriangle size={14} color="#D97706" />}
                          label="Exception"
                          size="small"
                          sx={{ bgcolor: '#FEF3C7', color: '#B45309', fontWeight: 600, fontSize: '0.75rem' }}
                        />
                      )}
                      {item.is_high_value && (
                        <Chip
                          label="> ₹10,000"
                          size="small"
                          sx={{ bgcolor: '#F3E8FF', color: '#7E22CE', fontWeight: 600, fontSize: '0.75rem' }}
                        />
                      )}
                      {!item.has_exception && !item.is_high_value && (
                        <Chip
                          label="Standard"
                          size="small"
                          sx={{ bgcolor: '#ECFDF5', color: '#047857', fontWeight: 600, fontSize: '0.75rem' }}
                        />
                      )}
                    </Box>
                  </TableCell>
                  <TableCell align="center">
                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', alignItems: 'center' }}>
                      <Tooltip title="View Details" arrow>
                        <IconButton
                          size="small"
                          onClick={() => handleOpenDetail(item.report_number)}
                          sx={{
                            bgcolor: '#EFF6FF',
                            color: '#2563EB',
                            border: '1px solid #BFDBFE',
                            borderRadius: 2,
                            p: 0.75,
                            '&:hover': { bgcolor: '#2563EB', color: '#FFFFFF' },
                          }}
                        >
                          <Eye size={15} />
                        </IconButton>
                      </Tooltip>
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={<Check size={14} />}
                        onClick={() => handleOpenDecisionModal(item, 'approved')}
                        sx={{ textTransform: 'none', fontSize: '0.75rem', bgcolor: '#059669', '&:hover': { bgcolor: '#047857' } }}
                      >
                        Approve
                      </Button>
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={<X size={14} />}
                        onClick={() => handleOpenDecisionModal(item, 'rejected')}
                        sx={{ textTransform: 'none', fontSize: '0.75rem', bgcolor: '#DC2626', '&:hover': { bgcolor: '#B91C1C' } }}
                      >
                        Reject
                      </Button>
                    </Box>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Decision Confirmation Dialog */}
      <Dialog open={decisionModalOpen} onClose={() => setDecisionModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, color: '#0F172A' }}>
          {decisionAction === 'approved' ? 'Approve Expense Report for Disbursement' : 'Reject Expense Report'}
        </DialogTitle>
        <DialogContent>
          {selectedReport && (
            <Box sx={{ pt: 1 }}>
              <Typography variant="body2" sx={{ color: '#475569', mb: 2 }}>
                You are reviewing <strong>{selectedReport.report_number}</strong> filed by{' '}
                <strong>{selectedReport.employee_name}</strong> for{' '}
                <strong>{formatCurrency(selectedReport.total_amount)}</strong>.
              </Typography>

              {selectedReport.has_exception && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  This report contains policy exceptions requiring manager justification before approval.
                </Alert>
              )}

              <TextField
                fullWidth
                label={decisionAction === 'approved' ? 'Audit Notes (Optional)' : 'Rejection Reason (Required)'}
                multiline
                rows={3}
                value={decisionNotes}
                onChange={(e) => setDecisionNotes(e.target.value)}
                placeholder={
                  decisionAction === 'approved'
                    ? 'e.g. Verified client justification and itemized receipt.'
                    : 'e.g. Alcohol not eligible for reimbursement; please resubmit without alcohol lines.'
                }
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDecisionModalOpen(false)} sx={{ textTransform: 'none', color: '#64748B' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={actionSubmitting || (decisionAction === 'rejected' && !decisionNotes.trim())}
            onClick={handleExecuteDecision}
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              bgcolor: decisionAction === 'approved' ? '#059669' : '#DC2626',
              '&:hover': { bgcolor: decisionAction === 'approved' ? '#047857' : '#B91C1C' },
            }}
          >
            {actionSubmitting ? 'Recording...' : decisionAction === 'approved' ? 'Confirm Approval' : 'Confirm Rejection'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Detail Centered Dialog with Vertical Scrolling & Full Page Navigation */}
      <Dialog
        open={detailDrawerOpen}
        onClose={() => setDetailDrawerOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 3, p: 1 },
        }}
      >
        {detailLoading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 8 }}>
            <CircularProgress size={36} />
            <Typography variant="body2" sx={{ color: '#64748B', mt: 2 }}>
              Loading report details...
            </Typography>
          </Box>
        ) : reportDetail ? (
          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            {/* Dialog Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2, pb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#0F172A' }}>
                  {reportDetail.report_number}
                </Typography>
                <Chip
                  label={reportDetail.status}
                  size="small"
                  sx={{ bgcolor: '#EFF6FF', color: '#1D4ED8', fontWeight: 700 }}
                />
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Button
                  size="small"
                  variant="outlined"
                  endIcon={<ExternalLink size={14} />}
                  onClick={() => {
                    setDetailDrawerOpen(false);
                    navigate(`/expenses/${reportDetail.report_number}`);
                  }}
                  sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 2 }}
                >
                  Full Page View
                </Button>
                <IconButton onClick={() => setDetailDrawerOpen(false)} size="small">
                  <X size={20} />
                </IconButton>
              </Box>
            </Box>

            <Divider />

            {/* Dialog Content with Safe Vertical Scrolling */}
            <DialogContent sx={{ maxHeight: '72vh', overflowY: 'auto', p: 2.5 }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 2 }}>
                <Card sx={{ p: 2, bgcolor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 2 }}>
                  <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600 }}>
                    SUBMITTER
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: '#1E293B', mt: 0.5 }}>
                    {reportDetail.employee_name}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#64748B' }}>
                    ID: {reportDetail.employee_id}
                  </Typography>
                </Card>

                <Card sx={{ p: 2, bgcolor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 2 }}>
                  <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600 }}>
                    AMOUNT
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#2563EB', mt: 0.5 }}>
                    {formatCurrency(reportDetail.total_amount)}
                  </Typography>
                </Card>
              </Box>

              {reportDetail.trace_id && (
                <Alert
                  severity="info"
                  action={
                    <Button
                      size="small"
                      endIcon={<ExternalLink size={14} />}
                      onClick={() => navigate(`/runs/${reportDetail.trace_id}`)}
                      sx={{ textTransform: 'none', fontWeight: 600 }}
                    >
                      Open Trace
                    </Button>
                  }
                  sx={{ mb: 2, borderRadius: 2 }}
                >
                  Trace: {reportDetail.trace_id.slice(0, 16)}...
                </Alert>
              )}

              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0F172A', mb: 1 }}>
                Itemized Lines ({reportDetail.lines.length})
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {reportDetail.lines.map((line) => (
                  <Card
                    key={line.id}
                    sx={{
                      p: 2,
                      border: '1px solid #E2E8F0',
                      borderRadius: 2,
                      bgcolor: line.exception_flag ? '#FFFBEB' : '#FFFFFF',
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 1 }}>
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#1E293B' }}>
                          {line.merchant}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 0.5, flexWrap: 'wrap' }}>
                          <Chip label={line.category} size="small" sx={{ fontSize: '0.75rem', height: 22 }} />
                          <Typography variant="caption" sx={{ color: '#64748B' }}>
                            {line.date} • Proj: {line.project_code}
                          </Typography>
                          {line.receipt_path && (
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<Eye size={12} />}
                              onClick={() =>
                                setSelectedReceipt({
                                  path: line.receipt_path!,
                                  merchant: line.merchant,
                                  amount: line.amount,
                                  category: line.category,
                                  date: line.date,
                                })
                              }
                              sx={{
                                height: 22,
                                fontSize: '0.72rem',
                                fontWeight: 600,
                                textTransform: 'none',
                                color: '#2563EB',
                                borderColor: '#BFDBFE',
                                bgcolor: '#EFF6FF',
                                '&:hover': { bgcolor: '#DBEAFE' },
                              }}
                            >
                              View Bill
                            </Button>
                          )}
                        </Box>
                      </Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0F172A' }}>
                        {formatCurrency(line.amount)}
                      </Typography>
                    </Box>

                    {line.exception_flag && (
                      <Alert severity="warning" sx={{ mt: 1.5, py: 0.5, borderRadius: 1.5 }}>
                        <Typography variant="caption" sx={{ fontWeight: 600, display: 'block' }}>
                          Policy Exception:
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#B45309', wordBreak: 'break-word' }}>
                          {line.justification || 'Manager justification required.'}
                        </Typography>
                      </Alert>
                    )}
                  </Card>
                ))}
              </Box>
            </DialogContent>
          </Box>
        ) : null}
      </Dialog>

      {/* Bill & Receipt Document Viewer Modal */}
      <ReceiptViewerModal
        open={Boolean(selectedReceipt)}
        onClose={() => setSelectedReceipt(null)}
        receiptPath={selectedReceipt?.path || null}
        merchant={selectedReceipt?.merchant}
        amount={selectedReceipt?.amount}
        category={selectedReceipt?.category}
        date={selectedReceipt?.date}
      />
    </Box>
  );
};
