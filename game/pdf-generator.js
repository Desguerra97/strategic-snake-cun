/* ============================================================
   PDF Generator — Reporte final del estudiante
   Usa jsPDF (cargado desde CDN en index.html)
   Fix: sin emojis (jsPDF con Helvetica no los soporta bien)
   ============================================================ */
(function () {
  'use strict';

  window.PDFGenerator = {
    async generate(student, cfg, endpoint) {
      if (typeof jspdf === 'undefined' || !jspdf.jsPDF) {
        alert('Librería jsPDF no cargada. Recarga la página.');
        return;
      }

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

      renderCover(doc, student, answersData.answers, feedbackData.feedback);

      const byLevel = groupLatest(answersData.answers, 'nivel');
      const fbByLevel = groupLatest(feedbackData.feedback, 'nivel');
      const niveles = Object.keys(byLevel).sort((a, b) => Number(a) - Number(b));

      for (const nivel of niveles) {
        doc.addPage();
        renderLevelPage(doc, nivel, byLevel[nivel], fbByLevel[nivel]);
      }

      doc.addPage();
      renderSummaryPage(doc, student, answersData.answers, feedbackData.feedback);

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
    doc.setFillColor(15, 45, 90);
    doc.rect(0, 0, w, h, 'F');
    doc.setFillColor(200, 155, 50);
    doc.rect(0, 0, w, 8, 'F');
    doc.setFillColor(200, 155, 50);
    doc.rect(0, h - 8, w, 8, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(30);
    doc.setFont('helvetica', 'bold');
    doc.text('LABORATORIO DE', w / 2, 60, { align: 'center' });
    doc.text('IDEAS DE NEGOCIO', w / 2, 74, { align: 'center' });

    doc.setFontSize(13);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(200, 220, 240);
    doc.text('Plan de negocio inicial + Evaluacion IA', w / 2, 88, { align: 'center' });

    doc.setFillColor(255, 255, 255);
    doc.roundedRect(30, 115, w - 60, 65, 3, 3, 'F');

    doc.setTextColor(15, 45, 90);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('ESTUDIANTE', 40, 127);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(14);
    doc.text(String(student.name || 'Sin nombre'), 40, 135);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('EMAIL', 40, 145);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(String(student.email || 'sin_email'), 40, 152);

    const niveles = new Set(answers.map(a => a.nivel)).size;
    const scoreIA = feedback.length
      ? (feedback.reduce((s, f) => s + (Number(f.score) || 0), 0) / feedback.length).toFixed(1)
      : '--';

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('NIVELES COMPLETADOS', 40, 163);
    doc.setFont('helvetica', 'normal');
    doc.text(niveles + ' de 9', 110, 163);

    doc.setFont('helvetica', 'bold');
    doc.text('PROMEDIO IA', 40, 172);
    doc.setFont('helvetica', 'normal');
    doc.text(scoreIA + ' / 10', 110, 172);

    doc.setTextColor(200, 220, 240);
    doc.setFontSize(10);
    const fecha = new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
    doc.text('Generado el ' + fecha, w / 2, h - 32, { align: 'center' });

    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.text('Corporacion Unificada Nacional (CUN)', w / 2, h - 22, { align: 'center' });
    doc.text('Administracion Estrategica - Creacion de Empresas III', w / 2, h - 16, { align: 'center' });
  }

  // ============================================================
  // PAGINA POR NIVEL
  // ============================================================
  function renderLevelPage(doc, nivel, answer, feedback) {
    const w = 210;
    let y = 20;

    doc.setFillColor(15, 45, 90);
    doc.rect(0, 0, w, 12, 'F');
    doc.setFillColor(200, 155, 50);
    doc.rect(0, 12, w, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('NIVEL ' + nivel + '  -  ' + (answer ? String(answer.seccion) : ''), 15, 8);

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
      const seccionText = doc.splitTextToSize(String(answer.seccion || ''), w - 30);
      doc.text(seccionText, 15, y);
      y += seccionText.length * 5 + 4;
    }

    doc.setFillColor(240, 240, 245);
    doc.roundedRect(15, y, w - 30, 14, 2, 2, 'F');
    doc.setTextColor(15, 45, 90);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    const linea1 = 'Puntaje del juego: ' + (answer ? answer.puntaje_juego : 0) +
                   '     Duracion: ' + (answer ? answer.duracion : 0) + 's' +
                   '     Palabras: ' + (answer ? answer.palabras : 0);
    doc.text(linea1, 20, y + 9);
    y += 20;

    // RESPUESTA DEL ESTUDIANTE
    doc.setFillColor(200, 155, 50);
    doc.rect(15, y - 2, 3, 6, 'F');
    doc.setTextColor(15, 45, 90);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Tu respuesta', 22, y + 2);
    y += 8;

    doc.setTextColor(50, 50, 55);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const respuestaText = doc.splitTextToSize(
      answer && answer.respuesta ? String(answer.respuesta) : '(sin respuesta)',
      w - 30
    );
    doc.text(respuestaText, 15, y);
    y += respuestaText.length * 4.5 + 8;

    // FEEDBACK IA
    if (y > 220) { doc.addPage(); y = 20; }

    doc.setFillColor(110, 60, 140);
    doc.rect(15, y - 2, 3, 6, 'F');
    doc.setTextColor(110, 60, 140);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Evaluacion de la IA', 22, y + 2);
    y += 10;

    if (!feedback) {
      doc.setTextColor(150, 100, 100);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'italic');
      doc.text('(No se registro feedback IA para este nivel)', 15, y);
      return;
    }

    doc.setFillColor(240, 235, 245);
    doc.roundedRect(15, y, w - 30, 10, 2, 2, 'F');
    doc.setTextColor(110, 60, 140);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Score IA: ' + feedback.score + ' / 10', 20, y + 7);
    y += 14;

    y = renderList(doc, y, 'Fortalezas detectadas', feedback.fortalezas, [46, 139, 87]);
    y = renderList(doc, y, 'Sugerencias especificas', feedback.sugerencias, [200, 155, 50]);
    y = renderList(doc, y, 'Elementos faltantes o a mejorar', feedback.elementosFaltantes, [192, 57, 43]);

    if (feedback.comentarioGeneral) {
      if (y > 250) { doc.addPage(); y = 20; }
      doc.setFillColor(240, 235, 245);
      doc.roundedRect(15, y, w - 30, 24, 2, 2, 'F');
      doc.setTextColor(110, 60, 140);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Comentario general', 20, y + 6);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(70, 70, 75);
      const comm = doc.splitTextToSize(String(feedback.comentarioGeneral), w - 40);
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
      const wrapped = doc.splitTextToSize('- ' + String(it), w - 25);
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
    doc.text('Resumen de tu Laboratorio', 15, 30);

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
    doc.text('Niveles completados:',    25, y + 12);
    doc.text('Puntaje total juegos:',   25, y + 22);
    doc.text('Promedio evaluacion IA:', 25, y + 32);
    doc.text('Palabras escritas:',      25, y + 42);
    doc.setFont('helvetica', 'normal');
    doc.text(niveles + ' de 9',                    120, y + 12);
    doc.text(String(totalGame) + ' pts',           120, y + 22);
    doc.text(avgIA.toFixed(1) + ' / 10',           120, y + 32);
    doc.text(String(totalPalabras) + ' palabras',  120, y + 42);
    y += 60;

    doc.setFillColor(46, 139, 87);
    doc.roundedRect(15, y, w - 30, 32, 3, 3, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('BONIFICACION ACA ESTIMADA', 25, y + 10);
    const bonus = Math.min(2.0, ((niveles / 9) * 1.0) + ((avgIA / 10) * 1.0));
    doc.setFontSize(22);
    doc.text('+' + bonus.toFixed(2) + ' puntos', 25, y + 22);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.text('(basado en niveles completados y calidad promedio de tus respuestas)', 25, y + 28);
    y += 42;

    doc.setTextColor(15, 45, 90);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Proximos pasos', 15, y);
    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(50, 50, 55);
    const consejo = [
      '1. Toma este documento como el borrador oficial de tu plan de negocio.',
      '2. Revisa las sugerencias de la IA de cada nivel y mejora tu redaccion.',
      '3. Entrega el documento oficial en Moodle antes de la fecha limite del ACA.',
      '4. Si algun nivel quedo bajo (menor a 7/10), vuelve a jugarlo para subir tu bono.'
    ];
    consejo.forEach(l => {
      const wrapped = doc.splitTextToSize(l, w - 30);
      doc.text(wrapped, 15, y);
      y += wrapped.length * 5 + 2;
    });

    doc.setTextColor(150, 150, 150);
    doc.setFontSize(8);
    doc.text('Laboratorio de Ideas de Negocio - CUN - Administracion Estrategica', w / 2, h - 8, { align: 'center' });
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
