"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  CY,
  PING_DUR,
  RING_LABEL,
  RING_R,
  RING_TIER_COLOR,
  STEPS,
  clusterColor,
  cineTier,
  formatStars,
  sampleHist,
  type ScopeModel,
} from "@/lib/cinematic";

const ACC = "#74e0ff";

export function RadarCanvas({
  model,
  query,
  isolated,
  selectedSlug,
  tilted,
  onSelect,
}: {
  model: ScopeModel;
  query: string;
  isolated: string | null;
  selectedSlug: string | null;
  tilted: boolean;
  onSelect: (slug: string | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sliderRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLSpanElement>(null);
  const leadRef = useRef<HTMLSpanElement>(null);
  const [playing, setPlaying] = useState(false);
  const [zoom, setZoomState] = useState(1);

  const S = useRef({
    orbit: 0,
    tilt: 0,
    zoom: 1,
    panX: 0,
    panY: 0,
    timeF: STEPS - 1,
    timeTarget: STEPS - 1,
    playing: false,
    tilted: false,
    hover: null as string | null,
    dragging: false,
    lastX: 0,
    lastY: 0,
    moved: 0,
    prevSa: null as number | null,
    lastFrame: 0,
    userScrub: false,
    scrubT: 0,
    screen: [] as { slug: string; x: number; y: number; r: number }[],
    query: "",
    isolated: null as string | null,
    selected: null as string | null,
    model,
  });

  useEffect(() => {
    S.current.model = model;
  }, [model]);
  useEffect(() => {
    S.current.query = query.trim().toLowerCase();
    S.current.isolated = isolated;
    S.current.selected = selectedSlug;
    S.current.tilted = tilted;
    S.current.playing = playing;
  }, [query, isolated, selectedSlug, tilted, playing]);

  const togglePlay = useCallback(() => {
    setPlaying((p) => {
      const next = !p;
      if (next && S.current.timeTarget >= STEPS - 1) S.current.timeTarget = 0;
      return next;
    });
  }, []);
  const onScrub = useCallback((e: React.FormEvent<HTMLInputElement>) => {
    S.current.userScrub = true;
    S.current.timeTarget = parseFloat(e.currentTarget.value);
    setPlaying(false);
    window.clearTimeout(S.current.scrubT);
    S.current.scrubT = window.setTimeout(() => (S.current.userScrub = false), 180);
  }, []);

  // Zoom about the radar centre (buttons); wheel zoom about the cursor lives in the
  // canvas effect. panX/panY reset with zoom so the view never gets lost off-frame.
  const stepZoom = useCallback((factor: number) => {
    setZoomState((z) => {
      const next = Math.min(5, Math.max(1, Math.round(z * factor * 100) / 100));
      S.current.zoom = next;
      if (next === 1) {
        S.current.panX = 0;
        S.current.panY = 0;
      }
      return next;
    });
  }, []);
  const resetView = useCallback(() => {
    S.current.zoom = 1;
    S.current.panX = 0;
    S.current.panY = 0;
    S.current.orbit = 0;
    S.current.tilt = 0;
    setZoomState(1);
  }, []);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const st = S.current;
    let w = 0;
    let h = 0;
    const t0 = performance.now();
    let raf = 0;

    const resize = () => {
      const r = cv.getBoundingClientRect();
      w = r.width;
      h = r.height;
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(cv);

    const passed = (b: number, p: number, a: number) => (a >= p ? b > p && b <= a : b > p || b <= a);
    const dateForStep = (tf: number) => {
      const now = new Date();
      const weeksAgo = STEPS - 1 - tf;
      const d = new Date(now.getTime() - weeksAgo * 7 * 864e5);
      const s = d.toLocaleDateString([], { month: "short", day: "numeric" });
      return weeksAgo < 0.5 ? "today · " + s : s;
    };

    const draw = () => {
      const { nodes, clusters, maxStars } = st.model;
      const TAU = Math.PI * 2;
      ctx.clearRect(0, 0, w, h);
      const pad = w > 640 ? 76 : 34;
      const topPad = 44;
      const botPad = 108;
      const availW = Math.max(160, w - pad * 2);
      const availH = Math.max(160, h - topPad - botPad);
      const cx = pad + availW / 2 + st.panX;
      const cy = topPad + availH / 2 + st.panY;
      const rad = (Math.min(availW, availH) / 2) * 0.92 * st.zoom;
      const zoomSize = Math.min(1.7, Math.max(1, Math.sqrt(st.zoom)));
      const t = (performance.now() - t0) / 1000;
      const glow = 0.72;
      const sweepSpeed = 0.5;
      const perspEff = st.tilt + (st.tilted ? 0.55 : 0);
      const yc = Math.max(0.42, 1 - perspEff * 0.5);
      const barsMode = perspEff > 0.12;
      const q = st.query;
      const iso = st.isolated;
      const N = Math.max(clusters.length, 1);
      const sector = TAU / N;

      const nowMs = performance.now();
      const dt = Math.min(0.05, (nowMs - (st.lastFrame || nowMs)) / 1000);
      st.lastFrame = nowMs;
      if (st.playing) {
        st.timeTarget += dt * 2.4;
        if (st.timeTarget >= STEPS - 1) st.timeTarget = 0;
      }
      st.timeF += (st.timeTarget - st.timeF) * Math.min(1, dt * 9);
      if (Math.abs(st.timeTarget - st.timeF) < 0.002) st.timeF = st.timeTarget;
      const tf = st.timeF;

      // central glow
      ctx.save();
      const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
      cg.addColorStop(0, "rgba(60,140,190,0.14)");
      cg.addColorStop(1, "rgba(60,140,190,0)");
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rad, rad * yc, 0, 0, TAU);
      ctx.fill();
      ctx.restore();

      // rings + bezel + dividers + ticks + reticle
      ctx.save();
      for (const rf of RING_R) {
        const rr = rad * rf;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rr, rr * yc, 0, 0, TAU);
        ctx.strokeStyle = `rgba(${CY},0.1)`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.ellipse(cx, cy, rad, rad * yc, 0, 0, TAU);
      ctx.strokeStyle = `rgba(${CY},0.28)`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.strokeStyle = `rgba(${CY},0.07)`;
      ctx.lineWidth = 1;
      for (const c of clusters) {
        const ang = c.bearing - sector / 2 + st.orbit;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad * yc);
        ctx.stroke();
      }
      for (let a = 0; a < 72; a++) {
        const ang = (a / 72) * TAU + st.orbit;
        const major = a % 6 === 0;
        const r0 = rad * (major ? 0.96 : 0.98);
        ctx.strokeStyle = `rgba(${CY},${major ? 0.5 : 0.22})`;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0 * yc);
        ctx.lineTo(cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad * yc);
        ctx.stroke();
      }
      ctx.strokeStyle = `rgba(${CY},0.45)`;
      ctx.beginPath();
      ctx.moveTo(cx - 6, cy);
      ctx.lineTo(cx + 6, cy);
      ctx.moveTo(cx, cy - 6 * yc);
      ctx.lineTo(cx, cy + 6 * yc);
      ctx.stroke();
      ctx.restore();

      // sweep
      const sa = (t * sweepSpeed) % TAU;
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(cx, cy, rad, rad * yc, 0, 0, TAU);
      ctx.clip();
      const cgc = ctx as CanvasRenderingContext2D & {
        createConicGradient?: (a: number, x: number, y: number) => CanvasGradient;
      };
      if (cgc.createConicGradient) {
        const g = cgc.createConicGradient(sa, cx, cy);
        g.addColorStop(0.0, `rgba(${CY},0)`);
        g.addColorStop(0.8, `rgba(${CY},0)`);
        g.addColorStop(0.97, `rgba(${CY},0.1)`);
        g.addColorStop(1.0, `rgba(${CY},0.26)`);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(1, yc);
        ctx.translate(-cx, -cy);
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = g;
        ctx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
        ctx.restore();
      }
      ctx.globalCompositeOperation = "lighter";
      const lx = cx + Math.cos(sa) * rad;
      const ly = cy + Math.sin(sa) * rad * yc;
      const lg = ctx.createLinearGradient(cx, cy, lx, ly);
      lg.addColorStop(0, `rgba(${CY},0)`);
      lg.addColorStop(1, `rgba(${CY},0.7)`);
      ctx.strokeStyle = lg;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(lx, ly);
      ctx.stroke();
      ctx.restore();

      // ping detection
      const prev = st.prevSa == null ? sa : st.prevSa;
      for (const node of nodes) {
        const nb = (((node.bearing + st.orbit) % TAU) + TAU) % TAU;
        if (passed(nb, prev, sa)) node.ping = t;
      }
      st.prevSa = sa;

      // sample + place
      let lead: (typeof nodes)[number] | null = null;
      let leadScore = -1;
      const sampled = new Map<(typeof nodes)[number], { score: number; stars: number; radius: number; size: number }>();
      for (const node of nodes) {
        const hs = sampleHist(node, tf);
        const radius = Math.max(0.2, Math.min(0.93, 0.92 - (hs.score / 100) * 0.66 + node.rjit));
        const size = (3.4 + Math.min(9, Math.max(0, Math.log10(Math.max(10, hs.stars)) - 2.8) * 3.5)) * zoomSize;
        sampled.set(node, { score: hs.score, stars: hs.stars, radius, size });
        const notDim = !((q && !node.hay.includes(q)) || (iso && node.clusterSlug !== iso));
        if (notDim && hs.score > leadScore) {
          leadScore = hs.score;
          lead = node;
        }
      }

      const placed = nodes
        .map((node) => {
          const s = sampled.get(node)!;
          const a = node.bearing + st.orbit;
          return { node, s, x: cx + Math.cos(a) * s.radius * rad, y: cy + Math.sin(a) * s.radius * rad * yc };
        })
        .sort((a, b) => b.s.radius - a.s.radius);
      const ordered = barsMode ? placed.slice().sort((a, b) => a.y - b.y) : placed;

      st.screen = [];
      for (const n of ordered) {
        const node = n.node;
        const dim = (q && !node.hay.includes(q)) || (iso && node.clusterSlug !== iso);
        const sr = n.s.size;
        const age = t - node.ping;
        const pinging = age >= 0 && age < PING_DUR;
        const pk = pinging ? 1 - age / PING_DUR : 0;
        const isSel = node.slug === st.selected;
        const isHov = node.slug === st.hover;
        const col = clusterColor(node.hue, 0.8, 0.15);

        if (barsMode) {
          const frac = Math.min(1, n.s.stars / (maxStars || 1));
          const bh = (7 + Math.pow(frac, 0.85) * 150) * (0.5 + yc * 0.5);
          const tx = n.x;
          const ty = n.y - bh;
          ctx.save();
          ctx.globalAlpha = dim ? 0.12 : 0.45;
          ctx.strokeStyle = col;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.ellipse(n.x, n.y, sr * 0.85, sr * 0.85 * yc, 0, 0, TAU);
          ctx.stroke();
          ctx.restore();
          ctx.save();
          if (dim) {
            ctx.globalAlpha = 0.16;
            ctx.strokeStyle = col;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(n.x, n.y);
            ctx.lineTo(tx, ty);
            ctx.stroke();
          } else {
            const grad = ctx.createLinearGradient(n.x, n.y, tx, ty);
            grad.addColorStop(0, clusterColor(node.hue, 0.8, 0.15, 0.1));
            grad.addColorStop(1, clusterColor(node.hue, 0.82, 0.16, 0.95));
            ctx.strokeStyle = grad;
            ctx.lineWidth = isSel || isHov ? 3.6 : 2.6;
            ctx.shadowColor = col;
            ctx.shadowBlur = 9 * glow;
            ctx.beginPath();
            ctx.moveTo(n.x, n.y);
            ctx.lineTo(tx, ty);
            ctx.stroke();
          }
          ctx.restore();
          if (pinging && !dim) {
            const pr = sr + (age / PING_DUR) * 22;
            ctx.save();
            ctx.globalAlpha = pk * 0.5;
            ctx.strokeStyle = clusterColor(node.hue, 0.85, 0.14);
            ctx.lineWidth = 1.3;
            ctx.beginPath();
            ctx.arc(tx, ty, pr, 0, TAU);
            ctx.stroke();
            ctx.restore();
          }
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          const gA = (dim ? 0.05 : 0.4 + pk * 0.5) * glow;
          const gr = ctx.createRadialGradient(tx, ty, 0, tx, ty, sr * 3);
          gr.addColorStop(0, clusterColor(node.hue, 0.82, 0.16, gA));
          gr.addColorStop(1, clusterColor(node.hue, 0.82, 0.16, 0));
          ctx.fillStyle = gr;
          ctx.beginPath();
          ctx.arc(tx, ty, sr * 2.8, 0, TAU);
          ctx.fill();
          ctx.restore();
          const capR = sr * (isSel || isHov ? 0.98 : 0.74) + pk * 1.2;
          ctx.save();
          ctx.globalAlpha = dim ? 0.28 : 1;
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.arc(tx, ty, capR, 0, TAU);
          ctx.fill();
          if (!dim) {
            ctx.globalAlpha = 0.9;
            ctx.fillStyle = "rgba(232,251,255,0.95)";
            ctx.beginPath();
            ctx.arc(tx, ty, capR * 0.42, 0, TAU);
            ctx.fill();
          }
          ctx.restore();
          st.screen.push({ slug: node.slug, x: tx, y: ty, r: Math.max(capR, 7) });
        } else {
          const coreR = sr * (isSel || isHov ? 1.34 : 1) + pk * 1.4;
          if (pinging && !dim) {
            const pr = sr + (age / PING_DUR) * 26;
            ctx.save();
            ctx.globalAlpha = pk * 0.5;
            ctx.strokeStyle = clusterColor(node.hue, 0.85, 0.14);
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.arc(n.x, n.y, pr, 0, TAU);
            ctx.stroke();
            ctx.restore();
          }
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          const gA = (dim ? 0.06 : 0.34 + pk * 0.5) * glow;
          const gr = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, sr * 3.6);
          gr.addColorStop(0, clusterColor(node.hue, 0.82, 0.16, gA));
          gr.addColorStop(1, clusterColor(node.hue, 0.82, 0.16, 0));
          ctx.fillStyle = gr;
          ctx.beginPath();
          ctx.arc(n.x, n.y, sr * 3.4, 0, TAU);
          ctx.fill();
          ctx.restore();
          ctx.save();
          ctx.globalAlpha = dim ? 0.24 : 1;
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.arc(n.x, n.y, coreR, 0, TAU);
          ctx.fill();
          if (!dim) {
            ctx.globalAlpha = 0.9;
            ctx.fillStyle = "rgba(232,251,255,0.92)";
            ctx.beginPath();
            ctx.arc(n.x, n.y, coreR * 0.42, 0, TAU);
            ctx.fill();
          }
          if ((isHov || isSel) && !dim) {
            ctx.globalAlpha = 1;
            ctx.strokeStyle = "rgba(232,251,255,0.9)";
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(n.x, n.y, coreR + 1, 0, TAU);
            ctx.stroke();
          }
          ctx.restore();
          st.screen.push({ slug: node.slug, x: n.x, y: n.y, r: coreR });
        }
      }

      // top mover reticle
      if (lead && lead.slug !== st.selected) {
        const sc = st.screen.find((s) => s.slug === lead!.slug);
        if (sc) {
          const R = sc.r + 11 + 2 * Math.sin(t * 2.5);
          ctx.save();
          ctx.strokeStyle = ACC;
          ctx.lineWidth = 1.3;
          ctx.globalAlpha = 0.9;
          for (let c = 0; c < 4; c++) {
            const a0 = c * (TAU / 4) + Math.PI / 4;
            ctx.beginPath();
            ctx.arc(sc.x, sc.y, R, a0 - 0.32, a0 + 0.32);
            ctx.stroke();
          }
          ctx.globalAlpha = 1;
          ctx.fillStyle = ACC;
          ctx.font = "500 8.5px 'IBM Plex Mono', monospace";
          ctx.textAlign = "center";
          ctx.fillText("TOP MOVER", sc.x, sc.y - R - 7);
          ctx.restore();
        }
      }

      // selection ring
      if (st.selected) {
        const sc = st.screen.find((s) => s.slug === st.selected);
        if (sc) {
          const pulse = 1 + 0.13 * Math.sin(t * 3);
          ctx.save();
          ctx.strokeStyle = ACC;
          ctx.lineWidth = 1.6;
          ctx.globalAlpha = 0.95;
          ctx.beginPath();
          ctx.arc(sc.x, sc.y, sc.r * pulse + 7, 0, TAU);
          ctx.stroke();
          ctx.restore();
        }
      }

      // labels
      ctx.save();
      ctx.font = "500 9px 'IBM Plex Mono', monospace";
      ctx.textAlign = "center";
      for (let k = 0; k < RING_R.length; k++) {
        const rr = rad * RING_R[k];
        ctx.fillStyle = RING_TIER_COLOR[k];
        ctx.globalAlpha = 0.85;
        ctx.fillText(RING_LABEL[k].toUpperCase(), cx, cy - rr * yc + 12);
      }
      ctx.globalAlpha = 1;
      ctx.font = "500 9.5px 'IBM Plex Mono', monospace";
      for (const c of clusters) {
        const ang = c.bearing + st.orbit;
        const lx2 = cx + Math.cos(ang) * rad * 1.05;
        const ly2 = cy + Math.sin(ang) * rad * yc * 1.05 + 3;
        const active = !iso || iso === c.slug;
        ctx.fillStyle = active ? clusterColor(c.hue, 0.82, 0.11, 0.95) : `rgba(${CY},0.22)`;
        ctx.textAlign = Math.cos(ang) > 0.25 ? "left" : Math.cos(ang) < -0.25 ? "right" : "center";
        ctx.fillText(c.label.toUpperCase(), lx2, ly2);
      }
      ctx.restore();

      // hover tooltip
      const hoverNode = st.hover && nodes.find((x) => x.slug === st.hover);
      if (hoverNode) {
        const s = st.screen.find((x) => x.slug === st.hover);
        if (s) {
          const label = `${hoverNode.owner}/${hoverNode.name}`;
          const hs = sampleHist(hoverNode, st.timeF);
          const sub = `★ ${formatStars(hs.stars)} · ${cineTier(hs.score)}`;
          ctx.save();
          ctx.font = "600 12.5px 'IBM Plex Sans', sans-serif";
          const tw = Math.max(ctx.measureText(label).width, 90);
          ctx.font = "11px 'IBM Plex Mono', monospace";
          const bw = Math.max(tw, ctx.measureText(sub).width) + 22;
          const bh = 46;
          let bx = s.x - bw / 2;
          let by = s.y - s.r - bh - 12;
          bx = Math.max(8, Math.min(w - bw - 8, bx));
          if (by < 8) by = s.y + s.r + 12;
          ctx.fillStyle = "rgba(8,16,26,0.95)";
          ctx.strokeStyle = `rgba(${CY},0.3)`;
          ctx.lineWidth = 1;
          ctx.shadowColor = "rgba(0,0,0,0.6)";
          ctx.shadowBlur = 18;
          ctx.shadowOffsetY = 5;
          ctx.beginPath();
          ctx.roundRect(bx, by, bw, bh, 9);
          ctx.fill();
          ctx.shadowColor = "transparent";
          ctx.shadowBlur = 0;
          ctx.shadowOffsetY = 0;
          ctx.stroke();
          ctx.fillStyle = "#eaf7ff";
          ctx.font = "600 12.5px 'IBM Plex Sans', sans-serif";
          ctx.textAlign = "left";
          ctx.fillText(label, bx + 12, by + 19);
          ctx.fillStyle = "#7fa8c0";
          ctx.font = "11px 'IBM Plex Mono', monospace";
          ctx.fillText(sub, bx + 12, by + 35);
          ctx.restore();
        }
      }

      if (sliderRef.current && !st.userScrub) sliderRef.current.value = String(tf);
      if (dateRef.current) dateRef.current.textContent = dateForStep(tf);
      if (leadRef.current) leadRef.current.textContent = lead ? `${lead.owner}/${lead.name}` : "—";

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    const onDown = (e: MouseEvent) => {
      st.dragging = true;
      st.lastX = e.clientX;
      st.lastY = e.clientY;
      st.moved = 0;
    };
    const onUp = () => {
      st.dragging = false;
    };
    const onLeave = () => {
      st.hover = null;
      document.body.style.cursor = "auto";
    };
    const onMove = (e: MouseEvent) => {
      const r = cv.getBoundingClientRect();
      const mx = e.clientX - r.left;
      const my = e.clientY - r.top;
      if (st.dragging) {
        const dx = e.clientX - st.lastX;
        const dy = e.clientY - st.lastY;
        st.moved += Math.abs(dx) + Math.abs(dy);
        if (e.shiftKey || st.zoom > 1.02) {
          // pan the zoomed view instead of orbiting
          st.panX += dx;
          st.panY += dy;
        } else {
          st.orbit += dx * 0.006;
          st.tilt = Math.max(-0.2, Math.min(0.55, st.tilt + dy * 0.003));
        }
        st.lastX = e.clientX;
        st.lastY = e.clientY;
        return;
      }
      let hit: string | null = null;
      let best = 22;
      for (const s of st.screen) {
        const d = Math.hypot(mx - s.x, my - s.y);
        if (d < Math.max(s.r + 7, 12) && d < best) {
          best = d;
          hit = s.slug;
        }
      }
      st.hover = hit;
      document.body.style.cursor = hit ? "pointer" : "grab";
    };
    const onClick = () => {
      if (st.moved > 5) return;
      onSelect(st.hover || null);
    };
    // Wheel / trackpad-pinch zoom, anchored on the cursor so you zoom into what you
    // point at. Trackpad pinch arrives as a wheel event with ctrlKey set.
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = cv.getBoundingClientRect();
      const mx = e.clientX - r.left;
      const my = e.clientY - r.top;
      const z0 = st.zoom;
      const z1 = Math.min(5, Math.max(1, z0 * Math.exp(-e.deltaY * 0.0016)));
      if (z1 === z0) return;
      const pad = w > 640 ? 76 : 34;
      const availW = Math.max(160, w - pad * 2);
      const availH = Math.max(160, h - 44 - 108);
      const bcx = pad + availW / 2;
      const bcy = 44 + availH / 2;
      const cx = bcx + st.panX;
      const cy = bcy + st.panY;
      st.panX = mx - (mx - cx) * (z1 / z0) - bcx;
      st.panY = my - (my - cy) * (z1 / z0) - bcy;
      st.zoom = z1;
      if (z1 <= 1) {
        st.zoom = 1;
        st.panX = 0;
        st.panY = 0;
      }
      setZoomState(Math.round(st.zoom * 100) / 100);
    };

    cv.addEventListener("mousemove", onMove);
    cv.addEventListener("mousedown", onDown);
    cv.addEventListener("click", onClick);
    cv.addEventListener("mouseleave", onLeave);
    cv.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("mouseup", onUp);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      cv.removeEventListener("mousemove", onMove);
      cv.removeEventListener("mousedown", onDown);
      cv.removeEventListener("click", onClick);
      cv.removeEventListener("mouseleave", onLeave);
      cv.removeEventListener("wheel", onWheel);
      window.removeEventListener("mouseup", onUp);
    };
  }, [onSelect]);

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* grid backdrop, masked to a soft circle */}
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(116,224,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(116,224,255,0.045) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          WebkitMaskImage: "radial-gradient(70% 60% at 50% 46%, #000 30%, transparent 82%)",
          maskImage: "radial-gradient(70% 60% at 50% 46%, #000 30%, transparent 82%)",
        }}
      />
      <canvas ref={canvasRef} className="absolute inset-0 z-[1] block h-full w-full" />
      {/* scanlines + vignette */}
      <div
        className="pointer-events-none absolute inset-0 z-[2]"
        style={{
          background:
            "repeating-linear-gradient(0deg, rgba(116,224,255,0.028) 0px, rgba(116,224,255,0.028) 1px, transparent 1px, transparent 3px)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 z-[2]"
        style={{ background: "radial-gradient(120% 100% at 50% 44%, transparent 56%, rgba(3,6,12,0.72) 100%)" }}
      />

      {/* zoom controls */}
      <div className="absolute right-6 top-5 z-10 flex flex-col items-stretch gap-1 rounded-[12px] border border-[rgba(116,224,255,0.16)] bg-[rgba(8,16,26,0.72)] p-1 shadow-[0_12px_34px_rgba(0,0,0,0.45)] backdrop-blur-[18px]">
        {[
          { k: "in", label: "+", aria: "Zoom in", onClick: () => stepZoom(1.35), disabled: zoom >= 5 },
          { k: "out", label: "−", aria: "Zoom out", onClick: () => stepZoom(1 / 1.35), disabled: zoom <= 1 },
        ].map((b) => (
          <button
            key={b.k}
            onClick={b.onClick}
            disabled={b.disabled}
            aria-label={b.aria}
            className="flex h-8 w-8 items-center justify-center rounded-[9px] text-[16px] leading-none text-[#93b4c9] transition-colors hover:bg-[rgba(116,224,255,0.1)] hover:text-[#e2f3ff] disabled:cursor-not-allowed disabled:opacity-35"
          >
            {b.label}
          </button>
        ))}
        <div className="py-0.5 text-center font-mono text-[9px] text-[#5f8299]">{zoom.toFixed(1)}×</div>
        <button
          onClick={resetView}
          disabled={zoom === 1}
          aria-label="Reset view"
          className="flex h-7 w-8 items-center justify-center rounded-[9px] text-[#93b4c9] transition-colors hover:bg-[rgba(116,224,255,0.1)] hover:text-[#e2f3ff] disabled:cursor-not-allowed disabled:opacity-35"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
            <path d="M3 3v5h5" />
          </svg>
        </button>
      </div>

      {/* range/bearing legend */}
      <div className="absolute left-6 bottom-5 z-10 flex items-center gap-4 font-mono text-[10.5px] uppercase tracking-[0.1em] text-[#5f8299]">
        <span>range · momentum</span>
        <span className="h-[11px] w-px" style={{ background: "rgba(116,224,255,0.2)" }} />
        <span>bearing · category</span>
      </div>

      {/* timeline */}
      <div className="absolute left-1/2 bottom-[22px] z-[12] w-[min(520px,calc(100%-96px))] min-w-[300px] -translate-x-1/2">
        <div className="relative rounded-[14px] border border-[rgba(116,224,255,0.16)] bg-[rgba(8,16,26,0.72)] px-4 pb-[11px] pt-3 shadow-[0_16px_50px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(160,235,255,0.08)] backdrop-blur-[20px]">
          {[
            "top-[7px] left-[7px] border-t border-l",
            "top-[7px] right-[7px] border-t border-r",
            "bottom-[7px] left-[7px] border-b border-l",
            "bottom-[7px] right-[7px] border-b border-r",
          ].map((c) => (
            <span key={c} className={`absolute h-[11px] w-[11px] border-[rgba(116,224,255,0.5)] ${c}`} />
          ))}
          <div className="flex items-baseline justify-between font-mono text-[9.5px] uppercase tracking-[0.16em]">
            <span className="text-[#5f8299]">timeline · 13 weeks (modeled)</span>
            <span className="text-[#5f8299]">
              top mover ▸ <span ref={leadRef} className="tracking-[0.02em] text-[#74e0ff]">—</span>
            </span>
          </div>
          <div className="mt-[9px] flex items-center gap-[13px]">
            <button
              onClick={togglePlay}
              aria-label={playing ? "Pause timeline" : "Play timeline"}
              className="flex h-8 w-8 flex-none items-center justify-center rounded-full border border-[rgba(116,224,255,0.28)] bg-[rgba(116,224,255,0.06)] text-[11px] leading-none text-[#74e0ff] shadow-[0_0_12px_rgba(116,224,255,0.18)]"
            >
              {playing ? <span>❚❚</span> : <span className="ml-0.5">▶</span>}
            </button>
            <input
              type="range"
              ref={sliderRef}
              min={0}
              max={12}
              step={0.02}
              defaultValue={12}
              onInput={onScrub}
              aria-label="Scrub timeline"
              className="w-full flex-1"
            />
          </div>
          <div className="mt-2 flex items-baseline justify-between font-mono text-[9.5px] text-[#4d6f86]">
            <span>13 wks ago</span>
            <span ref={dateRef} className="text-[11px] text-[#93b4c9]">
              today
            </span>
            <span>now</span>
          </div>
        </div>
      </div>
    </div>
  );
}
