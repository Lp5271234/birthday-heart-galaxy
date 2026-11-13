import * as THREE from "./vendor/three.module.min.js";

(() => {
  "use strict";

  const palette = ["#ff8fba", "#9ddcff", "#ffe39d", "#ffffff", "#bda2ff", "#7ce8c4", "#ff6a9d"];
  const state = {
    renderer: null,
    scene: null,
    camera: null,
    cakeGroup: null,
    galaxy: null,
    confetti: null,
    embers: null,
    emberSpeeds: [],
    flameGroup: null,
    flameOuter: null,
    flameInner: null,
    flameGlow: null,
    flameLight: null,
    ringA: null,
    ringB: null,
    dustA: null,
    dustB: null,
    host: null,
    resizeObserver: null,
    animationFrame: 0,
    lastFrame: 0,
    frameInterval: 1000 / 30,
    elapsed: 0,
    blown: false,
    flameLife: 1,
    dragging: false,
    dragMoved: false,
    lastPointerX: 0,
    lastPointerY: 0,
    targetRotationY: -0.32,
    targetRotationX: 0.08,
    reducedMotion: false,
    mobile: false,
    initialized: false,
    paused: false
  };

  function randomSeed(seed) {
    let value = seed >>> 0;
    return () => {
      value += 0x6D2B79F5;
      let t = value;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makeRoundTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.34, "rgba(255,255,255,.96)");
    gradient.addColorStop(0.68, "rgba(255,255,255,.4)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  function makeGlowTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, 256, 256);
    const gradient = ctx.createRadialGradient(128, 138, 1, 128, 128, 124);
    gradient.addColorStop(0, "rgba(255,255,245,1)");
    gradient.addColorStop(0.12, "rgba(255,246,173,.96)");
    gradient.addColorStop(0.34, "rgba(255,174,62,.7)");
    gradient.addColorStop(0.68, "rgba(255,90,42,.16)");
    gradient.addColorStop(1, "rgba(255,60,20,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 256);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    return texture;
  }

  function makeGroundGlowTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    const gradient = ctx.createRadialGradient(128, 64, 0, 128, 64, 120);
    gradient.addColorStop(0, "rgba(142,188,255,.32)");
    gradient.addColorStop(0.42, "rgba(145,102,255,.15)");
    gradient.addColorStop(1, "rgba(100,62,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 128);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  function makeGalaxyCakeTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    const rng = randomSeed(1701);

    const gradient = ctx.createLinearGradient(0, 0, 0, 512);
    gradient.addColorStop(0, "#202d78");
    gradient.addColorStop(0.35, "#10183e");
    gradient.addColorStop(0.72, "#070b22");
    gradient.addColorStop(1, "#15113b");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1024, 512);

    for (let i = 0; i < 18; i += 1) {
      const x = rng() * 1024;
      const y = rng() * 512;
      const radius = 30 + rng() * 120;
      const glow = ctx.createRadialGradient(x, y, 0, x, y, radius);
      const color = palette[Math.floor(rng() * palette.length)];
      glow.addColorStop(0, `${color}55`);
      glow.addColorStop(1, `${color}00`);
      ctx.fillStyle = glow;
      ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }

    for (let i = 0; i < 650; i += 1) {
      const x = rng() * 1024;
      const y = rng() * 512;
      const size = rng() < 0.9 ? 0.55 + rng() * 1.5 : 2 + rng() * 3.2;
      ctx.globalAlpha = 0.22 + rng() * 0.7;
      ctx.fillStyle = palette[Math.floor(rng() * palette.length)];
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.repeat.set(2.4, 1);
    return texture;
  }

  function makeSoftParticleGeometry(count, radiusMin, radiusMax, yMin, yMax, seed) {
    const rng = randomSeed(seed);
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const color = new THREE.Color();

    for (let i = 0; i < count; i += 1) {
      const angle = rng() * Math.PI * 2;
      const radius = radiusMin + Math.pow(rng(), 0.72) * (radiusMax - radiusMin);
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = yMin + rng() * (yMax - yMin);
      positions[i * 3 + 2] = Math.sin(angle) * radius;
      color.set(palette[Math.floor(rng() * palette.length)]);
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return geometry;
  }

  function createCake(scene, roundTexture) {
    const cake = new THREE.Group();
    cake.position.y = 0.08;
    scene.add(cake);

    const galaxyTexture = makeGalaxyCakeTexture();
    const sideMaterial = new THREE.MeshStandardMaterial({
      map: galaxyTexture,
      color: 0x6f78ff,
      roughness: 0.46,
      metalness: 0.22,
      emissive: 0x121b68,
      emissiveIntensity: 0.62
    });
    const icingMaterial = new THREE.MeshStandardMaterial({
      color: 0xfff0f7,
      roughness: 0.3,
      metalness: 0.04,
      emissive: 0x7b3156,
      emissiveIntensity: 0.12
    });
    const baseMaterial = new THREE.MeshStandardMaterial({
      color: 0x090a20,
      roughness: 0.8,
      metalness: 0.12
    });

    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(2.02, 2.13, 1.34, 96, 5, false),
      [sideMaterial, icingMaterial, baseMaterial]
    );
    body.position.y = 0.08;
    cake.add(body);

    const topCap = new THREE.Mesh(
      new THREE.CylinderGeometry(1.92, 1.98, 0.18, 96, 1, false),
      icingMaterial
    );
    topCap.position.y = 0.84;
    cake.add(topCap);

    const icingRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.98, 0.145, 12, 120),
      new THREE.MeshStandardMaterial({
        color: 0xffe7f1,
        roughness: 0.36,
        metalness: 0.02,
        emissive: 0x8e3d62,
        emissiveIntensity: 0.2
      })
    );
    icingRing.rotation.x = Math.PI / 2;
    icingRing.position.y = 0.88;
    cake.add(icingRing);

    const bandMaterial = new THREE.MeshBasicMaterial({
      color: 0x7a91ff,
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    [-0.28, 0.12, 0.52].forEach((y, i) => {
      const band = new THREE.Mesh(
        new THREE.TorusGeometry(2.055 - i * 0.015, 0.012, 6, 120),
        bandMaterial
      );
      band.rotation.x = Math.PI / 2;
      band.position.y = y;
      cake.add(band);
    });

    const sprinkleGeometry = new THREE.SphereGeometry(0.038, 6, 6);
    const sprinkles = new THREE.InstancedMesh(sprinkleGeometry, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.48, metalness: 0.05 }), 34);
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    const rng = randomSeed(4407);
    for (let i = 0; i < 34; i += 1) {
      const angle = rng() * Math.PI * 2;
      const radius = 1.2 + rng() * 0.62;
      dummy.position.set(Math.cos(angle) * radius, 0.94 + rng() * 0.05, Math.sin(angle) * radius);
      dummy.scale.set(1.8 + rng() * 1.8, 0.8 + rng(), 0.8 + rng());
      dummy.updateMatrix();
      sprinkles.setMatrixAt(i, dummy.matrix);
      color.set(palette[Math.floor(rng() * palette.length)]);
      sprinkles.setColorAt(i, color);
    }
    sprinkles.instanceMatrix.needsUpdate = true;
    if (sprinkles.instanceColor) sprinkles.instanceColor.needsUpdate = true;
    cake.add(sprinkles);

    const cakeStarsGeometry = makeSoftParticleGeometry(150, 2.08, 2.21, -0.52, 0.62, 90210);
    const cakeStars = new THREE.Points(
      cakeStarsGeometry,
      new THREE.PointsMaterial({
        map: roundTexture,
        size: 0.055,
        vertexColors: true,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true
      })
    );
    cake.add(cakeStars);

    const candle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.085, 0.42, 16),
      new THREE.MeshStandardMaterial({
        color: 0xffeff7,
        roughness: 0.45,
        emissive: 0x8b2751,
        emissiveIntensity: 0.16
      })
    );
    candle.position.y = 1.15;
    cake.add(candle);

    const wick = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, 0.09, 8),
      new THREE.MeshBasicMaterial({ color: 0x382235 })
    );
    wick.position.y = 1.4;
    cake.add(wick);

    return cake;
  }

  function createFlame(cake, glowTexture) {
    const group = new THREE.Group();
    group.position.y = 1.47;
    cake.add(group);

    const outerMaterial = new THREE.MeshBasicMaterial({
      color: 0xff8b31,
      transparent: true,
      opacity: 0.42,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const innerMaterial = new THREE.MeshBasicMaterial({
      color: 0xfff5b0,
      transparent: true,
      opacity: 0.98,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const outer = new THREE.Mesh(new THREE.ConeGeometry(0.105, 0.64, 20, 1, true), outerMaterial);
    outer.position.y = 0.37;
    group.add(outer);

    const inner = new THREE.Mesh(new THREE.ConeGeometry(0.052, 0.39, 16, 1, true), innerMaterial);
    inner.position.y = 0.25;
    group.add(inner);

    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture,
      color: 0xffd06b,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    }));
    glow.position.y = 0.58;
    glow.scale.set(1.12, 2.58, 1);
    group.add(glow);

    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture,
      color: 0xff7138,
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    }));
    halo.position.y = 0.62;
    halo.scale.set(2.4, 3.7, 1);
    group.add(halo);
    const light = new THREE.PointLight(0xff9a4d, 5.2, 8.5, 1.7);
    light.position.set(0, 0.75, 0);
    group.add(light);

    return { group, outer, inner, glow, light };
  }

  function createRings(scene) {
    const ringA = new THREE.Mesh(
      new THREE.TorusGeometry(3.16, 0.012, 6, 180),
      new THREE.MeshBasicMaterial({
        color: 0xffaed1,
        transparent: true,
        opacity: 0.44,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    ringA.rotation.set(Math.PI / 2 + 0.38, 0.04, 0.28);
    ringA.position.y = 0.48;
    scene.add(ringA);

    const ringB = new THREE.Mesh(
      new THREE.TorusGeometry(2.72, 0.009, 6, 150),
      new THREE.MeshBasicMaterial({
        color: 0x91ccff,
        transparent: true,
        opacity: 0.32,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    ringB.rotation.set(Math.PI / 2 - 0.26, 0.16, -0.34);
    ringB.position.y = 0.7;
    scene.add(ringB);

    return { ringA, ringB };
  }

  function createEmbers(cake, count, roundTexture) {
    const rng = randomSeed(7812);
    const positions = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    for (let i = 0; i < count; i += 1) {
      const angle = rng() * Math.PI * 2;
      const radius = 0.08 + rng() * 0.46;
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = 1.55 + rng() * 1.3;
      positions[i * 3 + 2] = Math.sin(angle) * radius;
      speeds[i] = 0.006 + rng() * 0.018;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      map: roundTexture,
      color: 0xffc05b,
      size: 0.075,
      transparent: true,
      opacity: 0.86,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true
    });
    const points = new THREE.Points(geometry, material);
    cake.add(points);
    return { points, positions, speeds };
  }

  function resize() {
    if (!state.renderer || !state.camera || !state.host) return;
    const width = Math.max(1, state.host.clientWidth);
    const height = Math.max(1, state.host.clientHeight);
    state.camera.aspect = width / height;
    state.camera.fov = state.mobile ? 39 : 34;
    state.camera.position.z = state.mobile ? 9.8 : 8.15;
    state.camera.position.y = state.mobile ? 3.25 : 3.02;
    state.camera.updateProjectionMatrix();
    state.renderer.setSize(width, height, false);
  }

  function animate(now) {
    if (!state.renderer || !state.scene || !state.camera || state.paused) return;
    state.animationFrame = requestAnimationFrame(animate);
    if (document.hidden) return;
    if (now - state.lastFrame < state.frameInterval) return;
    const delta = Math.min(0.05, (now - state.lastFrame) / 1000 || 0.016);
    state.lastFrame = now;
    state.elapsed += delta;

    const t = state.elapsed;
    if (!state.dragging && !state.reducedMotion) {
      state.targetRotationY += delta * (state.mobile ? 0.12 : 0.16);
    }
    state.cakeGroup.rotation.y += (state.targetRotationY - state.cakeGroup.rotation.y) * 0.065;
    state.cakeGroup.rotation.x += (state.targetRotationX - state.cakeGroup.rotation.x) * 0.06;

    if (!state.reducedMotion) {
      const flicker = 0.9 + Math.sin(t * 15.2) * 0.08 + Math.sin(t * 31.7) * 0.04;
      state.flameOuter.scale.set(0.96 + Math.sin(t * 13.4) * 0.07, flicker, 0.96 + Math.cos(t * 11.8) * 0.06);
      state.flameInner.scale.set(0.95 + Math.cos(t * 17.2) * 0.09, 0.9 + Math.sin(t * 23.4) * 0.1, 0.95);
      state.flameGlow.material.opacity = 0.78 + Math.sin(t * 8.3) * 0.12;
      state.flameGlow.scale.x = 1.08 + Math.sin(t * 10.7) * 0.06;
    }

    if (state.blown) {
      state.flameLife = Math.max(0, state.flameLife - delta * 2.8);
    } else {
      state.flameLife = Math.min(1, state.flameLife + delta * 3.2);
    }
    const lifeEase = state.flameLife * state.flameLife;
    state.flameGroup.scale.setScalar(Math.max(0.001, state.flameLife));
    state.flameGroup.visible = state.flameLife > 0.012;
    state.flameOuter.material.opacity = 0.9 * lifeEase;
    state.flameInner.material.opacity = 0.98 * lifeEase;
    state.flameGlow.material.opacity = Math.min(state.flameGlow.material.opacity, 0.9 * lifeEase);
    state.flameLight.intensity = 5.2 * lifeEase;
    state.embers.points.material.opacity = 0.86 * lifeEase;

    const positions = state.embers.positions;
    for (let i = 0; i < state.emberSpeeds.length; i += 1) {
      positions[i * 3 + 1] += state.emberSpeeds[i];
      if (positions[i * 3 + 1] > 3.15) positions[i * 3 + 1] = 1.52;
    }
    state.embers.points.geometry.attributes.position.needsUpdate = true;

    state.galaxy.rotation.y = t * 0.018;
    state.confetti.rotation.y = -t * 0.024;
    state.confetti.rotation.z = Math.sin(t * 0.35) * 0.03;
    state.ringA.rotation.z = 0.28 + t * 0.035;
    state.ringB.rotation.z = -0.34 - t * 0.028;
    state.dustA.rotation.y = t * 0.052;
    state.dustB.rotation.y = -t * 0.04;

    state.renderer.render(state.scene, state.camera);
  }

  function bindPointer(host) {
    let startX = 0;
    let startY = 0;
    let lastX = 0;
    let lastY = 0;

    host.addEventListener("pointerdown", (event) => {
      if (event.target.closest("button")) return;
      state.dragging = true;
      state.dragMoved = false;
      host.dataset.dragged = "false";
      startX = lastX = event.clientX;
      startY = lastY = event.clientY;
      host.classList.add("is-dragging");
      try { host.setPointerCapture(event.pointerId); } catch (error) { /* no-op */ }
    });

    host.addEventListener("pointermove", (event) => {
      if (!state.dragging) return;
      const dx = event.clientX - lastX;
      const dy = event.clientY - lastY;
      lastX = event.clientX;
      lastY = event.clientY;
      if (Math.abs(event.clientX - startX) + Math.abs(event.clientY - startY) > 6) {
        state.dragMoved = true;
      }
      state.targetRotationY += dx * 0.009;
      state.targetRotationX = Math.max(-0.24, Math.min(0.34, state.targetRotationX + dy * 0.005));
    });

    const endPointer = (event) => {
      if (!state.dragging) return;
      state.dragging = false;
      host.dataset.dragged = state.dragMoved ? "true" : "false";
      host.classList.remove("is-dragging");
      try { host.releasePointerCapture(event.pointerId); } catch (error) { /* no-op */ }
    };

    host.addEventListener("pointerup", endPointer);
    host.addEventListener("pointercancel", endPointer);
    host.addEventListener("click", (event) => {
      if (state.dragMoved) {
        event.stopPropagation();
        state.dragMoved = false;
      host.dataset.dragged = "false";
      }
    });
  }

  async function init(host, options = {}) {
    if (state.initialized) return true;
    if (!host) return false;
    try {
      state.mobile = Boolean(options.mobile);
      state.reducedMotion = Boolean(options.reducedMotion);
      state.frameInterval = state.reducedMotion ? 1000 : (state.mobile ? 1000 / 30 : 1000 / 45);
      state.host = host;

      const renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: !state.mobile,
        powerPreference: "high-performance",
        premultipliedAlpha: true
      });
      renderer.setClearColor(0x000000, 0);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, state.mobile ? 1.25 : 1.7));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.12;
      renderer.domElement.className = "cake3d-canvas";
      host.replaceChildren(renderer.domElement);
      state.renderer = renderer;

      const scene = new THREE.Scene();
      state.scene = scene;

      const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 40);
      camera.position.set(0, 3.02, 8.15);
      camera.lookAt(0, 0.55, 0);
      state.camera = camera;

      scene.add(new THREE.AmbientLight(0x8792ff, 1.55));
      const keyLight = new THREE.DirectionalLight(0xffbdd8, 3.1);
      keyLight.position.set(3.8, 5.3, 4.6);
      scene.add(keyLight);
      const blueLight = new THREE.PointLight(0x6388ff, 2.4, 12, 1.8);
      blueLight.position.set(-4.2, 1.3, 3.3);
      scene.add(blueLight);

      const roundTexture = makeRoundTexture();
      const glowTexture = makeGlowTexture();
      const groundTexture = makeGroundGlowTexture();

      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(7.8, 4.4),
        new THREE.MeshBasicMaterial({
          map: groundTexture,
          transparent: true,
          opacity: 0.88,
          depthWrite: false,
          blending: THREE.AdditiveBlending
        })
      );
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -0.68;
      scene.add(ground);

      const cake = createCake(scene, roundTexture);
      state.cakeGroup = cake;

      const galaxyCount = state.mobile ? 280 : 620;
      const galaxy = new THREE.Points(
        makeSoftParticleGeometry(galaxyCount, 2.25, 4.65, -1.18, 3.25, 3801),
        new THREE.PointsMaterial({
          map: roundTexture,
          size: state.mobile ? 0.061 : 0.055,
          vertexColors: true,
          transparent: true,
          opacity: 0.76,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          sizeAttenuation: true
        })
      );
      state.galaxy = galaxy;
      scene.add(galaxy);

      const confettiCount = state.mobile ? 74 : 135;
      const confetti = new THREE.Points(
        makeSoftParticleGeometry(confettiCount, 1.5, 3.6, -0.42, 2.65, 8113),
        new THREE.PointsMaterial({
          map: roundTexture,
          size: state.mobile ? 0.105 : 0.095,
          vertexColors: true,
          transparent: true,
          opacity: 0.95,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          sizeAttenuation: true
        })
      );
      state.confetti = confetti;
      scene.add(confetti);

      const flame = createFlame(cake, glowTexture);
      state.flameGroup = flame.group;
      state.flameOuter = flame.outer;
      state.flameInner = flame.inner;
      state.flameGlow = flame.glow;
      state.flameLight = flame.light;

      const rings = createRings(scene);
      state.ringA = rings.ringA;
      state.ringB = rings.ringB;

      const dustA = new THREE.Points(
        makeSoftParticleGeometry(state.mobile ? 72 : 116, 3.08, 3.23, 0.38, 0.59, 5117),
        new THREE.PointsMaterial({
          map: roundTexture,
          size: 0.033,
          color: 0xffc6df,
          transparent: true,
          opacity: 0.58,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          sizeAttenuation: true
        })
      );
      dustA.rotation.set(Math.PI / 2 + 0.38, 0.04, 0.28);
      state.dustA = dustA;
      scene.add(dustA);

      const dustB = new THREE.Points(
        makeSoftParticleGeometry(state.mobile ? 54 : 86, 2.66, 2.79, 0.62, 0.78, 7734),
        new THREE.PointsMaterial({
          map: roundTexture,
          size: 0.027,
          color: 0xaadfff,
          transparent: true,
          opacity: 0.54,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          sizeAttenuation: true
        })
      );
      dustB.rotation.set(Math.PI / 2 - 0.26, 0.16, -0.34);
      state.dustB = dustB;
      scene.add(dustB);

      const embers = createEmbers(cake, state.mobile ? 28 : 46, roundTexture);
      state.embers = embers;
      state.emberSpeeds = Array.from(embers.speeds);

      bindPointer(host);
      if ("ResizeObserver" in window) {
        state.resizeObserver = new ResizeObserver(resize);
        state.resizeObserver.observe(host);
      }
      window.addEventListener("resize", resize, { passive: true });
      resize();
      state.initialized = true;
      state.lastFrame = performance.now() - 1000;
      animate(performance.now());
      return true;
    } catch (error) {
      console.error("3D cake initialization failed", error);
      state.initialized = false;
      return false;
    }
  }

  window.Cake3D = {
    init,
    blow() {
      state.blown = true;
    },
    relight() {
      state.blown = false;
    },
    isInitialized() {
      return state.initialized;
    },
    pause() {
      state.paused = true;
      cancelAnimationFrame(state.animationFrame);
      state.animationFrame = 0;
    },
    resume() {
      if (!state.initialized || !state.paused) return;
      state.paused = false;
      state.lastFrame = performance.now() - 1000;
      state.animationFrame = requestAnimationFrame(animate);
    },    resize
  };

  window.dispatchEvent(new Event("cake3d-ready"));
})();








