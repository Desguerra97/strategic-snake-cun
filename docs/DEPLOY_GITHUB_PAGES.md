# 🚀 Guía: Publicar el juego en GitHub Pages

Tiempo estimado: **5 minutos**. Necesitas: cuenta de GitHub (gratis).

---

## Paso 1 — Crear la cuenta / repositorio

### Si no tienes cuenta GitHub
1. Ve a [github.com/join](https://github.com/join)
2. Crea tu cuenta con tu email personal.

### Crear el repositorio
1. En [github.com](https://github.com), clic en el **+** arriba a la derecha → **New repository**.
2. Rellena:
   - **Repository name**: `strategic-snake-cun` (o el nombre que prefieras)
   - **Description**: `Juego educativo Snake para Administración Estratégica CUN`
   - **Public** ✅ (necesario para GitHub Pages gratis)
   - **Add a README file**: ❌ (ya tenemos uno)
3. Clic en **Create repository**.

---

## Paso 2 — Subir los archivos

### Opción A: Interfaz web (más fácil, sin instalar nada)

1. En tu repo recién creado, clic en **uploading an existing file**.
2. Arrastra **todos los archivos y carpetas** del proyecto:
   - `index.html`
   - Carpeta `styles/`
   - Carpeta `game/`
   - Carpeta `data/`
   - Carpeta `docs/`
   - Carpeta `google-apps-script/`
   - `README.md`
   - `LICENSE`
3. Al final, en "Commit changes", pon como mensaje: `Primera versión del juego`.
4. Clic en **Commit changes**.

### Opción B: Git de línea de comandos (si ya lo usas)

```bash
cd strategic-snake-cun
git init
git add .
git commit -m "Primera versión del juego"
git branch -M main
git remote add origin https://github.com/TUUSUARIO/strategic-snake-cun.git
git push -u origin main
```

---

## Paso 3 — Activar GitHub Pages

1. En tu repo, ve a la pestaña **Settings** (arriba a la derecha).
2. En el menú lateral izquierdo, clic en **Pages**.
3. En "Build and deployment":
   - **Source**: `Deploy from a branch`
   - **Branch**: `main` — carpeta `/ (root)`
4. Clic en **Save**.
5. Espera 1-2 minutos. Al recargar la página verás:
   ```
   ✅ Your site is live at https://TUUSUARIO.github.io/strategic-snake-cun/
   ```

---

## Paso 4 — Probar la URL

1. Abre esa URL en una ventana de incógnito.
2. Regístrate con un email de prueba (ej. `docente@cun.edu.co`).
3. Juega una partida corta.

Si ves errores en la consola (F12), verifica que:
- Todos los archivos se subieron
- La ruta a `data/config.json` funciona (revisa la pestaña Network)
- El endpoint de Google Sheets está configurado en `config.json`

---

## Paso 5 — Compartir con los estudiantes

Publica en Moodle:

```
📢 ¡Nuevo juego para el curso!

Durante las próximas 3 semanas pueden jugar Strategic Snake CUN
y ganar hasta +2 puntos extra en su nota del ACA.

🔗 URL: https://TUUSUARIO.github.io/strategic-snake-cun/

Instrucciones completas: [link a COMO_JUGAR.md]

Fecha límite: [fecha del ACA]
```

---

## 🔧 Actualizar el juego después de un cambio

### Si usas la interfaz web
1. Ve al archivo que quieres cambiar (ej. `data/config.json`)
2. Clic en el ícono del lápiz ✏️ (Edit this file)
3. Haz tus cambios
4. Al fondo, "Commit changes"
5. GitHub Pages se actualiza automáticamente en 1-2 min

### Si usas Git
```bash
git add .
git commit -m "Ajuste umbral de bonificación"
git push
```

---

## 🛡️ Recomendaciones de seguridad

- **NO** subas tu URL de Google Sheets Endpoint al repo público directamente si tu institución lo prohíbe. En su lugar, edita `data/config.json` **solo** en la rama principal y protege el repo con **Branch protection** para que solo tú puedas modificarlo.
- Si quieres que el repo sea **privado**, GitHub Pages requiere plan **Pro** (~$4/mes) o usa alternativas gratuitas:
  - [Netlify Drop](https://app.netlify.com/drop) — arrastra la carpeta y listo
  - [Vercel](https://vercel.com) — deploy con GitHub sync
  - [Cloudflare Pages](https://pages.cloudflare.com) — similar a GitHub Pages, permite privados

---

## ❓ Problemas comunes

| Problema | Solución |
|---|---|
| "404 Not Found" en la URL | Espera 5 min más. GitHub Pages a veces demora en propagar. |
| El CSS no carga | Verifica que la carpeta `styles/` esté subida y que `index.html` referencie `styles/main.css` (no `/styles/main.css`) |
| No se ven las preguntas | Abre F12 → Console. Probablemente el `fetch` a `data/questions.json` falla. Verifica que la carpeta `data/` esté subida. |
| Los resultados no llegan al Sheet | Sigue [`SETUP_GOOGLE_SHEETS.md`](SETUP_GOOGLE_SHEETS.md) — el endpoint no está configurado |
