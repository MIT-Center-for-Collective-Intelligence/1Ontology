import React, { useState, useCallback } from 'react';
import { Panel } from '@xyflow/react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Chip,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  Alert,
} from '@mui/material';
import {
  Loop as LoopIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { ILoopActivity, IActivity } from '@components/types/INode';
import { LoopBuilder, LoopPatterns, LoopValidator } from './LoopBuilder';

interface LoopCreationPanelProps {
  isDarkMode: boolean;
  visible: boolean;
  onCreateLoop: (loop: ILoopActivity) => void;
  onClose: () => void;
  availableActivities?: IActivity[];
}

type LoopType = 'custom';

/**
 * Creates base panel styles based on theme mode (same as TaskSelectionPanel)
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

const LoopCreationPanel: React.FC<LoopCreationPanelProps> = ({
  isDarkMode,
  visible,
  onCreateLoop,
  onClose,
  availableActivities = [],
}) => {
  const [loopType, setLoopType] = useState<LoopType>('custom');
  const [loopName, setLoopName] = useState('');
  const [variables, setVariables] = useState<string[]>(['i']);
  const [conditions, setConditions] = useState<Record<string, boolean>>({});
  const [conditionInput, setConditionInput] = useState('');
  const [selectedActivities, setSelectedActivities] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  const basePanelStyles = createBasePanelStyles(isDarkMode);

  const resetForm = useCallback(() => {
    setLoopType('custom');
    setLoopName('');
    setVariables(['i']);
    setConditions({});
    setConditionInput('');
    setSelectedActivities([]);
    setErrors([]);
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);


  const addCondition = useCallback(() => {
    if (conditionInput.trim()) {
      setConditions(prev => ({ ...prev, [conditionInput.trim()]: true }));
      setConditionInput('');
    }
  }, [conditionInput]);

  const removeCondition = useCallback((condition: string) => {
    setConditions(prev => {
      const newConditions = { ...prev };
      delete newConditions[condition];
      return newConditions;
    });
  }, []);

  const toggleActivitySelection = useCallback((activityId: string) => {
    setSelectedActivities(prev =>
      prev.includes(activityId)
        ? prev.filter(id => id !== activityId)
        : [...prev, activityId]
    );
  }, []);

  const createLoop = useCallback(() => {
    try {
      const selectedActivityObjects = availableActivities.filter(a =>
        selectedActivities.includes(a.id)
      );

      const loop = new LoopBuilder()
        .name(loopName || 'Custom Loop')
        .variables(variables.filter(v => v.trim()))
        .condition(conditions)
        .activities(selectedActivityObjects)
        .build();

      // Validate the loop
      const validationErrors = LoopValidator.validateLoopConfig({
        name: loop.name,
        id: loop.id,
        variables: loop.variables,
        loopCondition: loop.loop_condition,
        subActivities: loop.sub_activities,
      });

      if (validationErrors.length > 0) {
        setErrors(validationErrors);
        return;
      }

      onCreateLoop(loop);
      handleClose();
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'Unknown error occurred']);
    }
  }, [
    loopName, variables, conditions, selectedActivities,
    availableActivities, onCreateLoop, handleClose
  ]);


  if (!visible) {
    return null;
  }

  return (
    <Panel 
      position="top-left" 
      style={{
        ...basePanelStyles,
        width: '380px',
        maxHeight: '500px',
        marginLeft: '180px', // Position to the right of legend panel (same as TaskSelectionPanel)
        overflow: 'hidden',
      }}
    >
      <Box 
        sx={{ 
          display: "flex", 
          flexDirection: "column", 
          gap: 2,
          maxHeight: '480px',
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
            <LoopIcon sx={{ color: isDarkMode ? '#90caf9' : '#1976d2' }} />
            <Typography variant="subtitle1" fontWeight="medium">
              Create Loop Container
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

        {/* Custom Loop Configuration */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Loop Name"
              value={loopName}
              onChange={(e) => setLoopName(e.target.value)}
              placeholder="e.g., Process Items Loop"
              fullWidth
              size="small"
              sx={{
                '& .MuiInputBase-input::placeholder': {
                  color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.6)',
                  opacity: 1,
                },
                '& .MuiInputLabel-root': {
                  color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.6)',
                },
                '& .MuiInputLabel-root.Mui-focused': {
                  color: isDarkMode ? '#90caf9' : '#1976d2',
                },
                '& .MuiOutlinedInput-root': {
                  '& fieldset': {
                    borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.23)' : 'rgba(0, 0, 0, 0.23)',
                  },
                  '&:hover fieldset': {
                    borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: isDarkMode ? '#90caf9' : '#1976d2',
                  },
                },
              }}
            />


            {/* Conditions */}
            <Box>
              <Typography variant="subtitle2" gutterBottom sx={{ fontSize: '13px' }}>
                Loop Conditions
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                <TextField
                  size="small"
                  value={conditionInput}
                  onChange={(e) => setConditionInput(e.target.value)}
                  placeholder="e.g., i < 10"
                  sx={{
                    flex: 1,
                    '& .MuiInputBase-input::placeholder': {
                      color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.6)',
                      opacity: 1,
                    },
                    '& .MuiOutlinedInput-root': {
                      '& fieldset': {
                        borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.23)' : 'rgba(0, 0, 0, 0.23)',
                      },
                      '&:hover fieldset': {
                        borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)',
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: isDarkMode ? '#90caf9' : '#1976d2',
                      },
                    },
                  }}
                  onKeyPress={(e) => e.key === 'Enter' && addCondition()}
                />
                <Button
                  size="small"
                  onClick={addCondition}
                  variant="outlined"
                  disabled={!conditionInput.trim()}
                  sx={{ fontSize: '11px' }}
                >
                  Add
                </Button>
              </Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {Object.keys(conditions).map((condition) => (
                  <Chip
                    key={condition}
                    label={condition}
                    onDelete={() => removeCondition(condition)}
                    size="small"
                    variant="outlined"
                  />
                ))}
              </Box>
            </Box>
          </Box>

        <Divider />

        {/* Activity Selection */}
        {availableActivities.length > 0 && (
          <Box>
            <Typography variant="subtitle2" gutterBottom sx={{ fontSize: '13px' }}>
              Activities to Include in Loop (Optional)
            </Typography>
            <Box sx={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: 1, 
              maxHeight: 120, 
              overflowY: 'auto',
              border: `1px solid ${isDarkMode ? '#333' : '#ddd'}`,
              borderRadius: '4px',
              p: 1
            }}>
              {availableActivities.map((activity) => (
                <Box
                  key={activity.id}
                  onClick={() => toggleActivitySelection(activity.id)}
                  sx={{
                    p: 1,
                    border: `1px solid ${
                      selectedActivities.includes(activity.id)
                        ? (isDarkMode ? '#90caf9' : '#1976d2')
                        : 'transparent'
                    }`,
                    borderRadius: 1,
                    cursor: 'pointer',
                    bgcolor: selectedActivities.includes(activity.id)
                      ? (isDarkMode ? 'rgba(144, 202, 249, 0.1)' : 'rgba(25, 118, 210, 0.1)')
                      : 'transparent',
                    '&:hover': {
                      bgcolor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                    },
                  }}
                >
                  <Typography variant="body2" fontWeight="medium" sx={{ fontSize: '12px' }}>
                    {activity.name}
                  </Typography>
                  <Typography variant="caption" color="textSecondary" sx={{ fontSize: '10px' }}>
                    Type: {activity.type}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        )}

        {/* Action Buttons */}
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', mt: 1 }}>
          <Button onClick={handleClose} size="small">
            Cancel
          </Button>
          <Button
            onClick={createLoop}
            variant="contained"
            startIcon={<LoopIcon />}
            size="small"
          >
            Create Loop
          </Button>
        </Box>
      </Box>
    </Panel>
  );
};

export default LoopCreationPanel;