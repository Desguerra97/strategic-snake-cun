/* ============================================================
   UI Controller v2 — con Laboratorio de Ideas
   ============================================================ */
(function () {
  'use strict';

  let cfg = null;
  let questions = null;
  let levelsData = null;
  let student = null;

  const $ = sel => document.querySelector(sel);

  const screens = {
    welcome: $('#screen-welcome'),
    menu: $('#screen-menu'),
    game: $('#screen-game'),
    end: $('#screen-end'),
    labIntro: $('#screen-lab-intro'),
    labGame: $('#screen-lab-game'),
    labQuestion: $('#screen-lab-question'),
    labFeedback: $('#screen-lab-feedback')
  };

  function showScreen(name) {
    Object.values(screens).forEach(s => s && s.classList.remove('active'));
    if (screens[name]) screens[name].classList.add('active');
    window.scrollTo(0, 0);
  }

  async function init() {
    try {
      const [dataMain, levelsResp] = await Promise.all([
        window.ContentLoader.loadAll(),
        fetch('data/levels.json').then(r => r.json())
      ]);
      cfg = dataMain.config;
      questions = dataMain.questions;
      levelsData = levelsResp;
    } catch (e) {
      alert('Error cargando datos del juego: ' + e.message);
      return;
    }

    student = loadStudent();
    if (student) goToMenu();
    else showScreen('welcome');

    bindEvents();
    renderBonusTable();
  }

  function loadStudent() {
    try {
      const s = localStorage.getItem('cun_snake_student');
      return s ? JSON.parse(s) : null;
    } catch { return null; }
  }
  function saveStudent(s) { localStorage.setItem('cun_snake_student', JSON.stringify(s)); }
  function getBestScore(chapter) {
    try {
      const b = JSON.parse(localStorage.getItem('cun_snake_best') || '{}');
      return b[chapter] || 0;
    } catch { return 0; }
  }
  function saveBestScore(chapter, score) {
    const b = JSON.parse(localStorage.getItem('cun_snake_best') || '{}');
    if (!b[chapter] || score > b[chapter]) {
      b[chapter] = score;
      localStorage.setItem('cun_snake_best', JSON.stringify(b));
      return true;
    }
    return false;
  }
  function getTotalBest() {
    try {
      const b = JSON.parse(localStorage.getItem('cun_snake_best') || '{}');
      return Object.values(b).reduce((a, v) => a + v, 0);
    } catch { return 0; }
  }

  function calcBonus(score) {
    for (const b of cfg.bonificacion_aca) {
      if (score >= b.min && score <= b.max) return b.bonus;
    }
    return 0;
  }
  function renderBonusTable() {
    const tbody = $('#tbody-bonus');
    tbody.innerHTML = '';
    cfg.bonificacion_aca.forEach(b => {
      const tr = document.createElement('tr');
      const rango = b.max >= 999999 ? `${b.min}+` : `${b.min} - ${b.max}`;
      const bonus = b.bonus > 0 ? `+${b.bonus.toFixed(1)}` : '+0.0';
      tr.innerHTML = `<td>${rango}</td><td><b>${bonus}</b></td>`;
      tbody.appendChild(tr);
    });
  }

  function bindEvents() {
    $('#form-register').addEventListener('submit', e => {
      e.preventDefault();
      const name = $('#input-name').value.trim();
      const email = $('#input-email').value.trim().toLowerCase();
      if (!email.endsWith('@' + cfg.email_domain)) {
        alert('El correo debe ser @' + cfg.email_domain);
        return;
      }
      student = { name, email };
      saveStudent(student);
      goToMenu();
    });
    $('#link-reset').addEventListener('click', e => {
      e.preventDefault();
      if (confirm('¿Cambiar de estudiante? Se borrarán los datos guardados en este navegador.')) {
        localStorage.removeItem('cun_snake_student');
        localStorage.removeItem('cun_snake_best');
        location.reload();
      }
    });
    $('#btn-refresh-ranking').addEventListener('click', refreshRanking);
    $('#btn-back-menu').addEventListener('click', () => {
      if (confirm('¿Salir de la partida actual?')) {
        window.SnakeGame.stop();
        goToMenu();
      }
    });
    $('#btn-back-menu2').addEventListener('click', goToMenu);
    $('#btn-play-again').addEventListener('click', () => {
      const lastChapter = window._lastPlayedChapter || 1;
      startClassicGame(lastChapter);
    });

    // Botón "Menú principal" — global, funciona en cualquier pantalla
    document.querySelectorAll('.btn-menu-return').forEach(btn => {
      btn.addEventListener('click', e => {
        e.preventDefault();
        stopAllGames();
        exitFullscreenIfActive();
        goToMenu();
      });
    });

    // Botón "Salir" del juego del Laboratorio (arriba a la izquierda del canvas)
    const btnLabExit = $('#btn-lab-exit-game');
    if (btnLabExit) {
      btnLabExit.addEventListener('click', () => {
        if (confirm('¿Salir del juego actual? Se perderá el puntaje no enviado.')) {
          stopAllGames();
          exitFullscreenIfActive();
          goToMenu();
        }
      });
    }

    // Botón "Cerrar sesión" — limpia localStorage y vuelve al registro
    const btnLogout = $('#btn-logout');
    if (btnLogout) {
      btnLogout.addEventListener('click', () => {
        if (confirm('¿Cerrar sesión? Se borrarán los datos locales de este navegador (nombre, email y récords). Los datos en la nube del docente NO se borran.')) {
          stopAllGames();
          exitFullscreenIfActive();
          localStorage.removeItem('cun_snake_student');
          localStorage.removeItem('cun_snake_best');
          location.reload();
        }
      });
    }

    // Pantalla completa (ambos modos)
    bindFullscreen('#btn-fullscreen-classic', '#screen-game');
    bindFullscreen('#btn-fullscreen-lab', '#screen-lab-game');
  }

  function stopAllGames() {
    if (window.SnakeGame && window.SnakeGame.stop) try { window.SnakeGame.stop(); } catch (_) {}
    if (window.LabEngines && window.LabEngines.stop) try { window.LabEngines.stop(); } catch (_) {}
  }

  function exitFullscreenIfActive() {
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  }

  function bindFullscreen(btnSel, screenSel) {
    const btn = document.querySelector(btnSel);
    const screen = document.querySelector(screenSel);
    if (!btn || !screen) return;
    btn.addEventListener('click', () => toggleFullscreen(screen));
  }

  function toggleFullscreen(el) {
    const doc = document;
    const isFs = doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement;
    if (!isFs) {
      const req = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen;
      if (req) req.call(el).catch(err => console.warn('Fullscreen error:', err));
    } else {
      const exit = doc.exitFullscreen || doc.webkitExitFullscreen || doc.mozCancelFullScreen;
      if (exit) exit.call(doc);
    }
  }

  function goToMenu() {
    $('#lbl-name').textContent = student.name;
    $('#lbl-email').textContent = student.email;
    const total = getTotalBest();
    $('#lbl-best').textContent = total;
    $('#lbl-bonus').textContent = '+' + calcBonus(total).toFixed(1);
    renderChapters();
    refreshRanking();
    window.LabMode.init(cfg, levelsData, student);
    showScreen('menu');
  }

  function renderChapters() {
    const grid = $('#chapter-grid');
    grid.innerHTML = '';
    const randomCard = document.createElement('button');
    randomCard.className = 'chapter-btn random';
    randomCard.innerHTML = `<strong>🎲 Aleatorio</strong><small>10 preguntas al azar de los 9 caps</small>`;
    randomCard.addEventListener('click', () => startClassicGame('random'));
    grid.appendChild(randomCard);
    cfg.capitulos.forEach(c => {
      const best = getBestScore(c.num);
      const btn = document.createElement('button');
      btn.className = 'chapter-btn';
      btn.innerHTML = `
        <strong>${c.icono} Cap. ${c.num}</strong>
        <small>${c.titulo}</small>
        <small style="color:var(--dorado);font-weight:700;">Mejor: ${best} pts</small>
      `;
      btn.addEventListener('click', () => startClassicGame(c.num));
      grid.appendChild(btn);
    });
  }

  async function refreshRanking() {
    const list = $('#ranking-list');
    list.innerHTML = '<li class="ranking-empty">Cargando ranking...</li>';
    const result = await window.SheetsSender.fetchRanking(cfg.google_sheets_endpoint);
    list.innerHTML = '';
    if (!result.ok || !result.ranking || result.ranking.length === 0) {
      list.innerHTML = `<li class="ranking-empty">${result.error ? 'No se pudo cargar' : 'Aún no hay puntajes. ¡Sé el primero!'}</li>`;
      return;
    }
    result.ranking.slice(0, 10).forEach((r, i) => {
      const pos = i + 1;
      const medal = pos === 1 ? '🥇' : pos === 2 ? '🥈' : pos === 3 ? '🥉' : '';
      const li = document.createElement('li');
      li.innerHTML = `<span><span class="ranking-position">${medal || pos}</span> ${r.alias}</span>
                     <span class="ranking-score">${r.score} pts</span>`;
      list.appendChild(li);
    });
  }

  function startClassicGame(chapter) {
    window._lastPlayedChapter = chapter;
    showScreen('game');
    window.SnakeGame.start(chapter, cfg, questions);
  }

  window.UI = {
    async showEndScreen(result) {
      const bonusNow = calcBonus(result.score);
      $('#end-title').textContent = result.completed ? '🏆 ¡Capítulo completado!' : '🎯 Fin de la partida';
      $('#end-score').textContent = result.score;
      $('#end-hits').textContent = result.hits;
      $('#end-misses').textContent = result.misses;
      $('#end-duration').textContent = result.duration + 's';
      $('#end-bonus').textContent = '+' + bonusNow.toFixed(1) + ' puntos ACA';
      const chapterKey = result.chapter === 'random' ? 'random' : String(result.chapter);
      const isNewBest = saveBestScore(chapterKey, result.score);
      const status = $('#send-status');
      status.className = 'send-status';
      status.textContent = 'Enviando resultado al docente...';
      const sendResult = await window.SheetsSender.send({
        endpoint: cfg.google_sheets_endpoint,
        name: student.name, email: student.email,
        chapter: result.chapter, score: result.score,
        hits: result.hits, misses: result.misses,
        duration: result.duration, bonus: bonusNow
      });
      if (sendResult.ok) {
        status.className = 'send-status ok';
        status.textContent = '✓ Resultado enviado. ' + (isNewBest ? '¡Nuevo récord!' : '');
      } else {
        status.className = 'send-status err';
        status.textContent = '⚠ No se pudo enviar (' + sendResult.error + ').';
      }
      showScreen('end');
    }
  };

  init();
})();
