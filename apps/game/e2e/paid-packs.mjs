// Development-only qualification. This injects test ownership through imported
// stores in an isolated Vite browser; it is NOT a real RevenueCat transaction.
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
const out=fileURLToPath(new URL('../../../artifacts/expansion/paid-pack-qa/',import.meta.url)); await mkdir(out,{recursive:true});
// A fresh server avoids injecting into a second copy of a store after Vite HMR.
const server=process.argv[2]?null:await createServer({root:fileURLToPath(new URL('../',import.meta.url)),server:{host:'127.0.0.1',port:0}});
if(server) await server.listen();
const address=server?.httpServer.address();
const base=process.argv[2]??`http://127.0.0.1:${address.port}`;
const browser=await chromium.launch({args:['--enable-unsafe-swiftshader']});
try {
  const page=await browser.newPage({viewport:{width:393,height:852}}); page.setDefaultTimeout(30000);
  const errors=[];page.on('pageerror',error=>errors.push(String(error)));
  await page.goto(`${base}/onboarding`); await page.getByRole('button',{name:'Start your career',exact:true}).waitFor();
  await page.evaluate(async()=>{
    const {useGameStore}=await import('/src/state/gameStore.ts');
    const {contentRegistry}=await import('/src/state/content.ts'); const registry=contentRegistry();
    await useGameStore.getState().startNewGame({seed:'paid-visual-qa',manager:{kind:'PREMADE',templateId:registry.managers()[0].id},club:{kind:'TEMPLATE',templateId:registry.clubs()[0].id}});
  });
  await page.goto(`${base}/club/3d`);
  await page.getByRole('button',{name:'Open interactive 3D',exact:true}).waitFor();
  await page.evaluate(async()=>{
    const {useCommerceStore}=await import('/src/commerce/store.ts'); const {useGameStore}=await import('/src/state/gameStore.ts');
    useCommerceStore.setState({owned:['cf_club_nights','cf_heritage_collection','cf_creator_stories']});
    useGameStore.getState().apply(state=>({...state,settings:{...state.settings,enabledPackIds:['club-nights','heritage-collection','creator-stories']}}));
  });
  await page.getByRole('button',{name:'Open interactive 3D',exact:true}).click();
  await page.locator('[data-model="campus"]').waitFor();
  const shot=async name=>{await page.getByTestId('model-viewer').scrollIntoViewIfNeeded();await page.waitForTimeout(500);await page.screenshot({path:resolve(out,`${name}.png`)});};
  for(const name of ['Floodlit','Sunset','Creator night']) {
    await page.getByRole('radio',{name,exact:true}).click();
    await page.locator(`[data-model="campus"][data-lighting="${name==='Creator night'?'creator':name.toLowerCase()}"]`).waitFor(); await shot(`campus-${name.toLowerCase().replaceAll(' ','-')}`);
  }
  await page.getByRole('radio',{name:'Daylight',exact:true}).click();
  await page.getByRole('radio',{name:'Kit',exact:true}).click();
  for(const pattern of ['sash','hoops','pinstripe']) {
    await page.getByRole('radio',{name:pattern,exact:true}).click(); await page.locator(`[data-model="kit-${pattern}"]`).waitFor(); await shot(`kit-${pattern}`);
  }
  await page.getByRole('radio',{name:'Trophy',exact:true}).click(); await page.locator('[data-model="trophy"]').waitFor(); await shot('trophy-gold');
  await page.getByRole('button',{name:'Use silver finish',exact:true}).click(); await page.getByRole('button',{name:'Use antique gold',exact:true}).waitFor(); await shot('trophy-silver');
  await page.evaluate(async()=>{const {useCommerceStore}=await import('/src/commerce/store.ts');useCommerceStore.setState({owned:[]});});
  await page.getByRole('button',{name:'Explore Club Nights',exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Use antique gold',exact:true}).count(),0);
  await page.locator('[data-model="trophy"][data-finish="bronze"]').waitFor();
  await page.locator('[data-testid="model-viewer"] canvas').evaluate(canvas=>canvas.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
  await page.getByText('3D is unavailable on this device right now.',{exact:false}).waitFor();
  await shot('context-loss-fallback');
  assert.deepEqual(errors,[]);
  await writeFile(resolve(out,'verification.json'),JSON.stringify({verification:'Injected test ownership in development only; no purchase or receipt',models:['campus','kit-sash','kit-hoops','kit-pinstripe','trophy'],lighting:['floodlit','sunset','creator'],revocation:'paid controls removed',errors},null,2));
  console.log('PASS: paid pack model imports, lighting, patterns, trophy finishes and revoked access fallback (mock ownership, not a transaction).');
} finally {await browser.close();if(server) await server.close();}
