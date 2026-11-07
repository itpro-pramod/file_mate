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
  Divider,
  Grid,
  IconButton,
  InputAdornment,
  LinearProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Building,
  Building2,
  Calendar,
  CheckCircle,
  DollarSign,
  ExternalLink,
  Eye,
  FileText,
  Filter,
  FolderGit2,
  IndianRupee,
  Lock,
  Percent,
  PieChart as PieChartIcon,
  Receipt,
  RotateCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Tag,
  TrendingUp,
  User,
  Wallet,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { ExpensePolicy, ProjectExpenseItem, ProjectPortalItem } from '../../types';
import { CategoryChip, PolicyCheckChip, StatusBadge } from '../../components/common/UIBadges';

const CATEGORY_COLORS: Record<string, string> = {
  Meals: '#3B82F6',
  'Local Travel': '#10B981',
  Hotel: '#8B5CF6',
  'Client Entertainment': '#F59E0B',
  Default: '#64748B',
};

export const ProjectDetailPage: React.FC = () => {
  const { projectCode } = useParams<{ projectCode: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [project, setProject] = useState<ProjectPortalItem | null>(null);
  const [policies, setPolicies] = useState<ExpensePolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Expense table filters & pagination
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [exceptionFilter, setExceptionFilter] = useState('ALL');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  useEffect(() => {
    if (projectCode) {
      loadProjectData(projectCode);
    }
  }, [projectCode]);

  const loadProjectData = async (code: string) => {
    setLoading(true);
    setError(null);
    try {
      const [projData, policyList] = await Promise.all([
        api.getProjectDetail(code),
        api.getPolicies().catch(() => []),
      ]);
      setProject(projData);
      setPolicies(policyList);
    } catch (err: any) {
      console.error('Failed to load project details:', err);
      setError(err.response?.data?.detail || `Project '${code}' not found.`);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!project) return;
    try {
      const updated = await api.toggleProjectStatus(project.code);
      setProject(updated);
    } catch (err) {
      console.error('Failed to toggle status:', err);
    }
  };

  const formatCurrency = (amt: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amt);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress size={40} />
      </Box>
    );
  }

  if (error || !project) {
    return (
      <Box sx={{ p: 4, maxWidth: 1000, mx: 'auto' }}>
        <Button
          startIcon={<ArrowLeft size={18} />}
          onClick={() => navigate('/projects')}
          sx={{ mb: 3, textTransform: 'none', color: '#475569' }}
        >
          Back to Projects
        </Button>
        <Alert severity="error" sx={{ borderRadius: 3 }}>
          {error || 'Project not found.'}
        </Alert>
      </Box>
    );
  }

  const isActive = project.status.toLowerCase() === 'active';

  // Category breakdown for chart
  const categorySpendMap: Record<string, number> = {};
  project.expenses.forEach((line) => {
    categorySpendMap[line.category] = (categorySpendMap[line.category] || 0) + line.amount;
  });

  const categoryChartData = Object.entries(categorySpendMap).map(([name, value]) => ({
    name,
    value: Math.round(value),
  }));

  // Filtering expenses
  const filteredExpenses = project.expenses.filter((exp) => {
    const matchesSearch =
      !search ||
      exp.merchant.toLowerCase().includes(search.toLowerCase()) ||
      exp.report_number.toLowerCase().includes(search.toLowerCase()) ||
      (exp.employee_name && exp.employee_name.toLowerCase().includes(search.toLowerCase())) ||
      (exp.notes && exp.notes.toLowerCase().includes(search.toLowerCase()));

    const matchesCategory = categoryFilter === 'ALL' || exp.category === categoryFilter;
    const matchesException =
      exceptionFilter === 'ALL' ||
      (exceptionFilter === 'EXCEPTION' && exp.exception_flag) ||
      (exceptionFilter === 'COMPLIANT' && !exp.exception_flag);

    return matchesSearch && matchesCategory && matchesException;
  });

  const paginatedExpenses = filteredExpenses.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  const totalExceptions = project.expenses.filter((e) => e.exception_flag).length;
  const complianceRate =
    project.expenses.length > 0
      ? Math.round(((project.expenses.length - totalExceptions) / project.expenses.length) * 100)
      : 100;

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1400, mx: 'auto' }}>
      {/* Top Navigation & Breadcrumb */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<ArrowLeft size={16} />}
            onClick={() => navigate('/projects')}
            sx={{
              textTransform: 'none',
              borderColor: '#CBD5E1',
              color: '#334155',
              fontWeight: 600,
              bgcolor: '#FFFFFF',
              '&:hover': { bgcolor: '#F8FAFC' },
            }}
          >
            Back to Projects
          </Button>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" sx={{ color: '#64748B', fontWeight: 500 }}>
              Projects
            </Typography>
            <Typography variant="body2" sx={{ color: '#94A3B8' }}>
              /
            </Typography>
            <Typography variant="body2" sx={{ color: '#0F172A', fontWeight: 700 }}>
              {project.code}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
          {user?.role === 'Finance Controller' && (
            <Button
              variant="outlined"
              size="small"
              onClick={handleToggleStatus}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                color: isActive ? '#DC2626' : '#059669',
                borderColor: isActive ? '#FECACA' : '#A7F3D0',
                bgcolor: isActive ? '#FEF2F2' : '#ECFDF5',
                '&:hover': { bgcolor: isActive ? '#FEE2E2' : '#D1FAE5' },
              }}
            >
              {isActive ? 'Close Project to Billing' : 'Reactivate Project'}
            </Button>
          )}
          <Button
            variant="contained"
            startIcon={<Receipt size={16} />}
            onClick={() => navigate('/assistant')}
            sx={{
              textTransform: 'none',
              bgcolor: '#2563EB',
              '&:hover': { bgcolor: '#1D4ED8' },
              fontWeight: 600,
            }}
          >
            File Expense
          </Button>
        </Box>
      </Box>

      {/* Project Hero Header Card */}
      <Card
        sx={{
          p: 3.5,
          borderRadius: 3,
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          border: '1px solid',
          borderColor: isActive ? '#BFDBFE' : '#FECACA',
          bgcolor: '#FFFFFF',
          mb: 3,
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', alignItems: { md: 'flex-start' }, gap: 2 }}>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: '10px',
                  bgcolor: isActive ? '#EFF6FF' : '#FEF2F2',
                  color: isActive ? '#2563EB' : '#DC2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <FolderGit2 size={24} />
              </Box>
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: '#0F172A' }}>
                    {project.name}
                  </Typography>
                  <Chip
                    label={project.code}
                    size="small"
                    sx={{
                      fontWeight: 800,
                      bgcolor: '#EFF6FF',
                      color: '#1D4ED8',
                      border: '1px solid #BFDBFE',
                      fontSize: '0.8rem',
                    }}
                  />
                  <Chip
                    label={project.status.toUpperCase()}
                    size="small"
                    icon={isActive ? <CheckCircle size={14} /> : <Lock size={14} />}
                    sx={{
                      fontWeight: 700,
                      bgcolor: isActive ? '#ECFDF5' : '#FEF2F2',
                      color: isActive ? '#047857' : '#B91C1C',
                      border: '1px solid',
                      borderColor: isActive ? '#A7F3D0' : '#FECACA',
                    }}
                  />
                </Box>
                <Typography variant="body2" sx={{ color: '#475569', mt: 0.5 }}>
                  <strong>Client:</strong> {project.client}
                </Typography>
              </Box>
            </Box>

            <Typography variant="body2" sx={{ color: '#334155', mt: 1.5, maxWidth: 900, lineHeight: 1.6 }}>
              {project.description}
            </Typography>
          </Box>

          <Card
            variant="outlined"
            sx={{
              p: 2,
              borderRadius: 2.5,
              bgcolor: isActive ? '#F8FAFC' : '#FFFDFD',
              minWidth: 260,
              border: '1px solid #E2E8F0',
            }}
          >
            <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>
              Guardrail Status
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
              {isActive ? (
                <>
                  <ShieldCheck size={20} color="#059669" />
                  <Typography variant="subtitle2" sx={{ color: '#047857', fontWeight: 700 }}>
                    Active & Eligible for Billing
                  </Typography>
                </>
              ) : (
                <>
                  <ShieldAlert size={20} color="#DC2626" />
                  <Typography variant="subtitle2" sx={{ color: '#B91C1C', fontWeight: 700 }}>
                    Closed — Filing Blocked
                  </Typography>
                </>
              )}
            </Box>
            <Typography variant="caption" sx={{ color: '#64748B', display: 'block', mt: 0.5 }}>
              Guardrail 3 validates project open status at AI runtime.
            </Typography>
          </Card>
        </Box>
      </Card>

      {/* KPI Metrics Summary Grid */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(4, 1fr)' }, gap: 2.5, mb: 3 }}>
        <Card sx={{ p: 2.5, borderRadius: 3, boxShadow: '0 2px 6px rgba(0,0,0,0.04)', border: '1px solid #E2E8F0' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Box>
              <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>
                Allocated Budget
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 800, color: '#0F172A', mt: 0.5 }}>
                {formatCurrency(project.initial_budget)}
              </Typography>
            </Box>
            <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: '#EFF6FF', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Wallet size={20} />
            </Box>
          </Box>
          <Typography variant="caption" sx={{ color: '#64748B', display: 'block', mt: 1 }}>
            Total project allocation
          </Typography>
        </Card>

        <Card sx={{ p: 2.5, borderRadius: 3, boxShadow: '0 2px 6px rgba(0,0,0,0.04)', border: '1px solid #E2E8F0' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Box>
              <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>
                Total Billed Spend
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 800, color: '#2563EB', mt: 0.5 }}>
                {formatCurrency(project.total_billed)}
              </Typography>
            </Box>
            <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: '#EFF6FF', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp size={20} />
            </Box>
          </Box>
          <Typography variant="caption" sx={{ color: '#64748B', display: 'block', mt: 1 }}>
            Across {project.expense_count} submitted expenses
          </Typography>
        </Card>

        <Card sx={{ p: 2.5, borderRadius: 3, boxShadow: '0 2px 6px rgba(0,0,0,0.04)', border: '1px solid #E2E8F0' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Box>
              <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>
                Remaining Balance
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 800, color: project.budget_remaining > 0 ? '#059669' : '#DC2626', mt: 0.5 }}>
                {formatCurrency(project.budget_remaining)}
              </Typography>
            </Box>
            <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: '#ECFDF5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IndianRupee size={20} />
            </Box>
          </Box>
          <Typography variant="caption" sx={{ color: '#64748B', display: 'block', mt: 1 }}>
            Available budget runway
          </Typography>
        </Card>

        <Card sx={{ p: 2.5, borderRadius: 3, boxShadow: '0 2px 6px rgba(0,0,0,0.04)', border: '1px solid #E2E8F0' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>
              Budget Utilization
            </Typography>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: project.burn_percentage > 85 ? '#DC2626' : '#2563EB' }}>
              {project.burn_percentage}%
            </Typography>
          </Box>
          <Box sx={{ mt: 1.5, mb: 1 }}>
            <LinearProgress
              variant="determinate"
              value={Math.min(100, project.burn_percentage)}
              sx={{
                height: 8,
                borderRadius: 4,
                bgcolor: '#E2E8F0',
                '& .MuiLinearProgress-bar': {
                  bgcolor: project.burn_percentage > 85 ? '#DC2626' : project.burn_percentage > 60 ? '#F59E0B' : '#2563EB',
                },
              }}
            />
          </Box>
          <Typography variant="caption" sx={{ color: '#64748B', display: 'block' }}>
            {project.status.toLowerCase() === 'closed' ? 'Closed to billing' : `${100 - project.burn_percentage}% budget remaining`}
          </Typography>
        </Card>
      </Box>

      {/* Two-Column Analytics & Policy Rules Card */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 3, mb: 4 }}>
        {/* Left: Spend by Category Chart */}
        <Card sx={{ p: 3, borderRadius: 3, boxShadow: '0 2px 6px rgba(0,0,0,0.04)', border: '1px solid #E2E8F0' }}>
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <PieChartIcon size={20} color="#2563EB" />
            Spending Breakdown for {project.code}
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748B', mb: 2 }}>
            Expenditure distribution by expense category billed to this project.
          </Typography>

          {categoryChartData.length > 0 ? (
            <Box sx={{ height: 240, display: 'flex', alignItems: 'center' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {categoryChartData.map((entry, idx) => (
                      <Cell
                        key={`cell-${idx}`}
                        fill={CATEGORY_COLORS[entry.name] || CATEGORY_COLORS.Default}
                      />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    formatter={(val: number) => [formatCurrency(val), 'Billed Amount']}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </Box>
          ) : (
            <Box sx={{ py: 6, textAlign: 'center' }}>
              <Receipt size={32} color="#94A3B8" />
              <Typography variant="body2" sx={{ color: '#64748B', mt: 1 }}>
                No expenses billed to {project.code} yet.
              </Typography>
            </Box>
          )}

          <Divider sx={{ my: 2 }} />

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600 }}>
              POLICY COMPLIANCE: <strong>{complianceRate}%</strong>
            </Typography>
            <Chip
              size="small"
              icon={totalExceptions === 0 ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
              label={totalExceptions === 0 ? 'Zero Policy Exceptions' : `${totalExceptions} Exception(s) Flagged`}
              sx={{
                bgcolor: totalExceptions === 0 ? '#ECFDF5' : '#FEF3C7',
                color: totalExceptions === 0 ? '#047857' : '#B45309',
                fontWeight: 600,
              }}
            />
          </Box>
        </Card>

        {/* Right: Policy & Billing Guidelines */}
        <Card sx={{ p: 3, borderRadius: 3, boxShadow: '0 2px 6px rgba(0,0,0,0.04)', border: '1px solid #E2E8F0' }}>
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <ShieldCheck size={20} color="#059669" />
            Project Billing Guidelines & Policy Caps
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748B', mb: 2 }}>
            Rules enforced when filing and approving expense lines against {project.code}.
          </Typography>

          <Paper
            variant="outlined"
            sx={{
              p: 2,
              borderRadius: 2,
              bgcolor: '#F8FAFC',
              border: '1px solid #E2E8F0',
              mb: 2.5,
            }}
          >
            <Typography variant="caption" sx={{ color: '#475569', fontWeight: 700, textTransform: 'uppercase' }}>
              Client Specific Guidelines
            </Typography>
            <Typography variant="body2" sx={{ color: '#1E293B', mt: 0.5, lineHeight: 1.5 }}>
              {project.billing_guidelines}
            </Typography>
          </Paper>

          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0F172A', mb: 1 }}>
            Standard Company Caps Enforced
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {policies.map((pol) => (
              <Box
                key={pol.id}
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  p: 1.2,
                  borderRadius: 1.5,
                  bgcolor: '#FFFFFF',
                  border: '1px solid #F1F5F9',
                }}
              >
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#1E293B' }}>
                    {pol.category}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#64748B' }}>
                    {pol.rule_description}
                  </Typography>
                </Box>
                <Chip
                  label={pol.limit_amount ? `Max ₹${pol.limit_amount.toLocaleString('en-IN')}` : 'Pre-Approval Req.'}
                  size="small"
                  sx={{
                    fontWeight: 700,
                    bgcolor: '#EFF6FF',
                    color: '#1D4ED8',
                    fontSize: '0.75rem',
                  }}
                />
              </Box>
            ))}
          </Box>
        </Card>
      </Box>

      {/* Itemized Expenses Data Grid with Filters & Pagination */}
      <Card sx={{ borderRadius: 3, boxShadow: '0 2px 8px rgba(0,0,0,0.04)', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        {/* Table Filter Toolbar */}
        <Box
          sx={{
            p: 2.5,
            bgcolor: '#FAFAFA',
            borderBottom: '1px solid #E2E8F0',
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            justifyContent: 'space-between',
            alignItems: { md: 'center' },
            gap: 2,
          }}
        >
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 1 }}>
              <Receipt size={20} color="#2563EB" />
              Expenses Billed to {project.code}
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748B' }}>
              Showing {filteredExpenses.length} expense line(s) matching criteria
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
            <TextField
              size="small"
              placeholder="Search merchant, report #..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search size={16} color="#94A3B8" />
                  </InputAdornment>
                ),
              }}
              sx={{ width: { xs: '100%', sm: 220 }, bgcolor: '#FFFFFF' }}
            />

            <TextField
              select
              size="small"
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(0);
              }}
              SelectProps={{ native: true }}
              sx={{ minWidth: 130, bgcolor: '#FFFFFF' }}
            >
              <option value="ALL">All Categories</option>
              <option value="Meals">Meals</option>
              <option value="Local Travel">Local Travel</option>
              <option value="Hotel">Hotel</option>
              <option value="Client Entertainment">Client Entertainment</option>
            </TextField>

            <TextField
              select
              size="small"
              value={exceptionFilter}
              onChange={(e) => {
                setExceptionFilter(e.target.value);
                setPage(0);
              }}
              SelectProps={{ native: true }}
              sx={{ minWidth: 140, bgcolor: '#FFFFFF' }}
            >
              <option value="ALL">All Statuses</option>
              <option value="COMPLIANT">Compliant Only</option>
              <option value="EXCEPTION">Exceptions Only</option>
            </TextField>
          </Box>
        </Box>

        {/* Table Content */}
        <TableContainer>
          <Table>
            <TableHead sx={{ bgcolor: '#F8FAFC' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.8rem' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <FileText size={14} color="#2563EB" /> REPORT #
                  </Box>
                </TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.8rem' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <Calendar size={14} color="#64748B" /> DATE
                  </Box>
                </TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.8rem' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <User size={14} color="#64748B" /> SUBMITTER
                  </Box>
                </TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.8rem' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <Tag size={14} color="#64748B" /> CATEGORY
                  </Box>
                </TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.8rem' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <Building2 size={14} color="#64748B" /> MERCHANT
                  </Box>
                </TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.8rem', textAlign: 'right' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.75 }}>
                    <IndianRupee size={14} color="#059669" /> AMOUNT
                  </Box>
                </TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.8rem' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <ShieldCheck size={14} color="#64748B" /> POLICY CHECK
                  </Box>
                </TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.8rem' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <Activity size={14} color="#64748B" /> REPORT STATUS
                  </Box>
                </TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.8rem', textAlign: 'center' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.75 }}>
                    <Eye size={14} color="#64748B" /> ACTION
                  </Box>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedExpenses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} sx={{ textAlign: 'center', py: 6, color: '#64748B' }}>
                    <Receipt size={32} color="#94A3B8" />
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      No expenses found matching the selected filters.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedExpenses.map((exp) => (
                  <TableRow
                    key={exp.id}
                    hover
                    sx={{
                      '&:last-child td, &:last-child th': { border: 0 },
                      bgcolor: exp.exception_flag ? '#FFFDF8' : 'inherit',
                    }}
                  >
                    <TableCell>
                      <Button
                        size="small"
                        startIcon={<FileText size={14} />}
                        onClick={() => navigate(`/expenses/${exp.report_number}`)}
                        sx={{
                          textTransform: 'none',
                          fontWeight: 700,
                          color: '#2563EB',
                          p: 0,
                          minWidth: 0,
                          '&:hover': { textDecoration: 'underline', bgcolor: 'transparent' },
                        }}
                      >
                        {exp.report_number}
                      </Button>
                    </TableCell>
                    <TableCell sx={{ color: '#475569', whiteSpace: 'nowrap' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        <Calendar size={13} color="#94A3B8" />
                        {exp.date}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Avatar sx={{ width: 26, height: 26, fontSize: '0.7rem', bgcolor: '#3B82F6' }}>
                          {(exp.employee_name || exp.employee_id).slice(0, 2).toUpperCase()}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: '#1E293B', lineHeight: 1.2 }}>
                            {exp.employee_name || exp.employee_id}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#94A3B8' }}>
                            {exp.employee_id}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <CategoryChip category={exp.category} />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75 }}>
                        <Building2 size={15} color="#94A3B8" style={{ marginTop: 2 }} />
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: '#0F172A', lineHeight: 1.2 }}>
                            {exp.merchant}
                          </Typography>
                          {exp.notes && (
                            <Typography variant="caption" sx={{ color: '#64748B', display: 'block', maxWidth: 220 }} noWrap>
                              {exp.notes}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ textAlign: 'right', fontWeight: 700, color: '#0F172A' }}>
                      {formatCurrency(exp.amount)}
                    </TableCell>
                    <TableCell>
                      <PolicyCheckChip exception_flag={exp.exception_flag} justification={exp.justification} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={exp.status} />
                    </TableCell>
                    <TableCell sx={{ textAlign: 'center' }}>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<Eye size={13} />}
                        onClick={() => navigate(`/expenses/${exp.report_number}`)}
                        sx={{ textTransform: 'none', fontSize: '0.75rem', py: 0.3 }}
                      >
                        Inspect
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Pagination Controls */}
        <TablePagination
          rowsPerPageOptions={[5, 10, 25]}
          component="div"
          count={filteredExpenses.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          sx={{ borderTop: '1px solid #E2E8F0' }}
        />
      </Card>
    </Box>
  );
};
