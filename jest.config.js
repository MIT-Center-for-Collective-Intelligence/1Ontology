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
  testEnvironment: "jest-environment-jsdom",
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  collectCoverage: true,
  collectCoverageFrom: [
    "src/components/**/*.{js,jsx,ts,tsx}",
    "src/pages/**/*.{js,jsx,ts,tsx}",
    "src/lib/**/*.{js,jsx,ts,tsx}",
    "!src/**/*.d.ts",
    "!src/**/*.stories.{js,jsx,ts,tsx}",
    "!src/**/index.{js,ts}",
    "!src/**/*.styles.{js,ts}",
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },

  moduleNameMapper: {
    ...makeModuleNameMapper(SRC_PATH, TS_CONFIG_PATH),
    "^src/(.*)$": "<rootDir>/src/$1",
    "^testUtils/(.*)$": "<rootDir>/testUtils/$1",

    "\\.(css|less|scss|sass)$": "identity-obj-proxy",
    "\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$":
      "<rootDir>/__mocks__/fileMock.js",
  },

  moduleDirectories: ["node_modules", "src", "testUtils"],

  testPathIgnorePatterns: [
    "<rootDir>/.next/",
    "<rootDir>/node_modules/",
    "<rootDir>/coverage/",
    "<rootDir>/dist/",
  ],

  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', { presets: ['next/babel'] }],
  },

  verbose: true,
  testTimeout: 20000,
  
  clearMocks: true,
};

module.exports = createJestConfig(customJestConfig);
