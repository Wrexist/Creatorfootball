import { chromium } from 'playwright';
const BASE='http://127.0.0.1:4350', OUT='/tmp/shots3';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const c = await b.newContext({ viewport:{width:393,height:852}, deviceScaleFactor:2, isMobile:true, hasTouch:true });
const p = await c.newPage();
const shot = async n => { await p.waitForTimeout(1000); await p.screenshot({path:`${OUT}/${n}.png`}); console.log('SHOT', n); };
const fs = ()=>p.evaluate(()=>{const x=[...document.querySelectorAll('button')].pop();return{t:x?.innerText.trim().replace(/\n/g,' ')??'',d:Boolean(x?.disabled)};});
async function push(max=8){for(let i=0;i<max;i++){const s=await fs();
 if(!s.d){await p.locator('button').last().click();await p.waitForTimeout(1500);return s.t;}
 if(/name your club/i.test(s.t)){const q=await p.$$('input');await q[0].click();await q[0].type('Ironvale United',{delay:8});}
 else if(/city/i.test(s.t)){const q=await p.$$('input');const t=q[1]||q[0];await t.click();await t.type('Ironvale',{delay:8});}
 else if(/name/i.test(s.t)){const q=await p.$$('input');await q[0].click();await q[0].type('Isac Molin',{delay:10});}
 else if(/manager|archetype/i.test(s.t)){const x=p.getByRole('button',{name:/Vera|Tactician/i}).first(); if(await x.count()) await x.click();}
 else if(/club/i.test(s.t)){const x=p.locator('button').nth(3); if(await x.count()) await x.click();}
 else break; await p.waitForTimeout(700);} return null;}
await p.goto(BASE,{waitUntil:'networkidle'});
await p.getByRole('button',{name:/Start your career/i}).click(); await p.waitForTimeout(1400);
await push(); await push(); await push();
await p.goto(BASE+'/matchday',{waitUntil:'networkidle'}); await shot('01-preview');
const play = p.getByRole('button',{name:/^Play|Take charge/i}).first();
if(await play.count()){
  await play.click();
  await p.waitForTimeout(2200); await shot('02-intro');
  await p.waitForTimeout(4000); await shot('03-live-pitch');
  await p.waitForTimeout(9000); await shot('04-live-later');
  await p.waitForTimeout(12000); await shot('05-live-more');
}
await b.close();
