/* ============================================================
   Strategic Snake CUN — Motor del juego
   Canvas 800x500, grid 40x25 de celdas de 20px
   ============================================================ */

(function () {
  'use strict';

  const CELL = 20;
  const COLS = 40;
  const ROWS = 25;

  let cfg = null;
  let questions = null;
  let currentChapter = 1;
  let chapterQuestions = [];
  let questionIdx = 0;
  let currentQ = null;

  // Estado del juego
  let snake = [];
  let dir = { x: 1, y: 0 };
  let nextDir = { x: 1, y: 0 };
  let tokens = []; // {x, y, text, correct, eaten}
  let score = 0;
  let hits = 0;
  let misses = 0;
  let lives = 3;
  let level = 1;
  let timeLeft = 60;
  let paused = false;
  let running = false;
  let showHints = false;
  let hintPenaltyApplied = false;
  let loopHandle = null;
  let timerHandle = null;
  let startTime = 0;
  let stepMs = 140;

  // Elementos DOM
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const hudChapter = document.getElementById('hud-chapter');
  const hudLevel = document.getElementById('hud-level');
  const hudLives = document.getElementById('hud-lives');
  const hudScore = document.getElementById('hud-score');
  const hudTime = document.getElementById('hud-time');
  const hudTotalLevels = document.getElementById('hud-total-levels');
  const questionText = document.getElementById('question-text');
  const btnHint = document.getElementById('btn-hint');

  // ============================================================
  // API pública: iniciar el juego con un capítulo
  // ============================================================
  window.SnakeGame = {
    async start(chapterNum, config, questionBank) {
      cfg = config;
      questions = questionBank;
      currentChapter = chapterNum;

      // Elegir preguntas del capítulo (o todas si es aleatorio)
      if (chapterNum === 'random') {
        chapterQuestions = [];
        Object.keys(questions).forEach(k => {
          chapterQuestions = chapterQuestions.concat(questions[k].preguntas);
        });
        shuffle(chapterQuestions);
        chapterQuestions = chapterQuestions.slice(0, 10);
      } else {
        chapterQuestions = [...questions['capitulo_' + chapterNum].preguntas];
        shuffle(chapterQuestions);
      }

      // Reset
      questionIdx = 0;
      score = 0;
      hits = 0;
      misses = 0;
      lives = cfg.juego.vidas;
      level = 1;
      showHints = false;
      hintPenaltyApplied = false;
      startTime = Date.now();
      stepMs = cfg.juego.speed_ms_inicial;
      running = true;
      paused = false;

      hudChapter.textContent = chapterNum === 'random' ? '★' : chapterNum;
      hudTotalLevels.textContent = chapterQuestions.length;

      loadQuestion();
      bindControls();
      startLoop();
    },
    stop() {
      running = false;
      if (loopHandle) clearTimeout(loopHandle);
      if (timerHandle) clearInterval(timerHandle);
    }
  };

  // ============================================================
  // Carga de pregunta y setup del nivel
  // ============================================================
  function loadQuestion() {
    if (questionIdx >= chapterQuestions.length) {
      finishGame(true); // completó todos los niveles
      return;
    }
    currentQ = chapterQuestions[questionIdx];
    questionText.textContent = `Nivel ${level}: ${currentQ.instruccion}`;
    hudLevel.textContent = level;

    // Snake inicial
    snake = [
      { x: 5, y: Math.floor(ROWS / 2) },
      { x: 4, y: Math.floor(ROWS / 2) },
      { x: 3, y: Math.floor(ROWS / 2) }
    ];
    dir = { x: 1, y: 0 };
    nextDir = { x: 1, y: 0 };

    // Colocar tokens
    tokens = [];
    const corrTokens = shuffle([...currentQ.correctos]).slice(0, Math.min(5, currentQ.correctos.length));
    const wrongTokens = shuffle([...currentQ.incorrectos]).slice(0, Math.min(4, currentQ.incorrectos.length));
    corrTokens.forEach(text => tokens.push(makeToken(text, true)));
    wrongTokens.forEach(text => tokens.push(makeToken(text, false)));

    // Tiempo
    timeLeft = cfg.juego.tiempo_por_nivel_seg;
    hudTime.textContent = timeLeft;
    if (timerHandle) clearInterval(timerHandle);
    timerHandle = setInterval(() => {
      if (paused || !running) return;
      timeLeft--;
      hudTime.textContent = timeLeft;
      if (timeLeft <= 0) {
        // Se acabó el tiempo: pierde vida y pasa al siguiente
        losLife('Se acabó el tiempo');
      }
    }, 1000);

    updateHUD();
  }

  function makeToken(text, correct) {
    let x, y, attempts = 0;
    do {
      x = 2 + Math.floor(Math.random() * (COLS - 8));
      y = 2 + Math.floor(Math.random() * (ROWS - 4));
      attempts++;
    } while (isOccupied(x, y) && attempts < 50);
    return { x, y, text, correct, eaten: false };
  }

  function isOccupied(x, y) {
    if (snake.some(s => s.x === x && s.y === y)) return true;
    if (tokens.some(t => !t.eaten && Math.abs(t.x - x) < 4 && Math.abs(t.y - y) < 2)) return true;
    return false;
  }

  // ============================================================
  // Loop del juego
  // ============================================================
  function startLoop() {
    if (loopHandle) clearTimeout(loopHandle);
    tick();
  }

  function tick() {
    if (!running) return;
    if (!paused) update();
    render();
    loopHandle = setTimeout(tick, stepMs);
  }

  function update() {
    dir = nextDir;
    const head = snake[0];
    const newHead = { x: head.x + dir.x, y: head.y + dir.y };

    // Colisión con paredes
    if (newHead.x < 0 || newHead.x >= COLS || newHead.y < 0 || newHead.y >= ROWS) {
      losLife('Chocaste con la pared');
      return;
    }
    // Colisión con sí misma
    if (snake.some(s => s.x === newHead.x && s.y === newHead.y)) {
      losLife('Te mordiste a ti mismo');
      return;
    }

    snake.unshift(newHead);

    // Comer token
    let ate = null;
    for (const t of tokens) {
      if (!t.eaten && cellsOverlapToken(newHead, t)) {
        ate = t;
        break;
      }
    }

    if (ate) {
      ate.eaten = true;
      if (ate.correct) {
        score += cfg.juego.puntos_por_acierto;
        hits++;
        // Snake crece: no quitamos cola
      } else {
        score += cfg.juego.puntos_por_error;
        misses++;
        snake.pop(); // no crece
        loseLifeSilent();
      }
      updateHUD();

      // ¿Comió todos los correctos?
      const remainingCorrect = tokens.filter(t => t.correct && !t.eaten).length;
      if (remainingCorrect === 0) {
        levelUp();
      }
    } else {
      snake.pop(); // movimiento normal
    }
  }

  function cellsOverlapToken(cell, token) {
    // Token ocupa aprox 4 columnas de ancho (texto). Aceptamos colisión si la celda cae en el rango
    const tw = Math.max(2, Math.ceil(token.text.length * 0.35));
    return cell.y === token.y && cell.x >= token.x && cell.x <= token.x + tw;
  }

  function levelUp() {
    score += cfg.juego.bonus_nivel_completado;
    score += timeLeft * cfg.juego.bonus_tiempo_por_seg;
    level++;
    questionIdx++;
    stepMs = Math.max(cfg.juego.speed_ms_min, stepMs - cfg.juego.aceleracion_por_nivel);
    updateHUD();
    loadQuestion();
  }

  function losLife(reason) {
    lives--;
    updateHUD();
    if (lives <= 0) {
      finishGame(false, reason);
      return;
    }
    // Reset posición pero mantener nivel/pregunta
    snake = [
      { x: 5, y: Math.floor(ROWS / 2) },
      { x: 4, y: Math.floor(ROWS / 2) },
      { x: 3, y: Math.floor(ROWS / 2) }
    ];
    dir = { x: 1, y: 0 };
    nextDir = { x: 1, y: 0 };
  }

  function loseLifeSilent() {
    // Perdió vida por comer incorrecto pero sin resetear todo
    lives--;
    updateHUD();
    if (lives <= 0) finishGame(false, 'Comiste demasiados conceptos incorrectos');
  }

  function finishGame(completed, reason) {
    running = false;
    if (loopHandle) clearTimeout(loopHandle);
    if (timerHandle) clearInterval(timerHandle);
    const duration = Math.floor((Date.now() - startTime) / 1000);

    // Aplicar penalización por pistas
    let finalScore = score;
    if (showHints) finalScore = Math.floor(finalScore * cfg.juego.penalizacion_pista);
    finalScore = Math.max(0, finalScore);

    const result = {
      score: finalScore,
      hits,
      misses,
      duration,
      completed,
      reason: reason || (completed ? 'Completaste todos los niveles' : 'Juego terminado'),
      chapter: currentChapter,
      levelsCompleted: level - 1
    };

    if (window.UI && window.UI.showEndScreen) {
      window.UI.showEndScreen(result);
    }
  }

  // ============================================================
  // Render
  // ============================================================
  function render() {
    // Fondo
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid sutil
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(x * CELL, 0);
      ctx.lineTo(x * CELL, ROWS * CELL);
      ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * CELL);
      ctx.lineTo(COLS * CELL, y * CELL);
      ctx.stroke();
    }

    // Tokens
    tokens.forEach(t => {
      if (t.eaten) return;
      const tw = Math.max(2, Math.ceil(t.text.length * 0.35));
      const px = t.x * CELL;
      const py = t.y * CELL;
      const w = tw * CELL;
      const h = CELL;

      // Fondo del token (dorado neutro salvo pista)
      let bg = '#c89b32';
      let fg = '#1a1a2e';
      if (showHints) {
        bg = t.correct ? '#2e8b57' : '#c0392b';
        fg = 'white';
      }
      ctx.fillStyle = bg;
      roundRect(ctx, px, py, w, h, 6, true, false);

      ctx.fillStyle = fg;
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(t.text, px + w / 2, py + h / 2);
    });

    // Snake
    snake.forEach((s, i) => {
      const px = s.x * CELL;
      const py = s.y * CELL;
      if (i === 0) {
        // Cabeza
        ctx.fillStyle = '#e0b345';
        roundRect(ctx, px + 1, py + 1, CELL - 2, CELL - 2, 5, true, false);
        // Ojos
        ctx.fillStyle = '#1a1a2e';
        ctx.beginPath();
        ctx.arc(px + CELL * 0.35, py + CELL * 0.35, 2, 0, Math.PI * 2);
        ctx.arc(px + CELL * 0.65, py + CELL * 0.35, 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = i % 2 === 0 ? '#285aa0' : '#0f2d5a';
        roundRect(ctx, px + 2, py + 2, CELL - 4, CELL - 4, 4, true, false);
      }
    });

    if (paused) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'white';
      ctx.font = 'bold 40px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('⏸  PAUSA', canvas.width / 2, canvas.height / 2);
      ctx.font = '18px system-ui';
      ctx.fillText('Presiona ESPACIO para continuar', canvas.width / 2, canvas.height / 2 + 40);
    }
  }

  function roundRect(ctx, x, y, w, h, r, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  }

  // ============================================================
  // HUD
  // ============================================================
  function updateHUD() {
    hudScore.textContent = score;
    hudLives.textContent = '❤'.repeat(Math.max(0, lives));
    hudLevel.textContent = level;
  }

  // ============================================================
  // Controles
  // ============================================================
  let controlsBound = false;
  function bindControls() {
    if (controlsBound) return;
    controlsBound = true;
    document.addEventListener('keydown', e => {
      if (!running) return;
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          if (dir.y !== 1) nextDir = { x: 0, y: -1 };
          e.preventDefault();
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          if (dir.y !== -1) nextDir = { x: 0, y: 1 };
          e.preventDefault();
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          if (dir.x !== 1) nextDir = { x: -1, y: 0 };
          e.preventDefault();
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          if (dir.x !== -1) nextDir = { x: 1, y: 0 };
          e.preventDefault();
          break;
        case ' ':
          paused = !paused;
          e.preventDefault();
          break;
      }
    });

    btnHint.addEventListener('click', () => {
      showHints = !showHints;
      btnHint.textContent = showHints ? '💡 Pistas ON' : '💡 Pista';
    });
  }

  // ============================================================
  // Utilidades
  // ============================================================
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
})();
