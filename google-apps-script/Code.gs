/**
 * =====================================================================
 * Strategic Snake CUN — Google Apps Script backend (v2 con Laboratorio de Ideas)
 * =====================================================================
 * Este script maneja:
 *  - Envío de resultados del juego (culebrita clásica)
 *  - Envío de respuestas abiertas del Laboratorio de Ideas
 *  - Generación de feedback con Gemini AI
 *  - Consolidación del reporte final del estudiante
 *
 * IMPORTANTE: Requiere una propiedad de script llamada GEMINI_API_KEY
 * con tu API key de Google AI Studio (aistudio.google.com).
 * Configúrala en: engranaje ⚙️ → Propiedades de la secuencia de comandos.
 * =====================================================================
 */

const SHEET_RESULTS  = 'Resultados';
const SHEET_BEST     = 'Mejores';
const SHEET_ANSWERS  = 'Respuestas_Laboratorio';
const SHEET_FEEDBACK = 'Feedback_IA';

const HEADER_RESULTS  = ['timestamp', 'nombre', 'email', 'capitulo', 'puntaje',
                         'aciertos', 'errores', 'duracion_seg', 'bonus_aca',
                         'ip_hash', 'client_ts', 'hash_juego'];
const HEADER_BEST     = ['email', 'nombre', 'mejor_puntaje_total', 'bonus_aca',
                         'partidas_jugadas', 'ultima_partida'];
const HEADER_ANSWERS  = ['timestamp', 'nombre', 'email', 'nivel', 'seccion',
                         'respuesta', 'palabras', 'puntaje_juego', 'duracion_seg'];
const HEADER_FEEDBACK = ['timestamp', 'email', 'nivel', 'score_ia', 'fortalezas',
                         'sugerencias', 'elementos_faltantes', 'comentario_general'];

const GEMINI_MODEL = 'gemini-3.6-flash';

// =====================================================================
// Router principal (POST)
// =====================================================================
function doPost(e) {
  try {
    const action = (e.parameter && e.parameter.action) || 'saveGame';
    switch (action) {
      case 'saveGame':          return handleSaveGame(e);
      case 'saveAnswer':        return handleSaveAnswer(e);
      case 'generateFeedback':  return handleGenerateFeedback(e);
      case 'getFullReport':     return handleGetFullReport(e);
      default:                  return jsonResponse({ ok: false, error: 'Acción no reconocida: ' + action });
    }
  } catch (err) {
    return jsonResponse({ ok: false, error: err.toString() });
  }
}

// =====================================================================
// Router GET (rankings, reportes)
// =====================================================================
function doGet(e) {
  const action = (e.parameter && e.parameter.action) || 'status';
  try {
    if (action === 'ranking')      return jsonResponse({ ok: true, ranking: getRanking(10) });
    if (action === 'myAnswers')    return jsonResponse({ ok: true, answers: getStudentAnswers(e.parameter.email) });
    if (action === 'myFeedback')   return jsonResponse({ ok: true, feedback: getStudentFeedback(e.parameter.email) });
    return jsonResponse({ ok: true, message: 'Snake CUN backend v2 activo' });
  } catch (err) {
    return jsonResponse({ ok: false, error: err.toString() });
  }
}

// =====================================================================
// HANDLERS
// =====================================================================

/** Guarda un resultado del juego culebrita (compatibilidad con v1) */
function handleSaveGame(e) {
  const p = e.parameter || {};
  const sheet = getOrCreateSheet(SHEET_RESULTS, HEADER_RESULTS);
  const email = (p.email || '').toLowerCase();
  const score = parseInt(p.score || 0, 10);
  if (isDuplicate(sheet, email, score)) {
    return jsonResponse({ ok: true, duplicate: true });
  }
  sheet.appendRow([
    new Date(), p.name || 'sin_nombre', email, p.chapter || '',
    score, parseInt(p.hits || 0, 10), parseInt(p.misses || 0, 10),
    parseInt(p.duration || 0, 10), parseFloat(p.bonus || 0),
    hashString(String(e.contextPath || '') + email), p.client_ts || '', p.hash || ''
  ]);
  updateBest(p);
  return jsonResponse({ ok: true, ranking: getRanking(10) });
}

/** Guarda la respuesta abierta de un nivel del Laboratorio de Ideas */
function handleSaveAnswer(e) {
  const p = e.parameter || {};
  const sheet = getOrCreateSheet(SHEET_ANSWERS, HEADER_ANSWERS);
  const email = (p.email || '').toLowerCase();
  const nivel = parseInt(p.nivel || 1, 10);
  const respuesta = (p.respuesta || '').trim();
  const palabras = respuesta.split(/\s+/).filter(Boolean).length;

  sheet.appendRow([
    new Date(), p.name || 'sin_nombre', email, nivel, p.seccion || '',
    respuesta, palabras, parseInt(p.puntaje_juego || 0, 10), parseInt(p.duracion || 0, 10)
  ]);
  return jsonResponse({ ok: true, palabras: palabras });
}

/** Llama a Gemini para dar feedback sobre la respuesta abierta */
function handleGenerateFeedback(e) {
  const p = e.parameter || {};
  const email = (p.email || '').toLowerCase();
  const nivel = parseInt(p.nivel || 1, 10);
  const respuesta = (p.respuesta || '').trim();
  const seccion = p.seccion || '';
  const consigna = p.consigna || '';
  const requisitos = p.requisitos || '';

  if (!respuesta) {
    return jsonResponse({ ok: false, error: 'No hay respuesta para evaluar' });
  }

  const prompt = buildPrompt(seccion, consigna, requisitos, respuesta);
  let feedback;
  try {
    feedback = callGemini(prompt);
  } catch (err) {
    return jsonResponse({ ok: false, error: 'Error IA: ' + err.toString() });
  }

  // Parsear el JSON de Gemini (viene envuelto en ```json ... ```)
  const parsed = parseFeedback(feedback);
  if (!parsed) {
    return jsonResponse({ ok: false, error: 'La IA no devolvió un JSON válido', raw: feedback });
  }

  // Guardar en la hoja de feedback
  const sheet = getOrCreateSheet(SHEET_FEEDBACK, HEADER_FEEDBACK);
  sheet.appendRow([
    new Date(), email, nivel,
    parsed.score || 0,
    (parsed.fortalezas || []).join(' | '),
    (parsed.sugerencias || []).join(' | '),
    (parsed.elementosFaltantes || []).join(' | '),
    parsed.comentarioGeneral || ''
  ]);

  return jsonResponse({ ok: true, feedback: parsed });
}

/** Devuelve todo lo que necesita el PDF final del estudiante */
function handleGetFullReport(e) {
  const email = (e.parameter.email || '').toLowerCase();
  if (!email) return jsonResponse({ ok: false, error: 'Falta email' });
  return jsonResponse({
    ok: true,
    student: { email },
    answers: getStudentAnswers(email),
    feedback: getStudentFeedback(email),
    bestScores: getStudentBestScores(email)
  });
}

// =====================================================================
// GEMINI
// =====================================================================
function callGemini(prompt) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) throw new Error('GEMINI_API_KEY no configurada en propiedades del script');
  if (!prompt || typeof prompt !== 'string') throw new Error('Prompt inválido: ' + typeof prompt);

  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
              GEMINI_MODEL + ':generateContent?key=' + apiKey;
  const payload = {
    contents: [{
      role: 'user',
      parts: [{ text: String(prompt) }]
    }],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 8192,
      responseMimeType: 'application/json'
    }
  };
  const payloadStr = JSON.stringify(payload);
  console.log('Payload (primeros 300 chars): ' + payloadStr.substring(0, 300));

  const response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: payloadStr,
    muteHttpExceptions: true
  });
  const raw = response.getContentText();
  const code = response.getResponseCode();
  if (code !== 200) {
    console.log('HTTP ' + code + ': ' + raw.substring(0, 800));
  }
  const data = JSON.parse(raw);
  if (data.error) {
    console.log('Error Gemini completo: ' + JSON.stringify(data.error));
    throw new Error(data.error.message || 'error de Gemini');
  }
  if (!data.candidates || !data.candidates[0]) {
    console.log('Sin candidatos: ' + raw.substring(0, 500));
    throw new Error('Gemini no devolvió respuesta');
  }
  const cand = data.candidates[0];
  if (cand.finishReason && cand.finishReason !== 'STOP') {
    console.log('finishReason: ' + cand.finishReason + ' | raw: ' + raw.substring(0, 400));
  }
  if (!cand.content || !cand.content.parts || !cand.content.parts[0]) {
    throw new Error('Respuesta vacía (finishReason: ' + (cand.finishReason || 'unknown') + ')');
  }
  return cand.content.parts[0].text;
}

function buildPrompt(seccion, consigna, requisitos, respuesta) {
  return [
    'Eres un profesor experto en Administración Estratégica de la Corporación',
    'Unificada Nacional (CUN), evaluando el borrador del plan de negocio de un',
    'estudiante del curso de Creación de Empresas III.',
    '',
    'SECCIÓN QUE ESTÁ TRABAJANDO: ' + seccion,
    '',
    'CONSIGNA ORIGINAL: ' + consigna,
    '',
    'REQUISITOS FORMALES: ' + requisitos,
    '',
    'RESPUESTA DEL ESTUDIANTE:',
    '"""',
    respuesta,
    '"""',
    '',
    'Analiza la respuesta con criterio pedagógico. Sé constructivo y específico.',
    'Evita generalidades. Cita elementos concretos de la respuesta del estudiante.',
    'Escribe todo en español latinoamericano, tono cercano pero profesional.',
    '',
    'Devuelve tu evaluación en JSON EXACTAMENTE con esta estructura:',
    '{',
    '  "score": <número entero de 0 a 10>,',
    '  "fortalezas": ["punto fuerte 1", "punto fuerte 2"],',
    '  "sugerencias": ["sugerencia específica y accionable 1", "sugerencia 2", "sugerencia 3"],',
    '  "elementosFaltantes": ["elemento requerido no incluido 1", "elemento 2"],',
    '  "comentarioGeneral": "2-3 frases con evaluación global y motivación"',
    '}'
  ].join('\n');
}

function parseFeedback(text) {
  // Gemini con responseMimeType=application/json debe devolver JSON puro
  try { return JSON.parse(text); } catch (_) {}
  // Fallback: extraer JSON de un bloque ```json ... ```
  const m = text.match(/\{[\s\S]*\}/);
  if (m) {
    try { return JSON.parse(m[0]); } catch (_) {}
  }
  return null;
}

// =====================================================================
// HELPERS DE HOJAS
// =====================================================================
function getOrCreateSheet(name, header) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(header);
    sheet.getRange(1, 1, 1, header.length)
         .setFontWeight('bold')
         .setBackground('#0f2d5a')
         .setFontColor('white');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function isDuplicate(sheet, email, score) {
  const last = sheet.getLastRow();
  if (last < 2) return false;
  const range = Math.max(2, last - 20);
  const data = sheet.getRange(range, 1, last - range + 1, 5).getValues();
  const now = new Date().getTime();
  for (const row of data) {
    const ts = new Date(row[0]).getTime();
    if (row[2] === email && String(row[4]) === String(score) && (now - ts) < 30000) return true;
  }
  return false;
}

function updateBest(p) {
  const sheet = getOrCreateSheet(SHEET_BEST, HEADER_BEST);
  const email = (p.email || '').toLowerCase();
  const score = parseInt(p.score || 0, 10);
  const bonus = parseFloat(p.bonus || 0);
  const data = sheet.getDataRange().getValues();
  let found = -1;
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === email) { found = i; break; }
  }
  if (found === -1) {
    sheet.appendRow([email, p.name, score, bonus, 1, new Date()]);
  } else {
    const rowIdx = found + 1;
    const curBest = data[found][2] || 0;
    const partidas = (data[found][4] || 0) + 1;
    if (score > curBest) {
      sheet.getRange(rowIdx, 3).setValue(score);
      sheet.getRange(rowIdx, 4).setValue(bonus);
    }
    sheet.getRange(rowIdx, 5).setValue(partidas);
    sheet.getRange(rowIdx, 6).setValue(new Date());
  }
}

function getRanking(limit) {
  const sheet = getOrCreateSheet(SHEET_BEST, HEADER_BEST);
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  return data.slice(1)
    .map(r => ({ email: r[0], name: r[1], score: r[2] || 0 }))
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(r => ({ alias: 'Estratega #' + hashShort(r.email), score: r.score }));
}

function getStudentAnswers(email) {
  if (!email) return [];
  const sheet = getOrCreateSheet(SHEET_ANSWERS, HEADER_ANSWERS);
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  email = email.toLowerCase();
  return data.slice(1)
    .filter(r => (r[2] || '').toLowerCase() === email)
    .map(r => ({
      timestamp: r[0], nombre: r[1], email: r[2], nivel: r[3],
      seccion: r[4], respuesta: r[5], palabras: r[6],
      puntaje_juego: r[7], duracion: r[8]
    }));
}

function getStudentFeedback(email) {
  if (!email) return [];
  const sheet = getOrCreateSheet(SHEET_FEEDBACK, HEADER_FEEDBACK);
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  email = email.toLowerCase();
  return data.slice(1)
    .filter(r => (r[1] || '').toLowerCase() === email)
    .map(r => ({
      timestamp: r[0], nivel: r[2], score: r[3],
      fortalezas: (r[4] || '').split(' | ').filter(Boolean),
      sugerencias: (r[5] || '').split(' | ').filter(Boolean),
      elementosFaltantes: (r[6] || '').split(' | ').filter(Boolean),
      comentarioGeneral: r[7]
    }));
}

function getStudentBestScores(email) {
  const sheet = getOrCreateSheet(SHEET_BEST, HEADER_BEST);
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return null;
  email = email.toLowerCase();
  for (let i = 1; i < data.length; i++) {
    if ((data[i][0] || '').toLowerCase() === email) {
      return { mejor: data[i][2], bonus: data[i][3], partidas: data[i][4] };
    }
  }
  return null;
}

// =====================================================================
// UTILIDADES
// =====================================================================
function hashString(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) + s.charCodeAt(i);
  return Math.abs(h).toString(36);
}
function hashShort(s) { return hashString(s).slice(0, 4).toUpperCase(); }

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// =====================================================================
// FUNCIONES DE DIAGNÓSTICO (ejecutar desde el editor)
// =====================================================================

/** Prueba que la API key de Gemini responde correctamente */
function testGemini() {
  try {
    const result = callGemini('Responde exactamente en JSON: {"ok":true,"mensaje":"Gemini conectado correctamente"}');
    console.log('✅ Éxito: ' + result);
  } catch (err) {
    console.log('❌ Error: ' + err.toString());
  }
}

/** Muestra qué propiedades del script están guardadas */
function listarPropiedades() {
  const props = PropertiesService.getScriptProperties().getProperties();
  console.log('Total propiedades: ' + Object.keys(props).length);
  for (const key in props) {
    const val = props[key];
    console.log(key + ' = ' + val.substring(0, 10) + '...(' + val.length + ' chars)');
  }
}

/** Lista los modelos Gemini disponibles para tu API key */
function listarModelos() {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  console.log('=== DIAGNÓSTICO ===');
  console.log('API Key presente: ' + (apiKey ? 'SÍ (' + apiKey.length + ' chars)' : 'NO'));
  if (!apiKey) return;

  const url = 'https://generativelanguage.googleapis.com/v1beta/models?key=' + apiKey;
  const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  const code = response.getResponseCode();
  const text = response.getContentText();

  console.log('Código HTTP: ' + code);
  console.log('Respuesta cruda (primeros 300 chars): ' + text.substring(0, 300));

  if (code !== 200) { console.log('❌ HTTP error, revisa arriba'); return; }

  const data = JSON.parse(text);
  if (data.error) { console.log('❌ Error de API: ' + JSON.stringify(data.error)); return; }

  const all = data.models || [];
  console.log('Total modelos devueltos: ' + all.length);

  const valid = all.filter(m =>
    m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent')
  );
  console.log('=== MODELOS CON generateContent (' + valid.length + ') ===');
  valid.forEach(m => console.log('  → ' + m.name));
}
