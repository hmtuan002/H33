/**
 * GAMEVERSE - app.js
 * Hệ thống game online 3 trang: Auth → Home → Create / Game
 */

'use strict';

// ═══════════════════════════════════════════════
//  CONSTANTS & CONFIG
// ═══════════════════════════════════════════════
const PLAYER_COLORS  = ["blue","red","orange","yellow","green","purple"];
const SKIN_PRICES    = { blue:0, red:10, orange:15, yellow:20, green:25, purple:30 };
const CAMERA_SCALE   = 3;
const TILE           = 16;   // 1 game unit = 16px in game-space
const MAX_SPEED      = 1.5;
const ACCEL          = 0.4;
const FRICTION       = 0.75;
const HITBOX         = 6;
const FB_THROTTLE    = 100;
const COIN_INTERVAL  = [2000,3000,4000,5000];
const CHAT_TTL       = 20000; // 20s
const BUBBLE_TTL     = 5000;  // bubble shows 5s
const CHAT_CLEANUP_INTERVAL = 10000;

// ═══════════════════════════════════════════════
//  UTILS
// ═══════════════════════════════════════════════
function rnd(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function makeid(n=8) { return Math.random().toString(36).slice(2,2+n); }
function now() { return Date.now(); }

function createRandomName() {
  const prefix = rnd(["SWIFT","BRAVE","COOL","SUPER","WILD","NEON","DARK","BOLD","FAST","IRON"]);
  const animal = rnd(["WOLF","BEAR","FOX","HAWK","LION","BOAR","SEAL","PUMA","DEER","BULL"]);
  return `${prefix} ${animal}`;
}

// ═══════════════════════════════════════════════
//  ROUTER  (simple page switcher)
// ═══════════════════════════════════════════════
const Pages = {
  current: null,
  go(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById(`page-${id}`);
    if (target) target.classList.add('active');
    this.current = id;
  }
};

// ═══════════════════════════════════════════════
//  APP STATE
// ═══════════════════════════════════════════════
let currentUser   = null;
let playerProfile = { coins: 0, color: 'blue', name: '', purchasedSkins: { blue: true } };
let playerRef     = null;

// ═══════════════════════════════════════════════
//  AUTH
// ═══════════════════════════════════════════════
(function initAuth() {
  // Particles
  const particleWrap = document.getElementById('auth-particles');
  for (let i = 0; i < 30; i++) {
    const p = document.createElement('div');
    p.className = 'auth-particle';
    p.style.cssText = `
      left:${Math.random()*100}%;
      animation-duration:${6+Math.random()*10}s;
      animation-delay:${-Math.random()*10}s;
      width:${1+Math.random()*2}px;
      height:${1+Math.random()*2}px;
      opacity:${0.3+Math.random()*0.7};
    `;
    particleWrap.appendChild(p);
  }

  // Switch panels
  document.getElementById('link-to-register').addEventListener('click', e => {
    e.preventDefault();
    document.getElementById('auth-login-panel').classList.add('hidden');
    document.getElementById('auth-register-panel').classList.remove('hidden');
  });
  document.getElementById('link-to-login').addEventListener('click', e => {
    e.preventDefault();
    document.getElementById('auth-register-panel').classList.add('hidden');
    document.getElementById('auth-login-panel').classList.remove('hidden');
  });

  // Login
  document.getElementById('btn-login').addEventListener('click', async () => {
    const email    = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const errEl    = document.getElementById('auth-error');
    errEl.textContent = '';
    try {
      await firebase.auth().signInWithEmailAndPassword(email, password);
    } catch(e) {
      errEl.textContent = e.message;
    }
  });

  // Register
  document.getElementById('btn-register').addEventListener('click', async () => {
    const name     = document.getElementById('reg-name').value.trim() || createRandomName();
    const email    = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const errEl    = document.getElementById('reg-error');
    errEl.textContent = '';
    try {
      const cred = await firebase.auth().createUserWithEmailAndPassword(email, password);
      // Init profile
      await firebase.database().ref(`profiles/${cred.user.uid}`).set({
        name: name.toUpperCase(),
        color: 'blue',
        coins: 0,
        purchasedSkins: { blue: true }
      });
    } catch(e) {
      errEl.textContent = e.message;
    }
  });

  // Anonymous
  document.getElementById('btn-anon').addEventListener('click', async () => {
    try { await firebase.auth().signInAnonymously(); } catch(e) {}
  });

  // Logout
  document.getElementById('btn-logout').addEventListener('click', () => {
    leaveGame();
    firebase.auth().signOut();
  });

  // Auth state
  firebase.auth().onAuthStateChanged(async user => {
    if (user) {
      currentUser = user;
      playerRef = firebase.database().ref(`profiles/${user.uid}`);
      const snap = await playerRef.once('value');
      if (!snap.exists()) {
        const defaultProfile = {
          name: createRandomName(),
          color: 'blue',
          coins: 0,
          purchasedSkins: { blue: true }
        };
        await playerRef.set(defaultProfile);
        playerProfile = defaultProfile;
      } else {
        playerProfile = snap.val();
      }
      playerRef.on('value', snap => {
        if (snap.val()) {
          playerProfile = snap.val();
          updateHomeHUD();
          updateAvatarPanel();
        }
      });
      Pages.go('home');
      initHome();
    } else {
      currentUser = null;
      Pages.go('auth');
    }
  });
})();

// ═══════════════════════════════════════════════
//  HOME PAGE
// ═══════════════════════════════════════════════
let homeInitialized = false;
function initHome() {
  if (homeInitialized) { refreshMapsGrid(); return; }
  homeInitialized = true;

  // Nav tabs
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.home-tab').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      const tab = document.getElementById(`tab-${btn.dataset.tab}`);
      if (tab) tab.classList.add('active');
      if (btn.dataset.tab === 'avatar') updateAvatarPanel();
    });
  });

  document.getElementById('btn-go-create').addEventListener('click', () => {
    Pages.go('create');
    initCreate();
  });

  refreshMapsGrid();
}

function updateHomeHUD() {
  const name = playerProfile.name || 'GUEST';
  document.getElementById('home-username').textContent = name;
  document.getElementById('home-coins').textContent = playerProfile.coins || 0;
}

function refreshMapsGrid() {
  updateHomeHUD();
  const grid = document.getElementById('maps-grid');
  grid.innerHTML = '<div class="map-loading">Đang tải các thế giới...</div>';

  firebase.database().ref('maps').once('value').then(snap => {
    const maps = snap.val() || {};
    const keys = Object.keys(maps);
    if (keys.length === 0) {
      grid.innerHTML = '<div class="map-loading">Chưa có map nào. Hãy tạo map đầu tiên! 🌍</div>';
      return;
    }
    grid.innerHTML = '';
    keys.forEach(mapId => {
      const m = maps[mapId];
      const card = document.createElement('div');
      card.className = 'map-card';
      const thumbHTML = m.imageUrl
        ? `<img class="map-card-thumb" src="${escapeHTML(m.imageUrl)}" alt="${escapeHTML(m.name)}" onerror="this.style.display='none'">`
        : `<div class="map-card-thumb-placeholder">🗺️</div>`;
      card.innerHTML = `
        ${thumbHTML}
        <div class="map-card-body">
          <div class="map-card-name">${escapeHTML(m.name || 'Unnamed Map')}</div>
          <div class="map-card-meta">By ${escapeHTML(m.creatorName||'?')} · ${m.gridW||0}×${m.gridH||0} ô</div>
          ${m.description ? `<div class="map-card-desc">${escapeHTML(m.description)}</div>` : ''}
        </div>
        <div class="map-card-footer">
          <div class="map-online-badge"><span class="map-online-dot"></span><span id="online-${mapId}">0 online</span></div>
          <button class="btn-play">CHƠI</button>
        </div>
      `;
      card.querySelector('.btn-play').addEventListener('click', () => enterGame(mapId, m));
      grid.appendChild(card);

      // Watch online count
      firebase.database().ref(`game_players/${mapId}`).on('value', s => {
        const el = document.getElementById(`online-${mapId}`);
        if (el) el.textContent = `${Object.keys(s.val()||{}).length} online`;
      });
    });
  });
}

// ── Avatar panel ─────────────────────────────
function updateAvatarPanel() {
  if (!currentUser) return;
  const col = playerProfile.color || 'blue';

  // Avatar display
  const sprite = document.getElementById('av-sprite');
  if (sprite) {
    const yMap = {blue:0,red:-16,orange:-32,yellow:-48,green:-64,purple:-80};
    sprite.style.backgroundPositionY = (yMap[col]||0) + 'px';
    sprite.style.backgroundPositionX = '16px';
  }
  document.getElementById('avatar-name-tag').textContent = playerProfile.name || 'PLAYER';
  document.getElementById('avatar-coins-display').textContent = playerProfile.coins || 0;

  // Skin grid
  const grid = document.getElementById('home-skin-grid');
  grid.innerHTML = '';
  PLAYER_COLORS.forEach(color => {
    const owned    = (playerProfile.purchasedSkins||{})[color] === true;
    const equipped = col === color;
    const price    = SKIN_PRICES[color] || 0;
    const yMap = {blue:0,red:-16,orange:-32,yellow:-48,green:-64,purple:-80};
    const yPos = yMap[color] || 0;

    let btnText = '', btnClass = '';
    if (equipped) { btnText = '✓ ĐANG DÙNG'; btnClass = 'equipped-btn'; }
    else if (owned) { btnText = 'SỬ DỤNG'; btnClass = 'use-btn'; }
    else { btnText = `MUA ${price} 💰`; btnClass = ''; }

    const card = document.createElement('div');
    card.className = `skin-card${equipped ? ' equipped' : ''}`;
    card.innerHTML = `
      <div class="skin-card-preview" data-color="${color}">
        <div class="sk-shadow"></div>
        <div class="sk-sprite" style="background-position-y:${yPos}px;background-position-x:16px"></div>
      </div>
      <div class="skin-card-name">${color.toUpperCase()}</div>
      <button class="skin-card-btn ${btnClass}" ${equipped?'disabled':''}>${btnText}</button>
    `;
    const btn = card.querySelector('.skin-card-btn');
    if (!equipped) {
      btn.addEventListener('click', () => handleSkinAction(color, owned, price));
    }
    grid.appendChild(card);
  });
}

async function handleSkinAction(color, owned, price) {
  if (!playerRef) return;
  const coins = playerProfile.coins || 0;
  const skins = playerProfile.purchasedSkins || { blue: true };

  if (owned) {
    await playerRef.update({ color });
  } else if (coins >= price) {
    await playerRef.update({
      color,
      coins: coins - price,
      purchasedSkins: { ...skins, [color]: true }
    });
  } else {
    alert(`Không đủ xu! Cần ${price - coins} xu nữa.`);
  }
}

// ═══════════════════════════════════════════════
//  CREATE PAGE
// ═══════════════════════════════════════════════
let createState = {
  imageUrl: '',
  mapName: '',
  imgNaturalW: 0,
  imgNaturalH: 0,
  unitPx: 32,       // pixels per unit cell
  gridW: 0, gridH: 0,
  walls: {},         // "gx,gy": true
  spawnX: 1, spawnY: 1,
  spawnSet: false,
  currentStep: 1,
  activeTool: 'draw',
  isDrawing: false,
};

let createInitialized = false;
function initCreate() {
  if (createInitialized) { goToStep(1); return; }
  createInitialized = true;

  document.getElementById('btn-back-from-create').addEventListener('click', () => {
    Pages.go('home');
    refreshMapsGrid();
  });

  // Step 1
  document.getElementById('btn-load-image').addEventListener('click', loadMapImage);
  document.getElementById('map-image-url').addEventListener('keydown', e => {
    if (e.key === 'Enter') loadMapImage();
  });
  document.getElementById('btn-step1-next').addEventListener('click', () => goToStep(2));

  // Step 2
  document.getElementById('btn-step2-back').addEventListener('click', () => goToStep(1));
  document.getElementById('btn-step2-next').addEventListener('click', () => goToStep(3));
  document.getElementById('unit-size-slider').addEventListener('input', e => {
    createState.unitPx = parseInt(e.target.value);
    document.getElementById('unit-px-display').textContent = createState.unitPx;
    drawCalibrationCanvas();
  });

  // Step 3
  document.getElementById('btn-step3-back').addEventListener('click', () => goToStep(2));
  document.getElementById('btn-step3-next').addEventListener('click', () => goToStep(4));
  document.getElementById('btn-clear-walls').addEventListener('click', () => {
    createState.walls = {};
    createState.spawnSet = false;
    drawWallCanvas();
    updateWallStats();
  });
  document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tool-btn[data-tool]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      createState.activeTool = btn.dataset.tool;
    });
  });
  initWallCanvas();

  // Step 4
  document.getElementById('btn-step4-back').addEventListener('click', () => goToStep(3));
  document.getElementById('btn-publish').addEventListener('click', publishMap);
}

function loadMapImage() {
  const url = document.getElementById('map-image-url').value.trim();
  if (!url) return;
  const preview = document.getElementById('url-preview');
  preview.innerHTML = '<div class="url-preview-placeholder">Đang tải...</div>';
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    createState.imageUrl = url;
    createState.imgNaturalW = img.naturalWidth;
    createState.imgNaturalH = img.naturalHeight;
    preview.innerHTML = '';
    preview.appendChild(img);
    document.getElementById('btn-step1-next').disabled = false;
  };
  img.onerror = () => {
    preview.innerHTML = '<div class="url-preview-placeholder">❌ Không tải được ảnh. Thử link khác.</div>';
    document.getElementById('btn-step1-next').disabled = true;
  };
  img.src = url;
  img.style.maxWidth = '100%';
  img.style.maxHeight = '280px';
}

function goToStep(n) {
  createState.currentStep = n;
  document.querySelectorAll('.create-step-panel').forEach(p => p.classList.remove('active'));
  document.getElementById(`create-step-${n}`).classList.add('active');
  document.querySelectorAll('.step').forEach(s => {
    const sn = parseInt(s.dataset.step);
    s.classList.toggle('active', sn === n);
    s.classList.toggle('done', sn < n);
  });
  if (n === 2) setupCalibration();
  if (n === 3) setupWallEditor();
  if (n === 4) setupPublishSummary();
}

// ── Calibration canvas ────────────────────────
function setupCalibration() {
  const slider = document.getElementById('unit-size-slider');
  createState.unitPx = parseInt(slider.value);
  document.getElementById('unit-px-display').textContent = createState.unitPx;
  drawCalibrationCanvas();
}

function drawCalibrationCanvas() {
  const canvas = document.getElementById('calibration-canvas');
  const wrap   = document.getElementById('calibration-canvas-wrap');
  const { imgNaturalW, imgNaturalH, unitPx, imageUrl } = createState;

  // Scale the canvas display to fit the wrap
  const maxW = Math.min(wrap.clientWidth - 4, 700);
  const maxH = Math.min(wrap.clientHeight - 4, 400) || 300;
  const scale = Math.min(maxW / imgNaturalW, maxH / imgNaturalH, 1);

  canvas.width  = imgNaturalW;
  canvas.height = imgNaturalH;
  canvas.style.width  = Math.floor(imgNaturalW * scale) + 'px';
  canvas.style.height = Math.floor(imgNaturalH * scale) + 'px';

  const ctx = canvas.getContext('2d');
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, imgNaturalW, imgNaturalH);

    // Draw grid
    ctx.strokeStyle = 'rgba(255,215,0,0.4)';
    ctx.lineWidth = 0.5;
    for (let x = 0; x < imgNaturalW; x += unitPx) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, imgNaturalH); ctx.stroke();
    }
    for (let y = 0; y < imgNaturalH; y += unitPx) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(imgNaturalW, y); ctx.stroke();
    }

    // Unit block highlight (top-left first cell)
    ctx.fillStyle = 'rgba(255,215,0,0.2)';
    ctx.fillRect(0, 0, unitPx, unitPx);
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, unitPx-2, unitPx-2);
  };
  img.src = imageUrl;

  // Update stats
  const gw = Math.floor(imgNaturalW / unitPx);
  const gh = Math.floor(imgNaturalH / unitPx);
  createState.gridW = gw;
  createState.gridH = gh;
  document.getElementById('cal-map-size').textContent = `${imgNaturalW}×${imgNaturalH}`;
  document.getElementById('cal-unit-size').textContent = `${unitPx}×${unitPx}`;
  document.getElementById('cal-grid-size').textContent = `${gw}×${gh}`;
}

// ── Wall canvas ───────────────────────────────
let wallCanvas, wallCtx, wallImg;
function initWallCanvas() {
  wallCanvas = document.getElementById('wall-canvas');
  wallCtx    = wallCanvas.getContext('2d');

  // Mouse
  wallCanvas.addEventListener('mousedown', e => {
    createState.isDrawing = true;
    handleWallClick(e);
  });
  wallCanvas.addEventListener('mousemove', e => {
    if (createState.isDrawing) handleWallClick(e);
  });
  window.addEventListener('mouseup', () => { createState.isDrawing = false; });

  // Touch
  wallCanvas.addEventListener('touchstart', e => {
    e.preventDefault();
    createState.isDrawing = true;
    handleWallClick(e.touches[0]);
  }, { passive: false });
  wallCanvas.addEventListener('touchmove', e => {
    e.preventDefault();
    if (createState.isDrawing) handleWallClick(e.touches[0]);
  }, { passive: false });
  wallCanvas.addEventListener('touchend', () => { createState.isDrawing = false; });
}

function setupWallEditor() {
  const { imgNaturalW, imgNaturalH, imageUrl, unitPx } = createState;
  const DISPLAY_SCALE = Math.min(3, 600 / imgNaturalW, 500 / imgNaturalH);

  wallCanvas.width  = imgNaturalW;
  wallCanvas.height = imgNaturalH;
  wallCanvas.style.width  = Math.floor(imgNaturalW * DISPLAY_SCALE) + 'px';
  wallCanvas.style.height = Math.floor(imgNaturalH * DISPLAY_SCALE) + 'px';
  wallCanvas._displayScale = DISPLAY_SCALE;

  wallImg = new Image();
  wallImg.crossOrigin = 'anonymous';
  wallImg.onload = () => drawWallCanvas();
  wallImg.src = imageUrl;
  updateWallStats();
}

function handleWallClick(event) {
  const rect   = wallCanvas.getBoundingClientRect();
  const scale  = wallCanvas._displayScale || 1;
  const rawX   = (event.clientX - rect.left) / (rect.width / wallCanvas.width);
  const rawY   = (event.clientY - rect.top)  / (rect.height / wallCanvas.height);
  const gx     = Math.floor(rawX / createState.unitPx);
  const gy     = Math.floor(rawY / createState.unitPx);
  const key    = `${gx},${gy}`;
  const { activeTool } = createState;

  if (activeTool === 'draw') {
    createState.walls[key] = true;
  } else if (activeTool === 'erase') {
    delete createState.walls[key];
  } else if (activeTool === 'spawn') {
    createState.spawnX   = gx;
    createState.spawnY   = gy;
    createState.spawnSet = true;
  }
  drawWallCanvas();
  updateWallStats();
}

function drawWallCanvas() {
  if (!wallCtx || !wallImg) return;
  const { imgNaturalW, imgNaturalH, unitPx, walls, spawnSet, spawnX, spawnY } = createState;
  wallCtx.clearRect(0, 0, imgNaturalW, imgNaturalH);
  wallCtx.drawImage(wallImg, 0, 0, imgNaturalW, imgNaturalH);

  // Grid overlay
  wallCtx.strokeStyle = 'rgba(255,255,255,0.12)';
  wallCtx.lineWidth = 0.5;
  for (let x = 0; x <= imgNaturalW; x += unitPx) {
    wallCtx.beginPath(); wallCtx.moveTo(x,0); wallCtx.lineTo(x,imgNaturalH); wallCtx.stroke();
  }
  for (let y = 0; y <= imgNaturalH; y += unitPx) {
    wallCtx.beginPath(); wallCtx.moveTo(0,y); wallCtx.lineTo(imgNaturalW,y); wallCtx.stroke();
  }

  // Walls
  Object.keys(walls).forEach(key => {
    const [gx, gy] = key.split(',').map(Number);
    wallCtx.fillStyle = 'rgba(255,80,30,0.5)';
    wallCtx.fillRect(gx*unitPx+1, gy*unitPx+1, unitPx-2, unitPx-2);
    wallCtx.strokeStyle = 'rgba(255,120,60,0.9)';
    wallCtx.lineWidth = 1;
    wallCtx.strokeRect(gx*unitPx+1, gy*unitPx+1, unitPx-2, unitPx-2);
  });

  // Spawn
  if (spawnSet) {
    wallCtx.fillStyle = 'rgba(105,240,174,0.5)';
    wallCtx.fillRect(spawnX*unitPx+1, spawnY*unitPx+1, unitPx-2, unitPx-2);
    wallCtx.fillStyle = '#69f0ae';
    wallCtx.font = `${unitPx*0.6}px sans-serif`;
    wallCtx.textAlign = 'center';
    wallCtx.textBaseline = 'middle';
    wallCtx.fillText('🏁', spawnX*unitPx+unitPx/2, spawnY*unitPx+unitPx/2);
  }
}

function updateWallStats() {
  document.getElementById('wall-count').textContent = Object.keys(createState.walls).length;
  document.getElementById('spawn-set').textContent  = createState.spawnSet
    ? `(${createState.spawnX}, ${createState.spawnY})` : 'Chưa đặt';
}

// ── Publish ───────────────────────────────────
function setupPublishSummary() {
  const { mapName, imageUrl, gridW, gridH, walls, spawnSet } = createState;
  const name = document.getElementById('map-name-input').value.trim() || 'Unnamed Map';
  createState.mapName = name;
  document.getElementById('publish-summary').innerHTML = `
    <strong>Tên map:</strong> ${escapeHTML(name)}<br>
    <strong>Kích thước:</strong> ${gridW} × ${gridH} ô<br>
    <strong>Tường:</strong> ${Object.keys(walls).length} khối<br>
    <strong>Spawn:</strong> ${spawnSet ? `(${createState.spawnX}, ${createState.spawnY})` : 'Mặc định (0,0)'}<br>
    <strong>Ảnh nền:</strong> ${imageUrl ? '✅ Đã đặt' : '❌ Chưa đặt'}
  `;
}

async function publishMap() {
  if (!currentUser) return;
  const errEl = document.getElementById('publish-error');
  errEl.textContent = '';
  const btn = document.getElementById('btn-publish');
  btn.disabled = true; btn.textContent = 'Đang publish...';

  try {
    const mapId = makeid(10);
    const desc  = document.getElementById('map-description').value.trim();
    const mapData = {
      id: mapId,
      name: createState.mapName || 'Unnamed Map',
      description: desc,
      imageUrl: createState.imageUrl,
      unitPx: createState.unitPx,
      gridW:  createState.gridW,
      gridH:  createState.gridH,
      walls:  createState.walls,
      spawnX: createState.spawnX,
      spawnY: createState.spawnY,
      creatorUid: currentUser.uid,
      creatorName: playerProfile.name || 'PLAYER',
      createdAt: firebase.database.ServerValue.TIMESTAMP,
    };
    await firebase.database().ref(`maps/${mapId}`).set(mapData);
    btn.textContent = '✅ Đã publish!';
    setTimeout(() => {
      Pages.go('home');
      refreshMapsGrid();
      // Reset create state
      createState = { ...createState, walls:{}, spawnSet:false, currentStep:1 };
      goToStep(1);
      btn.disabled = false;
      btn.textContent = '🚀 PUBLISH MAP';
    }, 1500);
  } catch(e) {
    errEl.textContent = e.message;
    btn.disabled = false;
    btn.textContent = '🚀 PUBLISH MAP';
  }
}

// ═══════════════════════════════════════════════
//  GAME PAGE
// ═══════════════════════════════════════════════
let game = null; // holds all game state

function enterGame(mapId, mapData) {
  Pages.go('game');
  if (game) leaveGame(true);
  startGame(mapId, mapData);
}

function leaveGame(silent = false) {
  if (game) {
    game.destroy();
    game = null;
  }
  if (!silent) {
    Pages.go('home');
    refreshMapsGrid();
  }
}

function startGame(mapId, mapDef) {
  document.getElementById('game-map-name').textContent = mapDef.name || mapId;
  document.getElementById('btn-leave-game').onclick = () => leaveGame();

  const gameContainer = document.getElementById('game-container');
  const cameraPan     = document.getElementById('camera-pan');
  gameContainer.innerHTML = '';

  // ── Map setup ───────────────────────────────
  const unitPx = mapDef.unitPx || 32;
  const gridW  = mapDef.gridW  || 20;
  const gridH  = mapDef.gridH  || 15;
  const walls  = mapDef.walls  || {};
  const spawnX = mapDef.spawnX || 1;
  const spawnY = mapDef.spawnY || 1;

  // Game container size = gridW * TILE × gridH * TILE (game-space)
  const mapPxW = gridW * TILE;
  const mapPxH = gridH * TILE;
  gameContainer.style.width  = mapPxW + 'px';
  gameContainer.style.height = mapPxH + 'px';
  gameContainer.style.transform = `scale(${CAMERA_SCALE})`;
  if (mapDef.imageUrl) {
    gameContainer.style.backgroundImage = `url(${mapDef.imageUrl})`;
    gameContainer.style.backgroundSize  = '100% 100%';
  } else {
    gameContainer.style.backgroundImage = '';
    gameContainer.style.background = '#1a2040';
  }

  // Draw wall overlays (visual only)
  Object.keys(walls).forEach(key => {
    const [gx, gy] = key.split(',').map(Number);
    const el = document.createElement('div');
    el.className = 'wall-block';
    el.style.left   = gx * TILE + 'px';
    el.style.top    = gy * TILE + 'px';
    el.style.width  = TILE + 'px';
    el.style.height = TILE + 'px';
    gameContainer.appendChild(el);
  });

  // ── Collision ────────────────────────────────
  function isSolid(gx, gy) {
    if (gx < 0 || gy < 0 || gx >= gridW || gy >= gridH) return true;
    return !!walls[`${gx},${gy}`];
  }
  function isSolidPx(px, py) {
    return isSolid(Math.floor(px / TILE), Math.floor(py / TILE));
  }
  function moveAndSlide(cx, cy, dx, dy) {
    let nx = cx + dx, ny = cy + dy;
    if (isSolidPx(nx-HITBOX,cy-HITBOX)||isSolidPx(nx+HITBOX-1,cy-HITBOX)||
        isSolidPx(nx-HITBOX,cy+HITBOX-1)||isSolidPx(nx+HITBOX-1,cy+HITBOX-1)) nx = cx;
    if (isSolidPx(nx-HITBOX,ny-HITBOX)||isSolidPx(nx+HITBOX-1,ny-HITBOX)||
        isSolidPx(nx-HITBOX,ny+HITBOX-1)||isSolidPx(nx+HITBOX-1,ny+HITBOX-1)) ny = cy;
    return { x: nx, y: ny };
  }

  // ── Firebase refs ────────────────────────────
  const db         = firebase.database();
  const playersRef = db.ref(`game_players/${mapId}`);
  const coinsRef   = db.ref(`game_coins/${mapId}`);
  const chatRef    = db.ref('chat');

  // ── Local player state ───────────────────────
  const playerId = currentUser.uid;
  let localX = spawnX * TILE + TILE/2;
  let localY = spawnY * TILE + TILE/2;
  let velX = 0, velY = 0;
  let camX = localX, camY = localY;
  let direction = 'right';
  const keys = {};
  let joyX = 0, joyY = 0;
  let lastFbSend = 0;

  // ── Players / coins tracking ─────────────────
  let remotePlayers  = {};
  let playerElements = {};
  let coinElements   = {};
  let chatBubbleTimers = {};

  // ── Create local player element ──────────────
  function createPlayerEl(pid, isYou) {
    const el = document.createElement('div');
    el.className = 'Character' + (isYou ? ' you' : '');
    el.dataset.color = playerProfile.color || 'blue';
    el.dataset.direction = 'right';
    el.innerHTML = `
      <div class="Character_shadow"></div>
      <div class="Character_sprite"></div>
      <div class="Character_name-container"><span class="char-name"></span></div>
      ${isYou ? '<div class="Character_you-arrow"></div>' : ''}
    `;
    playerElements[pid] = el;
    gameContainer.appendChild(el);
    return el;
  }

  function updatePlayerEl(pid, data) {
    const el = playerElements[pid];
    if (!el) return;
    el.dataset.color     = data.color     || 'blue';
    el.dataset.direction = data.direction || 'right';
    const nameEl = el.querySelector('.char-name');
    if (nameEl) nameEl.textContent = (data.name || 'PLAYER').slice(0,10);
    const px = data.px !== undefined ? data.px - TILE/2 : (data.x||0)*TILE;
    const py = data.py !== undefined ? data.py - TILE/2 - 4 : (data.y||0)*TILE - 4;
    el.style.transform = `translate3d(${px}px,${py}px,0)`;
  }

  // Create own element
  createPlayerEl(playerId, true);
  updatePlayerEl(playerId, {
    color: playerProfile.color, direction: 'right',
    name: playerProfile.name, px: localX, py: localY
  });

  // Register presence
  const myRef = playersRef.child(playerId);
  myRef.set({
    id: playerId, name: playerProfile.name,
    color: playerProfile.color, direction: 'right',
    x: spawnX, y: spawnY,
    px: localX, py: localY,
  });
  myRef.onDisconnect().remove();

  // ── Listen to remote players ─────────────────
  playersRef.on('child_added', snap => {
    const d = snap.val();
    if (d.id === playerId) return;
    remotePlayers[d.id] = d;
    if (!playerElements[d.id]) createPlayerEl(d.id, false);
    updatePlayerEl(d.id, d);
  });
  playersRef.on('child_changed', snap => {
    const d = snap.val();
    if (d.id === playerId) return;
    remotePlayers[d.id] = d;
    updatePlayerEl(d.id, d);
  });
  playersRef.on('child_removed', snap => {
    const d = snap.val();
    const el = playerElements[d.id];
    if (el) { el.remove(); delete playerElements[d.id]; }
    delete remotePlayers[d.id];
  });

  // ── Coins ────────────────────────────────────
  function spawnCoin() {
    if (!gameDestroyed) {
      const gx = 1 + Math.floor(Math.random() * (gridW - 2));
      const gy = 1 + Math.floor(Math.random() * (gridH - 2));
      if (!isSolid(gx, gy)) {
        const key = `${gx}_${gy}`;
        coinsRef.child(key).set({ x: gx, y: gy });
      }
      setTimeout(spawnCoin, rnd(COIN_INTERVAL));
    }
  }

  coinsRef.on('child_added', snap => {
    const d = snap.val();
    const key = snap.key;
    const el = document.createElement('div');
    el.className = 'Coin';
    el.innerHTML = '<div class="Coin_shadow"></div><div class="Coin_sprite"></div>';
    el.style.transform = `translate3d(${d.x*TILE}px,${d.y*TILE-4}px,0)`;
    coinElements[key] = { el, x: d.x, y: d.y };
    gameContainer.appendChild(el);
  });
  coinsRef.on('child_removed', snap => {
    const key = snap.key;
    if (coinElements[key]) {
      coinElements[key].el.remove();
      delete coinElements[key];
    }
  });

  // Only first player in map spawns coins
  spawnCoin();

  // ── Coin collection ──────────────────────────
  function checkCoins(gx, gy) {
    const key = `${gx}_${gy}`;
    if (coinElements[key]) {
      coinsRef.child(key).remove();
      playerRef.update({ coins: (playerProfile.coins||0) + 1 });
    }
  }

  // ── Camera ───────────────────────────────────
  function renderCamera() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const tx = vw/2 - camX * CAMERA_SCALE;
    const ty = vh/2 - camY * CAMERA_SCALE;
    cameraPan.style.transform = `translate(${tx}px,${ty}px)`;
  }

  // ── Game loop ─────────────────────────────────
  let lastTime = null;
  let rafId;
  let gameDestroyed = false;

  function gameLoop(ts) {
    if (gameDestroyed) return;
    rafId = requestAnimationFrame(gameLoop);
    if (!lastTime) lastTime = ts;
    lastTime = ts;

    let ix = 0, iy = 0;
    if (keys['ArrowLeft']||keys['KeyA']) ix -= 1;
    if (keys['ArrowRight']||keys['KeyD']) ix += 1;
    if (keys['ArrowUp']||keys['KeyW']) iy -= 1;
    if (keys['ArrowDown']||keys['KeyS']) iy += 1;
    if (Math.abs(joyX)>0.1||Math.abs(joyY)>0.1) { ix = joyX; iy = joyY; }
    if (ix && iy) { ix*=0.707; iy*=0.707; }

    if (ix||iy) {
      velX += ix*ACCEL; velY += iy*ACCEL;
      const sp = Math.sqrt(velX*velX+velY*velY);
      if (sp>MAX_SPEED) { velX=velX/sp*MAX_SPEED; velY=velY/sp*MAX_SPEED; }
    }
    velX *= FRICTION; velY *= FRICTION;
    if (Math.abs(velX)<0.01) velX=0;
    if (Math.abs(velY)<0.01) velY=0;

    if (velX||velY) {
      const res = moveAndSlide(localX, localY, velX, velY);
      if (res.x===localX) velX=0;
      if (res.y===localY) velY=0;
      localX = res.x; localY = res.y;
      if (velX>0.05) direction='right';
      else if (velX<-0.05) direction='left';
    }

    // Update own element
    const myEl = playerElements[playerId];
    if (myEl) {
      myEl.style.transform = `translate3d(${localX-TILE/2}px,${localY-TILE/2-4}px,0)`;
      myEl.dataset.direction = direction;
    }

    // Camera
    camX += (localX-camX)*0.12;
    camY += (localY-camY)*0.12;
    renderCamera();

    // Firebase sync
    const n = performance.now();
    if (n - lastFbSend > FB_THROTTLE) {
      lastFbSend = n;
      const gx = Math.floor(localX/TILE), gy = Math.floor(localY/TILE);
      myRef.update({ px: localX, py: localY, x: gx, y: gy, direction, color: playerProfile.color });
      checkCoins(gx, gy);
      document.getElementById('game-coins').textContent = playerProfile.coins||0;
      document.getElementById('game-coords').textContent = `${gx},${gy}`;
    }
  }
  rafId = requestAnimationFrame(gameLoop);

  // ── Input ────────────────────────────────────
  function onKeyDown(e) { keys[e.code] = true; }
  function onKeyUp(e)   { keys[e.code] = false; }
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup',   onKeyUp);

  const joystickBase  = document.getElementById('joystick-base');
  const joystickThumb = document.getElementById('joystick-thumb');
  let joystickInst = null;
  if (joystickBase && joystickThumb) {
    joystickInst = new Joystick(joystickBase, joystickThumb, (x,y)=>{ joyX=x; joyY=y; });
  }

  window.addEventListener('resize', renderCamera);

  // ── Chat ─────────────────────────────────────
  let chatScope = 'world'; // 'world' | 'map'
  const chatMessages = document.getElementById('chat-messages');
  const chatInput    = document.getElementById('chat-input');
  let renderedChatKeys = new Set();

  document.querySelectorAll('.chat-tab[data-scope]').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.chat-tab[data-scope]').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      chatScope = tab.dataset.scope;
      renderedChatKeys.clear();
      chatMessages.innerHTML = '';
      loadChat();
    });
  });

  document.getElementById('chat-toggle').addEventListener('click', () => {
    document.getElementById('chat-panel').classList.toggle('collapsed');
    document.getElementById('chat-toggle').textContent =
      document.getElementById('chat-panel').classList.contains('collapsed') ? '▲' : '▼';
  });

  function loadChat() {
    const cutoff = now() - CHAT_TTL;
    const ref = chatScope === 'world'
      ? chatRef.orderByChild('ts').startAt(cutoff)
      : chatRef.orderByChild('ts').startAt(cutoff);

    // Remove old listener
    chatRef.off('child_added');

    chatRef.orderByChild('ts').startAt(now() - CHAT_TTL).on('child_added', snap => {
      if (gameDestroyed) return;
      const msg = snap.val();
      if (!msg) return;
      if (chatScope === 'map' && msg.mapId !== mapId) return;
      if (renderedChatKeys.has(snap.key)) return;
      renderedChatKeys.add(snap.key);
      renderChatMsg(msg);
    });
  }

  function renderChatMsg(msg) {
    const el = document.createElement('div');
    const isWorld = !msg.mapId || msg.mapId === 'world';
    el.className = `chat-msg ${isWorld ? 'world-msg' : 'map-msg'}`;
    el.innerHTML = `
      <span class="msg-scope">${isWorld ? '🌍' : '🗺️'}</span>
      <span class="msg-author">${escapeHTML(msg.name||'?')}</span>
      <span class="msg-text">${escapeHTML(msg.text||'')}</span>
    `;
    chatMessages.appendChild(el);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // Show bubble on player
    showChatBubble(msg.uid, msg.text);
  }

  function showChatBubble(uid, text) {
    const el = playerElements[uid];
    if (!el) return;
    // Remove old bubble
    const old = el.querySelector('.chat-bubble');
    if (old) old.remove();
    if (chatBubbleTimers[uid]) clearTimeout(chatBubbleTimers[uid]);

    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';
    bubble.textContent = text.slice(0, 24) + (text.length>24?'…':'');
    el.appendChild(bubble);
    chatBubbleTimers[uid] = setTimeout(() => {
      bubble.remove();
      delete chatBubbleTimers[uid];
    }, BUBBLE_TTL);
  }

  function sendChat() {
    const text = chatInput.value.trim();
    if (!text || !currentUser) return;
    chatInput.value = '';
    const msg = {
      uid: currentUser.uid,
      name: playerProfile.name || 'PLAYER',
      text,
      ts: firebase.database.ServerValue.TIMESTAMP,
      mapId: chatScope === 'map' ? mapId : 'world',
    };
    chatRef.push(msg);
  }

  document.getElementById('btn-send-chat').addEventListener('click', sendChat);
  chatInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); }
  });

  // Cleanup old chat messages periodically
  function cleanupChat() {
    if (gameDestroyed) return;
    const cutoff = now() - CHAT_TTL;
    chatRef.orderByChild('ts').endAt(cutoff).once('value', snap => {
      snap.forEach(child => child.ref.remove());
    });
    setTimeout(cleanupChat, CHAT_CLEANUP_INTERVAL);
  }
  cleanupChat();
  loadChat();

  // ── Destroy function ─────────────────────────
  function destroy() {
    gameDestroyed = true;
    if (rafId) cancelAnimationFrame(rafId);
    document.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('keyup',   onKeyUp);
    window.removeEventListener('resize', renderCamera);
    chatRef.off('child_added');
    playersRef.off();
    coinsRef.off();
    myRef.remove();
    gameContainer.innerHTML = '';
    gameContainer.style.backgroundImage = '';
  }

  // Store game handle
  game = { destroy };
}

// ═══════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════
function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}
