/** @jest-environment jsdom */
import { act, renderHook } from "@testing-library/react";
import { useCallback, useReducer } from "react";
import { useThemeManager } from "../../../src/lib/hooks/useThemeManager";
import { useAuth } from "../../../src/components/context/AuthContext";
import { updateDoc, setDoc } from "firebase/firestore";

jest.mock("../../../src/components/context/AuthContext", () => ({
  useAuth: jest.fn(),
}));
jest.mock("firebase/firestore", () => ({
  getFirestore: () => "db",
  collection: (_db: unknown, name: string) => ({ path: name }),
  doc: (db: any, collection?: string, name?: string) => ({
    path: name ? `${collection}/${name}` : `${db.path}/log`,
  }),
  updateDoc: jest.fn(),
  setDoc: jest.fn(),
  Timestamp: { fromDate: (date: Date) => date },
}));
let state: any;
const dispatch = jest.fn((action) => {
  state = { ...state, settings: { theme: action.payload } };
});
beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  state = {
    isAuthInitialized: true,
    isAuthenticated: true,
    user: { userId: "reviewer-a", uname: "reviewer-a" },
    settings: { theme: "Light" },
  };
  jest.mocked(useAuth).mockImplementation(() => {
    const [, redraw] = useReducer((n: number) => n + 1, 0);
    const reactiveDispatch = useCallback((action: any) => {
      dispatch(action);
      redraw();
    }, []);
    return [state, { dispatch: reactiveDispatch }] as any;
  });
  jest.mocked(updateDoc).mockResolvedValue(undefined);
  jest.mocked(setDoc).mockResolvedValue(undefined);
});
afterEach(() => jest.restoreAllMocks());

test("a profile write changes only its theme and rejects rapid duplicate toggles while pending", async () => {
  let finish!: () => void;
  jest.mocked(updateDoc).mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const { result } = renderHook(useThemeManager);
  let save!: Promise<void>;
  act(() => {
    save = result.current.handleThemeSwitch();
    void result.current.handleThemeSwitch();
  });
  expect(updateDoc).toHaveBeenCalledTimes(1);
  expect(updateDoc).toHaveBeenCalledWith(
    { path: "users/reviewer-a" },
    { theme: "Dark" },
  );
  expect(result.current.isDark).toBe(true);
  expect(result.current.isSaving).toBe(true);
  await act(async () => {
    finish();
    await save;
  });
  expect(result.current.isSaving).toBe(false);
  expect(result.current.saveError).toBe("");
  expect(localStorage.getItem("preferred-theme")).toBe("dark");
  expect(setDoc).toHaveBeenCalledWith(
    { path: "logs/log" },
    expect.objectContaining({
      action: "theme change",
      theme: "Dark",
      doer: "reviewer-a",
    }),
  );
});
test("a rejected profile write restores the previous mode and allows a visible retry", async () => {
  jest.mocked(updateDoc).mockRejectedValueOnce(new Error("permission denied"));
  const { result } = renderHook(useThemeManager);
  await act(async () => {
    await result.current.handleThemeSwitch();
  });
  expect(result.current.isDark).toBe(false);
  expect(result.current.isSaving).toBe(false);
  expect(result.current.saveError).toContain("could not be saved");
  expect(localStorage.getItem("preferred-theme")).toBe("light");
  expect(setDoc).not.toHaveBeenCalled();
  await act(async () => {
    await result.current.handleThemeSwitch();
  });
  expect(result.current.isDark).toBe(true);
  expect(result.current.saveError).toBe("");
});
test("a failed audit-log write does not undo a successfully saved profile mode", async () => {
  jest.mocked(setDoc).mockRejectedValueOnce(new Error("log unavailable"));
  const { result } = renderHook(useThemeManager);
  await act(async () => {
    await result.current.handleThemeSwitch();
  });
  expect(result.current.isDark).toBe(true);
  expect(result.current.saveError).toBe("");
});
test("profile preference wins over a different browser cache and remains isolated between accounts", () => {
  localStorage.setItem("preferred-theme", "light");
  state.settings.theme = "Dark";
  const first = renderHook(useThemeManager);
  expect(first.result.current.isDark).toBe(true);
  expect(localStorage.getItem("preferred-theme")).toBe("dark");
  first.unmount();
  state = {
    ...state,
    user: { userId: "reviewer-b", uname: "reviewer-b" },
    settings: { theme: "Light" },
  };
  const second = renderHook(useThemeManager);
  expect(second.result.current.isDark).toBe(false);
  expect(localStorage.getItem("preferred-theme")).toBe("light");
  expect(updateDoc).not.toHaveBeenCalled();
});
test("blocked browser storage does not prevent saving the authenticated profile", async () => {
  jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("storage unavailable");
  });
  const { result } = renderHook(useThemeManager);
  await act(async () => {
    await result.current.handleThemeSwitch();
  });
  expect(updateDoc).toHaveBeenCalledWith(
    { path: "users/reviewer-a" },
    { theme: "Dark" },
  );
  expect(result.current.isDark).toBe(true);
  expect(result.current.saveError).toBe("");
});
test("authentication must finish before a toggle can write or apply another account's cache", async () => {
  state.isAuthInitialized = false;
  localStorage.setItem("preferred-theme", "dark");
  const { result } = renderHook(useThemeManager);
  await act(async () => {
    await result.current.handleThemeSwitch();
  });
  expect(dispatch).not.toHaveBeenCalled();
  expect(updateDoc).not.toHaveBeenCalled();
});
test("an old account's failed pending save cannot change the next account's theme", async () => {
  let fail!: (error: Error) => void;
  jest.mocked(updateDoc).mockImplementation(
    () =>
      new Promise<void>((_resolve, reject) => {
        fail = reject;
      }),
  );
  const { result, rerender } = renderHook(useThemeManager);
  let pending!: Promise<void>;
  act(() => {
    pending = result.current.handleThemeSwitch();
  });
  state = {
    ...state,
    user: { userId: "reviewer-b", uname: "reviewer-b" },
    settings: { theme: "Dark" },
  };
  rerender();
  await act(async () => {
    fail(new Error("failed"));
    await pending;
  });
  expect(result.current.isDark).toBe(true);
  expect(result.current.saveError).toBe("");
  expect(localStorage.getItem("preferred-theme")).toBe("dark");
});
