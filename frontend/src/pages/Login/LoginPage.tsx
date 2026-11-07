import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
} from '@mui/material';
import {
  Bot,
  CheckCircle,
  Eye,
  EyeOff,
  FileSpreadsheet,
  Lock,
  LogIn,
  Mail,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserCheck,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState('priya.nair@brightpath.com');
  const [password, setPassword] = useState('Admin@321');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(email, password);
      navigate('/assistant');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFillRavi = () => {
    setEmail('ravi.menon@brightpath.com');
    setPassword('Admin@321');
  };

  const handleQuickFillPriya = () => {
    setEmail('priya.nair@brightpath.com');
    setPassword('Admin@321');
  };

  return (
    <Box
      sx={{
        display: 'flex',
        minHeight: '100vh',
        bgcolor: '#0B192C',
      }}
    >
      {/* Left Hero Section */}
      <Box
        sx={{
          flex: '1.2',
          p: { xs: 4, md: 8 },
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, #070F2B 0%, #0B192C 60%, #1E3E62 100%)',
          position: 'relative',
          overflow: 'hidden',
          color: '#FFFFFF',
        }}
      >
        {/* Brand Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: 2.5,
              bgcolor: '#2563EB',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <FileSpreadsheet size={26} color="#FFFFFF" />
          </Box>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: -0.5 }}>
              FileMate
            </Typography>
            <Typography variant="caption" sx={{ color: '#94A3B8', fontSize: '0.8rem' }}>
              Your Expense Assistant
            </Typography>
          </Box>
        </Box>

        {/* Hero Title & Mock Visual */}
        <Box sx={{ my: 'auto', maxWidth: 640 }}>
          <Typography
            variant="h3"
            sx={{
              fontWeight: 800,
              lineHeight: 1.15,
              mb: 2,
              letterSpacing: -1,
            }}
          >
            Turn receipts into{' '}
            <Box component="span" sx={{ color: '#38BDF8' }}>
              approved expense reports
            </Box>
          </Typography>
          <Typography variant="body1" sx={{ color: '#CBD5E1', fontSize: '1.1rem', mb: 5, lineHeight: 1.6 }}>
            AI-powered expense assistant that extracts details, checks policy, and files approved expenses automatically.
          </Typography>

          {/* Visual Diagram: Receipt -> Bot -> Report */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              p: 3,
              bgcolor: 'rgba(255, 255, 255, 0.03)',
              borderRadius: 4,
              border: '1px solid rgba(255, 255, 255, 0.08)',
              backdropFilter: 'blur(10px)',
            }}
          >
            {/* Receipt Card */}
            <Box
              sx={{
                width: 140,
                p: 2,
                bgcolor: '#FFFFFF',
                borderRadius: 2,
                color: '#0F172A',
                boxShadow: 3,
              }}
            >
              <Typography variant="caption" sx={{ fontWeight: 800, color: '#2563EB', display: 'block', mb: 1 }}>
                RECEIPT
              </Typography>
              <Box sx={{ height: 6, bgcolor: '#E2E8F0', borderRadius: 1, mb: 0.8, width: '80%' }} />
              <Box sx={{ height: 6, bgcolor: '#E2E8F0', borderRadius: 1, mb: 0.8, width: '100%' }} />
              <Box sx={{ height: 6, bgcolor: '#E2E8F0', borderRadius: 1, width: '60%' }} />
            </Box>

            <Typography sx={{ color: '#38BDF8', fontSize: '1.5rem', fontWeight: 700 }}>→</Typography>

            {/* AI Agent Node */}
            <Box
              sx={{
                width: 70,
                height: 70,
                borderRadius: '50%',
                bgcolor: '#2563EB',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 25px rgba(37, 99, 235, 0.5)',
              }}
            >
              <Bot size={36} color="#FFFFFF" />
            </Box>

            <Typography sx={{ color: '#38BDF8', fontSize: '1.5rem', fontWeight: 700 }}>→</Typography>

            {/* Approved Expense Card */}
            <Box
              sx={{
                width: 170,
                p: 2,
                bgcolor: '#FFFFFF',
                borderRadius: 2,
                color: '#0F172A',
                boxShadow: 3,
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="caption" sx={{ fontWeight: 700 }}>
                  Expense Report
                </Typography>
                <CheckCircle size={16} color="#10B981" />
              </Box>
              <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.85rem' }}>
                ✈ Travel &nbsp;&nbsp; ₹1,250
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748B', display: 'block' }}>
                Project: ATLAS
              </Typography>
              <Box
                sx={{
                  mt: 1,
                  py: 0.2,
                  px: 0.8,
                  bgcolor: '#ECFDF5',
                  color: '#059669',
                  borderRadius: 1,
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  display: 'inline-block',
                }}
              >
                ✓ Approved
              </Box>
            </Box>
          </Box>
        </Box>

        {/* 4 Feature Columns at bottom */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2, pt: 4, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <Box>
            <Sparkles size={20} color="#38BDF8" />
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mt: 0.5 }}>
              Extract with AI
            </Typography>
            <Typography variant="caption" sx={{ color: '#94A3B8' }}>
              Get structured expense details
            </Typography>
          </Box>
          <Box>
            <ShieldCheck size={20} color="#38BDF8" />
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mt: 0.5 }}>
              Policy Checks
            </Typography>
            <Typography variant="caption" sx={{ color: '#94A3B8' }}>
              Validate rules and limits
            </Typography>
          </Box>
          <Box>
            <UserCheck size={20} color="#38BDF8" />
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mt: 0.5 }}>
              Human Approval
            </Typography>
            <Typography variant="caption" sx={{ color: '#94A3B8' }}>
              Review, edit and approve
            </Typography>
          </Box>
          <Box>
            <TrendingUp size={20} color="#38BDF8" />
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mt: 0.5 }}>
              Audit & Logs
            </Typography>
            <Typography variant="caption" sx={{ color: '#94A3B8' }}>
              Full traceability & run history
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Right Login Form */}
      <Box
        sx={{
          flex: '1',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: { xs: 3, md: 6 },
          bgcolor: '#FFFFFF',
          borderRadius: { md: '24px 0 0 24px' },
        }}
      >
        <Box sx={{ maxWidth: 420, width: '100%' }}>
          {/* Mobile Logo */}
          <Box sx={{ display: { xs: 'flex', md: 'none' }, alignItems: 'center', gap: 1.5, mb: 4 }}>
            <Box
              sx={{
                width: 38,
                height: 38,
                borderRadius: 2,
                bgcolor: '#2563EB',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <FileSpreadsheet size={22} color="#FFFFFF" />
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              FileMate
            </Typography>
          </Box>

          <Typography variant="h4" sx={{ fontWeight: 800, color: '#0F172A', mb: 1 }}>
            Sign In
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748B', mb: 4 }}>
            Access your FileMate workspace
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <Box sx={{ mb: 2.5 }}>
              <Typography variant="caption" sx={{ fontWeight: 600, color: '#334155', mb: 0.5, display: 'block' }}>
                Email address
              </Typography>
              <TextField
                fullWidth
                size="medium"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@brightpath.com"
                required
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Mail size={18} color="#94A3B8" />
                    </InputAdornment>
                  ),
                }}
              />
            </Box>

            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" sx={{ fontWeight: 600, color: '#334155', mb: 0.5, display: 'block' }}>
                Password
              </Typography>
              <TextField
                fullWidth
                size="medium"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Lock size={18} color="#94A3B8" />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" size="small">
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
              <FormControlLabel
                control={<Checkbox checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} size="small" />}
                label={<Typography variant="body2" sx={{ color: '#475569' }}>Remember me</Typography>}
              />
              <Typography
                variant="body2"
                sx={{
                  color: '#2563EB',
                  fontWeight: 600,
                  cursor: 'pointer',
                  '&:hover': { textDecoration: 'underline' },
                }}
              >
                Forgot password?
              </Typography>
            </Box>

            <Button
              type="submit"
              variant="contained"
              fullWidth
              size="large"
              disabled={loading}
              sx={{
                py: 1.4,
                fontSize: '1rem',
                fontWeight: 600,
                borderRadius: 2,
                bgcolor: '#2563EB',
                mb: 3,
                gap: 1,
              }}
            >
              {loading ? <CircularProgress size={22} color="inherit" /> : <><LogIn size={18} /> Sign In</>}
            </Button>
          </form>

          {/* Quick Demo Pre-fill Chips */}
          <Box sx={{ p: 1.5, bgcolor: '#F1F5F9', borderRadius: 2 }}>
            <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600, display: 'block', mb: 1 }}>
              Quick Fill Demo Credentials:
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button size="small" variant="outlined" onClick={handleQuickFillPriya} sx={{ fontSize: '0.75rem' }}>
                Priya (Consultant E1042)
              </Button>
              <Button size="small" variant="outlined" onClick={handleQuickFillRavi} sx={{ fontSize: '0.75rem' }}>
                Ravi (Controller E2087)
              </Button>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};
