import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';

// Isolated visual fixtures derive from a real career; each retains a valid save checksum.
const base=process.argv[2]??'http://127.0.0.1:5173', out=resolve('../../artifacts/media-repair-20260923');
const saved=JSON.parse(await readFile(`${out}/browser-state.json`,'utf8'));
const raw=saved.origins[0].localStorage.find(item=>item.name==='cf.save.v1').value;
const envelope=JSON.parse(raw.startsWith('cf:gzip:1:')?gunzipSync(Buffer.from(raw.slice(10),'base64')).toString():raw);
const browser=await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});
const errors=[], evidence=[];
function checksum(payload) {let h=2166136261;for(let i=0;i<payload.length;i++){h^=payload.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}return h.toString(36);}
async function fixture(name, modify, run, {brokenArt=false, viewport={width:393,height:852}}={}) {
  const env=structuredClone(envelope);modify(env.state);env.checksum=checksum(JSON.stringify(env.state));
  const state=structuredClone(saved);state.origins[0].origin=base;state.origins[0].localStorage.find(item=>item.name==='cf.save.v1').value=JSON.stringify(env);
  const context=await browser.newContext({storageState:state,viewport,isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  if(brokenArt) await context.route('**/art/premium/**',route=>route.abort());
  const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',error=>errors.push(`${name}: ${error}`));
  try {await run(page,env.state);evidence.push(name);} finally {await context.close();}
}
const go=async(page,path)=>{await page.goto(`${base}${path}`);await page.locator('main').waitFor();await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(200);};
const shot=async(page,name)=>page.screenshot({path:`${out}/${name}.png`});
try {
  await fixture('long names, injury, suspension, low fitness',s=>{
    s.settings.textSize='LARGE';const club=s.clubs[s.playerClubId],ids=Object.values(club.tactics.lineup).filter(Boolean);
    s.players[ids[0]].lastName='AlexandrovichMacAllister';s.players[ids[0]].displayName='Aleksander AlexandrovichMacAllister';
    s.players[ids[0]].injury={severity:'MINOR',weeksRemaining:2,description:'Ankle injury',sustainedCycle:s.clock.cycle};
    s.players[ids[1]].suspensionMatches=1;s.players[ids[2]].fitness=35;
  },async(page)=>{
    await go(page,'/squad/tactics');
    assert.ok(await page.locator('.cf-lineup-token').filter({hasText:'Injured'}).count()>0);
    assert.ok(await page.locator('.cf-lineup-token').filter({hasText:'Suspended'}).count()>0);
    const pitch=page.locator('.cf-tactic-pitch');await pitch.scrollIntoViewIfNeeded();
    const bounds=await pitch.evaluate(el=>{const p=el.getBoundingClientRect();return [...el.querySelectorAll('[data-drop-slot]')].every(t=>{const r=t.getBoundingClientRect();return r.bottom<=p.bottom&&r.top>=p.top&&r.left>=p.left&&r.right<=p.right;});});
    assert.equal(bounds,true,'long name tokens stay in pitch');await shot(page,'state-long-names-injury-suspension');
    await page.getByRole('button',{name:/Aleksander AlexandrovichMacAllister/}).click();await shot(page,'state-player-selection');
  },{viewport:{width:360,height:800}});
  await fixture('empty bench and social feed',s=>{s.clubs[s.playerClubId].tactics.bench=[];s.social.posts=[];},async(page)=>{
    await go(page,'/squad/tactics');await page.getByRole('heading',{name:'Match bench · 0',exact:true}).scrollIntoViewIfNeeded();await shot(page,'state-empty-bench');
    await go(page,'/social');assert.equal(await page.getByRole('button',{name:'See what actually happened',exact:true}).count(),0);await shot(page,'state-empty-social');
  });
  await fixture('failed images keep manager identity and navigation',()=>{},async(page)=>{
    await go(page,'/home');await page.getByTestId('premium-home').waitFor();
    await page.locator('.cf-character svg').waitFor();
    assert.ok(await page.locator('.cf-character svg').count()>0,'manager has deterministic vector fallback');
    assert.equal(await page.getByRole('button',{name:'Prepare Match',exact:true}).isEnabled(),true);await shot(page,'state-art-fallback');
  },{brokenArt:true});
  for(const [name,ours,theirs,headline,expression] of [['win',3,1,'Victory','celebrating'],['draw',2,2,'Honours even','focused'],['loss',1,3,'Defeat','disappointed']]) {
    await fixture(`result ${name}`,s=>{const r=s.latestMatchReport,home=r.homeClubId===s.playerClubId;r.homeScore=home?ours:theirs;r.awayScore=home?theirs:ours;r.winner=ours===theirs?'DRAW':r.homeScore>r.awayScore?'HOME':'AWAY';},async(page,s)=>{
      await go(page,`/matchday/result/${s.latestMatchReport.matchId}`);await page.getByRole('heading',{name:headline,exact:true}).waitFor();
      assert.ok((await page.locator('.cf-result-character img.cf-character').getAttribute('src')).includes(expression));
      const cycle=s.clock.cycle;
      await page.getByRole('tab',{name:'Analytics',exact:true}).click();await page.getByRole('tab',{name:'Report',exact:true}).click();
      await page.getByRole('button',{name:'View full report',exact:true}).click();await page.reload();await page.getByRole('heading',{name:headline,exact:true}).waitFor();
      const latest=await page.evaluate(()=>localStorage.getItem('cf.save.v1'));const st=JSON.parse(latest.startsWith('cf:gzip:1:')?gunzipSync(Buffer.from(latest.slice(10),'base64')).toString():latest).state;
      assert.equal(st.clock.cycle,cycle,'revisiting a completed result never advances again');await shot(page,`state-result-${name}`);
    });
  }
  await fixture('safe areas and reduced effects',s=>{s.settings.reducedEffects=true;s.settings.reducedMotion=true;s.settings.textSize='LARGE';},async(page)=>{
    await go(page,'/squad/tactics');await page.evaluate(()=>{document.documentElement.style.setProperty('--safe-top','47px');document.documentElement.style.setProperty('--safe-bottom','34px');});
    await page.getByRole('heading',{name:'Not selected',exact:false}).scrollIntoViewIfNeeded();await shot(page,'state-safe-area-large-text');
    const blur=await page.locator('.cf-edge-blur-layer').evaluateAll(els=>els.map(el=>{const style=getComputedStyle(el);return style.display==='none'||style.backdropFilter==='none';}));assert.ok(blur.every(Boolean),'reduced effects removes rendered blur layers');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  },{viewport:{width:390,height:844}});
  await fixture('tablet match preparation and rounded reputation',s=>{s.clubs[s.playerClubId].reputation=58.27349;},async(page)=>{
    for(const viewport of [{width:768,height:1024},{width:1024,height:1366}]) {
      await page.setViewportSize(viewport);await go(page,'/matchday');
      const board=page.locator('.cf-preview-lineup');await board.waitFor();await board.scrollIntoViewIfNeeded();
      const fits=await board.evaluate(el=>{const p=el.getBoundingClientRect();return [...el.querySelectorAll('[role="listitem"]')].every(item=>{const r=item.getBoundingClientRect();return r.left>=p.left&&r.right<=p.right&&r.top>=p.top&&r.bottom<=p.bottom&&item.scrollWidth<=item.clientWidth+1;});});
      assert.equal(fits,true,`${viewport.width} tablet lineup stays readable`);await shot(page,`tablet-matchday-${viewport.width}`);
    }
    await go(page,'/club/3d');const reputation=page.getByText('Reputation',{exact:true}).locator('..');assert.equal(await reputation.locator('strong').innerText(),'58');await shot(page,'tablet-stadium');
  },{viewport:{width:1024,height:1366}});
  assert.deepEqual(errors,[]);await writeFile(`${out}/states.json`,JSON.stringify({evidence,errors},null,2));
  console.log(`PASS ${evidence.length} isolated state fixtures: unavailable players, long names, empty states, art failure, three outcomes, result idempotence and reduced effects.`);
} finally {await browser.close();}
