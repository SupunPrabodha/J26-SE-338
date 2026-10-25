/* global document, HTMLInputElement, Event, Buffer, fetch, WebSocket, setTimeout, clearTimeout */
// Persistent default Edge profile: real browser restarts, no token/credential output.
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";

const directory = resolve('.local', 'c1-remember-browser-' + randomUUID());
await mkdir(directory, {recursive:true});
const started = Date.now(), checks = [], screenshots = [], cookieAttributes = [];
let socket, browser, stage = 'launch', serial = 0;
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
  await navigate(sessionId,path);return sessionId;
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
  await click(target,'form button[type="submit"], .sign-in form button');
  await wait(target,()=>!!document.querySelector('.account-trigger')&&!document.querySelector('#password'));
}
async function signOut(target) {await click(target,'.account-trigger');await click(target,'button[role="menuitem"]');await wait(target,()=>!!document.querySelector('#username')||!document.querySelector('.account-trigger'));}
async function capture(target,name) {
  assert(await evaluate(target,()=>![...document.querySelectorAll('input[name="username"],input[type="password"]')].some(input=>input.value)),'Credential fields not empty');
  const {data}=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true},target);await writeFile(join(directory,name+'.png'),Buffer.from(data,'base64'));screenshots.push(name+'.png');
}
async function profile(target,remember) {
  const result=await evaluate(target,async()=>{const r=await fetch('/api/v1/research-auth/profile');if(!r.ok)return{status:r.status};const p=await r.json();return{status:r.status,remember:p.remember_me,remaining:(Date.parse(p.session_expires_at)-Date.now())/1000,role:p.role};});
  assert(result.status===200&&result.role==='RESEARCHER'&&result.remember===remember,'Protected researcher profile');return result;
}
try {
  assert(process.argv.includes('--staff-file'),'Private researcher fixture path required');
  const parse=text=>Object.fromEntries(text.split(/\r?\n/).filter(line=>line.includes('=')&&!line.startsWith('#')).map(line=>{const i=line.indexOf('=');return[line.slice(0,i),line.slice(i+1)];}));
  const credentials=parse(await readFile(process.argv[process.argv.indexOf('--staff-file')+1],'utf8'));
  assert(credentials.STAFF_ROLE==='RESEARCHER','Researcher fixture required');
  const env=parse(await readFile('.env','utf8'));
  const version=await launch();let target=await page('/research');stage='remembered_login';await login(target,credentials,true);
  await wait(target,()=>document.querySelectorAll('.component-grid .card').length===3);
  const initial=await profile(target,true);assert(initial.remaining>3600&&initial.remaining<=2592000,'Bounded remembered deadline');
  const cookies=(await send('Network.getCookies',{urls:['http://localhost:3001/api/v1/research-auth/profile']},target)).cookies;
  for(const c of cookies.filter(c=>c.name.startsWith('j26_research_')))cookieAttributes.push({name:c.name,httpOnly:c.httpOnly,sameSite:c.sameSite,secure:c.secure,persistent:c.expires>0});
  assert(cookieAttributes.length===2&&cookieAttributes.every(c=>c.httpOnly&&c.sameSite==='Strict'&&c.persistent),'Persistent protected cookies');
  await capture(target,'remembered-researcher-directory');checks.push('checked_login_and_persistent_httponly_cookies');
  stage='browser_restart_remembered';await close();await launch();target=await page('/research');
  await wait(target,()=>document.querySelectorAll('.component-grid .card').length===3&&!document.querySelector('#username'));
  await profile(target,true);checks.push('real_browser_restart_preserves_remembered_session');
  await send('Network.deleteCookies',{name:'j26_research_access',url:'http://localhost:3001/api/v1/research-auth/profile'},target);
  await click(target,'.toolbar button');await wait(target,()=>!!document.querySelector('.component-grid')&&!document.querySelector('.toolbar button')?.disabled);
  await profile(target,true);checks.push('access_cookie_removal_renews_via_rotating_refresh');
  await click(target,'.account-trigger');await click(target,'a[role="menuitem"]');await wait(target,()=>!!document.querySelector('.account-profile'));
  assert(await evaluate(target,()=>!document.querySelector('a[href^="/admin"]')&&!document.querySelector('a[href="/"]')),'Researcher navigation escalates role');
  await capture(target,'researcher-account-profile');checks.push('authorized_profile_and_role_navigation');
  for(const path of ['/api/v1/admin/overview','/api/v1/review-queue']){const status=await evaluate(target,async path=>(await fetch(path)).status,path);assert([401,403].includes(status),'Cross-realm access allowed');checks.push({name:'cross_realm_denied',endpoint:path,status});}
  stage='other_staff_forms';
  for(const [path,role] of [['/admin/staff','ADMIN'],['/','COUNSELLOR']]){
    const staff=await page(path);await login(staff,{STAFF_USERNAME:env['DEV_'+role+'_USERNAME'],STAFF_PASSWORD:env['DEV_'+role+'_PASSWORD']});
    await signOut(staff);checks.push(role.toLowerCase()+'_unchecked_ui_login_logout');
  }
  stage='remembered_logout';await navigate(target,'/research');await wait(target,()=>!!document.querySelector('.component-grid'));await signOut(target);
  await close();await launch();target=await page('/research');await wait(target,()=>!!document.querySelector('#username'));
  assert(await evaluate(target,()=>!document.querySelector('.component-grid')),'Protected directory restored after logout');checks.push('logout_survives_actual_browser_restart');
  stage='unchecked_baseline';await login(target,credentials,false);const ordinary=await profile(target,false);assert(ordinary.remaining>3500&&ordinary.remaining<=3600,'Unchecked one-hour baseline changed');
  await close();await launch();target=await page('/research');await wait(target,()=>!!document.querySelector('.component-grid'));await profile(target,false);
  checks.push('unchecked_existing_one_hour_cookie_restart_behaviour_preserved');await signOut(target);
  stage='served_demo_mapping';
  const owner=await page('http://localhost:3000');
  await click(owner,'.consent-card > button');
  await wait(owner,()=>document.body.textContent.includes('owner session verified'));
  await navigate(owner,'http://localhost:3000/demo');await wait(owner,()=>document.querySelectorAll('[data-group]').length===6);
  const groups=await evaluate(owner,()=>[...document.querySelectorAll('[data-group]')].map(row=>({id:row.dataset.group,implementation:row.querySelector('td')?.textContent})));
  assert(groups.find(row=>row.id==='consent').implementation.includes('Notice approval pending'),'Consent approval conflated');
  assert(groups.find(row=>row.id==='identity').implementation.startsWith('Implemented'),'Logical separation downgraded');
  assert(groups.find(row=>row.id==='access').implementation.startsWith('Mixed'),'Access mixed status missing');
  assert(groups.find(row=>row.id==='routing').implementation.startsWith('Mixed'),'Integration mixed status missing');
  const mapping=[];
  for(const group of ['Consent and purpose','Pseudonymous identification','Authentication, roles and assignment','Controlled orchestration and provenance','Withdrawal and retention','Audit and accountability']){
    await click(owner,'button[aria-label="View evidence: '+group+'"]');await wait(owner,()=>!!document.querySelector('dialog[open]'));
    mapping.push(...await evaluate(owner,()=>[...document.querySelectorAll('[data-check]')].map(row=>({id:row.dataset.check,implementation:row.querySelector('dd')?.textContent,evidence:row.querySelector('[data-result]')?.textContent}))));
    await click(owner,'[data-dialog-close]');await wait(owner,()=>!document.querySelector('dialog[open]'));
  }
  await click(owner,'.evidence-tabs button:nth-child(2)');
  await click(owner,'main section.card:last-of-type button');await wait(owner,()=>!!document.querySelector('dialog[open]'));
  mapping.push(...await evaluate(owner,()=>[...document.querySelectorAll('[data-check]')].map(row=>({id:row.dataset.check,implementation:row.querySelector('dd')?.textContent,evidence:row.querySelector('[data-result]')?.textContent}))));
  assert(mapping.length===39&&new Set(mapping.map(row=>row.id)).size===39,'Every subcheck not inspected');
  assert(mapping.find(row=>row.id==='FR03.b').implementation==='Implemented'&&mapping.find(row=>row.id==='FR03.b').evidence==='Recorded test evidence','Identity evidence conflated');
  assert(mapping.find(row=>row.id==='NFR02.b').implementation==='Missing'&&mapping.find(row=>row.id==='NFR02.c').implementation==='Unverified','Encryption limitations hidden');
  await click(owner,'[data-dialog-close]');checks.push({name:'all_39_served_demo_subchecks_and_six_group_summaries',groups,mapping});
  const report={result:'PASS',browser:version,elapsed_seconds:(Date.now()-started)/1000,checks,cookieAttributes,screenshots,directory,limitations:['Actual restarts within configured lifetime; no seven-day natural wait.','Access-cookie deletion is controlled expiry simulation; signed access expiry and deadline equality covered by backend tests.','Unchecked already used persistent one-hour cookies; preserved intentionally.','No passwords, cookie values or network traces retained in report.']};
  await writeFile(join(directory,'report.json'),JSON.stringify(report,null,2));process.stdout.write(JSON.stringify(report)+'\n');
} catch {
  await writeFile(join(directory,'failure.json'),JSON.stringify({result:'FAIL',stage,checks,directory},null,2));process.stdout.write(JSON.stringify({result:'FAIL',stage,directory})+'\n');process.exitCode=1;
} finally {if(browser){try{await close();}catch{browser?.kill();}}}
