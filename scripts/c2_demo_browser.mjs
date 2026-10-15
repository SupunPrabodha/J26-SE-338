/* global document, HTMLSelectElement, HTMLInputElement, HTMLTextAreaElement, Event, innerWidth, localStorage, sessionStorage, setTimeout, clearTimeout, Buffer, fetch, WebSocket */
// Local Edge/CDP smoke. No external dependencies, payload logs, traces or credential screenshots.
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";

const directory = resolve(".local", "c2-demo-browser-" + randomUUID());
await mkdir(directory, { recursive: true });
let stage = "launch", socket, processHandle, reviewer;
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
    const prototype = e.tagName === "SELECT" ? HTMLSelectElement.prototype : e.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
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
  await send("Emulation.setPageScaleFactor", { pageScaleFactor: 1 }, sessionId);
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
  const env = Object.fromEntries((await readFile(".env", "utf8")).split(/\r?\n/).filter(line => line.includes("=") && !line.startsWith("#")).map(line => { const at = line.indexOf("="); return [line.slice(0, at), line.slice(at + 1)]; }));
  stage = "unauthenticated";
  reviewer = await page("http://localhost:3001/c2-demo");
  await wait(reviewer, () => !!document.querySelector('[role="alert"]'));
  await screenshot(reviewer, "sign-in-required"); checks.push(stage);
  stage = "private_c2_login";
  await wait(reviewer, () => !!document.querySelector("#c2-username"));
  await fill(reviewer, "#c2-username", env.DEV_COUNSELLOR_USERNAME);
  await fill(reviewer, "#c2-password", env.DEV_COUNSELLOR_PASSWORD);
  await click(reviewer, "Sign in");
  await wait(reviewer, () => !!document.querySelector("#custom-text")); checks.push(stage);
  // Observe real responses in transient page memory; never substitute a result.
  await evaluate(reviewer, () => {
    const actualFetch = globalThis.fetch.bind(globalThis);
    globalThis.fetch = async (...args) => {
      const response = await actualFetch(...args);
      if (String(args[0]).endsWith("/c2-demo/custom-runs")) globalThis.__c2LastStatus = response.status;
      if (String(args[0]).endsWith("/c2-demo/custom-runs") && response.ok) globalThis.__c2Observed = await response.clone().json();
      return response;
    };
  });
  const cases = JSON.parse(await readFile(process.argv[2] ?? ".local/c2-dashboard-browser-inputs.json", "utf8"));
  for (const item of cases) {
    stage = "actual_render_" + item.case_id;
    await fill(reviewer, "#custom-text", item.text);
    assert(await evaluate(reviewer, () => !document.querySelector("article")), "Stale result survived input change");
    await evaluate(reviewer, () => { globalThis.__c2Observed = null; });
    await click(reviewer, "Run demonstration");
    await wait(reviewer, () => !!document.querySelector("article .c2-text") && !!globalThis.__c2Observed);
    assert(await evaluate(reviewer, () => {
      const response = globalThis.__c2Observed, record = response.records[0];
      const beforeAfter = [...document.querySelectorAll(".c2-workbench .c2-text")].map(e => e.textContent);
      const content = document.querySelector('main').textContent;
      const blocking = [...document.querySelectorAll('.c2-blocking-reasons li')].map(e => e.textContent);
      const counts = [...document.querySelectorAll('.c2-counts dd')].map(e => Number(e.textContent));
      const outcomes = [
        beforeAfter[0] === (record.original_text || "(Empty content)") && beforeAfter[1] === (record.anonymized_text || "(Empty content)"),
        content.includes("Quality: " + record.quality_status),
        content.includes("Automated gate: " + (response.release_ready ? "Passed" : "Blocked")),
        content.includes("Privacy review: " + (record.requires_privacy_review ? "Required — quarantine pending human review" : "No automated review signal flagged")),
        content.includes("Privacy gate: " + response.privacy_summary.status),
        response.blocking_reasons.every(reason => content.includes(reason.replaceAll(/[-_:]/g, " "))),
        JSON.stringify(blocking) === JSON.stringify(response.blocking_reasons.map(reason => reason.replaceAll(/[-_:]/g, " "))),
        JSON.stringify(counts) === JSON.stringify(response.records.length > 1 ? [response.quality_summary.total_records, ...["PASS", "REVIEW", "REJECT"].map(status => response.quality_summary.status_counts[status] ?? 0)] : []),
        !content.includes("Evidence context") && !content.includes("artifacts/c2-evidence"),
        record.transformations.every(value => content.includes(value.replaceAll(/[-_:]/g, " "))),
        content.includes("Human release approval required."),
        content.includes(record.language_identification.language.replaceAll(/[-_:]/g, " ")),
        content.includes(record.language_identification.method),
        document.querySelector('[data-testid="normalized-text"]').textContent === (record.normalized_text || "(Empty content)"),
        JSON.stringify([...document.querySelectorAll('.c2-tokens li')].map(e => e.textContent)) === JSON.stringify(record.tokens),
        record.tokens.every((token, i) => Array.from(record.normalized_text).slice(...record.token_offsets[i]).join("") === token),
        document.querySelector('.c2-notifications').querySelectorAll('[role="status"], [role="alert"]').length === 1,
        !document.querySelector("#custom-language")
      ];
      globalThis.__c2FailedAssertions = outcomes.flatMap((passed, index) => passed ? [] : [index]);
      return outcomes.every(Boolean);
    }), "Actual Before/After, transformations or release result differs from response");
    checks.push(stage);
    if (item.expected_language) assert(await evaluate(reviewer, expected => globalThis.__c2Observed.records[0].language_identification.language === expected, item.expected_language), "Reported language correction not present in actual response");
    if (item.case_id === "reported-short") await screenshot(reviewer, "desktop-short-language-correction");
    if (item.case_id === "english-name") await screenshot(reviewer, "desktop-live-name");
    if (item.case_id === "code-mixed-development-09") await screenshot(reviewer, "desktop-corrected-student-id");
    if (item.case_id === "reported-role") await screenshot(reviewer, "desktop-title-role-correction");
    if (item.case_id === "unresolved-role") await screenshot(reviewer, "desktop-privacy-quarantine");
    if (item.case_id === "reported-variants") await screenshot(reviewer, "desktop-role-variants-v3");
    if (item.case_id === "reported-kinship") await screenshot(reviewer, "desktop-kinship-v3");
    if (item.case_id === "kinship-unbounded") await screenshot(reviewer, "desktop-kinship-review-v3");
    if (item.case_id === "location-case-0-lower") await screenshot(reviewer, "desktop-location-case-v1");
    if (item.case_id === "reported-relationship-0") await screenshot(reviewer, "desktop-unresolved-relationship");
    if (item.case_id === "relationship-name-0-0") await screenshot(reviewer, "desktop-explicit-possessive-name");
    if (item.case_id === "processed") {
      assert(await evaluate(reviewer, () => {
        const main = document.querySelector('main').getBoundingClientRect();
        const row = document.querySelector('.c2-workbench').getBoundingClientRect();
        const cards = [...document.querySelectorAll('.c2-full-width')].map(e => e.getBoundingClientRect());
        const toast = document.querySelector('.c2-notifications').getBoundingClientRect();
        return cards.every(rect => rect.top >= row.bottom && Math.abs(rect.width-main.width) < 2)
          && !document.querySelector('.c2-workbench .c2-derived')
          && globalThis.visualViewport.scale === 1 && globalThis.devicePixelRatio === 1
          && toast.width > 0 && toast.height > 0 && toast.bottom > 0 && toast.top < globalThis.innerHeight;
      }), "Full-width grouping, 100% scale or visible notification container failed");
      await evaluate(reviewer, () => [...document.querySelectorAll("summary")].find(e => e.textContent === "Normalization and token offsets").click());
      assert(await evaluate(reviewer, () => {
        const record = globalThis.__c2Observed.records[0];
        const rows = [...document.querySelectorAll('.c2-derived tbody tr')].map(row => [...row.children].map(e => e.textContent));
        return JSON.stringify(rows) === JSON.stringify(record.tokens.map((token, i) => [token, ...record.token_offsets[i].map(String)]));
      }), "Rendered offset table differs from actual response");
      await screenshot(reviewer, "desktop-normalized-tokens");
    }
  }
  stage = "narrow_sinhala_and_limitation_notice";
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true }, reviewer);
  await send("Emulation.setPageScaleFactor", { pageScaleFactor: 1 }, reviewer);
  await fill(reviewer, "#custom-text", "විභාග නිසා මට බයයි. 🙂");
  await click(reviewer, "Run demonstration");
  await wait(reviewer, () => !!document.querySelector('article [lang="si"]'));
  assert(await evaluate(reviewer, () => {
    const workbench = document.querySelector('.c2-workbench').getBoundingClientRect();
    const input = document.querySelector('.c2-workbench > .card').getBoundingClientRect();
    const output = document.querySelector('.c2-workbench > .stack').getBoundingClientRect();
    return input.width >= workbench.width * .95 && output.top >= input.bottom && document.querySelector('main').getBoundingClientRect().width <= 1120 && globalThis.visualViewport.scale === 1;
  }), "Narrow input and output cards must stack");
  assert(await evaluate(reviewer, () => document.querySelectorAll(".c2-roadmap li").length === 8 && localStorage.length === 0 && sessionStorage.length === 0 && document.querySelector("main").textContent.toLowerCase().includes("multilingual detection remains limited") && document.querySelector('.c2-roadmap').compareDocumentPosition(document.querySelector('#custom-text')) & 4), "Stages, limitations, placement or persistence check failed");
  await screenshot(reviewer, "narrow-sinhala-results"); checks.push(stage);
  stage = "actual_validation_error_single_toast";
  await fill(reviewer, "#custom-text", "x".repeat(1001));
  await click(reviewer, "Run demonstration");
  await wait(reviewer, () => !!document.querySelector('.c2-notifications [role="alert"]'));
  assert(await evaluate(reviewer, () => globalThis.__c2LastStatus === 422 && document.querySelector('.c2-notifications').querySelectorAll('[role="status"], [role="alert"]').length === 1 && !document.querySelector('.c2-notifications [role="status"]')), "Actual validation error toast duplicated or fabricated completion");
  checks.push(stage);
  stage = "reset_and_logout";
  await click(reviewer, "Reset");
  assert(await evaluate(reviewer, () => document.querySelector("#custom-text").value === "" && !document.querySelector("article")), "Reset failed");
  await click(reviewer, "Sign out");
  await wait(reviewer, () => !!document.querySelector("#c2-password") && !document.querySelector("#custom-text")); checks.push(stage);
  const report = { result: "PASS", browser: version.Browser, checks, screenshots, directory, limitations: ["Synthetic engineering smoke, not usability or research validation.", "No credential screenshots or network traces retained."] };
  await writeFile(join(directory, "report.json"), JSON.stringify(report, null, 2));
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
} catch {
  let failedAssertions;
  try { failedAssertions = await evaluate(reviewer, () => globalThis.__c2FailedAssertions); } catch { /* browser may be unavailable */ }
  process.stdout.write(JSON.stringify({ result: "FAIL", stage, directory, screenshots, failedAssertions }) + "\n");
  process.exitCode = 1;
} finally {
  if (socket?.readyState === WebSocket.OPEN) { try { await send("Browser.close"); } catch { /* browser may close the socket first */ } socket.close(); }
  if (processHandle && !socket) processHandle.kill();
}
