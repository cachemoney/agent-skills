import { test as base, expect } from "@playwright/test";
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const ROOT = join(HERE, "..");

export function createServerRunner({ skillName, homeEnvVar, newArgs, fixtureFactory }) {
  const serverScript = join(ROOT, "skills", skillName, "scripts", "server.mjs");

  return async ({}, use) => {
    const home = mkdtempSync(join(tmpdir(), `${skillName}-home-`));
    const proj = mkdtempSync(join(tmpdir(), `${skillName}-proj-`));
    const env = { ...process.env, [homeEnvVar]: home };

    // 1. Initialize session
    const res = JSON.parse(
      execFileSync(process.execPath, [serverScript, "new", ...newArgs], {
        encoding: "utf8",
        env,
        cwd: proj,
      })
    );
    const session = res.session;
    const stateFile = join(session, "state.json");
    const baseState = JSON.parse(readFileSync(stateFile, "utf8"));

    // 2. Populate fixture state if provided
    if (fixtureFactory) {
      const fixture = fixtureFactory(baseState);
      writeFileSync(stateFile, JSON.stringify(fixture, null, 2));
    }
    writeFileSync(
      join(session, "visual.html"),
      "<!doctype html><title>Visual</title><h1>Architecture Graph</h1>"
    );

    // 3. Spawn server daemon
    const child = spawn(
      process.execPath,
      [serverScript, "serve", "--session", session, "--port", "0"],
      { env, stdio: ["ignore", "pipe", "inherit"] }
    );

    let buf = "";
    const lines = [];
    const waiters = [];
    child.stdout.on("data", (d) => {
      buf += d;
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        lines.push(buf.slice(0, i));
        buf = buf.slice(i + 1);
        waiters.splice(0).forEach((w) => w());
      }
    });

    const nthLine = (n) =>
      new Promise((resolve) => {
        const check = () => (lines.length >= n ? resolve(lines[n - 1]) : waiters.push(check));
        check();
      });

    const readyLine = JSON.parse(await nthLine(1));

    // 4. Yield server info to tests
    await use({
      session,
      url: readyLine.url,
      port: readyLine.port,
      stateFile,
      home,
      proj,
    });

    // 5. Cleanup server & temp directories
    await new Promise((resolve) => {
      if (child.exitCode !== null) return resolve();
      child.on("exit", resolve);
      child.kill();
    });

    try {
      rmSync(home, { recursive: true, force: true });
      rmSync(proj, { recursive: true, force: true });
    } catch {}
  };
}

export { expect };
