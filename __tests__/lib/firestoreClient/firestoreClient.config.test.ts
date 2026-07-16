import { FirebaseApp, getApps, initializeApp } from "firebase/app";

import { initializeFirestore } from "../../../src/lib/firestoreClient/firestoreClient.config";

jest.mock("firebase/app", () => ({
  getApps: jest.fn(),
  initializeApp: jest.fn(),
}));

jest.mock("../../../src/lib/CONSTANTS", () => ({
  development: true,
}));

const mockedGetApps = getApps as jest.MockedFunction<typeof getApps>;
const mockedInitializeApp = initializeApp as jest.MockedFunction<
  typeof initializeApp
>;

const makeApp = (projectId: string): FirebaseApp =>
  ({
    name: "[DEFAULT]",
    options: { projectId },
    automaticDataCollectionEnabled: false,
  }) as FirebaseApp;

describe("initializeFirestore", () => {
  const originalEnvironment = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnvironment };
    process.env.NEXT_PUBLIC_DEV_API_KEY = "dev-api-key";
    process.env.NEXT_PUBLIC_DEV_AUTH_DOMAIN = "dev.example.test";
    process.env.NEXT_PUBLIC_DEV_PROJECT_ID = "dev-project";
    process.env.NEXT_PUBLIC_DEV_STORAGE_BUCKET = "dev-bucket";
    process.env.NEXT_PUBLIC_DEV_MESSAGING_SENDER_ID = "sender";
    process.env.NEXT_PUBLIC_DEV_APP_ID = "app-id";
  });

  afterAll(() => {
    process.env = originalEnvironment;
  });

  it("initializes the default app when none exists", () => {
    const app = makeApp("dev-project");
    mockedGetApps.mockReturnValue([]);
    mockedInitializeApp.mockReturnValue(app);

    expect(initializeFirestore()).toBe(app);
    expect(mockedInitializeApp).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: "dev-project" }),
    );
  });

  it("reuses the existing default app during hot reload", () => {
    const app = makeApp("dev-project");
    mockedGetApps.mockReturnValue([app]);

    expect(initializeFirestore()).toBe(app);
    expect(mockedInitializeApp).not.toHaveBeenCalled();
  });

  it("rejects an existing default app for a different project", () => {
    mockedGetApps.mockReturnValue([makeApp("unexpected-project")]);

    expect(() => initializeFirestore()).toThrow(
      "Client Firebase is already initialized for project unexpected-project, but this build expects dev-project",
    );
    expect(mockedInitializeApp).not.toHaveBeenCalled();
  });

  it("fails clearly when the selected project is not configured", () => {
    delete process.env.NEXT_PUBLIC_DEV_PROJECT_ID;
    mockedGetApps.mockReturnValue([]);

    expect(() => initializeFirestore()).toThrow(
      "Missing NEXT_PUBLIC_DEV_PROJECT_ID",
    );
    expect(mockedInitializeApp).not.toHaveBeenCalled();
  });
});
