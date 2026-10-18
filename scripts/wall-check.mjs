import {chromium,browserOptions} from './browser-runtime.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
process.env.PORT='4189';await import('./serve.mjs');
const out=new URL('../artifacts/',import.meta.url);await mkdir(out,{recursive:true});
const browser=await chromium.launch(browserOptions());
const page=await browser.newPage({viewport:{width:1600,height:900},deviceScaleFactor:1});
const errors=[],checks=[],poses={};page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const snapshot=()=>page.evaluate(()=>window.__game.snapshot);
// Capture the frozen rendered scene unobstructed; only the pause dialog is hidden for this image.
const capture=name=>page.screenshot({path:fileURLToPath(new URL(name+'.png',out)),style:'#pause-modal{display:none!important}'});
const jets=()=>page.evaluate(()=>window.__game.stats.activeJets);
const pause=async()=>{await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>window.__game.mode),'paused');};
const resume=async()=>{await page.locator('[data-action="resume"]').click();};
try{
 await page.goto('http://127.0.0.1:4189/',{waitUntil:'networkidle'});await page.waitForFunction(()=>window.__game?.ready);
 await page.locator('[data-level="1"]').click();await page.locator('[data-action="start"]').click();await page.keyboard.down('w');
 // Real keyboard steering from the actual starting grid, using only public read-only telemetry.
 let held='';let entered=false;
 for(let n=0;n<300;n++){
  const s=await snapshot(),c=s.car;if(c.wallRide){entered=true;break;}
  assert.equal(s.status,'playing');const targetZ=c.z>0?-10:-180;
  const desired=Math.atan2(-(-28-c.x),-(targetZ-c.z));const error=Math.atan2(Math.sin(desired-c.yaw),Math.cos(desired-c.yaw));
  const next=error>.035?'a':error<-.035?'d':'';
  if(next!==held){if(held)await page.keyboard.up(held);if(next)await page.keyboard.down(next);held=next;}
  await page.waitForTimeout(30);
 }
 if(held)await page.keyboard.up(held);assert.equal(entered,true,'keyboard route must enter the wall');
 await page.waitForFunction(()=>{const c=window.__game.snapshot.car;return c.wallRide&&c.pitch>2.65||c.airborne&&c.vz>0&&c.roll>2.8;},{polling:'raf'});
 await pause();poses.inverted=await snapshot();await capture('wall-inverted');
 await resume();await page.keyboard.down('w');
 await page.waitForFunction(()=>{const c=window.__game.snapshot.car;return c.airborne&&c.vz>0;},{polling:'raf'});
 await pause();poses.release=await snapshot();assert.ok(poses.release.car.vz>15);assert.ok(Math.abs(poses.release.car.yaw-Math.PI)<.02);assert.ok(poses.release.car.roll>2.4);assert.equal(poses.release.objectives.wall,true);assert.equal(await page.evaluate(()=>window.__game.stats.cameraWallOccluded),false);await capture('wall-return');
 checks.push('actual keyboard wall run reaches inverted lip and leaves toward +Z / back toward approach');
 await resume();await page.keyboard.down('w');await page.waitForFunction(()=>window.__game.mode==='result',{timeout:20000});await page.keyboard.up('w');
 poses.landed=await snapshot();assert.equal(poses.landed.status,'passed');assert.equal(poses.landed.objectives.land,true);checks.push('inverted return recovers and lands without crashing; stage2 passes');
 await page.locator('#result-modal [data-action="menu"]').click();await page.locator('[data-level="2"]').click();await page.locator('[data-action="start"]').click();
 await page.keyboard.down('Space');await page.waitForFunction(()=>window.__game.snapshot.car.airborne&&window.__game.snapshot.car.jetLift>.6,{polling:'raf'});await page.waitForTimeout(65);await pause();await page.keyboard.up('Space');
 poses.jump=await snapshot();const jumpJets=await jets();assert.ok(jumpJets.filter(j=>j.id.startsWith('lift-')&&j.direction[1]<-.99).length===4);await capture('jump-jets');checks.push('Space jump renders four real underbody plumes without Shift');
 await resume();await page.keyboard.down('e');await page.waitForTimeout(130);await pause();await page.keyboard.up('e');
 poses.e=await snapshot();assert.ok(poses.e.car.jetRoll>.9);const eJets=await jets();assert.ok(eJets.some(j=>j.id==='lift-1--1'&&j.strength>.9));assert.ok(eJets.some(j=>j.id==='roof--1--1'&&j.strength>.9));await capture('roll-e-jets');
 await resume();await page.keyboard.down('q');await page.waitForTimeout(130);await pause();await page.keyboard.up('q');
 poses.q=await snapshot();assert.ok(poses.q.car.jetRoll<-.9);const qJets=await jets();assert.ok(qJets.some(j=>j.id==='lift--1--1'&&j.strength>.9));assert.ok(qJets.some(j=>j.id==='roof-1--1'&&j.strength>.9));await capture('roll-q-jets');checks.push('Q/E select opposite underbody/roof port pairs with rotating chassis directions');
 assert.deepEqual(errors,[]);
 const report={timestamp:new Date().toISOString(),transport:'actual HTTP server',checks,poses:Object.fromEntries(Object.entries(poses).map(([k,s])=>[k,{car:s.car,status:s.status,objectives:s.objectives,score:s.score}])),jumpJets,eJets,qJets,errors};
 await writeFile(new URL('wall-jets-report.json',out),JSON.stringify(report,null,2));console.log(JSON.stringify({checks,errors,wallScore:poses.landed.score},null,2));
 await browser.close();process.exit(0);
}catch(error){console.error(error);console.error(JSON.stringify({last:await snapshot().catch(()=>null),errors},null,2));await capture('wall-check-failure').catch(()=>{});await browser.close();process.exit(1);}
