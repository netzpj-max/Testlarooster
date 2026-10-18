const crest = `<svg class="rooster-crest" viewBox="0 0 42 50" aria-hidden="true"><path d="M7 44V29c0-8 5-14 13-15l-3-9 8 3 5-7 3 13 8 7-9 5v18H21V29l-6 9v6z"/><circle cx="27" cy="19" r="1.6" fill="#182016"/><path d="M7 31L1 25l7-1M3 46h31" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>`;
const arrow = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15M13 5l7 7-7 7"/></svg>`;
const soundIcon = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4zM16 8c3 2 3 6 0 8M19 5c5 4 5 10 0 14"/></svg>`;
const mutedIcon = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4zM17 9l5 6m0-6-5 6"/></svg>`;
const settingsIcon = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 17h16M8 4v6M16 14v6"/></svg>`;
const pauseIcon = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5v14M15 5v14" stroke-width="3"/></svg>`;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number = value => Math.max(0,Math.round(Number(value)||0)).toLocaleString('en-US');

export class GameUI {
  constructor(options = {}) {
    this.callbacks = options;
    this.levels = options.levels || [];
    this.selected = 0;
    this.mode = 'menu';
    this.settings = { sound: true, reducedMotion: false, quality: 'high' };
    this._touch = { throttle:0, steer:0, brake:0, boost:0, pitch:0, roll:0, jump:0, reset:0 };
    this.pointers = new Map();
    this.lastSnapshot = null;
    this.toastUntil = 0;
    this.root = document.getElementById('ui-root');
    this.root.innerHTML = this.markup();
    this.$ = selector => this.root.querySelector(selector);
    this.bind();
    this.selectLevel(0, false);
    this.setMode('menu');
    this.setSettings(this.settings);
  }

  markup() {
    return `<section class="menu-screen" id="menu-screen" aria-label="เมนูหลัก">
      <div class="hero"><div class="eyebrow">THE MOST UNNECESSARY HYPERCAR EVER.</div>
        <h1><span>TESTLA</span><span class="outline">ROOSTER</span></h1>
        <p class="tagline">FLIGHT IS A SIDE EFFECT.</p><p class="thai-tagline">ขับให้ไก่ดู บินให้โลกงง</p>
        <div class="hero-actions"><button class="primary-button" data-action="start">START ENGINE ${arrow}</button><button class="text-button" data-action="help"><span class="keycap">?</span> HOW TO ROOSTER</button></div>
        <p class="hero-note" id="menu-route">5 CHAPTERS / QUESTIONABLE PHYSICS / ZERO FLIGHT LICENSE</p>
      </div>
      <div class="car-annotation"><span class="marker">R–01 / EXPERIMENTAL</span><span class="spec">100% ELECTRIC. 200% CHICKEN.</span></div>
      <div class="chapter-deck"><div class="deck-header"><strong>SELECT YOUR BAD IDEA</strong><span><em id="chapter-count">01</em> / 05 &nbsp; CHAPTERS</span></div>
        <div class="chapter-list">${this.levels.map((level,i)=>`<button class="chapter-card" data-level="${i}" aria-pressed="false"><span class="chapter-num">CHAPTER ${String(i+1).padStart(2,'0')} <i>${['↗','↻','⤾','✧','⚑'][i]||'↗'}</i></span><h3>${esc(level.title)}</h3><p>${esc(level.subtitle || `${number(level.target)} PTS · ${level.duration} SEC`)}</p></button>`).join('')}</div>
        <div class="menu-footer"><span>A PARODY DRIVING EXPERIENCE. &nbsp; NO AFFILIATION WITH TESLA.</span><span class="footer-accent">BUILT FOR BAD DECISIONS &nbsp; ↗</span></div>
      </div>
    </section>
    <header class="topbar" id="menu-topbar"><button class="brand" data-action="menu" aria-label="Testla Rooster เมนูหลัก">${crest}<span class="brand-name">TESTLA<span>ROOSTER</span><small>EXPERIMENTAL DIVISION</small></span></button><div class="top-actions"><div class="edition">STUNT DRIVING EXPERIENCE<br><b>VOL. 01 — THE FIRST FLIGHT</b></div><button class="icon-button sound-toggle" data-action="sound" aria-label="ปิดเสียง">${soundIcon}</button><button class="icon-button" data-action="settings" aria-label="ตั้งค่า">${settingsIcon}</button></div></header>
    <section class="hud" id="hud" aria-label="ข้อมูลการขับรถ" hidden>
      <header class="topbar"><div class="hud-title" id="hud-chapter">CHAPTER 01<b>TESTLA ROOSTER</b></div><div class="top-actions"><button class="icon-button sound-toggle" data-action="sound" aria-label="ปิดเสียง">${soundIcon}</button><button class="icon-button" data-action="pause" aria-label="พักเกม">${pauseIcon}</button></div></header>
      <div class="hud-score"><div class="hud-label">BANKED SCORE</div><div class="score-number" id="score-value">0</div><div class="score-target" id="score-target">TARGET —</div><div class="score-track"><span id="score-progress"></span></div></div>
      <div class="objective-panel"><div class="timer" id="timer"><small>TIME REMAINING</small><span id="timer-value">00:00</span></div><div class="objectives" id="objectives"></div></div>
      <div class="flight-state" id="flight-state" hidden>AIRBORNE / NO LICENSE</div>
      <div class="combo-panel" id="combo-panel"><div class="combo-multiplier" id="combo-multiplier">1× COMBO</div><div class="combo-score" id="combo-score">+0</div><div class="combo-label">LAND IT. BANK IT. TRY NOT TO EGG IT.</div></div>
      <div class="trick-feed" id="trick-feed" aria-live="polite"></div>
      <div class="boost-panel"><div class="boost-heading"><span>ROOST BOOST</span><span id="boost-value">100%</span></div><div class="boost-track"><span class="boost-fill" id="boost-fill"></span></div><p>FEATHER-POWERED PERFORMANCE</p></div>
      <div class="speedometer"><div class="speed-number" id="speed-value">0</div><div class="speed-unit">KM/H &nbsp; / &nbsp; CHICKEN VELOCITY</div><div class="drive-status" id="drive-status">GROUND CONTROL</div></div>
      <div class="keys-hint"><span><kbd>W A S D</kbd> DRIVE</span><span><kbd>CTRL</kbd> DRIFT</span><span><kbd>SHIFT</kbd> BOOST</span><span><kbd>SPACE</kbd> JUMP</span><span><kbd>↑ ↓</kbd> PITCH</span><span><kbd>Q E</kbd> ROLL</span><span><kbd>R</kbd> RESET</span></div>
      <div class="touch-controls" aria-label="ปุ่มควบคุมสัมผัส"><div class="touch-flight"><button class="touch-button" data-touch="pitch:-1" aria-label="เชิดหัว">↥</button><button class="touch-button" data-touch="pitch:1" aria-label="ก้มหัว">↧</button><button class="touch-button" data-touch="roll:-1" aria-label="หมุนซ้าย">↶</button><button class="touch-button" data-touch="roll:1" aria-label="หมุนขวา">↷</button><button class="touch-button" data-touch="reset:1" aria-label="กลับจุดเริ่มต้น">⟲</button></div><div class="touch-group left"><button class="touch-button" data-touch="steer:-1" aria-label="เลี้ยวซ้าย">‹</button><button class="touch-button" data-touch="steer:1" aria-label="เลี้ยวขวา">›</button><button class="touch-button small reverse" data-touch="throttle:-1" aria-label="ถอยหลัง">REV</button></div><div class="touch-auto">TOUCH TO TAKE OFF</div><div class="touch-group right"><div class="touch-stack"><button class="touch-button small" data-touch="jump:1" aria-label="กระโดด">JUMP</button><button class="touch-button small" data-touch="brake:1" aria-label="เบรก">BRAKE</button></div><button class="touch-button boost" data-touch="boost:1" aria-label="บูสต์">BOOST</button><button class="touch-button throttle" data-touch="throttle:1" aria-label="เร่ง">↑</button></div></div>
    </section>
    <section class="modal-backdrop" id="pause-modal" hidden><div class="dialog" role="dialog" aria-modal="true" aria-labelledby="pause-title"><div class="eyebrow">CHICKEN ON A BREAK</div><h2 id="pause-title">พักก่อน เดี๋ยวค่อยบิน</h2><p class="dialog-intro">รถยังอยู่ ไข่ยังไม่แตก คะแนนยังไม่หาย<br>พร้อมแล้วกลับไปสร้างเรื่องต่อได้เลย</p><div class="dialog-buttons"><button class="primary-button" data-action="resume">RESUME ${arrow}</button><button class="secondary-button" data-action="restart">เริ่มด่านใหม่</button><button class="secondary-button" data-action="menu">เมนูหลัก</button></div><button class="text-button" data-action="settings">ตั้งค่า / วิธีเล่น ↗</button></div></section>
    <section class="modal-backdrop" id="result-modal" hidden><div class="dialog result-dialog" role="dialog" aria-modal="true" aria-labelledby="result-title"><div class="eyebrow" id="result-eyebrow">FLIGHT REPORT</div><h2 id="result-title">WELL ROOSTED.</h2><p class="dialog-intro" id="result-caption"></p><div class="result-stars" id="result-stars" aria-label="ดาวที่ได้รับ"></div><div class="result-score" id="result-score">0<small>BANKED SCORE</small></div><div class="result-stats"><div><small>TARGET SCORE</small><span id="result-target">0</span></div><div><small>PERSONAL BEST</small><span id="result-best">0</span></div></div><div class="dialog-buttons"><button class="primary-button" data-action="next" id="next-button">NEXT CHAPTER ${arrow}</button><button class="secondary-button" data-action="restart">บินอีกรอบ ↻</button></div><button class="result-menu" data-action="menu">BACK TO GARAGE ↗</button></div></section>
    <section class="modal-backdrop" id="settings-modal" hidden><div class="dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title"><button class="dialog-close" data-action="close-settings" aria-label="ปิด">×</button><div class="eyebrow">THE PILOT'S HANDBOOK</div><h2 id="settings-title">ไม่มีใบขับขี่การบิน?<br>ไม่เป็นไร เราก็ไม่มี</h2><p class="dialog-intro">ต่อท่าเพื่อสะสมคอมโบ ลงล้ออย่างปลอดภัยเพื่อเก็บคะแนน<br>ผ่านเป้าคะแนนและทำภารกิจประจำด่านให้ครบ</p><div class="control-grid"><div class="control-row"><span>เร่ง / ถอย / เลี้ยว</span><kbd>W A S D</kbd></div><div class="control-row"><span>บูสต์ / พ่นลมขณะบิน</span><kbd>SHIFT</kbd></div><div class="control-row"><span>กระโดด / บิน</span><kbd>SPACE</kbd></div><div class="control-row"><span>เบรกมือ / ดริฟต์</span><kbd>CTRL / B</kbd></div><div class="control-row"><span>บิน: เชิด / ก้มหัว</span><kbd>↑ ↓</kbd></div><div class="control-row"><span>บิน: หมุน / หัน</span><kbd>Q E / A D</kbd></div><div class="control-row"><span>กลับจุดเริ่มต้น</span><kbd>R</kbd></div><div class="control-row"><span>พักเกม</span><kbd>ESC</kbd></div></div><div class="settings-divider">GAMEPAD / จอยคอนโทรลเลอร์</div><p class="gamepad-note">RT เร่ง · LT ถอย · สติ๊กซ้ายเลี้ยว<br>สติ๊กขวาเชิด / ก้ม / หมุน · A บูสต์ · B กระโดด · X เบรก</p><div class="settings-divider">COCKPIT SETTINGS</div><label class="setting-row"><span>เสียงเครื่องยนต์และเอฟเฟกต์</span><input type="checkbox" id="setting-sound" checked aria-label="เปิดเสียง" /></label><label class="setting-row"><span>ลดการสั่นกล้อง<small>เหมาะกับผู้ไวต่อการเคลื่อนไหว</small></span><input type="checkbox" id="setting-motion" aria-label="ลดการเคลื่อนไหว" /></label><label class="setting-row"><span>คุณภาพภาพ</span><select id="setting-quality" aria-label="คุณภาพภาพ"><option value="high">สูง / HIGH</option><option value="low">ประหยัด / LOW</option></select></label><p class="help-note">ท่าซ้ำได้คะแนนลดลง ลองดริฟต์ + บิน + หมุนต่อกันเพื่อคอมโบที่สูงขึ้น<br>มือถือ: ใช้ปุ่มสัมผัสด้านล่าง แนะนำให้เล่นแนวนอน</p></div></section>`;
  }

  bind() {
    this.root.addEventListener('click', event => {
      const button = event.target.closest('button');
      if (!button) return;
      if (button.dataset.level !== undefined) { this.selectLevel(Number(button.dataset.level)); return; }
      const action = button.dataset.action;
      if (!action) return;
      if (action === 'sound') { this.changeSettings({sound:!this.settings.sound}); return; }
      if (action === 'settings' || action === 'help') { this.openSettings(); return; }
      if (action === 'close-settings') { this.closeSettings(); return; }
      if (action === 'start') this.callbacks.onStart?.(this.selected);
      if (action === 'restart') this.callbacks.onRestart?.();
      if (action === 'next') this.callbacks.onNext?.();
      if (action === 'menu') this.callbacks.onMenu?.();
      if (action === 'pause') this.callbacks.onPause?.();
      if (action === 'resume') this.callbacks.onResume?.();
    });
    this.$('#setting-sound').addEventListener('change', e => this.changeSettings({sound:e.target.checked}));
    this.$('#setting-motion').addEventListener('change', e => this.changeSettings({reducedMotion:e.target.checked}));
    this.$('#setting-quality').addEventListener('change', e => this.changeSettings({quality:e.target.value}));
    for (const button of this.root.querySelectorAll('[data-touch]')) {
      button.addEventListener('pointerdown', event => {
        event.preventDefault();
        button.setPointerCapture(event.pointerId);
        this.pointers.set(event.pointerId,{button,touch:button.dataset.touch});
        button.classList.add('active');
        this.updateTouch();
      });
      const release = event => { event.preventDefault(); this.pointers.delete(event.pointerId); button.classList.remove('active'); this.updateTouch(); };
      button.addEventListener('pointerup',release);
      button.addEventListener('pointercancel',release);
      button.addEventListener('lostpointercapture',release);
      button.addEventListener('contextmenu',event=>event.preventDefault());
    }
    window.addEventListener('blur',()=>this.clearTouch());
    document.addEventListener('keydown',event=> {
      if (event.code === 'Escape' && !this.$('#settings-modal').hidden) {
        event.preventDefault();event.stopImmediatePropagation();this.closeSettings();
      }
    },true);
  }

  updateTouch() {
    Object.keys(this._touch).forEach(key=>this._touch[key]=0);
    for (const {touch} of this.pointers.values()) { const [key,value]=touch.split(':');this._touch[key] += Number(value); }
    Object.keys(this._touch).forEach(key=>this._touch[key]=Math.max(-1,Math.min(1,this._touch[key])));
  }
  clearTouch() { this.pointers.clear();this.updateTouch();this.root.querySelectorAll('.touch-button.active').forEach(button=>button.classList.remove('active')); }
  get touchInput() { return this._touch; }

  ready() {
    const loading = document.getElementById('loading');
    if (!loading) return;
    loading.classList.add('complete');
    setTimeout(()=>loading.hidden=true,450);
  }

  setMode(mode) {
    this.mode = mode;
    document.body.dataset.mode = mode;
    const isMenu = mode === 'menu';
    this.$('#menu-screen').hidden = !isMenu;
    this.$('#menu-topbar').hidden = !isMenu;
    this.$('#hud').hidden = isMenu || mode === 'result';
    this.$('#pause-modal').hidden = mode !== 'paused';
    this.$('#result-modal').hidden = mode !== 'result';
    this.$('#settings-modal').hidden = true;
    this.settingsOpen = false;
    this.clearTouch();
    if (isMenu) this.$('[data-action="start"]').focus({preventScroll:true});
    if (mode === 'paused') this.$('[data-action="resume"]').focus({preventScroll:true});
    if (mode === 'playing') this.$('#trick-feed').innerHTML = '';
  }

  selectLevel(index, notify=true) {
    this.selected = Math.max(0,Math.min(this.levels.length-1,Number(index)||0));
    this.root.querySelectorAll('[data-level]').forEach(button=> {
      const active = Number(button.dataset.level) === this.selected;
      button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));
    });
    this.$('#chapter-count').textContent = String(this.selected+1).padStart(2,'0');
    const routes=['ผ่านประตูสีเขียวด้านหน้า • กด CTRL เข้าโค้งเพื่อดริฟต์','เล็งทางลาดโค้งด้านซ้าย • เกาะกลับหัวแล้วปล่อยตัว','มุ่งทางลาดด้านขวา • Q / E หมุนข้ามรถบรรทุก','พุ่งขึ้นทางลาดกลาง • SHIFT พ่นลมผ่านห่วงทั้ง 3 วง','รวมทุกท่า • ลงแท่นวงกลมปลายสนามให้โลกจำ'];
    const level=this.levels[this.selected];
    if (level) this.$('#menu-route').textContent=`${routes[this.selected]||level.subtitle}  /  ${number(level.target)} PTS`;
    if (notify) this.callbacks.onSelectLevel?.(this.selected);
  }

  update(snapshot, fps) {
    if (!snapshot) return;
    this.lastSnapshot = snapshot;
    const car=snapshot.car || {};
    const level = this.levels[snapshot.levelIndex ?? this.selected] || {};
    this.$('#hud-chapter').innerHTML = `CHAPTER ${String((snapshot.levelIndex ?? this.selected)+1).padStart(2,'0')}<b>${esc(level.title||'TESTLA ROOSTER')}</b>`;
    this.$('#score-value').textContent = number(snapshot.score);
    this.$('#score-target').textContent = `TARGET ${number(level.target)} PTS`;
    this.$('#score-progress').style.width = `${Math.min(100,(snapshot.score||0)/(level.target||1)*100)}%`;
    const seconds=Math.max(0,Math.ceil(snapshot.timeLeft||0));
    this.$('#timer-value').textContent=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
    this.$('#timer').classList.toggle('urgent',seconds<=15);
    const objectives=snapshot.objectives || {};
    const objectiveHTML=(level.objectives||[]).map(objective=> {
      const value=objectives[objective.id];
      const complete=typeof value==='object' && value!==null ? Boolean(value.complete ?? value.completed ?? value.done) : Boolean(value);
      return `<div class="objective${complete?' complete':''}">${esc(objective.label)}</div>`;
    }).join('');
    if (this.$('#objectives').innerHTML !== objectiveHTML) this.$('#objectives').innerHTML=objectiveHTML;
    this.$('#speed-value').textContent=number((car.speed||0)*3.6);
    this.$('#boost-value').textContent=`${number(car.boost ?? 100)}%`;
    this.$('#boost-fill').style.transform=`scaleX(${Math.max(0,Math.min(1,(car.boost??100)/100))})`;
    this.$('#drive-status').textContent=car.wallRide?'WALLRIDE / CHICKEN GRIP':car.airborne?'FLIGHT MODE / CLUCK & PRAY':'GROUND CONTROL';
    this.$('#flight-state').hidden=!car.airborne&&!car.wallRide;
    this.$('#flight-state').textContent=car.wallRide?'WALLRIDE / DEFYING COMMON SENSE':'AIRBORNE / NO LICENSE';
    const pending=Number(snapshot.pending)||0;
    this.$('#combo-panel').classList.toggle('visible',pending>0);
    this.$('#combo-score').textContent=`+${number(pending)}`;
    this.$('#combo-multiplier').textContent=`${Number(snapshot.multiplier||1).toFixed(1).replace('.0','')}× COMBO`;
    if (this.toastUntil && performance.now()>this.toastUntil) {
      this.$('#trick-feed').querySelector('.trick-toast')?.classList.add('fade');
      this.toastUntil=0;
    }
  }

  showEvent(event) {
    if (!event) return;
    const title=typeof event==='string'?event:event.label||event.text||event.name||event.title||({crash:'ไข่แตก! เริ่มคอมโบใหม่',bank:'ลงล้อสวย เก็บคะแนน!',boost:'แรงม้าไม่พอ ขอแรงไก่'}[event.type])||'';
    if (!title) return;
    const points=Number(event.points ?? event.score ?? 0);
    this.$('#trick-feed').innerHTML=`<div class="trick-toast">${esc(title)}${points?`<small>+${number(points)}</small>`:''}</div>${event.caption?`<div class="trick-caption">${esc(event.caption)}</div>`:''}`;
    this.toastUntil=performance.now()+2400;
  }

  showResult(snapshot, best) {
    const level=this.levels[snapshot.levelIndex ?? this.selected]||{};
    const passed=snapshot.status==='passed'||snapshot.passed===true;
    const score=Number(snapshot.score)||0;
    const bestScore=typeof best==='number'?best:Number(best?.score ?? best?.best ?? 0);
    const stars=passed ? Math.min(3,score>=(level.target||1)*2?3:score>=(level.target||1)*1.4?2:1):0;
    this.$('#result-eyebrow').textContent=`CHAPTER ${String((snapshot.levelIndex??this.selected)+1).padStart(2,'0')} / FLIGHT REPORT`;
    this.$('#result-title').textContent=passed?'WELL ROOSTED.':'EGG HAPPENS.';
    this.$('#result-caption').textContent=passed?'ลงล้อแล้ว โลกยังงงอยู่ แต่คุณผ่านแล้ว':'อีกนิดเดียว ลองต่อคอมโบแล้วลงล้อให้สำเร็จ';
    this.$('#result-stars').innerHTML=[0,1,2].map(i=>`<span class="${i<stars?'earned':''}">★</span>`).join('');
    this.$('#result-stars').setAttribute('aria-label',`${stars} จาก 3 ดาว`);
    this.$('#result-score').innerHTML=`${number(score)}<small>BANKED SCORE</small>`;
    this.$('#result-target').textContent=number(level.target);
    this.$('#result-best').textContent=number(bestScore);
    const isLast=(snapshot.levelIndex??this.selected)>=this.levels.length-1;
    this.$('#next-button').hidden=!passed||isLast;
    this.setMode('result');
    this.$(passed&&!isLast?'#next-button':'#result-modal [data-action="restart"]').focus({preventScroll:true});
  }

  setSettings(settings) {
    Object.assign(this.settings,settings);
    this.$('#setting-sound').checked=Boolean(this.settings.sound);
    this.$('#setting-motion').checked=Boolean(this.settings.reducedMotion);
    this.$('#setting-quality').value=this.settings.quality;
    document.body.classList.toggle('reduced-motion',Boolean(this.settings.reducedMotion));
    this.root.querySelectorAll('.sound-toggle').forEach(button=> {
      button.innerHTML=this.settings.sound?soundIcon:mutedIcon;
      button.setAttribute('aria-label',this.settings.sound?'ปิดเสียง':'เปิดเสียง');
      button.setAttribute('aria-pressed',String(this.settings.sound));
    });
  }
  changeSettings(changes) { this.setSettings(changes);this.callbacks.onSettings?.({...this.settings}); }
  openSettings() {
    this.modeBeforeSettings=this.mode;
    if (this.mode==='playing') this.callbacks.onPause?.();
    this.settingsOpen=true;
    this.$('#settings-modal').hidden=false;
    this.$('#settings-modal .dialog-close').focus({preventScroll:true});
  }
  closeSettings() {
    this.$('#settings-modal').hidden=true;this.settingsOpen=false;
    if (this.modeBeforeSettings==='playing') this.callbacks.onResume?.();
  }
}
