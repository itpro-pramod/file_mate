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
  FormControlLabel,
  Radio,
  RadioGroup,
  Typography,
} from '@mui/material';
import {
  Activity,
  Bot,
  CheckCircle,
  Cloud,
  Cpu,
  Layers,
  RefreshCw,
  Server,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { api } from '../../services/api';
import { LLMSettings } from '../../types';

export const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<LLMSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [checkingHealth, setCheckingHealth] = useState(false);
  const [healthResult, setHealthResult] = useState<any>(null);
  const [notification, setNotification] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const data = await api.getLLMSettings();
      setSettings(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleProviderSwitch = async (newProvider: string) => {
    setSwitching(true);
    setNotification(null);
    try {
      const updated = await api.updateLLMSettings(newProvider);
      setSettings(updated);
      setNotification(`Active provider successfully switched to ${newProvider === 'openai' ? 'OpenAI' : 'Azure OpenAI'}.`);
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Failed to switch provider.');
    } finally {
      setSwitching(false);
    }
  };

  const handleHealthCheck = async () => {
    setCheckingHealth(true);
    setHealthResult(null);
    try {
      const res = await api.checkLLMHealth();
      setHealthResult(res);
    } catch (e: any) {
      setHealthResult({
        status: 'error',
        provider: settings?.active_provider,
        message: e.response?.data?.detail || 'Health check failed.',
      });
    } finally {
      setCheckingHealth(false);
    }
  };

  if (loading || !settings) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, color: '#0F172A', mb: 0.5 }}>
          LLM Provider & System Settings
        </Typography>
        <Typography variant="body1" sx={{ color: '#64748B' }}>
          Configure the active dual-provider architecture (OpenAI and Azure OpenAI), run health diagnostics, and inspect system status.
        </Typography>
      </Box>

      {notification && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setNotification(null)}>
          {notification}
        </Alert>
      )}

      {/* Provider Selection Card */}
      <Card sx={{ p: 3, mb: 3.5, borderRadius: 3, border: '1px solid #E2E8F0' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Cpu size={22} color="#2563EB" />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>Active LLM Provider</Typography>
          </Box>
          <Chip
            label={settings.active_provider === 'openai' ? 'OpenAI Active' : 'Azure OpenAI Active'}
            color="primary"
            sx={{ fontWeight: 700 }}
          />
        </Box>

        <Typography variant="body2" sx={{ color: '#64748B', mb: 3 }}>
          Switching providers takes effect immediately without altering agent workflows or restarting the application.
        </Typography>

        <FormControl component="fieldset">
          <RadioGroup
            value={settings.active_provider}
            onChange={(e) => handleProviderSwitch(e.target.value)}
          >
            {/* OpenAI Option */}
            <Box
              sx={{
                p: 2,
                mb: 2,
                borderRadius: 2,
                border: settings.active_provider === 'openai' ? '2px solid #2563EB' : '1px solid #E2E8F0',
                bgcolor: settings.active_provider === 'openai' ? '#EFF6FF' : '#FFFFFF',
              }}
            >
              <FormControlLabel
                value="openai"
                control={<Radio disabled={switching} />}
                label={
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                        Provider A: OpenAI
                      </Typography>
                      {settings.openai_configured ? (
                        <Chip label="Configured" size="small" sx={{ bgcolor: '#ECFDF5', color: '#059669', fontSize: '0.75rem', fontWeight: 600 }} />
                      ) : (
                        <Chip label="API Key Missing" size="small" sx={{ bgcolor: '#FEF2F2', color: '#DC2626', fontSize: '0.75rem', fontWeight: 600 }} />
                      )}
                    </Box>
                    <Typography variant="body2" sx={{ color: '#64748B', mt: 0.5 }}>
                      Model: <strong>{settings.openai_model}</strong> • Uses official LangChain OpenAI client with tool calling and structured output.
                    </Typography>
                  </Box>
                }
              />
            </Box>

            {/* Azure OpenAI Option */}
            <Box
              sx={{
                p: 2,
                borderRadius: 2,
                border: settings.active_provider === 'azure_openai' ? '2px solid #2563EB' : '1px solid #E2E8F0',
                bgcolor: settings.active_provider === 'azure_openai' ? '#EFF6FF' : '#FFFFFF',
              }}
            >
              <FormControlLabel
                value="azure_openai"
                control={<Radio disabled={switching} />}
                label={
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                        Provider B: Azure OpenAI
                      </Typography>
                      {settings.azure_configured ? (
                        <Chip label="Configured" size="small" sx={{ bgcolor: '#ECFDF5', color: '#059669', fontSize: '0.75rem', fontWeight: 600 }} />
                      ) : (
                        <Chip label="Endpoint / Key Missing" size="small" sx={{ bgcolor: '#FEF2F2', color: '#DC2626', fontSize: '0.75rem', fontWeight: 600 }} />
                      )}
                    </Box>
                    <Typography variant="body2" sx={{ color: '#64748B', mt: 0.5 }}>
                      Deployment: <strong>{settings.azure_model}</strong> • Enterprise Azure-hosted endpoint for high-compliance agent workflows.
                    </Typography>
                  </Box>
                }
              />
            </Box>
          </RadioGroup>
        </FormControl>
      </Card>

      {/* Health Check Diagnostics Card */}
      <Card sx={{ p: 3, mb: 3.5, borderRadius: 3, border: '1px solid #E2E8F0' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Activity size={22} color="#059669" />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>Provider Health & Latency Test</Typography>
          </Box>
          <Button
            variant="contained"
            onClick={handleHealthCheck}
            disabled={checkingHealth}
            startIcon={checkingHealth ? <CircularProgress size={16} color="inherit" /> : <Zap size={16} />}
            sx={{ borderRadius: 2, fontWeight: 600 }}
          >
            {checkingHealth ? 'Testing Provider...' : 'Test Provider Health'}
          </Button>
        </Box>

        <Typography variant="body2" sx={{ color: '#64748B', mb: 2 }}>
          Sends a lightweight validation probe to verify credentials, endpoint reachability, and response latency.
        </Typography>

        {healthResult && (
          <Box
            sx={{
              p: 2,
              borderRadius: 2,
              bgcolor: healthResult.status === 'healthy' ? '#ECFDF5' : '#FEF2F2',
              border: healthResult.status === 'healthy' ? '1px solid #A7F3D0' : '1px solid #FECACA',
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: healthResult.status === 'healthy' ? '#065F46' : '#991B1B' }}>
                {healthResult.status === 'healthy' ? '✓ Provider Operational' : '✕ Health Check Error'}
              </Typography>
              {healthResult.latency_ms !== null && healthResult.latency_ms !== undefined && (
                <Chip label={`${healthResult.latency_ms} ms`} size="small" />
              )}
            </Box>
            <Typography variant="body2" sx={{ color: healthResult.status === 'healthy' ? '#047857' : '#B91C1C', mt: 0.5 }}>
              {healthResult.message}
            </Typography>
          </Box>
        )}
      </Card>

      {/* Security Architecture & Compliance Status */}
      <Card sx={{ p: 3, borderRadius: 3, border: '1px solid #E2E8F0' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <ShieldCheck size={22} color="#2563EB" />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Security & Credential Posture</Typography>
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2 }}>
          <Box sx={{ p: 2, bgcolor: '#F8FAFC', borderRadius: 2 }}>
            <Typography variant="caption" sx={{ color: '#64748B' }}>SECRET STORAGE</Typography>
            <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.5 }}>Environment Variables Only</Typography>
            <Typography variant="caption" sx={{ color: '#059669', display: 'block', mt: 0.5 }}>✓ Never stored in SQLite</Typography>
          </Box>
          <Box sx={{ p: 2, bgcolor: '#F8FAFC', borderRadius: 2 }}>
            <Typography variant="caption" sx={{ color: '#64748B' }}>FRONTEND EXPOSURE</Typography>
            <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.5 }}>Zero Key Exposure</Typography>
            <Typography variant="caption" sx={{ color: '#059669', display: 'block', mt: 0.5 }}>✓ Masked & sanitized</Typography>
          </Box>
          <Box sx={{ p: 2, bgcolor: '#F8FAFC', borderRadius: 2 }}>
            <Typography variant="caption" sx={{ color: '#64748B' }}>APP VERSION</Typography>
            <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.5 }}>FileMate v{settings.app_version}</Typography>
            <Typography variant="caption" sx={{ color: '#2563EB', display: 'block', mt: 0.5 }}>FastAPI + LangGraph + React</Typography>
          </Box>
        </Box>
      </Card>
    </Box>
  );
};
