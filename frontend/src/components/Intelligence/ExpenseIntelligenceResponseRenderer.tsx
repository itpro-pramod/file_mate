import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  Chip,
  Divider,
  IconButton,
  InputAdornment,
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
  AlertTriangle,
  Check,
  CheckCircle,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Hotel,
  IndianRupee,
  Layers,
  Search,
  ThumbsDown,
  ThumbsUp,
  User,
} from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { api } from '../../services/api';
import {
  ChartDataItem,
  IntelligenceBlock,
  IntelligenceResponse,
  PolicyCheckItem,
  SummaryCardItem,
  TableColumn,
} from '../../types';

interface ResponseRendererProps {
  response: IntelligenceResponse;
  messageId?: string;
  onFollowUpClick?: (prompt: string) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  Hotel: '#8B5CF6',
  'Local Travel': '#3B82F6',
  Meals: '#10B981',
  'Metro / Travel': '#F59E0B',
  'Client Entertainment': '#EC4899',
  Airfare: '#06B6D4',
  Supplies: '#6366F1',
  Other: '#64748B',
};

const DEFAULT_PALETTE = ['#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#06B6D4', '#64748B'];

export const ExpenseIntelligenceResponseRenderer: React.FC<ResponseRendererProps> = ({
  response,
  messageId,
  onFollowUpClick,
}) => {
  const navigate = useNavigate();
  const [feedback, setFeedback] = useState<'thumbs_up' | 'thumbs_down' | null>(null);
  const [copied, setCopied] = useState(false);

  // Table pagination and search state
  const [tableSearch, setTableSearch] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);

  const handleCopy = () => {
    let copyText = response.answer || '';
    if (response.blocks) {
      for (const block of response.blocks) {
        const b = block as any;
        if ((b.block_type === 'conclusion_callout' || b.type === 'conclusion_callout') && (b.text || b.data?.text)) {
          copyText += `\n\n${b.text || b.data?.text}`;
        }
      }
    }
    navigator.clipboard.writeText(copyText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFeedback = async (rating: 'thumbs_up' | 'thumbs_down') => {
    setFeedback(rating);
    try {
      await api.submitIntelligenceFeedback(messageId || response.trace_id, response.trace_id, rating);
    } catch (e) {
      console.error('Failed to submit feedback:', e);
    }
  };

  const handleExportCSV = (tableBlock?: any) => {
    if (!tableBlock || !tableBlock.rows) return;
    const columns: TableColumn[] = (tableBlock.columns || []).map((col: any) =>
      typeof col === 'string' ? { key: col.toLowerCase().replace(/ /g, '_'), label: col } : col
    );
    const headers = columns.map((c) => c.label).join(',');
    const rows = tableBlock.rows.map((row: any) =>
      columns.map((c) => `"${String(row[c.key] ?? '').replace(/"/g, '""')}"`).join(',')
    );
    const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent([headers, ...rows].join('\n'));
    const link = document.createElement('a');
    link.setAttribute('href', csvContent);
    link.setAttribute('download', `intelligence_${response.trace_id.slice(0, 8)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper for rendering summary cards
  const renderSummaryCards = (rawBlock: any) => {
    const rawCards = rawBlock.cards || rawBlock.data || [];
    const cards: SummaryCardItem[] = rawCards.map((c: any) => ({
      label: c.label || c.title || '',
      value: c.value !== undefined ? c.value : c.amount !== undefined ? c.amount : '',
      icon: c.icon,
      color: c.color,
      subtext: c.subtext,
    }));

    return (
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'repeat(2, 1fr)',
            sm: cards.length <= 4 ? `repeat(${cards.length}, 1fr)` : 'repeat(auto-fit, minmax(150px, 1fr))',
            md: cards.length <= 4 ? `repeat(${cards.length}, 1fr)` : 'repeat(auto-fit, minmax(160px, 1fr))',
          },
          gap: 1.5,
          my: 2,
        }}
      >
        {cards.map((card, idx) => {
          const isException =
            card.label.toLowerCase().includes('exception') ||
            card.label.toLowerCase().includes('violation');
          const isExceptionAlert = isException && (card.value === 1 || Number(card.value) > 0 || String(card.value).includes('1'));

          return (
            <Tooltip key={idx} title={`${card.label}: ${card.value}`} arrow placement="top">
              <Card
                elevation={0}
                sx={{
                  p: 1.5,
                  borderRadius: 2.5,
                  bgcolor: isExceptionAlert ? '#FEF2F2' : '#FFFFFF',
                  border: isExceptionAlert ? '1px solid #FECACA' : '1px solid #E2E8F0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.25,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                  minWidth: 0,
                  transition: 'all 0.15s ease-in-out',
                  '&:hover': {
                    boxShadow: '0 3px 10px rgba(0,0,0,0.06)',
                  },
                }}
              >
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: 2,
                    bgcolor: isExceptionAlert
                      ? '#FEE2E2'
                      : card.label.includes('Total Submitted') || card.label.includes('Spend') || card.label.includes('Limit')
                      ? '#EBF5FF'
                      : '#F1F5F9',
                    color: isExceptionAlert
                      ? '#DC2626'
                      : card.label.includes('Total Submitted') || card.label.includes('Spend') || card.label.includes('Limit')
                      ? '#2563EB'
                      : '#475569',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {card.label.toLowerCase().includes('consultant') || card.label.toLowerCase().includes('scope') ? (
                    <User size={18} />
                  ) : card.label.toLowerCase().includes('project') ? (
                    <Layers size={18} />
                  ) : card.label.toLowerCase().includes('submitted') || card.label.toLowerCase().includes('spend') || card.label.toLowerCase().includes('limit') ? (
                    <IndianRupee size={18} />
                  ) : isException ? (
                    <AlertTriangle size={18} />
                  ) : (
                    <FileText size={18} />
                  )}
                </Box>
                <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                  <Typography
                    variant="caption"
                    sx={{
                      color: isExceptionAlert ? '#991B1B' : '#64748B',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.02em',
                      display: 'block',
                      lineHeight: 1.2,
                      whiteSpace: 'normal',
                      wordBreak: 'break-word',
                    }}
                  >
                    {card.label}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: 800,
                      color: isExceptionAlert ? '#B91C1C' : '#0F172A',
                      fontSize: '0.92rem',
                      lineHeight: 1.25,
                      mt: 0.35,
                      whiteSpace: 'normal',
                      wordBreak: 'break-word',
                    }}
                  >
                    {card.value}
                  </Typography>
                  {card.subtext && (
                    <Typography variant="caption" sx={{ color: '#94A3B8', fontSize: '0.7rem', display: 'block', mt: 0.2 }}>
                      {card.subtext}
                    </Typography>
                  )}
                </Box>
              </Card>
            </Tooltip>
          );
        })}
      </Box>
    );
  };

  // Helper for donut chart
  const renderDonutChart = (block: any) => {
    const rawData = block.data || [];
    const data: ChartDataItem[] = rawData.map((d: any) => ({
      name: d.name || d.category || 'Other',
      value: d.value !== undefined ? d.value : d.amount !== undefined ? d.amount : 0,
      percentage: d.percentage,
      color: d.color,
    }));

    return (
      <Card
        elevation={0}
        sx={{
          p: 2.5,
          borderRadius: 2.5,
          border: '1px solid #E2E8F0',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0F172A', mb: 2 }}>
          {block.title || 'Spending by Category'}
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexGrow: 1 }}>
          {/* Donut Chart with Center Amount */}
          <Box sx={{ width: 170, height: 170, position: 'relative' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {data.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.color || CATEGORY_COLORS[entry.name] || DEFAULT_PALETTE[index % DEFAULT_PALETTE.length]}
                    />
                  ))}
                </Pie>
                <RechartsTooltip
                  formatter={(value: any) => [`₹${Number(value).toLocaleString()}`, 'Amount']}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Center Text */}
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
              }}
            >
              <Typography variant="body1" sx={{ fontWeight: 800, color: '#0F172A', fontSize: '1rem', lineHeight: 1.1 }}>
                {block.total_amount || '₹0'}
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748B', fontSize: '0.72rem', fontWeight: 600 }}>
                Total
              </Typography>
            </Box>
          </Box>

          {/* Legend on the right */}
          <Box sx={{ flexGrow: 1, pl: 3, display: 'flex', flexDirection: 'column', gap: 1 }}>
            {data.map((item, idx) => {
              const color =
                item.color || CATEGORY_COLORS[item.name] || DEFAULT_PALETTE[idx % DEFAULT_PALETTE.length];
              return (
                <Box
                  key={idx}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '0.8rem',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: color }} />
                    <Typography variant="body2" sx={{ color: '#334155', fontWeight: 500, fontSize: '0.8rem' }}>
                      {item.name}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Typography variant="body2" sx={{ color: '#0F172A', fontWeight: 700, fontSize: '0.8rem' }}>
                      {item.percentage !== undefined ? `${item.percentage}%` : ''}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#64748B', fontSize: '0.75rem' }}>
                      (₹{Number(item.value).toLocaleString()})
                    </Typography>
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>
      </Card>
    );
  };

  // Helper for Policy Exception Box
  const renderPolicyExceptionBox = (block: any) => {
    const rawChecklist = block.checklist || [];
    const checklist: PolicyCheckItem[] = rawChecklist.map((item: any) => {
      if (typeof item === 'string') {
        const isFail = item.toLowerCase().includes('exceed') || item.toLowerCase().includes('violat');
        return { label: item, status: isFail ? 'failed' : 'passed' };
      }
      return item;
    });

    const itemLabel =
      block.item_title ||
      `${block.category || 'Hotel'} – ${block.amount || ''} ${block.date ? `(${block.date})` : ''}`;

    return (
      <Card
        elevation={0}
        sx={{
          p: 2.5,
          borderRadius: 2.5,
          bgcolor: '#FFF7F7',
          border: '1px solid #FECACA',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 1px 3px rgba(220, 38, 38, 0.04)',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#DC2626', mb: 2 }}>
          <AlertTriangle size={18} />
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#DC2626' }}>
            {block.title || 'Policy Exception'}
          </Typography>
        </Box>

        {/* Item banner */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            p: 1.5,
            borderRadius: 2,
            bgcolor: '#FFFFFF',
            border: '1px solid #FEE2E2',
            mb: 2,
          }}
        >
          <Box
            sx={{
              width: 34,
              height: 34,
              borderRadius: 1.5,
              bgcolor: '#FEF2F2',
              color: '#DC2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {itemLabel.toLowerCase().includes('hotel') ? (
              <Hotel size={18} />
            ) : (
              <AlertTriangle size={18} />
            )}
          </Box>
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 700, color: '#0F172A' }}>
              {itemLabel}
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748B' }}>
              {block.merchant ? block.merchant : ''}
            </Typography>
          </Box>
        </Box>

        {/* Checklist */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, flexGrow: 1 }}>
          {checklist.map((item, idx) => (
            <Box key={idx} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
              <Box
                sx={{
                  color: item.status === 'failed' ? '#DC2626' : '#16A34A',
                  mt: '2px',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {item.status === 'failed' ? <AlertTriangle size={16} /> : <Check size={16} />}
              </Box>
              <Typography
                variant="body2"
                sx={{
                  color: item.status === 'failed' ? '#B91C1C' : '#334155',
                  fontSize: '0.82rem',
                  fontWeight: 500,
                  lineHeight: 1.3,
                }}
              >
                {item.label}
              </Typography>
            </Box>
          ))}
        </Box>
      </Card>
    );
  };

  // Helper for Table
  const renderTable = (block: any) => {
    const rawColumns = block.columns || [];
    const columns: TableColumn[] = rawColumns.map((col: any) => {
      if (typeof col === 'string') {
        const key = col.toLowerCase().replace(/ /g, '_');
        return {
          key: key === 'policy_check' ? 'policy_check' : key,
          label: col,
          format: key.includes('amount')
            ? 'currency'
            : key.includes('policy')
            ? 'policy_status'
            : key.includes('status')
            ? 'status'
            : 'string',
        };
      }
      return col;
    });

    const rows: Record<string, any>[] = block.rows || [];

    // Filter rows by tableSearch
    const filteredRows = tableSearch
      ? rows.filter((r) =>
          Object.values(r).some((val) => String(val).toLowerCase().includes(tableSearch.toLowerCase()))
        )
      : rows;

    const paginatedRows = filteredRows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

    return (
      <Card
        elevation={0}
        sx={{
          my: 2,
          borderRadius: 2.5,
          border: '1px solid #E2E8F0',
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        }}
      >
        <Box
          sx={{
            p: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            bgcolor: '#FAFAFA',
            borderBottom: '1px solid #E2E8F0',
          }}
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0F172A' }}>
            {block.title || 'Expense Details'}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <TextField
              size="small"
              placeholder="Search in table..."
              value={tableSearch}
              onChange={(e) => {
                setTableSearch(e.target.value);
                setPage(0);
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search size={14} color="#94A3B8" />
                  </InputAdornment>
                ),
                sx: { fontSize: '0.8rem', height: 32, bgcolor: '#FFFFFF', borderRadius: 1.5 },
              }}
            />
            <Button
              size="small"
              variant="outlined"
              onClick={() => handleExportCSV(block)}
              startIcon={<Download size={14} />}
              sx={{
                fontSize: '0.78rem',
                textTransform: 'none',
                height: 32,
                borderRadius: 1.5,
                borderColor: '#CBD5E1',
                color: '#475569',
              }}
            >
              Export CSV
            </Button>
          </Box>
        </Box>

        <TableContainer sx={{ maxHeight: 360 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                {columns.map((col) => (
                  <TableCell
                    key={col.key}
                    sx={{
                      fontWeight: 700,
                      color: '#475569',
                      fontSize: '0.75rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      py: 1.25,
                      bgcolor: '#F8FAFC',
                    }}
                  >
                    {col.label}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} align="center" sx={{ py: 3, color: '#94A3B8' }}>
                    No matching records found.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedRows.map((row, rIdx) => (
                  <TableRow
                    key={rIdx}
                    hover
                    sx={{
                      '&:nth-of-type(even)': { bgcolor: '#FCFDFF' },
                      '&:last-child td, &:last-child th': { border: 0 },
                    }}
                  >
                    {columns.map((col) => {
                      // Support both direct key and aliases
                      const val =
                        row[col.key] !== undefined
                          ? row[col.key]
                          : col.key === 'policy_check' && row['policy_status'] !== undefined
                          ? row['policy_status']
                          : col.key === 'policy_status' && row['policy_check'] !== undefined
                          ? row['policy_check']
                          : undefined;

                      if (col.format === 'currency' || col.key.includes('amount') || col.key.includes('spend')) {
                        if (typeof val === 'string' && val.startsWith('₹')) {
                          return (
                            <TableCell key={col.key} sx={{ fontWeight: 700, color: '#0F172A', fontSize: '0.85rem' }}>
                              {val}
                            </TableCell>
                          );
                        }
                        const num = typeof val === 'number' ? val : parseFloat(val);
                        return (
                          <TableCell key={col.key} sx={{ fontWeight: 700, color: '#0F172A', fontSize: '0.85rem' }}>
                            {isNaN(num) ? val : `₹${num.toLocaleString('en-IN')}`}
                          </TableCell>
                        );
                      }
                      if (col.format === 'status' || col.key === 'status') {
                        return (
                          <TableCell key={col.key}>
                            <Chip
                              size="small"
                              icon={<Check size={12} color="#059669" />}
                              label={String(val ?? 'Submitted')}
                              sx={{
                                height: 22,
                                fontSize: '0.72rem',
                                fontWeight: 600,
                                bgcolor: '#ECFDF5',
                                color: '#065F46',
                                borderRadius: 1.5,
                              }}
                            />
                          </TableCell>
                        );
                      }
                      if (col.format === 'policy_status' || col.key.includes('policy')) {
                        const isOk =
                          String(val).toLowerCase().includes('within') ||
                          String(val).toLowerCase().includes('compliant');
                        return (
                          <TableCell key={col.key}>
                            <Chip
                              size="small"
                              icon={isOk ? <Check size={12} color="#059669" /> : <AlertTriangle size={12} color="#D97706" />}
                              label={String(val ?? 'Within policy')}
                              sx={{
                                height: 22,
                                fontSize: '0.72rem',
                                fontWeight: 600,
                                bgcolor: isOk ? '#ECFDF5' : '#FFFBEB',
                                color: isOk ? '#065F46' : '#B45309',
                                borderRadius: 1.5,
                              }}
                            />
                          </TableCell>
                        );
                      }
                      return (
                        <TableCell key={col.key} sx={{ color: '#334155', fontSize: '0.83rem', py: 1.25 }}>
                          {String(val ?? '—')}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {filteredRows.length > 5 && (
          <TablePagination
            component="div"
            count={filteredRows.length}
            page={page}
            onPageChange={(_, newPage) => setPage(newPage)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
            rowsPerPageOptions={[5, 10, 25]}
            sx={{ borderTop: '1px solid #E2E8F0', '.MuiTablePagination-selectLabel, .MuiTablePagination-displayedRows': { fontSize: '0.75rem' } }}
          />
        )}
      </Card>
    );
  };

  // Helper for Conclusion Callout
  const renderConclusionCallout = (block: any) => {
    const text = block.text || block.data?.text || '';
    return (
      <Box
        sx={{
          my: 2,
          p: 1.75,
          borderRadius: 2,
          bgcolor: '#ECFDF5',
          border: '1px solid #A7F3D0',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
        }}
      >
        <CheckCircle size={20} color="#059669" />
        <Typography variant="body2" sx={{ color: '#065F46', fontWeight: 600, fontSize: '0.85rem' }}>
          {text}
        </Typography>
      </Box>
    );
  };

  // Separate blocks by type for clean layout (supporting both block_type and type keys)
  const allBlocks = response.blocks || [];
  const summaryCardBlocks = allBlocks.filter(
    (b: any) => b.block_type === 'summary_cards' || b.type === 'summary_cards'
  );
  const chartBlocks = allBlocks.filter(
    (b: any) =>
      b.block_type === 'donut_chart' ||
      b.type === 'donut_chart' ||
      b.block_type === 'pie_chart' ||
      b.type === 'pie_chart' ||
      b.block_type === 'bar_chart' ||
      b.type === 'bar_chart'
  );
  const exceptionBlocks = allBlocks.filter(
    (b: any) => b.block_type === 'policy_exception_box' || b.type === 'policy_exception_box'
  );
  const tableBlocks = allBlocks.filter((b: any) => b.block_type === 'table' || b.type === 'table');
  const conclusionBlocks = allBlocks.filter(
    (b: any) => b.block_type === 'conclusion_callout' || b.type === 'conclusion_callout'
  );

  const hasDonut = chartBlocks.length > 0;
  const hasException = exceptionBlocks.length > 0;

  return (
    <Box sx={{ width: '100%' }}>
      {/* Narrative Answer Text */}
      {response.answer && (
        <Typography
          variant="body1"
          sx={{
            color: '#1E293B',
            fontSize: '0.95rem',
            lineHeight: 1.6,
            mb: 1.5,
            fontWeight: 400,
          }}
        >
          {response.answer}
        </Typography>
      )}

      {/* 1. Summary Cards Row */}
      {summaryCardBlocks.map((block, idx) => (
        <React.Fragment key={`cards-${idx}`}>{renderSummaryCards(block)}</React.Fragment>
      ))}

      {/* 2. Middle Row: Donut Chart + Policy Exception Box Side-by-Side (Matches Mockup) */}
      {(hasDonut || hasException) && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              md: hasDonut && hasException ? '1.1fr 0.9fr' : '1fr',
            },
            gap: 2,
            my: 2,
          }}
        >
          {hasDonut && renderDonutChart(chartBlocks[0])}
          {hasException && renderPolicyExceptionBox(exceptionBlocks[0])}
        </Box>
      )}

      {/* 3. Tables */}
      {tableBlocks.map((block, idx) => (
        <React.Fragment key={`table-${idx}`}>{renderTable(block)}</React.Fragment>
      ))}

      {/* 4. Conclusion Callout */}
      {conclusionBlocks.map((block, idx) => (
        <React.Fragment key={`conclusion-${idx}`}>{renderConclusionCallout(block)}</React.Fragment>
      ))}

      {/* 5. Follow-up Question Chips */}
      {response.follow_up_questions && response.follow_up_questions.length > 0 && onFollowUpClick && (
        <Box sx={{ mt: 2, mb: 1 }}>
          <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600, display: 'block', mb: 1 }}>
            Suggested Follow-ups:
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {response.follow_up_questions.map((q, idx) => (
              <Chip
                key={idx}
                label={q}
                onClick={() => onFollowUpClick(q)}
                clickable
                variant="outlined"
                sx={{
                  bgcolor: '#F8FAFC',
                  borderColor: '#E2E8F0',
                  color: '#334155',
                  fontSize: '0.78rem',
                  '&:hover': { bgcolor: '#F1F5F9', borderColor: '#CBD5E1' },
                }}
              />
            ))}
          </Box>
        </Box>
      )}

      {/* 6. Footer Action Bar (Copy, Thumbs Up/Down, Export, Trace Link) */}
      <Divider sx={{ my: 1.5, borderColor: '#F1F5F9' }} />
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Tooltip title={feedback === 'thumbs_up' ? 'Helpful' : 'Mark as helpful'}>
            <IconButton
              size="small"
              onClick={() => handleFeedback('thumbs_up')}
              sx={{ color: feedback === 'thumbs_up' ? '#16A34A' : '#94A3B8' }}
            >
              <ThumbsUp size={15} />
            </IconButton>
          </Tooltip>
          <Tooltip title={feedback === 'thumbs_down' ? 'Not helpful' : 'Mark as unhelpful'}>
            <IconButton
              size="small"
              onClick={() => handleFeedback('thumbs_down')}
              sx={{ color: feedback === 'thumbs_down' ? '#DC2626' : '#94A3B8' }}
            >
              <ThumbsDown size={15} />
            </IconButton>
          </Tooltip>
          <Tooltip title={copied ? 'Copied!' : 'Copy response'}>
            <IconButton size="small" onClick={handleCopy} sx={{ color: copied ? '#2563EB' : '#94A3B8' }}>
              <Copy size={15} />
            </IconButton>
          </Tooltip>
          {tableBlocks.length > 0 && (
            <Tooltip title="Download table CSV">
              <IconButton size="small" onClick={() => handleExportCSV(tableBlocks[0])} sx={{ color: '#94A3B8' }}>
                <Download size={15} />
              </IconButton>
            </Tooltip>
          )}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {response.execution_summary?.latency_ms !== undefined && (
            <Typography variant="caption" sx={{ color: '#94A3B8', fontSize: '0.72rem' }}>
              {(response.execution_summary.latency_ms / 1000).toFixed(2)}s • {response.execution_summary.total_tokens} tokens
            </Typography>
          )}
          {response.trace_id && (
            <Tooltip title="View execution trace & observability">
              <Button
                size="small"
                variant="text"
                onClick={() => navigate(`/runs/${response.trace_id}`)}
                endIcon={<ExternalLink size={12} />}
                sx={{
                  color: '#2563EB',
                  fontSize: '0.75rem',
                  textTransform: 'none',
                  p: '2px 6px',
                  minWidth: 0,
                }}
              >
                Trace
              </Button>
            </Tooltip>
          )}
        </Box>
      </Box>
    </Box>
  );
};
