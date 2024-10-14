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
  collectCoverageFrom: [
    "components/**/*.{js,jsx,ts,tsx}",
    "pages/**/*.{js,jsx,ts,tsx}",
  ],
  testEnvironment: "node",
  moduleNameMapper: {
    ...makeModuleNameMapper(SRC_PATH, TS_CONFIG_PATH),
    "^src/(.*)$": "<rootDir>/src/$1",
    "^testUtils/(.*)$": "<rootDir>/testUtils/$1",
  },
  moduleDirectories: ["node_modules", "src", "testUtils"],
};

module.exports = createJestConfig(customJestConfig);
