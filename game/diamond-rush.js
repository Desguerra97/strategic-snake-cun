/* ============================================================
   DIAMOND RUSH ESTRATÉGICO — Motor único para los 9 niveles
   Mecánicas: portales, diamantes bloqueados con quiz, enemigos
   ============================================================ */
(function () {
  'use strict';

  const CELL = 36;
  const COLS = 20;
  const ROWS = 13;
  const MOVE_MS = 130;

  // Colores de portales por par (hasta 4 pares)
  const PORTAL_COLORS = [
    { a: '#4dcfff', b: '#0a6ba0' },
    { a: '#ffa64d', b: '#a05f0a' },
    { a: '#c78dff', b: '#6a3aa0' },
    { a: '#4dff88', b: '#0a8040' }
  ];

  let ctx, canvas;
  let level, onEnd;
  let player, tokens, enemies, walls, door, portals;
  let score, combo, maxCombo;
  let totalCorrect, collectedCorrect;
  let mistakes, lives, timeLeft;
  let running, paused, quizActive;
  let rafHandle, timerHandle;
  let lastFrame, keys;
  let particles, messages;
  let startTime, currentTokenHover;
  let portalCooldown;
  let levelCompleted;

  window.DiamondRush = {
    start(lvl, cb) {
      level = lvl;
      onEnd = cb;
      canvas = document.getElementById('lab-canvas');
      canvas.width = COLS * CELL;
      canvas.height = ROWS * CELL;
      ctx = canvas.getContext('2d');

      score = 0; combo = 0; maxCombo = 0;
      collectedCorrect = 0; mistakes = 0;
      lives = 3;
      timeLeft = (level.tiempo_seg) || 90;
      running = true; paused = false; quizActive = false;
      levelCompleted = false;
      keys = {}; particles = []; messages = [];
      currentTokenHover = null; portalCooldown = 0;
      startTime = Date.now();

      generateMap();
      player = {
        gx: 1, gy: 1,
        px: CELL, py: CELL,
        dir: 'down', moving: false, moveT: 0,
        fromX: CELL, fromY: CELL,
        toX: CELL, toY: CELL
      };
      updateHUD();
      bindControls();
      startTimer();
      lastFrame = performance.now();
      loop();
      setInstr(level.instruccion_juego || '');
    },
    stop() {
      running = false;
      if (rafHandle) cancelAnimationFrame(rafHandle);
      if (timerHandle) clearInterval(timerHandle);
      closeQuiz();
    }
  };

  // ============================================================
  // GENERACIÓN DE MAPA
  // ============================================================
  function generateMap() {
    walls = new Set();
    tokens = [];
    enemies = [];
    portals = [];
    door = { gx: COLS - 2, gy: ROWS - 2, open: false };

    const dif = level.dificultad || { enemigos: 1, portales: 0, bloqueados: 0, muros_densidad: 0.10 };

    // Bordes
    for (let x = 0; x < COLS; x++) {
      walls.add(x + ',0');
      walls.add(x + ',' + (ROWS - 1));
    }
    for (let y = 1; y < ROWS - 1; y++) {
      walls.add('0,' + y);
      walls.add((COLS - 1) + ',' + y);
    }

    // Muros internos
    const totalInternal = Math.floor((COLS - 2) * (ROWS - 2) * dif.muros_densidad);
    let placed = 0;
    let attempts = 0;
    while (placed < totalInternal && attempts < 300) {
      attempts++;
      const wx = 2 + Math.floor(Math.random() * (COLS - 4));
      const wy = 2 + Math.floor(Math.random() * (ROWS - 4));
      if (wx <= 2 && wy <= 2) continue;
      if (Math.abs(wx - door.gx) <= 1 && Math.abs(wy - door.gy) <= 1) continue;
      const key = wx + ',' + wy;
      if (walls.has(key)) continue;
      walls.add(key);
      placed++;
    }

    // Portales (pares)
    for (let p = 0; p < dif.portales; p++) {
      const a = randomEmptyCell();
      const b = randomEmptyCell();
      if (a && b) {
        portals.push({ id: p, a: a, b: b, color: PORTAL_COLORS[p % PORTAL_COLORS.length] });
      }
    }

    // Tokens
    const corrList = shuffle([...(level.tokens_correctos || [])]).slice(0, 5 + Math.min(level.num, 3));
    const wrongList = shuffle([...(level.tokens_incorrectos || [])]).slice(0, 3 + Math.floor(level.num / 3));
    totalCorrect = corrList.length;

    const quizzes = level.quiz_bloqueo || [];
    const numBloqueados = Math.min(dif.bloqueados, corrList.length, quizzes.length * 3);

    corrList.forEach((text, i) => {
      const cell = randomEmptyCell();
      if (!cell) return;
      const bloqueado = i < numBloqueados;
      const quiz = bloqueado && quizzes.length > 0 ? quizzes[i % quizzes.length] : null;
      tokens.push({
        gx: cell.x, gy: cell.y, text, correct: true,
        collected: false, glow: 0,
        bloqueado, quiz, unlockedByGroup: false
      });
    });
    wrongList.forEach(text => {
      const cell = randomEmptyCell();
      if (!cell) return;
      tokens.push({
        gx: cell.x, gy: cell.y, text, correct: false,
        collected: false, glow: 0, bloqueado: false
      });
    });

    // Enemigos
    for (let i = 0; i < dif.enemigos; i++) placeEnemy(i);
  }

  function randomEmptyCell() {
    for (let att = 0; att < 100; att++) {
      const x = 2 + Math.floor(Math.random() * (COLS - 4));
      const y = 2 + Math.floor(Math.random() * (ROWS - 4));
      const key = x + ',' + y;
      if (walls.has(key)) continue;
      if (tokens.some(t => t.gx === x && t.gy === y)) continue;
      if (portals.some(p => (p.a.x === x && p.a.y === y) || (p.b.x === x && p.b.y === y))) continue;
      if (x === 1 && y === 1) continue;
      if (x === door.gx && y === door.gy) continue;
      return { x, y };
    }
    return null;
  }

  function placeEnemy(idx) {
    const cell = randomEmptyCell();
    if (!cell) return;
    const type = ['patrol_h', 'patrol_v', 'random'][idx % 3];
    enemies.push({
      gx: cell.x, gy: cell.y,
      px: cell.x * CELL, py: cell.y * CELL,
      fromX: cell.x * CELL, fromY: cell.y * CELL,
      toX: cell.x * CELL, toY: cell.y * CELL,
      dir: type === 'patrol_h' ? 'right' : 'down',
      type, moving: false, moveT: 0,
      speed: 180 + Math.random() * 100
    });
  }

  // ============================================================
  // LOOP PRINCIPAL
  // ============================================================
  function loop() {
    if (!running) return;
    const now = performance.now();
    const dt = Math.min(now - lastFrame, 60);
    lastFrame = now;
    if (!paused && !quizActive) update(dt);
    render();
    rafHandle = requestAnimationFrame(loop);
  }

  function update(dt) {
    if (portalCooldown > 0) portalCooldown -= dt;

    if (player.moving) {
      player.moveT += dt;
      const p = Math.min(player.moveT / MOVE_MS, 1);
      player.px = player.fromX + (player.toX - player.fromX) * p;
      player.py = player.fromY + (player.toY - player.fromY) * p;
      if (p >= 1) {
        player.moving = false;
        player.px = player.toX;
        player.py = player.toY;
        onArriveCell();
      }
    } else {
      let ndir = null;
      if (keys['ArrowUp'] || keys['w'] || keys['W']) ndir = 'up';
      else if (keys['ArrowDown'] || keys['s'] || keys['S']) ndir = 'down';
      else if (keys['ArrowLeft'] || keys['a'] || keys['A']) ndir = 'left';
      else if (keys['ArrowRight'] || keys['d'] || keys['D']) ndir = 'right';
      if (ndir) tryMove(ndir);
    }

    enemies.forEach(e => updateEnemy(e, dt));

    currentTokenHover = null;
    for (const t of tokens) {
      if (t.collected) continue;
      const dist = Math.abs(t.gx - player.gx) + Math.abs(t.gy - player.gy);
      if (dist <= 1) { currentTokenHover = t; break; }
      t.glow = 0;
    }
    if (currentTokenHover) currentTokenHover.glow = 1;

    particles = particles.filter(p => {
      p.life -= dt;
      p.px += p.vx * dt / 1000;
      p.py += p.vy * dt / 1000;
      p.vy += 300 * dt / 1000;
      return p.life > 0;
    });
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

    if (nx === door.gx && ny === door.gy) {
      if (door.open) return completeLevel();
      addMessage('¡Recoge todos los verdes!', door.gx, door.gy, '#ff5c5c');
      return;
    }
    if (walls.has(key)) return;
    if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) return;

    player.dir = dir;
    player.gx = nx; player.gy = ny;
    player.moving = true; player.moveT = 0;
    player.fromX = player.px; player.fromY = player.py;
    player.toX = nx * CELL; player.toY = ny * CELL;
  }

  function onArriveCell() {
    // Portal?
    if (portalCooldown <= 0) {
      for (const p of portals) {
        if (p.a.x === player.gx && p.a.y === player.gy) {
          teleport(p.b);
          return;
        }
        if (p.b.x === player.gx && p.b.y === player.gy) {
          teleport(p.a);
          return;
        }
      }
    }
    // Token?
    for (const t of tokens) {
      if (t.collected) continue;
      if (t.gx === player.gx && t.gy === player.gy) {
        interactToken(t);
        return;
      }
    }
  }

  function teleport(target) {
    spawnParticles(player.px + CELL / 2, player.py + CELL / 2, '#7dd6ff', 15);
    player.gx = target.x; player.gy = target.y;
    player.px = target.x * CELL; player.py = target.y * CELL;
    player.fromX = player.px; player.fromY = player.py;
    player.toX = player.px; player.toY = player.py;
    portalCooldown = 800; // ms para no re-teleportar
    addMessage('¡Portal!', target.x, target.y, '#7dd6ff');
    spawnParticles(player.px + CELL / 2, player.py + CELL / 2, '#7dd6ff', 15);
  }

  function interactToken(t) {
    if (t.bloqueado && !t.unlockedByGroup) {
      openQuiz(t);
      return;
    }
    collectToken(t);
  }

  function collectToken(t) {
    t.collected = true;
    if (t.correct) {
      combo++;
      maxCombo = Math.max(maxCombo, combo);
      const pts = 50 + combo * 5 + (t.bloqueado ? 50 : 0);
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

  // ============================================================
  // QUIZ DE BLOQUEO (modal HTML)
  // ============================================================
  function openQuiz(token) {
    quizActive = true;
    const overlay = document.getElementById('quiz-overlay');
    if (!overlay) { collectToken(token); return; }
    const q = token.quiz;
    overlay.innerHTML = `
      <div class="quiz-modal">
        <div class="quiz-header">🔒 Diamante bloqueado</div>
        <div class="quiz-question">${escapeHtml(q.q)}</div>
        <div class="quiz-options">
          ${q.opciones.map((o, i) => `<button class="quiz-opt" data-i="${i}">${escapeHtml(o)}</button>`).join('')}
        </div>
        <p class="quiz-hint">💡 Correcto: +50 bonus. Incorrecto: -20 y sigue bloqueado.</p>
      </div>
    `;
    overlay.style.display = 'flex';
    overlay.querySelectorAll('.quiz-opt').forEach(btn => {
      btn.onclick = () => {
        const i = parseInt(btn.dataset.i, 10);
        overlay.style.display = 'none';
        quizActive = false;
        if (i === q.correcta) {
          // Correcto: colecciona ESTE token con bonus, y también desbloquea otros con la misma pregunta
          tokens.forEach(t => {
            if (t.bloqueado && t.quiz === q) t.unlockedByGroup = true;
          });
          addMessage('¡Correcto! +50', player.gx, player.gy, '#4dff88');
          collectToken(token);
        } else {
          score = Math.max(0, score - 20);
          addMessage('-20 respuesta incorrecta', player.gx, player.gy, '#ff5c5c');
          spawnParticles(player.px + CELL / 2, player.py + CELL / 2, '#ff5c5c', 12);
          updateHUD();
        }
      };
    });
  }

  function closeQuiz() {
    const overlay = document.getElementById('quiz-overlay');
    if (overlay) overlay.style.display = 'none';
    quizActive = false;
  }

  // ============================================================
  // ENEMIGOS
  // ============================================================
  function updateEnemy(e, dt) {
    if (e.moving) {
      e.moveT += dt;
      const p = Math.min(e.moveT / e.speed, 1);
      e.px = e.fromX + (e.toX - e.fromX) * p;
      e.py = e.fromY + (e.toY - e.fromY) * p;
      if (p >= 1) { e.moving = false; e.px = e.toX; e.py = e.toY; }
      if (e.gx === player.gx && e.gy === player.gy) hitByEnemy();
      return;
    }
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
      if (dir === 'up') dir = 'down';
      else if (dir === 'down') dir = 'up';
      else if (dir === 'left') dir = 'right';
      else if (dir === 'right') dir = 'left';
      e.dir = dir;
      return;
    }
    e.dir = dir; e.gx = nx; e.gy = ny;
    e.moving = true; e.moveT = 0;
    e.fromX = e.px; e.fromY = e.py;
    e.toX = nx * CELL; e.toY = ny * CELL;
    if (e.gx === player.gx && e.gy === player.gy) hitByEnemy();
  }

  function hitByEnemy() {
    if (quizActive) return;
    combo = 0;
    lives--;
    score = Math.max(0, score - 20);
    addMessage('¡Te atrapó!', player.gx, player.gy, '#ff5c5c');
    spawnParticles(player.px + CELL / 2, player.py + CELL / 2, '#ff5c5c', 20);
    updateHUD();
    if (lives <= 0) return finish('Te atraparon los enemigos');
    player.gx = 1; player.gy = 1;
    player.px = CELL; player.py = CELL;
    player.moving = false;
  }

  function completeLevel() {
    if (levelCompleted) return;
    levelCompleted = true;
    const timeBonus = timeLeft * 5;
    const comboBonus = maxCombo * 10;
    const total = 300 + timeBonus + comboBonus;
    score += total;
    addMessage('¡NIVEL COMPLETADO! +' + total, 10, 6, '#ffd94d');
    setTimeout(() => finish('completed'), 900);
  }

  function finish(reason) {
    running = false;
    if (timerHandle) clearInterval(timerHandle);
    if (rafHandle) cancelAnimationFrame(rafHandle);
    const dur = Math.floor((Date.now() - startTime) / 1000);
    const finalScore = Math.max(0, score);
    setTimeout(() => onEnd(finalScore, dur, levelCompleted), 400);
  }

  function startTimer() {
    if (timerHandle) clearInterval(timerHandle);
    timerHandle = setInterval(() => {
      if (!running || paused || quizActive) return;
      timeLeft--;
      updateHUD();
      if (timeLeft <= 0) finish('Se acabó el tiempo');
    }, 1000);
  }

  // ============================================================
  // RENDER
  // ============================================================
  function render() {
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, '#0a0f1e');
    grad.addColorStop(1, '#1a1a2e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath(); ctx.moveTo(x * CELL, 0); ctx.lineTo(x * CELL, ROWS * CELL); ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath(); ctx.moveTo(0, y * CELL); ctx.lineTo(COLS * CELL, y * CELL); ctx.stroke();
    }

    walls.forEach(key => {
      const [x, y] = key.split(',').map(Number);
      const px = x * CELL, py = y * CELL;
      const wgrad = ctx.createLinearGradient(px, py, px, py + CELL);
      wgrad.addColorStop(0, '#3a4a6a');
      wgrad.addColorStop(1, '#2a3550');
      ctx.fillStyle = wgrad;
      ctx.fillRect(px + 1, py + 1, CELL - 2, CELL - 2);
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(px + 1, py + 1, CELL - 2, 3);
    });

    // Portales
    portals.forEach(p => {
      drawPortal(p.a.x * CELL, p.a.y * CELL, p.color.a);
      drawPortal(p.b.x * CELL, p.b.y * CELL, p.color.b);
    });

    // Puerta
    const dpx = door.gx * CELL, dpy = door.gy * CELL;
    ctx.fillStyle = door.open ? '#4dff88' : '#c89b32';
    ctx.fillRect(dpx + 4, dpy + 4, CELL - 8, CELL - 8);
    ctx.fillStyle = door.open ? '#0a3a20' : '#5a4a1a';
    ctx.font = 'bold 20px system-ui';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(door.open ? '✓' : '🔒', dpx + CELL / 2, dpy + CELL / 2);

    // Tokens
    tokens.forEach(t => {
      if (t.collected) return;
      drawToken(t);
    });

    // Enemigos
    enemies.forEach(e => drawEnemy(e));

    // Player
    drawPlayer();

    // Partículas
    particles.forEach(p => {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, p.life / 500);
      ctx.beginPath();
      ctx.arc(p.px, p.py, p.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

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

    // Tooltip
    if (currentTokenHover) {
      const t = currentTokenHover;
      const tx = t.gx * CELL + CELL / 2;
      const ty = t.gy * CELL - 8;
      const text = (t.bloqueado && !t.unlockedByGroup ? '🔒 ' : '') + t.text;
      ctx.font = 'bold 12px system-ui';
      ctx.textAlign = 'center';
      const w = ctx.measureText(text).width + 12;
      ctx.fillStyle = 'rgba(0,0,0,0.85)';
      ctx.fillRect(tx - w / 2, ty - 14, w, 18);
      ctx.strokeStyle = t.correct ? '#4dff88' : '#ff5c5c';
      ctx.lineWidth = 1;
      ctx.strokeRect(tx - w / 2, ty - 14, w, 18);
      ctx.fillStyle = 'white';
      ctx.fillText(text, tx, ty);
    }

    if (combo >= 2) {
      ctx.font = 'bold 24px system-ui';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffd94d';
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.lineWidth = 3;
      ctx.strokeText('x' + combo + ' COMBO', canvas.width / 2, 30);
      ctx.fillText('x' + combo + ' COMBO', canvas.width / 2, 30);
    }

    if (paused) {
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'white';
      ctx.font = 'bold 48px system-ui'; ctx.textAlign = 'center';
      ctx.fillText('PAUSA', canvas.width / 2, canvas.height / 2 - 10);
      ctx.font = '16px system-ui';
      ctx.fillText('ESPACIO para continuar', canvas.width / 2, canvas.height / 2 + 20);
    }
  }

  function drawPortal(px, py, color) {
    const cx = px + CELL / 2, cy = py + CELL / 2;
    const t = Date.now() / 150;
    for (let i = 3; i >= 0; i--) {
      const r = 4 + i * 4 + Math.sin(t + i) * 2;
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.3 + (3 - i) * 0.2;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawToken(t) {
    const px = t.gx * CELL, py = t.gy * CELL;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(px + CELL / 2, py + CELL - 4, CELL / 3, 3, 0, 0, Math.PI * 2);
    ctx.fill();
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

    // Padlock si bloqueado
    if (t.bloqueado && !t.unlockedByGroup) {
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.beginPath();
      ctx.arc(cx, cy, CELL / 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffd94d';
      ctx.font = 'bold 18px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🔒', cx, cy);
    }

    if (t.glow > 0) {
      ctx.strokeStyle = t.correct ? 'rgba(77,255,136,0.6)' : 'rgba(255,92,92,0.6)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, CELL / 2 + 2, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawEnemy(e) {
    const cx = e.px + CELL / 2, cy = e.py + CELL / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + CELL / 3, CELL / 3, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    const egrad = ctx.createRadialGradient(cx - 4, cy - 4, 2, cx, cy, CELL / 2);
    egrad.addColorStop(0, '#e884ff');
    egrad.addColorStop(1, '#6e3c8c');
    ctx.fillStyle = egrad;
    ctx.beginPath();
    ctx.arc(cx, cy, CELL / 2 - 4, 0, Math.PI * 2);
    ctx.fill();
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
  }

  function drawPlayer() {
    const ppx = player.px + CELL / 2;
    const ppy = player.py + CELL / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(ppx, ppy + CELL / 3, CELL / 3, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    const pgrad = ctx.createRadialGradient(ppx - 4, ppy - 4, 2, ppx, ppy, CELL / 2);
    pgrad.addColorStop(0, '#ffe888');
    pgrad.addColorStop(1, '#c89b32');
    ctx.fillStyle = pgrad;
    ctx.beginPath();
    ctx.arc(ppx, ppy, CELL / 2 - 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#8a6a1a'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(ppx - 5, ppy - 3, 3, 0, Math.PI * 2);
    ctx.arc(ppx + 5, ppy - 3, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0a3a20';
    ctx.beginPath();
    ctx.arc(ppx - 5, ppy - 3, 1.5, 0, Math.PI * 2);
    ctx.arc(ppx + 5, ppy - 3, 1.5, 0, Math.PI * 2);
    ctx.fill();
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
    document.addEventListener('keyup', e => { keys[e.key] = false; });
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

  function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
})();
