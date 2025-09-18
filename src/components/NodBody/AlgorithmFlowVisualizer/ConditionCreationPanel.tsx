import React, { useState, useCallback } from 'react';
import { Panel } from '@xyflow/react';
import {
  Box,
  Typography,
  TextField,
  Button,
  IconButton,
  Divider,
  Alert,
} from '@mui/material';
import {
  AccountTree as ConditionIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { IConditionActivity } from '@components/types/INode';

interface ConditionCreationPanelProps {
  isDarkMode: boolean;
  visible: boolean;
  onCreateCondition: (condition: IConditionActivity) => void;
  onClose: () => void;
}

/**
 * Creates base panel styles based on theme mode (same as other panels)
 */
const createBasePanelStyles = (isDarkMode: boolean) => ({
  background: isDarkMode
    ? "rgba(30, 30, 30, 0.95)"
    : "rgba(255, 255, 255, 0.95)",
  borderRadius: "8px",
  padding: "12px",
  border: `1px solid ${isDarkMode ? "#333" : "#ddd"}`,
  boxShadow: isDarkMode
    ? "0 4px 12px rgba(0, 0, 0, 0.4)"
    : "0 4px 12px rgba(0, 0, 0, 0.15)",
  zIndex: 10,
});

const ConditionCreationPanel: React.FC<ConditionCreationPanelProps> = ({
  isDarkMode,
  visible,
  onCreateCondition,
  onClose,
}) => {
  const [conditionName, setConditionName] = useState('');
  const [conditionExpression, setConditionExpression] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  const basePanelStyles = createBasePanelStyles(isDarkMode);

  const resetForm = useCallback(() => {
    setConditionName('');
    setConditionExpression('');
    setErrors([]);
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  const createCondition = useCallback(() => {
    try {
      // Validate inputs
      const validationErrors: string[] = [];
      
      if (!conditionName.trim()) {
        validationErrors.push('Condition name is required');
      }
      
      if (!conditionExpression.trim()) {
        validationErrors.push('Condition expression is required');
      }
      
      if (validationErrors.length > 0) {
        setErrors(validationErrors);
        return;
      }

      // Create the condition activity
      const condition: IConditionActivity = {
        id: `condition_${Date.now()}`,
        name: conditionName.trim() || 'Condition',
        type: 'condition',
        variables: [], // Can be extended later if needed
        condition: {
          [conditionExpression.trim()]: true
        },
        sub_activities: [] // Will be populated with actual activities later
      };

      onCreateCondition(condition);
      handleClose();
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'Unknown error occurred']);
    }
  }, [conditionName, conditionExpression, onCreateCondition, handleClose]);

  if (!visible) {
    return null;
  }

  return (
    <Panel 
      position="top-left" 
      style={{
        ...basePanelStyles,
        width: '320px',
        maxHeight: '400px',
        marginLeft: '180px', // Position to the right of legend panel (same as other panels)
        overflow: 'hidden',
      }}
    >
      <Box 
        sx={{ 
          display: "flex", 
          flexDirection: "column", 
          gap: 2,
          maxHeight: '380px',
          overflowY: 'auto',
          pr: 0.5,
          scrollbarWidth: 'thin',
          scrollbarColor: `${isDarkMode ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.35)'} transparent`,
          '&::-webkit-scrollbar': {
            width: '6px',
            height: '6px'
          },
          '&::-webkit-scrollbar-track': {
            background: 'transparent',
          },
          '&::-webkit-scrollbar-thumb': {
            background: isDarkMode ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.35)',
            borderRadius: '3px',
          },
          '&::-webkit-scrollbar-thumb:hover': {
            background: isDarkMode ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.45)',
          },
        }}
      >
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ConditionIcon sx={{ color: isDarkMode ? '#ffb74d' : '#f57c00' }} />
            <Typography variant="subtitle1" fontWeight="medium">
              Create Condition
            </Typography>
          </Box>
          <IconButton size="small" onClick={handleClose}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        {errors.length > 0 && (
          <Alert severity="error" sx={{ fontSize: '12px' }}>
            {errors.map((error, index) => (
              <div key={index}>{error}</div>
            ))}
          </Alert>
        )}

        {/* Condition Configuration */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Condition Name"
            value={conditionName}
            onChange={(e) => setConditionName(e.target.value)}
            placeholder="e.g., Check Temperature"
            fullWidth
            size="small"
          />

          <TextField
            label="Condition Expression"
            value={conditionExpression}
            onChange={(e) => setConditionExpression(e.target.value)}
            placeholder="e.g., temperature > 30"
            fullWidth
            size="small"
            multiline
            rows={2}
            helperText="Enter the logical expression to evaluate"
            sx={{ 
              '& .MuiFormHelperText-root': { 
                fontSize: '11px',
                mt: 0.5
              }
            }}
          />
        </Box>

        {/* Action Buttons */}
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', mt: 2 }}>
          <Button onClick={handleClose} size="small">
            Cancel
          </Button>
          <Button
            onClick={createCondition}
            variant="contained"
            startIcon={<ConditionIcon />}
            size="small"
          >
            Create Condition
          </Button>
        </Box>
      </Box>
    </Panel>
  );
};

export default ConditionCreationPanel;