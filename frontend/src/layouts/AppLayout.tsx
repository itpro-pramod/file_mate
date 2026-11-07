import React, { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Avatar,
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  BarChart3,
  Bot,
  Briefcase,
  ChevronDown,
  ChevronRight,
  Clock,
  FileCheck,
  FileSpreadsheet,
  FolderGit2,
  HelpCircle,
  Layers,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Receipt,
  Settings,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Users,
  WalletCards,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

export const AppLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, login, logout } = useAuth();
  const [sidebarAnchorEl, setSidebarAnchorEl] = useState<null | HTMLElement>(null);
  const [topAnchorEl, setTopAnchorEl] = useState<null | HTMLElement>(null);

  // Persistent sidebar collapsed state
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('filemate_sidebar_collapsed') === 'true';
  });

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('filemate_sidebar_collapsed', String(next));
      return next;
    });
  };

  const isFinance = user?.role === 'Finance Controller';

  // Grouped Navigation Items
  const navGroups: NavGroup[] = isFinance
    ? [
        {
          title: 'Copilot',
          items: [
            { label: 'Expense Intelligence Copilot', path: '/intelligence', icon: <Sparkles size={20} /> },
            { label: 'Expense Assistant', path: '/assistant', icon: <Bot size={20} /> },
          ],
        },
        {
          title: 'Finance & Expenses',
          items: [
            { label: 'Finance Approvals', path: '/finance/approvals', icon: <FileCheck size={20} /> },
            { label: 'Company Expenses', path: '/expenses', icon: <Receipt size={20} /> },
            { label: 'Finance Analytics', path: '/finance/analytics', icon: <BarChart3 size={20} /> },
            { label: 'Projects & Budgets', path: '/projects', icon: <FolderGit2 size={20} /> },
          ],
        },
        {
          title: 'Observability',
          items: [
            { label: 'Recent Runs', path: '/runs', icon: <Clock size={20} /> },
            { label: 'Run Logs', path: '/logs', icon: <Layers size={20} /> },
          ],
        },
        {
          title: 'Settings',
          items: [
            { label: 'Expense Policy', path: '/policy', icon: <ShieldCheck size={20} /> },
            { label: 'Settings', path: '/settings', icon: <Settings size={20} /> },
          ],
        },
      ]
    : [
        {
          title: 'Copilot',
          items: [
            { label: 'Expense Intelligence Copilot', path: '/intelligence', icon: <Sparkles size={20} /> },
            { label: 'Expense Assistant', path: '/assistant', icon: <Bot size={20} /> },
          ],
        },
        {
          title: 'Expenses & Projects',
          items: [
            { label: 'My Expenses', path: '/expenses', icon: <Receipt size={20} /> },
            { label: 'Projects & Budgets', path: '/projects', icon: <FolderGit2 size={20} /> },
          ],
        },
        {
          title: 'Observability',
          items: [
            { label: 'Recent Runs', path: '/runs', icon: <Clock size={20} /> },
            { label: 'Run Logs', path: '/logs', icon: <Layers size={20} /> },
          ],
        },
        {
          title: 'Settings',
          items: [
            { label: 'Expense Policy', path: '/policy', icon: <ShieldCheck size={20} /> },
            { label: 'Settings', path: '/settings', icon: <Settings size={20} /> },
          ],
        },
      ];

  const handleSidebarProfileClick = (event: React.MouseEvent<HTMLElement>) => {
    setSidebarAnchorEl(event.currentTarget);
  };

  const handleTopProfileClick = (event: React.MouseEvent<HTMLElement>) => {
    setTopAnchorEl(event.currentTarget);
  };

  const handleCloseAllMenus = () => {
    setSidebarAnchorEl(null);
    setTopAnchorEl(null);
  };

  const handleSwitchPersona = async () => {
    handleCloseAllMenus();
    const isPriya = user?.employee_id === 'E1042';
    const targetEmail = isPriya ? 'ravi.menon@brightpath.com' : 'priya.nair@brightpath.com';
    await login(targetEmail, 'Admin@321');
    navigate(isPriya ? '/finance/approvals' : '/assistant');
  };

  const handleLogout = async () => {
    handleCloseAllMenus();
    await logout();
    navigate('/login');
  };

  const initials = user?.full_name
    ? user.full_name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
    : 'PN';

  const isItemActive = (path: string) => {
    if (path === '/intelligence') {
      return location.pathname === '/intelligence' || location.pathname.startsWith('/intelligence/');
    }
    if (path === '/runs') {
      return location.pathname === '/runs' || location.pathname.startsWith('/runs/');
    }
    if (path === '/expenses') {
      return location.pathname === '/expenses' || location.pathname.startsWith('/expenses/');
    }
    if (path === '/projects') {
      return location.pathname === '/projects' || location.pathname.startsWith('/projects/');
    }
    if (path === '/finance/approvals') {
      return location.pathname === '/finance/approvals';
    }
    if (path === '/finance/analytics') {
      return location.pathname === '/finance/analytics';
    }
    return location.pathname === path;
  };

  const getCurrentPageTitle = (path: string): string => {
    if (path.startsWith('/assistant')) return 'Expense Assistant';
    if (path.startsWith('/intelligence')) return 'Expense Intelligence Copilot';
    if (path.startsWith('/finance/approvals')) return 'Finance Approvals Queue';
    if (path.startsWith('/finance/analytics')) return 'Finance Analytics & Spend';
    if (path.startsWith('/expenses')) return 'My Expenses & Submissions';
    if (path.startsWith('/projects')) return 'Project Portal & Budgets';
    if (path.startsWith('/runs')) return 'Agent Runs Execution Trace';
    if (path.startsWith('/logs')) return 'Observability & Run Logs';
    if (path.startsWith('/policy')) return 'Company Expense Policy';
    if (path.startsWith('/settings')) return 'LLM Provider & System Settings';
    return 'Dashboard';
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#F8FAFC' }}>
      {/* Left Sidebar */}
      <Box
        sx={{
          width: collapsed ? 72 : 260,
          flexShrink: 0,
          bgcolor: '#0B192C',
          color: '#FFFFFF',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          borderRight: '1px solid rgba(255, 255, 255, 0.08)',
          transition: 'width 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
          overflowX: 'hidden',
          zIndex: 1200,
        }}
      >
        {/* Top Branding & Nav Groups */}
        <Box>
          {/* Header Bar */}
          <Box
            sx={{
              p: collapsed ? 1.5 : 2.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: collapsed ? 'center' : 'space-between',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              minHeight: 68,
            }}
          >
            {collapsed ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                <Box
                  onClick={() => navigate('/assistant')}
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: 2,
                    bgcolor: '#2563EB',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#FFFFFF',
                    cursor: 'pointer',
                  }}
                >
                  <FileSpreadsheet size={20} />
                </Box>
                <Tooltip title="Expand Sidebar" placement="right" arrow>
                  <IconButton
                    size="small"
                    onClick={toggleCollapsed}
                    sx={{
                      color: '#94A3B8',
                      p: 0.5,
                      '&:hover': { color: '#FFFFFF', bgcolor: 'rgba(255,255,255,0.08)' },
                    }}
                  >
                    <PanelLeftOpen size={18} />
                  </IconButton>
                </Tooltip>
              </Box>
            ) : (
              <>
                <Box
                  sx={{ display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer' }}
                  onClick={() => navigate('/assistant')}
                >
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: 2,
                      bgcolor: '#2563EB',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#FFFFFF',
                      flexShrink: 0,
                    }}
                  >
                    <FileSpreadsheet size={20} />
                  </Box>
                  <Box sx={{ overflow: 'hidden' }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.1, color: '#FFFFFF' }} noWrap>
                      FileMate
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#94A3B8', fontSize: '0.72rem' }} noWrap>
                      Expense Assistant
                    </Typography>
                  </Box>
                </Box>

                <Tooltip title="Collapse Sidebar" placement="right" arrow>
                  <IconButton
                    size="small"
                    onClick={toggleCollapsed}
                    sx={{
                      color: '#94A3B8',
                      p: 0.75,
                      borderRadius: 1.5,
                      '&:hover': { color: '#FFFFFF', bgcolor: 'rgba(255, 255, 255, 0.08)' },
                    }}
                  >
                    <PanelLeftClose size={18} />
                  </IconButton>
                </Tooltip>
              </>
            )}
          </Box>

          {/* Grouped Navigation Links */}
          <Box sx={{ py: 1.5, px: collapsed ? 1 : 1.5 }}>
            {navGroups.map((group, groupIdx) => (
              <Box key={group.title} sx={{ mb: 1.5 }}>
                {/* Group Header */}
                {collapsed ? (
                  groupIdx > 0 && (
                    <Divider sx={{ my: 1, borderColor: 'rgba(255, 255, 255, 0.08)' }} />
                  )
                ) : (
                  <Typography
                    variant="caption"
                    sx={{
                      px: 1.5,
                      pt: groupIdx > 0 ? 1 : 0.5,
                      pb: 0.5,
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      color: '#64748B',
                      textTransform: 'uppercase',
                      display: 'block',
                    }}
                  >
                    {group.title}
                  </Typography>
                )}

                {/* Group Items */}
                <List disablePadding>
                  {group.items.map((item) => {
                    const active = isItemActive(item.path);

                    const buttonContent = (
                      <ListItemButton
                        onClick={() => navigate(item.path)}
                        sx={{
                          borderRadius: 2,
                          py: 0.9,
                          px: collapsed ? 0 : 1.5,
                          justifyContent: collapsed ? 'center' : 'flex-start',
                          bgcolor: active ? '#2563EB' : 'transparent',
                          color: active ? '#FFFFFF' : '#94A3B8',
                          minHeight: 40,
                          mb: 0.4,
                          '&:hover': {
                            bgcolor: active ? '#1D4ED8' : 'rgba(255, 255, 255, 0.06)',
                            color: '#FFFFFF',
                          },
                        }}
                      >
                        <ListItemIcon
                          sx={{
                            minWidth: collapsed ? 0 : 34,
                            justifyContent: 'center',
                            color: active ? '#FFFFFF' : '#94A3B8',
                          }}
                        >
                          {item.icon}
                        </ListItemIcon>
                        {!collapsed && (
                          <ListItemText
                            primary={item.label}
                            primaryTypographyProps={{
                              fontSize: '0.88rem',
                              fontWeight: active ? 700 : 500,
                              noWrap: true,
                            }}
                          />
                        )}
                      </ListItemButton>
                    );

                    return (
                      <ListItem key={item.path} disablePadding>
                        {collapsed ? (
                          <Tooltip title={item.label} placement="right" arrow>
                            <Box sx={{ width: '100%' }}>{buttonContent}</Box>
                          </Tooltip>
                        ) : (
                          buttonContent
                        )}
                      </ListItem>
                    );
                  })}
                </List>
              </Box>
            ))}
          </Box>
        </Box>

        {/* Bottom Profile & Help Controls */}
        <Box sx={{ p: collapsed ? 1 : 1.5, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
          {/* Help button */}
          {collapsed ? (
            <Tooltip title="Help & Policy Reference" placement="right" arrow>
              <ListItemButton
                onClick={() => navigate('/policy')}
                sx={{
                  borderRadius: 2,
                  py: 0.8,
                  px: 0,
                  justifyContent: 'center',
                  color: '#94A3B8',
                  mb: 1,
                  '&:hover': { color: '#FFFFFF', bgcolor: 'rgba(255, 255, 255, 0.06)' },
                }}
              >
                <ListItemIcon sx={{ minWidth: 0, justifyContent: 'center', color: '#94A3B8' }}>
                  <HelpCircle size={18} />
                </ListItemIcon>
              </ListItemButton>
            </Tooltip>
          ) : (
            <ListItemButton
              onClick={() => navigate('/policy')}
              sx={{
                borderRadius: 2,
                py: 0.8,
                px: 1.5,
                color: '#94A3B8',
                mb: 1,
                '&:hover': { color: '#FFFFFF', bgcolor: 'rgba(255, 255, 255, 0.06)' },
              }}
            >
              <ListItemIcon sx={{ minWidth: 32, color: '#94A3B8' }}>
                <HelpCircle size={18} />
              </ListItemIcon>
              <ListItemText primary="Help & Policies" primaryTypographyProps={{ fontSize: '0.84rem' }} />
            </ListItemButton>
          )}

          {/* User Profile Card */}
          {collapsed ? (
            <Tooltip title={`${user?.full_name || 'User'} (${user?.role})`} placement="right" arrow>
              <Box
                onClick={handleSidebarProfileClick}
                sx={{
                  display: 'flex',
                  justifyContent: 'center',
                  p: 0.5,
                  borderRadius: 2,
                  cursor: 'pointer',
                  '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.08)' },
                }}
              >
                <Avatar
                  sx={{
                    bgcolor: isFinance ? '#3B82F6' : '#10B981',
                    color: '#FFFFFF',
                    width: 36,
                    height: 36,
                    fontSize: '0.82rem',
                    fontWeight: 700,
                  }}
                >
                  {initials}
                </Avatar>
              </Box>
            </Tooltip>
          ) : (
            <Box
              onClick={handleSidebarProfileClick}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                p: 1,
                borderRadius: 2,
                cursor: 'pointer',
                '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.06)' },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
                <Avatar
                  sx={{
                    bgcolor: isFinance ? '#3B82F6' : '#10B981',
                    color: '#FFFFFF',
                    width: 36,
                    height: 36,
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {initials}
                </Avatar>
                <Box sx={{ minWidth: 0, overflow: 'hidden' }}>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: '#FFFFFF', lineHeight: 1.2 }} noWrap>
                    {user?.full_name || 'Priya Nair'}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.3 }}>
                    <Typography variant="caption" sx={{ color: '#94A3B8', fontSize: '0.72rem' }}>
                      {user?.employee_id || 'E1042'}
                    </Typography>
                    <Chip
                      label={isFinance ? 'Finance' : 'Consultant'}
                      size="small"
                      sx={{
                        height: 18,
                        fontSize: '0.62rem',
                        fontWeight: 700,
                        bgcolor: isFinance ? '#3B82F6' : '#10B981',
                        color: '#FFFFFF',
                        px: 0.3,
                      }}
                    />
                  </Box>
                </Box>
              </Box>
              <ChevronRight size={16} color="#94A3B8" />
            </Box>
          )}

          {/* Sidebar Profile Menu */}
          <Menu
            anchorEl={sidebarAnchorEl}
            open={Boolean(sidebarAnchorEl)}
            onClose={handleCloseAllMenus}
            anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
            transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            PaperProps={{
              sx: {
                borderRadius: 2.5,
                minWidth: 240,
                boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
              },
            }}
          >
            <Box sx={{ px: 2, py: 1.5 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0F172A' }}>
                {user?.full_name}
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748B', display: 'block' }}>
                {user?.email}
              </Typography>
              <Chip
                label={user?.role}
                size="small"
                sx={{
                  mt: 0.5,
                  height: 20,
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  bgcolor: isFinance ? '#EFF6FF' : '#ECFDF5',
                  color: isFinance ? '#1D4ED8' : '#047857',
                }}
              />
            </Box>
            <Divider />
            <MenuItem onClick={handleSwitchPersona} sx={{ color: '#2563EB', fontWeight: 600, gap: 1, py: 1.2 }}>
              <UserCheck size={16} />
              {user?.employee_id === 'E1042'
                ? 'Switch to Ravi Menon (Finance)'
                : 'Switch to Priya Nair (Consultant)'}
            </MenuItem>
            <Divider />
            <MenuItem onClick={handleLogout} sx={{ color: '#EF4444', gap: 1, py: 1.2 }}>
              <LogOut size={16} /> Logout
            </MenuItem>
          </Menu>
        </Box>
      </Box>

      {/* Main Container with Universal Top Header */}
      <Box
        sx={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          overflow: 'hidden',
          minWidth: 0,
          bgcolor: '#F8FAFC',
        }}
      >
        {/* Universal Top Header (Always Visible across all page navigation) */}
        <Box
          sx={{
            height: 60,
            minHeight: 60,
            px: { xs: 2, sm: 3, md: 4 },
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            bgcolor: '#FFFFFF',
            borderBottom: '1px solid #E2E8F0',
            flexShrink: 0,
            zIndex: 1100,
          }}
        >
          {/* Left: Breadcrumbs / Title */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 1 }}>
              <span style={{ color: '#64748B', fontWeight: 500 }}>FileMate</span>
              <span style={{ color: '#CBD5E1' }}>/</span>
              <span style={{ color: '#1E293B' }}>{getCurrentPageTitle(location.pathname)}</span>
            </Typography>
          </Box>

          {/* Right: The Exact Profile & Persona Switcher */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            {/* Role Button */}
            <Button
              size="small"
              variant="outlined"
              onClick={handleTopProfileClick}
              startIcon={<ShieldCheck size={17} color="#2563EB" />}
              endIcon={<ChevronDown size={14} color="#64748B" />}
              sx={{
                borderRadius: 6,
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.84rem',
                borderColor: '#CBD5E1',
                color: '#1E293B',
                bgcolor: '#FFFFFF',
                px: 1.8,
                py: 0.55,
                boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                '&:hover': { bgcolor: '#F8FAFC', borderColor: '#94A3B8' },
              }}
            >
              {user?.role || (isFinance ? 'Finance Controller' : 'Consultant')}
            </Button>

            {/* Profile Avatar & Info */}
            <Box
              onClick={handleTopProfileClick}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.2,
                cursor: 'pointer',
                p: 0.5,
                borderRadius: 2,
                transition: 'background 0.15s ease',
                '&:hover': { bgcolor: '#F1F5F9' },
              }}
            >
              <Avatar
                sx={{
                  width: 34,
                  height: 34,
                  bgcolor: isFinance ? '#2563EB' : '#10B981',
                  color: '#FFFFFF',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                }}
              >
                {initials}
              </Avatar>
              <Box sx={{ textAlign: 'left', display: { xs: 'none', sm: 'block' } }}>
                <Typography variant="body2" sx={{ fontWeight: 700, color: '#0F172A', lineHeight: 1.15, fontSize: '0.84rem' }}>
                  {user?.full_name || (isFinance ? 'Ravi Menon' : 'Priya Nair')}
                </Typography>
                <Typography variant="caption" sx={{ color: '#64748B', fontSize: '0.74rem' }}>
                  {user?.employee_id || (isFinance ? 'E2087' : 'E1042')}
                </Typography>
              </Box>
              <ChevronDown size={14} color="#64748B" />
            </Box>

            {/* Top Profile Dropdown Menu */}
            <Menu
              anchorEl={topAnchorEl}
              open={Boolean(topAnchorEl)}
              onClose={handleCloseAllMenus}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
              PaperProps={{
                sx: {
                  mt: 1,
                  borderRadius: 2.5,
                  minWidth: 240,
                  boxShadow: '0 10px 25px rgba(0,0,0,0.12)',
                  border: '1px solid #E2E8F0',
                },
              }}
            >
              <Box sx={{ px: 2, py: 1.5 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0F172A' }}>
                  {user?.full_name}
                </Typography>
                <Typography variant="caption" sx={{ color: '#64748B', display: 'block' }}>
                  {user?.email}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mt: 0.8 }}>
                  <Chip
                    label={user?.role}
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      bgcolor: isFinance ? '#EFF6FF' : '#ECFDF5',
                      color: isFinance ? '#1D4ED8' : '#047857',
                    }}
                  />
                  <Typography variant="caption" sx={{ color: '#94A3B8', fontSize: '0.72rem' }}>
                    ID: {user?.employee_id}
                  </Typography>
                </Box>
              </Box>
              <Divider />
              <MenuItem onClick={handleSwitchPersona} sx={{ color: '#2563EB', fontWeight: 600, gap: 1, py: 1.2 }}>
                <UserCheck size={16} />
                {user?.employee_id === 'E1042'
                  ? 'Switch to Ravi Menon (Finance)'
                  : 'Switch to Priya Nair (Consultant)'}
              </MenuItem>
              <Divider />
              <MenuItem onClick={handleLogout} sx={{ color: '#EF4444', gap: 1, py: 1.2 }}>
                <LogOut size={16} /> Logout
              </MenuItem>
            </Menu>
          </Box>
        </Box>

        {/* Scrollable Page Body */}
        <Box sx={{ flexGrow: 1, overflowY: 'auto', overflowX: 'hidden', p: { xs: 2, sm: 3, md: 4 }, minWidth: 0 }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
};
