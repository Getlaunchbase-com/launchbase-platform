#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const outDir = path.join(process.cwd(), "runs", "marketing");
fs.mkdirSync(outDir, { recursive: true });

const checks = [];

function run(name, args, opts = {}) {
  const isCmdLike = /\.(cmd|bat)$/i.test(String(name));
  const command = isCmdLike ? "cmd.exe" : name;
  const commandArgs = isCmdLike ? ["/c", name, ...args] : args;
  const res = spawnSync(command, commandArgs, {
    encoding: "utf8",
    timeout: opts.timeoutMs ?? 20_000,
    shell: false,
    env: process.env,
  });
  return {
    ok: res.status === 0,
    code: res.status ?? -1,
    stdout: String(res.stdout ?? "").trim(),
    stderr: String(res.stderr ?? "").trim(),
    error: res.error ? String(res.error.message || res.error) : "",
  };
}

function add(name, pass, detail, data = {}) {
  checks.push({ name, pass, detail, ...data });
  const tag = pass ? "PASS" : "FAIL";
  console.log(`[${tag}] ${name} :: ${detail}`);
}

function checkCmd(label, cmdPath, args = ["--help"]) {
  const r = run(cmdPath, args);
  const text = `${r.stdout}\n${r.stderr}\n${r.error}`;
  const policyBlocked = /spawnSync cmd\.exe EPERM/i.test(text);
  const pass = r.ok || /Usage:|Codex CLI|Gemini CLI|Claude Code/i.test(text);
  add(label, pass, pass ? "command reachable" : (policyBlocked ? "host policy blocked process spawn (EPERM)" : "command failed"), {
    code: r.code,
    sample: text.slice(0, 300),
  });
  return { ...r, text, policyBlocked };
}

function main() {
  const claudePath = path.resolve("C:\\Users\\Monica Morreale\\AppData\\Roaming\\npm\\claude.cmd");
  const geminiPath = path.resolve("C:\\Users\\Monica Morreale\\AppData\\Roaming\\npm\\gemini.cmd");
  const codexPath = path.resolve("C:\\Users\\Monica Morreale\\AppData\\Roaming\\npm\\codex.cmd");

  const c = checkCmd("claude.cmd", claudePath, ["--help"]);
  const g = checkCmd("gemini.cmd", geminiPath, ["--help"]);
  const x = checkCmd("codex.cmd", codexPath, ["--help"]);

  const claudePing = run(claudePath, ["-p", "ping"]);
  const claudeText = `${claudePing.stdout}\n${claudePing.stderr}\n${claudePing.error}`;
  const claudeEperm = /spawn EPERM/i.test(claudeText);
  add(
    "claude.ping",
    claudePing.ok && !claudeEperm,
    claudePing.ok ? "ok" : (claudeEperm ? "spawn EPERM" : "failed"),
    { code: claudePing.code, sample: claudeText.slice(0, 300) }
  );

  const geminiAuthHint = /set an Auth method|GEMINI_API_KEY|GOOGLE_GENAI_USE_VERTEXAI|GOOGLE_GENAI_USE_GCA/i.test(`${g.stdout}\n${g.stderr}\n${g.error}`);
  if (g.policyBlocked) {
    add("gemini.auth", false, "unknown (blocked by host process policy)");
  } else {
    add(
      "gemini.auth",
      !geminiAuthHint,
      geminiAuthHint ? "missing auth configuration" : "auth appears configured"
    );
  }

  const codexExec = run(codexPath, ["exec", "ping"]);
  const codexText = `${codexExec.stdout}\n${codexExec.stderr}\n${codexExec.error}`;
  const codexNetErr = /error sending request|stream disconnected|api\.openai\.com/i.test(codexText);
  add(
    "codex.exec",
    codexExec.ok && !codexNetErr,
    codexExec.ok ? "ok" : (codexNetErr ? "network/provider disconnected" : "failed"),
    { code: codexExec.code, sample: codexText.slice(0, 300) }
  );

  const summary = {
    createdAt: new Date().toISOString(),
    checks,
    recommendations: [
      "If claude.ping shows spawn EPERM: run in elevated shell and whitelist node child_process policy.",
      "If gemini.auth fails: configure .gemini/settings.json or set GEMINI_API_KEY / GOOGLE_GENAI_USE_VERTEXAI.",
      "If codex.exec fails with stream disconnected: verify outbound HTTPS to api.openai.com from host.",
    ],
  };

  const out = path.join(outDir, `cli-preflight-${Date.now()}.json`);
  fs.writeFileSync(out, JSON.stringify(summary, null, 2), "utf8");
  console.log(out);

  const failed = checks.some((c1) => !c1.pass);
  process.exit(failed ? 1 : 0);
}

main();
