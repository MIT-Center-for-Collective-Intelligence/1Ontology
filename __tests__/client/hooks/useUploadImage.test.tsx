import { renderHook, act } from '@testing-library/react';
import { useUploadImage } from '../../../src/hooks/useUploadImage';

// Mock Firebase storage
jest.mock('firebase/storage', () => ({
  getStorage: jest.fn(),
  ref: jest.fn(),
  uploadBytesResumable: jest.fn(() => ({
    on: jest.fn()
  })),
  getDownloadURL: jest.fn().mockResolvedValue('https://example.com/image.jpg'),
}));

describe('useUploadImage Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with default values', () => {
    const mockStorage = {
      app: {
        name: 'test',
        options: {},
        automaticDataCollectionEnabled: false
      },
      maxUploadRetryTime: 0,
      maxOperationRetryTime: 0
    };
    const { result } = renderHook(() => useUploadImage({ storage: mockStorage }));
    
    expect(result.current.isUploading).toBe(false);
    expect(result.current.percentageUploaded).toBe(0);
  });

  it('should handle image upload', async () => {
    const mockStorage = {
      app: {
        name: 'test',
        options: {},
        automaticDataCollectionEnabled: false
      },
      maxUploadRetryTime: 0,
      maxOperationRetryTime: 0
    };
    const { result } = renderHook(() => useUploadImage({ storage: mockStorage }));
    
    const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    const mockEvent = { target: { files: [mockFile] } };
    
    let uploadPromise;
    let progressCallback: ((snapshot: any) => void) | undefined;
    let completeCallback: (() => void) | undefined;
    const uploadTask: { on: jest.Mock } = {
      on: jest.fn((event: string, progress: (snapshot: any) => void, error: (err: any) => void, complete: () => void) => {
        if (event === 'state_changed') {
          progressCallback = progress;
          completeCallback = complete;
        }
        return uploadTask;
      })
    };
    require('firebase/storage').uploadBytesResumable.mockReturnValue(uploadTask);
    
    act(() => {
      uploadPromise = result.current.uploadImage({
        event: mockEvent,
        path: 'test-path',
        imageFileName: 'test'
      });
    });
    
    expect(result.current.isUploading).toBe(true);
    
    // Mock progress update
    if (progressCallback) {
      act(() => {
        progressCallback!({ bytesTransferred: 50, totalBytes: 100 });
      });
    }
    
    expect(result.current.percentageUploaded).toBe(50);
    
    // Mock completion
    if (completeCallback) {
      await act(async () => {
        completeCallback!();
      });
    }
    
    const imageUrl = await uploadPromise;
    expect(imageUrl).toBe('https://example.com/image.jpg');
    expect(result.current.percentageUploaded).toBe(0);
  });

  it('should reject invalid image formats', async () => {
    const mockStorage = {
      app: {
        name: 'test',
        options: {},
        automaticDataCollectionEnabled: false
      },
      maxUploadRetryTime: 0,
      maxOperationRetryTime: 0
    };
    const { result } = renderHook(() => useUploadImage({ storage: mockStorage }));
    
    const mockFile = new File(['test'], 'test.txt', { type: 'text/plain' });
    const mockEvent = { target: { files: [mockFile] } };
    
    await expect(result.current.uploadImage({
      event: mockEvent,
      path: 'test-path',
      imageFileName: 'test'
    })).rejects.toBe('We only accept JPG, JPEG, PNG, or GIF images. Please upload another image.');
  });

  it('should handle upload errors', async () => {
    const mockStorage = {
      app: {
        name: 'test',
        options: {},
        automaticDataCollectionEnabled: false
      },
      maxUploadRetryTime: 0,
      maxOperationRetryTime: 0
    };
    const { result } = renderHook(() => useUploadImage({ storage: mockStorage }));
    
    const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    const mockEvent = { target: { files: [mockFile] } };
    
    let errorCallback: ((err: any) => void) | undefined;
    const uploadTask: { on: jest.Mock } = {
      on: jest.fn((event: string, progress: (snapshot: any) => void, error: (err: any) => void) => {
        if (event === 'state_changed') {
          errorCallback = error;
        }
        return uploadTask;
      })
    };
    require('firebase/storage').uploadBytesResumable.mockReturnValue(uploadTask);
    
    const uploadPromise = result.current.uploadImage({
      event: mockEvent,
      path: 'test-path',
      imageFileName: 'test'
    });
    
    if (errorCallback) {
      act(() => {
        errorCallback!(new Error('Upload failed'));
      });
    }
    
    await expect(uploadPromise).rejects.toBe('There is an error with uploading your image. Please upload it again! If the problem persists, please try another image.');
    expect(result.current.isUploading).toBe(false);
  });
});