/* ============================================================
   Laboratorio de Ideas — Orquestador del modo Lab
   Cada nivel: intro → mini-juego (variado) → pregunta abierta → feedback IA
   Cierre: generación del PDF final del plan de negocio
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
      currentLevel = levelsData.niveles.find(n => n.num === nivelNum);
      if (!currentLevel) return;
      showIntro();
    },
    onGameFinished(score, duration) {
      gameScore = score;
      gameDuration = duration;
      showOpenQuestion();
    }
  };

  // ============================================================
  // 1. Selector de niveles
  // ============================================================
  function renderLevelSelector() {
    const grid = $('#lab-level-grid');
    if (!grid) return;
    grid.innerHTML = '';
    levelsData.niveles.forEach(n => {
      const btn = document.createElement('button');
      btn.className = 'lab-level-card';
      btn.innerHTML = `
        <div class="lab-level-num">Nivel ${n.num}</div>
        <div class="lab-level-title">${n.titulo}</div>
        <div class="lab-level-section">📄 ${n.seccion_documento}</div>
        <div class="lab-level-status">▶ Jugar</div>
      `;
      btn.addEventListener('click', () => window.LabMode.startLevel(n.num));
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
    window.LabEngines.start(currentLevel, cfg, onGameEnd);
  }

  function onGameEnd(score, duration) {
    gameScore = score;
    gameDuration = duration || Math.floor((Date.now() - gameStartTime) / 1000);
    showOpenQuestion();
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
  // 5. Enviar respuesta + pedir feedback IA
  // ============================================================
  async function submitAnswer() {
    const respuesta = $('#lab-q-textarea').value.trim();
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    $('#screen-lab-feedback').classList.add('active');
    $('#lab-feedback-status').textContent = '⏳ Guardando tu respuesta...';
    $('#lab-feedback-content').style.display = 'none';

    const saveResult = await postToSheet({
      action: 'saveAnswer',
      name: student.name,
      email: student.email,
      nivel: currentLevel.num,
      seccion: currentLevel.seccion_documento,
      respuesta: respuesta,
      puntaje_juego: gameScore,
      duracion: gameDuration
    });
    if (!saveResult.ok) {
      $('#lab-feedback-status').innerHTML =
        `⚠️ No se pudo guardar tu respuesta (${saveResult.error}). Captura y avisa al docente.`;
      return;
    }

    $('#lab-feedback-status').textContent = '🤖 La IA está evaluando tu respuesta... (10-20 segundos)';
    const fbResult = await postToSheet({
      action: 'generateFeedback',
      email: student.email,
      nivel: currentLevel.num,
      seccion: currentLevel.seccion_documento,
      consigna: currentLevel.pregunta_abierta.instruccion,
      requisitos: 'Mínimo ' + currentLevel.pregunta_abierta.min_palabras + ' palabras',
      respuesta: respuesta
    });

    if (!fbResult.ok) {
      $('#lab-feedback-status').innerHTML =
        `⚠️ Respuesta guardada, pero la IA no pudo evaluar.<br>Error: ${fbResult.error}<br>El docente revisará manualmente.`;
      renderFinalScore(null);
      return;
    }
    renderFeedback(fbResult.feedback);
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
    $('#btn-lab-continue').onclick = () => {
      document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
      $('#screen-menu').classList.add('active');
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
