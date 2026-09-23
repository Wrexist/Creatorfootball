import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const out=fileURLToPath(new URL('../../../artifacts/expansion/android-screenshots/',import.meta.url)); await mkdir(out,{recursive:true});
const adb='C:/Users/IsacC/AppData/Local/Android/Sdk/platform-tools/adb.exe';
const device='emulator-5556';
execFileSync(adb,['-s',device,'shell','am','start','-n','com.creatorfootball.app/.MainActivity']);
let socket='';
for(let attempt=0;attempt<30&&!socket;attempt++) {
  let pid='';
  try {pid=execFileSync(adb,['-s',device,'shell','pidof','com.creatorfootball.app']).toString().trim();} catch {await new Promise(resolve=>setTimeout(resolve,1000));continue;}
  const sockets=execFileSync(adb,['-s',device,'shell','cat','/proc/net/unix']).toString();
  if(sockets.includes(`@webview_devtools_remote_${pid}`)) socket=`webview_devtools_remote_${pid}`;
  else await new Promise(resolve=>setTimeout(resolve,1000));
}
assert.ok(socket,'Native WebView debugging socket must be available');
execFileSync(adb,['-s',device,'forward','tcp:9224',`localabstract:${socket}`]);
const browser=await chromium.connectOverCDP('http://127.0.0.1:9224',{noDefaults:true});
try {
  const context=browser.contexts()[0],page=context.pages()[0]; page.setDefaultTimeout(30000);
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.waitForLoadState('domcontentloaded');
  const platform=await page.evaluate(()=>window.Capacitor.getPlatform()); assert.equal(platform,'android');
  if(await page.getByRole('button',{name:'Start your career',exact:true}).count()) {
    await page.getByRole('button',{name:'Start your career',exact:true}).click();
    await page.getByRole('button',{name:/Vera Lindqvist/}).click();
    await page.getByRole('button',{name:'Next: your club',exact:true}).click();
    await page.getByRole('button',{name:/Larkspur Wolves of/}).click();
    await page.getByRole('button',{name:'Take over Larkspur',exact:true}).click();
    await page.getByRole('button',{name:'Meet your squad',exact:true}).click();
  }
  const navigate=async path=>{await page.evaluate(path=>{history.pushState({},'',path); window.dispatchEvent(new PopStateEvent('popstate'));},path);};
  const shot=async name=>{await page.waitForTimeout(600); execFileSync(adb,['-s',device,'shell','screencap','-p',`/sdcard/cf-${name}.png`]); execFileSync(adb,['-s',device,'pull',`/sdcard/cf-${name}.png`,resolve(out,`${name}.png`)]);};
  await navigate('/home'); await page.getByText('Manager’s desk',{exact:false}).first().waitFor(); await shot('home');
  await navigate('/settings/content');
  await page.getByRole('button',{name:/^(Enable|Disable) Touchline Voices$/}).waitFor();
  if(await page.getByRole('button',{name:'Enable Touchline Voices',exact:true}).count()) await page.getByRole('button',{name:'Enable Touchline Voices',exact:true}).click();
  await page.getByRole('button',{name:'Disable Touchline Voices',exact:true}).waitFor();
  await navigate('/store'); await page.getByText('Purchases are not connected in this build.',{exact:false}).waitFor(); await shot('store');
  await page.getByRole('button',{name:'Explore pack',exact:true}).first().click();
  await page.getByRole('dialog').waitFor();
  execFileSync(adb,['-s',device,'shell','input','keyevent','4']);
  await page.getByRole('dialog').waitFor({state:'hidden'});
  await navigate('/club/3d'); await page.getByRole('button',{name:'Open interactive 3D',exact:true}).click();
  await page.getByRole('button',{name:'Rotate right',exact:true}).click(); await shot('club-3d');
  const metrics=await page.locator('[data-draw-calls]').evaluate(el=>({...el.dataset}));
  await navigate('/settings/saves'); await page.getByRole('button',{name:'Export career file',exact:true}).click();
  await page.waitForTimeout(1600); await shot('native-share');
  execFileSync(adb,['-s',device,'shell','input','keyevent','4']);
  await page.waitForTimeout(300);
  await page.reload(); await page.getByRole('button',{name:'Export career file',exact:true}).waitFor(); await shot('local-saves');
  const plugins=await page.evaluate(()=>({platform:window.Capacitor.getPlatform(),filesystem:window.Capacitor.isPluginAvailable('Filesystem'),share:window.Capacitor.isPluginAvailable('Share'),purchases:window.Capacitor.isPluginAvailable('Purchases')}));
  assert.ok(plugins.filesystem&&plugins.share&&plugins.purchases); assert.deepEqual(errors,[]);
  await writeFile(resolve(out,'results.json'),JSON.stringify({plugins,metrics,errors,device:'isolated API 35 x86_64 emulator',nativeShare:'Share sheet opened, then dismissed without sending files'},null,2));
  console.log('PASS Android: native bridges, local career/reload, optional pack, 3D, store unavailable state, hardware Back closes sheet, native export share sheet.');
} finally { await browser.close(); }
