import {Simulation,LEVELS,WORLD} from './simulation.js';
import {Graphics} from './graphics.js';
import {GameUI} from './ui.js';
import {GameAudio} from './audio.js';

const safeRead=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}};
const save=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));}catch{}};
const defaults={sound:true,reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches,quality:'high'};
let settings={...defaults,...safeRead('testla-settings',{})};
let best=safeRead('testla-best',{}),selected=0,mode='menu',fps=60,last=0,frameSamples=[],renderTime=0;
const sim=new Simulation(),audio=new GameAudio(),keys=new Set();let gfx;
const ui=new GameUI({levels:LEVELS,onStart:start,onRestart:()=>start(selected),onNext:()=>start((selected+1)%LEVELS.length),onMenu:menu,onPause:pause,onResume:resume,onSelectLevel:i=>{selected=i;},onSettings:s=>{settings={...settings,...s};audio.setEnabled(settings.sound);gfx?.settings(settings);save('testla-settings',settings);}});
ui.setSettings(settings);
function start(level){selected=Number.isInteger(level)?level:selected;sim.reset(selected);mode='playing';keys.clear();audio.init();audio.setEnabled(settings.sound);ui.selectLevel(selected);ui.setMode('playing');gfx?.setMode('playing');last=performance.now();
 const hints=['กด W เร่ง • Ctrl + A/D ดริฟต์ • ผ่านประตูไฟแล้วเก็บคะแนน','เลี้ยวเข้าทางลาดสูงฝั่งซ้าย • ปล่อยปุ่มแล้วรถช่วยกลับล้อ','ทางลาดฝั่งขวา → กด Q/E ค้างหมุนครบ 1 รอบ → ปล่อยให้ลงล้อ','ตรงไปทางลาดกลาง • ปล่อย W หลังทะยาน • Shift ช่วยพยุง','ต่อท่าทั้งสนาม • เก็บคะแนนแล้วกด R กลับมาตั้งเส้นทางได้'];
 ui.showEvent({type:'hint',label:hints[selected]});
}
function menu(){mode='menu';keys.clear();ui.setMode('menu');gfx?.setMode('menu');sim.reset(selected);last=performance.now();}
function pause(){if(mode!=='playing')return;mode='paused';keys.clear();ui.setMode('paused');}
function resume(){if(mode!=='paused')return;mode='playing';keys.clear();ui.setMode('playing');last=performance.now();}
function finish(s){mode='result';keys.clear();const previous=Number(best[selected]||0);if(s.status==='passed'&&s.score>previous){best[selected]=s.score;save('testla-best',best);}ui.showResult(s,Math.max(previous,s.status==='passed'?s.score:0));gfx.setMode('result');}
window.addEventListener('keydown',e=>{
 if(e.code==='Escape'){if(e.repeat||ui.settingsOpen)return;if(mode==='playing')pause();else if(mode==='paused')resume();return;}
 if(e.target instanceof HTMLInputElement||e.target instanceof HTMLSelectElement)return;
 if(mode==='playing'&&['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ControlLeft','ControlRight','Tab'].includes(e.code))e.preventDefault();
 keys.add(e.code);if(e.code==='KeyH'&&!e.repeat){audio.init();audio.honk();}
});
window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>{keys.clear();pause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();last=performance.now();});
const pressed=(...codes)=>codes.some(k=>keys.has(k));
function getInput(){
 const touch=ui.touchInput||{},air=sim.car.airborne;
 const throttle=(pressed('KeyW',...(!air?['ArrowUp']:[]))?1:0)-(pressed('KeyS',...(!air?['ArrowDown']:[]))?1:0);
 const steer=(pressed('KeyD','ArrowRight')?1:0)-(pressed('KeyA','ArrowLeft')?1:0);
 let pitch=air?(pressed('ArrowUp')?1:0)-(pressed('ArrowDown')?1:0):0;
 let roll=(pressed('KeyE')?1:0)-(pressed('KeyQ')?1:0);
 const pad=Array.from(navigator.getGamepads?.()||[]).find(p=>p?.connected&&p.mapping==='standard');let gpThrottle=0,gpSteer=0,gpPitch=0,gpRoll=0,gpBoost=false,gpJump=false,gpBrake=false;
 if(pad){const dead=v=>Math.abs(v)>.16?v:0;gpThrottle=(pad.buttons[7]?.value||0)-(pad.buttons[6]?.value||0);gpSteer=dead(pad.axes[0]||0);gpPitch=-dead(pad.axes[3]||0);gpRoll=dead(pad.axes[2]||0);gpBoost=!!pad.buttons[0]?.pressed;gpJump=!!pad.buttons[1]?.pressed;gpBrake=!!pad.buttons[2]?.pressed;}
 return {throttle:throttle||touch.throttle||gpThrottle,steer:steer||touch.steer||gpSteer,pitch:pitch||-(touch.pitch||0)||gpPitch,roll:roll||touch.roll||gpRoll,brake:pressed('ControlLeft','ControlRight','KeyB')||!!touch.brake||gpBrake,boost:pressed('ShiftLeft','ShiftRight')||!!touch.boost||gpBoost,jump:pressed('Space')||!!touch.jump||gpJump,reset:pressed('KeyR')||!!touch.reset};
}

try{
 gfx=new Graphics(document.querySelector('#game-canvas'),WORLD);gfx.settings(settings);audio.setEnabled(settings.sound);
 ui.ready();ui.setMode('menu');ui.selectLevel(0);
 window.addEventListener('resize',()=>gfx.resize());
 window.__game={get snapshot(){return sim.snapshot();},get mode(){return mode;},get stats(){return {fps:Math.round(fps),...gfx.stats(),frameSamples:frameSamples.length,renderer:'Three.js WebGL2',version:'1.1.0'};},get ready(){return true;},get levels(){return LEVELS.map(l=>({...l}));}};
 function frame(now){requestAnimationFrame(frame);if(!last)last=now;const raw=(now-last)/1000;last=now;const dt=Math.min(raw,.04);
  if(raw>0&&raw<.5){frameSamples.push(raw);if(frameSamples.length>120)frameSamples.shift();fps=frameSamples.length/frameSamples.reduce((a,b)=>a+b,0);}
  const input=getInput();let s=sim.snapshot();
  if(mode==='playing'){
   sim.update(dt,input);s=sim.snapshot();for(const event of sim.drainEvents()){ui.showEvent(event);audio.event(event);gfx.event(event,s);}if(s.status!=='playing')finish(s);
  }
  const visualDt=mode==='paused'?0:dt;gfx.render(visualDt,s,input);audio.update(s,input,mode);ui.update(s,fps);renderTime+=raw;
 }
 requestAnimationFrame(frame);
}catch(error){console.error(error);document.querySelector('#loading')?.setAttribute('hidden','');const el=document.querySelector('#error');if(el){el.hidden=false;el.innerHTML='<strong>เปิดสนาม 3D ไม่สำเร็จ</strong><p>เกมต้องใช้เบราว์เซอร์ที่รองรับ WebGL2 ลองเปิดด้วย Chrome หรือ Edge และเปิด Hardware Acceleration</p><button onclick="location.reload()">ลองอีกครั้ง</button>';}else document.body.innerHTML='<p>WebGL2 is required. Please open in Chrome or Edge.</p>';}
