/* ============================================================
   Laboratorio de Ideas — Enrutador de motor de juego
   Todos los niveles usan Diamond Rush (motor único y pulido)
   ============================================================ */
(function () {
  'use strict';

  window.LabEngines = {
    start(level, config, onEnd) {
      const canvas = document.getElementById('lab-canvas');
      canvas.style.display = 'block';
      const container = document.getElementById('lab-game-container');
      if (container) container.style.display = 'none';
      window.DiamondRush.start(level, onEnd);
    },
    stop() {
      if (window.DiamondRush && window.DiamondRush.stop) window.DiamondRush.stop();
    }
  };
})();
