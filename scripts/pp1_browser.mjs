/* global document, window, HTMLSelectElement, HTMLInputElement, Event, Response, innerWidth, localStorage, sessionStorage, setTimeout, clearTimeout, Buffer, fetch, WebSocket */
// Local Edge/CDP smoke. No external dependencies, payload logs, traces or credential screenshots.
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";

const polished = process.argv.includes("--polished");
const privacy = polished || process.argv.includes("--privacy");
const manual = privacy || process.argv.includes("--manual");
const roles = manual || process.argv.includes("--roles");
const operations = roles || process.argv.includes("--operations");
const demo = operations || process.argv.includes("--demo");
const studentUrl = "http://localhost:3000";
const contexts = new Map();
const directory = resolve(".local", (polished ? "c1-visual-browser-" : privacy ? "c1-privacy-ui-browser-" : manual ? "c1-manual-charts-browser-" : roles ? "c1-role-browser-" : operations ? "c1-workspace-browser-" : demo ? "c1-demo-browser-" : "pp1-browser-") + randomUUID());
const started = Date.now();
await mkdir(directory, { recursive: true });
let stage = "launch", socket, processHandle, diagnosticPage;
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
async function evaluate(page, fn, argument, userGesture = false) {
  const result = await send("Runtime.evaluate", { expression: `(${fn.toString()})(${JSON.stringify(argument) ?? "undefined"})`, awaitPromise: true, returnByValue: true, userGesture }, page);
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

async function closeDetails(target) {
  await evaluate(target,()=>document.querySelector('dialog [data-dialog-close]')?.click());
  await wait(target,()=>!document.querySelector('dialog[open]'));
}
async function showCheck(target,id,expected) {
  const groups={consent:['FR01.a','FR01.b','FR02.a','FR02.b','NFR03'],identity:['FR03.a','FR03.b','NFR01'],access:['FR07','FR08.a','FR08.b','FR09.d','FR09.e','NFR02.a','NFR02.b','NFR02.c'],routing:['FR04.a','FR04.b','FR05','NFR05'],withdrawal:['FR10.a','FR10.b','FR10.c'],audit:['FR11.a','FR11.b','FR12','NFR04','FR09.a','FR09.b','FR09.c']};
  const titles={consent:'Consent and purpose',identity:'Pseudonymous identification',access:'Authentication, roles and assignment',routing:'Controlled orchestration and provenance',withdrawal:'Withdrawal and retention',audit:'Audit and accountability'};
  if(!await evaluate(target,id=>!!document.querySelector('[data-check="'+id+'"]'),id)){
    await closeDetails(target);
    const group=Object.keys(groups).find(key=>groups[key].includes(id));
    await click(target,group?'Privacy controls':'Reliability and oversight');
    if(group) await clickSelector(target,'button[aria-label="View evidence: '+titles[group]+'"]');
    else await click(target,'View reliability and oversight evidence');
  }
  await wait(target,({id,expected})=>{const row=document.querySelector('[data-check="'+id+'"] [data-result]');return !!row&&(!expected||row.textContent===expected);},{id,expected});
  return evaluate(target,id=>document.querySelector('[data-check="'+id+'"] [data-result]').textContent,id);
}
async function checkResult(target,id,expected){const result=await showCheck(target,id,expected);await closeDetails(target);return result;}
async function click(page, label) {
  await send('Page.bringToFront',{},page);
  if(label === "Sign out" && !await evaluate(page,()=>!!document.querySelector('[role="menuitem"]'))) await clickSelector(page,'.account-trigger');
  await wait(page, name => [...document.querySelectorAll("button")].some(e => e.textContent.trim() === name && !e.disabled), label);
  const position = await evaluate(page, async name => { const b = [...document.querySelectorAll("button")].find(e => e.textContent.trim() === name); b.scrollIntoView({block:'center',behavior:'instant'}); await new Promise(resolve=>window.requestAnimationFrame(resolve)); const r=b.getBoundingClientRect(), point={x:r.x+r.width/2,y:r.y+r.height/2}; window.__lastClickHit=b.contains(document.elementFromPoint(point.x,point.y)); window.__lastClickEvents=[]; for(const type of ['pointerdown','mousedown','mouseup','click'])b.addEventListener(type,()=>window.__lastClickEvents.push(type),{once:true}); return point; }, label);
  assert(await evaluate(page,()=>window.__lastClickHit),'Pointer target obscured');
  await pointerClick(page,position);
  // Observed in this headless multi-context run after a revocation closes a modal:
  // no native events reach this control. This fallback is automation evidence,
  // not verification of an ordinary physical click. Never bypass the UI or API.
  if(stage.startsWith('staff_reenable')&&!await evaluate(page,()=>window.__lastClickEvents.includes('click'))){
    if(process.argv.includes('--diagnose-input')) checks.push({name:'staff_reenable_input_delivery',state:await evaluate(page,()=>({focused:document.hasFocus(),visible:document.visibilityState==='visible',target_hit:window.__lastClickHit,events:window.__lastClickEvents,open_dialogs:document.querySelectorAll('dialog[open]').length}))});
    await evaluate(page,name=>{const button=[...document.querySelectorAll('button')].find(item=>item.textContent.trim()===name&&!item.disabled);button.focus();button.click();},label,true);
    checks.push('headless_staff_reenable_user_gesture_activation');
  }
}
async function clickSelector(page,selector){
  await send('Page.bringToFront',{},page);
  const position=await evaluate(page,selector=>{const e=document.querySelector(selector);e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};},selector);
  await pointerClick(page,position);
}
async function pointerClick(page,position){
  await send('Input.dispatchMouseEvent',{type:'mouseMoved',...position},page);
  await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...position},page);
  await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...position},page);
}
async function fill(page, selector, value) {
  await wait(page,selector=>{const element=document.querySelector(selector);return !!element&&!element.disabled;},selector);
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
  await send('Page.bringToFront',{},page);
  assert(await evaluate(page, () => ![...document.querySelectorAll('input[name="username"], input[type="password"]')].some(e => e.value)), "Credential field must be empty before capture");
  assert(await evaluate(page, () => document.documentElement.scrollWidth <= innerWidth), "Horizontal overflow");
  // Review contents are withheld from retained screenshots, even for fictional fixtures.
  await evaluate(page, () => { document.querySelectorAll('.interpretation-text').forEach(e => { e.style.visibility = 'hidden'; }); });
  const position=await evaluate(page,()=>{const previous={x:window.scrollX,y:window.scrollY};window.scrollTo(0,0);return previous;});
  const { data } = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true }, page);
  await evaluate(page,previous=>window.scrollTo(previous.x,previous.y),position);
  await evaluate(page, () => { document.querySelectorAll('.interpretation-text').forEach(e => { e.style.visibility = ''; }); });
  await writeFile(join(directory, name + ".png"), Buffer.from(data, "base64"));
  screenshots.push(name + ".png");
}
async function instrumentProgress(target) {
  await evaluate(target,()=>{
    const original=window.fetch.bind(window);let previousKey=null,previousCase=null;
    window.__privacyMode='normal';window.__privacyCalls={consent:0,submission:0};window.__privacySameKey=true;window.__privacySameCase=true;
    window.fetch=async(...args)=>{
      const path=String(args[0]);
      if(path.endsWith('/consents')&&args[1]?.method==='POST'){
        window.__privacyCalls.consent++;
        if(window.__privacyMode==='hold-consent')await new Promise(resolve=>{window.__releasePrivacy=resolve;});
      }
      if(path.endsWith('/lifecycle')&&window.__privacyMode==='status-fail')return new Response(JSON.stringify({error_code:'DEPENDENCY_UNAVAILABLE'}),{status:503});
      if(path.endsWith('/submissions')){
        window.__privacyCalls.submission++;
        const key=JSON.parse(args[1].body).idempotency_key;
        if(previousKey&&previousKey!==key)window.__privacySameKey=false;previousKey=key;
        if(window.__privacyMode==='hold-submission')await new Promise(resolve=>{window.__releasePrivacy=resolve;});
        if(window.__privacyMode==='reject')return new Response(JSON.stringify({error_code:'CONTRACT_INVALID'}),{status:422});
        const response=await original(...args);
        if(response.ok){const current=(await response.clone().json()).case_id;if(previousCase&&previousCase!==current)window.__privacySameCase=false;previousCase=current;}
        if(window.__privacyMode==='lose-response'){window.__privacyMode='normal';throw new TypeError('Synthetic response loss');}
        return response;
      }
      return original(...args);
    };
  });
}
async function verifyShell(target,name){
  const savedStage=stage;stage='polished_'+name+'_shell';diagnosticPage=target;
  await clickSelector(target,'.account-trigger');
  await wait(target,()=>document.activeElement?.getAttribute('role')==='menuitem');
  await screenshot(target,'polished-'+name+'-account-menu');
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27,nativeVirtualKeyCode:27},target);
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27,nativeVirtualKeyCode:27},target);
  await wait(target,()=>!document.querySelector('[role="menu"]')&&document.activeElement?.classList.contains('account-trigger'));
  await click(target,'About this prototype');
  await wait(target,()=>document.querySelector('dialog h2')?.textContent==='About this prototype');
  assert(await evaluate(target,()=>/does not replace professional counselling/.test(document.querySelector('dialog').textContent)),'Prototype boundaries absent');
  await screenshot(target,'polished-'+name+'-prototype-dialog');
  await closeDetails(target);
  assert(await evaluate(target,()=>document.activeElement?.textContent==='About this prototype'),'Prototype focus not restored');
  assert(await evaluate(target,()=>!document.querySelector('main .session-strip')),'Large staff session panel remains');
  const desktop=await evaluate(target,()=>window.innerWidth>760);
  if(desktop){
    assert(await evaluate(target,()=>{const side=document.querySelector('.staff-sidebar');return window.getComputedStyle(side).backgroundColor==='rgb(16, 59, 50)'&&side.getBoundingClientRect().width===250;}),'Forest sidebar geometry or colour');
    if(name==='counsellor')assert(await evaluate(target,()=>!document.querySelector('a[href^="/admin"]')),'Counsellor received administrative navigation');
    const contrast=await evaluate(target,()=>{
      const luminance=colour=>colour.match(/\d+(\.\d+)?/g).slice(0,3).map(Number).map(value=>{const c=value/255;return c<=0.04045?c/12.92:((c+0.055)/1.055)**2.4;}).reduce((sum,value,index)=>sum+value*[0.2126,0.7152,0.0722][index],0);
      const ratio=(fg,bg)=>{const a=luminance(fg),b=luminance(bg);return (Math.max(a,b)+0.05)/(Math.min(a,b)+0.05);};
      const side=document.querySelector('.staff-sidebar'),link=side.querySelector('a[aria-current="page"]'),hint=document.querySelector('.subtitle');
      return {active:ratio(window.getComputedStyle(link).color,window.getComputedStyle(link).backgroundColor),navigation:ratio(window.getComputedStyle(side.querySelector('nav a')).color,window.getComputedStyle(side).backgroundColor),secondary_text:ratio(window.getComputedStyle(hint).color,window.getComputedStyle(document.body).backgroundColor)};
    });
    assert(Object.values(contrast).every(value=>value>=4.5),'Representative text contrast below 4.5');
    checks.push({name:stage+'_contrast',ratios:contrast});
  }
  checks.push(stage);stage=savedStage;
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
async function navigate(target, path, selector) {
  await send('Page.navigate', {url:'http://localhost:3001'+path}, target);
  await wait(target, ({path,selector}) => document.readyState === 'complete' && window.location.pathname === path && !!document.querySelector(selector), {path,selector});
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
  const env = Object.fromEntries((await readFile(".env", "utf8")).split(/\r?\n/).filter(line => line.includes("=") && !line.startsWith("#")).map(line => { const i = line.indexOf("="); return [line.slice(0, i), line.slice(i + 1)]; }));
  let administrator, secondReviewer, reviewer;
  stage = "rejection_and_desktop";
  const rejected = await page(studentUrl);
  await wait(rejected, () => !!document.querySelector('#language option'));
  await screenshot(rejected, "student-desktop");
  await click(rejected, "Record consent decision");
  await wait(rejected, () => document.querySelector(".status-badge")?.textContent === "REJECTED");
  assert(await evaluate(rejected, () => [...document.querySelectorAll("button")].find(e => e.textContent === "Submit synthetic fixture").disabled), "Rejected submission enabled");
  checks.push(stage);

  stage = "mobile_prewithdrawal_focus_and_cancel";
  const student = await page(studentUrl, true);
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

  if(privacy){
    stage='consent_and_submission_request_progress';
    const progressOwner=await page(studentUrl);
    await wait(progressOwner,()=>!!document.querySelector('#language option'));
    await instrumentProgress(progressOwner);await fill(progressOwner,'#decision','ACTIVE');
    await evaluate(progressOwner,()=>{window.__privacyMode='hold-consent';});
    await click(progressOwner,'Record consent decision');
    await wait(progressOwner,()=>document.querySelector('[role="progressbar"]')?.getAttribute('aria-label')?.startsWith('Recording consent'));
    stage='consent_pending_busy';
    assert(await evaluate(progressOwner,()=>document.querySelector('[aria-labelledby="consent-title"]').getAttribute('aria-busy')==='true'),'Consent pending state');
    stage='consent_pending_request_count';
    await wait(progressOwner,()=>window.__privacyCalls.consent===1);
    assert(await evaluate(progressOwner,()=>window.__privacyCalls.consent===1),'Consent pending request count');
    await screenshot(progressOwner,'consent-request-pending-desktop');
    await evaluate(progressOwner,()=>{window.__privacyMode='normal';window.__releasePrivacy();});
    await wait(progressOwner,()=>document.querySelector('.status-badge')?.textContent==='ACTIVE');
    await evaluate(progressOwner,()=>{window.__privacyMode='hold-submission';});
    await click(progressOwner,'Submit synthetic fixture');
    await wait(progressOwner,()=>document.querySelector('[role="progressbar"]')?.getAttribute('aria-label')?.startsWith('Submitting text'));
    assert(await evaluate(progressOwner,()=>!document.querySelector('[role="progressbar"]').hasAttribute('aria-valuenow')&&window.__privacyCalls.submission===1),'Invented percentage or duplicate submit');
    await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]},progressOwner);
    assert(await evaluate(progressOwner,()=>window.getComputedStyle(document.querySelector('.request-progress span')).animationName==='none'),'Pending progress ignores reduced motion');
    await screenshot(progressOwner,'submission-pending-reduced-motion');
    await evaluate(progressOwner,()=>{window.__privacyMode='status-fail';window.__releasePrivacy();});
    await wait(progressOwner,()=>document.querySelector('.feedback')?.textContent==='Submission accepted; processing status temporarily unavailable.');
    await screenshot(progressOwner,'submission-accepted-status-unavailable');
    const uncertainOwner=await page(studentUrl);await accept(uncertainOwner);await instrumentProgress(uncertainOwner);
    await evaluate(uncertainOwner,()=>{window.__privacyMode='lose-response';});await click(uncertainOwner,'Submit synthetic fixture');
    await wait(uncertainOwner,()=>document.querySelector('.feedback')?.textContent.includes('Submission outcome is unconfirmed'));
    await screenshot(uncertainOwner,'submission-unconfirmed-retry');
    await click(uncertainOwner,'Retry unconfirmed submission');
    await wait(uncertainOwner,()=>document.querySelector('.feedback')?.textContent.startsWith('Submission accepted.'));
    assert(await evaluate(uncertainOwner,()=>window.__privacySameKey&&window.__privacySameCase&&window.__privacyCalls.submission===2),'Uncertain retry changed key or case');
    const rejectedOwner=await page(studentUrl);await accept(rejectedOwner);await instrumentProgress(rejectedOwner);
    await evaluate(rejectedOwner,()=>{window.__privacyMode='reject';});await click(rejectedOwner,'Submit synthetic fixture');
    await wait(rejectedOwner,()=>document.querySelector('.feedback')?.textContent.includes('Submission was not accepted'));
    assert(await evaluate(rejectedOwner,()=>!document.querySelector('[role="progressbar"]')),'Failed submission still pending');
    await screenshot(rejectedOwner,'submission-rejected-request');
    checks.push(stage);
  }
  stage = "fresh_submission";
  const owner = await page(studentUrl);
  const observer = demo ? await page("http://localhost:3000/demo", false, owner) : null;
  if (demo) assert(await evaluate(observer, () => !document.querySelector('#decision') && !document.querySelector('textarea')), "Observer duplicated submission form");
  await accept(owner);
  if (demo) {
    await closeDetails(observer); await click(observer, "Refresh evidence");
    await wait(observer, () => document.querySelectorAll('#demo-run option').length === 2);
    const runId = await evaluate(observer, () => document.querySelectorAll('#demo-run option')[1].value);
    await fill(observer, "#demo-run", runId);
    await checkResult(observer,'FR01.a','Verified in selected run');
    assert((await checkResult(observer,'FR02.a','Not exercised')) === 'Not exercised', "Consent acceptance invented denial");
    await screenshot(observer, "demo-consent-observed");
    if(privacy){
      await showCheck(observer,'NFR05');
      assert(await evaluate(observer,()=>document.querySelector('[data-check="NFR05"] dl dd')?.textContent==='Implemented' && document.querySelector('[data-check="NFR05"]')?.textContent.includes('awaits joint integration')),'Mock contracts presented as complete real-provider compatibility');
      await closeDetails(observer);
      await send('Page.bringToFront',{},observer);
      await showCheck(observer,'FR01.a');
      assert(await evaluate(observer,()=>document.querySelector('dialog .dialog-body').scrollHeight>document.querySelector('dialog .dialog-body').clientHeight),'Evidence dialog is not internally scrollable');
      await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9,nativeVirtualKeyCode:9},observer);await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9,nativeVirtualKeyCode:9},observer);
      assert(await evaluate(observer,()=>!!document.activeElement?.closest('dialog')),'Evidence focus escaped');
      await screenshot(observer,'privacy-evidence-dialog-desktop');
      await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27,nativeVirtualKeyCode:27},observer);await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27,nativeVirtualKeyCode:27},observer);
      stage='evidence_escape_close';
      await wait(observer,()=>!document.querySelector('dialog[open]'));
      assert(await evaluate(observer,()=>document.activeElement?.getAttribute('aria-label')==='View evidence: Consent and purpose'),'Evidence focus not restored');
      checks.push('privacy_evidence_dialog_scroll_keyboard_and_focus_return');
    }

  }
  await evaluate(owner, () => {
    const original = window.fetch.bind(window);
    window.fetch = async (...args) => {
      const response = await original(...args);
      if (String(args[0]).endsWith("/submissions") && response.ok) window.__demoCase = (await response.clone().json()).case_id;
      return response;
    };
  });
  stage="fresh_submission_request";
  await click(owner, "Submit synthetic fixture");
  stage="fresh_submission_processing";
  for (let i = 0; i < 40; i++) {
    await click(owner, "Refresh status");
    if (await evaluate(owner, () => document.querySelector('.status-list')?.textContent.includes("Awaiting human review"))) break;
    await pause(250);
  }
  if (manual) {
    stage='manual_processing_without_assignment';
    const pendingCase=await evaluate(owner,()=>window.__demoCase);
    await closeDetails(observer); await click(observer,'Refresh evidence');
    await checkResult(observer,'FR07','Not exercised');
    await screenshot(observer,'demo-awaiting-assignment');
    reviewer=await page('http://localhost:3001');
    await wait(reviewer,()=>!!document.querySelector('#username'));
    await fill(reviewer,'#username',env.DEV_COUNSELLOR_USERNAME); await fill(reviewer,'#password',env.DEV_COUNSELLOR_PASSWORD);
    await click(reviewer,'Sign in'); await wait(reviewer,()=>!!document.querySelector('.toolbar'));
    assert(await evaluate(reviewer,async id=>(await (await fetch('/api/v1/review-queue')).json()).items.every(item=>item.case.case_id!==id),pendingCase),'Unassigned case was readable');
    await screenshot(reviewer,'counsellor-before-assignment');
    if(polished)await verifyShell(reviewer,'counsellor');
    const recipient=await evaluate(reviewer,async()=>(await (await fetch('/api/v1/auth/me')).json()).account_id);
    administrator=await page('http://localhost:3001/admin');
    await wait(administrator,()=>!!document.querySelector('#username'));
    await fill(administrator,'#username',env.DEV_ADMIN_USERNAME); await fill(administrator,'#password',env.DEV_ADMIN_PASSWORD);
    await click(administrator,'Sign in'); await wait(administrator,()=>!!document.querySelector('#audit-case'));
    assert(await evaluate(administrator,async()=>(await (await fetch('/api/v1/admin/overview')).json()).assignment_policy==='MANUAL'),'Expected explicit MANUAL configuration');
    if(polished)await verifyShell(administrator,'admin');
    await navigate(administrator,'/admin/assignments','#record-search');
    await fill(administrator,'#record-search',pendingCase); await click(administrator,'Apply filters');
    await click(administrator,'Manage case '+pendingCase.slice(0,8));
    await wait(administrator,id=>!!document.querySelector('#assignment-recipient option[value="'+id+'"]'),recipient);
    await screenshot(administrator,'manual-awaiting-assignment');
    await fill(administrator,'#assignment-recipient',recipient);
    if(privacy){
      await send('Page.bringToFront',{},administrator);
      await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27,nativeVirtualKeyCode:27},administrator);await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27,nativeVirtualKeyCode:27},administrator);
      stage='assignment_dirty_prompt';
      await wait(administrator,()=>document.querySelector('dialog h2')?.textContent==='Discard unsaved changes?');
      stage='assignment_dirty_initial_focus';
      await screenshot(administrator,'assignment-discard-prompt');
      await wait(administrator,()=>document.activeElement?.textContent==='Keep editing');
      assert(await evaluate(administrator,()=>document.querySelectorAll('dialog[open]').length===1 && document.activeElement?.textContent==='Keep editing'),'Dirty editor confirmation/focus');
      await click(administrator,'Keep editing');
      await wait(administrator,()=>!!document.querySelector('#assignment-recipient'));
      assert(await evaluate(administrator,id=>document.querySelector('#assignment-recipient').value===id,recipient),'Unsaved editor selection lost');
      await screenshot(administrator,'assignment-editor-desktop');
    }
    await click(administrator,'Review assignment change'); await click(administrator,'Confirm change');
    await wait(administrator,()=>document.querySelector('.feedback')?.textContent.includes('Assignment saved'));
    await screenshot(administrator,'manual-assignment-saved');
    await navigate(administrator,'/admin/overview','.metric-grid');
    await wait(administrator,()=>!!document.querySelector('[data-chart-total]'));
    await fill(administrator,'#chart-reference',pendingCase); await click(administrator,'Apply chart filters');
    await wait(administrator,()=>document.querySelector('[data-chart-total]')?.getAttribute('data-chart-total')==='1');
    assert(await evaluate(administrator,async id=>(await (await fetch('/api/v1/admin/analytics?q='+id)).json()).workload_assignment_pairs===1,pendingCase),'Active workload count mismatch');
    await wait(administrator,()=>!!document.querySelector('[role="img"][aria-label^="Active assigned workload."]'));
    await screenshot(administrator,'admin-active-workload-desktop');
    await closeDetails(observer); await click(observer,'Refresh evidence');
    checks.push('manual_processed_case_requires_explicit_admin_assignment');
    stage='fresh_submission';
  }
  if (demo) {
    await checkResult(observer,'FR07','Verified in selected run');
    assert((await checkResult(observer,'FR09.b','Not exercised')) === 'Not exercised', "Workflow invented review action");
    await screenshot(observer, "demo-workflow-observed");
  }
  await send('Page.bringToFront',{},owner);
  await wait(owner, () => document.querySelector('.status-list')?.textContent.includes("Awaiting human review"));
  await screenshot(owner, "student-processing-complete");
  const createdCase = await evaluate(owner, () => window.__demoCase);
  assert(createdCase, "Own synthetic case was not captured");
  checks.push(stage);

  stage = "authorized_review";
  reviewer ||= await page("http://localhost:3001");
  if (!manual) {
  await wait(reviewer, () => !!document.querySelector("#username"));
  await screenshot(reviewer, "counsellor-signin");
  await fill(reviewer, "#username", env.DEV_COUNSELLOR_USERNAME);
  await fill(reviewer, "#password", env.DEV_COUNSELLOR_PASSWORD);
  await click(reviewer, "Sign in");
  } else await click(reviewer, "Refresh assigned tasks");
  await wait(reviewer, () => !!document.querySelector(".task-button"));
  await wait(reviewer, caseId => [...document.querySelectorAll('.task-button')].some(button => button.getAttribute('aria-label') === 'Open case ' + caseId), createdCase);
  // Only mutate the case created by this run; preserve existing development tasks.
  await evaluate(reviewer, async caseId => {
    const button = [...document.querySelectorAll('.task-button')].find(button => button.getAttribute('aria-label') === 'Open case ' + caseId);
    if (!button) throw new Error('Own task unavailable');
    button.click();
  }, createdCase);
  await wait(reviewer, () => [...document.querySelectorAll("button")].some(e => e.textContent === "Start human review"));
  assert(await evaluate(reviewer,()=>document.body.textContent.includes("Explanation values unavailable from current provider")),"Unavailable C4 values missing");
  await screenshot(reviewer, "counsellor-assigned-review");
  await click(reviewer, "Start human review");
  if (operations) {
    stage = 'save_and_reopen_review';
    await wait(reviewer, () => !!document.querySelector('#interpretation'));
    await fill(reviewer, '#interpretation', 'Invalid fictional marker');
    await click(reviewer, 'Save review record');
    await wait(reviewer, () => document.querySelector('[role="alert"]')?.textContent.includes('Start with SYNTHETIC:'));
    await fill(reviewer, '#interpretation', 'SYNTHETIC: Fictional case reviewed in the C1 workspace walkthrough.');
    await fill(reviewer, '#follow-up', 'DISCUSSION_OFFERED');
    await click(reviewer, 'Save review record');
    await wait(reviewer, () => !!document.querySelector('.saved-record'));
    await click(reviewer, 'Refresh assigned tasks');
    await wait(reviewer, () => !!document.querySelector('.saved-record'));
    await click(reviewer, 'Sign out');
    await fill(reviewer, '#username', env.DEV_COUNSELLOR_USERNAME);
    await fill(reviewer, '#password', env.DEV_COUNSELLOR_PASSWORD);
    await click(reviewer, 'Sign in');
    await wait(reviewer, () => !!document.querySelector('.task-button'));
    await evaluate(reviewer, caseId => [...document.querySelectorAll('.task-button')].find(button => button.getAttribute('aria-label') === 'Open case ' + caseId).click(), createdCase);
    await wait(reviewer, () => document.querySelector('.saved-record')?.textContent.includes('Fictional case reviewed in the C1 workspace walkthrough.'));
    assert(await evaluate(reviewer, () => !document.querySelector('#interpretation')), 'Saved record is editable');
    checks.push(stage);
    stage = 'authorized_review';
  }
  await click(reviewer, "Record review complete");
  await wait(reviewer, () => document.querySelector(".review-detail")?.textContent.includes("Human review completed"));
  if (demo) {
    await closeDetails(observer); await click(observer, "Refresh evidence");
    await checkResult(observer,'FR09.b','Verified in selected run');
    await showCheck(observer,'FR09.a');
    await screenshot(observer, "demo-human-review-observed");
  }
  checks.push(stage);

  if (operations) {
    stage = 'restricted_admin_evidence';
    await screenshot(reviewer, 'counsellor-saved-review-desktop');
    await send('Emulation.setDeviceMetricsOverride', {width:390,height:844,deviceScaleFactor:1,mobile:true}, reviewer);
    await screenshot(reviewer, 'counsellor-saved-review-mobile');
    await send('Emulation.setDeviceMetricsOverride', {width:1366,height:1000,deviceScaleFactor:1,mobile:false}, reviewer);
    if (!administrator) {
    administrator = await page('http://localhost:3001/admin');
    await wait(administrator, () => !!document.querySelector('#username'));
    await screenshot(administrator, 'admin-signin');
    await fill(administrator, '#username', env.DEV_ADMIN_USERNAME);
    await fill(administrator, '#password', env.DEV_ADMIN_PASSWORD);
    await click(administrator, 'Sign in');
    await wait(administrator, () => !!document.querySelector('#audit-case'));
    } else await navigate(administrator,'/admin','#audit-case');
    await fill(administrator, '#audit-case', createdCase);
    await click(administrator, 'Apply filters');
    await wait(administrator, () => document.querySelector('.audit-card')?.textContent.includes('Record saved'));
    const privacy = await evaluate(administrator, async () => {
      const me = await (await fetch('/api/v1/admin-auth/me')).json();
      const denied = await fetch('/api/v1/review-tasks');
      return {role:me.role, review_status:denied.status, note_absent:!document.body.textContent.includes('Fictional case reviewed in the C1 workspace walkthrough.')};
    });
    assert(privacy.role === 'ADMIN' && [401,403].includes(privacy.review_status) && privacy.note_absent, 'Admin counselling-content boundary failed');
    assert(await evaluate(owner, async () => (await fetch('/api/v1/review-tasks')).status === 403), 'Student accessed counselling content');
    await screenshot(administrator, 'admin-events-desktop');
    await send('Emulation.setDeviceMetricsOverride', {width:390,height:844,deviceScaleFactor:1,mobile:true}, administrator);
    await screenshot(administrator, 'admin-events-mobile');
    await send('Emulation.setDeviceMetricsOverride', {width:1366,height:1000,deviceScaleFactor:1,mobile:false}, administrator);
    await send('Emulation.setDeviceMetricsOverride', {width:390,height:844,deviceScaleFactor:1,mobile:true}, observer);
    await screenshot(observer, 'demo-checklist-mobile');
    await send('Emulation.setDeviceMetricsOverride', {width:1366,height:1000,deviceScaleFactor:1,mobile:false}, observer);
    checks.push(stage);
    if (roles) {
      stage = 'admin_sections_and_reassignment';
      const staffFile = process.argv[process.argv.indexOf('--staff-file') + 1];
      assert(process.argv.includes('--staff-file') && staffFile, 'Ignored synthetic staff file is required');
      const secondary = Object.fromEntries((await readFile(staffFile,'utf8')).split(/\r?\n/).filter(line=>line.includes('=')).map(line=>{const i=line.indexOf('=');return [line.slice(0,i),line.slice(i+1)];}));
      assert(secondary.STAFF_ROLE === 'COUNSELLOR' && secondary.STAFF_ACCOUNT_ID, 'Expected provisioned synthetic counsellor');
      await navigate(administrator,'/admin/overview','.metric-grid');
      await screenshot(administrator,'admin-overview-desktop');
      await wait(administrator,()=>!!document.querySelector('[data-chart-total]'));
      await fill(administrator,'#chart-reference',createdCase); await click(administrator,'Apply chart filters');
      await wait(administrator,()=>document.querySelector('[data-chart-total]')?.getAttribute('data-chart-total')==='1');
      assert(await evaluate(administrator,()=>document.querySelectorAll('[aria-label="Chart source cases"] tbody tr').length===1),'Chart source case total mismatch');
      await screenshot(administrator,'admin-charts-filtered-desktop');
      await fill(administrator,'#chart-interval','week'); await click(administrator,'Apply chart filters');
      await wait(administrator,()=>!![...document.querySelectorAll('h3')].find(element=>element.textContent==='Submissions by week'));
      await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true},administrator);
      await screenshot(administrator,'admin-charts-mobile');
      await send('Emulation.setDeviceMetricsOverride',{width:1366,height:1000,deviceScaleFactor:1,mobile:false},administrator);
      checks.push('admin_chart_filter_parity_daily_weekly_and_mobile');

      await navigate(administrator,'/admin/assignments','#record-search');
      await fill(administrator,'#record-search',createdCase); await click(administrator,'Apply filters');
      await click(administrator,'Manage case '+createdCase.slice(0,8));
      await wait(administrator,()=>!!document.querySelector('#assignment-recipient option[value]'));
      await wait(administrator,id=>!!document.querySelector('#assignment-recipient option[value="'+id+'"]'),secondary.STAFF_ACCOUNT_ID);
      await fill(administrator,'#assignment-recipient',secondary.STAFF_ACCOUNT_ID);
      await click(administrator,'Review assignment change');
      await wait(administrator,()=>document.querySelector('dialog')?.open && document.activeElement?.textContent==='Cancel change');
      assert(await evaluate(administrator,()=>document.activeElement?.textContent==='Cancel change'),'Assignment dialog focus');
      await screenshot(administrator,'assignment-confirmation-desktop');
      await click(administrator,'Cancel change');
      await click(administrator,'Review assignment change'); await click(administrator,'Confirm change');
      await wait(administrator,()=>document.querySelector('.feedback')?.textContent.includes('Assignment saved'));
      await screenshot(administrator,'assignments-desktop');
      stage='old_counsellor_after_reassignment';
      await click(reviewer,'Refresh assigned tasks');
      // Selection clears before the queue fetch finishes. Wait for the response,
      // not merely that synchronous clear, before checking assignment removal.
      await wait(reviewer,()=>[...document.querySelectorAll('button')].some(button=>button.textContent==='Refresh assigned tasks' && !button.disabled));
      await wait(reviewer,()=>!document.querySelector('.saved-record'));
      assert(await evaluate(reviewer,caseId=>![...document.querySelectorAll('.task-button')].some(button=>button.getAttribute('aria-label')==='Open case '+caseId),createdCase),'Old counsellor kept the case');
      secondReviewer=await page('http://localhost:3001');
      async function secondarySignIn() {
        stage='secondary_signin';
        await wait(secondReviewer,()=>!!document.querySelector('#username'));
        await fill(secondReviewer,'#username',secondary.STAFF_USERNAME); await fill(secondReviewer,'#password',secondary.STAFF_PASSWORD);
        await click(secondReviewer,'Sign in'); await wait(secondReviewer,()=>!!document.querySelector('.task-button'));
        stage='secondary_case_selection';
        await evaluate(secondReviewer,caseId=>[...document.querySelectorAll('.task-button')].find(button=>button.getAttribute('aria-label')==='Open case '+caseId).click(),createdCase);
        await wait(secondReviewer,()=>document.querySelector('.saved-record')?.textContent.includes('Fictional case reviewed in the C1 workspace walkthrough.'));
      }
      await secondarySignIn(); await screenshot(secondReviewer,'reassigned-counsellor-saved-review');
      checks.push('exclusive_reassignment_revokes_old_queue_and_reopens_saved_record');
      stage='staff_revocation_and_reenable';
      if(privacy){await click(secondReviewer,'Provider versions and correlation');await wait(secondReviewer,()=>!!document.querySelector('dialog[open]'));}
      await navigate(administrator,'/admin/staff','#record-search');
      await fill(administrator,'#record-search',secondary.STAFF_ACCOUNT_ID); await click(administrator,'Apply filters');
      await click(administrator,'Manage staff '+secondary.STAFF_ACCOUNT_ID.slice(0,8));
      await fill(administrator,'#staff-enabled','false'); await click(administrator,'Review staff change'); await click(administrator,'Confirm change');
      await wait(administrator,()=>document.querySelector('.feedback')?.textContent.includes('Staff permissions saved'));
      await screenshot(administrator,'staff-disabled-desktop');
      if(!privacy) await click(secondReviewer,'Refresh assigned tasks');
      await wait(secondReviewer,()=>!!document.querySelector('#username') && !document.querySelector('.saved-record'));
      await screenshot(secondReviewer,'staff-session-revoked');
      stage='staff_reenable_open_editor';
      await click(administrator,'Manage staff '+secondary.STAFF_ACCOUNT_ID.slice(0,8));
      stage='staff_reenable_ready_field';
      await fill(administrator,'#staff-enabled','true'); await click(administrator,'Review staff change'); await click(administrator,'Confirm change');
      await wait(administrator,()=>document.querySelector('.feedback')?.textContent.includes('Staff permissions saved'));
      await secondarySignIn();
      checks.push('staff_disable_revokes_session_and_reenable_requires_signin');
      stage='read_only_operations_retention_and_route_directory';
      await navigate(administrator,'/admin/operations','#record-search'); await screenshot(administrator,'workflow-operations-desktop');
      assert(await evaluate(administrator,()=>![...document.querySelectorAll('button')].some(button=>/retry job|execute job|reset database/i.test(button.textContent))),'Unsupported operations action');
      await navigate(administrator,'/admin/retention','#record-search'); await screenshot(administrator,'retention-overview-desktop');
      const directoryPage=await page('http://localhost:3001/research');
      await wait(directoryPage,()=>!!document.querySelector('#username'));
      await fill(directoryPage,'#username',secondary.STAFF_USERNAME); await fill(directoryPage,'#password',secondary.STAFF_PASSWORD); await click(directoryPage,'Sign in');
      await wait(directoryPage,()=>document.querySelectorAll('.component-grid .card').length===3);
      assert(await evaluate(directoryPage,()=>document.querySelectorAll('.component-grid a').length===0),'Nonexistent component page link');
      await screenshot(directoryPage,'protected-component-directory');
      checks.push(stage);
      if(privacy){
        stage='all_admin_routes_desktop_mobile';
        for(const [name,path,selector] of [['overview','/admin/overview','.metric-grid'],['staff','/admin/staff','#record-search'],['assignments','/admin/assignments','#record-search'],['audit','/admin','#audit-case'],['operations','/admin/operations','#record-search'],['retention','/admin/retention','#record-search']]){
          stage='admin_'+name+'_desktop';diagnosticPage=administrator;
          await send('Emulation.setDeviceMetricsOverride',{width:1920,height:1000,deviceScaleFactor:1,mobile:false},administrator);
          await navigate(administrator,path,selector);await wait(administrator,()=>!!document.querySelector('.staff-sidebar'));
          if(name==='overview')await wait(administrator,()=>!!document.querySelector('[data-chart-total]'));
          assert(await evaluate(administrator,()=>{const sidebar=document.querySelector('.staff-sidebar'),header=document.querySelector('.staff-topbar'),main=document.querySelector('main');const s=sidebar.getBoundingClientRect(),h=header.getBoundingClientRect();return window.getComputedStyle(sidebar).position==='fixed'&&s.left===0&&Math.abs(s.top-h.bottom)<=1&&main.getBoundingClientRect().left>=s.right&&document.querySelectorAll('.workspace-shell').length===1;}),'Desktop sidebar position/offset');
          await evaluate(administrator,()=>window.scrollTo(0,500));
          assert(await evaluate(administrator,()=>document.querySelector('.staff-sidebar').getBoundingClientRect().left===0 && document.querySelector('.staff-sidebar').getBoundingClientRect().top===72),'Sidebar moved while scrolling');
          await evaluate(administrator,()=>window.scrollTo(0,0));await screenshot(administrator,'privacy-admin-'+name+'-desktop');
          await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true},administrator);
          stage='admin_'+name+'_mobile_drawer';
          assert(await evaluate(administrator,()=>window.getComputedStyle(document.querySelector('.staff-sidebar')).display==='none'&&document.querySelector('main').getBoundingClientRect().left===0),'Mobile sidebar covered content');
          if(polished)await verifyShell(administrator,name+'-mobile');
          await click(administrator,'Menu');await wait(administrator,()=>!!document.querySelector('dialog.navigation-drawer[open]'));
          await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9,nativeVirtualKeyCode:9},administrator);await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9,nativeVirtualKeyCode:9},administrator);
          assert(await evaluate(administrator,()=>!!document.activeElement?.closest('dialog')),'Drawer focus escaped');
          if(name==='staff')await screenshot(administrator,'privacy-mobile-navigation-drawer');
          const destination=path==='/admin/staff'?'/admin/overview':'/admin/staff';
          stage='admin_'+name+'_mobile_navigation';
          await clickSelector(administrator,'dialog nav a[href="'+destination+'"]');
          await wait(administrator,path=>window.location.pathname===path&&!document.querySelector('dialog[open]')&&!!document.querySelector('.account-trigger'),destination);
          await navigate(administrator,path,selector);await screenshot(administrator,'privacy-admin-'+name+'-mobile');
        }
        checks.push(stage);
      }
      stage='mobile_reduced_motion';
      await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true},administrator);
      await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]},administrator);
      assert(await evaluate(administrator,()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches && [...document.querySelectorAll('.card')].every(card=>window.getComputedStyle(card).animationName==='none' && window.getComputedStyle(card).opacity!=='0')),'Reduced motion did not preserve visible content');
      await screenshot(administrator,'retention-mobile-reduced-motion');
      await navigate(administrator,'/admin/assignments','#record-search'); await screenshot(administrator,'assignments-mobile-reduced-motion');
      await send('Emulation.setEmulatedMedia',{features:[]},administrator);
      await send('Emulation.setDeviceMetricsOverride',{width:1366,height:1000,deviceScaleFactor:1,mobile:false},administrator);
      checks.push(stage);
      await navigate(administrator,'/admin','#audit-case'); await fill(administrator,'#audit-case',createdCase); await click(administrator,'Apply filters');
      await wait(administrator,()=>!!document.querySelector('.operations-panel'));
      if(privacy){await click(administrator,'Available provider versions');await wait(administrator,()=>!!document.querySelector('dialog[open]'));}
    }
  }

  stage = "withdrawal_access_revocation";
  await withdraw(owner);
  if(privacy){await wait(administrator,()=>!document.querySelector('dialog[open]'));assert(await evaluate(administrator,()=>!document.querySelector('.operations-panel')),'Disposed provider snapshot remained visible');checks.push('open_admin_provider_dialog_cleared_on_disposal');}
  if (demo) {
    await closeDetails(observer); await click(observer, "Refresh evidence");
    await checkResult(observer,'FR10.b','Verified in selected run');
    assert((await checkResult(observer,'FR05','Unavailable or stale')) === 'Unavailable or stale', "Disposed provenance was not withheld");
    await showCheck(observer,'FR10.a');
    await screenshot(observer, "demo-withdrawal-observed");
  }
  await click(reviewer, "Refresh assigned tasks");
  await wait(reviewer, () => !document.querySelector(".review-detail code"));
  assert(await evaluate(reviewer, () => ![...document.querySelectorAll("button")].some(e => /Start human review|Record review complete/.test(e.textContent))), "Revoked task remains actionable");
  await screenshot(reviewer, "counsellor-after-withdrawal");
  if (roles) {
    await click(secondReviewer,'Refresh assigned tasks');
    await wait(secondReviewer,()=>!document.querySelector('.saved-record'));
    await screenshot(secondReviewer,'reassigned-counsellor-after-withdrawal');
  }
  if (operations) {
    await click(administrator, 'Refresh evidence');
    await wait(administrator, () => document.querySelector('.operations-panel')?.textContent.includes('Owner withdrawal'));
    assert(await evaluate(administrator, () => !document.querySelector('.operations-panel')?.textContent.includes('mock-1')), 'Disposed provenance exposed');
    await screenshot(administrator, 'admin-after-withdrawal');
    stage = 'admin_logout';
    await click(administrator, 'Sign out');
    await wait(administrator, () => !!document.querySelector('#username') && [...document.querySelectorAll('button')].some(button => button.textContent === 'Sign in' && !button.disabled));
    assert(await evaluate(administrator, async () => (await fetch('/api/v1/admin/audit-events')).status === 401), 'Admin logout ineffective');
    checks.push('admin_disposal_receipts_and_logout');
    stage = 'withdrawal_access_revocation';
  }
  checks.push(stage);

  stage = "ended_session_message";
  const ended = await page(studentUrl);
  await accept(ended);
  assert(await evaluate(ended, async () => (await fetch('/api/v1/auth/logout', { method: 'POST', headers: { 'X-Requested-With': 'j26-browser' } })).status === 204), "Logout simulation failed");
  await click(ended, "Refresh status");
  await wait(ended, () => document.querySelector('[role="alert"]')?.textContent.includes("session has ended"));
  await screenshot(ended, "student-ended-session");
  for (const context of [owner, reviewer, student, ended]) assert(await evaluate(context, () => localStorage.length === 0 && sessionStorage.length === 0), "Unexpected browser storage");
  checks.push(stage);
  if (demo) {
    stage = "multiple_runs_and_stale_refresh";
    const next = await page(studentUrl, false, owner);
    await accept(next);
    await closeDetails(observer); await click(observer, "Refresh evidence");
    await wait(observer, () => document.querySelectorAll('#demo-run option').length === 3);
    const nextId = await evaluate(observer, () => [...document.querySelectorAll('#demo-run option')].find(e => e.value && e.value !== document.querySelector('#demo-run').value).value);
    await fill(observer, "#demo-run", nextId);
    await checkResult(observer,'FR09.b','Not exercised');
    assert((await checkResult(observer,'NFR02.b','Recorded configuration evidence')) === 'Recorded configuration evidence', "HTTP represented as TLS success");
    await showCheck(observer,'NFR02.b'); assert(await evaluate(observer,()=>document.querySelector('[data-check="NFR02.b"] dd')?.textContent==='Missing'),'TLS incorrectly marked implemented'); await closeDetails(observer);
    await evaluate(observer, () => {
      const original = window.fetch.bind(window);
      window.fetch = async (...args) => String(args[0]).includes('/demo/runs') ? { ok: false, status: 503 } : original(...args);
    });
    await closeDetails(observer); await click(observer, "Refresh evidence");
    await checkResult(observer,'FR01.a','Unavailable or stale');
    await showCheck(observer,'FR01.a');
    await screenshot(observer, "demo-stale-injected-response");
    assert(await evaluate(observer, () => localStorage.length === 0 && sessionStorage.length === 0), "Observer wrote browser storage");
    checks.push(stage);
  }
  const report = { result: "PASS", route: operations ? 'C1 student/counsellor/admin/demo' : demo ? studentUrl + "/demo" : studentUrl, browser: version.Browser, elapsed_seconds:(Date.now()-started)/1000, checks, screenshots, directory,
    limitations: ["Synthetic browser smoke, not usability validation.", "Ended-session behavior induced by logout; natural one-hour expiry not awaited.", "Demo stale-response check injects browser HTTP 503; no service failure is induced.", "No network traces or credential-bearing screenshots retained."] };
  await writeFile(join(directory, "report.json"), JSON.stringify(report, null, 2));
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
} catch (cause) {
  if(diagnosticPage){try{checks.push(await evaluate(diagnosticPage,()=>({safe_pointer_hit:window.__lastClickHit,pointer_events:window.__lastClickEvents,open_dialogs:document.querySelectorAll('dialog[open]').length,staff_field:!!document.querySelector('#staff-enabled'),staff_field_disabled:document.querySelector('#staff-enabled')?.disabled,active_tag:document.activeElement?.tagName})));}catch{/* Safe boolean diagnostics only. */}}
  if(diagnosticPage){try{await screenshot(diagnosticPage,'bounded-failure-screen');}catch{/* Never bypass screenshot privacy checks. */}}
  const reason = cause instanceof Error && ['UI condition timeout','Browser expression failed','Protocol timeout','Horizontal overflow'].includes(cause.message) ? cause.message : 'A bounded browser assertion failed';
  process.stdout.write(JSON.stringify({ result: "FAIL", stage, reason, directory, screenshots, checks }) + "\n");
  process.exitCode = 1;
} finally {
  if (socket?.readyState === WebSocket.OPEN) { try { await send("Browser.close"); } catch { /* browser can close the socket first */ } socket.close(); }
  if (processHandle && !socket) processHandle.kill();
}
