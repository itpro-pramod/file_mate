import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
  Grid,
  IconButton,
  Paper,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  AlertTriangle,
  ArrowLeft,
  Building,
  Calendar,
  Check,
  CheckCircle,
  Clock,
  ExternalLink,
  Eye,
  FileCheck,
  FileSpreadsheet,
  FileText,
  FolderGit2,
  IndianRupee,
  Layers,
  Receipt,
  User,
  X,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../services/api';
import { ExpenseReportDetail } from '../../types';
import { CategoryChip, PolicyCheckChip, StatusBadge } from '../../components/common/UIBadges';
import { ReceiptViewerModal } from '../../components/common/ReceiptViewerModal';

export const ExpenseReportDetailPage: React.FC = () => {
  const { reportIdentifier } = useParams<{ reportIdentifier: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isFinance = user?.role === 'Finance Controller';

  const [report, setReport] = useState<ExpenseReportDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Decision Modal state (for Finance Controller)
  const [decisionModalOpen, setDecisionModalOpen] = useState(false);
  const [decisionAction, setDecisionAction] = useState<'approved' | 'rejected'>('approved');
  const [financeNotes, setFinanceNotes] = useState('');
  const [actionSubmitting, setActionSubmitting] = useState(false);

  // Receipt viewer state
  const [selectedReceipt, setSelectedReceipt] = useState<{
    path: string;
    merchant?: string;
    amount?: number;
    category?: string;
    date?: string;
  } | null>(null);

  useEffect(() => {
    if (reportIdentifier) {
      fetchDetail(reportIdentifier);
    }
  }, [reportIdentifier]);

  const fetchDetail = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getExpenseReportDetail(id);
      setReport(data);
    } catch (err: any) {
      console.error('Failed to load report detail', err);
      setError(err.response?.data?.detail || 'Unable to load expense report details.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDecisionModal = (action: 'approved' | 'rejected') => {
    setDecisionAction(action);
    setFinanceNotes('');
    setDecisionModalOpen(true);
  };

  const handleConfirmDecision = async () => {
    if (!report) return;
    setActionSubmitting(true);
    try {
      const updated = await api.submitFinanceDecision(
        report.report_number,
        decisionAction,
        financeNotes || undefined
      );
      setReport(updated);
      setDecisionModalOpen(false);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to submit decision.');
    } finally {
      setActionSubmitting(false);
    }
  };

  const formatCurrency = (amt: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amt);
  };

  const getStatusChip = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'approved') {
      return (
        <Chip
          icon={<Check size={14} color="#059669" />}
          label="Approved"
          size="small"
          sx={{ bgcolor: '#ECFDF5', color: '#047857', fontWeight: 700 }}
        />
      );
    }
    if (s === 'rejected') {
      return (
        <Chip
          icon={<XCircle size={14} color="#DC2626" />}
          label="Rejected"
          size="small"
          sx={{ bgcolor: '#FEF2F2', color: '#B91C1C', fontWeight: 700 }}
        />
      );
    }
    return (
      <Chip
        icon={<Clock size={14} color="#2563EB" />}
        label="Submitted (Pending Review)"
        size="small"
        sx={{ bgcolor: '#EFF6FF', color: '#1D4ED8', fontWeight: 700 }}
      />
    );
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 12 }}>
        <CircularProgress size={36} sx={{ color: '#2563EB' }} />
        <Typography variant="body2" sx={{ color: '#64748B', mt: 2, fontWeight: 500 }}>
          Loading expense report details...
        </Typography>
      </Box>
    );
  }

  if (error || !report) {
    return (
      <Box sx={{ maxWidth: 800, mx: 'auto', py: 4 }}>
        <Button
          startIcon={<ArrowLeft size={16} />}
          onClick={() => navigate(-1)}
          sx={{ color: '#2563EB', fontWeight: 600, mb: 3, textTransform: 'none' }}
        >
          Back
        </Button>
        <Alert severity="error" sx={{ borderRadius: 2 }}>
          {error || 'Expense report not found.'}
        </Alert>
      </Box>
    );
  }

  const isPending = report.status.toLowerCase() === 'submitted';

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', pb: 6 }}>
      {/* Back Navigation Bar */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Button
          startIcon={<ArrowLeft size={16} />}
          onClick={() => navigate(-1)}
          sx={{
            color: '#2563EB',
            fontWeight: 600,
            fontSize: '0.88rem',
            textTransform: 'none',
            borderRadius: 2,
            px: 1,
            '&:hover': { bgcolor: '#EFF6FF' },
          }}
        >
          Back to Expenses
        </Button>

        {report.trace_id && (
          <Button
            size="small"
            variant="outlined"
            endIcon={<ExternalLink size={14} />}
            onClick={() => navigate(`/runs/${report.trace_id}`)}
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.8rem',
              color: '#2563EB',
              borderColor: '#BFDBFE',
            }}
          >
            View AI Execution Trace
          </Button>
        )}
      </Box>

      {/* Main Header Card */}
      <Card
        elevation={0}
        sx={{
          p: 3,
          mb: 3,
          borderRadius: 3,
          border: '1px solid #E2E8F0',
          bgcolor: '#FFFFFF',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
              <Typography variant="h5" sx={{ fontWeight: 800, color: '#0F172A' }}>
                {report.report_number}
              </Typography>
              <StatusBadge status={report.status} />
            </Box>
            <Typography variant="body2" sx={{ color: '#64748B', mt: 0.75 }}>
              Submitted on{' '}
              {report.submitted_at
                ? new Date(report.submitted_at).toLocaleString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : new Date(report.created_at).toLocaleString('en-IN')}
            </Typography>
          </Box>

          {/* Finance Action Controls (if role is Finance Controller and status is pending) */}
          {isFinance && isPending && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Button
                variant="contained"
                color="success"
                startIcon={<Check size={16} />}
                onClick={() => handleOpenDecisionModal('approved')}
                sx={{
                  borderRadius: 2,
                  textTransform: 'none',
                  fontWeight: 700,
                  bgcolor: '#16A34A',
                  '&:hover': { bgcolor: '#15803D' },
                }}
              >
                Approve Report
              </Button>
              <Button
                variant="outlined"
                color="error"
                startIcon={<XCircle size={16} />}
                onClick={() => handleOpenDecisionModal('rejected')}
                sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}
              >
                Reject Report
              </Button>
            </Box>
          )}
        </Box>

        {/* Finance Decision Feedback Banner */}
        {report.finance_notes && (
          <Box sx={{ mt: 2.5, p: 2, bgcolor: '#F8FAFC', borderRadius: 2, border: '1px solid #E2E8F0' }}>
            <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>
              Finance Decision Notes {report.approved_by ? `(by ${report.approved_by})` : ''}
            </Typography>
            <Typography variant="body2" sx={{ color: '#1E293B', mt: 0.5 }}>
              {report.finance_notes}
            </Typography>
          </Box>
        )}
      </Card>

      {/* Overview Cards Row */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' },
          gap: 2.5,
          mb: 3,
        }}
      >
        {/* Submitter Info Card */}
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <User size={18} color="#2563EB" />
            <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>
              Submitter Information
            </Typography>
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#0F172A', fontSize: '1.05rem' }}>
            {report.employee_name || 'Consultant'}
          </Typography>
          <Typography variant="body2" sx={{ color: '#475569', mt: 0.25 }}>
            Employee ID: <strong>{report.employee_id}</strong>
          </Typography>
          {report.employee_email && (
            <Typography variant="caption" sx={{ color: '#64748B', display: 'block', mt: 0.25 }}>
              {report.employee_email}
            </Typography>
          )}
        </Card>

        {/* Financial Summary Card */}
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <IndianRupee size={18} color="#2563EB" />
            <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>
              Total Reimbursable
            </Typography>
          </Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: '#2563EB' }}>
            {formatCurrency(report.total_amount)}
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748B', mt: 0.5 }}>
            {report.lines.length} itemized line item{report.lines.length !== 1 ? 's' : ''}
          </Typography>
        </Card>

        {/* Project Details Card */}
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <FolderGit2 size={18} color="#059669" />
            <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>
              Assigned Project
            </Typography>
          </Box>
          {report.project_details ? (
            <>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#0F172A', fontSize: '1.05rem' }}>
                {report.project_details.code} – {report.project_details.name}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 0.75 }}>
                <Typography variant="caption" sx={{ color: '#475569' }}>
                  Status: <strong>{report.project_details.status}</strong>
                </Typography>
                <Typography variant="caption" sx={{ color: '#059669', fontWeight: 700 }}>
                  Remaining: {formatCurrency(report.project_details.budget_remaining)}
                </Typography>
              </Box>
            </>
          ) : (
            <Typography variant="body2" sx={{ color: '#64748B', mt: 0.5 }}>
              Project: {report.lines[0]?.project_code || 'General / Multi-project'}
            </Typography>
          )}
        </Card>
      </Box>

      {/* Itemized Expense Lines Section */}
      <Card
        elevation={0}
        sx={{
          p: 3,
          borderRadius: 3,
          border: '1px solid #E2E8F0',
          bgcolor: '#FFFFFF',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
          <Receipt size={20} color="#2563EB" />
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#0F172A', fontSize: '1.1rem' }}>
            Itemized Expense Lines ({report.lines.length})
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {report.lines.map((line, idx) => (
            <Card
              key={line.id || idx}
              elevation={0}
              sx={{
                p: 2.5,
                borderRadius: 2.5,
                border: line.exception_flag ? '1px solid #FED7AA' : '1px solid #E2E8F0',
                bgcolor: line.exception_flag ? '#FFFDF8' : '#F8FAFC',
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  flexWrap: 'wrap',
                  gap: 1.5,
                }}
              >
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0F172A' }}>
                    {line.merchant}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.75, flexWrap: 'wrap' }}>
                    <CategoryChip category={line.category} />
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Calendar size={13} color="#64748B" />
                      <Typography variant="caption" sx={{ color: '#64748B' }}>
                        {line.date}
                      </Typography>
                    </Box>
                    <Chip
                      icon={<FolderGit2 size={12} />}
                      label={`Project: ${line.project_code}`}
                      size="small"
                      variant="outlined"
                      sx={{ height: 24, fontSize: '0.75rem', fontWeight: 600, bgcolor: '#FFFFFF' }}
                    />
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
                          height: 24,
                          fontSize: '0.75rem',
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

                <Typography variant="h6" sx={{ fontWeight: 800, color: '#0F172A' }}>
                  {formatCurrency(line.amount)}
                </Typography>
              </Box>

              {line.notes && (
                <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px dashed #E2E8F0' }}>
                  <Typography variant="body2" sx={{ color: '#475569', fontSize: '0.85rem', wordBreak: 'break-word' }}>
                    <strong>Notes:</strong> {line.notes}
                  </Typography>
                </Box>
              )}

              {line.exception_flag && (
                <Box
                  sx={{
                    mt: 2,
                    p: 1.5,
                    borderRadius: 2,
                    bgcolor: '#FEF3C7',
                    border: '1px solid #FCD34D',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 1.25,
                  }}
                >
                  <AlertTriangle size={18} color="#D97706" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <Box>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: '#92400E', display: 'block' }}>
                      Policy Exception Flagged:
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#B45309', wordBreak: 'break-word' }}>
                      {line.justification || 'Exceeded standard threshold. Compliant within allowed exception ceiling.'}
                    </Typography>
                  </Box>
                </Box>
              )}
            </Card>
          ))}
        </Box>
      </Card>

      {/* Centered Decision Confirmation Dialog (For Finance) */}
      <Dialog
        open={decisionModalOpen}
        onClose={() => !actionSubmitting && setDecisionModalOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 3, p: 1 },
        }}
      >
        <DialogTitle sx={{ fontWeight: 700, color: '#0F172A' }}>
          {decisionAction === 'approved' ? 'Approve Expense Report' : 'Reject Expense Report'}
        </DialogTitle>
        <DialogContent sx={{ maxHeight: '70vh', overflowY: 'auto', py: 1 }}>
          <Typography variant="body2" sx={{ color: '#475569', mb: 2 }}>
            You are about to {decisionAction === 'approved' ? 'approve' : 'reject'} report{' '}
            <strong>{report.report_number}</strong> ({formatCurrency(report.total_amount)}) submitted by{' '}
            <strong>{report.employee_name}</strong>.
          </Typography>

          <TextField
            fullWidth
            label="Finance Decision Notes (Optional)"
            multiline
            rows={3}
            value={financeNotes}
            onChange={(e) => setFinanceNotes(e.target.value)}
            placeholder={
              decisionAction === 'approved'
                ? 'e.g. Approved per project budget and client agreement.'
                : 'e.g. Please provide itemized hotel bill breakdown.'
            }
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDecisionModalOpen(false)} disabled={actionSubmitting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color={decisionAction === 'approved' ? 'success' : 'error'}
            onClick={handleConfirmDecision}
            disabled={actionSubmitting}
            sx={{ fontWeight: 700, borderRadius: 2 }}
          >
            {actionSubmitting ? 'Recording...' : decisionAction === 'approved' ? 'Confirm Approval' : 'Confirm Rejection'}
          </Button>
        </DialogActions>
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
