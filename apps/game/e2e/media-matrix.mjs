import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';

const base = process.argv[2] ?? 'http://127.0.0.1:5173';
const output = resolve('../../artifacts/media-repair-20260923');
const storage = JSON.parse(await readFile(`${output}/browser-state.json`, 'utf8'));
storage.origins[0].origin = base;
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const context = await browser.newContext({storageState:storage, viewport:{width:393,height:852},hasTouch:true,isMobile:true});
const page = await context.newPage();
page.setDefaultTimeout(15000);
const errors = [], checks = [];
page.on('pageerror',error => errors.push(String(error)));
const go = async path => { await page.goto(`${base}${path}`); await page.locator('main').waitFor(); await page.evaluate(() => document.fonts.ready); };
const capture = async name => { await page.waitForTimeout(180); await page.screenshot({path:`${output}/${name}.png`}); };
const getState = async () => { const raw = await page.evaluate(() => localStorage.getItem('cf.save.v1')); return JSON.parse(raw.startsWith('cf:gzip:1:') ? gunzipSync(Buffer.from(raw.slice(10),'base64')).toString() : raw).state; };
async function geometry(label) {
  const failures = await page.locator('.cf-tactic-pitch').evaluate(pitch => {
    const p = pitch.getBoundingClientRect();
    const tokens = [...pitch.querySelectorAll('[data-drop-slot]')].map(el => ({name:el.getAttribute('aria-label'),rect:el.getBoundingClientRect(),el}));
    const errors=[];
    for(const {name,rect:r,el} of tokens) {
      if(r.left < p.left || r.right > p.right || r.top < p.top || r.bottom > p.bottom) errors.push(`${name}: clipped at pitch edge`);
      if(el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1) errors.push(`${name}: token overflow`);
      if(r.width < 44 || r.height < 44) errors.push(`${name}: small touch target`);
    }
    for(let a=0;a<tokens.length;a++) for(let b=a+1;b<tokens.length;b++) {
      const x=tokens[a].rect,y=tokens[b].rect;
      if(Math.min(x.right,y.right)-Math.max(x.left,y.left)>1 && Math.min(x.bottom,y.bottom)-Math.max(x.top,y.top)>1) errors.push(`${tokens[a].name} overlaps ${tokens[b].name}`);
    }
    return errors;
  });
  assert.deepEqual(failures, [], label);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),false,`${label}: horizontal overflow`);
  checks.push(label);
}
try {
  for(const large of [false,true]) {
    await go('/settings');
    const toggle=page.getByRole('switch',{name:'Larger text',exact:true});
    if(await toggle.getAttribute('aria-checked') !== String(large)) await toggle.click();
    await go('/squad/tactics');
    for(const size of [7,11]) {
      await page.getByRole('button',{name:'Formation & instructions',exact:true}).click();
      await page.getByRole('radio',{name:`${size}-a-side`,exact:true}).click();
      const shapes = await page.getByRole('dialog').locator('button[aria-pressed]').evaluateAll(elements => elements.map(el => el.querySelector('span').textContent.trim()));
      await page.keyboard.press('Escape');
      for(const shape of shapes) {
        await page.getByRole('button',{name:'Formation & instructions',exact:true}).click();
        await page.getByRole('dialog').getByRole('button',{name:new RegExp(`^${shape}`)}).click();
        await page.keyboard.press('Escape');
        for(const viewport of [{width:360,height:800},{width:390,height:844},{width:393,height:852},{width:430,height:932},{width:768,height:1024}]) {
          await page.setViewportSize(viewport); await page.waitForTimeout(100);
          await geometry(`${shape}/${viewport.width}/${large?'large':'standard'}`);
        }
        if(shape === '2-3-1' || shape === '3-5-2') {
          await page.setViewportSize({width:393,height:852});
          await page.locator('.cf-tactic-pitch').scrollIntoViewIfNeeded();
          await capture(`matrix-tactics-${shape}-${large?'large':'standard'}`);
        }
      }
    }
  }
  await go('/squad/tactics');
  await page.getByRole('button',{name:'Formation & instructions',exact:true}).click();
  await page.getByRole('radio',{name:'7-a-side',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:/^2-3-1/}).click();
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Auto pick',exact:true}).click();
  const before=await getState();
  const pitch=page.locator('[data-drop-slot]');
  const slotA=await pitch.nth(0).getAttribute('data-drop-slot'), slotB=await pitch.nth(1).getAttribute('data-drop-slot');
  await pitch.nth(0).click(); await pitch.nth(1).click();
  await page.waitForTimeout(300);
  let state=await getState();
  assert.equal(state.clubs[state.playerClubId].tactics.lineup[slotB],before.clubs[before.playerClubId].tactics.lineup[slotA]);
  await pitch.nth(0).scrollIntoViewIfNeeded();
  const a=await pitch.nth(0).boundingBox(), b=await pitch.nth(1).boundingBox();
  const lineupBefore=JSON.stringify(state.clubs[state.playerClubId].tactics.lineup);
  await pitch.nth(0).dispatchEvent('pointerdown',{pointerType:'mouse',button:0,clientX:a.x+20,clientY:a.y+20});
  await page.evaluate(({x,y}) => window.dispatchEvent(new PointerEvent('pointermove',{clientX:x,clientY:y})),{x:b.x+20,y:b.y+20});
  await page.evaluate(() => window.dispatchEvent(new PointerEvent('pointercancel')));
  await page.waitForTimeout(400);
  state=await getState(); assert.equal(JSON.stringify(state.clubs[state.playerClubId].tactics.lineup),lineupBefore,'cancelled drag cannot commit');
  assert.equal(await pitch.nth(0).evaluate(el => el.style.transform),'');
  const club=state.clubs[state.playerClubId];
  const reserve=club.squad.find(id=>!club.tactics.bench.includes(id)&&!Object.values(club.tactics.lineup).includes(id));
  const substitute=club.tactics.bench[0];
  const playerButton=id=>page.getByRole('button',{name:new RegExp(`^${state.players[id].displayName.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')},`)});
  await playerButton(reserve).click();await playerButton(substitute).click();await page.waitForTimeout(350);
  state=await getState();assert.equal(state.clubs[state.playerClubId].tactics.bench.length,7);
  assert.equal(state.clubs[state.playerClubId].tactics.bench.includes(reserve),true,'reserve can replace a named substitute');
  assert.equal(state.clubs[state.playerClubId].tactics.bench.includes(substitute),false);
  const unchanged=JSON.stringify(state.clubs[state.playerClubId].tactics);
  const touchTarget=pitch.nth(2);await touchTarget.evaluate(el=>el.scrollIntoView({block:'center'}));await page.waitForTimeout(200);
  const touch=await touchTarget.boundingBox(), scroll=await page.locator('.cf-screen .scroll-y').evaluate(el=>el.scrollTop);
  const cdp=await context.newCDPSession(page);const point={x:touch.x+touch.width/2-8,y:touch.y+20};
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});
  for(let i=1;i<=8;i++) {await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:point.x,y:point.y-i*10}]});await page.waitForTimeout(20);}
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(350);
  assert.ok(await page.locator('.cf-screen .scroll-y').evaluate(el=>el.scrollTop)>scroll+10,'swiping a portrait scrolls the team sheet');
  state=await getState();assert.equal(JSON.stringify(state.clubs[state.playerClubId].tactics),unchanged,'scrolling cannot change the lineup');
  await go('/social');
  // A feed post can legitimately lack an event deep link. Test the author and
  // geometry of the rendered post itself, without requiring that optional CTA.
  const post=page.getByTestId('social-feed-post').first();
  await post.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500); const authorText=await post.innerText(), box=await post.boundingBox();
  for(let i=0;i<40;i++) { await page.waitForTimeout(250); assert.equal(await post.innerText(),authorText,'idle author stability'); assert.ok(Math.abs((await post.boundingBox()).height-box.height)<1,'idle post geometry'); }
  await capture('matrix-social-large');
  await go('/dev/gallery');
  const resultPost=page.locator('#cards article').filter({hasText:'@voltkid'}).first();
  await resultPost.scrollIntoViewIfNeeded(); await page.waitForTimeout(500);
  const postText=await resultPost.innerText(), postRect=await resultPost.boundingBox();
  for(let i=0;i<40;i++) { await page.waitForTimeout(250); assert.equal(await resultPost.innerText(),postText,'result SocialPost text remains stable'); assert.ok(Math.abs((await resultPost.boundingBox()).height-postRect.height)<1,'result SocialPost geometry'); }
  assert.deepEqual(errors,[]);
  await mkdir(output,{recursive:true});
  await writeFile(`${output}/matrix.json`,JSON.stringify({checks,errors},null,2));
  console.log(`PASS matrix: ${checks.length} formation/viewport/text combinations; tap swap, drag cancellation and 10-second post stability.`);
} finally { await browser.close(); }
