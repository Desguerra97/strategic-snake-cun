# 📊 Guía: Configurar Google Sheets como backend

Esta guía te lleva **paso a paso** (con capturas mentales) para que el juego pueda enviar los resultados a tu hoja de cálculo automáticamente. Tiempo estimado: **10 minutos**.

---

## Paso 1 — Crear la hoja de cálculo

1. Ve a [drive.google.com](https://drive.google.com) con tu Gmail personal.
2. Clic en **Nuevo** → **Hoja de cálculo de Google** → **Hoja en blanco**.
3. En la parte superior, cambia el nombre por: **`Snake CUN - Resultados 2026`**.

> No necesitas crear pestañas ni columnas: el script las creará automáticamente cuando llegue el primer resultado.

---

## Paso 2 — Abrir el editor de Apps Script

1. Estando en tu hoja, ve al menú **Extensiones** → **Apps Script**.
2. Se abre una ventana nueva con un editor de código.
3. Verás una función de ejemplo llamada `function myFunction() { }`. Bórrala completa.

---

## Paso 3 — Pegar el código del backend

1. Abre el archivo `google-apps-script/Code.gs` de este repositorio.
2. **Copia todo su contenido** (Ctrl+A, Ctrl+C).
3. **Pégalo** en el editor de Apps Script reemplazando lo que estaba (Ctrl+V).
4. Presiona **Ctrl+S** para guardar.
5. Te pedirá un nombre para el proyecto: escribe **`SnakeBackend`**.

---

## Paso 4 — Implementar como aplicación web

1. En el editor, arriba a la derecha, haz clic en **Implementar** → **Nueva implementación**.
2. Al lado del texto "Seleccionar tipo", clic en el ícono ⚙️ y elige **Aplicación web**.
3. Rellena:
   - **Descripción**: `Backend Snake CUN v1`
   - **Ejecutar como**: `Yo (tucorreo@gmail.com)`
   - **Quién tiene acceso**: `Cualquier persona` ⚠️ **Esto es crítico** — los estudiantes deben poder enviar sin iniciar sesión.
4. Clic en **Implementar**.
5. Google te pedirá permisos:
   - Clic en **Autorizar acceso**
   - Elige tu cuenta
   - Verás una pantalla que dice *"Google no ha verificado esta aplicación"* → clic en **Configuración avanzada** → **Ir a SnakeBackend (no seguro)**
   - Acepta los permisos (leer/escribir en Sheets)
6. Al finalizar te muestra una **URL de la aplicación web** que termina en `/exec`. Algo así:
   ```
   https://script.google.com/macros/s/AKfycb.../exec
   ```
7. **Copia esa URL**. La necesitas en el próximo paso.

---

## Paso 5 — Pegar la URL en el juego

1. Abre `data/config.json` en tu repositorio (o directamente en GitHub).
2. Busca la línea:
   ```json
   "google_sheets_endpoint": "REEMPLAZAR_CON_TU_URL_DEL_APPS_SCRIPT"
   ```
3. Reemplaza el texto entre comillas por tu URL:
   ```json
   "google_sheets_endpoint": "https://script.google.com/macros/s/AKfycb.../exec"
   ```
4. Guarda y haz commit/push si estás en GitHub.

---

## Paso 6 — Probar

1. Abre el juego (`index.html` o tu URL de GitHub Pages).
2. Regístrate con un email de prueba (ej. `docente@cun.edu.co`).
3. Juega una partida corta.
4. Al terminar, deberías ver **"✓ Resultado enviado al docente"**.
5. Vuelve a tu Google Sheet y actualiza — verás dos pestañas nuevas:
   - **Resultados** con la partida jugada
   - **Mejores** con el consolidado por estudiante

Si aparece "⚠ No se pudo enviar", revisa el paso 4 (permisos de acceso) o abre la consola del navegador (F12) para ver el error.

---

## Paso 7 — Descargar como Excel al final

Cuando termines el periodo de 3 semanas:

1. En tu Google Sheet, ve a **Archivo → Descargar → Microsoft Excel (.xlsx)**.
2. Abre el Excel y usa la pestaña **Mejores**:
   - Columna `email` → cruza con tu lista de matriculados del ACA.
   - Columna `bonus_aca` → es la bonificación que debes sumar a cada estudiante.

---

## 🔧 Solución de problemas comunes

| Problema | Causa | Solución |
|---|---|---|
| "No se pudo enviar" en el juego | La URL en `config.json` está mal o la implementación no es "Cualquier persona" | Repite Paso 4 con acceso "Cualquier persona" |
| El Sheet no se actualiza | El script no tiene permisos | Vuelve a Apps Script, ejecuta manualmente `doGet` una vez |
| No aparece la pestaña "Mejores" | Aún no hay ninguna partida enviada | Juega una partida de prueba primero |
| Ranking vacío en el juego | Ningún estudiante ha jugado aún | Correcto, se llenará con las primeras partidas |
| CORS error en consola | Configuración de despliegue incorrecta | Reimplementa con acceso "Cualquier persona" |

---

## 🔄 ¿Cómo actualizar el código del backend?

Si haces cambios a `Code.gs`:

1. Pega la nueva versión en Apps Script (borra la anterior).
2. Guarda (Ctrl+S).
3. Menú **Implementar** → **Administrar implementaciones**.
4. Clic en el lápiz ✏️ de tu implementación actual.
5. **Nueva versión** → **Implementar**.
6. La URL se mantiene igual, no necesitas actualizar el juego.
