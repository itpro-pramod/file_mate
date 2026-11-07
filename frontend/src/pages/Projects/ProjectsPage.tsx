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
  Grid,
  IconButton,
  InputAdornment,
  LinearProgress,
  Paper,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Activity,
  AlertCircle,
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  ArrowUpDown,
  Briefcase,
  Building,
  Building2,
  CheckCircle,
  Clock,
  DollarSign,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  FileText,
  Filter,
  FolderGit2,
  IndianRupee,
  Lock,
  PieChart as PieChartIcon,
  PlusCircle,
  Receipt,
  RotateCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Tag,
  TrendingUp,
  Wallet,
  X,
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

const PROJECT_PALETTE = ['#2563EB', '#10B981', '#8B5CF6', '#F59E0B', '#EC4899'];

export const ProjectsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [projects, setProjects] = useState<ProjectPortalItem[]>([]);
  const [policies, setPolicies] = useState<ExpensePolicy[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  // Grid Search & Filter State
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState<'budget' | 'spend' | 'burn' | 'name'>('spend');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Create Project Modal State
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    code: '',
    name: '',
    client: '',
    initial_budget: 500000,
    description: '',
    billing_guidelines: '',
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [projData, policyList] = await Promise.all([
        api.getProjectsPortal(),
        api.getPolicies().catch(() => []),
      ]);
      setProjects(projData);
      setPolicies(policyList);
    } catch (err) {
      console.error('Failed to load project data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleProjectStatus = async (code: string) => {
    try {
      await api.toggleProjectStatus(code);
      await fetchData();
    } catch (err) {
      console.error('Failed to toggle project status:', err);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.code.trim() || !createForm.name.trim()) {
      setCreateError('Project code and name are required.');
      return;
    }
    setCreateLoading(true);
    setCreateError(null);
    try {
      await api.createProject({
        code: createForm.code.trim().toUpperCase(),
        name: createForm.name.trim(),
        client: createForm.client.trim() || undefined,
        initial_budget: Number(createForm.initial_budget) || 0,
        description: createForm.description.trim() || undefined,
        billing_guidelines: createForm.billing_guidelines.trim() || undefined,
      });
      setCreateDialogOpen(false);
      setCreateForm({
        code: '',
        name: '',
        client: '',
        initial_budget: 500000,
        description: '',
        billing_guidelines: '',
      });
      await fetchData();
    } catch (err: any) {
      console.error('Failed to create project:', err);
      setCreateError(err.response?.data?.detail || 'Failed to create project.');
    } finally {
      setCreateLoading(false);
    }
  };

  const formatCurrency = (amt: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amt);
  };

  // KPI Calculations across all projects
  const totalProjects = projects.length;
  const activeProjectsCount = projects.filter((p) => p.status.toLowerCase() === 'active').length;
  const totalAllocatedBudget = projects.reduce((sum, p) => sum + p.initial_budget, 0);
  const totalBilledSpend = projects.reduce((sum, p) => sum + p.total_billed, 0);
  const totalRemainingBudget = projects.reduce((sum, p) => sum + p.budget_remaining, 0);
  const overallBurnPct = totalAllocatedBudget > 0 ? ((totalBilledSpend / totalAllocatedBudget) * 100).toFixed(1) : '0.0';

  // Total expenses and compliance count
  let totalExpensesCount = 0;
  let totalExceptionsCount = 0;
  projects.forEach((p) => {
    totalExpensesCount += p.expense_count;
    totalExceptionsCount += p.expenses.filter((e) => e.exception_flag).length;
  });
  const overallComplianceRate = totalExpensesCount > 0
    ? Math.round(((totalExpensesCount - totalExceptionsCount) / totalExpensesCount) * 100)
    : 100;

  // Filter & Sort Projects for Table Grid
  const filteredProjects = projects
    .filter((p) => {
      const matchesSearch =
        !search ||
        p.code.toLowerCase().includes(search.toLowerCase()) ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.client.toLowerCase().includes(search.toLowerCase()) ||
        p.description.toLowerCase().includes(search.toLowerCase());

      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && p.status.toLowerCase() === 'active') ||
        (statusFilter === 'CLOSED' && p.status.toLowerCase() === 'closed');

      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      if (sortBy === 'budget') return b.initial_budget - a.initial_budget;
      if (sortBy === 'spend') return b.total_billed - a.total_billed;
      if (sortBy === 'burn') return b.burn_percentage - a.burn_percentage;
      return a.name.localeCompare(b.name);
    });

  const paginatedProjects = filteredProjects.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  // Chart Data: Spend by Project comparison
  const projectComparisonData = projects.map((p) => ({
    name: p.code,
    fullName: p.name,
    budget: Math.round(p.initial_budget),
    billed: Math.round(p.total_billed),
    remaining: Math.round(p.budget_remaining),
  }));

  const projectShareData = projects
    .filter((p) => p.total_billed > 0)
    .map((p) => ({
      name: p.code,
      value: Math.round(p.total_billed),
    }));

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1400, mx: 'auto' }}>
      {/* Page Header */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between',
          alignItems: { sm: 'center' },
          gap: 2,
          mb: 3,
        }}
      >
        <Box>
          <Typography
            variant="h5"
            sx={{ fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 1.5 }}
          >
            <FolderGit2 size={28} color="#2563EB" />
            Project Portal & Budget Governance
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748B', mt: 0.5 }}>
            Enterprise project directory with live budget runway, itemized expense audits, and policy enforcement rules.
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            startIcon={<RotateCw size={16} />}
            onClick={fetchData}
            sx={{ textTransform: 'none', borderColor: '#CBD5E1', color: '#475569', bgcolor: '#FFFFFF' }}
          >
            Refresh
          </Button>

          {user?.role === 'Finance Controller' && (
            <Button
              variant="contained"
              startIcon={<PlusCircle size={18} />}
              onClick={() => {
                setCreateError(null);
                setCreateDialogOpen(true);
              }}
              sx={{
                textTransform: 'none',
                bgcolor: '#10B981',
                '&:hover': { bgcolor: '#059669' },
                fontWeight: 600,
              }}
            >
              Add Project
            </Button>
          )}

          <Button
            variant="contained"
            startIcon={<Receipt size={18} />}
            onClick={() => navigate('/expenses')}
            sx={{
              textTransform: 'none',
              bgcolor: '#2563EB',
              '&:hover': { bgcolor: '#1D4ED8' },
              fontWeight: 600,
            }}
          >
            View My Expenses
          </Button>
        </Box>
      </Box>

      {/* KPI Overview Cards */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(5, 1fr)' },
          gap: 2.5,
          mb: 3,
        }}
      >
        <Card sx={{ p: 2.5, borderRadius: 3, boxShadow: '0 2px 6px rgba(0,0,0,0.04)', border: '1px solid #E2E8F0', position: 'relative' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Box>
              <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>
                Total Projects
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 800, color: '#0F172A', mt: 0.5 }}>
                {totalProjects}
              </Typography>
            </Box>
            <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: '#EFF6FF', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FolderGit2 size={20} />
            </Box>
          </Box>
          <Typography variant="caption" sx={{ color: '#059669', fontWeight: 600, mt: 1, display: 'block' }}>
            {activeProjectsCount} Active · {totalProjects - activeProjectsCount} Closed
          </Typography>
        </Card>

        <Card sx={{ p: 2.5, borderRadius: 3, boxShadow: '0 2px 6px rgba(0,0,0,0.04)', border: '1px solid #E2E8F0', position: 'relative' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Box>
              <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>
                Enterprise Budget
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 800, color: '#0F172A', mt: 0.5 }}>
                {formatCurrency(totalAllocatedBudget)}
              </Typography>
            </Box>
            <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: '#ECFDF5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Wallet size={20} />
            </Box>
          </Box>
          <Typography variant="caption" sx={{ color: '#64748B', display: 'block', mt: 1 }}>
            Summed allocations
          </Typography>
        </Card>

        <Card sx={{ p: 2.5, borderRadius: 3, boxShadow: '0 2px 6px rgba(0,0,0,0.04)', border: '1px solid #E2E8F0', position: 'relative' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Box>
              <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>
                Total Spent / Billed
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 800, color: '#2563EB', mt: 0.5 }}>
                {formatCurrency(totalBilledSpend)}
              </Typography>
            </Box>
            <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: '#EFF6FF', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp size={20} />
            </Box>
          </Box>
          <Typography variant="caption" sx={{ color: '#2563EB', fontWeight: 600, display: 'block', mt: 1 }}>
            {overallBurnPct}% total utilization
          </Typography>
        </Card>

        <Card sx={{ p: 2.5, borderRadius: 3, boxShadow: '0 2px 6px rgba(0,0,0,0.04)', border: '1px solid #E2E8F0', position: 'relative' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Box>
              <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>
                Remaining Runway
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 800, color: '#059669', mt: 0.5 }}>
                {formatCurrency(totalRemainingBudget)}
              </Typography>
            </Box>
            <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: '#ECFDF5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IndianRupee size={20} />
            </Box>
          </Box>
          <Typography variant="caption" sx={{ color: '#059669', fontWeight: 600, display: 'block', mt: 1 }}>
            Healthy balance
          </Typography>
        </Card>

        <Card sx={{ p: 2.5, borderRadius: 3, boxShadow: '0 2px 6px rgba(0,0,0,0.04)', border: '1px solid #E2E8F0', position: 'relative' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Box>
              <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>
                Policy Compliance
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 800, color: '#0F172A', mt: 0.5 }}>
                {overallComplianceRate}%
              </Typography>
            </Box>
            <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: '#FFFBEB', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldCheck size={20} />
            </Box>
          </Box>
          <Typography variant="caption" sx={{ color: totalExceptionsCount > 0 ? '#D97706' : '#059669', fontWeight: 600, display: 'block', mt: 1 }}>
            {totalExceptionsCount} flagged exceptions
          </Typography>
        </Card>
      </Box>

      {/* View Tabs */}
      <Paper sx={{ mb: 3, borderRadius: 3, border: '1px solid #E2E8F0', boxShadow: 'none' }}>
        <Tabs
          value={activeTab}
          onChange={(_, val) => setActiveTab(val)}
          sx={{
            px: 2,
            borderBottom: '1px solid #E2E8F0',
            '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, fontSize: '0.95rem', py: 2 },
          }}
        >
          <Tab
            icon={<FileSpreadsheet size={18} />}
            iconPosition="start"
            label={`Projects Directory (${filteredProjects.length})`}
          />
          <Tab
            icon={<TrendingUp size={18} />}
            iconPosition="start"
            label="Cross-Project Spend Analytics"
          />
          <Tab
            icon={<ShieldCheck size={18} />}
            iconPosition="start"
            label="Policy Governance Matrix"
          />
        </Tabs>

        {/* TAB 0: PROJECTS GRID WITH PAGINATION */}
        {activeTab === 0 && (
          <Box sx={{ p: 3 }}>
            {/* Filter & Search Bar */}
            <Box
              sx={{
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                justifyContent: 'space-between',
                gap: 2,
                mb: 3,
                alignItems: { sm: 'center' },
              }}
            >
              <TextField
                size="small"
                placeholder="Search by code, title, client..."
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
                sx={{ width: { xs: '100%', sm: 300 } }}
              />

              <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                <TextField
                  select
                  size="small"
                  label="Status"
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(0);
                  }}
                  SelectProps={{ native: true }}
                  sx={{ minWidth: 140 }}
                >
                  <option value="ALL">All Statuses</option>
                  <option value="ACTIVE">Active Only</option>
                  <option value="CLOSED">Closed Only</option>
                </TextField>

                <TextField
                  select
                  size="small"
                  label="Sort By"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  SelectProps={{ native: true }}
                  sx={{ minWidth: 160 }}
                >
                  <option value="spend">Highest Spend</option>
                  <option value="budget">Highest Budget</option>
                  <option value="burn">Highest Burn %</option>
                  <option value="name">Project Name</option>
                </TextField>
              </Box>
            </Box>

            {/* Interactive Data Grid */}
            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2.5, border: '1px solid #E2E8F0' }}>
              <Table>
                <TableHead sx={{ bgcolor: '#F8FAFC' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.8rem' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        <FolderGit2 size={15} color="#2563EB" />
                        PROJECT CODE & TITLE
                      </Box>
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.8rem' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        <Activity size={15} color="#64748B" />
                        STATUS
                      </Box>
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.8rem', textAlign: 'right' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.75 }}>
                        <Wallet size={15} color="#64748B" />
                        ALLOCATED BUDGET
                      </Box>
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.8rem' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        <TrendingUp size={15} color="#2563EB" />
                        TOTAL BILLED (BURN)
                      </Box>
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.8rem', textAlign: 'right' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.75 }}>
                        <IndianRupee size={15} color="#059669" />
                        REMAINING
                      </Box>
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.8rem', textAlign: 'center' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.75 }}>
                        <Receipt size={15} color="#64748B" />
                        EXPENSES
                      </Box>
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.8rem', textAlign: 'center' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.75 }}>
                        <Eye size={15} color="#64748B" />
                        ACTIONS
                      </Box>
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} sx={{ textAlign: 'center', py: 6 }}>
                        <CircularProgress size={32} />
                      </TableCell>
                    </TableRow>
                  ) : paginatedProjects.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} sx={{ textAlign: 'center', py: 6, color: '#64748B' }}>
                        <FolderGit2 size={32} color="#94A3B8" />
                        <Typography variant="body2" sx={{ mt: 1 }}>
                          No projects found matching the criteria.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedProjects.map((proj) => {
                      const isActive = proj.status.toLowerCase() === 'active';
                      return (
                        <TableRow
                          key={proj.code}
                          hover
                          sx={{
                            cursor: 'pointer',
                            '&:last-child td, &:last-child th': { border: 0 },
                          }}
                          onClick={() => navigate(`/projects/${proj.code}`)}
                        >
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                              <Box
                                sx={{
                                  width: 36,
                                  height: 36,
                                  borderRadius: 2,
                                  bgcolor: isActive ? '#EFF6FF' : '#FEF2F2',
                                  color: isActive ? '#2563EB' : '#DC2626',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontWeight: 800,
                                  fontSize: '0.8rem',
                                }}
                              >
                                {proj.code.slice(0, 3)}
                              </Box>
                              <Box>
                                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0F172A' }}>
                                  {proj.name}
                                </Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                                  <Typography variant="caption" sx={{ color: '#2563EB', fontWeight: 700 }}>
                                    {proj.code}
                                  </Typography>
                                  {proj.client && (
                                    <Typography variant="caption" sx={{ color: '#64748B' }}>
                                      • {proj.client}
                                    </Typography>
                                  )}
                                </Box>
                              </Box>
                            </Box>
                          </TableCell>

                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <StatusBadge status={proj.status} />
                          </TableCell>

                          <TableCell sx={{ textAlign: 'right', fontWeight: 700, color: '#0F172A' }}>
                            {formatCurrency(proj.initial_budget)}
                          </TableCell>

                          <TableCell sx={{ minWidth: 160 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                              <Typography variant="body2" sx={{ fontWeight: 700, color: '#2563EB' }}>
                                {formatCurrency(proj.total_billed)}
                              </Typography>
                              <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748B' }}>
                                {proj.burn_percentage}%
                              </Typography>
                            </Box>
                            <LinearProgress
                              variant="determinate"
                              value={Math.min(100, proj.burn_percentage)}
                              sx={{
                                height: 6,
                                borderRadius: 3,
                                bgcolor: '#F1F5F9',
                                '& .MuiLinearProgress-bar': {
                                  bgcolor: proj.burn_percentage > 85 ? '#DC2626' : '#2563EB',
                                },
                              }}
                            />
                          </TableCell>

                          <TableCell sx={{ textAlign: 'right', fontWeight: 700, color: proj.budget_remaining > 0 ? '#059669' : '#DC2626' }}>
                            {formatCurrency(proj.budget_remaining)}
                          </TableCell>

                          <TableCell sx={{ textAlign: 'center' }}>
                            <Chip
                              icon={<Receipt size={13} />}
                              label={`${proj.expense_count} receipt(s)`}
                              size="small"
                              sx={{ bgcolor: '#F8FAFC', color: '#475569', fontWeight: 600, border: '1px solid #E2E8F0' }}
                            />
                          </TableCell>

                          <TableCell sx={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', alignItems: 'center' }}>
                              <Tooltip title="View Details" arrow>
                                <IconButton
                                  size="small"
                                  onClick={() => navigate(`/projects/${proj.code}`)}
                                  sx={{
                                    bgcolor: '#EFF6FF',
                                    color: '#2563EB',
                                    border: '1px solid #BFDBFE',
                                    borderRadius: 2,
                                    p: 0.75,
                                    '&:hover': { bgcolor: '#2563EB', color: '#FFFFFF' },
                                  }}
                                >
                                  <Eye size={16} />
                                </IconButton>
                              </Tooltip>

                              {user?.role === 'Finance Controller' && (
                                <Button
                                  size="small"
                                  variant="outlined"
                                  onClick={() => handleToggleProjectStatus(proj.code)}
                                  sx={{
                                    textTransform: 'none',
                                    fontSize: '0.75rem',
                                    py: 0.4,
                                    px: 1,
                                    color: isActive ? '#DC2626' : '#059669',
                                    borderColor: isActive ? '#FECACA' : '#A7F3D0',
                                  }}
                                >
                                  {isActive ? 'Close' : 'Reactivate'}
                                </Button>
                              )}
                            </Box>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Table Pagination */}
            <TablePagination
              rowsPerPageOptions={[5, 10, 25]}
              component="div"
              count={filteredProjects.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={(_, newPage) => setPage(newPage)}
              onRowsPerPageChange={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10));
                setPage(0);
              }}
              sx={{ mt: 1 }}
            />
          </Box>
        )}

        {/* TAB 1: CROSS-PROJECT SPEND ANALYTICS */}
        {activeTab === 1 && (
          <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' }, gap: 3, mb: 4 }}>
              {/* Bar Chart: Budget vs Spend Comparison */}
              <Card variant="outlined" sx={{ p: 3, borderRadius: 2.5, border: '1px solid #E2E8F0' }}>
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#0F172A', mb: 0.5 }}>
                  Budget vs Billed Spend by Project
                </Typography>
                <Typography variant="body2" sx={{ color: '#64748B', mb: 2 }}>
                  Side-by-side comparison of allocated engagement capital against billed expenditures.
                </Typography>

                <Box sx={{ height: 300, width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={projectComparisonData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                      <XAxis dataKey="name" stroke="#64748B" />
                      <YAxis stroke="#64748B" tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`} />
                      <RechartsTooltip formatter={(val: number) => [formatCurrency(val), 'Amount']} />
                      <Legend />
                      <Bar dataKey="budget" name="Allocated Budget" fill="#CBD5E1" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="billed" name="Billed Spend" fill="#2563EB" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="remaining" name="Remaining Runway" fill="#10B981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              </Card>

              {/* Pie Chart: Share of Spend */}
              <Card variant="outlined" sx={{ p: 3, borderRadius: 2.5, border: '1px solid #E2E8F0' }}>
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#0F172A', mb: 0.5 }}>
                  Spending Share by Project
                </Typography>
                <Typography variant="body2" sx={{ color: '#64748B', mb: 2 }}>
                  Percentage breakdown of total company expenditure.
                </Typography>

                {projectShareData.length > 0 ? (
                  <Box sx={{ height: 300, display: 'flex', alignItems: 'center' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={projectShareData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={85}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          {projectShareData.map((_, idx) => (
                            <Cell key={`cell-${idx}`} fill={PROJECT_PALETTE[idx % PROJECT_PALETTE.length]} />
                          ))}
                        </Pie>
                        <RechartsTooltip formatter={(val: number) => [formatCurrency(val), 'Billed']} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </Box>
                ) : (
                  <Box sx={{ py: 8, textAlign: 'center' }}>
                    <Receipt size={32} color="#94A3B8" />
                    <Typography variant="body2" sx={{ color: '#64748B', mt: 1 }}>
                      No expenditure data recorded yet.
                    </Typography>
                  </Box>
                )}
              </Card>
            </Box>

            {/* Detailed Project Spend Table */}
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#0F172A', mb: 2 }}>
              Project Spend & Exception Breakdown
            </Typography>
            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2.5 }}>
              <Table>
                <TableHead sx={{ bgcolor: '#F8FAFC' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, color: '#475569' }}>PROJECT</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#475569', textAlign: 'right' }}>ALLOCATED</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#475569', textAlign: 'right' }}>BILLED</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#475569', textAlign: 'right' }}>REMAINING</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#475569', textAlign: 'center' }}>BURN %</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#475569', textAlign: 'center' }}>EXCEPTIONS</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#475569', textAlign: 'center' }}>ACTION</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {projects.map((p) => {
                    const exceptions = p.expenses.filter((e) => e.exception_flag).length;
                    return (
                      <TableRow key={p.code} hover>
                        <TableCell>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                            {p.name} ({p.code})
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#64748B' }}>
                            {p.client}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(p.initial_budget)}</TableCell>
                        <TableCell sx={{ textAlign: 'right', fontWeight: 700, color: '#2563EB' }}>{formatCurrency(p.total_billed)}</TableCell>
                        <TableCell sx={{ textAlign: 'right', fontWeight: 700, color: p.budget_remaining > 0 ? '#059669' : '#DC2626' }}>
                          {formatCurrency(p.budget_remaining)}
                        </TableCell>
                        <TableCell sx={{ textAlign: 'center', fontWeight: 700 }}>{p.burn_percentage}%</TableCell>
                        <TableCell sx={{ textAlign: 'center' }}>
                          <Chip
                            size="small"
                            label={exceptions === 0 ? '0' : `${exceptions} Flagged`}
                            sx={{
                              bgcolor: exceptions === 0 ? '#ECFDF5' : '#FEF3C7',
                              color: exceptions === 0 ? '#047857' : '#B45309',
                              fontWeight: 700,
                            }}
                          />
                        </TableCell>
                        <TableCell sx={{ textAlign: 'center' }}>
                          <Button
                            size="small"
                            onClick={() => navigate(`/projects/${p.code}`)}
                            sx={{ textTransform: 'none', fontWeight: 600 }}
                          >
                            Drill Down
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* TAB 2: POLICIES AGAINST PROJECTS */}
        {activeTab === 2 && (
          <Box sx={{ p: 3 }}>
            <Alert
              severity="info"
              icon={<ShieldCheck size={20} color="#2563EB" />}
              sx={{ mb: 3, borderRadius: 2.5, bgcolor: '#EFF6FF', border: '1px solid #BFDBFE' }}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#1E40AF' }}>
                Multi-Layer Policy Governance Against Project Codes
              </Typography>
              <Typography variant="body2" sx={{ color: '#1E3A8A', mt: 0.5, fontSize: '0.85rem' }}>
                Every receipt submitted against a project is evaluated against both standard corporate caps and client-specific billing guidelines. Inactive projects (e.g. ORION) are locked by Guardrail 3 at inference time.
              </Typography>
            </Alert>

            {/* Matrix of Policies Across Projects */}
            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2.5 }}>
              <Table>
                <TableHead sx={{ bgcolor: '#F8FAFC' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, color: '#475569' }}>POLICY CATEGORY</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#475569' }}>CORPORATE SPENDING CAP</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#475569' }}>RULE DESCRIPTION</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#475569' }}>ENFORCEMENT LAYER</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#475569' }}>EXCEPTIONS IN LOGGED EXPENSES</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {policies.map((pol) => {
                    const matchingExceptions = projects
                      .flatMap((p) => p.expenses)
                      .filter((e) => e.category === pol.category && e.exception_flag).length;

                    return (
                      <TableRow key={pol.id} hover>
                        <TableCell>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0F172A' }}>
                            {pol.category}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={pol.limit_amount ? `₹${pol.limit_amount.toLocaleString('en-IN')} / ${pol.limit_type}` : 'No Fixed Cap (Pre-Approval Required)'}
                            size="small"
                            sx={{ bgcolor: '#EFF6FF', color: '#1D4ED8', fontWeight: 700 }}
                          />
                        </TableCell>
                        <TableCell sx={{ maxWidth: 360 }}>
                          <Typography variant="body2" sx={{ color: '#475569' }}>
                            {pol.rule_description}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            icon={<Shield size={13} />}
                            label="Guardrail 2 (Policy Caps)"
                            size="small"
                            sx={{ bgcolor: '#F1F5F9', color: '#334155', fontWeight: 600 }}
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            icon={matchingExceptions > 0 ? <AlertTriangle size={13} color="#D97706" /> : <CheckCircle size={13} color="#059669" />}
                            label={matchingExceptions > 0 ? `${matchingExceptions} Exception(s)` : 'Zero Violations'}
                            size="small"
                            sx={{
                              bgcolor: matchingExceptions > 0 ? '#FEF3C7' : '#ECFDF5',
                              color: matchingExceptions > 0 ? '#B45309' : '#047857',
                              fontWeight: 700,
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Project Specific Billing Guidelines Cards */}
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#0F172A', mt: 4, mb: 2 }}>
              Project-Specific Billing Guidelines
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2.5 }}>
              {projects.map((p) => {
                const isActive = p.status.toLowerCase() === 'active';
                return (
                  <Card key={p.code} variant="outlined" sx={{ p: 2.5, borderRadius: 2.5, bgcolor: isActive ? '#FFFFFF' : '#FFFDFD' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0F172A' }}>
                        {p.name}
                      </Typography>
                      <Chip
                        label={p.status}
                        size="small"
                        sx={{
                          fontWeight: 700,
                          bgcolor: isActive ? '#ECFDF5' : '#FEF2F2',
                          color: isActive ? '#047857' : '#B91C1C',
                        }}
                      />
                    </Box>
                    <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600, display: 'block', mb: 1 }}>
                      Client: {p.client}
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#334155', fontSize: '0.85rem', lineHeight: 1.5 }}>
                      {p.billing_guidelines}
                    </Typography>
                    <Button
                      size="small"
                      endIcon={<ArrowRight size={14} />}
                      onClick={() => navigate(`/projects/${p.code}`)}
                      sx={{ textTransform: 'none', mt: 2, p: 0, fontWeight: 600 }}
                    >
                      Inspect Project Details
                    </Button>
                  </Card>
                );
              })}
            </Box>
          </Box>
        )}
      </Paper>

      {/* Centered Add Project Dialog (Finance Controller) */}
      <Dialog
        open={createDialogOpen}
        onClose={() => !createLoading && setCreateDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
          },
        }}
      >
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #E2E8F0',
            pb: 2,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                bgcolor: '#ECFDF5',
                color: '#059669',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Briefcase size={20} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#0F172A', fontSize: '1.1rem' }}>
                Provision New Project
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748B' }}>
                Create project code, client engagement, and budget controls
              </Typography>
            </Box>
          </Box>
          <IconButton
            size="small"
            onClick={() => setCreateDialogOpen(false)}
            disabled={createLoading}
            sx={{ color: '#94A3B8' }}
          >
            <X size={18} />
          </IconButton>
        </DialogTitle>

        <form onSubmit={handleCreateProject}>
          <DialogContent
            sx={{
              p: 3,
              maxHeight: '70vh',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 2.5,
            }}
          >
            {createError && (
              <Alert severity="error" sx={{ borderRadius: 2 }}>
                {createError}
              </Alert>
            )}

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 2 }}>
              <TextField
                label="Project Code"
                placeholder="e.g. VOXORAAI"
                value={createForm.code}
                onChange={(e) => setCreateForm({ ...createForm, code: e.target.value.toUpperCase() })}
                required
                fullWidth
                size="small"
                helperText="Unique uppercase identifier"
              />
              <TextField
                label="Project Name"
                placeholder="e.g. Project VoxoraAI"
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                required
                fullWidth
                size="small"
                helperText="Engagement or project title"
              />
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <TextField
                label="Client / Partner"
                placeholder="e.g. Voxora AI Labs"
                value={createForm.client}
                onChange={(e) => setCreateForm({ ...createForm, client: e.target.value })}
                fullWidth
                size="small"
              />
              <TextField
                label="Initial Budget (₹)"
                type="number"
                placeholder="e.g. 500000"
                value={createForm.initial_budget}
                onChange={(e) => setCreateForm({ ...createForm, initial_budget: Number(e.target.value) })}
                required
                fullWidth
                size="small"
                InputProps={{
                  startAdornment: <InputAdornment position="start">₹</InputAdornment>,
                }}
              />
            </Box>

            <TextField
              label="Project Description"
              placeholder="e.g. Enterprise Generative AI copilot deployment, multi-agent LLM orchestration..."
              value={createForm.description}
              onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
              multiline
              rows={2}
              fullWidth
              size="small"
            />

            <TextField
              label="Billing Guidelines"
              placeholder="e.g. Meals: ₹1,500/day max. Local Travel: ₹3,000/trip max. Hotel: ₹7,000/night max..."
              value={createForm.billing_guidelines}
              onChange={(e) => setCreateForm({ ...createForm, billing_guidelines: e.target.value })}
              multiline
              rows={2}
              fullWidth
              size="small"
              helperText="Guidelines shown to consultants when filing expenses against this project"
            />
          </DialogContent>

          <DialogActions sx={{ p: 2.5, borderTop: '1px solid #E2E8F0', justifyContent: 'space-between' }}>
            <Button
              variant="text"
              onClick={() => setCreateDialogOpen(false)}
              disabled={createLoading}
              sx={{ color: '#64748B', textTransform: 'none' }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={createLoading}
              sx={{
                bgcolor: '#059669',
                '&:hover': { bgcolor: '#047857' },
                textTransform: 'none',
                fontWeight: 600,
                px: 3,
              }}
            >
              {createLoading ? 'Provisioning...' : 'Save & Provision Project'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
};
