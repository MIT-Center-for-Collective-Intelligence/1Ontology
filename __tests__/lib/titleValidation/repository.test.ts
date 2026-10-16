import fs from "fs/promises";
import path from "path";
import os from "os";
import { execFile } from "child_process";
import { promisify } from "util";
import ts from "typescript";
import {
  localPreviewEnabled,
  withStudy,
} from "../../../src/lib/titleValidation/repository";

const exec = promisify(execFile);
test("a forged loopback Host from a remote connection cannot enable preview", () => {
  const env = process.env.NODE_ENV,
    flag = process.env.TITLE_VALIDATION_LOCAL_PREVIEW;
  (process.env as Record<string, string | undefined>).NODE_ENV = "development";
  process.env.TITLE_VALIDATION_LOCAL_PREVIEW = "1";
  expect(localPreviewEnabled("localhost:3105", "203.0.113.1")).toBe(false);
  expect(localPreviewEnabled("localhost:3105", "127.0.0.1")).toBe(true);
  expect(localPreviewEnabled("localhost:3105", "::ffff:127.0.0.1")).toBe(true);
  (process.env as Record<string, string | undefined>).NODE_ENV = "production";
  expect(localPreviewEnabled("localhost:3105", "127.0.0.1")).toBe(false);
  (process.env as Record<string, string | undefined>).NODE_ENV = env;
  if (flag === undefined) delete process.env.TITLE_VALIDATION_LOCAL_PREVIEW;
  else process.env.TITLE_VALIDATION_LOCAL_PREVIEW = flag;
});
test("different preview server processes cannot lose each other's saved answers", async () => {
  const dir = await fs.mkdtemp(
    path.join(os.tmpdir(), "title-validation-concurrency-"),
  );
  for (const name of ["engine", "repository"]) {
    const source = await fs.readFile(
      path.join(process.cwd(), "src/lib/titleValidation", name + ".ts"),
      "utf8",
    );
    const js = ts.transpileModule(source, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.CommonJS,
        esModuleInterop: true,
      },
    }).outputText;
    await fs.writeFile(path.join(dir, name + ".js"), js);
  }
  const runner = path.join(dir, "writer.cjs");
  await fs.writeFile(
    runner,
    `const {withStudy}=require('./repository'); const id=process.argv[2]; withStudy('race',true,state=>{ const current=state||{study:{id:'race'},presentations:{},answers:{}}; const next={...current,answers:{...current.answers,[id]:{id}}};return {state:next,result:id,event:{kind:'test',id}}; }).then(()=>process.stdout.write(id)).catch(()=>process.exit(1));`,
  );
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: "development",
    TITLE_VALIDATION_LOCAL_PREVIEW: "1",
    TITLE_VALIDATION_PREVIEW_DIR: path.join(dir, "data"),
  };
  await Promise.all(
    Array.from({ length: 6 }, (_, i) =>
      exec(process.execPath, [runner, String(i)], { env }),
    ),
  );
  const result = JSON.parse(
    await fs.readFile(path.join(dir, "data/race.json"), "utf8"),
  );
  expect(Object.keys(result.answers).sort()).toEqual([
    "0",
    "1",
    "2",
    "3",
    "4",
    "5",
  ]);
  expect(
    (await fs.readFile(path.join(dir, "data/race.events.jsonl"), "utf8"))
      .trim()
      .split("\n"),
  ).toHaveLength(6);
}, 15000);

test("an abandoned preview lock cannot be reclaimed over a successor's lock", async () => {
  const dir = await fs.mkdtemp(
    path.join(os.tmpdir(), "title-validation-lock-"),
  );
  const flag = process.env.TITLE_VALIDATION_LOCAL_PREVIEW;
  const directory = process.env.TITLE_VALIDATION_PREVIEW_DIR;
  const mode = process.env.NODE_ENV;
  (process.env as Record<string, string | undefined>).NODE_ENV = "development";
  process.env.TITLE_VALIDATION_LOCAL_PREVIEW = "1";
  process.env.TITLE_VALIDATION_PREVIEW_DIR = dir;
  const lock = path.join(dir, "retained.lock");
  await fs.mkdir(lock);
  const owner = JSON.stringify({ pid: 2147483647 });
  await fs.writeFile(path.join(lock, "owner.json"), owner);
  const mutation = jest.fn();
  try {
    await expect(withStudy("retained", true, mutation)).rejects.toMatchObject({
      status: 409,
    });
    expect(mutation).not.toHaveBeenCalled();
    expect(await fs.readFile(path.join(lock, "owner.json"), "utf8")).toBe(
      owner,
    );
  } finally {
    (process.env as Record<string, string | undefined>).NODE_ENV = mode;
    if (flag === undefined) delete process.env.TITLE_VALIDATION_LOCAL_PREVIEW;
    else process.env.TITLE_VALIDATION_LOCAL_PREVIEW = flag;
    if (directory === undefined)
      delete process.env.TITLE_VALIDATION_PREVIEW_DIR;
    else process.env.TITLE_VALIDATION_PREVIEW_DIR = directory;
  }
}, 10000);
