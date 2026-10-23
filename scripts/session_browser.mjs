/* global document, window, HTMLSelectElement, HTMLInputElement, Event, innerWidth, setTimeout, clearTimeout, Buffer, fetch, WebSocket */
// Local Edge/CDP smoke. No external dependencies, payload logs, traces or credential screenshots.
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";

const baseline = process.argv.includes("--baseline");
const studentUrl = "http://localhost:3000";
const contexts = new Map();
const directory = resolve(".local", "c1-session-browser-" + randomUUID());
await mkdir(directory, { recursive: true });
let stage = "launch", socket, processHandle;
const checks = [], screenshots = [];
const observedTargets = [];
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
    const prototype = e.tagName === "SELECT" ? HTMLSelectElement.prototype : e.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, "value").set.call(e, value);
    e.dispatchEvent(new Event("input", { bubbles: true })); e.dispatchEvent(new Event("change", { bubbles: true }));
  }, { selector, value });
}
async function page(url, mobile = false, shareWith) {
  const browserContextId = shareWith ? contexts.get(shareWith) : (await send("Target.createBrowserContext")).browserContextId;
  const { targetId } = await send("Target.createTarget", { url: "about:blank", browserContextId });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  await send("Page.enable", {}, sessionId);
  await send("Emulation.setDeviceMetricsOverride", { width: mobile ? 390 : 1366, height: mobile ? 844 : 1000, deviceScaleFactor: 1, mobile }, sessionId);
  await send("Page.navigate", { url }, sessionId);
  await wait(sessionId, () => !!document.querySelector("main") && document.readyState === "complete");
  contexts.set(sessionId, browserContextId);
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

  const owner = await page(studentUrl);
  await accept(owner);
  const observer = await page(studentUrl + "/demo", false, owner);
  const reviewer = await page("http://localhost:3001");
  const env = Object.fromEntries((await readFile(".env", "utf8")).split(/\r?\n/).filter(line => line.includes("=") && !line.startsWith("#")).map(line => { const i = line.indexOf("="); return [line.slice(0, i), line.slice(i + 1)]; }));
  async function signIn(target) {
    await wait(target, () => !!document.querySelector('#username'));
    await fill(target, '#username', env.DEV_COUNSELLOR_USERNAME);
    await fill(target, '#password', env.DEV_COUNSELLOR_PASSWORD);
    await click(target, 'Sign in');
    await wait(target, () => !!document.querySelector('.toolbar'));
  }
  await signIn(reviewer);
  observedTargets.push(owner, observer, reviewer);
  const started = Date.now();
  const cookieAttributes = (await send('Storage.getCookies', {browserContextId:contexts.get(owner)})).cookies.map(c => ({name:c.name,domain:c.domain,path:c.path,httpOnly:c.httpOnly,secure:c.secure,sameSite:c.sameSite,remaining_seconds:Math.round(c.expires-Date.now()/1000)}));
  const clock = await evaluate(owner, async () => {
    const start = Date.now(); const response = await fetch('/api/v1/fixtures');
    return { browser_utc: new Date().toISOString(), server_date: response.headers.get('date'), approximate_skew_ms: Date.parse(response.headers.get('date')) - (start + Date.now()) / 2 };
  });
  // Retain only fixed paths/status/allowlisted codes; never headers, bodies or identifiers.
  for (const target of [owner, observer, reviewer]) await evaluate(target, () => {
    window.__sessionChecks = [];
    const original = window.fetch.bind(window);
    window.fetch = async (...args) => {
      const response = await original(...args);
      const path = String(args[0]).split('?')[0];
      const safePath = ['/api/v1/auth/me', '/api/v1/auth/refresh', '/api/v1/review-tasks', '/api/v1/demo/runs'].includes(path) ? path : '/api/v1/owner-resource';
      let code = null;
      if (!response.ok) { try { const body = await response.clone().json(); if (['AUTH_REQUIRED','AUTH_INVALID','FORBIDDEN','CONSENT_INVALID','CONSENT_REQUIRED','NOT_FOUND','DEPENDENCY_UNAVAILABLE','RATE_LIMITED'].includes(body.error_code)) code = body.error_code; } catch { /* no body retained */ } }
      window.__sessionChecks.push({ endpoint: safePath, status: response.status, code });
      return response;
    };
  });
  await click(observer, 'Refresh evidence');
  await wait(observer, () => document.querySelectorAll('#demo-run option').length === 2);
  const runId = await evaluate(observer, () => document.querySelectorAll('#demo-run option')[1].value);
  await fill(observer, '#demo-run', runId);
  await click(owner, 'Submit synthetic fixture');
  for (let i=0;i<40;i++) {
    await click(owner, 'Refresh status');
    if (await evaluate(owner, () => document.querySelector('.status-list')?.textContent.includes('Awaiting human review'))) break;
    await pause(250);
  }
  stage = 'cookie_isolation';
  const sharedReviewer = await page('http://localhost:3001', false, owner);
  await signIn(sharedReviewer);
  const sameProfile = await evaluate(owner, async () => {
    const me = await fetch('/api/v1/auth/me'); const account = await me.json();
    const runs = await fetch('/api/v1/demo/runs'); const body = await runs.json();
    return { role: account.role, endpoint: '/api/v1/demo/runs', status: runs.status, code: body.error_code || null };
  });
  if (baseline) {
    assert(sameProfile.role === 'COUNSELLOR' && sameProfile.status === 403 && sameProfile.code === 'FORBIDDEN', 'Cookie collision not reproduced');
    // Use a fresh isolated owner pair for the expiry run; do not change stored data.
    await evaluate(owner, async () => { await fetch('/api/v1/auth/student-session', {method:'POST', headers:{'X-Requested-With':'j26-browser'}}); });
    await send('Page.navigate', { url: studentUrl }, owner);
    await wait(owner, () => !!document.querySelector('#decision'));
    await accept(owner);
  } else assert(sameProfile.role === 'STUDENT' && sameProfile.status === 200, 'Application session collision');
  checks.push({ name: stage, ...sameProfile });
  stage = 'real_access_expiry_wait';
  // Wait beyond the last session issuance; actual wall clock, no production expiry override.
  const expiryWaitStart = Date.now();
  if (process.argv.includes('--quick-expiry')) {
    for (const [target,name,port] of [[owner,'j26_student_access',3000],[reviewer,'j26_counsellor_access',3001],[sharedReviewer,'j26_counsellor_access',3001]])
      await send('Network.deleteCookies',{name,url:`http://localhost:${port}/api/v1`,path:'/api/v1'},target);
  } else while (Date.now() - expiryWaitStart < 310000) await pause(5000);
  stage = 'after_five_minutes';
  if (baseline) {
    await send('Page.reload', {}, reviewer);
    await wait(reviewer, () => !!document.querySelector('#username'));
    const rotation = await Promise.all([owner, observer].map(target => evaluate(target, async () => {
      const response = await fetch('/api/v1/auth/refresh', { method:'POST', headers:{'X-Requested-With':'j26-browser'} });
      const body = await response.json(); return { endpoint:'/api/v1/auth/refresh', status:response.status, code:body.error_code || null };
    })));
    const result = await evaluate(owner, async () => { const r=await fetch('/api/v1/auth/me'); const b=await r.json(); return { endpoint:'/api/v1/auth/me',status:r.status,code:b.error_code || null }; });
    checks.push({ name:'counsellor_reload_requires_login_despite_refresh_cookie', observed:true }, { name:'concurrent_rotation', rotation, after:result });
  } else {
    await Promise.all([click(owner, 'Refresh status'), click(observer, 'Refresh evidence'), click(reviewer, 'Refresh assigned tasks')]);
    stage = 'owner_after_refresh';
    await wait(owner, () => !document.querySelector('[role="alert"]') && document.querySelector('.status-badge')?.textContent === 'ACTIVE');
    stage = 'observer_after_refresh';
    await wait(observer, () => document.querySelector('[data-check="FR01.a"] [data-result]')?.textContent === 'Verified for this run');
    stage = 'reviewer_after_refresh';
    await wait(reviewer, () => !!document.querySelector('.toolbar'));
    // /auth/me on reload must also refresh (the separate sharedReviewer access has expired).
    stage = 'shared_reviewer_reload';
    await send('Page.reload', {}, sharedReviewer);
    await wait(sharedReviewer, () => !!document.querySelector('.toolbar'));
    stage = 'review_selection';
    const caseId = await evaluate(observer, async run => (await (await fetch('/api/v1/demo/runs/'+run)).json()).run.case_id, runId);
    await evaluate(reviewer, async caseId => {
      const tasks=await (await fetch('/api/v1/review-tasks')).json();
      const index=tasks.findIndex(t=>t.case.case_id===caseId); if(index<0) throw new Error('Own task missing');
      document.querySelectorAll('.task-button')[index].click();
    },caseId);
    stage = 'review_actions';
    await click(reviewer,'Start human review');
    stage = 'review_record_save';
    await wait(reviewer, () => !!document.querySelector('#interpretation'));
    await fill(reviewer, '#interpretation', 'SYNTHETIC: Fictional timetable context reviewed by a human.');
    await fill(reviewer, '#follow-up', 'DISCUSSION_OFFERED');
    await click(reviewer, 'Save review record');
    await wait(reviewer, () => document.querySelector('.review-detail')?.textContent.includes('Review record saved'));
    await click(reviewer, 'Refresh assigned tasks');
    await wait(reviewer, () => document.querySelector('.review-detail')?.textContent.includes('Fictional timetable context reviewed by a human.'));
    await click(reviewer,'Record review complete');
    await click(observer,'Refresh evidence');
    await wait(observer,()=>document.querySelector('[data-check="FR09.b"] [data-result]')?.textContent==='Verified for this run');
    await wait(observer,()=>document.querySelector('[data-check="FR09.c"] [data-result]')?.textContent==='Verified for this run');
    assert(await evaluate(observer, () => !document.body.textContent.includes('Fictional timetable context reviewed by a human.')), 'Private review text reached the student checklist');
    checks.push({name:'fr09_record_save_read_and_safe_student_receipt',passed:true});
    await screenshot(observer,'session-after-refresh-review');
    stage = 'withdrawal_after_refresh';
    await withdraw(owner); await click(observer,'Refresh evidence');
    await wait(observer,()=>document.querySelector('[data-check="FR10.b"] [data-result]')?.textContent==='Verified for this run');
    await click(reviewer,'Refresh assigned tasks');
    stage = 'logout_after_refresh';
    await click(reviewer,'Sign out'); await send('Page.reload',{},reviewer);
    await wait(reviewer,()=>!!document.querySelector('#username'));
    checks.push({name:'expiry_refresh_review_withdrawal_logout',passed:true});
  }
  const observations=[];
  for (const target of [owner,observer,reviewer]) observations.push(...await evaluate(target,()=>window.__sessionChecks || []));
  const report={result:'PASS', mode:baseline?'baseline-reproduction':process.argv.includes('--quick-expiry')?'controlled-cookie-expiry':'fixed-verification', elapsed_seconds:(Date.now()-started)/1000, expiry_wait_seconds:(Date.now()-expiryWaitStart)/1000, clock, cookieAttributes, checks, observations, screenshots, directory};
  await writeFile(join(directory,'report.json'),JSON.stringify(report,null,2));
  process.stdout.write(JSON.stringify(report,null,2)+'\n');
} catch {
  const observations=[];
  for(const target of observedTargets) { try { observations.push(...await evaluate(target,()=>window.__sessionChecks || [])); } catch { /* bounded safe diagnostics */ } }
  const failure={result:'FAIL',stage,directory,observations};
  await writeFile(join(directory,'failure.json'),JSON.stringify(failure,null,2));
  process.stdout.write(JSON.stringify(failure)+'\n'); process.exitCode=1;
} finally {
  if(socket?.readyState===WebSocket.OPEN){try{await send('Browser.close');}catch{/* browser closing */}socket.close();}
  if(processHandle&&!socket)processHandle.kill();
}
