/* global document, HTMLInputElement, HTMLTextAreaElement, Event, crypto, fetch, WebSocket, setTimeout, clearTimeout */
// Synthetic saved/completed review lifecycle through the actual browser UI; no note/credential output.
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";

const directory = resolve('.local', 'c1-completed-browser-' + randomUUID());
await mkdir(directory, {recursive:true});
const started = Date.now(), checks = [];
let socket, browser, stage = 'launch', serial = 0, ownedPage, ownedCase;
const pending = new Map(), pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const assert = (value, label) => { if (!value) throw new Error(label); };
function send(method, params = {}, sessionId) {
  const id=++serial;
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{pending.delete(id);reject(new Error('Protocol timeout'));},20000);
    pending.set(id,{resolve,reject,timer}); socket.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));
  });
}
async function evaluate(page, fn, argument) {
  const result=await send('Runtime.evaluate',{expression:`(${fn.toString()})(${JSON.stringify(argument)??'undefined'})`,awaitPromise:true,returnByValue:true},page);
  if(result.exceptionDetails)throw new Error('Browser expression failed');return result.result.value;
}
async function wait(page, fn, argument) {
  const until=Date.now()+25000;
  while(Date.now()<until){if(await evaluate(page,fn,argument))return;await pause(100);}
  throw new Error('UI condition timeout');
}
async function launch() {
  browser=spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--disable-background-networking','--remote-debugging-port=0',`--user-data-dir=${join(directory,'profile')}`,'about:blank'],{stdio:'ignore',windowsHide:true});
  let version;
  for(let i=0;i<100;i++){
    try{const port=(await readFile(join(directory,'profile','DevToolsActivePort'),'utf8')).split('\n')[0];version=await(await fetch(`http://127.0.0.1:${port}/json/version`)).json();break;}catch{await pause(100);}
  }
  assert(version,'Browser launch');socket=new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
  socket.addEventListener('message',message=>{const data=JSON.parse(message.data),item=pending.get(data.id);if(item){clearTimeout(item.timer);pending.delete(data.id);if(data.error)item.reject(new Error('Protocol error'));else item.resolve(data.result);}});
  return version.Browser;
}
async function close() {
  const process=browser;
  const exited=process?.exitCode!==null?Promise.resolve():new Promise(resolve=>process.once('exit',resolve));
  if(socket?.readyState===WebSocket.OPEN){try{await send('Browser.close');}catch{/* Closing can end CDP first. */}socket.close();}
  await Promise.race([exited,pause(5000)]);
  assert(process?.exitCode!==null,'Browser did not exit before restart');socket=null;browser=null;
}
async function page(path) {
  // No Target.createBrowserContext: an incognito context cannot test restart persistence.
  const {targetId}=await send('Target.createTarget',{url:'about:blank'});
  const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
  await send('Page.enable',{},sessionId);await send('Network.enable',{},sessionId);
  await send('Emulation.setDeviceMetricsOverride',{width:1600,height:1000,deviceScaleFactor:1,mobile:false},sessionId);await navigate(sessionId,path);return sessionId;
}
async function navigate(target,path) {await send('Page.navigate',{url:path.startsWith('http://localhost:3000')?path:'http://localhost:3001'+path},target);await wait(target,()=>!!document.querySelector('main')&&document.readyState==='complete');}
async function click(target,selector) {
  await send('Page.bringToFront',{},target);await wait(target,selector=>{const e=document.querySelector(selector);return e&&!e.disabled;},selector);
  const point=await evaluate(target,selector=>{const e=document.querySelector(selector);e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};},selector);
  await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point},target);await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point},target);
}
async function login(target,credentials,remember=false) {
  await wait(target,()=>!!document.querySelector('#username'));
  assert(await evaluate(target,()=>!document.querySelector('[name="remember_me"]').checked),'Checkbox not unchecked by default');
  if(remember)await click(target,'[name="remember_me"]');
  await evaluate(target,credentials=>{for(const [selector,value] of [['#username',credentials.STAFF_USERNAME],['#password',credentials.STAFF_PASSWORD]]){const e=document.querySelector(selector);Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,value);e.dispatchEvent(new Event('input',{bubbles:true}));}},credentials);
  await click(target,'.sign-in form button[type="submit"]');
  await wait(target,()=>!!document.querySelector('.account-trigger')&&!document.querySelector('#password'));
}
async function signOut(target) {await click(target,'.account-trigger');await click(target,'button[role="menuitem"]');await wait(target,()=>!!document.querySelector('#username')||!document.querySelector('.account-trigger'));}

try {
  const parse=text=>Object.fromEntries(text.split(/\r?\n/).filter(line=>line.includes('=')&&!line.startsWith('#')).map(line=>{const i=line.indexOf('=');return[line.slice(0,i),line.slice(i+1)];}));
  const env=parse(await readFile('.env','utf8')),version=await launch();
  stage='synthetic_owner_submission';const student=await page('http://localhost:3000');ownedPage=student;
  await evaluate(student,()=>{const select=document.querySelector('#decision');select.value='ACTIVE';select.dispatchEvent(new Event('change',{bubbles:true}));});
  await click(student,'.consent-card > button');await wait(student,()=>!document.querySelector('.submission-card > button')?.disabled);
  await click(student,'.submission-card > button');
  await wait(student,async()=>{const r=await fetch('/api/v1/demo/runs');if(!r.ok)return false;const d=await r.json();const run=d.runs.find(x=>x.case_id);if(!run)return false;const s=await fetch('/api/v1/cases/'+run.case_id+'/status');return s.ok&&(await s.json()).processing_status==='READY_FOR_REVIEW';});
  const caseId=await evaluate(student,async()=>(await(await fetch('/api/v1/demo/runs')).json()).runs.find(x=>x.case_id).case_id);
  ownedCase=caseId;
  checks.push('synthetic_owner_consent_submission_and_processing_complete');
  stage='completed_url_login';const reviewer=await page('/?state=COMPLETED');
  await login(reviewer,{STAFF_USERNAME:env.DEV_COUNSELLOR_USERNAME,STAFF_PASSWORD:env.DEV_COUNSELLOR_PASSWORD});
  await wait(reviewer,()=>document.querySelector('main h1')?.textContent==='Completed reviews'&&document.querySelector('#queue-filter')?.value==='COMPLETED');checks.push('completed_filter_survives_sign_in');
  const reviewerId=await evaluate(reviewer,async()=>(await(await fetch('/api/v1/auth/me')).json()).account_id);
  stage='assign_only_synthetic_case';const admin=await page('/admin/assignments');
  await login(admin,{STAFF_USERNAME:env.DEV_ADMIN_USERNAME,STAFF_PASSWORD:env.DEV_ADMIN_PASSWORD});
  const assigned=await evaluate(admin,async({caseId,reviewerId})=>{
    const r=await fetch('/api/v1/admin/cases?q='+caseId);if(!r.ok)return r.status;const item=(await r.json()).items.find(x=>x.case_id===caseId);if(!item)return 404;
    return(await fetch('/api/v1/admin/cases/'+caseId+'/assignment',{method:'POST',headers:{'Content-Type':'application/json','X-Requested-With':'j26-browser'},body:JSON.stringify({counsellor_id:reviewerId,expected_version:item.assignment_version})})).status;
  },{caseId,reviewerId});assert(assigned===200,'Synthetic assignment failed');
  await click(reviewer,'.staff-sidebar a[href="/"]');await wait(reviewer,id=>!!document.querySelector('button[aria-label="Open case '+id+'"]'),caseId);
  await click(reviewer,'button[aria-label="Open case '+caseId+'"]');await wait(reviewer,()=>!!document.querySelector('.review-action-bar button'));
  await click(reviewer,'.review-action-bar button');await wait(reviewer,()=>!!document.querySelector('#interpretation'));
  await evaluate(reviewer,()=>{const e=document.querySelector('#interpretation');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(e,'SYNTHETIC: Fictional timetable observation for retrieval verification.');e.dispatchEvent(new Event('input',{bubbles:true}));});
  await click(reviewer,'.review-record form button');await wait(reviewer,()=>!!document.querySelector('.saved-record'));
  const taskId=await evaluate(reviewer,async caseId=>(await(await fetch('/api/v1/review-queue')).json()).items.find(x=>x.case.case_id===caseId).task_id,caseId);
  assert(await evaluate(reviewer,async taskId=>!(await(await fetch('/api/v1/review-queue?state=COMPLETED')).json()).items.some(x=>x.task_id===taskId),taskId),'Saved record alone incorrectly completed review');
  checks.push('saved_review_does_not_imply_human_completion');
  stage='explicit_completion_and_reopen';await click(reviewer,'.review-action-bar button');await wait(reviewer,()=>!document.querySelector('.review-action-bar button'));
  await click(reviewer,'.staff-sidebar a[href="/?state=COMPLETED"]');await wait(reviewer,id=>document.querySelector('main h1')?.textContent==='Completed reviews'&&!!document.querySelector('button[aria-label="Open case '+id+'"]'),caseId);
  await click(reviewer,'button[aria-label="Open case '+caseId+'"]');await wait(reviewer,()=>!!document.querySelector('.saved-record'));
  assert(await evaluate(reviewer,()=>document.querySelector('.interpretation-text')?.textContent==='SYNTHETIC: Fictional timetable observation for retrieval verification.'&&!document.querySelector('#interpretation')&&!document.querySelector('.review-action-bar button')),'Completed saved record not read-only');
  await click(reviewer,'.toolbar button');await wait(reviewer,()=>!!document.querySelector('.saved-record')&&!document.querySelector('.toolbar button')?.disabled);
  checks.push('save_complete_completed_list_readonly_reopen_and_refresh');
  stage='explicit_browser_refresh';await send('Page.reload',{},reviewer);await wait(reviewer,id=>document.querySelector('#queue-filter')?.value==='COMPLETED'&&!!document.querySelector('button[aria-label="Open case '+id+'"]'),caseId);
  await click(reviewer,'button[aria-label="Open case '+caseId+'"]');await wait(reviewer,()=>!!document.querySelector('.saved-record'));checks.push('document_refresh_preserves_completed_url_and_protected_retrieval');
  stage='withdrawal';await click(student,'.status-card .danger-outline');await wait(student,()=>!!document.querySelector('dialog[open]'));await click(student,'dialog[open] .danger');await wait(student,()=>document.body.textContent.includes('Withdrawal recorded'));
  await click(reviewer,'.toolbar button');await wait(reviewer,id=>!document.querySelector('.saved-record')&&!document.querySelector('button[aria-label="Open case '+id+'"]')&&!document.querySelector('.toolbar button')?.disabled,caseId);
  const denied=await evaluate(reviewer,async taskId=>{const r=await fetch('/api/v1/review-tasks/'+taskId+'/record');const d=await r.json();return{status:r.status,error_code:d.error_code};},taskId);
  assert([403,404].includes(denied.status),'Withdrawn review remained accessible');checks.push({name:'withdrawal_removes_completed_case_and_revokes_record',...denied});
  await signOut(reviewer);await signOut(admin);
  const report={result:'PASS',browser:version,elapsed_seconds:(Date.now()-started)/1000,checks,directory,limitations:['Only this newly created synthetic case was assigned/completed/withdrawn; existing expired consents were not extended.','Unassigned counsellor, researcher and other role denials additionally covered by backend tests.','No private note contents, credentials, cookie values or network traces retained.']};
  await writeFile(join(directory,'report.json'),JSON.stringify(report,null,2));process.stdout.write(JSON.stringify(report)+'\n');
} catch {
  // Clean up only the synthetic case created by this run, never a pre-existing case.
  if(ownedPage&&ownedCase){try{await evaluate(ownedPage,async caseId=>{await fetch('/api/v1/cases/'+caseId+'/withdraw',{method:'POST',headers:{'Content-Type':'application/json','X-Requested-With':'j26-browser'},body:JSON.stringify({idempotency_key:crypto.randomUUID()})});},ownedCase);}catch{/* Failure report never includes response bodies. */}}
  await writeFile(join(directory,'failure.json'),JSON.stringify({result:'FAIL',stage,checks,directory},null,2));process.stdout.write(JSON.stringify({result:'FAIL',stage,directory})+'\n');process.exitCode=1;
} finally {if(browser){try{await close();}catch{browser?.kill();}}}
