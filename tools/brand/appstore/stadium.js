/*
 * The App Store key-art stadium, drawn rather than photographed.
 *
 * A real perspective camera over a modelled bowl: a 105 × 68 m pitch, two raked
 * tiers that wrap the far side and both ends, a cantilevered roof with a ring of
 * floodlights on its front edge, and a seat-by-seat crowd. The far stand holds up
 * a painted tifo of the CF crest, and the crest is projected into the centre
 * circle. Everything is vector or procedural, so the plates stay sharp at 3840 px
 * and above, and it is seeded, so every render of a composition is the same.
 *
 * Exposes `window.renderStadium(canvas, options)`.
 */
(() => {
  const A = 52.5, B = 34; // pitch half-length (x), half-width (z)
  const LIGHT = [214, 232, 255];
  const VOLT = [200, 255, 46];

  // The flat CF crest geometry (64-unit box), injected from tools/brand/mark.path.txt.
  const MARK = () => window.CF_MARK;

  const rngFrom = (seed) => {
    let s = seed >>> 0;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  };
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = (a) => { const l = Math.hypot(...a); return [a[0] / l, a[1] / l, a[2] / l]; };
  const rgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const scale = (c, k) => [Math.min(255, c[0] * k), Math.min(255, c[1] * k), Math.min(255, c[2] * k)];

  function camera(W, H, pos, target, hfov, shiftY = 0) {
    const f = norm(sub(target, pos));
    const r = norm(cross([0, 1, 0], f));
    const u = cross(f, r);
    const F = (W / 2) / Math.tan((hfov * Math.PI) / 360);
    const cy = H / 2 + shiftY * H;
    return {
      F, pos,
      p(x, y, z) {
        const d = [x - pos[0], y - pos[1], z - pos[2]];
        const zc = dot(d, f);
        return [W / 2 + (F * dot(d, r)) / zc, cy - (F * dot(d, u)) / zc, zc];
      },
    };
  }

  // A point on the rounded rectangle `o` metres outside the pitch, walking the
  // far side, then both ends; the near side holds the camera and is left out.
  // `t` runs 0..1 over: left end (near corner → far corner), far side, right end.
  function ringSegments(o) {
    const arc = (Math.PI / 2) * o;
    return [
      { len: 2 * B, at: (s) => [-(A + o), -B + s, -1, 0] },                       // left end, z −B → B
      { len: arc, at: (s) => { const a = Math.PI - s / o; return [-A + o * Math.cos(a), B + o * Math.sin(a), Math.cos(a), Math.sin(a)]; } },
      { len: 2 * A, at: (s) => [-A + s, B + o, 0, 1] },                            // far side, x −A → A
      { len: arc, at: (s) => { const a = Math.PI / 2 - s / o; return [A + o * Math.cos(a), B + o * Math.sin(a), Math.cos(a), Math.sin(a)]; } },
      { len: 2 * B, at: (s) => [A + o, B - s, 1, 0] },                             // right end, z B → −B
    ];
  }
  function ring(o, spacing, extendNear = 0) {
    const pts = [];
    const segs = ringSegments(o);
    // Extend the ends towards the camera so the side stands run out of frame.
    if (extendNear > 0) for (let s = -extendNear; s < 0; s += spacing) pts.push(segs[0].at(s));
    for (const seg of segs) {
      const n = Math.max(1, Math.round(seg.len / spacing));
      for (let i = 0; i < n; i++) pts.push(seg.at((i / n) * seg.len));
    }
    const last = segs[4];
    for (let s = last.len; s <= last.len + extendNear; s += spacing) pts.push(last.at(s));
    return pts;
  }

  // Stand profile: offset from the pitch edge → height of the seat row.
  const LOWER = { o0: 7, rows: 26, depth: 0.8, rise: 0.42, y0: 0.8 };
  const UPPER = { o0: 27.5, rows: 30, depth: 0.85, rise: 0.6, y0: 16.4 };
  const ROOF = { front: 18, back: 58, yFront: 40, yBack: 43 };

  window.renderStadium = function renderStadium(canvas, opt) {
    const W = canvas.width, H = canvas.height;
    const ctx = canvas.getContext('2d');
    const cam = camera(W, H, opt.cam, opt.target, opt.hfov, opt.shiftY ?? 0);
    const rnd = rngFrom(opt.seed ?? 20261009);
    const K = W / 3840; // pixel scale relative to the 4K master
    const P = (x, y, z) => cam.p(x, y, z);
    const visible = (q) => q[2] > 2 && q[0] > -W * 0.3 && q[0] < W * 1.3 && q[1] > -H * 0.5 && q[1] < H * 1.5;

    const poly = (pts, fill) => {
      ctx.beginPath();
      pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
    };

    /* ---------------------------------------------------------------- sky */
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#04060a');
    sky.addColorStop(0.5, '#0a1422');
    sky.addColorStop(1, '#05070a');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    // Light pollution glowing over the roof.
    const haloC = P(0, 60, 70);
    const halo = ctx.createRadialGradient(haloC[0], haloC[1], 0, haloC[0], haloC[1], W * 0.7);
    halo.addColorStop(0, 'rgba(120,150,190,0.22)');
    halo.addColorStop(1, 'rgba(120,150,190,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, W, H);
    // A few stars, mostly washed out by the lights.
    for (let i = 0; i < 260; i++) {
      ctx.fillStyle = `rgba(220,230,255,${(0.08 + rnd() * 0.35).toFixed(3)})`;
      const r = (0.6 + rnd() * 1.3) * K;
      ctx.beginPath(); ctx.arc(rnd() * W, rnd() * H * 0.35, r, 0, 7); ctx.fill();
    }

    /* --------------------------------------------------------------- roof */
    const roofStep = 2.4, ext = opt.extendNear ?? 60;
    const rf = ring(ROOF.front, roofStep, ext), rb = ring(ROOF.back, roofStep * (ROOF.back / ROOF.front), ext);
    // Underside: per-panel quads between the front and back rings (paired by index ratio).
    const roofPanels = [];
    for (let i = 0; i < rf.length - 1; i++) {
      const j0 = Math.round((i / (rf.length - 1)) * (rb.length - 1));
      const j1 = Math.round(((i + 1) / (rf.length - 1)) * (rb.length - 1));
      const a = rf[i], b = rf[i + 1], c = rb[j1], d = rb[j0];
      const q = [P(a[0], ROOF.yFront, a[1]), P(b[0], ROOF.yFront, b[1]), P(c[0], ROOF.yBack, c[1]), P(d[0], ROOF.yBack, d[1])];
      if (q.some((v) => v[2] < 2)) continue;
      roofPanels.push(q);
    }
    for (const q of roofPanels) poly(q, '#0b1018');
    // Trusses: radial ribs every few panels, lit faintly from below.
    ctx.lineWidth = 2.2 * K;
    ctx.strokeStyle = 'rgba(150,175,210,0.10)';
    roofPanels.forEach((q, i) => {
      if (i % 4) return;
      ctx.beginPath(); ctx.moveTo(q[0][0], q[0][1]); ctx.lineTo(q[3][0], q[3][1]); ctx.stroke();
    });

    /* -------------------------------------------- back wall behind tiers */
    {
      const top = ring(UPPER.o0 + UPPER.rows * UPPER.depth + 0.5, 3, ext);
      for (let i = 0; i < top.length - 1; i++) {
        const a = top[i], b = top[i + 1];
        const yTop = UPPER.y0 + UPPER.rows * UPPER.rise;
        const q = [P(a[0], yTop, a[1]), P(b[0], yTop, b[1]), P(b[0], ROOF.yBack, b[1]), P(a[0], ROOF.yBack, a[1])];
        if (q.some((v) => v[2] < 2)) continue;
        poly(q, '#080b11');
      }
      // Concourse glow at the very back.
      const g = ring(UPPER.o0 + UPPER.rows * UPPER.depth + 0.5, 1.1, ext);
      for (const a of g) {
        const q = P(a[0], UPPER.y0 + UPPER.rows * UPPER.rise + 1.6 + rnd() * 1.5, a[1]);
        if (!visible(q)) continue;
        const s = cam.F / q[2];
        ctx.fillStyle = rnd() < 0.5 ? 'rgba(255,214,150,0.16)' : 'rgba(170,200,255,0.10)';
        ctx.fillRect(q[0], q[1], 0.7 * s, 0.35 * s);
      }
    }

    /* -------------------------------------------------------------- crowd */
    const tifo = opt.tifo ? buildTifo() : null;
    const HOME = [[200, 255, 46], [24, 26, 29], [14, 15, 17], [16, 18, 22], [196, 202, 210], [44, 48, 56], [60, 66, 78], [34, 38, 30]];
    const AWAY = [[64, 120, 230], [235, 238, 244], [30, 50, 110]];
    const SKIN = [[224, 186, 152], [198, 150, 110], [150, 104, 72], [104, 70, 48], [238, 206, 178]];
    const lightsGlow = [];

    function drawTier(T, tierName) {
      for (let k = T.rows - 1; k >= 0; k--) {
        const o = T.o0 + k * T.depth, y = T.y0 + k * T.rise;
        const row = ring(o, 0.52, ext);
        // Seat-row band: the riser behind this row, mostly hidden by bodies.
        const band = ring(o, 3, ext);
        for (let i = 0; i < band.length - 1; i++) {
          const a = band[i], b = band[i + 1];
          const q = [P(a[0], y, a[1]), P(b[0], y, b[1]), P(b[0] + b[2] * T.depth, y + T.rise, b[1] + b[3] * T.depth), P(a[0] + a[2] * T.depth, y + T.rise, a[1] + a[3] * T.depth)];
          if (q.some((v) => v[2] < 2)) continue;
          poly(q, tierName === 'upper' ? '#0a0e14' : '#0d1219');
        }
        const rowFrac = k / (T.rows - 1);
        for (const s of row) {
          const [x, z] = s;
          // Lit by the roof ring: the lower tier and the front of the upper tier catch it.
          const lit = tierName === 'upper' ? 0.36 + 0.26 * (1 - rowFrac) : 0.6 + 0.2 * (1 - rowFrac);
          // Tifo: far side, home end of the bowl.
          // Under the tifo: nobody to draw, the banner covers them.
          if (tifo && tifo.tier === tierName && Math.abs(z - (B + o)) < 0.01 && Math.abs(x) <= tifo.half - 0.6) continue;
          if (rnd() > 0.95) continue; // the odd empty seat
          const q = P(x, y, z);
          if (!visible(q)) continue;
          const sc = cam.F / q[2];
          if (sc < 0.6) continue;
          const away = x > A - 4 && z < 6;
          const pal = away ? AWAY : HOME;
          const pick = away ? pal[(rnd() * pal.length) | 0] : rnd() < 0.085 ? VOLT : pal[1 + ((rnd() * (pal.length - 1)) | 0)];
          const top = scale(pick, lit * (0.75 + rnd() * 0.4));
          const skin = scale(SKIN[(rnd() * SKIN.length) | 0], lit * 0.95);
          const stand = 1.05 + rnd() * 0.25; // shoulder height above the tread
          const bw = (0.4 + rnd() * 0.1) * sc, bh = 0.62 * sc;
          const cx = q[0] + (rnd() - 0.5) * 0.12 * sc;
          const shoulderY = q[1] - stand * sc;
          ctx.fillStyle = rgb(top);
          ctx.beginPath();
          ctx.roundRect(cx - bw / 2, shoulderY, bw, bh, bw * 0.28);
          ctx.fill();
          ctx.fillStyle = rgb(skin);
          ctx.beginPath();
          ctx.arc(cx, shoulderY - 0.13 * sc, 0.12 * sc, 0, 7);
          ctx.fill();
          const roll = rnd();
          if (roll < 0.07) {
            // Scarf held above the head.
            ctx.fillStyle = rgb(scale(away ? AWAY[0] : (rnd() < 0.55 ? VOLT : [222, 226, 230]), lit * 0.85));
            ctx.fillRect(cx - 0.42 * sc, shoulderY - 0.62 * sc, 0.84 * sc, 0.13 * sc);
          } else if (roll < 0.082) {
            // Phone torch.
            lightsGlow.push([cx + 0.15 * sc, shoulderY - 0.45 * sc, sc]);
          }
        }
      }
    }

    // Upper tier, the fascia between the tiers, then the lower tier on top.
    drawTier(UPPER, 'upper');
    {
      // Fascia: the front of the upper tier, an LED ribbon on its face.
      const f = ring(UPPER.o0 - 1.2, 1.5, ext);
      for (let i = 0; i < f.length - 1; i++) {
        const a = f[i], b = f[i + 1];
        const q = [P(a[0], 12.6, a[1]), P(b[0], 12.6, b[1]), P(b[0], UPPER.y0 + 0.4, b[1]), P(a[0], UPPER.y0 + 0.4, a[1])];
        if (q.some((v) => v[2] < 2)) continue;
        poly(q, '#06080b');
        const r = [P(a[0], 14.0, a[1]), P(b[0], 14.0, b[1]), P(b[0], 15.4, b[1]), P(a[0], 15.4, a[1])];
        const phase = (i % 46) / 46;
        const c = phase < 0.62 ? mix([22, 30, 8], VOLT, 0.78) : [228, 236, 246];
        poly(r, rgb(c, 0.92));
      }
    }
    drawTier(LOWER, 'lower');
    if (tifo) tifo.draw();

    // Front wall of the lower tier.
    {
      const f = ring(LOWER.o0 - 0.3, 2, ext);
      for (let i = 0; i < f.length - 1; i++) {
        const a = f[i], b = f[i + 1];
        const q = [P(a[0], 0, a[1]), P(b[0], 0, b[1]), P(b[0], LOWER.y0 + 0.35, b[1]), P(a[0], LOWER.y0 + 0.35, a[1])];
        if (q.some((v) => v[2] < 2)) continue;
        poly(q, '#090c10');
      }
    }

    /* ------------------------------------------------------------- ground */
    {
      // Run-off: everything between the stands and the pitch, as one polygon per side.
      const ground = [];
      const outer = ring(LOWER.o0 - 0.3, 2, ext);
      outer.forEach((a) => ground.push(P(a[0], 0, a[1])));
      ground.push(P(A + 6, 0, -B - ext), P(-A - 6, 0, -B - ext));
      const g = ctx.createLinearGradient(0, P(0, 0, B + 6)[1], 0, H);
      g.addColorStop(0, '#11301b');
      g.addColorStop(1, '#0a1d11');
      poly(ground.filter((q) => q[2] > 2), g);
    }

    /* -------------------------------------------------------------- pitch */
    const stripes = 18;
    for (let i = 0; i < stripes; i++) {
      const x0 = -A + (i * 2 * A) / stripes, x1 = -A + ((i + 1) * 2 * A) / stripes;
      const q = clipNear([[x0, 0, -B], [x1, 0, -B], [x1, 0, B], [x0, 0, B]]);
      if (!q) continue;
      poly(q, i % 2 ? '#22662f' : '#1a5025');
    }
    // Floodlit pool: the centre of the pitch is brightest.
    {
      const c = P(0, 0, 0);
      const g = ctx.createRadialGradient(c[0], c[1], 0, c[0], c[1], W * 0.42);
      g.addColorStop(0, 'rgba(200,255,180,0.16)');
      g.addColorStop(0.6, 'rgba(160,220,150,0.07)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.save();
      clipTo(clipNear([[-A - 6, 0, -B - ext], [A + 6, 0, -B - ext], [A + 6, 0, B + 6], [-A - 6, 0, B + 6]]));
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
    grassNoise();

    // Markings, as thin world-space quads so they foreshorten correctly.
    const LW = 0.12;
    const line = (x0, z0, x1, z1, alpha = 0.86) => {
      const dx = x1 - x0, dz = z1 - z0, l = Math.hypot(dx, dz), nx = (-dz / l) * LW / 2, nz = (dx / l) * LW / 2;
      const q = clipNear([[x0 + nx, 0.01, z0 + nz], [x1 + nx, 0.01, z1 + nz], [x1 - nx, 0.01, z1 - nz], [x0 - nx, 0.01, z0 - nz]]);
      if (q) poly(q, `rgba(240,248,240,${alpha})`);
    };
    const arc = (cx, cz, r, a0, a1, n = 96) => {
      for (let i = 0; i < n; i++) {
        const t0 = a0 + ((a1 - a0) * i) / n, t1 = a0 + ((a1 - a0) * (i + 1)) / n;
        line(cx + r * Math.cos(t0), cz + r * Math.sin(t0), cx + r * Math.cos(t1), cz + r * Math.sin(t1));
      }
    };
    line(-A, -B, A, -B); line(A, -B, A, B); line(A, B, -A, B); line(-A, B, -A, -B);
    line(0, -B, 0, B);
    arc(0, 0, 9.15, 0, Math.PI * 2, 160);
    for (const sgn of [-1, 1]) {
      const gx = sgn * A;
      line(gx, -20.16, gx - sgn * 16.5, -20.16); line(gx - sgn * 16.5, -20.16, gx - sgn * 16.5, 20.16); line(gx - sgn * 16.5, 20.16, gx, 20.16);
      line(gx, -9.16, gx - sgn * 5.5, -9.16); line(gx - sgn * 5.5, -9.16, gx - sgn * 5.5, 9.16); line(gx - sgn * 5.5, 9.16, gx, 9.16);
      const a0 = sgn > 0 ? Math.PI - 0.9273 : -0.9273, a1 = sgn > 0 ? Math.PI + 0.9273 : 0.9273;
      arc(gx - sgn * 11, 0, 9.15, a0, a1, 40);
      spot(gx - sgn * 11, 0, 0.2);
    }
    spot(0, 0, 0.25);
    for (const [cx, cz, a0] of [[-A, -B, 0], [A, -B, Math.PI / 2], [A, B, Math.PI], [-A, B, -Math.PI / 2]]) arc(cx, cz, 1, a0, a0 + Math.PI / 2, 10);

    if (opt.projection) projectionShow();

    goals();
    boards();
    if (opt.lineup) lineup(opt.lineup);

    /* -------------------------------------------------------- floodlights */
    floodlights();

    // Phone torches in the stands.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const [x, y, sc] of lightsGlow) {
      const r = Math.max(1.6 * K, 0.22 * sc);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2.6);
      g.addColorStop(0, 'rgba(255,255,255,0.95)');
      g.addColorStop(0.25, 'rgba(230,240,255,0.45)');
      g.addColorStop(1, 'rgba(200,220,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r * 2.6, y - r * 2.6, r * 5.2, r * 5.2);
    }
    ctx.restore();

    /* ---------------------------------------------------- haze and beams */
    haze();

    // Low mist hanging over the far touchline gives the bowl depth.
    {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const yb = P(0, 0, B + 3)[1], yt = P(0, 6, B + 8)[1];
      const g = ctx.createLinearGradient(0, yt - (yb - yt), 0, yb + (yb - yt) * 0.6);
      g.addColorStop(0, 'rgba(160,190,220,0)');
      g.addColorStop(0.55, 'rgba(160,190,220,0.07)');
      g.addColorStop(1, 'rgba(160,190,220,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
    if (opt.shadeBottom) {
      const g = ctx.createLinearGradient(0, H * (1 - opt.shadeBottom), 0, H);
      g.addColorStop(0, 'rgba(5,6,7,0)');
      g.addColorStop(1, 'rgba(5,6,7,0.72)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }

    post();

    /* ============================================================ helpers */
    function clipNear(pts) {
      const out = pts.map((p) => P(p[0], p[1], p[2]));
      if (out.every((q) => q[2] > 0.5)) return out;
      // Clip the world polygon against a near plane in camera space (cheap Sutherland–Hodgman).
      const f = norm(sub(opt.target, opt.cam));
      const near = 1.5;
      const depth = (p) => dot(sub(p, opt.cam), f);
      const res = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        const da = depth(a) - near, db = depth(b) - near;
        if (da >= 0) res.push(a);
        if ((da >= 0) !== (db >= 0)) {
          const t = da / (da - db);
          res.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
        }
      }
      return res.length >= 3 ? res.map((p) => P(p[0], p[1], p[2])) : null;
    }
    function clipTo(q) {
      ctx.beginPath();
      q.forEach((v, i) => (i ? ctx.lineTo(v[0], v[1]) : ctx.moveTo(v[0], v[1])));
      ctx.closePath();
      ctx.clip();
    }
    function spot(x, z, r) {
      const pts = [];
      for (let i = 0; i < 16; i++) pts.push([x + r * Math.cos((i / 16) * Math.PI * 2), 0.01, z + r * Math.sin((i / 16) * Math.PI * 2)]);
      const q = clipNear(pts);
      if (q) poly(q, 'rgba(240,248,240,0.9)');
    }

    function grassNoise() {
      // Fine turf grain, clipped to the playing surface and run-off.
      const tile = document.createElement('canvas');
      tile.width = tile.height = 256;
      const t = tile.getContext('2d');
      const img = t.createImageData(256, 256);
      const r2 = rngFrom(77);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = 128 + (r2() - 0.5) * 70;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
      t.putImageData(img, 0, 0);
      ctx.save();
      clipTo(clipNear([[-A - 6, 0, -B - ext], [A + 6, 0, -B - ext], [A + 6, 0, B + 6.4], [-A - 6, 0, B + 6.4]]));
      ctx.globalCompositeOperation = 'overlay';
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = ctx.createPattern(tile, 'repeat');
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    function goals() {
      for (const sgn of [-1, 1]) {
        const gx = sgn * A, back = gx + sgn * 2.0, hw = 3.66, h = 2.44;
        // Net: a faint lattice.
        ctx.strokeStyle = 'rgba(235,240,245,0.20)';
        ctx.lineWidth = 1.1 * K;
        for (let i = 0; i <= 14; i++) {
          const z = -hw + (2 * hw * i) / 14;
          const a = P(gx, h, z), b = P(back, h * 0.75, z), c = P(back, 0, z);
          if ([a, b, c].some((v) => v[2] < 2)) continue;
          ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.stroke();
        }
        for (let i = 0; i <= 6; i++) {
          const y = (h * i) / 6;
          const a = P(back, y * 0.75 + (h - h * 0.75) * 0, -hw), b = P(back, y * 0.75, hw);
          ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
        }
        // Frame.
        const post = (z) => {
          const a = P(gx, 0, z), b = P(gx, h, z);
          const sc = cam.F / a[2];
          ctx.strokeStyle = 'rgba(250,252,255,0.95)';
          ctx.lineWidth = Math.max(1.5 * K, 0.12 * sc);
          ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
        };
        post(-hw); post(hw);
        const a = P(gx, h, -hw), b = P(gx, h, hw);
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      }
    }

    function boards() {
      // LED perimeter boards, a metre tall, running around the far side and both ends.
      const pts = ring(3.4, 1.2, ext);
      const seg = 9;
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1];
        const q = [P(a[0], 0, a[1]), P(b[0], 0, b[1]), P(b[0], 0.95, b[1]), P(a[0], 0.95, a[1])];
        if (q.some((v) => !visible(v))) continue;
        const block = Math.floor(i / seg) % 5;
        const c = block === 0 || block === 3 ? VOLT : block === 2 ? [236, 242, 250] : [18, 22, 28];
        poly(q, rgb(c, block === 1 || block === 4 ? 1 : 0.95));
        if (block !== 1 && block !== 4) {
          // Fine pixel pitch so it reads as a screen at full size.
          ctx.fillStyle = 'rgba(0,0,0,0.18)';
          const m = P((a[0] + b[0]) / 2, 0.48, (a[1] + b[1]) / 2);
          ctx.fillRect(Math.min(q[0][0], q[1][0]), m[1], Math.abs(q[1][0] - q[0][0]), Math.max(1, K));
        }
      }
      // Board glow on the grass in front of them.
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < pts.length - 1; i += 3) {
        const block = Math.floor(i / seg) % 5;
        if (block === 1 || block === 4) continue;
        const a = pts[i];
        const q = P(a[0] - a[2] * 1.4, 0, a[1] - a[3] * 1.4);
        if (!visible(q)) continue;
        const r = (cam.F / q[2]) * 2.2;
        const c = block === 2 ? [200, 215, 240] : VOLT;
        const g = ctx.createRadialGradient(q[0], q[1], 0, q[0], q[1], r);
        g.addColorStop(0, rgb(c, 0.10));
        g.addColorStop(1, rgb(c, 0));
        ctx.fillStyle = g;
        ctx.fillRect(q[0] - r, q[1] - r, 2 * r, 2 * r);
      }
      ctx.restore();
    }

    function floodlights() {
      const units = ring(ROOF.front - 0.2, 3.4, ext);
      const glows = [];
      for (const u of units) {
        const q = P(u[0], ROOF.yFront - 0.6, u[1]);
        if (!visible(q)) continue;
        glows.push(q);
      }
      // The lamp housings: a dark rail with bright faces.
      ctx.save();
      for (const q of glows) {
        const s = cam.F / q[2];
        ctx.fillStyle = '#0c1118';
        ctx.fillRect(q[0] - 1.25 * s, q[1] - 0.6 * s, 2.5 * s, 0.95 * s);
        ctx.fillStyle = 'rgba(245,250,255,1)';
        ctx.fillRect(q[0] - 1.05 * s, q[1] - 0.4 * s, 2.1 * s, 0.5 * s);
      }
      ctx.globalCompositeOperation = 'lighter';
      for (const q of glows) {
        const s = cam.F / q[2];
        const r = Math.max(8 * K, 2.1 * s);
        const g = ctx.createRadialGradient(q[0], q[1], 0, q[0], q[1], r);
        g.addColorStop(0, rgb(LIGHT, 0.85));
        g.addColorStop(0.22, rgb(LIGHT, 0.26));
        g.addColorStop(1, rgb(LIGHT, 0));
        ctx.fillStyle = g;
        ctx.fillRect(q[0] - r, q[1] - r, 2 * r, 2 * r);
        // Anamorphic streak.
        const sw = r * 7, sh = Math.max(1 * K, r * 0.03);
        const h = ctx.createLinearGradient(q[0] - sw, 0, q[0] + sw, 0);
        h.addColorStop(0, rgb(LIGHT, 0));
        h.addColorStop(0.5, rgb(LIGHT, 0.12));
        h.addColorStop(1, rgb(LIGHT, 0));
        ctx.fillStyle = h;
        ctx.fillRect(q[0] - sw, q[1] - sh, 2 * sw, 2 * sh);
      }
      ctx.restore();
    }

    function haze() {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      // Volumetric beams from a handful of lamp clusters down onto the pitch.
      const r3 = rngFrom(4242);
      const units = ring(ROOF.front - 0.2, 9, ext);
      for (const u of units) {
        const top = P(u[0], ROOF.yFront - 0.6, u[1]);
        if (!visible(top)) continue;
        const tx = u[0] * 0.25 + (r3() - 0.5) * 50, tz = u[1] * 0.2 + (r3() - 0.5) * 30;
        const spread = 9 + r3() * 6;
        const d = [tx - u[0], tz - u[1]], l = Math.hypot(...d), n = [-d[1] / l, d[0] / l];
        const b0 = P(tx + n[0] * spread, 0, tz + n[1] * spread), b1 = P(tx - n[0] * spread, 0, tz - n[1] * spread);
        if (b0[2] < 2 || b1[2] < 2) continue;
        const g = ctx.createLinearGradient(top[0], top[1], (b0[0] + b1[0]) / 2, (b0[1] + b1[1]) / 2);
        g.addColorStop(0, rgb(LIGHT, 0.03));
        g.addColorStop(1, rgb(LIGHT, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(top[0] - 4 * K, top[1]); ctx.lineTo(top[0] + 4 * K, top[1]); ctx.lineTo(b1[0], b1[1]); ctx.lineTo(b0[0], b0[1]);
        ctx.closePath(); ctx.fill();
      }
      // Air glow in the bowl: brighter towards the roof ring.
      const yRoof = P(0, ROOF.yFront, B + ROOF.front)[1];
      const g = ctx.createLinearGradient(0, yRoof - H * 0.05, 0, yRoof + H * 0.5);
      g.addColorStop(0, 'rgba(170,195,235,0.06)');
      g.addColorStop(0.5, 'rgba(150,180,220,0.02)');
      g.addColorStop(1, 'rgba(150,180,220,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    function buildTifo() {
      // A painted fabric tifo pulled up over the lower tier of the home end. The
      // design is drawn at high resolution, then mapped onto the raked stand in
      // true perspective, so the crest stays crisp at full size.
      const half = opt.tifo.half ?? 36;
      const o0 = LOWER.o0 - 0.4, o1 = LOWER.o0 + LOWER.rows * LOWER.depth;
      const y0 = LOWER.y0 + 1.5, y1 = LOWER.y0 + (LOWER.rows - 1) * LOWER.rise + 1.9;
      const slant = Math.hypot(o1 - o0, y1 - y0);
      const TW = 3600, TH = Math.round((TW * slant) / (2 * half));
      const c = document.createElement('canvas');
      c.width = TW; c.height = TH;
      const t = c.getContext('2d');
      t.fillStyle = '#0c0d0f';
      t.fillRect(0, 0, TW, TH);
      // Sunburst behind the crest.
      t.save();
      t.translate(TW / 2, TH * 0.5);
      for (let i = 0; i < 36; i++) {
        t.rotate((Math.PI * 2) / 36);
        t.fillStyle = i % 2 ? '#17191c' : '#0b0c0d';
        t.beginPath(); t.moveTo(0, 0); t.lineTo(TW, -TW * 0.088); t.lineTo(TW, TW * 0.088); t.closePath(); t.fill();
      }
      t.restore();
      const glow = t.createRadialGradient(TW / 2, TH * 0.5, 0, TW / 2, TH * 0.5, TH * 0.75);
      glow.addColorStop(0, 'rgba(200,255,46,0.20)');
      glow.addColorStop(1, 'rgba(200,255,46,0)');
      t.fillStyle = glow;
      t.fillRect(0, 0, TW, TH);
      // Volt borders.
      const band = TH * 0.07;
      t.fillStyle = '#c8ff2e';
      t.fillRect(0, 0, TW, band); t.fillRect(0, TH - band, TW, band);
      t.fillStyle = '#0c0d0f';
      t.fillRect(0, band, TW, band * 0.22); t.fillRect(0, TH - band * 1.22, TW, band * 0.22);
      // The crest: volt, outlined in white, with a dark keyline.
      const path = new Path2D(MARK());
      const ch = TH * 0.7, k = ch / 64;
      t.save();
      t.translate(TW / 2 - 32 * k, TH * 0.5 - 32 * k);
      t.scale(k, k);
      t.lineJoin = 'round';
      t.strokeStyle = '#0c0d0f'; t.lineWidth = 6.5; t.stroke(path);
      t.strokeStyle = '#f2f4f5'; t.lineWidth = 3.2; t.stroke(path);
      const vg = t.createLinearGradient(10, 0, 54, 64);
      vg.addColorStop(0, '#e6ff9b'); vg.addColorStop(0.45, '#c8ff2e'); vg.addColorStop(1, '#9ecc12');
      t.fillStyle = vg; t.fill(path);
      t.restore();
      // Words either side.
      t.fillStyle = '#f2f4f5';
      t.font = `700 ${Math.round(TH * 0.25)}px Display, "Arial Narrow", Arial, sans-serif`;
      t.textAlign = 'center';
      t.textBaseline = 'middle';
      if (opt.tifo.words !== false) {
        t.fillText('YOUR CLUB', TW * 0.2, TH * 0.515);
        t.fillText('YOUR STORY', TW * 0.8, TH * 0.515);
      }
      // Fabric: horizontal folds where the fans hold it up, and a little sheen.
      const r6 = rngFrom(606);
      for (let i = 0; i < 70; i++) {
        // Vertical creases from the hands underneath.
        const x = r6() * TW, w = 30 + r6() * 120;
        const g = t.createLinearGradient(x, 0, x + w, 0);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(0.5, `rgba(0,0,0,${(0.05 + r6() * 0.08).toFixed(3)})`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        t.fillStyle = g;
        t.fillRect(x, 0, w, TH);
      }

      // The banner is planar (the stand's rake is a plane), so texture → screen
      // is a homography. Map it per pixel, 3 × 3 supersampled: no seams, and
      // the edges and lettering resolve cleanly at any output size.
      const corner = (u, v) => P(-half + 2 * half * u, y1 + (y0 - y1) * v, B + o1 + (o0 - o1) * v);
      return {
        tier: opt.tifo.tier ?? 'lower',
        half,
        draw() {
          mapTexture(c, corner, {
            // Ragged top edge where the banner is held up unevenly.
            vTop: (u) => -0.035 * (0.5 + 0.5 * Math.sin(u * Math.PI * 26 + 1.3)) * (0.6 + 0.4 * Math.sin(u * 7.1)),
            // Lit from the roof ring: brighter towards the front, plus the fold ripple.
            lit: (u, v) => (0.74 + 0.22 * v) * (1 + 0.07 * Math.sin(v * Math.PI * 30 + Math.sin(u * 40) * 0.8)),
          });
        },
      };
    }

    // Paint a texture onto a planar world quad. corner(u, v) gives the screen
    // point of texture coordinate (u, v); the plane makes texture → screen a
    // homography, inverted per pixel and 3 × 3 supersampled — no seams, and
    // edges resolve cleanly at any output size. mode 'add' lights the scene.
    function mapTexture(texCanvas, corner, o = {}) {
      const TW = texCanvas.width, TH = texCanvas.height;
      const tex = texCanvas.getContext('2d').getImageData(0, 0, TW, TH).data;
      const q = [corner(0, 0), corner(1, 0), corner(1, 1), corner(0, 1)];
      if (q.some((v) => v[2] < 2)) return;
      const Inv = invert3(squareToQuad(q.map((v) => [v[0], v[1]])));
      const pad = o.vTop ? 40 * K : 2;
      const minX = Math.max(0, Math.floor(Math.min(...q.map((v) => v[0])) - 2));
      const maxX = Math.min(W, Math.ceil(Math.max(...q.map((v) => v[0])) + 2));
      const minY = Math.max(0, Math.floor(Math.min(...q.map((v) => v[1])) - pad));
      const maxY = Math.min(H, Math.ceil(Math.max(...q.map((v) => v[1])) + 2));
      const bw = maxX - minX, bh = maxY - minY;
      if (bw <= 0 || bh <= 0) return;
      const img = ctx.getImageData(minX, minY, bw, bh);
      const d = img.data;
      const SS = 3, add = o.mode === 'add', alpha = o.alpha ?? 1;
      const smp = [0, 0, 0, 0];
      const sample = (u, v) => {
        const x = Math.min(TW - 1, Math.max(0, u * TW - 0.5)), y = Math.min(TH - 1, Math.max(0, v * TH - 0.5));
        const xi = x | 0, yi = y | 0, fx = x - xi, fy = y - yi;
        const x2 = Math.min(TW - 1, xi + 1), y2 = Math.min(TH - 1, yi + 1);
        const i00 = (yi * TW + xi) * 4, i10 = (yi * TW + x2) * 4, i01 = (y2 * TW + xi) * 4, i11 = (y2 * TW + x2) * 4;
        for (let c = 0; c < 4; c++) {
          smp[c] = (tex[i00 + c] * (1 - fx) + tex[i10 + c] * fx) * (1 - fy) + (tex[i01 + c] * (1 - fx) + tex[i11 + c] * fx) * fy;
        }
        return smp;
      };
      for (let py = 0; py < bh; py++) {
        for (let px = 0; px < bw; px++) {
          let r = 0, g = 0, b = 0, cov = 0;
          for (let sy = 0; sy < SS; sy++) {
            for (let sx = 0; sx < SS; sx++) {
              const X = minX + px + (sx + 0.5) / SS, Y = minY + py + (sy + 0.5) / SS;
              const w = Inv[6] * X + Inv[7] * Y + Inv[8];
              const u = (Inv[0] * X + Inv[1] * Y + Inv[2]) / w;
              const v = (Inv[3] * X + Inv[4] * Y + Inv[5]) / w;
              const top = o.vTop ? o.vTop(u) : 0;
              if (u < 0 || u > 1 || v < top || v > 1) continue;
              const c = sample(u, Math.max(0, v));
              const lit = o.lit ? o.lit(u, v) : 1;
              const a = c[3] / 255;
              r += c[0] * lit * a; g += c[1] * lit * a; b += c[2] * lit * a; cov += a;
            }
          }
          if (cov <= 0) continue;
          const i = (py * bw + px) * 4, n = SS * SS;
          if (add) {
            d[i] = Math.min(255, d[i] + (r / n) * alpha);
            d[i + 1] = Math.min(255, d[i + 1] + (g / n) * alpha);
            d[i + 2] = Math.min(255, d[i + 2] + (b / n) * alpha);
          } else {
            const a = (cov / n) * alpha;
            d[i] = d[i] * (1 - a) + (r / cov) * a;
            d[i + 1] = d[i + 1] * (1 - a) + (g / cov) * a;
            d[i + 2] = d[i + 2] * (1 - a) + (b / cov) * a;
          }
        }
      }
      ctx.putImageData(img, minX, minY);
    }

    // Heckbert's unit-square → quad projective map, as a row-major 3 × 3.
    function squareToQuad(p) {
      const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = p;
      const dx1 = x1 - x2, dx2 = x3 - x2, dy1 = y1 - y2, dy2 = y3 - y2;
      const sx = x0 - x1 + x2 - x3, sy = y0 - y1 + y2 - y3;
      const den = dx1 * dy2 - dx2 * dy1;
      const g = (sx * dy2 - dx2 * sy) / den, h = (dx1 * sy - sx * dy1) / den;
      return [x1 - x0 + g * x1, x3 - x0 + h * x3, x0, y1 - y0 + g * y1, y3 - y0 + h * y3, y0, g, h, 1];
    }
    function invert3(m) {
      const [a, b, c, d, e, f, g, h, i] = m;
      const A_ = e * i - f * h, B_ = -(d * i - f * g), C_ = d * h - e * g;
      const det = a * A_ + b * B_ + c * C_;
      return [A_ / det, -(b * i - c * h) / det, (b * f - c * e) / det,
        B_ / det, (a * i - c * g) / det, -(a * f - c * d) / det,
        C_ / det, -(a * h - b * g) / det, (a * e - b * d) / det];
    }

    function lineup(L) {
      // Both sides and the officials lined up before kick-off, facing the main
      // stand. Drawn as lit silhouettes with the four crossing floodlight
      // shadows every night match has.
      const KITS = {
        home: { shirt: [18, 20, 22], trim: VOLT, shorts: [14, 15, 17], socks: [18, 20, 22] },
        away: { shirt: [232, 236, 240], trim: [64, 120, 230], shorts: [232, 236, 240], socks: [232, 236, 240] },
        ref: { shirt: [250, 196, 40], trim: [20, 20, 20], shorts: [18, 18, 20], socks: [18, 18, 20] },
        keeperH: { shirt: [255, 120, 40], trim: [20, 20, 20], shorts: [20, 20, 20], socks: [255, 120, 40] },
        keeperA: { shirt: [120, 90, 230], trim: [240, 240, 240], shorts: [30, 30, 40], socks: [120, 90, 230] },
      };
      const SK = [[214, 172, 136], [178, 128, 92], [128, 86, 58], [96, 64, 44], [232, 196, 166]];
      const HAIR = [[20, 16, 14], [40, 30, 22], [70, 50, 30], [12, 12, 12], [150, 120, 80]];
      const r7 = rngFrom(7171);
      const order = L.order;
      const n = order.length, gap = L.gap ?? 1.0, z = L.z ?? -11;
      // Shadows first, so every body stands on top of every shadow.
      ctx.save();
      for (let i = 0; i < n; i++) {
        const x = (i - (n - 1) / 2) * gap;
        for (const [dx, dz] of [[1.5, 1.1], [-1.5, 1.1], [1.3, -0.9], [-1.3, -0.9]]) {
          const pts = [[x - 0.12, 0.01, z], [x + 0.12, 0.01, z], [x + dx * 1.2 + 0.1, 0.01, z + dz * 1.2], [x + dx * 1.2 - 0.1, 0.01, z + dz * 1.2]];
          const q = clipNear(pts);
          if (q) poly(q, 'rgba(4,14,6,0.16)');
        }
        const c = P(x, 0.01, z), s = cam.F / c[2];
        ctx.fillStyle = 'rgba(2,8,4,0.35)';
        ctx.beginPath(); ctx.ellipse(c[0], c[1], 0.34 * s, 0.34 * s * 0.28, 0, 0, 7); ctx.fill();
      }
      ctx.restore();
      for (let i = 0; i < n; i++) {
        const x = (i - (n - 1) / 2) * gap;
        const kit = KITS[order[i]];
        const foot = P(x, 0, z), s = cam.F / foot[2];
        const cx = foot[0], fy = foot[1];
        const hgt = (1.74 + r7() * 0.14) * (order[i] === 'ref' ? 0.97 : 1);
        const k = hgt / 1.8;
        const Y = (m) => fy - m * k * s;          // metres above the grass → screen y
        const X = (m) => cx + m * s;               // metres across → screen x
        const skin = SK[(r7() * SK.length) | 0], hair = HAIR[(r7() * HAIR.length) | 0];
        const shade = (c, t) => rgb(scale(c, t));
        const R = (x0, y0, x1, y1, fill, rad = 0) => {
          ctx.fillStyle = fill;
          ctx.beginPath();
          ctx.roundRect(X(x0), Y(y1), (x1 - x0) * s, (y1 - y0) * k * s, rad * s);
          ctx.fill();
        };
        // Boots, socks, knees, shorts.
        for (const side of [-1, 1]) {
          const lx = side * 0.1;
          R(lx - 0.065, 0, lx + 0.075, 0.07, rgb([12, 12, 12]), 0.03);
          R(lx - 0.06, 0.05, lx + 0.06, 0.46, shade(kit.socks, 0.92), 0.03);
          R(lx - 0.055, 0.44, lx + 0.055, 0.66, shade(skin, 0.9), 0.04);
        }
        R(-0.205, 0.62, 0.205, 0.9, shade(kit.shorts, 0.95), 0.05);
        // Arms hang by the sides: skin below short sleeves.
        for (const side of [-1, 1]) {
          const ax = side * 0.27;
          R(ax - 0.055, 0.82, ax + 0.055, 1.22, shade(skin, 0.86), 0.05);
          R(ax - 0.07, 1.16, ax + 0.07, 1.46, shade(kit.shirt, 0.9), 0.06);
        }
        // Torso with a top-down floodlight gradient.
        const tTop = Y(1.5), tBot = Y(0.86);
        const g = ctx.createLinearGradient(0, tTop, 0, tBot);
        g.addColorStop(0, rgb(scale(kit.shirt, 1.12)));
        g.addColorStop(1, rgb(scale(kit.shirt, 0.82)));
        R(-0.225, 0.86, 0.225, 1.5, g, 0.09);
        // Trim: collar and a chest band.
        R(-0.07, 1.44, 0.07, 1.5, rgb(kit.trim), 0.02);
        R(-0.225, 1.31, 0.225, 1.335, rgb(scale(kit.trim, 0.95)));
        // Neck, head, hair.
        R(-0.05, 1.47, 0.05, 1.57, shade(skin, 0.8), 0.02);
        const hc = [X(0), Y(1.665)];
        ctx.fillStyle = shade(skin, 1);
        ctx.beginPath(); ctx.ellipse(hc[0], hc[1], 0.098 * s, 0.12 * k * s, 0, 0, 7); ctx.fill();
        ctx.fillStyle = rgb(hair);
        ctx.beginPath(); ctx.ellipse(hc[0], hc[1] - 0.045 * k * s, 0.102 * s, 0.085 * k * s, 0, Math.PI, Math.PI * 2); ctx.fill();
        // Rim light from the roof ring along the shoulders and head.
        ctx.fillStyle = 'rgba(230,240,255,0.35)';
        ctx.beginPath(); ctx.ellipse(hc[0], hc[1] - 0.1 * k * s, 0.07 * s, 0.025 * k * s, 0, 0, 7); ctx.fill();
        R(-0.2, 1.48, 0.2, 1.5, 'rgba(230,240,255,0.22)', 0.02);
      }
    }

    function projectionShow() {
      // A pre-match pitch projection: the crest in light inside the centre circle.
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.restore();
      // The crest, lit onto the grass: a soft volt bloom under a crisp core.
      const off = document.createElement('canvas');
      off.width = off.height = 1024;
      const o = off.getContext('2d');
      const path = new Path2D(MARK());
      o.save(); o.translate(512, 512); o.scale(13, 13); o.translate(-32, -32);
      o.filter = 'blur(2.2px)';
      o.fillStyle = 'rgba(200,255,46,0.55)'; o.fill(path);
      o.filter = 'none';
      o.fillStyle = 'rgba(200,255,46,0.85)'; o.fill(path);
      o.lineJoin = 'round'; o.lineWidth = 0.7; o.strokeStyle = 'rgba(235,255,170,0.9)'; o.stroke(path);
      o.restore();
      const size = 15.5; // metres across the texture
      // Image top → far side of the pitch, so it reads upright from the main stand.
      mapTexture(off, (u, v) => P(-size / 2 + size * u, 0.02, size / 2 - size * v), { mode: 'add', alpha: 0.62 });
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      // Rings of light around it.
      for (const [r, a] of [[9.15, 0.5], [10.4, 0.18], [12.2, 0.09]]) {
        ctx.strokeStyle = `rgba(200,255,46,${a})`;
        ctx.lineWidth = 3 * K;
        ctx.beginPath();
        for (let i = 0; i <= 200; i++) {
          const q = P(r * Math.cos((i / 200) * Math.PI * 2), 0.02, r * Math.sin((i / 200) * Math.PI * 2));
          if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]);
        }
        ctx.stroke();
      }
      const c = P(0, 0, 0);
      const g = ctx.createRadialGradient(c[0], c[1], 0, c[0], c[1], (cam.F / c[2]) * 16);
      g.addColorStop(0, 'rgba(200,255,46,0.16)');
      g.addColorStop(1, 'rgba(200,255,46,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    function post() {
      // Bloom: a quarter-resolution blur of the highlights added back on top.
      const small = document.createElement('canvas');
      small.width = Math.round(W / 4); small.height = Math.round(H / 4);
      const s = small.getContext('2d');
      s.filter = 'brightness(0.75) contrast(3) saturate(1.1)';
      s.drawImage(canvas, 0, 0, small.width, small.height);
      const blur = document.createElement('canvas');
      blur.width = small.width; blur.height = small.height;
      const b = blur.getContext('2d');
      b.filter = `blur(${Math.round(18 * K)}px)`;
      b.drawImage(small, 0, 0);
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 0.3;
      ctx.drawImage(blur, 0, 0, W, H);
      ctx.restore();

      // Vignette.
      const v = ctx.createRadialGradient(W / 2, H * 0.48, Math.min(W, H) * 0.35, W / 2, H * 0.5, Math.hypot(W, H) * 0.62);
      v.addColorStop(0, 'rgba(3,4,6,0)');
      v.addColorStop(1, 'rgba(3,4,6,0.62)');
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, W, H);

      // Film grain, so gradients never band at full size.
      const tile = document.createElement('canvas');
      tile.width = tile.height = 512;
      const t = tile.getContext('2d');
      const img = t.createImageData(512, 512);
      const r5 = rngFrom(31337);
      for (let i = 0; i < img.data.length; i += 4) {
        const n = 128 + (r5() + r5() - 1) * 34;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = n;
        img.data[i + 3] = 255;
      }
      t.putImageData(img, 0, 0);
      ctx.save();
      ctx.globalCompositeOperation = 'overlay';
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = ctx.createPattern(tile, 'repeat');
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  };

})();
