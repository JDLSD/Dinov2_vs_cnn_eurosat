# Demo web: clasificación EuroSAT en el navegador

Página estática (sin servidor) que ejecuta tres modelos con **ONNX Runtime Web**: el *stem* nativo A+B, DINOv2-reg original y la ResNet-18 desde cero.
La imagen del usuario nunca sale de su navegador.

## Archivos

| Archivo | Origen |
|---|---|
| `index.html`, `preprocess.js`, `assets/clases/*.png` | En el repositorio (las imágenes de referencia de las 10 clases no dependen de los modelos) |
| `config.json`, `models/*.onnx`, `examples/*.png` | Generados por la **sección 7** del cuaderno (`web_export.zip`) |

`preprocess.js` reimplementa el redimensionado de Pillow (bilineal a 64 px, bicúbico 64→224) y coincide píxel a píxel con PIL
(probado con imágenes de 97×83, 640×480, 1000×1000 y 64→224). Así la página recibe exactamente la misma entrada que el cuaderno.

## Publicar

1. Ejecutar la sección 7 del cuaderno y descargar `web_export.zip`.
2. Descomprimirlo dentro de `web/` (quedan `web/config.json`, `web/models/`, `web/examples/`).
3. `git add web && git commit -m "Demo: modelos exportados" && git push`.
4. Una sola vez: **Settings → Pages → Source: GitHub Actions**. El flujo `.github/workflows/pages.yml` publica `web/`.
5. URL: `https://<usuario>.github.io/<repositorio>/`. Esa es la URL del QR del póster.

Tamaños de la corrida del 2026-11-08: `dinov2_dual_fp32.onnx` ≈ 84 MB y `resnet18.onnx` ≈ 43 MB (GitHub admite hasta 100 MB por archivo; Git avisa sobre los de más de 50 MB).
El int8 (104 MB) no se usa y el `.gitignore` lo excluye. Si la página no carga los modelos, el recuadro superior indica el motivo (archivo no subido, puntero de Git LFS o página abierta con `file://`).

## Probar en local

```bash
cd web && python -m http.server 8000   # abrir http://localhost:8000 (con file:// el navegador bloquea fetch)
```

En **Detalles técnicos y autoprueba** la página compara sus probabilidades con las calculadas en Python para 4 ejemplos; Δmax < 1e-3 indica que el preprocesamiento y el modelo coinciden.

## Limitaciones que muestra la página

- Confianza (softmax) no es precisión: se muestra junto al F1 de la clase en EuroSAT-test.
- Fuera de Europa los modelos no están validados: en RESISC45 el F1 cayó a 0.24–0.45.
- Solo 10 clases: cualquier escena se asigna a la más parecida.
