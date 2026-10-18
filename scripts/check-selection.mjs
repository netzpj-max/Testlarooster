import {chromium,browserOptions} from './browser-runtime.mjs';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const target=process.argv[2]||'http://127.0.0.1:4188/';
const isPublic=new URL(target).hostname!=='127.0.0.1';
const out=new URL('../artifacts/',import.meta.url);await mkdir(out,{recursive:true});
const browser=await chromium.launch(browserOptions());
const page=await browser.newPage({viewport:{width:1440,height:900}});
const errors=[],failures=[];page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>failures.push(r.url()));
try{
 await page.goto(target,{waitUntil:'networkidle'});await page.waitForFunction(()=>window.__game?.ready,{timeout:45000});
 assert.equal(await page.locator('h1').evaluate(el=>getComputedStyle(el).userSelect),'none');
 await page.keyboard.press('Control+a');assert.equal(await page.evaluate(()=>getSelection()?.toString()||''),'');
 const menuText=await page.locator('h1').boundingBox();await page.mouse.move(menuText.x+10,menuText.y+15);await page.mouse.down();await page.mouse.move(menuText.x+menuText.width-4,menuText.y+menuText.height-4,{steps:15});await page.mouse.up();assert.equal(await page.evaluate(()=>getSelection()?.toString()||''),'');
 await page.locator('[data-level="1"]').click();await page.locator('[data-action="start"]').click();
 const score=await page.locator('#score-value').boundingBox();await page.mouse.move(score.x+2,score.y+2);await page.mouse.down();await page.mouse.move(score.x+score.width+100,score.y+score.height+50,{steps:12});await page.mouse.up();assert.equal(await page.evaluate(()=>getSelection()?.toString()||''),'');
 await page.keyboard.press('Control+a');assert.equal(await page.evaluate(()=>getSelection()?.toString()||''),'');
 await page.keyboard.press('Escape');await page.locator('#pause-modal [data-action="settings"]').click();await page.locator('#setting-quality').selectOption('low');assert.equal(await page.locator('#setting-quality').inputValue(),'low');await page.locator('[data-action="close-settings"]').click();await page.locator('#pause-modal [data-action="menu"]').click();
 await page.waitForTimeout(300);const shot=isPublic?'public-game.png':'no-selection.png';await page.screenshot({path:fileURLToPath(new URL(shot,out))});
 const hashes={};for(const name of ['index.html','styles.css','src/game.js','src/simulation.js','src/graphics.js','src/thrusters.js','vendor/three/three.module.js']){
  const response=await page.request.get(new URL(name,target).href);assert.equal(response.status(),200);const remote=await response.body(),local=await readFile(new URL('../'+name,import.meta.url));
  const hash=b=>createHash('sha256').update(b).digest('hex');assert.equal(hash(remote),hash(local),`deployed bytes must match ${name}`);hashes[name]=hash(remote);
 }
 assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);
 const report={target,checks:['menu drag does not select text','HUD drag does not select text','Ctrl+A does not select page text','chapter buttons, pause, settings select and menu still work','WebGL game initializes','all checked deployed asset SHA-256 hashes match local files'],hashes,errors,failedRequests:failures,stats:await page.evaluate(()=>window.__game.stats)};
 await writeFile(new URL(isPublic?'public-pages-qa.json':'selection-qa.json',out),JSON.stringify(report,null,2));console.log(JSON.stringify({target,checks:report.checks,errors},null,2));
 await browser.close();
}catch(error){await page.screenshot({path:fileURLToPath(new URL('selection-check-failure.png',out))}).catch(()=>{});await browser.close();throw error;}
