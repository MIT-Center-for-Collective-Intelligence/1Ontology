import '@testing-library/jest-dom';
import 'whatwg-fetch';

jest.mock('next/router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    pathname: '',
    route: '',
    asPath: '',
    query: '',
  }),
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: () => 'Next Image Stub',
}));

// import { server } from './__tests__/mocks/server';
// beforeAll(() => server.listen());
// afterEach(() => server.resetHandlers());
// afterAll(() => server.close());

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});