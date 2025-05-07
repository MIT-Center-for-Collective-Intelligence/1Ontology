const nextJest = require("next/jest");

const createJestConfig = nextJest({
  dir: "./",
});

function makeModuleNameMapper(srcPath, tsconfigPath) {
  const { paths } = require(tsconfigPath).compilerOptions;

  const aliases = {};

  Object.keys(paths).forEach((item) => {
    const key = item.replace("/*", "/(.*)");
    const path = paths[item][0].replace("/*", "/$1");
    aliases[key] = srcPath + "/" + path;
  });
  return aliases;
}

const TS_CONFIG_PATH = "./tsconfig.json";
const SRC_PATH = "<rootDir>";

const customJestConfig = {
  roots: [SRC_PATH],
  testMatch: ["**/__tests__/**/*.[jt]s?(x)"],
  collectCoverage: true,
  coverageDirectory: "coverage",
  collectCoverageFrom: [
    "src/**/*.{js,jsx,ts,tsx}",
    "!src/**/*.d.ts",
    "!src/**/*.stories.{js,jsx,ts,tsx}",
    "!src/**/*.test.{js,jsx,ts,tsx}",
    "!src/**/index.{js,jsx,ts,tsx}",
  ],
  coverageReporters: ["text", "lcov", "html"],
  testEnvironment: "jsdom",
  moduleNameMapper: {
    ...makeModuleNameMapper(SRC_PATH, TS_CONFIG_PATH),
    "^src/(.*)$": "<rootDir>/src/$1",
    "^testUtils/(.*)$": "<rootDir>/testUtils/$1",
    "^@components/(.*)$": "<rootDir>/src/$1",
    "^@lib/(.*)$": "<rootDir>/src/lib/$1",
    "^@babel/runtime/helpers/interopRequireDefault$": "<rootDir>/node_modules/@babel/runtime/helpers/interopRequireDefault.js",
    'react-markdown': 'react-markdown/react-markdown.min.js',
    "^react-firebase-hooks/firestore$": "<rootDir>/node_modules/react-firebase-hooks/dist/firestore/index.js",
    "next/router": "<rootDir>/__mocks__/next/router.js",
    "^.+\\.module\\.(css|sass|scss)$": "identity-obj-proxy",
    "^.+\\.(jpg|jpeg|png|gif|webp|avif|svg)$": "<rootDir>/__mocks__/file-mock.js"
  },
  moduleDirectories: ["node_modules", "src", "testUtils"],
  transformIgnorePatterns: [
    "node_modules/(?!.*\\.mjs$|react-markdown|remark-math|rehype-katex|react-firebase-hooks)"
  ],
  transform: {
    "^.+\\.(js|jsx|ts|tsx)$": "ts-jest",
  },
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  testTimeout: 10000
};

module.exports = createJestConfig(customJestConfig);
