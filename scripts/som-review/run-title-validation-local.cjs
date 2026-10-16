// Local-only staff try-out. Existing environment values are loaded in memory,
// never printed or copied into this checkout. No model inference is performed.
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const root = path.resolve(__dirname, "../..");
const mode = process.argv[2] || "dev";
if (!["dev", "build"].includes(mode)) throw Error("Use dev or build.");
const envFile = process.env.TITLE_VALIDATION_ENV_FILE;
if (!envFile)
  throw Error(
    "Set TITLE_VALIDATION_ENV_FILE to the existing ignored environment file. Its contents will not be printed.",
  );
const parsed = require("node:util").parseEnv(fs.readFileSync(envFile, "utf8"));
const env = { ...process.env };
if (mode === "build") {
  Object.assign(env, parsed);
  env.TITLE_VALIDATION_DIST_DIR = ".next-title-validation-build";
} else
  for (const name of Object.keys(parsed))
    if (/^NEXT_PUBLIC_/.test(name)) env[name] = parsed[name];
for (const name of [
  "API_KEY",
  "AUTH_DOMAIN",
  "PROJECT_ID",
  "STORAGE_BUCKET",
  "MESSAGING_SENDER_ID",
  "APP_ID",
]) {
  if (!env["NEXT_PUBLIC_DEV_" + name])
    env["NEXT_PUBLIC_DEV_" + name] = env["NEXT_PUBLIC_" + name];
}
if (mode === "dev") {
  env.TITLE_VALIDATION_LOCAL_PREVIEW = "1";
  env.TITLE_VALIDATION_PREVIEW_DIR =
    process.env.TITLE_VALIDATION_PREVIEW_DIR ||
    path.join(root, ".title-validation-preview");
}
env.NEXT_TELEMETRY_DISABLED = "1";
const command =
  mode === "dev"
    ? [
        "dev",
        "-H",
        "127.0.0.1",
        "-p",
        process.env.TITLE_VALIDATION_PORT || "3105",
      ]
    : ["build"];
const child = spawn(
  process.execPath,
  [require.resolve("next/dist/bin/next"), ...command],
  { cwd: root, env, stdio: "inherit" },
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code ?? 1));
