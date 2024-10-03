import {
  getChangeDescription,
  getModifiedAt,
} from ' @components/lib/utils/helpers';
import { NodeChange } from ' @components/types/INode';
import { Box, Typography, Paper, Button } from '@mui/material';

const ActivityDetails = ({
  activity,
  displayDiff,
}: {
  activity: NodeChange;
  displayDiff: Function;
}) => {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
      <Typography
        sx={{
          fontSize: '13px',
          fontWeight: 'bold',
          ml: 'auto',
          mr: '15px',
        }}
      >
        {' '}
        {getModifiedAt(activity.modifiedAt)}
      </Typography>
      <Paper
        elevation={3}
        sx={{ padding: 1, marginBottom: 1, m: '15px', mt: '0px', position: 'relative' }}
      >
        <Button
          onClick={() => {
            displayDiff(activity);
          }}
          variant='outlined'
          sx={{ 
            borderRadius: '25px',
            position: 'absolute',
            top: '0',
            right: '0',
            mr: '8px',
            mt: '8px',
          }}
        >
          View
        </Button>
        <Box sx={{ pb: 4, pl: 2 }}>
          <Box
            sx={{
              display: 'flex',
            }}
          >
            <Typography
              variant='body2'
              sx={{ fontSize: '14px', mt: '15px', mb: '13px' }}
            >
              {getChangeDescription(activity, '')}
            </Typography>
          </Box>
          <Typography variant='body1' sx={{ fontWeight: 'bold' }}>
            {activity.fullNode.title}
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
};

export default ActivityDetails;
