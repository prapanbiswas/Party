/**
 * ═══════════════════════════════════════════════════════════
 *  LUMINA PARTY v3.1 — app.js
 *  Party Light Online Controller
 *  Audio: OrdoAudio DSP 19-module engine
 *  Effects: 14 modes + 6 audio reactive mappings
 * ═══════════════════════════════════════════════════════════
 */
'use strict';

// ══════════════════════════ GLOBAL STATE ════════════════════════════

const S = {
  peer: null,
  conns: [],          // { conn, id, color }
  myClientId: 0,
  packetId: 0,
  lastRxId: -1,

  tab: 'console',
  effect: 'none',
  audioMode: 'spectrum',

  isFlashActive: false,
  flashDecay: 0,
  manualOverride: null,

  ordo: null,
  audioActive: false,
  bpm: 0,

  // Smoothed audio values
  sm: { bass: 0, mid: 0, high: 0, lufs: 0, centroid: 0.5, energy: 0 },
  excitement: 0,

  frame: 0,
  lastBroadcast: 0,
};

// ══════════════════════════ PALETTE ═════════════════════════════════

const COLORS = [
  '#ff0000','#ff3300','#ff6600','#ff9900','#ffcc00','#ffff00',
  '#aaff00','#00ff00','#00ff66','#00ffcc','#00ccff','#0088ff',
  '#0044ff','#4400ff','#8800ff','#cc00ff','#ff00cc','#ff0066',
  '#ff8888','#88ff88','#8888ff','#ffffff','#ffaa44','#44ffcc',
];

// ══════════════════════════ BOOT ════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  buildPalette();
  bindFaders();
  bindFxButtons();
  bindAudioModes();
  bindTabNav();
  bindSliderOutputs();
  drawHSLWheel();
  startLandingCanvas();
  updateFaderDisplays();
});

// ══════════════════════════ LANDING CANVAS ══════════════════════════

function startLandingCanvas() {
  const c = document.getElementById('landing-canvas');
  if (!c) return;
  const ctx = c.getContext('2d');
  let pts = [], hue = 0;

  function resize() { c.width = innerWidth; c.height = innerHeight; }
  resize();
  window.addEventListener('resize', resize);

  for (let i = 0; i < 70; i++) {
    pts.push({
      x: Math.random() * c.width,
      y: Math.random() * c.height,
      r: Math.random() * 1.8 + 0.4,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      h: Math.random() * 360,
    });
  }

  (function draw() {
    if (!document.getElementById('view-landing').classList.contains('active')) return;
    hue = (hue + 0.25) % 360;
    ctx.fillStyle = 'rgba(0,0,0,0.07)';
    ctx.fillRect(0, 0, c.width, c.height);
    pts.forEach(p => {
      p.x = (p.x + p.vx + c.width) % c.width;
      p.y = (p.y + p.vy + c.height) % c.height;
      p.h = (p.h + 0.4) % 360;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${p.h},100%,70%,0.55)`;
      ctx.fill();
    });
    requestAnimationFrame(draw);
  })();
}

// ══════════════════════════ LANDING ACTIONS ═════════════════════════

function showJoinPanel() {
  const panel = document.getElementById('join-panel');
  panel.classList.add('visible');
  setTimeout(() => document.getElementById('join-id')?.focus(), 100);
}

// ══════════════════════════ VIEW SWITCH ═════════════════════════════

function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ══════════════════════════ PALETTE ═════════════════════════════════

function buildPalette() {
  const row = document.getElementById('palette-swatches');
  if (!row) return;
  COLORS.forEach(c => {
    const s = document.createElement('button');
    s.className = 'swatch';
    s.style.background = c;
    s.title = `Set color to ${c}`;
    s.setAttribute('aria-label', `Quick color ${c}`);
    s.onclick = () => applyColor(c);
    row.appendChild(s);
  });
}

function applyColor(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  document.getElementById('val-r').value = r;
  document.getElementById('val-g').value = g;
  document.getElementById('val-b').value = b;
  updateFaderDisplays();
}

// ══════════════════════════ FADERS ══════════════════════════════════

function bindFaders() {
  ['val-r','val-g','val-b','val-w','val-master'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', updateFaderDisplays);
  });
}

function updateFaderDisplays() {
  const r = +v('val-r'), g = +v('val-g'), b = +v('val-b'),
        w = +v('val-w'), m = +v('val-master');
  set('r-out', r);
  set('g-out', g);
  set('b-out', b);
  set('w-out', w);
  set('m-out', Math.round(m * 100) + '%');
  const el = document.getElementById('color-preview');
  if (el) el.style.background = `rgb(${~~(r*m)},${~~(g*m)},${~~(b*m)})`;
}

// ══════════════════════════ EFFECTS ═════════════════════════════════

function bindFxButtons() {
  document.querySelectorAll('#fx-grid .fx-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      S.effect = btn.dataset.effect;
      document.querySelectorAll('#fx-grid .fx-btn').forEach(b => {
        b.classList.toggle('active', b === btn);
        b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
      });
    });
  });

  bindSlider('fx-speed', 'fx-speed-out', v => v);
  bindSlider('fx-intensity', 'fx-intensity-out', v => v + '%');
}

function bindSlider(inputId, outId, fmt) {
  const el = document.getElementById(inputId);
  if (!el) return;
  el.addEventListener('input', () => set(outId, fmt(el.value)));
}

// ══════════════════════════ AUDIO MODES ═════════════════════════════

function bindAudioModes() {
  document.querySelectorAll('#audio-mode-grid .am-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      S.audioMode = btn.dataset.amode;
      document.querySelectorAll('#audio-mode-grid .am-btn').forEach(b => {
        b.classList.toggle('active', b === btn);
        b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
      });
    });
  });
}

// ══════════════════════════ TABS ════════════════════════════════════

function bindTabNav() {
  document.querySelectorAll('.tn-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      S.tab = btn.dataset.tab;
      document.querySelectorAll('.tn-btn').forEach(b => {
        b.classList.toggle('active', b === btn);
        b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
      });
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      document.getElementById(`tab-${btn.dataset.tab}`)?.classList.add('active');
    });
  });
}

// ══════════════════════════ SLIDER LABELS ═══════════════════════════

function bindSliderOutputs() {
  [
    ['flash-speed', 'flash-speed-out', v => v + ' Hz'],
    ['flash-duty',  'flash-duty-out',  v => v + '%'],
    ['flash-decay', 'flash-decay-out', v => v + 'ms'],
    ['bass-sens',   'bass-sens-out',   v => v + '%'],
    ['flash-thresh','flash-thresh-out', v => v + '%'],
  ].forEach(([id, oid, fmt]) => bindSlider(id, oid, fmt));
}

// ══════════════════════════ HSL WHEEL ═══════════════════════════════

function drawHSLWheel() {
  const canvas = document.getElementById('hsl-wheel');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const cx = canvas.width / 2, cy = canvas.height / 2, R = cx - 2;

  for (let deg = 0; deg < 360; deg++) {
    const a1 = (deg - 1) * Math.PI / 180;
    const a2 = (deg + 1) * Math.PI / 180;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
    g.addColorStop(0, `hsl(${deg},0%,100%)`);
    g.addColorStop(0.5, `hsl(${deg},100%,50%)`);
    g.addColorStop(1, `hsl(${deg},100%,15%)`);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, R, a1, a2);
    ctx.closePath();
    ctx.fillStyle = g;
    ctx.fill();
  }

  // Dark center
  const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.2);
  cg.addColorStop(0, 'rgba(0,0,0,0.7)');
  cg.addColorStop(1, 'transparent');
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.2, 0, Math.PI * 2);
  ctx.fillStyle = cg;
  ctx.fill();

  canvas.addEventListener('click', e => {
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width, sy = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * sx - cx;
    const y = (e.clientY - rect.top) * sy - cy;
    const angle = ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
    const dist = Math.min(Math.sqrt(x*x + y*y) / R, 1);
    const [r, g, b] = hslToRgb(angle / 360, dist, 0.5);
    document.getElementById('val-r').value = r;
    document.getElementById('val-g').value = g;
    document.getElementById('val-b').value = b;
    updateFaderDisplays();
  });
}

function hslToRgb(h, s, l) {
  let r, g, b;
  if (!s) { r = g = b = l; }
  else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = h2r(p, q, h + 1/3);
    g = h2r(p, q, h);
    b = h2r(p, q, h - 1/3);
  }
  return [~~(r*255), ~~(g*255), ~~(b*255)];
}
function h2r(p, q, t) {
  if (t < 0) t += 1; if (t > 1) t -= 1;
  if (t < 1/6) return p + (q-p)*6*t;
  if (t < 1/2) return q;
  if (t < 2/3) return p + (q-p)*(2/3-t)*6;
  return p;
}

// ══════════════════════════ HOST INIT ═══════════════════════════════

function initHost() {
  showView('view-host');

  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let i = 0; i < 4; i++) id += chars[~~(Math.random() * chars.length)];

  S.peer = new Peer(id);
  S.peer.on('open', pid => set('room-code', pid));
  S.peer.on('connection', onPeerConnect);

  requestAnimationFrame(renderLoop);
}

function onPeerConnect(conn) {
  const clientId = S.conns.length;
  S.conns.push({ conn, id: clientId, color: '#000' });
  set('conn-count', S.conns.length);
  renderDeviceList();

  conn.on('open', () => conn.send({ type: 'setup', clientId }));
  conn.on('close', () => {
    S.conns = S.conns.filter(c => c.conn !== conn);
    set('conn-count', S.conns.length);
    renderDeviceList();
  });
}

function renderDeviceList() {
  const list = document.getElementById('device-list');
  if (!list) return;
  if (!S.conns.length) {
    list.innerHTML = `<div class="empty-state">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity="0.25"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98"/></svg>
      <p>No devices connected yet. Share your room code!</p>
    </div>`;
    return;
  }
  list.innerHTML = S.conns.map(c => `
    <div class="device-item" role="listitem">
      <div class="device-pulse"></div>
      <div class="device-info">
        <div class="device-name">Light Node #${c.id}</div>
        <div class="device-sub">Connected · receiving frames</div>
      </div>
      <div class="device-swatch" style="background:${c.color}"></div>
    </div>
  `).join('');
}

// ══════════════════════════ CLIENT INIT ═════════════════════════════

function initClient() {
  const code = (document.getElementById('join-id')?.value || '').toUpperCase().trim();
  if (!code) return;
  showView('view-client');

  S.peer = new Peer();
  S.peer.on('open', () => {
    const conn = S.peer.connect(code, { reliable: false, serialization: 'json' });
    const statusEl = document.getElementById('client-status');

    conn.on('open', () => {
      if (statusEl) { statusEl.textContent = 'Connected'; setTimeout(() => statusEl.style.opacity = '0.3', 2500); }
    });

    conn.on('data', d => {
      if (d.type === 'setup') {
        S.myClientId = d.clientId;
        const el = document.getElementById('client-address');
        if (el) el.textContent = `NODE #${d.clientId}`;
      } else if (d.type === 'frame' && d.id > S.lastRxId) {
        S.lastRxId = d.id;
        const idx = Math.min(S.myClientId, d.colors.length - 1);
        const color = d.colors[idx] || '#000';
        const bg = document.getElementById('client-bg');
        if (bg) bg.style.backgroundColor = color;
        if (d.decay > 0.7) spawnRipple(color);
      }
    });

    conn.on('close', () => { if (statusEl) { statusEl.textContent = 'Disconnected'; statusEl.style.opacity = '1'; }});
  });
}

function spawnRipple(color) {
  const con = document.getElementById('client-ripple-container');
  if (!con) return;
  const el = document.createElement('div');
  el.className = 'ripple';
  el.style.cssText = `width:60px;height:60px;left:50%;top:50%;margin:-30px 0 0 -30px;border-color:${color}`;
  con.appendChild(el);
  setTimeout(() => el.remove(), 900);
}

// ══════════════════════════ AUDIO ENGINE ════════════════════════════

async function toggleAudio() {
  if (S.audioActive) {
    S.ordo?.destroy(); S.ordo = null;
    S.audioActive = false;
    const btn = document.getElementById('btn-mic');
    btn?.classList.remove('active');
    btn?.setAttribute('aria-pressed', 'false');
    set('mic-status-text', 'Enable Microphone Sync');
    document.getElementById('mic-indicator')?.style.setProperty('background', 'var(--text-muted)');
    return;
  }

  try {
    S.ordo = new OrdoAudio({ fftSize: 4096, smoothingTimeConstant: 0.6, minDecibels: -100, maxDecibels: 0 });
    S.ordo.use('rta','lufs','pitch','chroma','onset','spectral','dynamics','zcr');
    S.ordo.on('frame', onAudioFrame);
    S.ordo.on('onset', onBeat);
    await S.ordo.init('microphone');
    S.ordo.start();

    S.audioActive = true;
    const btn = document.getElementById('btn-mic');
    btn?.classList.add('active');
    btn?.setAttribute('aria-pressed', 'true');
    set('mic-status-text', 'Mic Active — Syncing');

  } catch (e) {
    alert('Microphone access denied. Please allow mic access to use audio sync.');
  }
}

function onBeat() {
  S.flashDecay = 1.0;
  // Flash BPM chip
  const chip = document.getElementById('chip-bpm');
  chip?.classList.add('beat');
  setTimeout(() => chip?.classList.remove('beat'), 120);
}

function onAudioFrame(data) {
  const sm = S.sm;
  const bands = data.rta?.bands;

  if (bands) {
    const bass  = bandMean(bands, 0, 7);   // 20–250Hz
    const mid   = bandMean(bands, 8, 20);  // 315Hz–2.5kHz
    const high  = bandMean(bands, 21, 30); // 3.15–20kHz
    sm.bass     = lerp(sm.bass, clamp01(bass), 0.25);
    sm.mid      = lerp(sm.mid,  clamp01(mid),  0.20);
    sm.high     = lerp(sm.high, clamp01(high), 0.15);
  }

  if (data.lufs) {
    const lnorm = clamp01((data.lufs.momentary + 60) / 60);
    sm.lufs = lerp(sm.lufs, lnorm, 0.1);
  }

  if (data.spectral?.centroid) {
    sm.centroid = clamp01(Math.log10(data.spectral.centroid / 20) / Math.log10(1000));
  }

  if (data.onset?.bpm > 0) {
    S.bpm = data.onset.bpm;
    set('bpm-display', S.bpm);
    set('s-bpm', S.bpm);
  }

  S.excitement = clamp01(S.excitement * 0.996 + sm.bass * 0.015);

  // UI updates
  setMeter('m-bass', sm.bass * 100);
  setMeter('m-mid',  sm.mid  * 100);
  setMeter('m-high', sm.high * 100);
  setMeter('m-lufs', sm.lufs * 100);

  if (data.chroma)  set('s-key',    data.chroma.keyString || '—');
  if (data.pitch?.frequency > 20) set('s-pitch', data.pitch.note.name || '—');
  if (data.lufs) set('s-lufs', isFinite(data.lufs.momentary) ? data.lufs.momentary.toFixed(1) : '—');
  if (data.zcr)   set('s-signal', data.zcr.type || '—');
  set('s-energy', ~~(S.excitement * 100) + '%');

  if (data.rta) drawRTA(data.rta.bands);
}

function bandMean(bands, a, b) {
  let sum = 0;
  for (let i = a; i <= b; i++) sum += bands[i].normalized;
  return sum / (b - a + 1);
}

function setMeter(id, pct) {
  const el = document.getElementById(id);
  if (el) el.style.height = clamp01(pct / 100) * 100 + '%';
}

function drawRTA(bands) {
  const c = document.getElementById('rta-canvas');
  if (!c) return;
  const ctx = c.getContext('2d');
  const W = c.width, H = c.height;
  const bw = W / bands.length;

  ctx.fillStyle = '#06060a';
  ctx.fillRect(0, 0, W, H);

  // Grid
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 1;
  [0.25, 0.5, 0.75].forEach(y => {
    ctx.beginPath(); ctx.moveTo(0, H*y); ctx.lineTo(W, H*y); ctx.stroke();
  });

  bands.forEach((b, i) => {
    const h = b.normalized * H;
    const hue = 160 + (i / bands.length) * 200;
    const g = ctx.createLinearGradient(0, H - h, 0, H);
    g.addColorStop(0, `hsla(${hue},100%,68%,0.9)`);
    g.addColorStop(1, `hsla(${hue},100%,35%,0.4)`);
    ctx.fillStyle = g;
    ctx.fillRect(i * bw + 1, H - h, bw - 2, h);
  });
}

// ══════════════════════════ FLASH ═══════════════════════════════════

function toggleFlash() {
  S.isFlashActive = !S.isFlashActive;
  const btn = document.getElementById('btn-flash-toggle');
  const txt = document.getElementById('flash-btn-text');
  if (S.isFlashActive) {
    btn?.classList.add('active');
    btn?.setAttribute('aria-pressed', 'true');
    if (txt) txt.textContent = 'FLASHING';
  } else {
    btn?.classList.remove('active');
    btn?.setAttribute('aria-pressed', 'false');
    if (txt) txt.textContent = 'FLASH OFF';
  }
}

function setFlashColor(hex) {
  const el = document.getElementById('flash-color');
  if (el) el.value = hex;
}

function triggerManual(type) { S.manualOverride = { type }; }
function triggerManualOff()  { S.manualOverride = null; }

// ══════════════════════════ SHOW PROGRAMS ═══════════════════════════

function launchProgram(name) {
  const map = {
    club:     { effect: 'rainbow',     speed: 45, amode: 'beat-flash',   tab: 'audio'   },
    rave:     { effect: 'psychedelic', speed: 88, amode: 'psychedelic',  tab: 'audio'   },
    chill:    { effect: 'ocean',       speed: 14, amode: 'hue-rotate',   tab: 'console' },
    fire:     { effect: 'fire',        speed: 65, amode: 'energy-pulse', tab: 'audio'   },
    cinema:   { effect: 'cinema',      speed: 10, amode: 'bass-color',   tab: 'console' },
    blackout: { effect: 'none',        speed: 50,                         tab: 'console', blackout: true },
  };
  const p = map[name]; if (!p) return;

  // Apply effect
  S.effect = p.effect;
  document.querySelectorAll('#fx-grid .fx-btn').forEach(b => {
    const active = b.dataset.effect === p.effect;
    b.classList.toggle('active', active);
    b.setAttribute('aria-pressed', active ? 'true' : 'false');
  });

  // Speed
  const sp = document.getElementById('fx-speed');
  if (sp) { sp.value = p.speed; set('fx-speed-out', p.speed); }

  // Blackout override
  S.manualOverride = p.blackout ? { type: 'black-out' } : null;

  // Audio mode
  if (p.amode) {
    S.audioMode = p.amode;
    document.querySelectorAll('#audio-mode-grid .am-btn').forEach(b => {
      const active = b.dataset.amode === p.amode;
      b.classList.toggle('active', active);
      b.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  // Switch tab
  if (p.tab) {
    document.querySelectorAll('.tn-btn').forEach(b => {
      const active = b.dataset.tab === p.tab;
      b.classList.toggle('active', active);
      b.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    document.querySelectorAll('.tab-panel').forEach(p2 => p2.classList.remove('active'));
    document.getElementById(`tab-${p.tab}`)?.classList.add('active');
    S.tab = p.tab;
  }
}

// ══════════════════════════ RENDER LOOP ═════════════════════════════

function renderLoop() {
  S.frame++;
  const n = Math.max(1, S.conns.length);
  let colors;

  // Decay beat flash
  if (S.flashDecay > 0) {
    const decay = parseInt(document.getElementById('flash-decay')?.value || 80);
    S.flashDecay = Math.max(0, S.flashDecay - (1000 / 60) / decay);
  }

  if (S.manualOverride) {
    colors = computeManual(n);
  } else if (S.isFlashActive) {
    colors = computeFlash(n);
  } else if (S.audioActive && S.tab === 'audio') {
    colors = computeAudio(n);
  } else {
    colors = computeConsole(n);
  }

  // Beat flash overlay
  if (S.audioActive && S.flashDecay > 0) {
    const bassThresh = parseInt(document.getElementById('flash-thresh')?.value || 75) / 100;
    if (document.getElementById('bass-flash-toggle')?.checked && S.sm.bass > bassThresh) {
      const strength = Math.pow(S.flashDecay, 2) * 0.85;
      colors = colors.map(c => blendHex(c, '#ffffff', strength));
    }
  }

  // Update conn colors + broadcast
  const now = Date.now();
  S.conns.forEach((c, i) => { c.color = colors[Math.min(i, colors.length - 1)] || '#000'; });

  if (now - S.lastBroadcast > 1000 / 40 && S.conns.length > 0) {
    S.packetId++;
    S.conns.forEach(({ conn }) => {
      if (conn.open) conn.send({ type: 'frame', id: S.packetId, colors, decay: S.flashDecay });
    });
    S.lastBroadcast = now;
    if (S.frame % 12 === 0) renderDeviceList();
  }

  requestAnimationFrame(renderLoop);
}

// ══════════════════════════ COLOR COMPUTERS ═════════════════════════

function computeManual(n) {
  const f = S.frame;
  switch (S.manualOverride.type) {
    case 'white-out':  return fill(n, '#ffffff');
    case 'black-out':  return fill(n, '#000000');
    case 'red-alert': {
      const on = ~~(f / 5) % 2;
      return fill(n, on ? '#ff0000' : '#1a0000');
    }
    case 'police': return Array.from({length:n}, (_, i) => {
      const ph = ~~(f / 4) % 2;
      return (i % 2 === 0) === !!ph ? '#ff0000' : '#0033ff';
    });
    default: return fill(n, '#000');
  }
}

function computeFlash(n) {
  const rate   = parseInt(v('flash-speed'));
  const duty   = parseInt(v('flash-duty')) / 100;
  const color  = v('flash-color');
  const period = Math.max(1, ~~(60 / rate));
  const isOn   = S.frame % period < Math.round(period * duty);
  return fill(n, isOn ? color : '#000');
}

function computeAudio(n) {
  const sm  = S.sm;
  const f   = S.frame;
  const spd = parseInt(v('fx-speed'));
  const itx = parseInt(v('fx-intensity')) / 100;
  const exc = S.excitement;

  switch (S.audioMode) {

    case 'spectrum': return Array.from({length:n}, (_, i) => {
      const t = i / Math.max(1, n - 1);
      const r = clamp255((sm.bass * (1 - t) + exc * 0.15) * 255);
      const g = clamp255(sm.mid  * 255 * (1 - Math.abs(t - 0.5) * 2));
      const b = clamp255(sm.high * t * 255);
      return rgb(r, g, b);
    });

    case 'bass-color': {
      const hue = (sm.centroid * 360 + f * spd * 0.05) % 360;
      return Array.from({length:n}, (_, i) => {
        const h2  = (hue + i * (30 / Math.max(1, n))) % 360;
        const lit = 8 + sm.bass * 48 * itx * (0.7 + 0.3 * Math.sin(f * 0.12 + i));
        return `hsl(${h2},90%,${Math.min(55, lit)}%)`;
      });
    }

    case 'beat-flash': return Array.from({length:n}, (_, i) => {
      if (S.flashDecay > 0.08) {
        return blendHex('#000', '#ffffff', Math.pow(S.flashDecay, 1.5));
      }
      const h = (f * spd * 0.07 + i * (360 / n)) % 360;
      return `hsl(${h},100%,${sm.bass * 45 * itx}%)`;
    });

    case 'psychedelic': return Array.from({length:n}, (_, i) => {
      const h = (f * spd * (0.1 + exc * 0.6) + i * (360/n) * (1 + exc * 2.5) + Math.random() * exc * 15) % 360;
      const lit = 18 + (sm.bass + sm.high) * 24 * itx;
      return `hsl(${h},100%,${Math.min(58, lit)}%)`;
    });

    case 'energy-pulse': {
      const energy = (sm.bass + sm.mid + sm.high) / 3;
      const h = (sm.centroid * 360 + f * spd * 0.03) % 360;
      return Array.from({length:n}, (_, i) => {
        const w = Math.sin(f * 0.14 * (spd/50) + i * Math.PI * 0.5) * 0.3 + 0.7;
        return `hsl(${h},100%,${Math.min(58, energy * 50 * itx * w)}%)`;
      });
    }

    case 'hue-rotate': {
      const spedUp = spd * 0.05 * (1 + sm.bass * 3);
      return Array.from({length:n}, (_, i) => {
        const h = (f * spedUp + i * (360 / n)) % 360;
        return `hsl(${h},100%,${22 + sm.lufs * 26 * itx}%)`;
      });
    }

    default: return fill(n, '#000');
  }
}

function computeConsole(n) {
  const r  = +v('val-r'), g = +v('val-g'), b = +v('val-b');
  const m  = +v('val-master');
  const spd = parseInt(v('fx-speed')) / 10;
  const itx = parseInt(v('fx-intensity')) / 100;
  const f  = S.frame;
  const base = rgb(r*m, g*m, b*m);

  switch (S.effect) {

    case 'none': return fill(n, base);

    case 'chase': {
      const ai = ~~(f * spd / 5) % n;
      return Array.from({length:n}, (_, i) => i === ai ? base : '#000');
    }

    case 'split': {
      const sw = ~~(f * spd / 20) % 2 === 0;
      return Array.from({length:n}, (_, i) => ((i%2===0) === sw) ? base : '#000');
    }

    case 'rainbow': return Array.from({length:n}, (_, i) =>
      `hsl(${(f * spd * 0.5 + i * (360/n)) % 360},100%,45%)`
    );

    case 'pulse': {
      const w = (Math.sin(f * spd * 0.05) + 1) / 2;
      return fill(n, rgb(r*m*w, g*m*w, b*m*w));
    }

    case 'cascade': return Array.from({length:n}, (_, i) => {
      const ph = (f * spd * 0.05 - i * 0.5) % (Math.PI * 2);
      const bright = (Math.sin(ph) + 1) / 2;
      return rgb(r*m*bright, g*m*bright, b*m*bright);
    });

    case 'meteor': {
      const pos = (f * spd * 0.05) % (n + 5);
      return Array.from({length:n}, (_, i) => {
        const d = pos - i;
        if (d < 0 || d > 5) return '#000';
        return rgb(r*m*(1-d/5), g*m*(1-d/5), b*m*(1-d/5));
      });
    }

    case 'fire': return Array.from({length:n}, (_, i) => {
      const fl = Math.random() * 0.45 + 0.55;
      const ph = (Math.sin(f * spd * 0.03 + i * 1.4) + 1) / 2 * fl * itx;
      return rgb(255 * ph, 80 * ph * ph, 0);
    });

    case 'ocean': return Array.from({length:n}, (_, i) => {
      const w1 = (Math.sin(f * spd * 0.02 + i * 0.9) + 1) / 2;
      const w2 = (Math.sin(f * spd * 0.013 + i * 1.3 + 1) + 1) / 3;
      const c  = (w1 + w2) / 1.4;
      return rgb(0, c * 110 * itx, c * 195 * itx);
    });

    case 'police': {
      const ph = ~~(f * spd * 0.06) % 4;
      return Array.from({length:n}, (_, i) =>
        (ph < 2) ? (i%2===0 ? '#ff0000' : '#000') : (i%2===1 ? '#0033ff' : '#000')
      );
    }

    case 'thunder': {
      const bolt = Math.random() < 0.03 * (spd / 50);
      return bolt ? fill(n, '#ffffff') : Array.from({length:n}, () =>
        Math.random() < 0.015 ? rgb(10, 15, 40) : '#000'
      );
    }

    case 'psychedelic': return Array.from({length:n}, (_, i) => {
      const h = (f * spd * 0.3 + i * (360/n) + Math.sin(f*0.04)*80) % 360;
      return `hsl(${h},100%,44%)`;
    });

    case 'rave': return Array.from({length:n}, (_, i) => {
      const trig = ~~((f + i * 7) * spd * 0.02) % 8 === 0;
      return trig ? `hsl(${~~(Math.random()*360)},100%,50%)` : '#000';
    });

    case 'cinema': {
      const breath = (Math.sin(f * spd * 0.005) + 1) / 2;
      return fill(n, rgb(255 * breath * 0.8 * itx, 155 * breath * 0.6 * itx, 40 * breath * 0.3 * itx));
    }

    default: return fill(n, base);
  }
}

// ══════════════════════════ UTILITIES ═══════════════════════════════

function v(id) { return document.getElementById(id)?.value ?? 0; }
function set(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
function fill(n, c) { return Array(n).fill(c); }
function rgb(r, g, b) { return '#' + (1<<24 | c255(r)<<16 | c255(g)<<8 | c255(b)).toString(16).slice(1); }
function c255(v) { return Math.max(0, Math.min(255, Math.round(v))); }
function clamp01(v) { return Math.max(0, Math.min(1, v)); }
function clamp255(v) { return Math.max(0, Math.min(255, Math.round(v))); }
function lerp(a, b, t) { return a + (b - a) * t; }

function hexRgb(h) {
  const n = parseInt(h.replace('#',''), 16);
  return [(n>>16)&255, (n>>8)&255, n&255];
}
function blendHex(a, b, t) {
  const [ar,ag,ab] = hexRgb(a.length === 4 ? '#000000' : a.startsWith('hsl') ? hslStrToHex(a) : a);
  const [br,bg,bb] = hexRgb(b);
  return rgb(lerp(ar,br,t), lerp(ag,bg,t), lerp(ab,bb,t));
}
function hslStrToHex(hsl) {
  // Best-effort parse for hsl() strings
  const m = hsl.match(/hsl\((\d+\.?\d*),(\d+\.?\d*)%?,(\d+\.?\d*)%?\)/);
  if (!m) return '#000000';
  const [r,g,b] = hslToRgb(+m[1]/360, +m[2]/100, +m[3]/100);
  return rgb(r,g,b);
}
