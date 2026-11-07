import React from 'react';
import { Chip, Tooltip } from '@mui/material';
import {
  AlertTriangle,
  Bed,
  Car,
  CheckCircle2,
  Clock,
  Coffee,
  HelpCircle,
  Hotel,
  Lock,
  Receipt,
  Send,
  ShieldCheck,
  Sparkles,
  Tag,
  UtensilsCrossed,
  XCircle,
} from 'lucide-react';

interface CategoryChipProps {
  category: string;
  size?: 'small' | 'medium';
}

export const CategoryChip: React.FC<CategoryChipProps> = ({ category, size = 'small' }) => {
  const catLower = category.toLowerCase();

  let icon = <Tag size={13} />;
  let bgcolor = '#F1F5F9';
  let color = '#334155';
  let borderColor = '#CBD5E1';

  if (catLower.includes('meal') || catLower.includes('food') || catLower.includes('lunch') || catLower.includes('dinner')) {
    icon = <UtensilsCrossed size={13} color="#D97706" />;
    bgcolor = '#FFFBEB';
    color = '#92400E';
    borderColor = '#FDE68A';
  } else if (catLower.includes('travel') || catLower.includes('taxi') || catLower.includes('uber') || catLower.includes('transit') || catLower.includes('flight')) {
    icon = <Car size={13} color="#059669" />;
    bgcolor = '#ECFDF5';
    color = '#065F46';
    borderColor = '#A7F3D0';
  } else if (catLower.includes('hotel') || catLower.includes('lodging') || catLower.includes('stay') || catLower.includes('room')) {
    icon = <Hotel size={13} color="#7C3AED" />;
    bgcolor = '#F5F3FF';
    color = '#5B21B6';
    borderColor = '#DDD6FE';
  } else if (catLower.includes('entertainment') || catLower.includes('client')) {
    icon = <Sparkles size={13} color="#2563EB" />;
    bgcolor = '#EFF6FF';
    color = '#1E40AF';
    borderColor = '#BFDBFE';
  }

  return (
    <Chip
      icon={icon}
      label={category}
      size={size}
      sx={{
        fontWeight: 600,
        fontSize: '0.75rem',
        bgcolor,
        color,
        border: '1px solid',
        borderColor,
        '& .MuiChip-icon': { ml: 0.8, mr: -0.4 },
      }}
    />
  );
};

interface StatusBadgeProps {
  status: string;
  size?: 'small' | 'medium';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'small' }) => {
  const statLower = status.toLowerCase();

  let icon = <Clock size={12} />;
  let bgcolor = '#F1F5F9';
  let color = '#475569';
  let borderColor = '#CBD5E1';
  let label = status.toUpperCase();

  if (statLower === 'submitted' || statLower === 'pending' || statLower === 'pending_approval') {
    icon = <Send size={12} color="#1D4ED8" />;
    bgcolor = '#EFF6FF';
    color = '#1D4ED8';
    borderColor = '#BFDBFE';
    label = 'SUBMITTED';
  } else if (statLower === 'approved') {
    icon = <CheckCircle2 size={12} color="#047857" />;
    bgcolor = '#ECFDF5';
    color = '#047857';
    borderColor = '#A7F3D0';
    label = 'APPROVED';
  } else if (statLower === 'rejected') {
    icon = <XCircle size={12} color="#B91C1C" />;
    bgcolor = '#FEF2F2';
    color = '#B91C1C';
    borderColor = '#FECACA';
    label = 'REJECTED';
  } else if (statLower === 'active') {
    icon = <CheckCircle2 size={12} color="#047857" />;
    bgcolor = '#ECFDF5';
    color = '#047857';
    borderColor = '#A7F3D0';
    label = 'ACTIVE';
  } else if (statLower === 'closed') {
    icon = <Lock size={12} color="#B91C1C" />;
    bgcolor = '#FEF2F2';
    color = '#B91C1C';
    borderColor = '#FECACA';
    label = 'CLOSED';
  }

  return (
    <Chip
      icon={icon}
      label={label}
      size={size}
      sx={{
        fontWeight: 700,
        fontSize: '0.72rem',
        bgcolor,
        color,
        border: '1px solid',
        borderColor,
        '& .MuiChip-icon': { ml: 0.8, mr: -0.4 },
      }}
    />
  );
};

interface PolicyCheckChipProps {
  exception_flag: boolean;
  justification?: string;
  size?: 'small' | 'medium';
}

export const PolicyCheckChip: React.FC<PolicyCheckChipProps> = ({
  exception_flag,
  justification,
  size = 'small',
}) => {
  if (exception_flag) {
    const chip = (
      <Chip
        icon={<AlertTriangle size={13} color="#D97706" />}
        label="Exception"
        size={size}
        sx={{
          fontWeight: 700,
          fontSize: '0.72rem',
          bgcolor: '#FFFBEB',
          color: '#B45309',
          border: '1px solid #FDE68A',
          '& .MuiChip-icon': { ml: 0.8, mr: -0.4 },
        }}
      />
    );

    return justification ? (
      <Tooltip title={justification} arrow>
        {chip}
      </Tooltip>
    ) : (
      chip
    );
  }

  return (
    <Chip
      icon={<CheckCircle2 size={13} color="#059669" />}
      label="Compliant"
      size={size}
      sx={{
        fontWeight: 700,
        fontSize: '0.72rem',
        bgcolor: '#ECFDF5',
        color: '#047857',
        border: '1px solid #A7F3D0',
        '& .MuiChip-icon': { ml: 0.8, mr: -0.4 },
      }}
    />
  );
};
