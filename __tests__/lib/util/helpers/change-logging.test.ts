import { recordLogs } from '../../../../src/lib/utils/helpers';
import { LOGS } from ' @components/lib/firestoreClient/collections';

jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(),
  collection: jest.fn(),
  doc: jest.fn(),
  setDoc: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(),
}));

jest.mock(' @components/lib/firestoreClient/errors.firestore', () => ({
  getOperatingSystem: jest.fn().mockReturnValue('Windows'),
  getBrowser: jest.fn().mockReturnValue('Chrome'),
}));

describe('recordLogs', () => {
  const { getFirestore, collection, doc, setDoc } = require('firebase/firestore');
  const { getAuth } = require('firebase/auth');

  let consoleErrorSpy: jest.SpyInstance<void, [message?: any, ...optionalParams: any[]], any>;

  const mockDocRef = { id: 'mock-log-id' };
  const mockCollection = 'logs-collection';
  const mockFirestore = { name: 'mock-firestore' };

  beforeEach(() => {
    jest.clearAllMocks();

    getFirestore.mockReturnValue(mockFirestore);
    collection.mockReturnValue(mockCollection);
    doc.mockReturnValue(mockDocRef);
    getAuth.mockReturnValue({ currentUser: { displayName: 'test-user' } });

    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  test('should record logs with the correct structure for normal users', async () => {
    const logData = { message: 'Test log', type: 'info' };

    await recordLogs(logData);

    expect(getFirestore).toHaveBeenCalled();
    expect(collection).toHaveBeenCalledWith(mockFirestore, LOGS);
    expect(doc).toHaveBeenCalledWith(mockCollection);
    expect(setDoc).toHaveBeenCalledWith(
      mockDocRef,
      expect.objectContaining({
        ...logData,
        createdAt: expect.any(Date),
        doer: 'test-user',
        operatingSystem: 'Windows',
        browser: 'Chrome',
        doerCreate: expect.any(String),
      })
    );
  });

  test('should not record logs for user ouhrac', async () => {
    getAuth.mockReturnValue({ currentUser: { displayName: 'ouhrac' } });
    const logData = { message: 'This should not be logged', type: 'info' };

    await recordLogs(logData);

    expect(setDoc).not.toHaveBeenCalled();
  });

  test('should handle missing user information gracefully', async () => {
    getAuth.mockReturnValue({ currentUser: { displayName: null } });
    const logData = { message: 'Log with null user', type: 'info' };

    await recordLogs(logData);

    expect(setDoc).toHaveBeenCalledWith(
      mockDocRef,
      expect.objectContaining({
        type: 'info',
        message: 'Log with null user',
        doer: null,
      })
    );
  });

  test('should handle null currentUser gracefully', async () => {
    getAuth.mockReturnValue({ currentUser: null });
    const logData = { message: 'Log with null currentUser', type: 'info' };

    await recordLogs(logData);

    expect(setDoc).toHaveBeenCalledWith(
      mockDocRef,
      expect.objectContaining({
        type: 'info',
        message: 'Log with null currentUser',
        doer: undefined,
      })
    );
  });

  test('should handle errors in setDoc gracefully', async () => {
    setDoc.mockRejectedValueOnce(new Error('Test error'));
    const logData = { message: 'This will cause an error', type: 'info' };

    await recordLogs(logData);

    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(setDoc).toHaveBeenCalledWith(mockDocRef, expect.any(Object));
  });

  test('should include all properties from the log data', async () => {
    const logData = {
      message: 'Detailed log',
      type: 'info',
      userId: '12345',
      action: 'user-login',
      details: { browser: 'Firefox', ip: '127.0.0.1' },
    };

    await recordLogs(logData);

    expect(setDoc).toHaveBeenCalledWith(
      mockDocRef,
      expect.objectContaining({
        ...logData,
        browser: 'Chrome',
      })
    );
  });

  test('should work with empty log data', async () => {
    const logData = {};

    await recordLogs(logData);

    expect(setDoc).toHaveBeenCalledWith(mockDocRef, expect.any(Object));
  });
});
