"use client";

import { useEffect, useRef, useState } from "react";
import { Eyebrow } from "@/components/home/eyebrow";
import { Reveal } from "@/components/home/reveal";

/*
 * The Gloss Lab (design v2, ported from handoff/design-v2/js/gloss.js).
 * Raw-WebGL painted panel: metallic racing-green paint under a studio light
 * bar. The gloss uniform sharpens the reflection, dissolves the road film,
 * and wakes the metal flake. Drag the paint or use the slider.
 */

const VERT = `
  attribute vec2 p;
  void main() { gl_Position = vec4(p, 0.0, 1.0); }
`;

const FRAG = `
  precision highp float;
  uniform vec2 u_res;
  uniform float u_time;
  uniform float u_gloss;
  uniform sampler2D u_logo;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }
  float fbm(vec2 p) {
    float v = 0.0;
    v += 0.5   * noise(p);
    v += 0.25  * noise(p * 2.13);
    v += 0.125 * noise(p * 4.41);
    return v;
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / u_res;
    float aspect = u_res.x / u_res.y;
    vec2 suv = vec2(uv.x * aspect, uv.y);

    float gloss = u_gloss;
    float rough = 1.0 - gloss;

    float curve = (uv.y - 0.5);
    float ny = curve * 0.85;

    vec3 deep  = vec3(0.016, 0.075, 0.045);
    vec3 mid   = vec3(0.042, 0.170, 0.100);
    vec3 base  = mix(deep, mid, smoothstep(0.0, 1.0, uv.y + curve * 0.35));

    float film = fbm(suv * 5.0) * 0.6 + fbm(suv * 17.0) * 0.4;
    float filmAmt = rough * rough;
    vec3 filmCol = vec3(0.16, 0.14, 0.105);
    base = mix(base, filmCol, film * filmAmt * 0.55);

    float spots = smoothstep(0.78, 0.95, noise(suv * 26.0)) * filmAmt;
    base += spots * 0.035;

    float bar = uv.y + ny * 0.4 - 0.62 - sin(u_time * 0.24) * 0.045;
    float width = mix(0.020, 0.34, rough);
    float strength = mix(1.15, 0.24, rough);
    float band = exp(-(bar * bar) / (2.0 * width * width)) * strength;

    float bar2 = uv.y + ny * 0.4 - 0.415 + sin(u_time * 0.19) * 0.03;
    float band2 = exp(-(bar2 * bar2) / (2.0 * 0.006)) * gloss * gloss * 0.5;

    float horiz = uv.y + ny * 0.42 - 0.30;
    float hband = exp(-(horiz * horiz) / (2.0 * mix(0.0025, 0.05, rough))) * mix(0.30, 0.05, rough);

    vec3 lightCol = vec3(0.95, 0.93, 0.86);
    vec3 col = base
      + lightCol * band  * (0.25 + 0.75 * gloss)
      + lightCol * band2
      + vec3(0.55, 0.62, 0.55) * hband;

    float ly0 = 0.16;
    float lh  = 0.30;
    vec2 luv;
    luv.x = (uv.x - 0.5) / (0.62 + curve * 0.22) + 0.5;
    luv.y = (uv.y - ly0) / lh;
    if (luv.x > 0.0 && luv.x < 1.0 && luv.y > -0.2 && luv.y < 1.2) {
      float spread = mix(0.002, 0.085, rough);
      float logo = 0.0;
      for (int i = -3; i <= 3; i++) {
        float o = float(i) * spread * 0.5;
        vec2 s = vec2(luv.x + o * 0.35, clamp(luv.y + o, 0.0, 1.0));
        logo += texture2D(u_logo, s).a;
      }
      logo /= 7.0;
      float wobble = noise(vec2(uv.x * 40.0, u_time * 0.3)) - 0.5;
      logo *= 1.0 - abs(wobble) * rough * 1.4;
      col += vec3(0.86, 0.84, 0.76) * logo * mix(0.05, 0.42, gloss * gloss);
    }

    float flake = pow(hash(floor(suv * u_res.y * 0.9)), 60.0);
    col += flake * gloss * (band * 3.0 + 0.15) * vec3(0.9, 1.0, 0.9);

    col += vec3(0.06, 0.09, 0.07) * pow(1.0 - uv.y, 3.0) * gloss * 0.6;

    float vig = smoothstep(1.25, 0.45, length(uv - 0.5) * 1.6);
    col *= mix(0.82, 1.0, vig);

    gl_FragColor = vec4(col, 1.0);
  }
`;

const STATES: Array<[number, string]> = [
  [0.3, "ROAD FILM"],
  [0.6, "GETTING THERE"],
  [0.85, "CLEAN"],
  [1.01, "WHIPOFF’D — SHOWROOM"],
];

export function GlossLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sliderRef = useRef<HTMLInputElement>(null);
  const glossRef = useRef(0.12);
  const [readout, setReadout] = useState({ gu: 19, state: "ROAD FILM" });

  useEffect(() => {
    const canvas = canvasRef.current;
    const slider = sliderRef.current;
    if (!canvas || !slider) return;

    const gl = canvas.getContext("webgl", { antialias: false, alpha: false });
    if (!gl) {
      canvas.style.background = "linear-gradient(160deg,#123524,#071410)";
      return;
    }

    function compile(type: number, src: string) {
      const sh = gl!.createShader(type)!;
      gl!.shaderSource(sh, src);
      gl!.compileShader(sh);
      return sh;
    }

    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, "u_res");
    const uTime = gl.getUniformLocation(prog, "u_time");
    const uGloss = gl.getUniformLocation(prog, "u_gloss");
    const uLogo = gl.getUniformLocation(prog, "u_logo");

    /* wordmark texture — drawn flipped, as a reflection */
    const logoCanvas = document.createElement("canvas");
    logoCanvas.width = 1024;
    logoCanvas.height = 256;
    const logoTex = gl.createTexture();
    function drawLogoTex() {
      const c = logoCanvas.getContext("2d")!;
      c.clearRect(0, 0, 1024, 256);
      c.save();
      c.translate(0, 256);
      c.scale(1, -1); /* mirror: reflections hang upside-down */
      c.font = "900 150px Fraunces, Georgia, serif";
      c.fillStyle = "#fff";
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText("WHIPOFF", 512, 128);
      c.restore();
      gl!.bindTexture(gl!.TEXTURE_2D, logoTex);
      gl!.pixelStorei(gl!.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGBA, gl!.RGBA, gl!.UNSIGNED_BYTE, logoCanvas);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, gl!.LINEAR);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MAG_FILTER, gl!.LINEAR);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_S, gl!.CLAMP_TO_EDGE);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_T, gl!.CLAMP_TO_EDGE);
    }
    drawLogoTex();
    document.fonts?.ready?.then(drawLogoTex);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, logoTex);
    gl.uniform1i(uLogo, 0);

    let shownGloss = glossRef.current;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio, 1.75);
      const w = Math.round(canvas!.clientWidth * dpr);
      const h = Math.round(canvas!.clientHeight * dpr);
      if (canvas!.width !== w || canvas!.height !== h) {
        canvas!.width = w;
        canvas!.height = h;
        gl!.viewport(0, 0, w, h);
      }
    }
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    /* drag directly on the paint */
    let dragging = false;
    const setFromX = (clientX: number) => {
      const r = canvas.getBoundingClientRect();
      glossRef.current = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
      slider.value = String(Math.round(glossRef.current * 100));
    };
    const onDown = (e: PointerEvent) => {
      dragging = true;
      canvas.setPointerCapture(e.pointerId);
      setFromX(e.clientX);
    };
    const onMove = (e: PointerEvent) => dragging && setFromX(e.clientX);
    const onUp = () => (dragging = false);
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);

    let inView = false;
    const io = new IntersectionObserver((en) => (inView = en[0]?.isIntersecting ?? false), {
      threshold: 0.05,
    });
    io.observe(canvas);

    let lastShown = -1;
    const t0 = performance.now();
    let raf = 0;
    function frame() {
      raf = requestAnimationFrame(frame);
      if (!inView || document.hidden) return;
      resize();
      shownGloss += (glossRef.current - shownGloss) * 0.09;
      gl!.uniform2f(uRes, canvas!.width, canvas!.height);
      gl!.uniform1f(uTime, (performance.now() - t0) / 1000);
      gl!.uniform1f(uGloss, shownGloss);
      gl!.drawArrays(gl!.TRIANGLES, 0, 3);

      /* readout — only re-render React state when the GU value changes */
      const gu = Math.round(8 + shownGloss * 88);
      if (gu !== lastShown) {
        lastShown = gu;
        const state = STATES.find(([max]) => shownGloss < max)?.[1] ?? "WHIPOFF’D — SHOWROOM";
        setReadout({ gu, state });
      }
    }
    frame();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      gl.deleteTexture(logoTex);
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
    };
  }, []);

  return (
    <section id="gloss" className="mx-auto max-w-[1060px] px-[var(--gutter)] py-[var(--sect)] text-center">
      <Reveal>
        <Eyebrow num="03" center>
          The Gloss Lab
        </Eyebrow>
      </Reveal>
      <Reveal>
        <h2 className="font-display text-[clamp(2.4rem,7.2vw,4.6rem)] font-medium leading-[1.04] tracking-tight text-balance">
          Drag the light
          <br />
          <em className="italic text-gold [font-variation-settings:'opsz'_144,'SOFT'_90,'WONK'_1]">
            across the paint.
          </em>
        </h2>
      </Reveal>
      <Reveal>
        <p className="mx-auto mt-5 max-w-[520px] text-bone/60">
          Dirt scatters light. Gloss lines it up. Slide from two weeks of road film to a
          Whipoff finish — and watch the reflection snap into focus.
        </p>
      </Reveal>

      <Reveal className="mt-[clamp(36px,6vw,56px)]">
        <div className="relative aspect-[4/3] overflow-hidden rounded-lg border border-bone/[0.14] bg-[#0a1a12] md:aspect-[16/8]">
          <canvas
            ref={canvasRef}
            className="h-full w-full touch-pan-y"
            aria-label="Interactive paint gloss demo"
          />
          <div className="pointer-events-none absolute left-[18px] top-4 flex flex-col items-start gap-1 text-left font-mono">
            <span className="text-[1.3rem] text-bone">
              <b className="font-bold text-gold">{readout.gu}</b> GU
            </span>
            <span className="text-[0.62rem] tracking-[0.2em] text-bone/60">{readout.state}</span>
          </div>
        </div>
      </Reveal>

      <Reveal>
        <div className="mt-6 flex items-center gap-4">
          <span className="mono-label flex-none text-bone/40">FILTHY</span>
          <input
            ref={sliderRef}
            type="range"
            min={0}
            max={100}
            defaultValue={12}
            step={1}
            aria-label="Paint gloss level"
            onInput={(e) => {
              glossRef.current = parseInt(e.currentTarget.value, 10) / 100;
            }}
          />
          <span className="mono-label flex-none text-bone/40">WHIPOFF’D</span>
        </div>
      </Reveal>
    </section>
  );
}
