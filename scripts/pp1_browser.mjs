/* global document, window, HTMLSelectElement, HTMLInputElement, Event, innerWidth, localStorage, sessionStorage, setTimeout, clearTimeout, Buffer, fetch, WebSocket */
// Local Edge/CDP smoke. No external dependencies, payload logs, traces or credential screenshots.
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";

const directory = resolve(".local", "pp1-browser-" + randomUUID());
await mkdir(directory, { recursive: true });
let stage = "launch", socket, processHandle;
const checks = [], screenshots = [];
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const assert = (condition, label) => { if (!condition) throw new Error(label); };
let serial = 0;
const pending = new Map();
function send(method, params = {}, sessionId) {
  const id = ++serial;
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error("Protocol timeout")); }, 20000);
    pending.set(id, { resolve, reject, timeout });
    socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
}
async function evaluate(page, fn, argument) {
  const result = await send("Runtime.evaluate", { expression: `(${fn.toString()})(${JSON.stringify(argument) ?? "undefined"})`, awaitPromise: true, returnByValue: true }, page);
  if (result.exceptionDetails) throw new Error("Browser expression failed");
  return result.result.value;
}
async function wait(page, fn, argument, timeout = 25000) {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    if (await evaluate(page, fn, argument)) return;
    await pause(100);
  }
  throw new Error("UI condition timeout");
}
async function click(page, label) {
  await wait(page, name => [...document.querySelectorAll("button")].some(e => e.textContent.trim() === name && !e.disabled), label);
  await evaluate(page, name => { const b = [...document.querySelectorAll("button")].find(e => e.textContent.trim() === name); b.focus(); b.click(); }, label);
}
async function fill(page, selector, value) {
  await evaluate(page, ({ selector, value }) => {
    const e = document.querySelector(selector);
    const prototype = e.tagName === "SELECT" ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, "value").set.call(e, value);
    e.dispatchEvent(new Event("input", { bubbles: true })); e.dispatchEvent(new Event("change", { bubbles: true }));
  }, { selector, value });
}
async function page(url, mobile = false) {
  const { browserContextId } = await send("Target.createBrowserContext");
  const { targetId } = await send("Target.createTarget", { url: "about:blank", browserContextId });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  await send("Page.enable", {}, sessionId);
  await send("Emulation.setDeviceMetricsOverride", { width: mobile ? 390 : 1366, height: mobile ? 844 : 1000, deviceScaleFactor: 1, mobile }, sessionId);
  await send("Page.navigate", { url }, sessionId);
  await wait(sessionId, () => !!document.querySelector("main") && document.readyState === "complete");
  return sessionId;
}
async function screenshot(page, name) {
  assert(await evaluate(page, () => ![...document.querySelectorAll('input[name="username"], input[type="password"]')].some(e => e.value)), "Credential field must be empty before capture");
  assert(await evaluate(page, () => document.documentElement.scrollWidth <= innerWidth), "Horizontal overflow");
  const { data } = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true }, page);
  await writeFile(join(directory, name + ".png"), Buffer.from(data, "base64"));
  screenshots.push(name + ".png");
}
async function accept(page) {
  await wait(page, () => !!document.querySelector('#language option'));
  await fill(page, "#decision", "ACTIVE");
  await click(page, "Record consent decision");
  await wait(page, () => document.querySelector(".status-badge")?.textContent === "ACTIVE");
}
async function withdraw(page) {
  await click(page, "Withdraw consent");
  await wait(page, () => document.querySelector("dialog")?.open);
  await click(page, "Confirm withdrawal");
  await wait(page, () => !!document.querySelector(".receipt"));
}
try {
  processHandle = spawn("C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", [
    "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--disable-background-networking",
    "--remote-debugging-port=0", `--user-data-dir=${join(directory, "profile")}`, "about:blank",
  ], { stdio: "ignore", windowsHide: true });
  let port;
  for (let i = 0; i < 100; i++) {
    try { port = (await readFile(join(directory, "profile", "DevToolsActivePort"), "utf8")).split("\n")[0]; break; } catch { await pause(100); }
  }
  assert(port, "Browser did not start");
  const version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
  socket = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
  socket.addEventListener("message", message => {
    const data = JSON.parse(message.data), item = pending.get(data.id);
    if (item) { clearTimeout(item.timeout); pending.delete(data.id); if (data.error) item.reject(new Error("Protocol request failed")); else item.resolve(data.result); }
  });
  stage = "rejection_and_desktop";
  const rejected = await page("http://localhost:3000");
  await wait(rejected, () => !!document.querySelector('#language option'));
  await screenshot(rejected, "student-desktop");
  await click(rejected, "Record consent decision");
  await wait(rejected, () => document.querySelector(".status-badge")?.textContent === "REJECTED");
  assert(await evaluate(rejected, () => [...document.querySelectorAll("button")].find(e => e.textContent === "Submit synthetic fixture").disabled), "Rejected submission enabled");
  checks.push(stage);

  stage = "mobile_prewithdrawal_focus_and_cancel";
  const student = await page("http://localhost:3000", true);
  await accept(student);
  await screenshot(student, "student-mobile");
  await click(student, "Withdraw consent");
  await wait(student, () => document.querySelector("dialog")?.open);
  assert(await evaluate(student, () => document.activeElement?.textContent === "Keep consent"), "Initial focus");
  await screenshot(student, "withdrawal-dialog-mobile");
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab" }, student);
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab" }, student);
  assert(await evaluate(student, () => !!document.activeElement?.closest("dialog")), "Dialog containment");
  await click(student, "Keep consent");
  await wait(student, () => !document.querySelector("dialog"));
  assert(await evaluate(student, () => document.activeElement?.textContent === "Withdraw consent"), "Focus return");
  await withdraw(student);
  await screenshot(student, "withdrawal-receipt-mobile");
  checks.push(stage);

  stage = "fresh_submission";
  const owner = await page("http://localhost:3000");
  await accept(owner);
  await evaluate(owner, () => {
    const original = window.fetch.bind(window);
    window.fetch = async (...args) => {
      const response = await original(...args);
      if (String(args[0]).endsWith("/submissions") && response.ok) window.__demoCase = (await response.clone().json()).case_id;
      return response;
    };
  });
  await click(owner, "Submit synthetic fixture");
  for (let i = 0; i < 40; i++) {
    await click(owner, "Refresh status");
    if (await evaluate(owner, () => document.body.textContent.includes("Awaiting human review"))) break;
    await pause(250);
  }
  await wait(owner, () => document.body.textContent.includes("Awaiting human review"));
  await screenshot(owner, "student-processing-complete");
  const createdCase = await evaluate(owner, () => window.__demoCase);
  assert(createdCase, "Own synthetic case was not captured");
  checks.push(stage);

  stage = "authorized_review";
  const reviewer = await page("http://localhost:3001");
  await wait(reviewer, () => !!document.querySelector("#username"));
  await screenshot(reviewer, "counsellor-signin");
  const env = Object.fromEntries((await readFile(".env", "utf8")).split(/\r?\n/).filter(line => line.includes("=") && !line.startsWith("#")).map(line => { const i = line.indexOf("="); return [line.slice(0, i), line.slice(i + 1)]; }));
  await fill(reviewer, "#username", env.DEV_COUNSELLOR_USERNAME);
  await fill(reviewer, "#password", env.DEV_COUNSELLOR_PASSWORD);
  await click(reviewer, "Sign in");
  await wait(reviewer, () => !!document.querySelector(".task-button"));
  // Only mutate the case created by this run; preserve existing development tasks.
  await evaluate(reviewer, async caseId => {
    const tasks = await (await fetch('/api/v1/review-tasks')).json();
    const index = tasks.findIndex(task => task.case.case_id === caseId);
    if (index < 0) throw new Error('Own task unavailable');
    document.querySelectorAll('.task-button')[index].click();
  }, createdCase);
  await wait(reviewer, () => [...document.querySelectorAll("button")].some(e => e.textContent === "Start human review"));
  await screenshot(reviewer, "counsellor-assigned-review");
  await click(reviewer, "Start human review");
  await click(reviewer, "Record review complete");
  await wait(reviewer, () => document.querySelector(".review-detail")?.textContent.includes("Human review completed"));
  checks.push(stage);

  stage = "withdrawal_access_revocation";
  await withdraw(owner);
  await click(reviewer, "Refresh assigned tasks");
  await wait(reviewer, () => !document.querySelector(".review-detail code"));
  assert(await evaluate(reviewer, () => ![...document.querySelectorAll("button")].some(e => /Start human review|Record review complete/.test(e.textContent))), "Revoked task remains actionable");
  await screenshot(reviewer, "counsellor-after-withdrawal");
  checks.push(stage);

  stage = "ended_session_message";
  const ended = await page("http://localhost:3000");
  await accept(ended);
  assert(await evaluate(ended, async () => (await fetch('/api/v1/auth/logout', { method: 'POST', headers: { 'X-Requested-With': 'j26-browser' } })).status === 204), "Logout simulation failed");
  await click(ended, "Refresh status");
  await wait(ended, () => document.querySelector('[role="alert"]')?.textContent.includes("session has ended"));
  await screenshot(ended, "student-ended-session");
  for (const context of [owner, reviewer, student, ended]) assert(await evaluate(context, () => localStorage.length === 0 && sessionStorage.length === 0), "Unexpected browser storage");
  checks.push(stage);
  const report = { result: "PASS", browser: version.Browser, checks, screenshots, directory,
    limitations: ["Synthetic browser smoke, not usability validation.", "Ended-session behavior induced by logout; natural one-hour expiry not awaited.", "No network traces or credential-bearing screenshots retained."] };
  await writeFile(join(directory, "report.json"), JSON.stringify(report, null, 2));
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
} catch {
  process.stdout.write(JSON.stringify({ result: "FAIL", stage, directory, screenshots }) + "\n");
  process.exitCode = 1;
} finally {
  if (socket?.readyState === WebSocket.OPEN) { try { await send("Browser.close"); } catch { /* browser can close the socket first */ } socket.close(); }
  if (processHandle && !socket) processHandle.kill();
}
