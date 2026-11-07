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
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Pagination,
  Paper,
  Select,
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
  Activity,
  AlertTriangle,
  ArrowRight,
  Bot,
  Building2,
  Calendar,
  CheckCircle,
  Clock,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  FileText,
  Filter,
  FolderGit2,
  IndianRupee,
  PlusCircle,
  Receipt,
  RotateCw,
  Search,
  ShieldCheck,
  Tag,
  User,
  Wallet,
  X,
} from 'lucide-react';
import { api } from '../../services/api';
import { ExpenseReportDetail, ExpenseReportSummaryItem } from '../../types';
import { CategoryChip, PolicyCheckChip, StatusBadge } from '../../components/common/UIBadges';

export const MyExpensesPage: React.FC = () => {
  const navigate = useNavigate();
  const [reports, setReports] = useState<ExpenseReportSummaryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [projectFilter, setProjectFilter] = useState('all');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Drawer detail state
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [reportDetail, setReportDetail] = useState<ExpenseReportDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    fetchReports();
  }, [page, statusFilter, projectFilter]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const offset = (page - 1) * pageSize;
      const res = await api.getExpenseReports(search, statusFilter, pageSize, offset, projectFilter);
      setReports(res.items);
      setTotal(res.total);
    } catch (err) {
      console.error('Failed to fetch expense reports:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchReports();
  };

  const handleOpenDetail = async (reportNumber: string) => {
    setSelectedReportId(reportNumber);
    setDetailLoading(true);
    try {
      const detail = await api.getExpenseReportDetail(reportNumber);
      setReportDetail(detail);
    } catch (err) {
      console.error('Failed to fetch report detail:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCloseDrawer = () => {
    setSelectedReportId(null);
    setReportDetail(null);
  };

  const formatCurrency = (amt: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(amt);
  };

  const getStatusChip = (status: string) => {
    const s = status.toLowerCase();
    switch (s) {
      case 'submitted':
        return <Chip size="small" label="Submitted" sx={{ bgcolor: '#EFF6FF', color: '#1D4ED8', fontWeight: 600, border: '1px solid #BFDBFE' }} />;
      case 'approved':
        return <Chip size="small" label="Approved" sx={{ bgcolor: '#ECFDF5', color: '#047857', fontWeight: 600, border: '1px solid #A7F3D0' }} />;
      case 'draft':
        return <Chip size="small" label="Draft" sx={{ bgcolor: '#FFFBEB', color: '#B45309', fontWeight: 600, border: '1px solid #FDE68A' }} />;
      case 'rejected':
        return <Chip size="small" label="Rejected" sx={{ bgcolor: '#FEF2F2', color: '#B91C1C', fontWeight: 600, border: '1px solid #FECACA' }} />;
      default:
        return <Chip size="small" label={status} />;
    }
  };

  // Metrics calculation
  const totalBilled = reports.reduce((acc, r) => acc + (r.total_amount || 0), 0);
  const exceptionCount = reports.filter((r) => r.has_exception).length;

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1400, mx: 'auto' }}>
      {/* Top Header */}
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { sm: 'center' }, gap: 2, mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Receipt size={28} color="#2563EB" />
            My Expenses & Submissions
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748B', mt: 0.5 }}>
            View, audit, and track submitted expense reports, itemized line items, and audit trails.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Button
            variant="outlined"
            startIcon={<RotateCw size={16} />}
            onClick={fetchReports}
            sx={{ textTransform: 'none', borderColor: '#CBD5E1', color: '#475569' }}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<Bot size={18} />}
            onClick={() => navigate('/assistant')}
            sx={{ textTransform: 'none', bgcolor: '#2563EB', '&:hover': { bgcolor: '#1D4ED8' }, fontWeight: 600 }}
          >
            File With Assistant
          </Button>
        </Box>
      </Box>

      {/* KPI Cards Row */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 2.5, mb: 3 }}>
        <Card sx={{ p: 2.5, borderRadius: 3, border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Box>
              <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
                Total Reports
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 700, color: '#0F172A', mt: 1 }}>
                {total}
              </Typography>
            </Box>
            <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: '#EFF6FF', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileSpreadsheet size={20} />
            </Box>
          </Box>
          <Typography variant="caption" sx={{ color: '#2563EB', mt: 0.5, display: 'block' }}>
            Across all billing cycles
          </Typography>
        </Card>

        <Card sx={{ p: 2.5, borderRadius: 3, border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Box>
              <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
                Current Page Spend
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 700, color: '#059669', mt: 1 }}>
                {formatCurrency(totalBilled)}
              </Typography>
            </Box>
            <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: '#ECFDF5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IndianRupee size={20} />
            </Box>
          </Box>
          <Typography variant="caption" sx={{ color: '#64748B', mt: 0.5, display: 'block' }}>
            Summed reimbursables
          </Typography>
        </Card>

        <Card sx={{ p: 2.5, borderRadius: 3, border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Box>
              <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
                Policy Exceptions
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 700, color: exceptionCount > 0 ? '#D97706' : '#64748B', mt: 1 }}>
                {exceptionCount}
              </Typography>
            </Box>
            <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: '#FFFBEB', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertTriangle size={20} />
            </Box>
          </Box>
          <Typography variant="caption" sx={{ color: exceptionCount > 0 ? '#D97706' : '#64748B', mt: 0.5, display: 'block' }}>
            Requires manager justification
          </Typography>
        </Card>

        <Card sx={{ p: 2.5, borderRadius: 3, border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Box>
              <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
                Active Projects
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 700, color: '#2563EB', mt: 1 }}>
                ATLAS / VOXORA
              </Typography>
            </Box>
            <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: '#EFF6FF', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FolderGit2 size={20} />
            </Box>
          </Box>
          <Typography variant="caption" sx={{ color: '#64748B', mt: 0.5, display: 'block' }}>
            Project ORION is closed
          </Typography>
        </Card>
      </Box>

      {/* Filters & Search Toolbar */}
      <Card sx={{ p: 2, mb: 3, borderRadius: 3, border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', lg: 'row' }, gap: 2, alignItems: { xs: 'stretch', lg: 'center' }, justifyContent: 'space-between' }}>
          {/* Left: Search Form & Project Filter */}
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center', flexGrow: 1 }}>
            <Box component="form" onSubmit={handleSearchSubmit} sx={{ width: { xs: '100%', sm: 260, md: 300 } }}>
              <TextField
                size="small"
                fullWidth
                placeholder="Search report #, merchant, project..."
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

            {/* Project Filter Selector */}
            <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 190 } }}>
              <InputLabel id="project-filter-label" sx={{ fontSize: '0.85rem' }}>Project Filter</InputLabel>
              <Select
                labelId="project-filter-label"
                id="project-filter-select"
                value={projectFilter}
                label="Project Filter"
                onChange={(e) => {
                  setProjectFilter(e.target.value);
                  setPage(1);
                }}
                sx={{
                  borderRadius: 2,
                  fontSize: '0.85rem',
                  bgcolor: '#FFFFFF',
                  fontWeight: 600,
                  color: projectFilter === 'all' ? '#475569' : '#2563EB',
                }}
                startAdornment={<FolderGit2 size={16} color="#2563EB" style={{ marginRight: 8, flexShrink: 0 }} />}
              >
                <MenuItem value="all">All Projects</MenuItem>
                <MenuItem value="ATLAS">Project ATLAS</MenuItem>
                <MenuItem value="VOXORAAI">Project VoxoraAI</MenuItem>
                <MenuItem value="ORION">Project ORION</MenuItem>
              </Select>
            </FormControl>
          </Box>

          {/* Right: Status Filter Tabs / Chips */}
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
            {['all', 'submitted', 'draft', 'approved', 'rejected'].map((st) => (
              <Chip
                key={st}
                label={st.charAt(0).toUpperCase() + st.slice(1)}
                clickable
                onClick={() => {
                  setStatusFilter(st);
                  setPage(1);
                }}
                color={statusFilter === st ? 'primary' : 'default'}
                variant={statusFilter === st ? 'filled' : 'outlined'}
                sx={{
                  fontWeight: statusFilter === st ? 600 : 500,
                  fontSize: '0.85rem',
                }}
              />
            ))}
          </Box>
        </Box>
      </Card>

      {/* Main Expense Reports Table */}
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
                  <Calendar size={15} color="#64748B" />
                  SUBMITTED / CREATED
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
                  TOTAL AMOUNT
                </Box>
              </TableCell>
              <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.8rem' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <Activity size={15} color="#64748B" />
                  STATUS
                </Box>
              </TableCell>
              <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.8rem' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <ShieldCheck size={15} color="#64748B" />
                  POLICY AUDIT
                </Box>
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 700, color: '#475569', fontSize: '0.8rem' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.75 }}>
                  <Eye size={15} color="#64748B" />
                  ACTION
                </Box>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} align="center" sx={{ py: 6 }}>
                  <CircularProgress size={32} />
                  <Typography variant="body2" sx={{ color: '#64748B', mt: 1.5 }}>
                    Loading submitted expense reports...
                  </Typography>
                </TableCell>
              </TableRow>
            ) : reports.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} align="center" sx={{ py: 6 }}>
                  <Receipt size={40} color="#CBD5E1" />
                  <Typography variant="body1" sx={{ color: '#475569', fontWeight: 600, mt: 1 }}>
                    No expense reports found
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#94A3B8' }}>
                    {search ? 'Try adjusting your search or filters.' : 'Use the Expense Assistant to submit your first report.'}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              reports.map((rpt) => (
                <TableRow
                  key={rpt.id}
                  hover
                  sx={{ cursor: 'pointer', '&:hover': { bgcolor: '#F8FAFC' } }}
                  onClick={() => navigate(`/expenses/${rpt.report_number}`)}
                >
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <FileSpreadsheet size={16} color="#2563EB" />
                      <Typography variant="body2" sx={{ fontWeight: 700, color: '#1D4ED8' }}>
                        {rpt.report_number}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ color: '#334155' }}>
                      {rpt.submitted_at
                        ? new Date(rpt.submitted_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                        : new Date(rpt.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#1E293B' }}>
                      {rpt.employee_name || rpt.employee_id}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#94A3B8' }}>
                      {rpt.employee_id}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {rpt.project_codes.length > 0 ? (
                      rpt.project_codes.map((p) => (
                        <Chip
                          key={p}
                          label={p}
                          size="small"
                          sx={{
                            bgcolor: p === 'ATLAS' ? '#EFF6FF' : '#F1F5F9',
                            color: p === 'ATLAS' ? '#1D4ED8' : '#475569',
                            fontWeight: 600,
                            fontSize: '0.75rem',
                          }}
                        />
                      ))
                    ) : (
                      <Typography variant="caption" sx={{ color: '#94A3B8' }}>-</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip
                      icon={<Receipt size={12} />}
                      label={`${rpt.lines_count} lines`}
                      size="small"
                      variant="outlined"
                      sx={{ fontSize: '0.75rem', fontWeight: 600 }}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#0F172A' }}>
                      {formatCurrency(rpt.total_amount)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={rpt.status} />
                  </TableCell>
                  <TableCell>
                    <PolicyCheckChip exception_flag={rpt.has_exception} />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="View Details" arrow>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/expenses/${rpt.report_number}`);
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
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination Footer */}
      {total > pageSize && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 3 }}>
          <Typography variant="body2" sx={{ color: '#64748B' }}>
            Showing {Math.min((page - 1) * pageSize + 1, total)} to {Math.min(page * pageSize, total)} of {total} reports
          </Typography>
          <Pagination
            count={Math.ceil(total / pageSize)}
            page={page}
            onChange={(_, val) => setPage(val)}
            color="primary"
            shape="rounded"
          />
        </Box>
      )}

      {/* Report Detail Modal (Centered Dialog with Vertical Scrolling & Full Page Navigation) */}
      <Dialog
        open={Boolean(selectedReportId)}
        onClose={handleCloseDrawer}
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
            {/* Modal Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', p: 2, pb: 1 }}>
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#0F172A' }}>
                    {reportDetail.report_number}
                  </Typography>
                  {getStatusChip(reportDetail.status)}
                </Box>
                <Typography variant="body2" sx={{ color: '#64748B', mt: 0.5 }}>
                  Submitted on{' '}
                  {reportDetail.submitted_at
                    ? new Date(reportDetail.submitted_at).toLocaleString('en-IN')
                    : new Date(reportDetail.created_at).toLocaleString('en-IN')}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Button
                  size="small"
                  variant="outlined"
                  endIcon={<ExternalLink size={14} />}
                  onClick={() => {
                    handleCloseDrawer();
                    navigate(`/expenses/${reportDetail.report_number}`);
                  }}
                  sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 2 }}
                >
                  Full Page View
                </Button>
                <IconButton onClick={handleCloseDrawer} size="small" sx={{ color: '#64748B' }}>
                  <X size={20} />
                </IconButton>
              </Box>
            </Box>

            <Divider />

            {/* Modal Content with Safe Vertical Scrolling */}
            <DialogContent sx={{ maxHeight: '72vh', overflowY: 'auto', p: 2.5 }}>
              {/* Submitter & Amount Summary Cards */}
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 3 }}>
                <Card sx={{ p: 2, bgcolor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 2 }}>
                  <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600 }}>
                    EMPLOYEE
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: '#1E293B', mt: 0.5 }}>
                    {reportDetail.employee_name}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#64748B' }}>
                    {reportDetail.employee_email} • ID: {reportDetail.employee_id}
                  </Typography>
                </Card>

                <Card sx={{ p: 2, bgcolor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 2 }}>
                  <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600 }}>
                    TOTAL REIMBURSABLE
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#2563EB', mt: 0.5 }}>
                    {formatCurrency(reportDetail.total_amount)}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#64748B' }}>
                    {reportDetail.lines.length} itemized lines
                  </Typography>
                </Card>
              </Box>

              {/* Trace Reference Button (if available) */}
              {reportDetail.trace_id && (
                <Box sx={{ mb: 3 }}>
                  <Alert
                    severity="info"
                    action={
                      <Button
                        size="small"
                        color="primary"
                        endIcon={<ExternalLink size={14} />}
                        onClick={() => navigate(`/runs/${reportDetail.trace_id}`)}
                        sx={{ textTransform: 'none', fontWeight: 600 }}
                      >
                        Open Trace
                      </Button>
                    }
                    sx={{ borderRadius: 2 }}
                  >
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      AI Run Trace Available
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#475569' }}>
                      Trace ID: {reportDetail.trace_id.slice(0, 16)}...
                    </Typography>
                  </Alert>
                </Box>
              )}

              {/* Project Details Box */}
              {reportDetail.project_details && (
                <Card sx={{ p: 2, mb: 3, border: '1px solid #E2E8F0', borderRadius: 2, bgcolor: '#F0FDF4' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <FolderGit2 size={16} color="#059669" />
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#065F46' }}>
                      Project: {reportDetail.project_details.code} – {reportDetail.project_details.name}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 3 }}>
                    <Typography variant="caption" sx={{ color: '#047857' }}>
                      Status: <strong>{reportDetail.project_details.status}</strong>
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#047857' }}>
                      Remaining Budget: <strong>{formatCurrency(reportDetail.project_details.budget_remaining)}</strong>
                    </Typography>
                  </Box>
                </Card>
              )}

              {/* Itemized Lines */}
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0F172A', mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                <FileText size={18} color="#2563EB" />
                Itemized Expense Lines
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {reportDetail.lines.map((line, idx) => (
                  <Card
                    key={line.id || idx}
                    sx={{
                      p: 2,
                      border: '1px solid #E2E8F0',
                      borderRadius: 2,
                      bgcolor: line.exception_flag ? '#FFFBEB' : '#FFFFFF',
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#1E293B' }}>
                          {line.merchant}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 0.5, flexWrap: 'wrap' }}>
                          <Chip label={line.category} size="small" sx={{ fontSize: '0.75rem', height: 22 }} />
                          <Typography variant="caption" sx={{ color: '#64748B' }}>
                            {line.date}
                          </Typography>
                          <Chip label={`Proj: ${line.project_code}`} size="small" variant="outlined" sx={{ fontSize: '0.75rem', height: 22 }} />
                        </Box>
                      </Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0F172A' }}>
                        {formatCurrency(line.amount)}
                      </Typography>
                    </Box>

                    {line.notes && (
                      <Typography variant="body2" sx={{ color: '#475569', fontSize: '0.85rem', mt: 1, wordBreak: 'break-word' }}>
                        <strong>Notes:</strong> {line.notes}
                      </Typography>
                    )}

                    {line.exception_flag && (
                      <Alert severity="warning" sx={{ mt: 1.5, py: 0.5, borderRadius: 1.5 }}>
                        <Typography variant="caption" sx={{ fontWeight: 600, display: 'block' }}>
                          Policy Exception Flagged:
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#B45309', wordBreak: 'break-word' }}>
                          {line.justification || 'Manager justification required for this item.'}
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
    </Box>
  );
};
