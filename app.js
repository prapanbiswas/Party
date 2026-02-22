// --- STATE ---
let peer = null;
let connections = [];
let myClientId = 0; 
let packetId = 0;
let lastReceivedId = -1;

// Desk State
let activeTab = 'console';
let activeEffect = 'none';
let isFlashActive = false;
let isAudioActive = false;

// Performance
let lastBroadcastTime = 0;
const BROADCAST_THROTTLE = 1000 / 30; // 30 FPS Lock
let frameCount = 0;

// Audio
let audioCtx, analyser, dataArray;

// --- VIEW NAVIGATION ---
function showView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
}

function switchTab(tabId) {
    activeTab = tabId;
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    event.target.classList.add('active');
    document.getElementById(`tab-${tabId}`).classList.add('active');
}

function setEffect(effect, btnElement) {
    activeEffect = effect;
    document.querySelectorAll('.fx-btn').forEach(b => b.classList.remove('active'));
    btnElement.classList.add('active');
}

// --- FLASH BUTTON LOGIC ---
const flashBtn = document.getElementById('btn-flash-toggle');
flashBtn.addEventListener('click', () => {
    isFlashActive = !isFlashActive;
    if (isFlashActive) {
        flashBtn.classList.add('active');
        flashBtn.innerText = "FLASHING!";
    } else {
        flashBtn.classList.remove('active');
        flashBtn.innerText = "FLASH OFF";
    }
});

// --- HOST INIT ---
function initHost() {
    showView('view-host');
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let id = ''; for (let i = 0; i < 4; i++) id += chars.charAt(Math.floor(Math.random() * chars.length));
    
    peer = new Peer(id);
    peer.on('open', (id) => document.getElementById('room-code').innerText = id);
    
    peer.on('connection', (conn) => {
        const clientId = connections.length;
        connections.push(conn);
        document.getElementById('conn-count').innerText = connections.length;
        
        conn.on('open', () => {
            conn.send({ type: 'setup', clientId: clientId });
        });
    });

    // Build Audio Viz DOM
    const viz = document.getElementById('audio-viz');
    for(let i=0; i<16; i++) {
        let bar = document.createElement('div');
        bar.className = 'bar';
        viz.appendChild(bar);
    }

    requestAnimationFrame(renderLoop);
}

// --- THE PRO RENDER ENGINE ---
function renderLoop() {
    frameCount++;
    const now = Date.now();
    let stateColors = [];
    const totalDevices = Math.max(1, connections.length);

    // HIERARCHY LEVEL 1: AUDIO SYNC (Overrides Everything)
    if (activeTab === 'audio' && isAudioActive) {
        analyser.getByteFrequencyData(dataArray);
        let bass = 0, mid = 0, high = 0;
        for(let i=0; i<4; i++) bass += dataArray[i];
        for(let i=4; i<12; i++) mid += dataArray[i];
        for(let i=12; i<20; i++) high += dataArray[i];
        
        bass = (bass / 4) / 255; mid = (mid / 8) / 255; high = (high / 8) / 255;

        // UI Updates
        document.querySelectorAll('.bar').forEach((bar, i) => {
            bar.style.height = `${(dataArray[i] / 255) * 100}%`;
        });

        for (let i = 0; i < totalDevices; i++) {
            if (bass > 0.85) stateColors.push('#ffffff'); // Bass Hit
            else stateColors.push(rgbToHex(bass * 255, mid * 255, high * 255));
        }
    } 
    // HIERARCHY LEVEL 2: CONSOLE MODE
    else {
        // 1. Calculate Base Color from Faders
        const r = document.getElementById('val-r').value;
        const g = document.getElementById('val-g').value;
        const b = document.getElementById('val-b').value;
        // w is tracked but standard RGB displays don't render W well natively, keeping logic simple.
        const m = document.getElementById('val-master').value;
        const baseHex = rgbToHex(r * m, g * m, b * m);

        // 2. Apply Effects using the Base Color
        const fxSpeed = document.getElementById('fx-speed').value / 10;
        const timeMod = (frameCount * fxSpeed);

        for (let i = 0; i < totalDevices; i++) {
            let finalColor = baseHex;

            if (activeEffect === 'chase') {
                const activeIndex = Math.floor(timeMod / 5) % totalDevices;
                finalColor = (i === activeIndex) ? baseHex : '#000000';
            } else if (activeEffect === 'split') {
                const swap = Math.floor(timeMod / 20) % 2 === 0;
                finalColor = ((i % 2 === 0) === swap) ? baseHex : '#000000';
            } else if (activeEffect === 'rainbow') {
                const hue = (timeMod + (i * (360 / totalDevices))) % 360;
                finalColor = `hsl(${hue}, 100%, 50%)`;
            }

            stateColors.push(finalColor);
        }

        // 3. MASTER FLASH OVERRIDE (Overrides the calculated effects)
        if (isFlashActive) {
            const flashRate = 51 - document.getElementById('flash-speed').value; // Invert so higher = faster
            const flashColor = document.getElementById('flash-color').value;
            const isOn = Math.floor(frameCount / flashRate) % 2 === 0;
            
            for (let i = 0; i < totalDevices; i++) {
                stateColors[i] = isOn ? flashColor : '#000000';
            }
        }
    }

    // --- NETWORK BROADCAST ---
    if (now - lastBroadcastTime > BROADCAST_THROTTLE && connections.length > 0) {
        packetId++;
        connections.forEach(conn => {
            if (conn.open) conn.send({ type: 'frame', id: packetId, colors: stateColors });
        });
        lastBroadcastTime = now;
    }

    requestAnimationFrame(renderLoop);
}

// --- AUDIO INIT ---
async function toggleAudio() {
    if (isAudioActive) return;
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);
        dataArray = new Uint8Array(analyser.frequencyBinCount);
        
        isAudioActive = true;
        const btn = document.getElementById('btn-mic');
        btn.innerText = "MIC ACTIVE - SYNC RUNNING";
        btn.classList.add('active');
        btn.style.background = "#44ff44";
    } catch (e) {
        alert("Microphone access denied.");
    }
}

// --- CLIENT LOGIC ---
function initClient() {
    const roomId = document.getElementById('join-id').value.toUpperCase();
    if (!roomId) return alert("Enter code");
    showView('view-client');
    
    peer = new Peer();
    peer.on('open', () => {
        const conn = peer.connect(roomId, { reliable: false, serialization: 'json' });
        conn.on('open', () => {
            document.getElementById('client-status').innerText = 'Connected!';
            setTimeout(() => document.getElementById('client-status').style.opacity = '0.2', 2000);
        });

        conn.on('data', (data) => {
            if (data.type === 'setup') {
                myClientId = data.clientId;
                document.getElementById('client-address').innerText = `Address: #${myClientId}`;
            } else if (data.type === 'frame' && data.id > lastReceivedId) {
                lastReceivedId = data.id;
                const index = Math.min(myClientId, data.colors.length - 1);
                document.getElementById('client-bg').style.backgroundColor = data.colors[index];
            }
        });
    });
}

// Utilities
function rgbToHex(r, g, b) {
    return "#" + (1 << 24 | Math.floor(r) << 16 | Math.floor(g) << 8 | Math.floor(b)).toString(16).slice(1);
}
