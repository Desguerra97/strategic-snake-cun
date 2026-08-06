/* ============================================================
   Cargador de datos JSON (config + preguntas)
   ============================================================ */
window.ContentLoader = {
  async loadAll() {
    const [cfg, qs] = await Promise.all([
      fetch('data/config.json').then(r => r.json()),
      fetch('data/questions.json').then(r => r.json())
    ]);
    return { config: cfg, questions: qs };
  }
};
