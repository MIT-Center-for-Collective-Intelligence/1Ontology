/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { onSnapshot } from "firebase/firestore";
import App from "../../../src/pages/_app";

jest.mock("firebase/firestore", () => ({ getFirestore: () => ({}), doc: jest.fn(), onSnapshot: jest.fn(() => jest.fn()) }));
jest.mock("../../../src/lib/firestoreClient/firestoreClient.config", () => ({ initializeFirestore: jest.fn() }));
jest.mock("../../../src/components/context/AuthContext", () => ({ AuthProvider: ({children}: any) => children }));
jest.mock("../../../src/components/context/ThemeContext", () => ({ ThemeProvider: ({children}: any) => children }));
jest.mock("../../../src/components/context/LastDeploymentContext", () => ({ LastDeploymentProvider: ({children}: any) => children }));
jest.mock("next/head", () => ({ __esModule: true, default: ({children}: any) => children }));
jest.mock("@mui/material/CssBaseline", () => () => null);
jest.mock("react-query/devtools", () => ({ ReactQueryDevtools: () => null }));

afterEach(() => jest.clearAllMocks());
it.each(["/review", "/review/inspection", "/title-prompt-study"])("does not subscribe %s to forced ontology refreshes", pathname => {
  render(<App {...({ Component: () => <div>Review remains open</div>, pageProps: {}, router: {pathname} } as any)} />);
  expect(screen.getByText("Review remains open")).toBeInTheDocument();
  expect(onSnapshot).not.toHaveBeenCalled();
});
it("retains the existing refresh subscription outside the review screens", () => {
  render(<App {...({ Component: () => <div>Ontology</div>, pageProps: {}, router: {pathname: "/"} } as any)} />);
  expect(onSnapshot).toHaveBeenCalledTimes(1);
});
