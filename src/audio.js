export class GameAudio {
 constructor(){this.enabled=true;this.ctx=null;this.ready=false;this.mode='menu';}
 init(){if(this.ctx){this.ctx.resume();return;}const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;try{
  this.ctx=new Audio();this.master=this.ctx.createGain();this.master.gain.value=this.enabled?.2:0;this.master.connect(this.ctx.destination);
  this.engine=this.ctx.createOscillator();this.engine.type='sawtooth';this.engine.frequency.value=45;
  const filter=this.ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=350;this.engineGain=this.ctx.createGain();this.engineGain.gain.value=0;this.engine.connect(filter).connect(this.engineGain).connect(this.master);this.engine.start();
  const len=this.ctx.sampleRate*2,buffer=this.ctx.createBuffer(1,len,this.ctx.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<len;i++)data[i]=Math.random()*2-1;
  this.noise=this.ctx.createBufferSource();this.noise.buffer=buffer;this.noise.loop=true;this.noiseFilter=this.ctx.createBiquadFilter();this.noiseFilter.type='bandpass';this.noiseFilter.frequency.value=750;this.windGain=this.ctx.createGain();this.windGain.gain.value=0;this.noise.connect(this.noiseFilter).connect(this.windGain).connect(this.master);this.noise.start();this.ready=true;
 }catch{this.ready=false;}}
 setEnabled(value){this.enabled=value;if(this.master)this.master.gain.setTargetAtTime(value?.2:0,this.ctx.currentTime,.1);}
 update(s,input,mode){if(!this.ready)return;const t=this.ctx.currentTime,playing=mode==='playing',v=Math.abs(s.car.speed);this.engine.frequency.setTargetAtTime(42+v*3.4+(input.boost?25:0),t,.1);this.engineGain.gain.setTargetAtTime(playing?.045+v*.001:0,t,.1);this.windGain.gain.setTargetAtTime(playing?(input.boost?.18:input.brake&&v>8?.12:v*.00065):0,t,.1);this.noiseFilter.frequency.setTargetAtTime(input.brake?1700:input.boost?420:650,t,.1);}
 tone(freq,time=.1,delay=0,type='sine',gain=.2,endFreq){if(!this.ready||!this.enabled)return;const t=this.ctx.currentTime+delay,o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);if(endFreq)o.frequency.exponentialRampToValueAtTime(endFreq,t+time);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(gain,t+.01);g.gain.exponentialRampToValueAtTime(.001,t+time);o.connect(g).connect(this.master);o.start(t);o.stop(t+time+.02);}
 event(e){if(e.type==='bank'){[440,554,659].forEach((f,i)=>this.tone(f,.22,i*.055,'sine',.17));}else if(e.type==='trick')this.tone(250,.055,0,'triangle',.1,500);else if(e.type==='crash'){this.tone(120,.45,0,'sawtooth',.18,25);this.honk(.22);}else if(e.type==='finish'){[330,440,554,659,880].forEach((f,i)=>this.tone(f,.3,i*.08,'triangle',.14));}}
 honk(delay=0){[[520,.12,0,650],[700,.11,.13,800],[640,.12,.25,740],[880,.42,.38,420]].forEach(([f,d,t,end])=>this.tone(f,d,t+delay,'triangle',.26,end));}
}
