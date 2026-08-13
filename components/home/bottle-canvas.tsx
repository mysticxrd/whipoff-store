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
    const environmentTarget = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = environmentTarget.texture;

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

    /* Locked 4:1 "do it" silhouette with the base shortened by ten percent. */
    const R = 0.72;
    const W = R * 2;
    const TOTAL_H = W * 4;
    const sx = R / 0.74;
    const BODY_H_FULL = TOTAL_H * 0.78;
    const STANDING_H = BODY_H_FULL + 1 + (0.5 + 0.01 + 0.26) * 0.9 * sx;
    const CUT = STANDING_H * 0.1;
    const BODY_H = BODY_H_FULL - CUT;
    const bodyTop = BODY_H;
    const baseChamfer = BODY_H * 0.045;
    const heelH = baseChamfer + 0.06;
    const neckR = 0.3 * sx;
    const finishR = 0.26 * sx;
    const shoulderH = 0.63;
    const liquidTop = bodyTop + 0.37;

    function densify(controls: THREE.Vector2[], samples: number) {
      const curve = new THREE.CatmullRomCurve3(
        controls.map((point) => new THREE.Vector3(point.x, point.y, 0)),
        false,
        "centripetal",
        0.5,
      );
      return curve
        .getSpacedPoints(samples - 1)
        .map((point) => new THREE.Vector2(Math.max(0, point.x), point.y));
    }

    const bottleProfile: THREE.Vector2[] = [];
    for (let i = 0; i <= 40; i++) {
      const angle = ((i / 40) * Math.PI) / 2;
      bottleProfile.push(
        new THREE.Vector2(
          R * Math.sin(angle),
          0.026 + (heelH - 0.026) * (1 - Math.cos(angle)),
        ),
      );
    }
    bottleProfile.push(new THREE.Vector2(R, bodyTop));
    for (let i = 1; i <= 96; i++) {
      const t = i / 96;
      const k = 1 - Math.pow(Math.cos((t * Math.PI) / 2), 0.72);
      const bulge = 1 - 0.05 * Math.sin(t * Math.PI);
      const radius = neckR + (R - neckR) * (1 - k) * bulge;
      bottleProfile.push(new THREE.Vector2(radius, bodyTop + t * shoulderH));
    }
    for (let i = 1; i <= 48; i++) {
      const t = i / 48;
      const y = bodyTop + shoulderH + t * (1 - shoulderH);
      const bead = Math.exp(-(((t - 0.58) / 0.16) ** 2)) * 0.02 * sx;
      const radius = neckR + (finishR - neckR) * t * t + bead;
      bottleProfile.push(new THREE.Vector2(radius, y));
    }

    const glassGeo = new THREE.LatheGeometry(bottleProfile, 192);
    glassGeo.computeVertexNormals();
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
    /* The locked fill shape uses the current version's green marbled texture. */
    const liqR = R - 0.028;
    const liqNeck = Math.max(0.12, neckR - 0.05);
    const liquidProfile: THREE.Vector2[] = [];
    for (let i = 0; i <= 28; i++) {
      const angle = ((i / 28) * Math.PI) / 2;
      liquidProfile.push(
        new THREE.Vector2(
          liqR * Math.sin(angle),
          0.026 + (heelH - 0.026) * (1 - Math.cos(angle)),
        ),
      );
    }
    liquidProfile.push(new THREE.Vector2(liqR, bodyTop));
    const liqShoulderT = Math.min(1, (liquidTop - bodyTop) / shoulderH);
    for (let i = 1; i <= 64; i++) {
      const t = (liqShoulderT * i) / 64;
      const k = 1 - Math.pow(Math.cos((t * Math.PI) / 2), 0.72);
      const bulge = 1 - 0.05 * Math.sin(t * Math.PI);
      const radius = liqNeck + (liqR - liqNeck) * (1 - k) * bulge;
      liquidProfile.push(new THREE.Vector2(radius, bodyTop + t * shoulderH));
    }
    liquidProfile.push(new THREE.Vector2(0, liquidTop));
    const liquidGeo = new THREE.LatheGeometry(liquidProfile, 144);
    liquidGeo.computeVertexNormals();
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

    /* Locked two-piece flip-top cap. */
    const capMat = new THREE.MeshPhysicalMaterial({
      color: 0x0b0b0b,
      roughness: 0.34,
      metalness: 0.05,
      clearcoat: 0.55,
      clearcoatRoughness: 0.22,
    });
    const capR = 0.46;
    const baseH = 0.62;
    const lidH = 0.16;
    const seam = 0.012;
    const capGroup = new THREE.Group();
    capGroup.position.y = bodyTop + 0.84;
    capGroup.scale.setScalar(0.9 * sx);
    const baseProfile = densify(
      [
        new THREE.Vector2(0, 0),
        new THREE.Vector2(capR - 0.055, 0),
        new THREE.Vector2(capR - 0.012, 0.012),
        new THREE.Vector2(capR, 0.035),
        new THREE.Vector2(capR, baseH - 0.025),
        new THREE.Vector2(capR - 0.008, baseH - 0.006),
        new THREE.Vector2(capR - 0.025, baseH),
        new THREE.Vector2(0, baseH),
      ],
      48,
    );
    capGroup.add(new THREE.Mesh(new THREE.LatheGeometry(baseProfile, 96), capMat));

    const lowerLip = new THREE.Mesh(
      new THREE.TorusGeometry(capR - 0.006, 0.018, 10, 96),
      capMat,
    );
    lowerLip.rotation.x = Math.PI / 2;
    lowerLip.position.y = 0.032;
    capGroup.add(lowerLip);

    const lidProfile = densify(
      [
        new THREE.Vector2(0, 0),
        new THREE.Vector2(capR - 0.025, 0),
        new THREE.Vector2(capR + 0.006, 0.01),
        new THREE.Vector2(capR + 0.006, lidH - 0.03),
        new THREE.Vector2(capR - 0.004, lidH - 0.012),
        new THREE.Vector2(capR - 0.03, lidH),
        new THREE.Vector2(0, lidH),
      ],
      48,
    );
    const lid = new THREE.Mesh(new THREE.LatheGeometry(lidProfile, 96), capMat);
    lid.position.y = baseH + seam;
    capGroup.add(lid);

    const seamRing = new THREE.Mesh(
      new THREE.TorusGeometry(capR + 0.002, 0.01, 8, 96),
      capMat,
    );
    seamRing.rotation.x = Math.PI / 2;
    seamRing.position.y = baseH + seam * 0.5;
    capGroup.add(seamRing);

    const hingeY = baseH + seam / 2;
    const knuckle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 0.11, 20),
      capMat,
    );
    knuckle.rotation.x = Math.PI / 2;
    knuckle.position.set(capR + 0.016, hingeY + 0.01, 0);
    capGroup.add(knuckle);
    const hingeStrap = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, 0.09), capMat);
    hingeStrap.position.set(capR + 0.02, hingeY - 0.025, 0);
    capGroup.add(hingeStrap);
    const thumbTab = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.035, 0.14), capMat);
    thumbTab.position.set(-(capR + 0.012), baseH + seam + 0.022, 0);
    capGroup.add(thumbTab);
    const thumbLip = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.02, 0.12), capMat);
    thumbLip.position.set(-(capR + 0.008), baseH - 0.003, 0);
    capGroup.add(thumbLip);
    group.add(capGroup);

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
      ctx.fillText("HYDROSLICK™ CAR SHAMPOO", LBL_W / 2, 2835);
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

    const GROUP_Y = -TOTAL_H * 0.47 + CUT;
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
      group.scale.set(s * 0.95, s, s * 0.95);

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
      environmentTarget.dispose();
      pmrem.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      role="img"
      aria-label="Rotating 3D bottle of Whipoff Gloss Wash"
    />
  );
}
