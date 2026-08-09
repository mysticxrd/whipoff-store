"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

/*
 * Hero bottle (design v2, ported from handoff/design-v2/js/bottle.js).
 * Procedural product bottle: slim clear PET, marbled green liquid with a fill
 * line below the shoulder, matte black cap, wordmark printed on the bottle.
 * Idle float + scroll rotation + pointer parallax. No external assets — all
 * geometry is lathed and all textures are drawn on canvases.
 */

function makeLiquidTexture() {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 1024;
  const x = c.getContext("2d")!;

  const g = x.createLinearGradient(0, 0, 512, 0);
  g.addColorStop(0, "#0D402A");
  g.addColorStop(0.22, "#07301E");
  g.addColorStop(0.5, "#0A3521"); /* back stays green, not black */
  g.addColorStop(0.78, "#07301E");
  g.addColorStop(1, "#0D402A");
  x.fillStyle = g;
  x.fillRect(0, 0, 512, 1024);

  /* deep shadow toward the base */
  const vg = x.createLinearGradient(0, 0, 0, 1024);
  vg.addColorStop(0, "rgba(7, 20, 16, 0)");
  vg.addColorStop(0.55, "rgba(7, 20, 16, 0)");
  vg.addColorStop(1, "rgba(7, 20, 16, 0.6)");
  x.fillStyle = vg;
  x.fillRect(0, 0, 512, 1024);

  /* deterministic marbling — dark veins */
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  x.lineCap = "round";
  x.filter = "blur(14px)";
  for (let i = 0; i < 9; i++) {
    const px = rnd() * 512;
    x.strokeStyle = `rgba(7, 20, 16, ${0.18 + rnd() * 0.12})`;
    x.lineWidth = 26 + rnd() * 40;
    x.beginPath();
    x.moveTo(px, -60);
    x.bezierCurveTo(
      px + (rnd() - 0.5) * 200, 340,
      px + (rnd() - 0.5) * 200, 720,
      px + (rnd() - 0.5) * 150, 1090,
    );
    x.stroke();
  }

  /* soft vertical specular highlight (drawn twice to wrap the texture seam) */
  x.filter = "blur(22px)";
  x.strokeStyle = "rgba(28, 92, 60, 0.6)";
  for (const sx of [480, -32]) {
    x.lineWidth = 46;
    x.beginPath();
    x.moveTo(sx, 90);
    x.quadraticCurveTo(sx + 8, 470, sx, 900);
    x.stroke();
  }
  x.filter = "none";

  /* slightly translucent read at the top shoulder */
  const tg = x.createLinearGradient(0, 0, 0, 110);
  tg.addColorStop(0, "rgba(191, 232, 212, 0.18)");
  tg.addColorStop(1, "rgba(191, 232, 212, 0)");
  x.fillStyle = tg;
  x.fillRect(0, 0, 512, 110);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

export function BottleCanvas({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isTouch = window.matchMedia("(hover: none)").matches;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    } catch {
      return; // no WebGL — the hero shadow ellipse still reads as a stage
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isTouch ? 1.75 : 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.96;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    camera.position.set(0, 0.5, 11.2);
    camera.lookAt(0, 0.05, 0);

    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    const key = new THREE.DirectionalLight(0xfff4e0, 1.15);
    key.position.set(3.5, 5, 4);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xd8ffe9, 1.15);
    rim.position.set(-4, 3, -4);
    scene.add(rim);
    const glow = new THREE.PointLight(0xe9e5da, 7, 10);
    glow.position.set(0, 1.8, -2.4);
    scene.add(glow);

    const group = new THREE.Group();
    scene.add(group);

    const R = 0.74; // body radius

    /* 4.1:1 silhouette — straight wall, domed shoulder, short neck, cap */
    const bottleProfile = [
      [0.0, 0.02], [0.45, 0.02], [0.66, 0.06], [0.73, 0.13], [R, 0.24],
      [R, 4.61],
      [0.735, 4.74], [0.71, 4.84], [0.665, 4.91], [0.6, 4.965],
      [0.52, 5.005], [0.44, 5.025], [0.37, 5.03],
      [0.305, 5.06], [0.305, 5.35],
      [0.335, 5.37], [0.335, 5.42],
      [0.29, 5.44], [0.29, 5.6],
    ].map(([px, py]) => new THREE.Vector2(px, py));

    const glassGeo = new THREE.LatheGeometry(bottleProfile, 72);
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xf2f7f4,
      metalness: 0,
      roughness: 0.03,
      transmission: 1,
      thickness: 0.3,
      ior: 1.44,
      attenuationColor: new THREE.Color(0xbfe8d4),
      attenuationDistance: 3,
      clearcoat: 0.6,
      clearcoatRoughness: 0.06,
      envMapIntensity: 1.1,
      specularIntensity: 1,
    });
    group.add(new THREE.Mesh(glassGeo, glassMat));

    const liquidTex = makeLiquidTexture();
    /* ~97% fill — liquid rides into the neck */
    const liquidProfile = [
      [0.0, 0.06], [0.42, 0.06], [0.6, 0.09], [0.665, 0.15], [0.695, 0.28],
      [0.695, 4.61],
      [0.69, 4.74], [0.665, 4.84], [0.62, 4.91], [0.555, 4.965],
      [0.475, 5.0], [0.42, 5.01],
      [0.275, 5.04], [0.265, 5.28], [0.0, 5.28],
    ].map(([px, py]) => new THREE.Vector2(px, py));
    const liquidGeo = new THREE.LatheGeometry(liquidProfile, 64);
    /* No transmission on the liquid — transmissive objects are excluded from
       each other's refraction pass, so it would turn invisible in the glass. */
    const liquidMat = isTouch
      ? new THREE.MeshStandardMaterial({
          map: liquidTex,
          roughness: 0.2,
          metalness: 0,
          envMapIntensity: 0.1,
        })
      : new THREE.MeshPhysicalMaterial({
          map: liquidTex,
          metalness: 0,
          roughness: 0.22,
          clearcoat: 0.18,
          clearcoatRoughness: 0.35,
          envMapIntensity: 0.11,
        });
    group.add(new THREE.Mesh(liquidGeo, liquidMat));

    /* cap — short semi-gloss black flip-top */
    const capMat = new THREE.MeshPhysicalMaterial({
      color: 0x0b0b0b,
      roughness: 0.34,
      metalness: 0.05,
      clearcoat: 0.55,
      clearcoatRoughness: 0.22,
    });
    const capProfile = [
      [0.0, 0.0], [0.345, 0.0],
      [0.345, 0.19],
      [0.312, 0.21], [0.312, 0.25],
      [0.358, 0.275], [0.358, 0.5],
      [0.345, 0.545], [0.3, 0.585],
      [0.29, 0.595], [0.0, 0.595],
    ].map(([px, py]) => new THREE.Vector2(px, py));
    const cap = new THREE.Mesh(new THREE.LatheGeometry(capProfile, 64), capMat);
    cap.position.y = 5.44;
    group.add(cap);

    /* label — wordmark drawn on a canvas, wrapped on a cylinder */
    const LBL_W = 1024;
    const LBL_H = 3120;
    const labelCanvas = document.createElement("canvas");
    labelCanvas.width = LBL_W;
    labelCanvas.height = LBL_H;
    const labelTex = new THREE.CanvasTexture(labelCanvas);
    labelTex.colorSpace = THREE.SRGBColorSpace;
    labelTex.anisotropy = 8;

    function drawLabel() {
      const ctx = labelCanvas.getContext("2d")!;
      ctx.clearRect(0, 0, LBL_W, LBL_H);

      const family = "Fraunces, Georgia, serif";
      ctx.save();
      ctx.translate(LBL_W / 2, 1440);
      ctx.rotate(Math.PI / 2);

      let fs = 500;
      ctx.font = `900 ${fs}px ${family}`;
      ctx.letterSpacing = "-14px";
      const maxLen = 2050;
      const w0 = ctx.measureText("WHIP OFF.").width;
      if (w0 > maxLen) {
        fs = Math.floor((fs * maxLen) / w0);
        ctx.font = `900 ${fs}px ${family}`;
      }
      const tw = ctx.measureText("WHIP OFF.").width;

      ctx.fillStyle = "#F4F1EA";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("WHIP OFF.", 0, 0);

      ctx.letterSpacing = "0px";
      ctx.font = `700 ${Math.round(fs * 0.15)}px ${family}`;
      ctx.textAlign = "left";
      ctx.fillText("TM", tw / 2 + 26, fs * 0.3);
      ctx.restore();

      ctx.font = "700 54px 'Space Mono', monospace";
      ctx.fillStyle = "rgba(244, 241, 234, 0.9)";
      ctx.textAlign = "center";
      ctx.fillText("HYDROILX™ CAR SHAMPOO", LBL_W / 2, 2835);
      ctx.font = "400 46px 'Space Mono', monospace";
      ctx.fillStyle = "rgba(244, 241, 234, 0.62)";
      ctx.fillText("pH 6.9 · 1:256 · 500 ML", LBL_W / 2, 2915);

      labelTex.needsUpdate = true;
    }

    const labelGeo = new THREE.CylinderGeometry(R + 0.012, R + 0.012, 3.9, 48, 1, true, -0.85, 1.7);
    const labelMat = new THREE.MeshBasicMaterial({
      map: labelTex,
      transparent: true,
      side: THREE.FrontSide,
      depthWrite: false,
    });
    const label = new THREE.Mesh(labelGeo, labelMat);
    label.position.y = 2.42;
    group.add(label);

    document.fonts
      .load("900 400px Fraunces")
      .then(() => document.fonts.load("700 54px 'Space Mono'").then(drawLabel))
      .catch(drawLabel);
    drawLabel();

    const GROUP_Y = -2.68;
    group.position.y = GROUP_Y;

    function resize() {
      if (!canvas) return;
      const w = canvas.clientWidth || canvas.parentElement?.clientWidth || 0;
      const h = canvas.clientHeight || canvas.parentElement?.clientHeight || 0;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement ?? canvas);
    resize();

    let pointerX = 0;
    let pointerY = 0;
    const onPointerMove = (e: PointerEvent) => {
      pointerX = (e.clientX / window.innerWidth - 0.5) * 2;
      pointerY = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    if (!isTouch) window.addEventListener("pointermove", onPointerMove, { passive: true });

    let inView = true;
    const io = new IntersectionObserver((en) => (inView = en[0]?.isIntersecting ?? true), {
      threshold: 0,
    });
    io.observe(canvas);

    /* entrance — starts on mount (no preloader in the store) */
    let entrance = 0;
    const entranceStart = performance.now();
    const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

    const clock = new THREE.Clock();
    let smoothScroll = 0;
    let raf = 0;

    function frame() {
      raf = requestAnimationFrame(frame);
      if (!inView || document.hidden) return;

      const t = clock.getElapsedTime();
      if (entrance < 1) {
        entrance = easeOutExpo(Math.min(1, (performance.now() - entranceStart) / 1600));
      }

      const scrollTarget = window.scrollY / Math.max(1, window.innerHeight);
      smoothScroll += (scrollTarget - smoothScroll) * 0.06;

      const idleSway = reduceMotion ? 0 : Math.sin(t * 0.45) * 0.24;
      group.rotation.y = -0.12 + idleSway + smoothScroll * Math.PI * 1.15 + pointerX * 0.22;
      group.rotation.x = pointerY * 0.06;
      group.rotation.z = Math.sin(t * 0.4) * 0.015;
      group.position.y =
        GROUP_Y + (reduceMotion ? 0 : Math.sin(t * 0.9) * 0.05) + (1 - entrance) * -0.7;

      const s = 0.72 + entrance * 0.16;
      group.scale.setScalar(s);

      renderer.render(scene, camera);
    }
    frame();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      if (!isTouch) window.removeEventListener("pointermove", onPointerMove);
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach((m) => m.dispose());
        }
      });
      liquidTex.dispose();
      labelTex.dispose();
      pmrem.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      aria-label="Rotating 3D bottle of Whipoff Gloss Wash"
    />
  );
}
