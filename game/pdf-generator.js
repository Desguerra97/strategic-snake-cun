/* ============================================================
   PDF Generator — Genera el reporte final del estudiante
   Usa jsPDF (cargado desde CDN en index.html)
   ============================================================ */
(function () {
  'use strict';

  window.PDFGenerator = {
    async generate(student, cfg, endpoint) {
      if (typeof jspdf === 'undefined' || !jspdf.jsPDF) {
        alert('Librería jsPDF no cargada. Recarga la página.');
        return;
      }

      // Pedir el reporte completo al backend
      const url = endpoint + (endpoint.includes('?') ? '&' : '?') + 'action=myAnswers&email=' + encodeURIComponent(student.email);
      const feedbackUrl = endpoint + (endpoint.includes('?') ? '&' : '?') + 'action=myFeedback&email=' + encodeURIComponent(student.email);

      let answersData = { answers: [] };
      let feedbackData = { feedback: [] };
      try {
        const [aRes, fRes] = await Promise.all([
          fetch(url).then(r => r.json()),
          fetch(feedbackUrl).then(r => r.json())
        ]);
        if (aRes.ok) answersData = aRes;
        if (fRes.ok) feedbackData = fRes;
      } catch (err) {
        console.warn('Error cargando datos para PDF:', err);
      }

      const { jsPDF } = jspdf;
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });

      // ============ PORTADA ============
      renderCover(doc, student, answersData.answers, feedbackData.feedback);

      // ============ SECCIONES POR NIVEL ============
      // Agrupar respuestas por nivel (última versión de cada uno)
      const byLevel = groupLatest(answersData.answers, 'nivel');
      const fbByLevel = groupLatest(feedbackData.feedback, 'nivel');

      const niveles = Object.keys(byLevel).sort((a, b) => Number(a) - Number(b));

      for (const nivel of niveles) {
        const ans = byLevel[nivel];
        const fb  = fbByLevel[nivel];
        doc.addPage();
        renderLevelPage(doc, nivel, ans, fb);
      }

      // ============ RESUMEN FINAL ============
      doc.addPage();
      renderSummaryPage(doc, student, answersData.answers, feedbackData.feedback);

      // Guardar
      const filename = 'Laboratorio-Ideas-' + safeName(student.name) + '.pdf';
      doc.save(filename);
      return filename;
    }
  };

  // ============================================================
  // PORTADA
  // ============================================================
  function renderCover(doc, student, answers, feedback) {
    const w = 210, h = 297;
    // Fondo azul
    doc.setFillColor(15, 45, 90);
    doc.rect(0, 0, w, h, 'F');
    // Franja dorada superior
    doc.setFillColor(200, 155, 50);
    doc.rect(0, 0, w, 8, 'F');
    // Franja dorada inferior
    doc.setFillColor(200, 155, 50);
    doc.rect(0, h - 8, w, 8, 'F');

    // Título
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(32);
    doc.setFont('helvetica', 'bold');
    doc.text('LABORATORIO DE', w / 2, 60, { align: 'center' });
    doc.text('IDEAS DE NEGOCIO', w / 2, 74, { align: 'center' });

    doc.setFontSize(14);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(200, 220, 240);
    doc.text('Plan de negocio inicial + Evaluación IA', w / 2, 86, { align: 'center' });

    // Datos del estudiante
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(30, 110, w - 60, 60, 3, 3, 'F');

    doc.setTextColor(15, 45, 90);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('ESTUDIANTE', 40, 122);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(14);
    doc.text(student.name || 'Sin nombre', 40, 130);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('EMAIL', 40, 143);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(student.email || 'sin_email', 40, 150);

    // Estadísticas
    const niveles = new Set(answers.map(a => a.nivel)).size;
    const totalPalabras = answers.reduce((s, a) => s + (Number(a.palabras) || 0), 0);
    const scoreIA = feedback.length
      ? (feedback.reduce((s, f) => s + (Number(f.score) || 0), 0) / feedback.length).toFixed(1)
      : '—';

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('NIVELES COMPLETADOS', 40, 163);
    doc.setFont('helvetica', 'normal');
    doc.text(niveles + ' de 9', 100, 163);

    doc.setFont('helvetica', 'bold');
    doc.text('PROMEDIO EVALUACIÓN IA', 40, 170);
    doc.setFont('helvetica', 'normal');
    doc.text(scoreIA + ' / 10', 100, 170);

    // Fecha
    doc.setTextColor(200, 220, 240);
    doc.setFontSize(10);
    const fecha = new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
    doc.text('Generado el ' + fecha, w / 2, h - 30, { align: 'center' });

    // Institución
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.text('Corporación Unificada Nacional (CUN)', w / 2, h - 22, { align: 'center' });
    doc.text('Administración Estratégica · Creación de Empresas III', w / 2, h - 16, { align: 'center' });
  }

  // ============================================================
  // PÁGINA POR NIVEL
  // ============================================================
  function renderLevelPage(doc, nivel, answer, feedback) {
    const w = 210;
    let y = 20;

    // Header con franja
    doc.setFillColor(15, 45, 90);
    doc.rect(0, 0, w, 12, 'F');
    doc.setFillColor(200, 155, 50);
    doc.rect(0, 12, w, 2, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('NIVEL ' + nivel + ' · ' + (answer ? answer.seccion : ''), 15, 8);

    // Título del nivel
    y = 25;
    doc.setTextColor(15, 45, 90);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Nivel ' + nivel, 15, y);
    y += 6;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(70, 70, 75);
    if (answer) {
      const seccionText = doc.splitTextToSize(answer.seccion || '', w - 30);
      doc.text(seccionText, 15, y);
      y += seccionText.length * 5 + 4;
    }

    // Puntaje del juego
    doc.setFillColor(240, 240, 245);
    doc.roundedRect(15, y, w - 30, 12, 2, 2, 'F');
    doc.setTextColor(15, 45, 90);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('🎮 Puntaje del mini-juego: ' + (answer ? answer.puntaje_juego : 0) +
             '   |   ⏱ Duración: ' + (answer ? answer.duracion : 0) + 's' +
             '   |   ✍ Palabras: ' + (answer ? answer.palabras : 0), 20, y + 8);
    y += 18;

    // Respuesta del estudiante
    doc.setFillColor(200, 155, 50);
    doc.rect(15, y, 2, 5, 'F');
    doc.setTextColor(15, 45, 90);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Tu respuesta', 20, y + 4);
    y += 8;

    doc.setTextColor(50, 50, 55);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const respuestaText = doc.splitTextToSize(answer && answer.respuesta ? answer.respuesta : '(sin respuesta)', w - 30);
    doc.text(respuestaText, 15, y);
    y += respuestaText.length * 4.5 + 8;

    // Feedback IA
    if (y > 220) { doc.addPage(); y = 20; }

    doc.setFillColor(110, 60, 140);
    doc.rect(15, y, 2, 5, 'F');
    doc.setTextColor(110, 60, 140);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('🤖 Evaluación de la IA', 20, y + 4);
    y += 10;

    if (!feedback) {
      doc.setTextColor(150, 100, 100);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'italic');
      doc.text('(No se registró feedback IA para este nivel)', 15, y);
      return;
    }

    // Score IA
    doc.setFillColor(240, 235, 245);
    doc.roundedRect(15, y, w - 30, 10, 2, 2, 'F');
    doc.setTextColor(110, 60, 140);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Score IA: ' + feedback.score + ' / 10', 20, y + 7);
    y += 14;

    // Fortalezas
    y = renderList(doc, y, 'Fortalezas detectadas', feedback.fortalezas, [46, 139, 87]);
    y = renderList(doc, y, 'Sugerencias específicas', feedback.sugerencias, [200, 155, 50]);
    y = renderList(doc, y, 'Elementos faltantes o a mejorar', feedback.elementosFaltantes, [192, 57, 43]);

    if (feedback.comentarioGeneral) {
      if (y > 250) { doc.addPage(); y = 20; }
      doc.setFillColor(240, 235, 245);
      doc.roundedRect(15, y, w - 30, 20, 2, 2, 'F');
      doc.setTextColor(110, 60, 140);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Comentario general', 20, y + 6);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(70, 70, 75);
      const comm = doc.splitTextToSize(feedback.comentarioGeneral, w - 40);
      doc.text(comm, 20, y + 12);
    }
  }

  function renderList(doc, y, title, items, color) {
    if (!items || items.length === 0) return y;
    const w = 210;
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setTextColor(color[0], color[1], color[2]);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(title, 15, y);
    y += 5;
    doc.setTextColor(50, 50, 55);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    items.forEach(it => {
      if (y > 275) { doc.addPage(); y = 20; }
      const wrapped = doc.splitTextToSize('• ' + it, w - 25);
      doc.text(wrapped, 20, y);
      y += wrapped.length * 4 + 1;
    });
    return y + 5;
  }

  // ============================================================
  // RESUMEN FINAL
  // ============================================================
  function renderSummaryPage(doc, student, answers, feedback) {
    const w = 210, h = 297;

    doc.setFillColor(15, 45, 90);
    doc.rect(0, 0, w, 12, 'F');
    doc.setFillColor(200, 155, 50);
    doc.rect(0, 12, w, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('RESUMEN GENERAL', 15, 8);

    doc.setTextColor(15, 45, 90);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('🎯 Resumen de tu Laboratorio', 15, 30);

    // Métricas
    const niveles = new Set(answers.map(a => a.nivel)).size;
    const totalGame = answers.reduce((s, a) => s + (Number(a.puntaje_juego) || 0), 0);
    const avgIA = feedback.length ? (feedback.reduce((s, f) => s + (Number(f.score) || 0), 0) / feedback.length) : 0;
    const totalPalabras = answers.reduce((s, a) => s + (Number(a.palabras) || 0), 0);

    let y = 45;
    doc.setFillColor(240, 240, 245);
    doc.roundedRect(15, y, w - 30, 50, 3, 3, 'F');
    doc.setTextColor(15, 45, 90);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Niveles completados:',   25, y + 12);
    doc.text('Puntaje total juegos:',  25, y + 22);
    doc.text('Promedio evaluación IA:',25, y + 32);
    doc.text('Palabras escritas:',     25, y + 42);
    doc.setFont('helvetica', 'normal');
    doc.text(niveles + ' de 9',                    120, y + 12);
    doc.text(String(totalGame) + ' pts',           120, y + 22);
    doc.text(avgIA.toFixed(1) + ' / 10',           120, y + 32);
    doc.text(String(totalPalabras) + ' palabras',  120, y + 42);
    y += 60;

    // Nota final estimada
    doc.setFillColor(46, 139, 87);
    doc.roundedRect(15, y, w - 30, 30, 3, 3, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('BONIFICACIÓN ACA ESTIMADA', 25, y + 10);
    const bonus = Math.min(2.0, ((niveles / 9) * 1.0) + ((avgIA / 10) * 1.0));
    doc.setFontSize(22);
    doc.text('+' + bonus.toFixed(2) + ' puntos', 25, y + 22);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.text('(basado en niveles completados y calidad promedio de tus respuestas)', 25, y + 27);
    y += 40;

    // Recomendación final
    doc.setTextColor(15, 45, 90);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('📝 Próximos pasos', 15, y);
    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(50, 50, 55);
    const consejo = [
      '1. Toma este documento como el borrador oficial de tu plan de negocio.',
      '2. Revisa las sugerencias de la IA de cada nivel y mejora tu redacción.',
      '3. Entrega el documento oficial en Moodle antes de la fecha límite del ACA.',
      '4. Si algún nivel quedó bajo (<7/10), vuelve a jugarlo — sube tu bono.'
    ];
    consejo.forEach(l => {
      const wrapped = doc.splitTextToSize(l, w - 30);
      doc.text(wrapped, 15, y);
      y += wrapped.length * 5 + 2;
    });

    // Footer
    doc.setTextColor(150, 150, 150);
    doc.setFontSize(8);
    doc.text('Laboratorio de Ideas de Negocio · CUN · Administración Estratégica', w / 2, h - 8, { align: 'center' });
  }

  // ============================================================
  // Utilidades
  // ============================================================
  function groupLatest(items, key) {
    const map = {};
    items.forEach(it => {
      const k = it[key];
      const t = new Date(it.timestamp).getTime();
      if (!map[k] || new Date(map[k].timestamp).getTime() < t) {
        map[k] = it;
      }
    });
    return map;
  }

  function safeName(name) {
    return String(name || 'estudiante').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
  }
})();
