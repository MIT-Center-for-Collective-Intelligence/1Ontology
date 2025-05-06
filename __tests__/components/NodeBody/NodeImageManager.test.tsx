import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { NodeImageManager } from '../../../src/components/NodBody/NodeImageManager';
import { Timestamp } from 'firebase/firestore';
import userEvent from '@testing-library/user-event';
import { INodeTypes } from '../../../src/types/INode';

type NodeImage = {
  url: string;
  path: string;
  uploadedAt: any;
  uploadedBy: {
    userId: string;
    fName: string;
    lName: string;
    uname: string;
    imageUrl: string;
  };
};

interface ImageViewerDialogProps {
  open: boolean;
  onClose: () => void;
  images: NodeImage[];
  initialIndex?: number;
  onDeleteImage?: (image: NodeImage, event: React.MouseEvent) => void;
  isDiffView?: boolean;
  diffStatus?: "added" | "removed" | null;
}

// Mock the hooks and firebase modules
jest.mock('../../../src/hooks/useUploadImage', () => ({
  useUploadImage: () => ({
    isUploading: false,
    percentageUploaded: 0,
    uploadImage: jest.fn().mockResolvedValue('https://example.com/test-image.jpg'),
  }),
}));

jest.mock('firebase/firestore', () => {
  const originalModule = jest.requireActual('firebase/firestore');
  return {
    ...originalModule,
    doc: jest.fn(),
    updateDoc: jest.fn().mockResolvedValue({}),
    collection: jest.fn(),
    arrayUnion: jest.fn((item) => item),
    arrayRemove: jest.fn((item) => item),
    getFirestore: jest.fn(() => ({})),
    Timestamp: originalModule.Timestamp
  };
});

jest.mock('firebase/storage', () => ({
  ref: jest.fn(),
  uploadBytesResumable: jest.fn(),
  getDownloadURL: jest.fn(),
  deleteObject: jest.fn(),
}));

jest.mock('dayjs', () => {
  const original = jest.requireActual('dayjs');
  return jest.fn((date) => ({
    fromNow: () => '2 days ago',
  }));
});

// Mock URL.createObjectURL and URL.revokeObjectURL
global.URL.createObjectURL = jest.fn(() => 'mock-url');
global.URL.revokeObjectURL = jest.fn();

// Mock PropertyContributors component
jest.mock('../../../src/components/StructuredProperty/PropertyContributors', () => ({
  __esModule: true,
  default: () => <div data-testid="property-contributors">Contributors</div>,
}));

describe('NodeImageManager Component', () => {
  const mockUser = {
    userId: 'test-user-id',
    fName: 'Test',
    lName: 'User',
    uname: 'testuser',
    imageUrl: 'https://example.com/user.jpg',
    email: 'test@example.com',
    claims: {},
    rightPanel: false,
    currentNode: '',
    manageLock: false,
    copilot: false,
    admin: false,
    uid: 'test-user-id'
  };

  const mockImage = {
    url: 'https://example.com/image1.jpg',
    path: 'path/to/image1.jpg',
    uploadedAt: Timestamp.fromDate(new Date('2023-01-01')),
    uploadedBy: {
      userId: 'uploader-id',
      fName: 'Uploader',
      lName: 'Name',
      uname: 'uploader',
      imageUrl: 'https://example.com/uploader.jpg',
    },
  };

  const mockNode = {
    id: 'test-node',
    nodeType: 'concept' as INodeTypes,
    title: 'Test Node',
    deleted: false,
    properties: {
      description: 'Test description',
      images: [mockImage],
      parts: [],
      isPartOf: []
    },
    propertyType: {
      description: 'string',
      images: 'collection',
    },
    inheritance: {
      description: { ref: null, inheritanceType: 'neverInherit' as const },
      images: { ref: null, inheritanceType: 'neverInherit' as const },
    },
    specializations: [],
    generalizations: [],
    root: 'test-root',
    textValue: {},
    createdBy: 'test-user'
  };

  const defaultProps = {
    nodeId: 'test-node',
    currentVisibleNode: mockNode,
    user: mockUser,
    firestore: {},
    storage: {} as any,
    confirmIt: jest.fn().mockResolvedValue(true),
    saveNewChangeLog: jest.fn(),
    selectedDiffNode: null,
    nodes: {
      'test-node': mockNode,
    },
    getTitleNode: jest.fn((id) => `Title for ${id}`),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders with images', () => {
    render(<NodeImageManager {...defaultProps} />);
    
    expect(screen.getByText('Images')).toBeInTheDocument();
    expect(screen.getByAltText('')).toHaveAttribute('src', mockImage.url);
    expect(screen.getByText(/Uploaded by Uploader Name/)).toBeInTheDocument();
  });

  test('renders empty state when no images', () => {
    const propsWithNoImages = {
      ...defaultProps,
      currentVisibleNode: {
        ...mockNode,
        properties: {
          ...mockNode.properties,
          images: [],
        },
      },
      nodes: {
        'test-node': {
          ...mockNode,
          properties: {
            ...mockNode.properties,
            images: [],
          },
        },
      },
    };
    
    render(<NodeImageManager {...propsWithNoImages} />);
    
    expect(screen.getByText('No images have been uploaded yet')).toBeInTheDocument();
  });

  test('shows inherited status when images are inherited', () => {
    const propsWithInheritedImages = {
      ...defaultProps,
      currentVisibleNode: {
        ...mockNode,
        inheritance: {
          ...mockNode.inheritance,
          images: { ref: 'parent-node', inheritanceType: 'neverInherit' as const },
        },
      },
      nodes: {
        'test-node': {
          ...mockNode,
          inheritance: {
            ...mockNode.inheritance,
            images: { ref: 'parent-node', inheritanceType: 'neverInherit' as const },
          },
        },
        'parent-node': {
          ...mockNode,
          id: 'parent-node',
          properties: {
            ...mockNode.properties,
            images: [mockImage],
          },
        },
      },
    };
    
    render(<NodeImageManager {...propsWithInheritedImages} />);
    
    expect(screen.getByText(/\(Inherited from "Title for parent-node"\)/)).toBeInTheDocument();
  });

  test('opens image viewer when clicking on an image', async () => {
    render(<NodeImageManager {...defaultProps} />);
    
    const image = screen.getByAltText('');
    fireEvent.click(image);
    
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  test('handles file selection', async () => {
    render(<NodeImageManager {...defaultProps} />);
    
    // Find the upload button and click it
    const uploadButton = screen.getByText('Upload Images');
    fireEvent.click(uploadButton);
    
    // Get the hidden file input
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).not.toBeNull();
    
    // Create a mock file and trigger change
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    await userEvent.upload(fileInput, file);
    
    // Check if the preview is shown
    await waitFor(() => {
      expect(URL.createObjectURL).toHaveBeenCalledWith(file);
      expect(screen.getAllByAltText('')[1]).toHaveAttribute('src', 'mock-url');
    });
  });

  test('handles image deletion', async () => {
    const confirmItMock = jest.fn().mockResolvedValue(true);
    render(<NodeImageManager {...defaultProps} confirmIt={confirmItMock} />);
    
    // Find the delete button and click it
    const deleteButton = screen.getByLabelText('Delete Image');
    fireEvent.click(deleteButton);
    
    // Confirm deletion
    expect(confirmItMock).toHaveBeenCalledWith(
      'Are you sure you want to delete this image?',
      'Delete',
      'Cancel'
    );
  });

  test('shows diff status for added images', () => {
    const propsWithDiff = {
      ...defaultProps,
      selectedDiffNode: {
        nodeId: 'test-node',
        modifiedBy: 'testuser',
        modifiedProperty: 'images',
        previousValue: [],
        newValue: [mockImage],
        modifiedAt: new Date(),
        changeType: 'add images' as const,
        fullNode: mockNode
      },
    };
    
    render(<NodeImageManager {...propsWithDiff} />);
    
    // Check for the "New" label
    expect(screen.getByAltText('').parentElement).toHaveStyle({ border: '3px solid green' });
  });

  test('handles image upload process', async () => {
    const saveNewChangeLogMock = jest.fn();
    
    // Mock the useUploadImage hook for this specific test
    jest.spyOn(require('../../../src/hooks/useUploadImage'), 'useUploadImage').mockReturnValue({
      isUploading: false,
      percentageUploaded: 0,
      uploadImage: jest.fn().mockResolvedValue('https://example.com/uploaded-image.jpg'),
    });
    
    render(
      <NodeImageManager 
        {...defaultProps} 
        saveNewChangeLog={saveNewChangeLogMock}
      />
    );
    
    // Find the upload button and click it
    const uploadButton = screen.getByText('Upload Images');
    fireEvent.click(uploadButton);
    
    // Get the hidden file input
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    
    // Create a mock file and trigger change
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    await userEvent.upload(fileInput, file);
    
    // Find and click the upload selected images button
    const uploadSelectedButton = screen.getByText(/Upload Selected/);
    fireEvent.click(uploadSelectedButton);
    
    // Check if the upload function was called
    await waitFor(() => {
      expect(require('../../../src/hooks/useUploadImage').useUploadImage().uploadImage).toHaveBeenCalled();
    });
  });

  test('shows upload progress', () => {
    // Mock the useUploadImage hook to show uploading state
    jest.spyOn(require('../../../src/hooks/useUploadImage'), 'useUploadImage').mockReturnValue({
      isUploading: true,
      percentageUploaded: 50,
      uploadImage: jest.fn(),
    });
    
    render(<NodeImageManager {...defaultProps} />);
    
    // Check for the progress indicator
    expect(screen.getByText('50%')).toBeInTheDocument();
  });
});