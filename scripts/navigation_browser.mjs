/* global document, window, HTMLInputElement, Event, Buffer, fetch, WebSocket, setTimeout, clearTimeout */
// Real client navigation: compare document, header and sidebar identity without payload logs.
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";

const directory = resolve('.local', 'c1-navigation-browser-' + randomUUID());
await mkdir(directory, {recursive:true});
const started = Date.now(), checks = [], screenshots = [];
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
async function capture(target,name) {
  assert(await evaluate(target,()=>![...document.querySelectorAll('input[name="username"],input[name="password"],input[type="password"]')].some(input=>input.value)),'Credential fields not empty');
  const {data}=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true},target);await writeFile(join(directory,name+'.png'),Buffer.from(data,'base64'));screenshots.push(name+'.png');
}

async function mark(target,student=false) {
  await evaluate(target,student=>{
    window.__navigationProbe={header:document.querySelector(student?'.student-application > .app-nav':'.staff-topbar'),sidebar:document.querySelector('.staff-sidebar'),origin:window.performance.timeOrigin,requests:[],completedReads:0};
    const original=window.fetch;
    window.fetch=async(...args)=>{
      const path=String(args[0]);
      if(window.__slowNavigation&&path.startsWith('/api/v1/'))await new Promise(resolve=>setTimeout(resolve,350));
      const response=await original(...args);
      if(path.startsWith('/api/v1/'))window.__navigationProbe.requests.push({path:new URL(path,window.location.origin).pathname,status:response.status});
      if(path.includes('/review-queue?')&&path.includes('state=COMPLETED'))window.__navigationProbe.completedReads++;
      return response;
    };
  },student);
}
async function stable(target,name,student=false) {
  const result=await evaluate(target,student=>{
    const p=window.__navigationProbe;
    return{sameDocument:!!p&&p.origin===window.performance.timeOrigin,sameHeader:!!p&&p.header===document.querySelector(student?'.student-application > .app-nav':'.staff-topbar'),sameSidebar:student||!!p&&p.sidebar===document.querySelector('.staff-sidebar')};
  },student);
  assert(result.sameDocument&&result.sameHeader&&result.sameSidebar,'Layout or document replaced');checks.push({name,...result});
}
async function staffReady(target,title) {
  await wait(target,title=>document.querySelector('main h1')?.textContent===title&&!!document.querySelector('.account-trigger:not(:disabled)'),title);
}
async function move(target,path,title) {
  stage='admin_'+path;await click(target,'.staff-sidebar a[href="'+path+'"]');await staffReady(target,title);await stable(target,path);
}
try {
  const parse=text=>Object.fromEntries(text.split(/\r?\n/).filter(line=>line.includes('=')&&!line.startsWith('#')).map(line=>{const i=line.indexOf('=');return[line.slice(0,i),line.slice(i+1)];}));
  const env=parse(await readFile('.env','utf8'));
  const version=await launch();const admin=await page('/admin/overview');stage='admin_login';
  await login(admin,{STAFF_USERNAME:env.DEV_ADMIN_USERNAME,STAFF_PASSWORD:env.DEV_ADMIN_PASSWORD});await staffReady(admin,'Administration overview');
  await mark(admin);await capture(admin,'admin-persistent-layout');
  await move(admin,'/admin/staff','Staff and roles');
  await move(admin,'/admin/assignments','Case assignments');
  await move(admin,'/admin','Operational evidence');
  await move(admin,'/admin/operations','Workflow and services');
  await move(admin,'/admin/retention','Retention overview');
  stage='back_forward';await evaluate(admin,()=>window.history.back());await staffReady(admin,'Workflow and services');await stable(admin,'browser_back');
  await evaluate(admin,()=>window.history.forward());await staffReady(admin,'Retention overview');await stable(admin,'browser_forward');
  stage='workspace_brand';await click(admin,'.app-nav .brand');await staffReady(admin,'Administration overview');await stable(admin,'brand_returns_to_current_workspace');
  stage='slow_navigation';await evaluate(admin,()=>{window.__slowNavigation=true;});await click(admin,'.staff-sidebar a[href="/admin/staff"]');
  await wait(admin,()=>document.body.textContent.includes('Checking administrative access')&&!!document.querySelector('.staff-sidebar'));
  await stable(admin,'same_shell_while_authorization_is_pending');await staffReady(admin,'Staff and roles');await evaluate(admin,()=>{window.__slowNavigation=false;});
  await stable(admin,'same_shell_after_fresh_authorized_read');
  stage='mobile_drawer_navigation';await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true},admin);
  await click(admin,'.drawer-toggle');await wait(admin,()=>!!document.querySelector('dialog[open]'));
  await click(admin,'dialog[open] a[href="/admin/retention"]');await staffReady(admin,'Retention overview');
  await wait(admin,()=>!document.querySelector('dialog[open]'));await stable(admin,'mobile_drawer_route_closes_and_preserves_shell');await capture(admin,'mobile-persistent-navigation');
  stage='keyboard_navigation';await send('Emulation.setDeviceMetricsOverride',{width:1600,height:1000,deviceScaleFactor:1,mobile:false},admin);
  await send('Page.bringToFront',{},admin);await evaluate(admin,()=>document.querySelector('.staff-sidebar a[href="/admin"]').focus());
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r'},admin);await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13},admin);
  await staffReady(admin,'Operational evidence');await stable(admin,'keyboard_enter_client_navigation');
  stage='profile_menu_navigation';await click(admin,'.account-trigger');await click(admin,'a[role="menuitem"]');await staffReady(admin,'Account profile');await wait(admin,()=>!!document.querySelector('.profile-grid'));await stable(admin,'admin_profile_link');
  await click(admin,'main .profile-actions a');await staffReady(admin,'Administration overview');await stable(admin,'admin_profile_return');
  stage='admin_logout_back';await signOut(admin);await wait(admin,()=>!!document.querySelector('#username'));
  await evaluate(admin,()=>window.history.back());await wait(admin,()=>document.querySelector('main h1')?.textContent==='Account profile'&&!document.querySelector('.profile-grid'));
  assert(await evaluate(admin,()=>!document.querySelector('.staff-sidebar')&&!document.querySelector('.account-trigger')),'Logout/back restored protected shell');
  assert(await evaluate(admin,()=>window.__navigationProbe.origin===window.performance.timeOrigin),'Logout replaced document');checks.push('logout_and_history_do_not_restore_protected_profile_or_navigation');
  stage='counsellor_query_navigation';const counsellor=await page('/');
  await login(counsellor,{STAFF_USERNAME:env.DEV_COUNSELLOR_USERNAME,STAFF_PASSWORD:env.DEV_COUNSELLOR_PASSWORD});await staffReady(counsellor,'Case workspace');await mark(counsellor);
  await click(counsellor,'.staff-sidebar a[href="/?state=COMPLETED"]');
  await wait(counsellor,()=>window.location.search==='?state=COMPLETED'&&document.querySelector('#queue-filter')?.value==='COMPLETED'&&!document.querySelector('.account-trigger')?.disabled);
  await stable(counsellor,'completed_reviews_query_navigation');assert(await evaluate(counsellor,()=>window.__navigationProbe.completedReads>0),'Completed filter not requested');
  await click(counsellor,'.staff-sidebar a[href="/"]');await wait(counsellor,()=>window.location.search===''&&document.querySelector('#queue-filter')?.value===''&&!document.querySelector('.account-trigger')?.disabled);await stable(counsellor,'assigned_cases_query_navigation');
  await signOut(counsellor);
  if(process.argv.includes('--staff-file')){
    stage='researcher_navigation';const credentials=parse(await readFile(process.argv[process.argv.indexOf('--staff-file')+1],'utf8'));
    assert(credentials.STAFF_ROLE==='RESEARCHER','Researcher fixture required');const research=await page('/research');await login(research,credentials,true);await staffReady(research,'Component directory');await mark(research);
    await click(research,'.staff-sidebar a[href="/account?workspace=research"]');await staffReady(research,'Account profile');await wait(research,()=>!!document.querySelector('.profile-grid'));await stable(research,'researcher_profile');
    assert(await evaluate(research,()=>!document.querySelector('a[href^="/admin"]')&&!document.querySelector('.staff-sidebar a[href="/"]')),'Researcher role navigation expanded');
    await click(research,'main .profile-actions a');await staffReady(research,'Component directory');await stable(research,'researcher_profile_return');await signOut(research);
  }
  stage='student_navigation';const student=await page('http://localhost:3000');await mark(student,true);await click(student,'.consent-card > button');await wait(student,()=>document.body.textContent.includes('owner session verified'));
  await click(student,'.app-nav a[href="/demo"]');await wait(student,()=>document.querySelectorAll('[data-group]').length===6&&document.body.textContent.includes('Connected'));
  await stable(student,'student_to_demo',true);await capture(student,'student-persistent-navigation');
  await click(student,'.app-nav a[href="/"]');await wait(student,()=>!!document.querySelector('.consent-card'));await stable(student,'demo_to_student',true);
  await evaluate(student,()=>window.history.back());await wait(student,()=>document.querySelectorAll('[data-group]').length===6);await stable(student,'student_browser_back',true);
  const report={result:'PASS',browser:version,elapsed_seconds:(Date.now()-started)/1000,checks,screenshots,directory,limitations:['Client navigation within each application; cross-origin links and deliberate new-tab links remain normal navigation.','No patient data, training, institutional approval or production deployment tested.','Student page controls remain in memory and are not cached across routes; use the existing two-tab walkthrough to retain those controls.']};
  await writeFile(join(directory,'report.json'),JSON.stringify(report,null,2));process.stdout.write(JSON.stringify(report)+'\n');
} catch {
  await writeFile(join(directory,'failure.json'),JSON.stringify({result:'FAIL',stage,checks,directory},null,2));process.stdout.write(JSON.stringify({result:'FAIL',stage,directory})+'\n');process.exitCode=1;
} finally {if(browser){try{await close();}catch{browser?.kill();}}}
