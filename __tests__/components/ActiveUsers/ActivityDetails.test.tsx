import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ActivityDetails from '../../../src/components/ActiveUsers/ActivityDetails';
import { NodeChange } from ' @components/types/INode';
import dayjs from 'dayjs';

// Mock the dayjs module
jest.mock('dayjs', () => {
  const originalModule = jest.requireActual('dayjs');
  return {
    __esModule: true,
    ...originalModule,
    default: jest.fn(() => ({
      fromNow: () => '2 hours ago',
      toDate: () => new Date(),
    })),
  };
});

describe('ActivityDetails', () => {
  const mockActivity: NodeChange = {
    modifiedAt: {
      toDate: () => new Date(),
    },
    fullNode: {
      title: 'Test Node Title',
    },
    reasoning: 'Test reasoning comment',
  } as NodeChange;

  const mockModifiedByDetails = {
    fName: 'John',
    lName: 'Doe',
    imageUrl: 'https://example.com/avatar.jpg',
  };

  const mockDisplayDiff = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders activity details with user information', () => {
    render(
      <ActivityDetails
        activity={mockActivity}
        displayDiff={mockDisplayDiff}
        modifiedByDetails={mockModifiedByDetails}
      />
    );

    // Check if user name is displayed
    expect(screen.getByText('John Doe')).toBeTruthy();
    
    // Check if timestamp is displayed
    expect(screen.getByText('2 hours ago')).toBeTruthy();
    
    // Check if node title is displayed
    expect(screen.getByText('Test Node Title')).toBeTruthy();
    
    // Check if reasoning is displayed
    expect(screen.getByText('Test reasoning comment')).toBeTruthy();
    
    // Check if View button is present
    expect(screen.getByText('View')).toBeTruthy();
  });

  it('renders without user information', () => {
    render(
      <ActivityDetails
        activity={mockActivity}
        displayDiff={mockDisplayDiff}
      />
    );
    // Check if node title is still displayed
    expect(screen.queryByText('Test Node Title')).toBeTruthy();
    
    // Check if View button is present
    expect(screen.queryByText('View')).toBeTruthy();
  });

  it('calls displayDiff when View button is clicked', () => {
    render(
      <ActivityDetails
        activity={mockActivity}
        displayDiff={mockDisplayDiff}
        modifiedByDetails={mockModifiedByDetails}
      />
    );

    const viewButton = screen.getByText('View');
    fireEvent.click(viewButton);

    expect(mockDisplayDiff).toHaveBeenCalledWith(mockActivity);
  });

  it('applies selected styling when isSelected is true', () => {
    const { container } = render(
      <ActivityDetails
        activity={mockActivity}
        displayDiff={mockDisplayDiff}
        modifiedByDetails={mockModifiedByDetails}
        isSelected={true}
      />
    );

    // The Paper component should have a light blue background when selected
    const paper = container.querySelector('.MuiPaper-root');
    expect(paper).toHaveStyle({
      backgroundColor: 'rgba(173, 216, 230, 0.5)',
    });
  });
}); 