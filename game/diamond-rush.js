/* ============================================================
   DIAMOND RUSH — Motor único para los 9 niveles
   Estilo top-down, movimiento por celdas, adictivo y competitivo
   ============================================================ */
(function () {
  'use strict';

  // ---------- Configuración ----------
  const CELL = 36;
  const COLS = 20;
  const ROWS = 13;
  const MOVE_MS = 130; // milisegundos por movimiento del jugador

  // ---------- Estado ----------
  let ctx, canvas;
  let level, onEnd;
  let player;    // {gx, gy, px, py, dir, moving, moveT}
  let tokens;    // [{gx, gy, text, correct, collected, glow}]
  let enemies;   // [{gx, gy, px, py, dir, type, moveT, path, pathIdx}]
  let walls;     // Set de "gx,gy"
  let door;      // {gx, gy, open}
  let score;
  let combo;
  let maxCombo;
  let totalCorrect;
  let collectedCorrect;
  let mistakes;
  let lives;
  let timeLeft;
  let running;
  let paused;
  let rafHandle;
  let timerHandle;
  let lastFrame;
  let keys;
  let particles;
  let messages;   // Mensajes flotantes tipo +50
  let startTime;
  let currentTokenHover;

  // ---------- API pública ----------
  window.DiamondRush = {
    start(lvl, cb) {
      level = lvl;
      onEnd = cb;
      canvas = document.getElementById('lab-canvas');
      canvas.width = COLS * CELL;
      canvas.height = ROWS * CELL;
      ctx = canvas.getContext('2d');

      score = 0;
      combo = 0;
      maxCombo = 0;
      collectedCorrect = 0;
      mistakes = 0;
      lives = 3;
      timeLeft = (level.tiempo_seg) || 90;
      running = true;
      paused = false;
      keys = {};
      particles = [];
      messages = [];
      currentTokenHover = null;
      startTime = Date.now();

      generateMap();
      player = {
        gx: 1, gy: 1,
        px: 1 * CELL, py: 1 * CELL,
        dir: 'down',
        moving: false,
        moveT: 0,
        fromX: 1 * CELL, fromY: 1 * CELL,
        toX: 1 * CELL, toY: 1 * CELL
      };
      updateHUD();
      bindControls();
      startTimer();
      lastFrame = performance.now();
      loop();
      setInstr(level.instruccion_juego || 'Recoge los tokens correctos, esquiva enemigos y trampas.');
    },
    stop() {
      running = false;
      if (rafHandle) cancelAnimationFrame(rafHandle);
      if (timerHandle) clearInterval(timerHandle);
    }
  };

  // ============================================================
  // GENERACIÓN DE MAPA
  // ============================================================
  function generateMap() {
    walls = new Set();
    tokens = [];
    enemies = [];
    door = { gx: COLS - 2, gy: ROWS - 2, open: false };

    // Muros del borde
    for (let x = 0; x < COLS; x++) {
      walls.add(x + ',0');
      walls.add(x + ',' + (ROWS - 1));
    }
    for (let y = 1; y < ROWS - 1; y++) {
      walls.add('0,' + y);
      walls.add((COLS - 1) + ',' + y);
    }

    // Muros internos según dificultad (nivel 1 = pocos, nivel 9 = muchos)
    const wallDensity = Math.min(0.10 + level.num * 0.015, 0.22);
    const totalInternal = Math.floor((COLS - 2) * (ROWS - 2) * wallDensity);
    let placed = 0;
    while (placed < totalInternal) {
      const wx = 2 + Math.floor(Math.random() * (COLS - 4));
      const wy = 2 + Math.floor(Math.random() * (ROWS - 4));
      // No bloquear zona de spawn del player
      if (wx <= 2 && wy <= 2) continue;
      // No bloquear zona de la puerta
      if (Math.abs(wx - door.gx) <= 1 && Math.abs(wy - door.gy) <= 1) continue;
      const key = wx + ',' + wy;
      if (walls.has(key)) continue;
      walls.add(key);
      placed++;
    }

    // Colocar tokens correctos e incorrectos
    const corrList = shuffle([...(level.tokens_correctos || [])]).slice(0, 5 + Math.min(level.num, 3));
    const wrongList = shuffle([...(level.tokens_incorrectos || [])]).slice(0, 3 + Math.floor(level.num / 3));
    totalCorrect = corrList.length;

    corrList.forEach(text => placeToken(text, true));
    wrongList.forEach(text => placeToken(text, false));

    // Colocar enemigos según nivel
    const numEnemies = Math.min(1 + Math.floor(level.num / 2), 5);
    for (let i = 0; i < numEnemies; i++) placeEnemy(i);
  }

  function placeToken(text, correct) {
    let attempts = 0;
    while (attempts < 100) {
      const gx = 2 + Math.floor(Math.random() * (COLS - 4));
      const gy = 2 + Math.floor(Math.random() * (ROWS - 4));
      const key = gx + ',' + gy;
      if (walls.has(key)) { attempts++; continue; }
      if (tokens.some(t => t.gx === gx && t.gy === gy)) { attempts++; continue; }
      if (gx === 1 && gy === 1) { attempts++; continue; }
      tokens.push({ gx, gy, text, correct, collected: false, glow: 0 });
      return;
    }
  }

  function placeEnemy(idx) {
    let attempts = 0;
    while (attempts < 100) {
      const gx = 4 + Math.floor(Math.random() * (COLS - 6));
      const gy = 3 + Math.floor(Math.random() * (ROWS - 5));
      const key = gx + ',' + gy;
      if (walls.has(key)) { attempts++; continue; }
      const type = ['patrol_h', 'patrol_v', 'random'][idx % 3];
      enemies.push({
        gx, gy,
        px: gx * CELL, py: gy * CELL,
        fromX: gx * CELL, fromY: gy * CELL,
        toX: gx * CELL, toY: gy * CELL,
        dir: type === 'patrol_h' ? 'right' : 'down',
        type,
        moving: false,
        moveT: 0,
        speed: 180 + Math.random() * 100
      });
      return;
    }
  }

  // ============================================================
  // LOOP PRINCIPAL
  // ============================================================
  function loop() {
    if (!running) return;
    const now = performance.now();
    const dt = Math.min(now - lastFrame, 60);
    lastFrame = now;
    if (!paused) update(dt);
    render();
    rafHandle = requestAnimationFrame(loop);
  }

  function update(dt) {
    // Player movimiento
    if (player.moving) {
      player.moveT += dt;
      const p = Math.min(player.moveT / MOVE_MS, 1);
      player.px = player.fromX + (player.toX - player.fromX) * p;
      player.py = player.fromY + (player.toY - player.fromY) * p;
      if (p >= 1) {
        player.moving = false;
        player.px = player.toX;
        player.py = player.toY;
        checkCollisions();
      }
    } else {
      // Procesar teclas
      let ndir = null;
      if (keys['ArrowUp'] || keys['w'] || keys['W']) ndir = 'up';
      else if (keys['ArrowDown'] || keys['s'] || keys['S']) ndir = 'down';
      else if (keys['ArrowLeft'] || keys['a'] || keys['A']) ndir = 'left';
      else if (keys['ArrowRight'] || keys['d'] || keys['D']) ndir = 'right';
      if (ndir) tryMove(ndir);
    }

    // Enemigos
    enemies.forEach(e => updateEnemy(e, dt));

    // Detectar hover de token (para mostrar texto)
    currentTokenHover = null;
    for (const t of tokens) {
      if (t.collected) continue;
      const dist = Math.abs(t.gx - player.gx) + Math.abs(t.gy - player.gy);
      if (dist <= 1) { currentTokenHover = t; break; }
      t.glow = 0;
    }
    if (currentTokenHover) currentTokenHover.glow = 1;

    // Actualizar partículas
    particles = particles.filter(p => {
      p.life -= dt;
      p.px += p.vx * dt / 1000;
      p.py += p.vy * dt / 1000;
      p.vy += 300 * dt / 1000;
      return p.life > 0;
    });

    // Mensajes flotantes
    messages = messages.filter(m => {
      m.life -= dt;
      m.py -= 30 * dt / 1000;
      return m.life > 0;
    });
  }

  function tryMove(dir) {
    const deltas = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
    const [dx, dy] = deltas[dir];
    const nx = player.gx + dx;
    const ny = player.gy + dy;
    const key = nx + ',' + ny;
    // Puerta
    if (nx === door.gx && ny === door.gy) {
      if (door.open) {
        // Ganó el nivel
        completeLevel();
        return;
      }
      // Cerrada
      addMessage('¡Recoge todos los verdes primero!', door.gx, door.gy, '#ff5c5c');
      return;
    }
    if (walls.has(key)) return;
    if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) return;
    // Ok mover
    player.dir = dir;
    player.gx = nx;
    player.gy = ny;
    player.moving = true;
    player.moveT = 0;
    player.fromX = player.px;
    player.fromY = player.py;
    player.toX = nx * CELL;
    player.toY = ny * CELL;
  }

  function updateEnemy(e, dt) {
    if (e.moving) {
      e.moveT += dt;
      const p = Math.min(e.moveT / e.speed, 1);
      e.px = e.fromX + (e.toX - e.fromX) * p;
      e.py = e.fromY + (e.toY - e.fromY) * p;
      if (p >= 1) { e.moving = false; e.px = e.toX; e.py = e.toY; }
      // Colisión con player
      const dist = Math.abs(e.gx - player.gx) + Math.abs(e.gy - player.gy);
      if (dist === 0) hitByEnemy();
      return;
    }
    // Decidir siguiente movimiento
    let dir = e.dir;
    if (e.type === 'random') {
      const dirs = ['up', 'down', 'left', 'right'];
      dir = dirs[Math.floor(Math.random() * 4)];
    }
    const deltas = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
    const [dx, dy] = deltas[dir];
    const nx = e.gx + dx;
    const ny = e.gy + dy;
    const key = nx + ',' + ny;
    if (walls.has(key) || nx < 1 || nx >= COLS - 1 || ny < 1 || ny >= ROWS - 1) {
      // Invertir dirección si es patrol
      if (dir === 'up') dir = 'down';
      else if (dir === 'down') dir = 'up';
      else if (dir === 'left') dir = 'right';
      else if (dir === 'right') dir = 'left';
      e.dir = dir;
      return;
    }
    e.dir = dir;
    e.gx = nx;
    e.gy = ny;
    e.moving = true;
    e.moveT = 0;
    e.fromX = e.px;
    e.fromY = e.py;
    e.toX = nx * CELL;
    e.toY = ny * CELL;
    // Colisión con player
    const dist = Math.abs(e.gx - player.gx) + Math.abs(e.gy - player.gy);
    if (dist === 0) hitByEnemy();
  }

  function checkCollisions() {
    for (const t of tokens) {
      if (t.collected) continue;
      if (t.gx === player.gx && t.gy === player.gy) {
        collectToken(t);
        return;
      }
    }
  }

  function collectToken(t) {
    t.collected = true;
    if (t.correct) {
      combo++;
      maxCombo = Math.max(maxCombo, combo);
      const pts = 50 + combo * 5;
      score += pts;
      collectedCorrect++;
      addMessage('+' + pts + (combo > 1 ? ' x' + combo : ''), t.gx, t.gy, '#4dff88');
      spawnParticles(t.gx * CELL + CELL / 2, t.gy * CELL + CELL / 2, '#4dff88', 12);
      if (collectedCorrect >= totalCorrect) {
        door.open = true;
        addMessage('¡PUERTA ABIERTA!', door.gx, door.gy, '#ffd94d');
      }
    } else {
      combo = 0;
      score = Math.max(0, score - 30);
      mistakes++;
      addMessage('-30 commodity', t.gx, t.gy, '#ff5c5c');
      spawnParticles(t.gx * CELL + CELL / 2, t.gy * CELL + CELL / 2, '#ff5c5c', 8);
      lives--;
      if (lives <= 0) return finish('Comiste demasiados commodities');
    }
    updateHUD();
  }

  function hitByEnemy() {
    combo = 0;
    lives--;
    score = Math.max(0, score - 20);
    addMessage('¡Te atrapó!', player.gx, player.gy, '#ff5c5c');
    spawnParticles(player.px + CELL / 2, player.py + CELL / 2, '#ff5c5c', 20);
    updateHUD();
    if (lives <= 0) return finish('Te atraparon los enemigos');
    // Respawn en (1,1)
    player.gx = 1; player.gy = 1;
    player.px = CELL; player.py = CELL;
    player.moving = false;
  }

  function completeLevel() {
    const timeBonus = timeLeft * 5;
    const comboBonus = maxCombo * 10;
    score += 200 + timeBonus + comboBonus;
    addMessage('¡NIVEL COMPLETADO! +' + (200 + timeBonus + comboBonus), 10, 6, '#ffd94d');
    setTimeout(() => finish('¡Completaste el nivel!'), 800);
  }

  function finish(reason) {
    running = false;
    if (timerHandle) clearInterval(timerHandle);
    if (rafHandle) cancelAnimationFrame(rafHandle);
    const dur = Math.floor((Date.now() - startTime) / 1000);
    const finalScore = Math.max(0, score);
    setTimeout(() => onEnd(finalScore, dur), 400);
  }

  // ============================================================
  // TIMER
  // ============================================================
  function startTimer() {
    if (timerHandle) clearInterval(timerHandle);
    timerHandle = setInterval(() => {
      if (!running || paused) return;
      timeLeft--;
      updateHUD();
      if (timeLeft <= 0) finish('Se acabó el tiempo');
    }, 1000);
  }

  // ============================================================
  // RENDER
  // ============================================================
  function render() {
    // Fondo
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, '#0a0f1e');
    grad.addColorStop(1, '#1a1a2e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid sutil
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath(); ctx.moveTo(x * CELL, 0); ctx.lineTo(x * CELL, ROWS * CELL); ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath(); ctx.moveTo(0, y * CELL); ctx.lineTo(COLS * CELL, y * CELL); ctx.stroke();
    }

    // Muros
    walls.forEach(key => {
      const [x, y] = key.split(',').map(Number);
      const px = x * CELL, py = y * CELL;
      // Muro base
      const wgrad = ctx.createLinearGradient(px, py, px, py + CELL);
      wgrad.addColorStop(0, '#3a4a6a');
      wgrad.addColorStop(1, '#2a3550');
      ctx.fillStyle = wgrad;
      ctx.fillRect(px + 1, py + 1, CELL - 2, CELL - 2);
      // Highlight top
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(px + 1, py + 1, CELL - 2, 3);
    });

    // Puerta
    const dpx = door.gx * CELL, dpy = door.gy * CELL;
    ctx.fillStyle = door.open ? '#4dff88' : '#c89b32';
    ctx.fillRect(dpx + 4, dpy + 4, CELL - 8, CELL - 8);
    ctx.fillStyle = door.open ? '#0a3a20' : '#5a4a1a';
    ctx.font = 'bold 20px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(door.open ? '✓' : '🚪', dpx + CELL / 2, dpy + CELL / 2);

    // Tokens
    tokens.forEach(t => {
      if (t.collected) return;
      const px = t.gx * CELL, py = t.gy * CELL;
      // Sombra
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.ellipse(px + CELL / 2, py + CELL - 4, CELL / 3, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      // Gema
      const cx = px + CELL / 2;
      const cy = py + CELL / 2 + Math.sin(Date.now() / 300 + t.gx) * 2;
      const size = CELL / 3;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(Math.PI / 4);
      const tgrad = ctx.createLinearGradient(-size, -size, size, size);
      if (t.correct) {
        tgrad.addColorStop(0, '#a0ffb0');
        tgrad.addColorStop(1, '#2e8b57');
      } else {
        tgrad.addColorStop(0, '#ff9090');
        tgrad.addColorStop(1, '#c0392b');
      }
      ctx.fillStyle = tgrad;
      ctx.fillRect(-size, -size, size * 2, size * 2);
      ctx.strokeStyle = t.correct ? '#4dff88' : '#ff5c5c';
      ctx.lineWidth = 2;
      ctx.strokeRect(-size, -size, size * 2, size * 2);
      ctx.restore();
      // Brillo si hover
      if (t.glow > 0) {
        ctx.strokeStyle = t.correct ? 'rgba(77,255,136,0.6)' : 'rgba(255,92,92,0.6)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, cy, CELL / 2 + 2, 0, Math.PI * 2);
        ctx.stroke();
      }
    });

    // Enemigos
    enemies.forEach(e => {
      const cx = e.px + CELL / 2, cy = e.py + CELL / 2;
      // Sombra
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.ellipse(cx, cy + CELL / 3, CELL / 3, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      // Cuerpo
      const egrad = ctx.createRadialGradient(cx - 4, cy - 4, 2, cx, cy, CELL / 2);
      egrad.addColorStop(0, '#e884ff');
      egrad.addColorStop(1, '#6e3c8c');
      ctx.fillStyle = egrad;
      ctx.beginPath();
      ctx.arc(cx, cy, CELL / 2 - 4, 0, Math.PI * 2);
      ctx.fill();
      // Ojos
      ctx.fillStyle = 'white';
      ctx.beginPath();
      ctx.arc(cx - 5, cy - 3, 3, 0, Math.PI * 2);
      ctx.arc(cx + 5, cy - 3, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'black';
      ctx.beginPath();
      ctx.arc(cx - 5, cy - 3, 1.5, 0, Math.PI * 2);
      ctx.arc(cx + 5, cy - 3, 1.5, 0, Math.PI * 2);
      ctx.fill();
    });

    // Player (estratega dorado)
    const ppx = player.px + CELL / 2;
    const ppy = player.py + CELL / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(ppx, ppy + CELL / 3, CELL / 3, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    // Cuerpo
    const pgrad = ctx.createRadialGradient(ppx - 4, ppy - 4, 2, ppx, ppy, CELL / 2);
    pgrad.addColorStop(0, '#ffe888');
    pgrad.addColorStop(1, '#c89b32');
    ctx.fillStyle = pgrad;
    ctx.beginPath();
    ctx.arc(ppx, ppy, CELL / 2 - 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#8a6a1a';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Ojos
    ctx.fillStyle = 'white';
    const eyeOff = { up: -4, down: 4, left: 0, right: 0 }[player.dir] || 0;
    const eyeH = player.dir === 'up' || player.dir === 'down' ? eyeOff : -3;
    ctx.beginPath();
    ctx.arc(ppx - 5, ppy + eyeH, 3, 0, Math.PI * 2);
    ctx.arc(ppx + 5, ppy + eyeH, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0a3a20';
    ctx.beginPath();
    ctx.arc(ppx - 5, ppy + eyeH, 1.5, 0, Math.PI * 2);
    ctx.arc(ppx + 5, ppy + eyeH, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Partículas
    particles.forEach(p => {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, p.life / 500);
      ctx.beginPath();
      ctx.arc(p.px, p.py, p.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Mensajes flotantes
    messages.forEach(m => {
      ctx.font = 'bold 14px system-ui';
      ctx.textAlign = 'center';
      ctx.globalAlpha = Math.min(1, m.life / 800);
      ctx.fillStyle = m.color;
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.lineWidth = 3;
      ctx.strokeText(m.text, m.px, m.py);
      ctx.fillText(m.text, m.px, m.py);
    });
    ctx.globalAlpha = 1;

    // Tooltip del token cercano
    if (currentTokenHover) {
      const t = currentTokenHover;
      const tx = t.gx * CELL + CELL / 2;
      const ty = t.gy * CELL - 8;
      ctx.font = 'bold 12px system-ui';
      ctx.textAlign = 'center';
      const w = ctx.measureText(t.text).width + 12;
      ctx.fillStyle = 'rgba(0,0,0,0.85)';
      ctx.fillRect(tx - w / 2, ty - 14, w, 18);
      ctx.strokeStyle = t.correct ? '#4dff88' : '#ff5c5c';
      ctx.lineWidth = 1;
      ctx.strokeRect(tx - w / 2, ty - 14, w, 18);
      ctx.fillStyle = 'white';
      ctx.fillText(t.text, tx, ty);
    }

    // Combo grande arriba
    if (combo >= 2) {
      ctx.font = 'bold 24px system-ui';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffd94d';
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.lineWidth = 3;
      ctx.strokeText('x' + combo + ' COMBO', canvas.width / 2, 30);
      ctx.fillText('x' + combo + ' COMBO', canvas.width / 2, 30);
    }

    // Overlay de pausa
    if (paused) {
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'white';
      ctx.font = 'bold 48px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('PAUSA', canvas.width / 2, canvas.height / 2 - 10);
      ctx.font = '16px system-ui';
      ctx.fillText('ESPACIO para continuar', canvas.width / 2, canvas.height / 2 + 20);
    }
  }

  function addMessage(text, gx, gy, color) {
    messages.push({
      text, px: gx * CELL + CELL / 2, py: gy * CELL,
      color, life: 1000
    });
  }

  function spawnParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      particles.push({
        px: x, py: y,
        vx: (Math.random() - 0.5) * 300,
        vy: -Math.random() * 300 - 50,
        r: Math.random() * 3 + 1,
        color, life: 500
      });
    }
  }

  // ============================================================
  // HUD y controles
  // ============================================================
  function updateHUD() {
    document.getElementById('lab-hud-score').textContent = score;
    document.getElementById('lab-hud-lives').textContent =
      collectedCorrect + '/' + totalCorrect + '  ' + '❤'.repeat(Math.max(0, lives));
    const t = document.getElementById('lab-hud-time');
    t.textContent = timeLeft + 's';
    t.classList.remove('timer-warning', 'timer-danger');
    if (timeLeft <= 10) t.classList.add('timer-danger');
    else if (timeLeft <= 25) t.classList.add('timer-warning');
  }

  let bound = false;
  function bindControls() {
    if (bound) return;
    bound = true;
    document.addEventListener('keydown', e => {
      if (!running) return;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'W', 'a', 'A', 's', 'S', 'd', 'D', ' '].includes(e.key)) {
        e.preventDefault();
        if (e.key === ' ') { paused = !paused; return; }
        keys[e.key] = true;
      }
    });
    document.addEventListener('keyup', e => {
      keys[e.key] = false;
    });
  }

  function setInstr(text) {
    const el = document.getElementById('lab-game-instr');
    if (el) el.textContent = text;
  }

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
})();
