/**
 * LUMINA PARTY v4 — app.js
 * Fixes: responsive layout, data collision prevention,
 *        volume-based brightness engine, help modal,
 *        proper packet sequencing, connection cleanup.
 */
'use strict';

// ═══════════════════════ SINGLE STATE OBJECT ════════════════════════
// All state in one place — prevents variable collision
const LP = {
  // Network
  peer: null,
  conns: [],          // { conn, id, color, lastSeen }
  myId: 0,
  pktId: 0,
  lastRxId: -1,
  isHost: false,

  // UI state
  tab: 'console',
  effect: 'none',
  audioMode: 'spectrum',
  isFlashOn: false,
  manualTrig: null,   // string | null
  flashDecay: 0,      // 0-1 beat flash decay

  // Audio
  ordo: null,
  audioOn: false,
  bpm: 0,

  // Smoothed audio values — updated only in onAudioFrame
  audio: {
    bass: 0, mid: 0, high: 0,
    lufs: 0, centroid: 0.5,
    rms: 0,            // raw RMS 0-1 for volume brightness
    excitement: 0,
  },

  // Rendering
  frame: 0,
  lastBcast: 0,
  deviceListDirty: false,
};

// ═══════════════════════ PALETTE ════════════════════════════════════
const SWATCHES = [
  '#ff0000','#ff3300','#ff6600','#ff9900','#ffdd00','#ffff00',
  '#aaff00','#00ff00','#00ff66','#00ffcc','#00ccff','#0088ff',
  '#0044ff','#4400ff','#8800ff','#cc00ff','#ff00cc','#ff0055',
  '#ff8888','#88ff88','#8888ff','#ffffff','#ffaa44','#44ffcc',
];

// ═══════════════════════ DOM BOOT ═══════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  buildPalette();
  bindFaders();
  bindFxGrid();
  bindAmGrid();
  bindTabs();
  bindSliders();
  bindHelpTabs();
  drawWheel();
  landingCanvas();
  updateFaderUI();
});

// ═══════════════════════ LANDING CANVAS ════════════════════════════
function landingCanvas() {
  const c = document.getElementById('landing-canvas');
  if (!c) return;
  const ctx = c.getContext('2d');
  let pts = [];

  const resize = () => { c.width = innerWidth; c.height = innerHeight; };
  resize();
  window.addEventListener('resize', resize);

  for (let i = 0; i < 65; i++) {
    pts.push({ x: Math.random(), y: Math.random(), vx: (Math.random()-.5)*.003, vy: (Math.random()-.5)*.003, h: Math.random()*360 });
  }

  (function tick() {
    if (!document.getElementById('view-landing').classList.contains('active')) return;
    ctx.fillStyle = 'rgba(0,0,0,0.07)';
    ctx.fillRect(0, 0, c.width, c.height);
    pts.forEach(p => {
      p.x = (p.x + p.vx + 1) % 1;
      p.y = (p.y + p.vy + 1) % 1;
      p.h = (p.h + .4) % 360;
      ctx.beginPath();
      ctx.arc(p.x * c.width, p.y * c.height, 1.5, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${p.h},100%,70%,0.55)`;
      ctx.fill();
    });
    requestAnimationFrame(tick);
  })();
}

// ═══════════════════════ VIEWS ══════════════════════════════════════
function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function showJoin() {
  const p = document.getElementById('join-panel');
  p.classList.toggle('open');
  if (p.classList.contains('open')) {
    setTimeout(() => document.getElementById('join-id')?.focus(), 100);
  }
}

// ═══════════════════════ HELP MODAL ═════════════════════════════════
function openHelp() {
  document.getElementById('help-modal').removeAttribute('hidden');
}
function closeHelp() {
  document.getElementById('help-modal').setAttribute('hidden', '');
}
// Close on backdrop click
document.getElementById('help-modal').addEventListener('click', e => {
  if (e.target === document.getElementById('help-modal')) closeHelp();
});
// Close on Escape
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeHelp();
});

function bindHelpTabs() {
  document.querySelectorAll('.help-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.htab;
      document.querySelectorAll('.help-tab').forEach(b => b.classList.toggle('active', b === btn));
      document.querySelectorAll('.help-section').forEach(s => s.classList.toggle('active', s.id === `hs-${tab}`));
    });
  });
}

// ═══════════════════════ PALETTE ════════════════════════════════════
function buildPalette() {
  const row = document.getElementById('palette');
  if (!row) return;
  SWATCHES.forEach(hex => {
    const btn = document.createElement('button');
    btn.className = 'swatch';
    btn.style.background = hex;
    btn.title = hex;
    btn.setAttribute('aria-label', `Color ${hex}`);
    btn.addEventListener('click', () => pickColor(hex));
    row.appendChild(btn);
  });
}

function pickColor(hex) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  gE('val-r').value = r;
  gE('val-g').value = g;
  gE('val-b').value = b;
  updateFaderUI();
}

// ═══════════════════════ FADERS ═════════════════════════════════════
function bindFaders() {
  ['val-r','val-g','val-b','val-w','val-master'].forEach(id => {
    gE(id)?.addEventListener('input', updateFaderUI);
  });
}

function updateFaderUI() {
  const r = +gV('val-r'), g = +gV('val-g'), b = +gV('val-b'), w = +gV('val-w'), m = +gV('val-master');
  sT('r-o', r);   sT('g-o', g);
  sT('b-o', b);   sT('w-o', w);
  sT('m-o', Math.round(m*100)+'%');
  const pr = gE('color-preview');
  if (pr) pr.style.background = `rgb(${~~(r*m)},${~~(g*m)},${~~(b*m)})`;
}

// ═══════════════════════ FX GRID ════════════════════════════════════
function bindFxGrid() {
  document.querySelectorAll('#fx-grid .fx').forEach(btn => {
    btn.addEventListener('click', () => {
      LP.effect = btn.dataset.fx;
      document.querySelectorAll('#fx-grid .fx').forEach(b => b.classList.toggle('active', b === btn));
    });
  });
}

// ═══════════════════════ AUDIO MODES ════════════════════════════════
function bindAmGrid() {
  document.querySelectorAll('#am-grid .am').forEach(btn => {
    btn.addEventListener('click', () => {
      LP.audioMode = btn.dataset.am;
      document.querySelectorAll('#am-grid .am').forEach(b => b.classList.toggle('active', b === btn));
    });
  });
}

// ═══════════════════════ TABS ════════════════════════════════════════
function bindTabs() {
  document.querySelectorAll('.tb-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      LP.tab = btn.dataset.tab;
      document.querySelectorAll('.tb-tab').forEach(b => b.classList.toggle('active', b === btn));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      gE(`tab-${btn.dataset.tab}`)?.classList.add('active');
    });
  });
}

// ═══════════════════════ SLIDERS ════════════════════════════════════
function bindSliders() {
  const map = [
    ['fx-speed',    'fx-spd-o',    v => v],
    ['fx-intensity','fx-int-o',    v => v+'%'],
    ['bass-sens',   'bass-s-o',    v => v+'%'],
    ['flash-thresh','flash-t-o',   v => v+'%'],
    ['flash-decay', 'decay-o',     v => v+'ms'],
    ['flash-speed', 'flash-spd-o', v => v+' Hz'],
    ['flash-duty',  'flash-duty-o',v => v+'%'],
  ];
  map.forEach(([id, oid, fmt]) => {
    const el = gE(id);
    if (el) el.addEventListener('input', () => sT(oid, fmt(el.value)));
  });
}

// ═══════════════════════ VOLUME BRIGHTNESS ════════════════════════=


// Applies brightness to an RGB hex string

// ═══════════════════════ HSL WHEEL ══════════════════════════════════
function drawWheel() {
  const c = gE('hsl-wheel');
  if (!c) return;
  const ctx = c.getContext('2d');
  const cx = c.width/2, cy = c.height/2, R = cx-2;

  for (let d = 0; d < 360; d++) {
    const g = ctx.createRadialGradient(cx,cy,0,cx,cy,R);
    g.addColorStop(0, `hsl(${d},0%,100%)`);
    g.addColorStop(.5, `hsl(${d},100%,50%)`);
    g.addColorStop(1, `hsl(${d},100%,15%)`);
    ctx.beginPath();
    ctx.moveTo(cx,cy);
    ctx.arc(cx,cy,R,(d-1)*Math.PI/180,(d+1)*Math.PI/180);
    ctx.closePath();
    ctx.fillStyle = g;
    ctx.fill();
  }
  const cg = ctx.createRadialGradient(cx,cy,0,cx,cy,R*.18);
  cg.addColorStop(0,'rgba(0,0,0,0.75)');
  cg.addColorStop(1,'transparent');
  ctx.beginPath();
  ctx.arc(cx,cy,R*.18,0,Math.PI*2);
  ctx.fillStyle=cg; ctx.fill();

  const pick = e => {
    const rect = c.getBoundingClientRect();
    const sx = c.width/rect.width, sy = c.height/rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const x = (clientX - rect.left)*sx - cx;
    const y = (clientY - rect.top)*sy - cy;
    const h = ((Math.atan2(y,x)*180/Math.PI)+360)%360;
    const s = Math.min(Math.sqrt(x*x+y*y)/R, 1);
    const [r,g,b] = hslToRgb(h/360, s, 0.5);
    gE('val-r').value = r;
    gE('val-g').value = g;
    gE('val-b').value = b;
    updateFaderUI();
  };
  c.addEventListener('click', pick);
  c.addEventListener('touchstart', e => { e.preventDefault(); pick(e); }, {passive:false});
}

function hslToRgb(h,s,l) {
  let r,g,b;
  if (!s) { r=g=b=l; }
  else {
    const q = l<.5 ? l*(1+s) : l+s-l*s, p=2*l-q;
    r=h2r(p,q,h+1/3); g=h2r(p,q,h); b=h2r(p,q,h-1/3);
  }
  return [~~(r*255),~~(g*255),~~(b*255)];
}
function h2r(p,q,t) {
  if(t<0)t+=1; if(t>1)t-=1;
  if(t<1/6) return p+(q-p)*6*t;
  if(t<1/2) return q;
  if(t<2/3) return p+(q-p)*(2/3-t)*6;
  return p;
}

// ═══════════════════════ HOST INIT ══════════════════════════════════
function initHost() {
  LP.isHost = true;
  showView('view-host');
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for(let i=0;i<4;i++) code += chars[~~(Math.random()*chars.length)];

  LP.peer = new Peer(code, { debug: 0 });
  LP.peer.on('open', id => sT('room-code', id));
  LP.peer.on('connection', onConnect);
  LP.peer.on('error', err => console.warn('Peer error:', err.type));

  requestAnimationFrame(renderLoop);
}

function onConnect(conn) {
  // Prevent duplicate connections from same peer
  const existing = LP.conns.findIndex(c => c.conn.peer === conn.peer);
  if (existing >= 0) {
    LP.conns[existing].conn.close();
    LP.conns.splice(existing, 1);
  }

  const clientId = LP.conns.length;
  LP.conns.push({ conn, id: clientId, color: '#000', lastSeen: Date.now() });
  sT('conn-count', LP.conns.length);
  LP.deviceListDirty = true;

  conn.on('open', () => {
    conn.send({ type: 'setup', clientId });
  });
  conn.on('close', () => {
    LP.conns = LP.conns.filter(c => c.conn !== conn);
    sT('conn-count', LP.conns.length);
    LP.deviceListDirty = true;
  });
  conn.on('error', e => console.warn('conn error:', e));
}

function renderDeviceList() {
  const list = gE('device-list');
  if (!list) return;
  if (!LP.conns.length) {
    list.innerHTML = `<div class="empty-state">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity="0.25"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98"/></svg>
      <p>No devices connected. Share your room code!</p>
    </div>`;
    return;
  }
  list.innerHTML = LP.conns.map(c => `
    <div class="device-item" role="listitem">
      <div class="dev-pulse"></div>
      <div class="dev-info">
        <div class="dev-name">Light Node #${c.id}</div>
        <div class="dev-sub">Connected · synced</div>
      </div>
      <div class="dev-dot" style="background:${c.color}"></div>
    </div>
  `).join('');
}

// ═══════════════════════ CLIENT INIT ════════════════════════════════
function initClient() {
  const code = (gE('join-id')?.value || '').toUpperCase().trim();
  if (!code || code.length < 4) {
    gE('join-id')?.focus();
    return;
  }
  showView('view-client');

  LP.peer = new Peer(undefined, { debug: 0 });
  LP.peer.on('open', () => {
    const conn = LP.peer.connect(code, { reliable: false, serialization: 'json' });
    const st = gE('client-status');

    conn.on('open', () => {
      if (st) { st.textContent = 'Connected'; setTimeout(() => st.style.opacity='0.3', 2500); }
    });

    conn.on('data', d => {
      if (!d || !d.type) return;
      if (d.type === 'setup') {
        LP.myId = d.clientId;
        sT('client-addr', `NODE #${d.clientId}`);
      } else if (d.type === 'frame') {
        // Strict packet ordering — drop out-of-order
        if (typeof d.id !== 'number' || d.id <= LP.lastRxId) return;
        LP.lastRxId = d.id;

        if (!Array.isArray(d.colors) || !d.colors.length) return;
        const idx = Math.min(LP.myId, d.colors.length - 1);
        const color = d.colors[idx] || '#000';
        const bg = gE('client-bg');
        if (bg) bg.style.backgroundColor = color;
        if (d.decay > 0.65) spawnRipple(color);
      }
    });

    conn.on('close', () => { if (st) { st.textContent = 'Disconnected'; st.style.opacity='1'; }});
    conn.on('error', e => console.warn('client conn error:', e));
  });
  LP.peer.on('error', e => {
    const st = gE('client-status');
    if (st) st.textContent = 'Error — check room code';
  });
}

function spawnRipple(color) {
  const con = gE('ripple-container');
  if (!con) return;
  const el = document.createElement('div');
  el.className = 'ripple';
  el.style.cssText = `width:50px;height:50px;left:50%;top:50%;margin:-25px 0 0 -25px;border-color:${color}`;
  con.appendChild(el);
  setTimeout(() => el.remove(), 900);
}

// ═══════════════════════ AUDIO ENGINE ═══════════════════════════════
async function toggleAudio() {
  if (LP.audioOn) {
    LP.ordo?.destroy(); LP.ordo = null;
    LP.audioOn = false;
    gE('btn-mic')?.classList.remove('active');
    sT('mic-txt', 'Enable Microphone Sync');
    return;
  }
  try {
    LP.ordo = new OrdoAudio({
      fftSize: 4096, smoothingTimeConstant: 0.65, minDecibels: -100, maxDecibels: 0
    });
    LP.ordo.use('rta','lufs','pitch','chroma','onset','spectral','dynamics','zcr');
    LP.ordo.on('frame', onAudioFrame);
    LP.ordo.on('onset', onBeat);
    await LP.ordo.init('microphone');
    LP.ordo.start();
    LP.audioOn = true;
    gE('btn-mic')?.classList.add('active');
    sT('mic-txt', 'Mic Active — Syncing');
  } catch(e) {
    alert('Microphone access denied. Allow mic access to use audio sync.');
  }
}

function onBeat() {
  LP.flashDecay = 1.0;
  const chip = gE('chip-bpm');
  chip?.classList.add('beat');
  setTimeout(() => chip?.classList.remove('beat'), 120);
}

function onAudioFrame(data) {
  const a = LP.audio;
  const bands = data.rta?.bands;

  if (bands && bands.length >= 30) {
    const bass = bMean(bands, 0, 7);
    const mid  = bMean(bands, 8, 20);
    const high = bMean(bands, 21, 30);
    a.bass = lerp(a.bass, clamp01(bass), 0.25);
    a.mid  = lerp(a.mid,  clamp01(mid),  0.20);
    a.high = lerp(a.high, clamp01(high), 0.15);
  }

  // RMS from dynamics for volume brightness
  if (data.dynamics) {
    const rmsLin = Math.pow(10, (data.dynamics.rmsDb || -60) / 20);
    a.rms = lerp(a.rms, clamp01(rmsLin * 4), 0.15);
  } else if (data.lufs) {
    const lufsNorm = clamp01((data.lufs.momentary + 60) / 60);
    a.rms = lerp(a.rms, lufsNorm, 0.1);
  }

  // LUFS for display
  if (data.lufs) {
    a.lufs = lerp(a.lufs, clamp01((data.lufs.momentary + 60)/60), 0.1);
  }

  if (data.spectral?.centroid) {
    a.centroid = clamp01(Math.log10(Math.max(20, data.spectral.centroid)/20) / Math.log10(1000));
  }

  if (data.onset?.bpm > 0) {
    LP.bpm = data.onset.bpm;
    sT('bpm-disp', LP.bpm);
    sT('s-bpm', LP.bpm);
  }

  a.excitement = clamp01(a.excitement * 0.996 + a.bass * 0.015);

  // UI updates — only if audio tab visible to save perf
  mH('m-bass', a.bass*100);
  mH('m-mid',  a.mid*100);
  mH('m-high', a.high*100);
  mH('m-lufs', a.lufs*100);

  if (data.chroma) sT('s-key', data.chroma.keyString || '—');
  if (data.pitch?.frequency > 20) sT('s-pitch', data.pitch.note?.name || '—');
  if (data.lufs) sT('s-lufs', isFinite(data.lufs.momentary) ? data.lufs.momentary.toFixed(1) : '—');
  if (data.zcr)  sT('s-sig', data.zcr.type || '—');
  sT('s-energy', ~~(a.excitement*100)+'%');

  if (LP.tab === 'audio' && data.rta) drawRTA(data.rta.bands);
}

function bMean(bands, a, b) {
  let s=0;
  for(let i=a;i<=b;i++) s+=bands[i]?.normalized||0;
  return s/(b-a+1);
}

function drawRTA(bands) {
  const c = gE('rta-canvas');
  if (!c) return;
  const ctx = c.getContext('2d');
  const W = c.width, H = c.height;
  const bw = W / bands.length;
  ctx.fillStyle = '#06060a';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 1;
  [.25,.5,.75].forEach(y => {
    ctx.beginPath(); ctx.moveTo(0,H*y); ctx.lineTo(W,H*y); ctx.stroke();
  });
  bands.forEach((b,i) => {
    const h = b.normalized * H;
    const hue = 160 + (i/bands.length)*200;
    const g = ctx.createLinearGradient(0, H-h, 0, H);
    g.addColorStop(0, `hsla(${hue},100%,68%,0.9)`);
    g.addColorStop(1, `hsla(${hue},100%,32%,0.4)`);
    ctx.fillStyle = g;
    ctx.fillRect(i*bw+1, H-h, bw-2, h);
  });
}

// ═══════════════════════ FLASH ═══════════════════════════════════════
function toggleFlash() {
  LP.isFlashOn = !LP.isFlashOn;
  const btn = gE('btn-flash');
  btn?.classList.toggle('active', LP.isFlashOn);
  sT('flash-txt', LP.isFlashOn ? 'FLASHING' : 'FLASH OFF');
}
function setFColor(hex) { const el = gE('flash-color'); if(el) el.value = hex; }
function trigOn(t) { LP.manualTrig = t; }
function trigOff()  { LP.manualTrig = null; }

// ═══════════════════════ SHOW PROGRAMS ═══════════════════════════════
function launchShow(name) {
  const map = {
    club:    { fx:'rainbow',     spd:45, am:'beat-flash',   tab:'audio'   },
    rave:    { fx:'psychedelic', spd:88, am:'psychedelic',  tab:'audio'   },
    chill:   { fx:'ocean',       spd:14, am:'hue-rotate',   tab:'console' },
    fire:    { fx:'fire',        spd:65, am:'energy-pulse', tab:'audio'   },
    cinema:  { fx:'cinema',      spd:10, am:'bass-color',   tab:'console' },
    blackout:{ fx:'none',        spd:50,                    tab:'console', bo:true },
  };
  const p = map[name]; if(!p) return;

  LP.effect = p.fx;
  document.querySelectorAll('#fx-grid .fx').forEach(b => b.classList.toggle('active', b.dataset.fx===p.fx));

  const sp = gE('fx-speed');
  if(sp){ sp.value=p.spd; sT('fx-spd-o', p.spd); }

  LP.manualTrig = p.bo ? 'black-out' : null;

  if(p.am) {
    LP.audioMode = p.am;
    document.querySelectorAll('#am-grid .am').forEach(b => b.classList.toggle('active', b.dataset.am===p.am));
  }

  if(p.tab) {
    LP.tab = p.tab;
    document.querySelectorAll('.tb-tab').forEach(b => b.classList.toggle('active', b.dataset.tab===p.tab));
    document.querySelectorAll('.tab-pane').forEach(tp => tp.classList.remove('active'));
    gE(`tab-${p.tab}`)?.classList.add('active');
  }
}

// ═══════════════════════ RENDER LOOP ═════════════════════════════════
function renderLoop() {
  LP.frame++;
  const now = Date.now();
  const n = Math.max(1, LP.conns.length);

  // Decay beat flash
  if (LP.flashDecay > 0) {
    const decayMs = parseInt(gV('flash-decay') || '80');
    LP.flashDecay = Math.max(0, LP.flashDecay - (1000/60)/decayMs);
  }

  // Compute raw colors
  let colors;
  if      (LP.manualTrig)                          colors = cManual(n);
  else if (LP.isFlashOn)                           colors = cFlash(n);
  else if (LP.audioOn && LP.tab === 'audio')       colors = cAudio(n);
  else                                             colors = cConsole(n);

  // Beat flash overlay
  if (LP.audioOn && LP.flashDecay > 0) {
    const thresh = parseInt(gV('flash-thresh')||'75')/100;
    const bassFlash = document.getElementById('bass-flash-tog')?.checked;
    if (bassFlash && LP.audio.bass > thresh) {
      const strength = Math.pow(LP.flashDecay, 2) * 0.85;
      colors = colors.map(c => blendHex(c, '#ffffff', strength));
    }
  }

  // Apply volume brightness to ALL colors
  }

  // Update conn colors
  LP.conns.forEach((c, i) => {
    c.color = colors[Math.min(i, colors.length-1)] || '#000';
  });

  // Broadcast at 40fps — use throttle to prevent flooding
  if (now - LP.lastBcast > 25 && LP.conns.length > 0) {
    LP.pktId++;
    const payload = { type:'frame', id:LP.pktId, colors, decay:LP.flashDecay };
    LP.conns.forEach(({ conn }) => {
      // Only send if connection is open and backpressure is not building
      if (conn.open) {
        try { conn.send(payload); } catch(e) { /* ignore send errors */ }
      }
    });
    LP.lastBcast = now;
  }

  // Lazy device list update (only when dirty, max 5fps)
  if (LP.deviceListDirty && LP.frame % 12 === 0) {
    renderDeviceList();
    LP.deviceListDirty = false;
  }

  requestAnimationFrame(renderLoop);
}

// ═══════════════════════ COLOR COMPUTERS ════════════════════════════

function cManual(n) {
  const f = LP.frame;
  switch(LP.manualTrig) {
    case 'white-out':  return fill(n,'#ffffff');
    case 'black-out':  return fill(n,'#000000');
    case 'red-alert': {
      const on = ~~(f/5)%2;
      return fill(n, on?'#ff0000':'#1a0000');
    }
    case 'police': return Array.from({length:n},(_,i)=>{
      const ph = ~~(f/4)%2;
      return (i%2===0)===!!ph ? '#ff0000':'#0033ff';
    });
    default: return fill(n,'#000');
  }
}

function cFlash(n) {
  const rate  = parseInt(gV('flash-speed'));
  const duty  = parseInt(gV('flash-duty'))/100;
  const color = gV('flash-color');
  const period = Math.max(1, ~~(60/rate));
  const isOn  = LP.frame%period < Math.round(period*duty);
  return fill(n, isOn?color:'#000');
}

function cAudio(n) {
  const a   = LP.audio;
  const f   = LP.frame;
  const spd = parseInt(gV('fx-speed'));
  const itx = parseInt(gV('fx-intensity'))/100;

  switch(LP.audioMode) {

    case 'spectrum': return Array.from({length:n},(_,i)=>{
      const t = n>1 ? i/(n-1) : 0.5;
      const r = clamp255((a.bass*(1-t) + a.excitement*0.15)*255);
      const g = clamp255(a.mid*255*(1-Math.abs(t-.5)*2));
      const b = clamp255(a.high*t*255);
      return toHex(r,g,b);
    });

    case 'bass-color': {
      const hue = (a.centroid*360 + f*spd*0.05)%360;
      return Array.from({length:n},(_,i)=>{
        const h2 = (hue + i*(30/Math.max(1,n)))%360;
        const lit = 6 + a.bass*46*itx*(0.7+0.3*Math.sin(f*.12+i));
        return `hsl(${h2},90%,${Math.min(55,lit)}%)`;
      });
    }

    case 'beat-flash': return Array.from({length:n},(_,i)=>{
      if(LP.flashDecay>0.08) return blendHex('#000','#ffffff',Math.pow(LP.flashDecay,1.5));
      const h = (f*spd*0.07 + i*(360/n))%360;
      return `hsl(${h},100%,${a.bass*44*itx}%)`;
    });

    case 'psychedelic': return Array.from({length:n},(_,i)=>{
      const exc = a.excitement;
      const h = (f*spd*(0.1+exc*.6) + i*(360/n)*(1+exc*2.5) + Math.random()*exc*14)%360;
      const lit = 16+(a.bass+a.high)*22*itx;
      return `hsl(${h},100%,${Math.min(56,lit)}%)`;
    });

    case 'energy-pulse': {
      const energy = (a.bass+a.mid+a.high)/3;
      const h = (a.centroid*360 + f*spd*.03)%360;
      return Array.from({length:n},(_,i)=>{
        const w = Math.sin(f*.14*(spd/50)+i*Math.PI*.5)*.3+.7;
        return `hsl(${h},100%,${Math.min(56,energy*50*itx*w)}%)`;
      });
    }

    case 'hue-rotate': {
      const sp2 = spd*0.05*(1+a.bass*3);
      return Array.from({length:n},(_,i)=>{
        const h = (f*sp2 + i*(360/n))%360;
        return `hsl(${h},100%,${20+a.lufs*26*itx}%)`;
      });
    }

    default: return fill(n,'#000');
  }
}

function cConsole(n) {
  const r  = +gV('val-r'), g=+gV('val-g'), b=+gV('val-b');
  const m  = +gV('val-master');
  const spd = parseInt(gV('fx-speed'))/10;
  const itx = parseInt(gV('fx-intensity'))/100;
  const f   = LP.frame;
  const base = toHex(r*m, g*m, b*m);

  switch(LP.effect) {
    case 'none': return fill(n, base);

    case 'chase': {
      const ai = ~~(f*spd/5)%n;
      return Array.from({length:n},(_,i) => i===ai ? base : '#000');
    }
    case 'split': {
      const sw = ~~(f*spd/20)%2===0;
      return Array.from({length:n},(_,i) => ((i%2===0)===sw) ? base : '#000');
    }
    case 'rainbow': return Array.from({length:n},(_,i) =>
      `hsl(${(f*spd*.5+i*(360/n))%360},100%,45%)`
    );
    case 'pulse': {
      const w=(Math.sin(f*spd*.05)+1)/2;
      return fill(n, toHex(r*m*w, g*m*w, b*m*w));
    }
    case 'cascade': return Array.from({length:n},(_,i)=>{
      const ph=(f*spd*.05-i*.5)%(Math.PI*2);
      const bright=(Math.sin(ph)+1)/2;
      return toHex(r*m*bright, g*m*bright, b*m*bright);
    });
    case 'meteor': {
      const pos=(f*spd*.05)%(n+5);
      return Array.from({length:n},(_,i)=>{
        const d=pos-i;
        if(d<0||d>5) return '#000';
        return toHex(r*m*(1-d/5), g*m*(1-d/5), b*m*(1-d/5));
      });
    }
    case 'fire': return Array.from({length:n},(_,i)=>{
      const fl=Math.random()*.45+.55;
      const ph=(Math.sin(f*spd*.03+i*1.4)+1)/2*fl*itx;
      return toHex(255*ph, 80*ph*ph, 0);
    });
    case 'ocean': return Array.from({length:n},(_,i)=>{
      const w1=(Math.sin(f*spd*.02+i*.9)+1)/2;
      const w2=(Math.sin(f*spd*.013+i*1.3+1)+1)/3;
      const cv=(w1+w2)/1.4;
      return toHex(0, cv*110*itx, cv*195*itx);
    });
    case 'police': {
      const ph=~~(f*spd*.06)%4;
      return Array.from({length:n},(_,i) =>
        (ph<2)?(i%2===0?'#ff0000':'#000'):(i%2===1?'#0033ff':'#000')
      );
    }
    case 'thunder': {
      const bolt = Math.random() < 0.03*(spd/50);
      return bolt ? fill(n,'#ffffff') : Array.from({length:n},()=>
        Math.random()<.015 ? toHex(10,15,40) : '#000'
      );
    }
    case 'psychedelic': return Array.from({length:n},(_,i)=>{
      const h=(f*spd*.3+i*(360/n)+Math.sin(f*.04)*80)%360;
      return `hsl(${h},100%,44%)`;
    });
    case 'rave': return Array.from({length:n},(_,i)=>{
      const trig=~~((f+i*7)*spd*.02)%8===0;
      return trig?`hsl(${~~(Math.random()*360)},100%,50%)`:'#000';
    });
    case 'cinema': {
      const breath=(Math.sin(f*spd*.005)+1)/2;
      return fill(n, toHex(255*breath*.8*itx, 155*breath*.6*itx, 40*breath*.3*itx));
    }
    default: return fill(n, base);
  }
}

// ═══════════════════════ UTILITIES ═══════════════════════════════════

// Safe DOM helpers
function gE(id) { return document.getElementById(id); }
function gV(id) { return gE(id)?.value ?? '0'; }
function sT(id, v) { const el=gE(id); if(el) el.textContent=v; }
function mH(id, pct) { const el=gE(id); if(el) el.style.height=clamp01(pct/100)*100+'%'; }
function fill(n, c) { return Array(n).fill(c); }

function toHex(r,g,b) {
  return '#'+(1<<24|c255(r)<<16|c255(g)<<8|c255(b)).toString(16).slice(1);
}
function c255(v) { return Math.max(0,Math.min(255,Math.round(v))); }
function clamp01(v) { return Math.max(0,Math.min(1,v)); }
function clamp255(v){ return Math.max(0,Math.min(255,Math.round(v))); }
function lerp(a,b,t){ return a+(b-a)*t; }

function hexToRgb(hex) {
  // Handle hsl() strings gracefully
  if (!hex || !hex.startsWith('#')) return [0,0,0];
  const n = parseInt(hex.slice(1),16);
  return [(n>>16)&255,(n>>8)&255,n&255];
}

function blendHex(a, b, t) {
  const [ar,ag,ab] = a.startsWith('#') ? hexToRgb(a) : [0,0,0];
  const [br,bg,bb] = hexToRgb(b);
  return toHex(lerp(ar,br,t), lerp(ag,bg,t), lerp(ab,bb,t));
}
