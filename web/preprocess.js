// Preprocesamiento idéntico al del cuaderno (PIL + torchvision), en JavaScript puro.
// Reproduce ImagingResample de Pillow: pasada horizontal y luego vertical, coeficientes en punto fijo de 22 bits.
(function (root) {
  "use strict";
  const PRECISION_BITS = 22, ONE = 1 << PRECISION_BITS, HALF = 1 << (PRECISION_BITS - 1);
  const FILTERS = {
    bilinear: { support: 1.0, f: (x) => { x = Math.abs(x); return x < 1 ? 1 - x : 0; } },
    bicubic: { support: 2.0, f: (x) => {           // a = -0.5, como PIL (torch usa -0.75: por eso no se hace en el grafo)
      const a = -0.5; x = Math.abs(x);
      if (x < 1) return ((a + 2) * x - (a + 3)) * x * x + 1;
      if (x < 2) return (((x - 5) * x + 8) * x - 4) * a;
      return 0;
    } },
  };

  function coeffs(inSize, outSize, filter) {
    const scale = inSize / outSize, filterscale = Math.max(scale, 1), support = filter.support * filterscale;
    const ksize = Math.ceil(support) * 2 + 1, bounds = new Int32Array(outSize * 2), kk = new Int32Array(outSize * ksize);
    const tmp = new Float64Array(ksize);
    for (let xx = 0; xx < outSize; xx++) {
      const center = (xx + 0.5) * scale, ss = 1 / filterscale;
      let xmin = Math.trunc(center - support + 0.5); if (xmin < 0) xmin = 0;
      let xmax = Math.trunc(center + support + 0.5); if (xmax > inSize) xmax = inSize;
      xmax -= xmin;
      let ww = 0;
      for (let x = 0; x < xmax; x++) { const w = filter.f((x + xmin - center + 0.5) * ss); tmp[x] = w; ww += w; }
      for (let x = 0; x < ksize; x++) {
        const k = x < xmax && ww !== 0 ? tmp[x] / ww : 0;
        kk[xx * ksize + x] = k < 0 ? Math.trunc(-0.5 + k * ONE) : Math.trunc(0.5 + k * ONE);
      }
      bounds[xx * 2] = xmin; bounds[xx * 2 + 1] = xmax;
    }
    return { ksize, bounds, kk };
  }

  function clip8(v) { if (v >= ONE * 256) return 255; if (v <= 0) return 0; return Math.floor(v / ONE); }

  // src: Uint8 RGB entrelazado (w*h*3). Devuelve Uint8 RGB (dw*dh*3).
  function resize(src, w, h, dw, dh, kind) {
    if (w === dw && h === dh) return src.slice();      // PIL devuelve una copia si el tamaño no cambia
    const filter = FILTERS[kind];
    let cur = src, cw = w;
    if (dw !== w) {                                     // pasada horizontal
      const { ksize, bounds, kk } = coeffs(w, dw, filter), out = new Uint8Array(dw * h * 3);
      for (let y = 0; y < h; y++) for (let xx = 0; xx < dw; xx++) {
        const xmin = bounds[xx * 2], xmax = bounds[xx * 2 + 1], o = xx * ksize;
        for (let c = 0; c < 3; c++) {
          let ss = HALF;
          for (let x = 0; x < xmax; x++) ss += cur[(y * w + x + xmin) * 3 + c] * kk[o + x];
          out[(y * dw + xx) * 3 + c] = clip8(ss);
        }
      }
      cur = out; cw = dw;
    }
    if (dh !== h) {                                     // pasada vertical
      const { ksize, bounds, kk } = coeffs(h, dh, filter), out = new Uint8Array(cw * dh * 3);
      for (let yy = 0; yy < dh; yy++) {
        const ymin = bounds[yy * 2], ymax = bounds[yy * 2 + 1], o = yy * ksize;
        for (let x = 0; x < cw; x++) for (let c = 0; c < 3; c++) {
          let ss = HALF;
          for (let y = 0; y < ymax; y++) ss += cur[((y + ymin) * cw + x) * 3 + c] * kk[o + y];
          out[(yy * cw + x) * 3 + c] = clip8(ss);
        }
      }
      cur = out;
    }
    return cur;
  }

  // ToTensor + Normalize → Float32 en formato CHW [1,3,s,s]
  function toTensor(rgb, s, mean, std) {
    const n = s * s, out = new Float32Array(3 * n);
    for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) out[c * n + i] = (rgb[i * 3 + c] / 255 - mean[c]) / std[c];
    return out;
  }

  // RGBA (ImageData) → recorte cuadrado [x0,y0,side] → RGB
  function cropRGB(rgba, w, x0, y0, side) {
    const out = new Uint8Array(side * side * 3);
    for (let y = 0; y < side; y++) for (let x = 0; x < side; x++) {
      const i = ((y + y0) * w + (x + x0)) * 4, j = (y * side + x) * 3;
      out[j] = rgba[i]; out[j + 1] = rgba[i + 1]; out[j + 2] = rgba[i + 2];
    }
    return out;
  }

  const api = { resize, toTensor, cropRGB };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.Pre = api;
})(typeof self !== "undefined" ? self : this);
