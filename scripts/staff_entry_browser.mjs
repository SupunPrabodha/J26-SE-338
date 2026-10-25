/* global document, window, HTMLInputElement, Event, Buffer, fetch, WebSocket, setTimeout, clearTimeout */
// Staff entry/profile visual and access checks; never capture credentials or response bodies.
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";

const directory = resolve('.local', 'c1-staff-entry-browser-' + randomUUID());
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


async function viewport(target,width,height) {
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<761},target);
}
async function layout(target,name,requireSubmit=false) {
  const state=await evaluate(target,()=>{
    const button=document.querySelector('.signin-submit');const r=button?.getBoundingClientRect();
    return{noOverflow:document.documentElement.scrollWidth<=window.innerWidth+1,submitVisible:!!r&&r.top>=0&&r.bottom<=window.innerHeight,formWidth:Math.round(document.querySelector('.signin-layout')?.getBoundingClientRect().width||0),viewport:window.innerWidth};
  });
  assert(state.noOverflow,'Horizontal overflow');if(requireSubmit)assert(state.submitVisible,'Sign-in action below desktop viewport');
  checks.push({name,...state});
}
try {
  assert(process.argv.includes('--staff-file'),'Existing private researcher file required');
  const parse=text=>Object.fromEntries(text.split(/\r?\n/).filter(line=>line.includes('=')&&!line.startsWith('#')).map(line=>{const index=line.indexOf('=');return[line.slice(0,index),line.slice(index+1)];}));
  const credentials=parse(await readFile(process.argv[process.argv.indexOf('--staff-file')+1],'utf8'));
  assert(credentials.STAFF_ROLE==='RESEARCHER','Researcher fixture required');
  const version=await launch();
  stage='research_entry';const researcher=await page('/research');await wait(researcher,()=>!!document.querySelector('.signin-submit'));
  await viewport(researcher,1440,900);await layout(researcher,'research_signin_desktop',true);await capture(researcher,'research-signin-desktop');
  await viewport(researcher,390,844);await layout(researcher,'research_signin_mobile');await capture(researcher,'research-signin-mobile');
  stage='profile_recovery';const recovery=await page('/account?workspace=research');
  await wait(recovery,()=>!!document.querySelector('.profile-access-state'));
  await layout(recovery,'profile_recovery_desktop');await capture(recovery,'profile-recovery-desktop');
  await viewport(recovery,390,844);await layout(recovery,'profile_recovery_mobile');await capture(recovery,'profile-recovery-mobile');
  assert(await evaluate(recovery,()=>document.querySelector('.profile-access-state a')?.getAttribute('href')==='/research'&&!document.querySelector('.profile-grid')),'Recovery role/link boundary');
  stage='counsellor_entry';const reviewer=await page('/?state=COMPLETED');await wait(reviewer,()=>!!document.querySelector('.signin-submit'));
  await viewport(reviewer,1440,900);await layout(reviewer,'completed_signin_desktop',true);await capture(reviewer,'completed-signin-desktop');
  // Demonstrate wrong-role handling using the existing synthetic researcher, without granting access.
  await evaluate(reviewer,credentials=>{for(const [selector,value] of [['#username',credentials.STAFF_USERNAME],['#password',credentials.STAFF_PASSWORD]]){const e=document.querySelector(selector);Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,value);e.dispatchEvent(new Event('input',{bubbles:true}));}},credentials);
  await click(reviewer,'.signin-submit');await wait(reviewer,()=>!!document.querySelector('.sign-in [role="alert"]'));
  assert(await evaluate(reviewer,()=>!document.querySelector('.account-trigger')&&!document.querySelector('.review-grid')&&document.querySelector('.sign-in form')?.getAttribute('aria-describedby')==='staff-signin-error'),'Wrong-role content/error boundary');
  await capture(reviewer,'completed-wrong-role-inline');checks.push({name:'wrong_role_denied_error_inside_form',passed:true});
  stage='researcher_directory';await viewport(researcher,1440,900);await login(researcher,credentials);
  await wait(researcher,()=>document.querySelectorAll('.directory-card').length===3);
  await layout(researcher,'directory_desktop');await capture(researcher,'directory-desktop');
  await evaluate(researcher,()=>{window.__entryFrame={header:document.querySelector('.staff-topbar'),sidebar:document.querySelector('.staff-sidebar'),origin:window.performance.timeOrigin};});
  stage='researcher_profile';await click(researcher,'.account-trigger');await click(researcher,'.account-dropdown a[role="menuitem"]');
  await wait(researcher,()=>!!document.querySelector('.profile-grid')&&!document.querySelector('.account-trigger:disabled'));
  assert(await evaluate(researcher,()=>{const p=window.__entryFrame;return!!p&&p.origin===window.performance.timeOrigin&&p.header===document.querySelector('.staff-topbar')&&p.sidebar===document.querySelector('.staff-sidebar');}),'Persistent profile navigation');
  await layout(researcher,'profile_authorized_desktop');await capture(researcher,'profile-authorized-desktop');
  await viewport(researcher,390,844);await layout(researcher,'profile_authorized_mobile');await capture(researcher,'profile-authorized-mobile');
  await click(researcher,'.profile-actions a');await wait(researcher,()=>document.querySelectorAll('.directory-card').length===3);
  await layout(researcher,'directory_mobile');await capture(researcher,'directory-mobile');
  await click(researcher,'button[aria-label="Provider metadata C3"]');await wait(researcher,()=>!!document.querySelector('dialog[open]'));
  await layout(researcher,'provider_dialog_mobile');await capture(researcher,'provider-dialog-mobile');
  await click(researcher,'[data-dialog-close]');await signOut(researcher);
  assert(await evaluate(researcher,()=>!document.querySelector('.directory-card')&&!document.querySelector('.account-trigger')),'Logout clears protected directory');
  checks.push({name:'researcher_login_profile_metadata_dialog_logout_and_persistent_chrome',passed:true});
  const report={result:'PASS',browser:version,elapsed_seconds:(Date.now()-started)/1000,checks,screenshots,directory,limitations:['Synthetic existing researcher authentication; no account/role changes.','No natural token-expiry wait, clinical or usability study.','Images are local ignored artifacts; credential fields were checked empty before every capture.']};
  await writeFile(join(directory,'report.json'),JSON.stringify(report,null,2));process.stdout.write(JSON.stringify(report)+'\n');
} catch {
  await writeFile(join(directory,'failure.json'),JSON.stringify({result:'FAIL',stage,checks,directory},null,2));process.stdout.write(JSON.stringify({result:'FAIL',stage,checks,directory})+'\n');process.exitCode=1;
} finally {if(browser){try{await close();}catch{browser?.kill();}}}
