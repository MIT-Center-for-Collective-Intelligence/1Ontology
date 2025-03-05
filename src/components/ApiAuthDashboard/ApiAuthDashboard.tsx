import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useSnackbar } from 'notistack';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Grid,
  IconButton,
  Paper,
  Skeleton,
  TextField,
  Typography,
  useTheme
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Key as KeyIcon,
  Login as LoginIcon,
  ContentCopy as CopyIcon,
  Warning as WarningIcon,
  Description as DescriptionIcon
} from '@mui/icons-material';
import { apiKeyManager } from ' @components/lib/utils/apiKeyManager';
import { ApiKeyInfo } from ' @components/types/api';
import { useAuth } from '../context/AuthContext';
import { Timestamp } from 'firebase/firestore';

interface ApiAuthDashboardProps {
  onKeyGenerated?: (key: string) => void;
  isPopup?: boolean;
}

const ApiAuthDashboard: React.FC<ApiAuthDashboardProps> = ({
  onKeyGenerated,
  isPopup = false
}) => {
  const [{ user, isLoading }, { handleError }] = useAuth();
  const [apiKeys, setApiKeys] = useState<ApiKeyInfo[]>([]);
  const [isLoadingKeys, setIsLoadingKeys] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedKey, setSelectedKey] = useState<ApiKeyInfo | null>(null);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [openDescriptionDialog, setOpenDescriptionDialog] = useState(false);
  const [keyDescription, setKeyDescription] = useState('');
  const router = useRouter();
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const theme = useTheme();

  const loadApiKeys = async () => {
    if (!user?.userId) return;

    try {
      setIsLoadingKeys(true);
      const response = await fetch(`/api/keys?userId=${user.userId}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to load API keys');
      }

      // Sort the API keys by creation date (newest first)
      const sortedKeys = [...data.data].sort((a, b) => {
        const dateA = new Date(a.createdAt._seconds * 1000 + Math.floor(a.createdAt._nanoseconds / 1000000));
        const dateB = new Date(b.createdAt._seconds * 1000 + Math.floor(b.createdAt._nanoseconds / 1000000));

        // Sort in descending order (newest first)
        return dateB.getTime() - dateA.getTime();
      });

      setApiKeys(sortedKeys);
    } catch (error) {
      handleError({
        error,
        errorMessage: 'Failed to load API keys'
      });
    } finally {
      setIsLoadingKeys(false);
    }
  };

  useEffect(() => {
    if (user?.userId) {
      loadApiKeys();
    }
  }, [user]);

  // Function to update RapiDoc auth field with the API key
  const updateRapiDocAuth = (apiKey: string) => {
    // Call the prop callback if provided
    if (onKeyGenerated) {
      onKeyGenerated(apiKey);
    }
  };

  // Handle opening the description dialog
  const handleOpenDescriptionDialog = () => {
    // Set default description
    setKeyDescription(`API Key for ${user?.fName || ''} ${user?.lName || ''}`);
    setOpenDescriptionDialog(true);
  };

  // Handle closing the description dialog
  const handleCloseDescriptionDialog = () => {
    setOpenDescriptionDialog(false);
  };

  // Generate key with the provided description
  const handleGenerateKeyWithDescription = async () => {
    setOpenDescriptionDialog(false);
    await generateApiKey(keyDescription);
  };

  const generateApiKey = async (description: string) => {
    if (!user) return;

    try {
      setIsGenerating(true);
      const response = await fetch('/api/keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.userId,
          uname: user.uname,
          description: description || `API Key for ${user.fName} ${user.lName}`
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to generate API key');
      }

      const { apiKey } = data.data;

      // Show the success notification
      enqueueSnackbar('API Key generated successfully', {
        variant: 'success',
      });

      // Show the API key in a persistent notification
      enqueueSnackbar(
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Save your API key:
          </Typography>
          <Typography
            variant="body2"
            sx={{
              bgcolor: theme.palette.background.paper,
              p: 1,
              borderRadius: 1,
              fontFamily: 'monospace'
            }}
          >
            {apiKey}
          </Typography>
        </Box>,
        {
          variant: 'info',
          persist: true,
          action: (key) => (
            <Button
              size="small"
              variant="contained"
              onClick={() => {
                navigator.clipboard.writeText(apiKey);
                enqueueSnackbar('API Key copied to clipboard', { variant: 'success' });
                closeSnackbar(key);  // Close the specific snackbar after copying

                // Update RapiDoc if needed
                updateRapiDocAuth(apiKey);
              }}
            >
              <CopyIcon fontSize="small" sx={{ mr: 1 }} />
              Copy & Use
            </Button>
          )
        }
      );

      await loadApiKeys();
    } catch (error) {
      handleError({
        error,
        errorMessage: 'Failed to generate API key'
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeactivateKey = async (key: ApiKeyInfo) => {
    if (!user) return;

    try {
      const response = await fetch(`/api/keys?clientId=${key.clientId}&userId=${user.userId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to deactivate API key');
      }

      enqueueSnackbar('API Key deactivated successfully', { variant: 'success' });
      setOpenDeleteDialog(false);
      setSelectedKey(null);
      await loadApiKeys();
    } catch (error) {
      handleError({
        error,
        errorMessage: 'Failed to deactivate API key'
      });
    }
  };

  const handleDeleteClick = (key: ApiKeyInfo) => {
    setSelectedKey(key);
    setOpenDeleteDialog(true);
  };

  // Function to retrieve and use an API key
  const handleUseKey = async (clientId: string) => {
    if (!user) return;

    try {
      const loadingSnackbarId = enqueueSnackbar('Fetching API key...', { variant: 'info' });

      // Make an API call to get the actual key
      const response = await fetch(`/api/keys?clientId=${clientId}&userId=${user.userId}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to retrieve API key');
      }

      closeSnackbar(loadingSnackbarId);

      const { apiKey } = data.data;

      enqueueSnackbar(
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Your API key:
          </Typography>
          <Typography
            variant="body2"
            sx={{
              bgcolor: theme.palette.background.paper,
              p: 1,
              borderRadius: 1,
              fontFamily: 'monospace'
            }}
          >
            {apiKey}
          </Typography>
        </Box>,
        {
          variant: 'info',
          persist: true,
          action: (key) => (
            <Button
              size="small"
              variant="contained"
              onClick={() => {
                navigator.clipboard.writeText(apiKey);
                enqueueSnackbar('API Key copied to clipboard', { variant: 'success' });
                closeSnackbar(key);  // Close the specific snackbar

                // Update RapiDoc auth field if needed
                updateRapiDocAuth(apiKey);
              }}
            >
              <CopyIcon fontSize="small" sx={{ mr: 1 }} />
              Copy & Use
            </Button>
          )
        }
      );
    } catch (error) {
      handleError({
        error,
        errorMessage: 'Failed to retrieve API key'
      });
    }
  };

  const convertFirestoreTimestamp = (timestamp: any, formatOptions: { includeTime?: boolean } = {}): string | null => {
    if (!timestamp) return null;

    let jsDate: Date;

    if (timestamp._seconds !== undefined && timestamp._nanoseconds !== undefined) {
      const milliseconds = timestamp._seconds * 1000 + Math.floor(timestamp._nanoseconds / 1000000);
      jsDate = new Date(milliseconds);
    } else {
      jsDate = new Date(timestamp);
    }

    if (formatOptions.includeTime) {
      const options: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      };
      return jsDate.toLocaleDateString(undefined, options);
    }

    return jsDate.toLocaleDateString();
  };

  if (isLoading) {
    return (
      <Box sx={{ maxWidth: isPopup ? 'auto' : 800, mx: 'auto', p: 3 }}>
        <Skeleton variant="rectangular" height={200} />
      </Box>
    );
  }

  if (!user) {
    return (
      <Paper
        elevation={3}
        sx={{
          maxWidth: isPopup ? 'auto' : 800,
          mx: 'auto',
          p: 3,
          textAlign: 'center',
          bgcolor: theme.palette.background.paper
        }}
      >
        <KeyIcon color="primary" sx={{ fontSize: 48, mb: 2 }} />
        <Typography variant="h5" gutterBottom>
          API Authentication Required
        </Typography>
        <Typography variant="body1" color="text.secondary" paragraph>
          Log in or create an account to generate API keys for accessing our API endpoints.
          All API endpoints require authentication using an API key.
        </Typography>
        <Link href="/signin" passHref>
          <Button
            variant="contained"
            size="large"
            startIcon={<LoginIcon />}
          >
            Sign In to Manage API Keys
          </Button>
        </Link>
      </Paper>
    );
  }

  return (
    <Paper
      elevation={isPopup ? 0 : 3} // No elevation when in popup mode
      sx={{
        maxWidth: isPopup ? 'auto' : 800,
        mx: 'auto',
        p: isPopup ? 0 : 3, // No padding in popup mode (handled by Dialog)
        bgcolor: theme.palette.background.paper
      }}
    >
      {!isPopup && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="h5" gutterBottom>
            API Key Management
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Generate and manage your API keys for accessing our API endpoints.
            {!user.admin && " You have access to basic API endpoints."}
          </Typography>
        </Box>
      )}

      <Box sx={{ mb: 4 }}>
        <Grid container justifyContent="space-between" alignItems="center">
          <Grid item>
            <Typography variant="h6">Your API Keys</Typography>
          </Grid>
          <Grid item>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleOpenDescriptionDialog}
              disabled={isGenerating}
            >
              {isGenerating ? 'Generating...' : 'Generate New Key'}
            </Button>
          </Grid>
        </Grid>
      </Box>

      {isLoadingKeys ? (
        <Box sx={{ py: 2 }}>
          <Skeleton variant="rectangular" height={100} sx={{ mb: 2 }} />
          <Skeleton variant="rectangular" height={100} />
        </Box>
      ) : apiKeys.length === 0 ? (
        <Paper
          variant="outlined"
          sx={{
            p: { xs: 5, sm: 6 },
            textAlign: 'center',
            bgcolor: theme.palette.background.default,
            borderRadius: 2,
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
          }}
        >
          <KeyIcon sx={{ fontSize: 44, color: theme.palette.text.secondary, mb: 2 }} />
          <Typography variant="h6" sx={{ color: theme.palette.text.secondary, fontWeight: 500, mb: 1 }}>
            You haven't generated any API keys yet.
          </Typography>
          <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
            Click the button above to create your first key.
          </Typography>
        </Paper>
      ) : (
        <Box sx={{ mt: 4 }}>
          {apiKeys.map((key) => (
            <Card
              key={key.clientId}
              sx={{
                mb: 4,
                bgcolor: theme.palette.background.default,
                borderRadius: 2,
                overflow: 'visible',
                transition: 'all 0.2s ease-in-out',
                border: '1px solid',
                borderColor: key.isActive ?
                  `${theme.palette.primary.main}20` :
                  'rgba(0,0,0,0.08)',
                boxShadow: key.isActive ?
                  `0 3px 10px ${theme.palette.primary.main}15` :
                  '0 2px 8px rgba(0,0,0,0.05)',
                '&:hover': {
                  boxShadow: key.isActive ?
                    `0 4px 12px ${theme.palette.primary.main}20` :
                    '0 3px 10px rgba(0,0,0,0.08)',
                }
              }}
            >
              <CardContent sx={{ p: 2 }}>
                <Grid container spacing={3} alignItems="center" sx={{ pt: 2, pb: 2}}>
                  <Grid item xs={12} md={7}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 0.75 }}>
                      <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600, mr: 2 }}>
                        {key.description}
                      </Typography>
                      <Chip
                        size="small"
                        label={key.isActive ? 'Active' : 'Inactive'}
                        color={key.isActive ? 'success' : 'default'}
                        sx={{
                          height: 24,
                          fontWeight: 500,
                          borderRadius: '12px',
                          '& .MuiChip-label': { px: 1.5 }
                        }}
                      />
                    </Box>

                    <Box sx={{
                      display: 'flex',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 1,
                      mb: 2
                    }}>
                      <Typography
                        variant="body2"
                        sx={{
                          color: theme.palette.text.primary,
                          fontFamily: 'inherit',
                          bgcolor: 'rgba(0,0,0,0.03)',
                          borderRadius: 1,
                          fontSize: '0.875rem',
                          letterSpacing: '0.01em'
                        }}
                      >
                        {key.clientId}
                      </Typography>
                    </Box>

                    <Box sx={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: { xs: 2, sm: 2.5 }
                    }}>
                      <Box sx={{
                        display: 'flex',
                        alignItems: 'center'
                      }}>
                        <Typography variant="body2" color="text.secondary" sx={{ mr: 0.5, fontSize: '0.85rem' }}>
                          Created:
                        </Typography>
                        <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
                          {convertFirestoreTimestamp(key.createdAt, { includeTime: true }) || 'Unknown'}
                        </Typography>
                      </Box>

                      <Box sx={{
                        display: 'flex',
                        alignItems: 'center'
                      }}>
                        <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>
                          Last Used:
                        </Typography>
                        <Typography variant="caption" fontWeight="medium">
                          {key.lastUsed ? convertFirestoreTimestamp(key.lastUsed, { includeTime: true }) : 'Never'}
                        </Typography>
                      </Box>
                    </Box>
                  </Grid>

                  <Grid item xs={12} md={5} sx={{
                    display: 'flex',
                    justifyContent: { xs: 'flex-start', md: 'flex-end' },
                    mt: { xs: 2, md: 0 }
                  }}>
                    {key.isActive && (
                      <Button
                        size="medium"
                        variant="contained"
                        onClick={() => handleUseKey(key.clientId)}
                        sx={{
                          mr: 2,
                          borderRadius: '8px',
                          textTransform: 'none',
                          px: 3
                        }}
                        // startIcon={<KeyIcon />}
                      >
                        Use Key
                      </Button>
                    )}
                    <Button
                      color="error"
                      onClick={() => handleDeleteClick(key)}
                      disabled={!key.isActive}
                      variant="outlined"
                      sx={{
                        borderRadius: '8px',
                        textTransform: 'none'
                      }}
                      startIcon={<DeleteIcon />}
                    >
                      Deactivate
                    </Button>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      {/* Description Dialog */}
      <Dialog
        open={openDescriptionDialog}
        onClose={handleCloseDescriptionDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <DescriptionIcon sx={{ mr: 1, color: theme.palette.primary.main }} />
            Add Key Description
          </Box>
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Enter a description for your new API key. This will help you identify what this key is used for.
          </DialogContentText>
          <TextField
            autoFocus
            margin="dense"
            id="description"
            label="API Key Description"
            type="text"
            fullWidth
            variant="outlined"
            value={keyDescription}
            onChange={(e) => setKeyDescription(e.target.value)}
            placeholder="e.g., For Node Creation, For Testing Environment, etc."
            helperText="Optional - A default description will be used if left empty"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCloseDescriptionDialog} color="inherit">
            Cancel
          </Button>
          <Button
            onClick={handleGenerateKeyWithDescription}
            variant="contained"
          >
            Generate Key
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog
        open={openDeleteDialog}
        onClose={() => setOpenDeleteDialog(false)}
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <WarningIcon color="warning" sx={{ mr: 1 }} />
            Deactivate API Key
          </Box>
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to deactivate this API key? This action cannot be undone,
            and any applications using this key will no longer have access to the API.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDeleteDialog(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => selectedKey && handleDeactivateKey(selectedKey)}
            color="error"
            variant="contained"
          >
            Deactivate
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default ApiAuthDashboard;