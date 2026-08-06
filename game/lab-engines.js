/* ============================================================
   Laboratorio de Ideas — Motores de mini-juegos
   Tipos: snake_come_correctos, sorting_categorias, constructor_frases
   ============================================================ */
(function () {
  'use strict';

  window.LabEngines = {
    start(level, config, onEnd) {
      const canvas = document.getElementById('lab-canvas');
      const container = document.getElementById('lab-game-container');

      // Ocultar canvas y contenedor DOM según el tipo de juego
      if (level.juego === 'snake_come_correctos') {
        canvas.style.display = 'block';
        if (container) container.style.display = 'none';
        SnakeEngine.start(level, onEnd);
      } else if (level.juego === 'sorting_categorias') {
        canvas.style.display = 'none';
        if (container) container.style.display = 'block';
        SortingEngine.start(level, onEnd);
      } else if (level.juego === 'constructor_frases') {
        canvas.style.display = 'none';
        if (container) container.style.display = 'block';
        BuilderEngine.start(level, onEnd);
      } else {
        alert('Tipo de juego no implementado: ' + level.juego);
        onEnd(0, 0);
      }
    },
    stop() {
      SnakeEngine.stop();
      SortingEngine.stop();
      BuilderEngine.stop();
    }
  };

  // ============================================================
  // ENGINE 1 — SNAKE COME CORRECTOS (Niveles 1, 2, 4, 7, 9)
  // ============================================================
  const SnakeEngine = (function () {
    const CELL = 20, COLS = 40, ROWS = 22;
    let ctx, canvas;
    let level, onEnd;
    let snake, dir, nextDir, tokens;
    let score, hits, misses, lives, timeLeft, paused, running;
    let loopHandle, timerHandle, startTime;
    let bound = false;
    const STEP_MS = 130;

    return {
      start(lvl, cb) {
        level = lvl; onEnd = cb;
        canvas = document.getElementById('lab-canvas');
        ctx = canvas.getContext('2d');
        score = 0; hits = 0; misses = 0; lives = 3;
        timeLeft = (level.tiempo_seg) || 90;
        paused = false; running = true; startTime = Date.now();
        snake = [{x:5,y:11},{x:4,y:11},{x:3,y:11}];
        dir = {x:1,y:0}; nextDir = {x:1,y:0};
        populate();
        updateHUD();
        bindControls();
        startLoop();
        setInstr(level.instruccion_juego || '');
      },
      stop() {
        running = false;
        if (loopHandle) clearTimeout(loopHandle);
        if (timerHandle) clearInterval(timerHandle);
      }
    };

    function populate() {
      tokens = [];
      const corr = shuffle([...level.tokens_correctos]).slice(0, 6);
      const inc  = shuffle([...level.tokens_incorrectos]).slice(0, 4);
      corr.forEach(t => tokens.push(makeToken(t, true)));
      inc.forEach(t => tokens.push(makeToken(t, false)));
    }
    function makeToken(text, correct) {
      let x, y, tries = 0;
      do {
        x = 2 + Math.floor(Math.random() * (COLS - 10));
        y = 2 + Math.floor(Math.random() * (ROWS - 4));
        tries++;
      } while (occ(x, y) && tries < 60);
      return {x, y, text, correct, eaten:false};
    }
    function occ(x, y) {
      if (snake.some(s => s.x===x && s.y===y)) return true;
      if (tokens.some(t => !t.eaten && Math.abs(t.x-x)<5 && Math.abs(t.y-y)<2)) return true;
      return false;
    }
    function startLoop() {
      if (timerHandle) clearInterval(timerHandle);
      timerHandle = setInterval(() => {
        if (paused || !running) return;
        timeLeft--;
        updateHUD();
        if (timeLeft <= 0) finish('Se acabó el tiempo');
      }, 1000);
      tick();
    }
    function tick() {
      if (!running) return;
      if (!paused) update();
      render();
      loopHandle = setTimeout(tick, STEP_MS);
    }
    function update() {
      dir = nextDir;
      const h = snake[0];
      const nh = {x: h.x+dir.x, y: h.y+dir.y};
      if (nh.x<0) nh.x = COLS-1;
      if (nh.x>=COLS) nh.x = 0;
      if (nh.y<0) nh.y = ROWS-1;
      if (nh.y>=ROWS) nh.y = 0;
      if (snake.some(s => s.x===nh.x && s.y===nh.y)) return loseLife('Te mordiste');
      snake.unshift(nh);
      let ate = null;
      for (const t of tokens) if (!t.eaten && overlaps(nh, t)) { ate = t; break; }
      if (ate) {
        ate.eaten = true;
        if (ate.correct) { score += 20; hits++; }
        else { score -= 10; misses++; snake.pop(); silentLoseLife(); }
        updateHUD();
        if (tokens.filter(t => t.correct && !t.eaten).length === 0) {
          score += 100; populate();
        }
      } else { snake.pop(); }
    }
    function overlaps(cell, tk) {
      const tw = Math.max(3, Math.ceil(tk.text.length * 0.32));
      return cell.y===tk.y && cell.x>=tk.x && cell.x<=tk.x+tw;
    }
    function loseLife(reason) {
      lives--; updateHUD();
      if (lives<=0) return finish(reason);
      snake = [{x:5,y:11},{x:4,y:11},{x:3,y:11}];
      dir = {x:1,y:0}; nextDir = {x:1,y:0};
    }
    function silentLoseLife() {
      lives--; updateHUD();
      if (lives<=0) finish('Comiste demasiados commodities');
    }
    function finish(reason) {
      running = false;
      if (loopHandle) clearTimeout(loopHandle);
      if (timerHandle) clearInterval(timerHandle);
      const dur = Math.floor((Date.now()-startTime)/1000);
      const finalScore = Math.max(0, score + timeLeft*2);
      setTimeout(() => onEnd(finalScore, dur), 300);
    }
    function render() {
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = 'rgba(255,255,255,0.03)';
      for (let x=0; x<=COLS; x++) { ctx.beginPath(); ctx.moveTo(x*CELL,0); ctx.lineTo(x*CELL,ROWS*CELL); ctx.stroke(); }
      for (let y=0; y<=ROWS; y++) { ctx.beginPath(); ctx.moveTo(0,y*CELL); ctx.lineTo(COLS*CELL,y*CELL); ctx.stroke(); }
      tokens.forEach(t => {
        if (t.eaten) return;
        const tw = Math.max(3, Math.ceil(t.text.length*0.32));
        const px = t.x*CELL, py = t.y*CELL, w = tw*CELL, h = CELL;
        ctx.fillStyle = '#c89b32';
        roundRect(px, py, w, h, 5); ctx.fill();
        ctx.fillStyle = '#1a1a2e';
        ctx.font = 'bold 10px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText(t.text, px+w/2, py+h/2);
      });
      snake.forEach((s, i) => {
        const px=s.x*CELL, py=s.y*CELL;
        if (i===0) {
          ctx.fillStyle='#e0b345';
          roundRect(px+1, py+1, CELL-2, CELL-2, 5); ctx.fill();
          ctx.fillStyle='#1a1a2e';
          ctx.beginPath();
          ctx.arc(px+CELL*0.35, py+CELL*0.35, 2, 0, Math.PI*2);
          ctx.arc(px+CELL*0.65, py+CELL*0.35, 2, 0, Math.PI*2);
          ctx.fill();
        } else {
          ctx.fillStyle = i%2===0 ? '#285aa0' : '#0f2d5a';
          roundRect(px+2, py+2, CELL-4, CELL-4, 4); ctx.fill();
        }
      });
      if (paused) {
        ctx.fillStyle='rgba(0,0,0,0.6)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle='white'; ctx.font='bold 40px system-ui'; ctx.textAlign='center';
        ctx.fillText('⏸ PAUSA', canvas.width/2, canvas.height/2);
      }
    }
    function roundRect(x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x+r, y);
      ctx.arcTo(x+w, y, x+w, y+h, r);
      ctx.arcTo(x+w, y+h, x, y+h, r);
      ctx.arcTo(x, y+h, x, y, r);
      ctx.arcTo(x, y, x+w, y, r);
      ctx.closePath();
    }
    function updateHUD() {
      document.getElementById('lab-hud-score').textContent = score;
      document.getElementById('lab-hud-lives').textContent = '❤'.repeat(Math.max(0, lives));
      const t = document.getElementById('lab-hud-time');
      t.textContent = timeLeft + 's';
      t.classList.remove('timer-warning', 'timer-danger');
      if (timeLeft <= 10) t.classList.add('timer-danger');
      else if (timeLeft <= 25) t.classList.add('timer-warning');
    }
    function bindControls() {
      if (bound) return; bound = true;
      document.addEventListener('keydown', e => {
        if (!running) return;
        switch (e.key) {
          case 'ArrowUp': case 'w': case 'W': if (dir.y!==1)  nextDir={x:0,y:-1}; e.preventDefault(); break;
          case 'ArrowDown': case 's': case 'S': if (dir.y!==-1) nextDir={x:0,y:1};  e.preventDefault(); break;
          case 'ArrowLeft': case 'a': case 'A': if (dir.x!==1)  nextDir={x:-1,y:0}; e.preventDefault(); break;
          case 'ArrowRight': case 'd': case 'D': if (dir.x!==-1) nextDir={x:1,y:0};  e.preventDefault(); break;
          case ' ': paused = !paused; e.preventDefault(); break;
        }
      });
    }
    function setInstr(text) {
      const el = document.getElementById('lab-game-instr');
      if (el) el.innerHTML = text;
    }
    function shuffle(a) {
      for (let i=a.length-1; i>0; i--) {
        const j = Math.floor(Math.random()*(i+1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    }
  })();

  // ============================================================
  // ENGINE 2 — SORTING / CATEGORIZACIÓN (Niveles 3, 5, 8)
  // ============================================================
  const SortingEngine = (function () {
    let level, onEnd;
    let score = 0, correct = 0, wrong = 0, timeLeft = 90;
    let running = false, timerHandle;
    let startTime;

    return {
      start(lvl, cb) {
        level = lvl; onEnd = cb;
        score = 0; correct = 0; wrong = 0;
        timeLeft = (level.tiempo_seg) || 90;
        running = true; startTime = Date.now();
        render();
        startTimer();
        setInstr(level.instruccion_juego || '');
        updateHUD();
      },
      stop() {
        running = false;
        if (timerHandle) clearInterval(timerHandle);
      }
    };

    function render() {
      const container = document.getElementById('lab-game-container');
      container.innerHTML = '';
      container.className = 'lab-game-container sorting';

      // Zonas de categorías
      const zonesDiv = document.createElement('div');
      zonesDiv.className = 'sort-zones';
      level.categorias.forEach(cat => {
        const zone = document.createElement('div');
        zone.className = 'sort-zone';
        zone.dataset.categoria = cat.id;
        zone.style.borderColor = cat.color;
        zone.innerHTML = `<h4 style="color:${cat.color}">${cat.nombre}</h4><div class="sort-drop-area"></div>`;
        const dropArea = zone.querySelector('.sort-drop-area');
        dropArea.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
        dropArea.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
        dropArea.addEventListener('drop', e => {
          e.preventDefault();
          zone.classList.remove('drag-over');
          const itemId = e.dataTransfer.getData('text/plain');
          handleDrop(itemId, cat.id, dropArea);
        });
        zonesDiv.appendChild(zone);
      });
      container.appendChild(zonesDiv);

      // Items disponibles
      const itemsDiv = document.createElement('div');
      itemsDiv.className = 'sort-items';
      const shuffled = shuffle([...level.items]);
      shuffled.forEach((it, i) => {
        const item = document.createElement('div');
        item.className = 'sort-item';
        item.draggable = true;
        item.textContent = it.texto;
        item.dataset.id = 'item-' + i;
        item.dataset.categoria = it.categoria;
        item.addEventListener('dragstart', e => {
          e.dataTransfer.setData('text/plain', item.dataset.id);
          item.classList.add('dragging');
        });
        item.addEventListener('dragend', () => item.classList.remove('dragging'));
        itemsDiv.appendChild(item);
      });
      container.appendChild(itemsDiv);
    }

    function handleDrop(itemId, catId, dropArea) {
      const item = document.querySelector('[data-id="' + itemId + '"]');
      if (!item) return;
      const isCorrect = item.dataset.categoria === catId;
      if (isCorrect) {
        item.classList.add('correct');
        score += 15;
        correct++;
      } else {
        item.classList.add('wrong');
        score -= 5;
        wrong++;
        // Devolver a items después de 800ms
        setTimeout(() => {
          item.classList.remove('wrong');
          document.querySelector('.sort-items').appendChild(item);
        }, 800);
        updateHUD();
        return;
      }
      dropArea.appendChild(item);
      item.draggable = false;
      updateHUD();
      // ¿Terminó?
      if (document.querySelectorAll('.sort-item.correct').length === level.items.length) {
        score += 100; // bonus
        setTimeout(() => finish('Completaste el sorting'), 400);
      }
    }

    function startTimer() {
      if (timerHandle) clearInterval(timerHandle);
      timerHandle = setInterval(() => {
        if (!running) return;
        timeLeft--;
        updateHUD();
        if (timeLeft <= 0) finish('Se acabó el tiempo');
      }, 1000);
    }
    function finish(reason) {
      running = false;
      if (timerHandle) clearInterval(timerHandle);
      const dur = Math.floor((Date.now()-startTime)/1000);
      const finalScore = Math.max(0, score + timeLeft*2);
      setTimeout(() => onEnd(finalScore, dur), 300);
    }
    function updateHUD() {
      document.getElementById('lab-hud-score').textContent = score;
      document.getElementById('lab-hud-lives').textContent = correct + '/' + level.items.length;
      const t = document.getElementById('lab-hud-time');
      t.textContent = timeLeft + 's';
      t.classList.remove('timer-warning', 'timer-danger');
      if (timeLeft <= 10) t.classList.add('timer-danger');
      else if (timeLeft <= 25) t.classList.add('timer-warning');
    }
    function setInstr(text) {
      const el = document.getElementById('lab-game-instr');
      if (el) el.textContent = text;
    }
    function shuffle(a) {
      for (let i=a.length-1; i>0; i--) {
        const j = Math.floor(Math.random()*(i+1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    }
  })();

  // ============================================================
  // ENGINE 3 — CONSTRUCTOR DE FRASES (Nivel 6)
  // ============================================================
  const BuilderEngine = (function () {
    let level, onEnd;
    let score = 0, timeLeft = 90;
    let running = false, timerHandle, startTime;
    let selected = { verbo: null, a_quien: null, como_diferencia: null };

    return {
      start(lvl, cb) {
        level = lvl; onEnd = cb;
        score = 0; timeLeft = (level.tiempo_seg) || 90;
        running = true; startTime = Date.now();
        selected = { verbo: null, a_quien: null, como_diferencia: null };
        render();
        startTimer();
        setInstr(level.instruccion_juego || '');
        updateHUD();
      },
      stop() {
        running = false;
        if (timerHandle) clearInterval(timerHandle);
      }
    };

    function render() {
      const container = document.getElementById('lab-game-container');
      container.innerHTML = '';
      container.className = 'lab-game-container builder';

      // Zona de construcción
      const buildZone = document.createElement('div');
      buildZone.className = 'build-zone';
      buildZone.innerHTML = `
        <div class="build-slot" data-tipo="verbo"><span class="slot-label">VERBO</span><span class="slot-content">___</span></div>
        <div class="build-slot" data-tipo="a_quien"><span class="slot-label">A QUIÉN</span><span class="slot-content">___</span></div>
        <div class="build-slot" data-tipo="como_diferencia"><span class="slot-label">CÓMO SE DIFERENCIA</span><span class="slot-content">___</span></div>
      `;
      container.appendChild(buildZone);

      // Piezas mezcladas
      const piecesDiv = document.createElement('div');
      piecesDiv.className = 'build-pieces';

      const allPieces = [
        ...level.verbos.map(v => ({texto:v, tipo:'verbo'})),
        ...level.a_quien.map(v => ({texto:v, tipo:'a_quien'})),
        ...level.como_diferencia.map(v => ({texto:v, tipo:'como_diferencia'})),
        ...level.distractores.map(v => ({texto:v, tipo:'distractor'}))
      ];
      shuffle(allPieces).forEach((p, i) => {
        const piece = document.createElement('button');
        piece.className = 'build-piece';
        piece.dataset.tipo = p.tipo;
        piece.dataset.id = 'piece-' + i;
        piece.textContent = p.texto;
        piece.addEventListener('click', () => selectPiece(p, piece));
        piecesDiv.appendChild(piece);
      });
      container.appendChild(piecesDiv);

      // Botón para validar
      const validate = document.createElement('button');
      validate.className = 'btn-primary btn-large';
      validate.style.marginTop = '16px';
      validate.textContent = '✓ Validar mi misión';
      validate.onclick = validateMision;
      container.appendChild(validate);
    }

    function selectPiece(p, btn) {
      if (p.tipo === 'distractor') {
        score -= 10;
        btn.classList.add('distractor-hit');
        setTimeout(() => btn.classList.remove('distractor-hit'), 500);
        updateHUD();
        return;
      }
      // Reemplaza si ya había uno seleccionado de este tipo
      if (selected[p.tipo]) {
        const prevBtn = document.querySelector('[data-id="' + selected[p.tipo].id + '"]');
        if (prevBtn) prevBtn.classList.remove('selected');
      }
      selected[p.tipo] = {texto: p.texto, id: btn.dataset.id};
      btn.classList.add('selected');
      // Actualizar slot
      const slot = document.querySelector('.build-slot[data-tipo="' + p.tipo + '"] .slot-content');
      if (slot) slot.textContent = p.texto;
    }

    function validateMision() {
      const complete = selected.verbo && selected.a_quien && selected.como_diferencia;
      if (!complete) {
        alert('Aún te faltan piezas por elegir. Selecciona VERBO + A QUIÉN + CÓMO SE DIFERENCIA.');
        return;
      }
      score += 200;
      setTimeout(() => finish('Misión construida'), 400);
    }

    function startTimer() {
      if (timerHandle) clearInterval(timerHandle);
      timerHandle = setInterval(() => {
        if (!running) return;
        timeLeft--;
        updateHUD();
        if (timeLeft <= 0) finish('Se acabó el tiempo');
      }, 1000);
    }
    function finish(reason) {
      running = false;
      if (timerHandle) clearInterval(timerHandle);
      const dur = Math.floor((Date.now()-startTime)/1000);
      const finalScore = Math.max(0, score + timeLeft*2);
      setTimeout(() => onEnd(finalScore, dur), 300);
    }
    function updateHUD() {
      document.getElementById('lab-hud-score').textContent = score;
      const pieces = Object.values(selected).filter(Boolean).length;
      document.getElementById('lab-hud-lives').textContent = pieces + '/3 piezas';
      const t = document.getElementById('lab-hud-time');
      t.textContent = timeLeft + 's';
      t.classList.remove('timer-warning', 'timer-danger');
      if (timeLeft <= 10) t.classList.add('timer-danger');
      else if (timeLeft <= 25) t.classList.add('timer-warning');
    }
    function setInstr(text) {
      const el = document.getElementById('lab-game-instr');
      if (el) el.textContent = text;
    }
    function shuffle(a) {
      for (let i=a.length-1; i>0; i--) {
        const j = Math.floor(Math.random()*(i+1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    }
  })();
})();
