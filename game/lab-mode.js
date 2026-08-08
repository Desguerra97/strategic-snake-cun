/* ============================================================
   Laboratorio de Ideas — Orquestador con progresión secuencial
   ============================================================ */
(function () {
  'use strict';

  let cfg = null;
  let levelsData = null;
  let student = null;
  let currentLevel = null;
  let gameScore = 0;
  let gameDuration = 0;
  let gameStartTime = 0;
  let lastLevelCompleted = false;

  const $ = sel => document.querySelector(sel);

  window.LabMode = {
    async init(config, levels, studentData) {
      cfg = config;
      levelsData = levels;
      student = studentData;
      renderLevelSelector();
      bindPdfButton();
    },
    startLevel(nivelNum) {
      // Verificar que está desbloqueado
      const maxUnlocked = getMaxUnlockedLevel();
      if (nivelNum > maxUnlocked) {
        alert('🔒 Este nivel está bloqueado.\n\nDebes completar el Nivel ' + (nivelNum - 1) + ' primero.');
        return;
      }
      currentLevel = levelsData.niveles.find(n => n.num === nivelNum);
      if (!currentLevel) return;
      showIntro();
    }
  };

  // ============================================================
  // PROGRESIÓN
  // ============================================================
  function getMaxUnlockedLevel() {
    try {
      const raw = localStorage.getItem('cun_lab_progress') || '{}';
      const p = JSON.parse(raw);
      const completed = Object.keys(p).map(Number).filter(n => p[n] === true);
      if (completed.length === 0) return 1;
      return Math.min(9, Math.max(...completed) + 1);
    } catch { return 1; }
  }

  function markLevelCompleted(nivelNum) {
    try {
      const raw = localStorage.getItem('cun_lab_progress') || '{}';
      const p = JSON.parse(raw);
      p[nivelNum] = true;
      localStorage.setItem('cun_lab_progress', JSON.stringify(p));
    } catch (_) {}
  }

  function isLevelCompleted(nivelNum) {
    try {
      const p = JSON.parse(localStorage.getItem('cun_lab_progress') || '{}');
      return !!p[nivelNum];
    } catch { return false; }
  }

  // ============================================================
  // 1. Selector de niveles
  // ============================================================
  function renderLevelSelector() {
    const grid = $('#lab-level-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const maxUnlocked = getMaxUnlockedLevel();

    levelsData.niveles.forEach(n => {
      const btn = document.createElement('button');
      const unlocked = n.num <= maxUnlocked;
      const completed = isLevelCompleted(n.num);
      btn.className = 'lab-level-card' + (unlocked ? '' : ' locked') + (completed ? ' completed' : '');
      const statusIcon = completed ? '✅ Completado' : (unlocked ? '▶ Jugar' : '🔒 Bloqueado');
      btn.innerHTML = `
        <div class="lab-level-num">Nivel ${n.num}</div>
        <div class="lab-level-title">${n.titulo}</div>
        <div class="lab-level-section">📄 ${n.seccion_documento}</div>
        <div class="lab-level-status">${statusIcon}</div>
      `;
      if (unlocked) btn.addEventListener('click', () => window.LabMode.startLevel(n.num));
      grid.appendChild(btn);
    });
  }

  function bindPdfButton() {
    const btn = $('#btn-generate-pdf');
    if (!btn) return;
    btn.onclick = async () => {
      btn.disabled = true;
      btn.textContent = '⏳ Generando PDF...';
      try {
        const filename = await window.PDFGenerator.generate(student, cfg, cfg.google_sheets_endpoint);
        btn.textContent = '✅ PDF descargado: ' + filename;
        setTimeout(() => {
          btn.disabled = false;
          btn.textContent = '📄 Generar mi PDF del Laboratorio';
        }, 5000);
      } catch (err) {
        btn.disabled = false;
        btn.textContent = '📄 Generar mi PDF del Laboratorio';
        alert('Error generando PDF: ' + err.message);
      }
    };
  }

  // ============================================================
  // 2. Intro del nivel
  // ============================================================
  function showIntro() {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    $('#screen-lab-intro').classList.add('active');
    $('#lab-intro-title').textContent = `Nivel ${currentLevel.num}: ${currentLevel.titulo}`;
    $('#lab-intro-section').textContent = currentLevel.seccion_documento;
    $('#lab-intro-concept').textContent = currentLevel.concepto;
    $('#lab-intro-consigna').textContent = currentLevel.pregunta_abierta.instruccion;
    $('#btn-lab-start-game').onclick = () => launchGame();
  }

  // ============================================================
  // 3. Lanzar el mini-juego
  // ============================================================
  function launchGame() {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    $('#screen-lab-game').classList.add('active');
    gameStartTime = Date.now();
    populateLevelJumpSelector();
    window.LabEngines.start(currentLevel, cfg, onGameEnd);
  }

  function populateLevelJumpSelector() {
    const sel = $('#lab-level-jump');
    if (!sel) return;
    sel.innerHTML = '';
    const maxUnlocked = getMaxUnlockedLevel();
    levelsData.niveles.forEach(n => {
      const opt = document.createElement('option');
      opt.value = n.num;
      const lock = n.num > maxUnlocked ? ' 🔒' : '';
      opt.textContent = 'Nivel ' + n.num + lock + ' — ' + n.titulo.substring(0, 25) + (n.titulo.length > 25 ? '...' : '');
      opt.disabled = n.num > maxUnlocked;
      if (n.num === currentLevel.num) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.onchange = () => {
      const target = parseInt(sel.value, 10);
      if (!target || target === currentLevel.num) return;
      if (target > maxUnlocked) {
        alert('🔒 Ese nivel está bloqueado.');
        sel.value = currentLevel.num;
        return;
      }
      if (confirm('¿Cambiar al Nivel ' + target + '? Se pierde el puntaje del nivel actual.')) {
        window.LabEngines.stop();
        currentLevel = levelsData.niveles.find(n => n.num === target);
        launchGame();
      } else {
        sel.value = currentLevel.num;
      }
    };
  }

  function onGameEnd(score, duration, completed) {
    gameScore = score;
    gameDuration = duration || Math.floor((Date.now() - gameStartTime) / 1000);
    lastLevelCompleted = !!completed;
    if (completed) markLevelCompleted(currentLevel.num);
    saveLabScore(currentLevel.num, score);
    showOpenQuestion();
  }

  function saveLabScore(nivelNum, score) {
    try {
      const raw = localStorage.getItem('cun_lab_best') || '{}';
      const b = JSON.parse(raw);
      if (!b[nivelNum] || score > b[nivelNum]) {
        b[nivelNum] = score;
        localStorage.setItem('cun_lab_best', JSON.stringify(b));
      }
      if (window.UI && window.UI.refreshMenuStats) window.UI.refreshMenuStats();
    } catch (_) {}
  }

  // ============================================================
  // 4. Pregunta abierta
  // ============================================================
  function showOpenQuestion() {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    $('#screen-lab-question').classList.add('active');
    const q = currentLevel.pregunta_abierta;
    $('#lab-q-title').textContent = q.titulo;
    $('#lab-q-instruction').textContent = q.instruccion;
    $('#lab-q-min').textContent = q.min_palabras;
    $('#lab-q-textarea').value = '';
    $('#lab-q-textarea').placeholder = q.placeholder || '';
    $('#lab-q-counter').textContent = '0 palabras';
    $('#lab-q-game-score').textContent = gameScore;

    const textarea = $('#lab-q-textarea');
    textarea.oninput = () => {
      const words = textarea.value.trim().split(/\s+/).filter(Boolean).length;
      $('#lab-q-counter').textContent = `${words} palabra${words !== 1 ? 's' : ''}`;
      const ok = words >= q.min_palabras;
      $('#lab-q-counter').style.color = ok ? 'var(--verde-ok)' : 'var(--rojo-err)';
      $('#btn-lab-submit-answer').disabled = !ok;
    };
    $('#btn-lab-submit-answer').disabled = true;
    $('#btn-lab-submit-answer').onclick = submitAnswer;
  }

  // ============================================================
  // 5. Enviar respuesta + feedback IA (con retry y quota)
  // ============================================================
  function parseRetrySeconds(errMsg) {
    if (!errMsg) return null;
    const m = String(errMsg).match(/retry in ([\d.]+)s/i);
    return m ? Math.ceil(parseFloat(m[1])) : null;
  }

  function isQuotaError(errMsg) {
    if (!errMsg) return false;
    const s = String(errMsg).toLowerCase();
    return s.includes('quota') || s.includes('resource_exhausted') || s.includes('rate limit');
  }

  async function submitAnswer() {
    const respuesta = $('#lab-q-textarea').value.trim();
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    $('#screen-lab-feedback').classList.add('active');
    $('#lab-feedback-status').textContent = '⏳ Guardando tu respuesta...';
    $('#lab-feedback-content').style.display = 'none';
    $('#btn-lab-next-level').style.display = 'none';

    const saveResult = await postToSheet({
      action: 'saveAnswer',
      name: student.name, email: student.email,
      nivel: currentLevel.num, seccion: currentLevel.seccion_documento,
      respuesta: respuesta,
      puntaje_juego: gameScore, duracion: gameDuration
    });
    if (!saveResult.ok) {
      $('#lab-feedback-status').innerHTML =
        `⚠️ No se pudo guardar tu respuesta (${saveResult.error}). Avisa al docente.`;
      return;
    }

    $('#lab-feedback-status').textContent = '🤖 La IA está evaluando tu respuesta... (10-20 segundos)';
    const fbResult = await postToSheet({
      action: 'generateFeedback',
      email: student.email, nivel: currentLevel.num,
      seccion: currentLevel.seccion_documento,
      consigna: currentLevel.pregunta_abierta.instruccion,
      requisitos: 'Mínimo ' + currentLevel.pregunta_abierta.min_palabras + ' palabras',
      respuesta: respuesta
    });

    if (!fbResult.ok) {
      // Fallback: evaluación por reglas cuando la IA falla (ej. cuota Gemini agotada)
      const ruleFb = evaluateByRules(respuesta, currentLevel.pregunta_abierta.min_palabras);
      $('#lab-feedback-status').innerHTML =
        `⚠️ La IA está saturada temporalmente. Te muestro una evaluación automática básica.<br>` +
        `<small>Tu respuesta quedó guardada y el docente la revisará. Puedes seguir al siguiente nivel.</small>`;
      renderFeedback(ruleFb);
      return;
    }
    renderFeedback(fbResult.feedback);
  }

  function evaluateByRules(respuesta, minPalabras) {
    const palabras = respuesta.trim().split(/\s+/).filter(Boolean).length;
    const ratio = Math.min(palabras / minPalabras, 1.5);
    const score = Math.round(Math.min(10, 3 + ratio * 5));
    const fortalezas = [];
    const sugerencias = [];
    const faltantes = [];
    if (palabras >= minPalabras) fortalezas.push('Cumples el mínimo de ' + minPalabras + ' palabras (' + palabras + ' escritas).');
    else faltantes.push('Te faltan ' + (minPalabras - palabras) + ' palabras para el mínimo requerido.');
    if (respuesta.length > minPalabras * 6) fortalezas.push('Redacción extensa y detallada.');
    if (/\d/.test(respuesta)) fortalezas.push('Incluyes datos numéricos concretos.');
    else sugerencias.push('Añade datos numéricos, cifras o fechas para dar mayor solidez.');
    if (/[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+/.test(respuesta)) fortalezas.push('Uso adecuado de nombres propios.');
    sugerencias.push('Revisa la ortografía antes de la entrega oficial en Moodle.');
    sugerencias.push('Amplía cada punto con un ejemplo concreto de tu propia idea.');
    return {
      score, fortalezas, sugerencias, elementosFaltantes: faltantes,
      comentarioGeneral: 'Evaluación automática básica. Cuando la IA esté disponible, tu respuesta será re-evaluada. Mientras tanto, sigue avanzando; tu progreso quedó guardado.'
    };
  }

  function renderFeedback(fb) {
    $('#lab-feedback-status').textContent = '✅ Evaluación completada';
    $('#lab-feedback-content').style.display = 'block';
    $('#fb-score').textContent = fb.score + ' / 10';
    $('#fb-score').className = 'fb-score ' + scoreClass(fb.score);
    renderList('fb-fortalezas', fb.fortalezas || [], '✅');
    renderList('fb-sugerencias', fb.sugerencias || [], '💡');
    renderList('fb-faltantes', fb.elementosFaltantes || [], '⚠️');
    $('#fb-comentario').textContent = fb.comentarioGeneral || '';
    renderFinalScore(fb);
  }

  function renderList(elId, items, prefix) {
    const el = $('#' + elId);
    el.innerHTML = '';
    if (items.length === 0) { el.innerHTML = '<li class="empty">(ninguno detectado)</li>'; return; }
    items.forEach(t => {
      const li = document.createElement('li');
      li.innerHTML = `<span class="fb-prefix">${prefix}</span> ${escapeHtml(t)}`;
      el.appendChild(li);
    });
  }

  function scoreClass(s) {
    if (s >= 8) return 'excelente';
    if (s >= 6) return 'bueno';
    if (s >= 4) return 'aceptable';
    return 'mejorable';
  }

  function renderFinalScore(feedback) {
    const iaScore = feedback ? feedback.score : 5;
    const contribJuego = Math.min(gameScore / 500, 4);
    const contribIA = iaScore * 0.4;
    const contribComplet = 2;
    const totalNivel = Math.min(10, contribJuego + contribIA + contribComplet);
    $('#lab-nivel-score').textContent = totalNivel.toFixed(1) + ' / 10';

    // Botón "Siguiente nivel" — chequea sesión Y localStorage como fallback
    const btnNext = $('#btn-lab-next-level');
    const btnContinue = $('#btn-lab-continue');
    const levelDone = lastLevelCompleted || isLevelCompleted(currentLevel.num);

    if (levelDone && currentLevel.num < 9) {
      btnNext.style.display = 'inline-block';
      btnNext.textContent = '▶ Siguiente: Nivel ' + (currentLevel.num + 1);
      btnNext.onclick = () => {
        const nextLvl = levelsData.niveles.find(n => n.num === currentLevel.num + 1);
        if (nextLvl) { currentLevel = nextLvl; showIntro(); }
      };
    } else if (levelDone && currentLevel.num === 9) {
      btnNext.style.display = 'inline-block';
      btnNext.textContent = '🏆 ¡Completaste los 9 niveles! Descargar PDF';
      btnNext.onclick = () => {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        $('#screen-menu').classList.add('active');
        renderLevelSelector();
        setTimeout(() => $('#btn-generate-pdf').click(), 300);
      };
    } else {
      // No completó — muestra botón para reintentar el nivel
      btnNext.style.display = 'inline-block';
      btnNext.textContent = '↻ Reintentar Nivel ' + currentLevel.num;
      btnNext.onclick = () => showIntro();
    }

    btnContinue.onclick = () => {
      document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
      $('#screen-menu').classList.add('active');
      renderLevelSelector();
    };
  }

  // ============================================================
  // Utilidades
  // ============================================================
  async function postToSheet(params) {
    const endpoint = cfg.google_sheets_endpoint;
    if (!endpoint || endpoint.startsWith('REEMPLAZAR')) {
      return { ok: false, error: 'Endpoint no configurado' };
    }
    try {
      const body = new URLSearchParams(params).toString();
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body
      });
      return await res.json();
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
})();
