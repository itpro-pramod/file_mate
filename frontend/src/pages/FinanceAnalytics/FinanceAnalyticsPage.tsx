import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Divider,
  LinearProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Building,
  CheckCircle,
  Clock,
  DollarSign,
  FileCheck,
  FolderGit2,
  PieChart,
  Receipt,
  RotateCw,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import { api } from '../../services/api';
import { FinanceAnalytics } from '../../types';

export const FinanceAnalyticsPage: React.FC = () => {
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState<FinanceAnalytics | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const data = await api.getFinanceAnalytics();
      setAnalytics(data);
    } catch (err) {
      console.error('Failed to load finance analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amt: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amt);
  };

  const totalExpenditure = (analytics?.total_approved_spend || 0) + (analytics?.total_pending_liability || 0);

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1400, mx: 'auto' }}>
      {/* Top Header */}
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { sm: 'center' }, gap: 2, mb: 3 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <BarChart3 size={28} color="#2563EB" />
            <Typography variant="h5" sx={{ fontWeight: 700, color: '#0F172A' }}>
              Finance & Compliance Analytics
            </Typography>
            <Chip
              label="Finance Controller Persona"
              size="small"
              sx={{ bgcolor: '#EFF6FF', color: '#1D4ED8', fontWeight: 700, border: '1px solid #BFDBFE' }}
            />
          </Box>
          <Typography variant="body2" sx={{ color: '#64748B', mt: 0.5 }}>
            Executive oversight on reimbursable liabilities, category distributions, and compliance rates.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Button
            variant="outlined"
            startIcon={<RotateCw size={16} />}
            onClick={fetchAnalytics}
            sx={{ textTransform: 'none', borderColor: '#CBD5E1', color: '#475569' }}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<FileCheck size={18} />}
            onClick={() => navigate('/finance/approvals')}
            sx={{ textTransform: 'none', bgcolor: '#2563EB', '&:hover': { bgcolor: '#1D4ED8' }, fontWeight: 600 }}
          >
            Open Approvals Queue
          </Button>
        </Box>
      </Box>

      {loading || !analytics ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress size={36} />
        </Box>
      ) : (
        <>
          {/* Top KPI Cards */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 2.5, mb: 4 }}>
            <Card sx={{ p: 2.5, borderRadius: 3, border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
                Pending Liability
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 700, color: '#2563EB', mt: 1 }}>
                {formatCurrency(analytics.total_pending_liability)}
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748B', mt: 0.5, display: 'block' }}>
                {analytics.pending_count} reports waiting for sign-off
              </Typography>
            </Card>

            <Card sx={{ p: 2.5, borderRadius: 3, border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
                Total Approved Spend
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 700, color: '#059669', mt: 1 }}>
                {formatCurrency(analytics.total_approved_spend)}
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748B', mt: 0.5, display: 'block' }}>
                {analytics.approved_count} reports authorized for disbursement
              </Typography>
            </Card>

            <Card sx={{ p: 2.5, borderRadius: 3, border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
                High-Value Submissions
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 700, color: '#7C3AED', mt: 1 }}>
                {analytics.high_value_count}
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748B', mt: 0.5, display: 'block' }}>
                Reports exceeding ₹10,000 threshold
              </Typography>
            </Card>

            <Card sx={{ p: 2.5, borderRadius: 3, border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
                Policy Exception Items
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 700, color: analytics.exception_count > 0 ? '#D97706' : '#64748B', mt: 1 }}>
                {analytics.exception_count}
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748B', mt: 0.5, display: 'block' }}>
                Logged with manager justification
              </Typography>
            </Card>
          </Box>

          {/* Breakdown Section: Categories & Projects */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 3, mb: 4 }}>
            {/* Category Breakdown */}
            <Card sx={{ p: 3, borderRadius: 3, border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                <Receipt size={20} color="#2563EB" />
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#0F172A' }}>
                  Spend Breakdown by Category
                </Typography>
              </Box>
              <Typography variant="body2" sx={{ color: '#64748B', mb: 3 }}>
                Distribution of expenses across reimbursable categories
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                {Object.entries(analytics.spend_by_category).length === 0 ? (
                  <Typography variant="body2" sx={{ color: '#94A3B8' }}>No category spend recorded.</Typography>
                ) : (
                  Object.entries(analytics.spend_by_category).map(([cat, amt]) => {
                    const pct = totalExpenditure > 0 ? Math.round((amt / totalExpenditure) * 100) : 0;
                    return (
                      <Box key={cat}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: '#1E293B' }}>
                            {cat}
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 700, color: '#0F172A' }}>
                            {formatCurrency(amt)} ({pct}%)
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={pct}
                          sx={{
                            height: 8,
                            borderRadius: 4,
                            bgcolor: '#E2E8F0',
                            '& .MuiLinearProgress-bar': {
                              bgcolor: '#2563EB',
                              borderRadius: 4,
                            },
                          }}
                        />
                      </Box>
                    );
                  })
                )}
              </Box>
            </Card>

            {/* Project Spend Breakdown */}
            <Card sx={{ p: 3, borderRadius: 3, border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                <FolderGit2 size={20} color="#059669" />
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#0F172A' }}>
                  Spend Billed by Project Code
                </Typography>
              </Box>
              <Typography variant="body2" sx={{ color: '#64748B', mb: 3 }}>
                Accumulated billables mapped to client projects
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                {Object.entries(analytics.spend_by_project).length === 0 ? (
                  <Typography variant="body2" sx={{ color: '#94A3B8' }}>No project billing recorded.</Typography>
                ) : (
                  Object.entries(analytics.spend_by_project).map(([proj, amt]) => {
                    const isAtlas = proj.toUpperCase() === 'ATLAS';
                    const maxBudget = isAtlas ? 240000 : 1;
                    const burnPct = isAtlas ? Math.min(Math.round((amt / maxBudget) * 100), 100) : 0;
                    return (
                      <Box key={proj}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Chip label={proj} size="small" sx={{ fontWeight: 700, bgcolor: isAtlas ? '#EFF6FF' : '#FEF2F2', color: isAtlas ? '#1D4ED8' : '#DC2626' }} />
                            <Typography variant="body2" sx={{ color: '#64748B' }}>
                              {isAtlas ? 'Budget: ₹2,40,000' : 'Project Closed'}
                            </Typography>
                          </Box>
                          <Typography variant="body2" sx={{ fontWeight: 700, color: '#0F172A' }}>
                            {formatCurrency(amt)}
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={burnPct}
                          sx={{
                            height: 8,
                            borderRadius: 4,
                            bgcolor: '#E2E8F0',
                            '& .MuiLinearProgress-bar': {
                              bgcolor: isAtlas ? '#059669' : '#DC2626',
                              borderRadius: 4,
                            },
                          }}
                        />
                      </Box>
                    );
                  })
                )}
              </Box>
            </Card>
          </Box>
        </>
      )}
    </Box>
  );
};
