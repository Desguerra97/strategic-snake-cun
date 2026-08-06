/* ============================================================
   Envío de resultados a Google Sheets vía Apps Script Web App
   Endpoint configurado en data/config.json
   ============================================================ */
window.SheetsSender = {
  /**
   * Envía un resultado al Google Sheet.
   * @param {Object} opts { endpoint, name, email, chapter, score, hits, misses, duration, bonus }
   * @returns {Promise<{ok:boolean,ranking?:Array,error?:string}>}
   */
  async send(opts) {
    if (!opts.endpoint || opts.endpoint.startsWith('REEMPLAZAR')) {
      return { ok: false, error: 'El docente no ha configurado el endpoint de Google Sheets aún.' };
    }
    try {
      const body = new URLSearchParams({
        name: opts.name,
        email: opts.email,
        chapter: String(opts.chapter),
        score: String(opts.score),
        hits: String(opts.hits),
        misses: String(opts.misses),
        duration: String(opts.duration),
        bonus: String(opts.bonus),
        client_ts: new Date().toISOString(),
        hash: makeHash(opts.email + '|' + opts.score + '|' + opts.chapter)
      });
      const res = await fetch(opts.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      return { ok: true, ranking: data.ranking || [], best: data.best || null };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  },

  async fetchRanking(endpoint) {
    if (!endpoint || endpoint.startsWith('REEMPLAZAR')) {
      return { ok: false, error: 'Endpoint no configurado' };
    }
    try {
      const url = endpoint + (endpoint.includes('?') ? '&' : '?') + 'action=ranking';
      const res = await fetch(url);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      return { ok: true, ranking: data.ranking || [] };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }
};

function makeHash(str) {
  // Hash simple no criptográfico (evita POST manuales triviales)
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h).toString(36);
}
