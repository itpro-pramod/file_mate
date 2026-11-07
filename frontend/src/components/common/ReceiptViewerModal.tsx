import React, { useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Download,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Minus,
  Plus,
  RotateCw,
  X,
  ZoomIn,
} from 'lucide-react';
import { api } from '../../services/api';

interface ReceiptViewerModalProps {
  open: boolean;
  onClose: () => void;
  receiptPath: string | null;
  merchant?: string;
  amount?: number;
  currency?: string;
  category?: string;
  date?: string;
}

export const ReceiptViewerModal: React.FC<ReceiptViewerModalProps> = ({
  open,
  onClose,
  receiptPath,
  merchant,
  amount,
  currency = 'INR',
  category,
  date,
}) => {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  if (!receiptPath) return null;

  const url = api.getReceiptUrl(receiptPath);
  const isPdf = receiptPath.toLowerCase().endsWith('.pdf');
  const filename = receiptPath.split('/').pop() || receiptPath;

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.25, 0.5));
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);
  const handleReset = () => {
    setZoom(1);
    setRotation(0);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          overflow: 'hidden',
          bgcolor: '#FFFFFF',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      <DialogTitle
        sx={{
          m: 0,
          p: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #E2E8F0',
          bgcolor: '#F8FAFC',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              p: 1,
              borderRadius: 2,
              bgcolor: isPdf ? '#FEE2E2' : '#EFF6FF',
              color: isPdf ? '#DC2626' : '#2563EB',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {isPdf ? <FileText size={20} /> : <ImageIcon size={20} />}
          </Box>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0F172A', lineHeight: 1.2 }}>
              {merchant ? `${merchant} Receipt` : 'Expense Receipt'}
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748B', display: 'flex', gap: 1, alignItems: 'center' }}>
              <span>{filename}</span>
              {amount !== undefined && (
                <>
                  <span>•</span>
                  <span style={{ fontWeight: 600, color: '#059669' }}>
                    ₹{amount.toLocaleString('en-IN')} {currency}
                  </span>
                </>
              )}
              {category && (
                <>
                  <span>•</span>
                  <span>{category}</span>
                </>
              )}
              {date && (
                <>
                  <span>•</span>
                  <span>{date}</span>
                </>
              )}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Tooltip title="Open Original in New Tab">
            <IconButton
              component="a"
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              size="small"
              sx={{ color: '#64748B' }}
            >
              <ExternalLink size={18} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Close">
            <IconButton onClick={onClose} size="small" sx={{ color: '#64748B' }}>
              <X size={20} />
            </IconButton>
          </Tooltip>
        </Box>
      </DialogTitle>

      {/* Toolbar for image manipulation */}
      {!isPdf && (
        <Box
          sx={{
            py: 1,
            px: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            bgcolor: '#F1F5F9',
            borderBottom: '1px solid #E2E8F0',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Tooltip title="Zoom Out">
              <span>
                <IconButton size="small" onClick={handleZoomOut} disabled={zoom <= 0.5}>
                  <Minus size={16} />
                </IconButton>
              </span>
            </Tooltip>
            <Typography variant="caption" sx={{ fontWeight: 600, minWidth: 45, textAlign: 'center' }}>
              {Math.round(zoom * 100)}%
            </Typography>
            <Tooltip title="Zoom In">
              <span>
                <IconButton size="small" onClick={handleZoomIn} disabled={zoom >= 3}>
                  <Plus size={16} />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Rotate 90°">
              <IconButton size="small" onClick={handleRotate}>
                <RotateCw size={16} />
              </IconButton>
            </Tooltip>
            <Button size="small" onClick={handleReset} sx={{ textTransform: 'none', fontSize: '0.75rem', py: 0.2 }}>
              Reset
            </Button>
          </Box>

          <Button
            component="a"
            href={url}
            download={filename}
            size="small"
            variant="outlined"
            startIcon={<Download size={14} />}
            sx={{ textTransform: 'none', fontSize: '0.75rem', py: 0.3 }}
          >
            Download
          </Button>
        </Box>
      )}

      <DialogContent
        sx={{
          p: 2,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          bgcolor: '#0F172A',
          overflow: 'auto',
          minHeight: 480,
          maxHeight: '65vh',
        }}
      >
        {isPdf ? (
          <Box sx={{ width: '100%', height: '60vh' }}>
            <object
              data={url}
              type="application/pdf"
              width="100%"
              height="100%"
              style={{ borderRadius: 8, border: 'none' }}
            >
              <Box sx={{ p: 4, textAlign: 'center', color: '#FFFFFF' }}>
                <Typography variant="body1" sx={{ mb: 2 }}>
                  PDF preview is not supported directly in your browser.
                </Typography>
                <Button
                  component="a"
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="contained"
                  startIcon={<ExternalLink size={16} />}
                  sx={{ bgcolor: '#2563EB' }}
                >
                  Open PDF in New Tab
                </Button>
              </Box>
            </object>
          </Box>
        ) : (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              width: '100%',
              minHeight: 420,
              overflow: 'auto',
            }}
          >
            <img
              src={url}
              alt="Receipt preview"
              style={{
                maxWidth: '100%',
                maxHeight: '58vh',
                objectFit: 'contain',
                borderRadius: 8,
                transform: `scale(${zoom}) rotate(${rotation}deg)`,
                transition: 'transform 0.15s ease',
                boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                background: '#FFFFFF',
              }}
            />
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 1.5, borderTop: '1px solid #E2E8F0', bgcolor: '#F8FAFC' }}>
        <Typography variant="caption" sx={{ color: '#64748B', flexGrow: 1 }}>
          Verified local storage audit copy • Visible to Consultant and Finance Controller
        </Typography>
        <Button onClick={onClose} variant="contained" sx={{ bgcolor: '#2563EB', textTransform: 'none', px: 3 }}>
          Done
        </Button>
      </DialogActions>
    </Dialog>
  );
};
