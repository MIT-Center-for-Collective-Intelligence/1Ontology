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
  Typography,
  useTheme
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Key as KeyIcon,
  Login as LoginIcon,
  ContentCopy as CopyIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { apiKeyManager } from ' @components/lib/utils/apiKeyManager';
import { ApiKeyInfo } from ' @components/types/api';
import { useAuth } from '../context/AuthContext';
import { Timestamp } from 'firebase/firestore';

const ApiAuthDashboard: React.FC = () => {
  const [{ user, isLoading }, { handleError }] = useAuth();
  const [apiKeys, setApiKeys] = useState<ApiKeyInfo[]>([]);
  const [isLoadingKeys, setIsLoadingKeys] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedKey, setSelectedKey] = useState<ApiKeyInfo | null>(null);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
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

      setApiKeys(data.data);
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
  
  const updateRapiDocAuth = (apiKey: string) => {
    const authInput = document.querySelector('rapi-doc input[data-tab="authentication"]') as HTMLInputElement;
    if (authInput) {
      authInput.value = apiKey;
      // Trigger the SET button click if it exists
      const setButton = authInput.parentElement?.querySelector('button');
      if (setButton) {
        setButton.click();
      }
    }
  };

  const handleGenerateKey = async () => {
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
          description: `API Key for ${user.fName} ${user.lName}`
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
        action: () => (
          <Button 
            size="small"
            variant="contained"
            onClick={() => {
              navigator.clipboard.writeText(apiKey);
              enqueueSnackbar('API Key copied to clipboard', { variant: 'success' });
            }}
          >
            <CopyIcon fontSize="small" sx={{ mr: 1 }} />
            Copy
          </Button>
        )
      });

      // Show the API key in a persistent notification
      enqueueSnackbar(
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Save your API key - it will only be shown once:
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
                closeSnackbar();  // Close the snackbar after copying
              }}
            >
              <CopyIcon fontSize="small" sx={{ mr: 1 }} />
              Copy
            </Button>
          )
        }
      );      
      updateRapiDocAuth(apiKey);
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


  if (isLoading) {
    return (
      <Box sx={{ maxWidth: 800, mx: 'auto', p: 3 }}>
        <Skeleton variant="rectangular" height={200} />
      </Box>
    );
  }

  if (!user) {
    return (
      <Paper 
        elevation={3} 
        sx={{ 
          maxWidth: 800, 
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

  console.log(apiKeys);
  return (
    <Paper 
      elevation={3}
      sx={{ 
        maxWidth: 800, 
        mx: 'auto', 
        p: 3,
        bgcolor: theme.palette.background.paper
      }}
    >
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" gutterBottom>
          API Key Management
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Generate and manage your API keys for accessing our API endpoints.
          {!user.admin && " You have access to basic API endpoints."}
        </Typography>
      </Box>

      <Box sx={{ mb: 4 }}>
        <Grid container justifyContent="space-between" alignItems="center">
          <Grid item>
            <Typography variant="h6">Your API Keys</Typography>
          </Grid>
          <Grid item>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleGenerateKey}
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
            p: 3, 
            textAlign: 'center',
            bgcolor: theme.palette.background.default
          }}
        >
          <KeyIcon sx={{ fontSize: 40, color: 'text.secondary', mb: 2 }} />
          <Typography variant="body1" color="text.secondary">
            You haven't generated any API keys yet.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Click the button above to create your first key.
          </Typography>
        </Paper>
      ) : (
        <Box sx={{ mt: 2 }}>
          {apiKeys.map((key) => (
            <Card 
              key={key.clientId} 
              sx={{ 
                mb: 2,
                bgcolor: theme.palette.background.default
              }}
            >
              <CardContent>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs>
                    <Typography variant="subtitle1">
                      {key.description}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Client ID: {key.clientId}
                    </Typography>
                    <Box sx={{ mt: 1 }}>
                      <Chip
                        size="small"
                        label={key.isActive ? 'Active' : 'Inactive'}
                        color={key.isActive ? 'success' : 'default'}
                        sx={{ mr: 1 }}
                      />
                      <Typography variant="caption" color="text.secondary" component="span">
                        Created: {new Date(key.createdAt).toLocaleDateString()}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" component="span" sx={{ ml: 2 }}>
                        Last Used: {new Date(key.lastUsed).toLocaleDateString()}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item>
                    <IconButton
                      color="error"
                      onClick={() => handleDeleteClick(key)}
                      disabled={!key.isActive}
                      size="small"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

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