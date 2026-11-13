(() => {
  "use strict";

  const defaults = {
    to: "朋友",
    from: "你的朋友",
    introName: "",
    introHint: "轻触礼物，开启惊喜",
    heartTitle: "生日快乐",
    heartSubtitle: "愿你新的一岁，继续闪闪发光",
    heartMessages: ["生日快乐", "愿你天天开心", "所有美好如约而至"],
    cakeWish: "许个愿，然后吹灭蜡烛",
    cakeHint: "轻触蜡烛，或者点一下蛋糕",
    letterTitle: "生日快乐",
    letterLines: ["生日快乐，", "愿你一直快乐自在。"],
    signature: "From {from}",
    candleCount: 5,
    photoUrl: "",
    photoCaption: "",
    audioUrl: "",
    theme: {
      accent: "#ff8fba",
      accent2: "#9ddcff",
      glow: "#ffd5e5",
      cake: "#f7b2c9"
    }
  };

  const userConfig = window.BIRTHDAY_CONFIG || {};
  const config = {
    ...defaults,
    ...userConfig,
    theme: { ...defaults.theme, ...(userConfig.theme || {}) }
  };

  const $ = (id) => document.getElementById(id);
  const el = {
    ambientCanvas: $("ambientCanvas"),
    effectCanvas: $("effectCanvas"),
    introScene: $("introScene"),
    heartScene: $("heartScene"),
    cakeScene: $("cakeScene"),
    letterScene: $("letterScene"),
    startButton: $("startButton"),
    soundToggle: $("soundToggle"),
    replayButton: $("replayButton"),
    introRecipient: $("introRecipient"),
    introHint: $("introHint"),
    introTitle: $("introTitle"),
    heartRecipient: $("heartRecipient"),
    heartTitle: $("heartTitle"),
    heartSubtitle: $("heartSubtitle"),
    heartStage: $("heartStage"),
    heartCards: $("heartCards"),
    heartCard: $("heartCard"),
    toCakeButton: $("toCakeButton"),
    cakeTitle: $("cakeTitle"),
    cakeHint: $("cakeHint"),
    cakeStage: $("cakeStage"),
    cake: $("cake"),
    cake3dHost: $("cake3dHost"),
    blowCandleButton: $("blowCandleButton"),
    candles: $("candles"),
    skipToLetterButton: $("skipToLetterButton"),
    letterRecipient: $("letterRecipient"),
    letterTitle: $("letterTitle"),
    letterBody: $("letterBody"),
    letterSignature: $("letterSignature"),
    againButton: $("againButton"),
    memoryPhoto: $("memoryPhoto"),
    memoryPhotoImage: $("memoryPhotoImage"),
    memoryPhotoCaption: $("memoryPhotoCaption"),
    liveStatus: $("liveStatus")
  };

  const scenes = {
    intro: el.introScene,
    heart: el.heartScene,
    cake: el.cakeScene,
    letter: el.letterScene
  };

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const state = {
    started: false,
    currentScene: "intro",
    heartBuilt: false,
    heartPrepared: false,
    heartCards: [],
    candles: [],
    blown: 0,
    celebrating: false,
    cakePrepared: false,
    mode3d: false,
    lastFocused: null
  };

  function getString(value, fallback) {
    return typeof value === "string" && value.trim() ? value.trim() : fallback;
  }

  function fillTokens(text) {
    return String(text)
      .replaceAll("{name}", config.to)
      .replaceAll("{from}", config.from);
  }

  function isValidColor(value) {
    return /^#[0-9a-f]{3,8}$/i.test(value) || /^(rgb|hsl)a?\(/i.test(value);
  }

  function applyUrlOverrides() {
    const params = new URLSearchParams(window.location.search);
    const to = params.get("to") || params.get("name");
    const from = params.get("from") || params.get("sender");
    const theme = params.get("color") || params.get("theme");
    const photo = params.get("photo");
    const audio = params.get("audio");
    const quality = params.get("quality");

    if (to) config.to = to.trim().slice(0, 40);
    if (from) config.from = from.trim().slice(0, 40);
    if (theme && isValidColor(theme)) config.theme.accent = theme;
    if (photo) config.photoUrl = photo;
    if (audio) config.audioUrl = audio;
    if (quality) config.quality = quality.toLowerCase();
  }

  function applyConfig() {
    applyUrlOverrides();

    config.to = getString(config.to, defaults.to);
    config.from = getString(config.from, defaults.from);
    config.heartMessages = Array.isArray(config.heartMessages) && config.heartMessages.length
      ? config.heartMessages.map((item) => String(item).trim()).filter(Boolean)
      : defaults.heartMessages.slice();
    config.letterLines = Array.isArray(config.letterLines) && config.letterLines.length
      ? config.letterLines.map((item) => String(item))
      : defaults.letterLines.slice();

    sound.src = config.audioUrl || "";
    sound.mode = config.audioUrl ? "file" : "synth";

    const root = document.documentElement;
    root.style.setProperty("--accent", config.theme.accent);
    root.style.setProperty("--accent-2", config.theme.accent2);
    root.style.setProperty("--glow", config.theme.glow);
    root.style.setProperty("--cake", config.theme.cake);

    el.introRecipient.textContent = config.to;
    el.heartRecipient.textContent = config.to;
    el.letterRecipient.textContent = config.to;
    el.introHint.textContent = config.introHint;
    el.heartSubtitle.textContent = config.heartSubtitle;
    el.cakeTitle.textContent = config.cakeWish;
    el.cakeHint.textContent = config.cakeHint;
    el.letterTitle.textContent = fillTokens(config.letterTitle);

    if (config.introName) {
      el.introTitle.textContent = fillTokens(config.introName);
    }

    const titleTextNode = el.heartTitle.firstChild;
    if (titleTextNode && titleTextNode.nodeType === Node.TEXT_NODE) {
      titleTextNode.nodeValue = `${config.heartTitle} `;
    }

    document.title = `生日快乐｜给${config.to}的小惊喜`;
    const description = document.querySelector('meta[name="description"]');
    if (description) description.setAttribute("content", `一份写给${config.to}的生日惊喜。`);

    if (config.photoUrl) {
      el.memoryPhotoCaption.textContent = config.photoCaption || "";
      el.memoryPhotoImage.alt = config.photoCaption || `${config.to}的照片`;
      el.memoryPhotoImage.addEventListener("load", () => {
        el.memoryPhoto.hidden = false;
      }, { once: true });
      el.memoryPhotoImage.addEventListener("error", () => {
        el.memoryPhoto.hidden = true;
      }, { once: true });
      el.memoryPhotoImage.src = config.photoUrl;
    }
  }

  function setScene(name, announce) {
    if (!scenes[name]) return;
    Object.entries(scenes).forEach(([sceneName, node]) => {
      const active = sceneName === name;
      if (!active && node.contains(document.activeElement)) {
        document.activeElement.blur();
      }
      node.classList.toggle("is-active", active);
      if ("inert" in node) node.inert = !active;
      node.setAttribute("aria-hidden", String(!active));
    });
    state.currentScene = name;
    if (window.Cake3D) {
      if (name === "cake") window.Cake3D.resume();
      else window.Cake3D.pause();
    }
    document.body.dataset.stage = name;
    if (announce) el.liveStatus.textContent = announce;
  }

  class SoundEngine {
    constructor(src) {
      this.src = src;
      this.audio = null;
      this.context = null;
      this.master = null;
      this.timer = null;
      this.playing = false;
      this.mode = src ? "file" : "synth";
      this.index = 0;
      this.melody = [523.25, 659.25, 783.99, 659.25, 587.33, 698.46, 880, 698.46, 523.25, 659.25, 783.99, 1046.5, 987.77, 783.99, 659.25, 523.25];
    }

    async start() {
      if (this.playing) return true;
      if (this.mode === "file" && this.src) {
        try {
          if (!this.audio) {
            this.audio = new Audio(this.src);
            this.audio.loop = true;
            this.audio.preload = "auto";
            this.audio.volume = 0.5;
          }
          await this.audio.play();
          this.playing = true;
          this.updateButton();
          return true;
        } catch (error) {
          this.mode = "synth";
          this.audio = null;
        }
      }
      return this.startSynth();
    }

    async startSynth() {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        el.liveStatus.textContent = "当前浏览器不支持背景音乐。";
        return false;
      }

      try {
        if (!this.context) {
          this.context = new AudioContextClass();
          this.master = this.context.createGain();
          this.master.gain.value = 0;
          this.master.connect(this.context.destination);
        }
        if (this.context.state === "suspended") await this.context.resume();
        this.playing = true;
        this.master.gain.cancelScheduledValues(this.context.currentTime);
        this.master.gain.setTargetAtTime(0.095, this.context.currentTime, 0.08);
        this.scheduleSynthLoop();
        this.updateButton();
        return true;
      } catch (error) {
        this.playing = false;
        this.updateButton();
        el.liveStatus.textContent = "背景音乐未能启动，可以再点一次音符按钮。";
        return false;
      }
    }

    scheduleSynthLoop() {
      window.clearInterval(this.timer);
      this.playSynthNote();
      this.timer = window.setInterval(() => {
        if (this.playing) this.playSynthNote();
      }, 520);
    }

    playSynthNote() {
      if (!this.context || !this.master || !this.playing) return;
      const now = this.context.currentTime + 0.02;
      const frequency = this.melody[this.index % this.melody.length];
      this.index += 1;

      const osc = this.context.createOscillator();
      const gain = this.context.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(frequency, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.055, now + 0.035);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.75);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(now);
      osc.stop(now + 0.82);

      const shimmer = this.context.createOscillator();
      const shimmerGain = this.context.createGain();
      shimmer.type = "sine";
      shimmer.frequency.setValueAtTime(frequency * 2, now);
      shimmerGain.gain.setValueAtTime(0.0001, now);
      shimmerGain.gain.exponentialRampToValueAtTime(0.012, now + 0.04);
      shimmerGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
      shimmer.connect(shimmerGain);
      shimmerGain.connect(this.master);
      shimmer.start(now);
      shimmer.stop(now + 0.46);
    }

    pause() {
      this.playing = false;
      window.clearInterval(this.timer);
      this.timer = null;
      if (this.audio) this.audio.pause();
      if (this.master && this.context) {
        this.master.gain.cancelScheduledValues(this.context.currentTime);
        this.master.gain.setTargetAtTime(0, this.context.currentTime, 0.06);
      }
      this.updateButton();
    }

    async toggle() {
      if (this.playing) {
        this.pause();
        el.liveStatus.textContent = "背景音乐已暂停。";
      } else {
        const started = await this.start();
        if (started) el.liveStatus.textContent = "背景音乐已开启。";
      }
    }

    updateButton() {
      el.soundToggle.setAttribute("aria-pressed", String(this.playing));
      el.soundToggle.setAttribute("aria-label", this.playing ? "暂停背景音乐" : "播放背景音乐");
    }

    chime() {
      if (!this.context || !this.master || !this.playing) return;
      [659.25, 783.99, 1046.5].forEach((frequency, index) => {
        const now = this.context.currentTime + index * 0.12;
        const osc = this.context.createOscillator();
        const gain = this.context.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(frequency, now);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.03, now + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);
        osc.connect(gain);
        gain.connect(this.master);
        osc.start(now);
        osc.stop(now + 0.7);
      });
    }
  }

  class Starfield {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d", { alpha: true });
      this.stars = [];
      this.raf = 0;
      this.width = 0;
      this.height = 0;
      this.dpr = 1;
      this.lastFrame = 0;
      this.frameInterval = 1000 / 30;
      this.resize = this.resize.bind(this);
      this.draw = this.draw.bind(this);
      this.onVisibility = this.onVisibility.bind(this);
      window.addEventListener("resize", this.resize, { passive: true });
      document.addEventListener("visibilitychange", this.onVisibility);
      this.resize();
      this.loopStart = performance.now();
      this.raf = requestAnimationFrame(this.draw);
    }

    resize() {
      this.width = window.innerWidth;
      this.height = window.innerHeight;
      const mobile = this.width < 700;
      this.dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 1.5);
      this.canvas.width = Math.round(this.width * this.dpr);
      this.canvas.height = Math.round(this.height * this.dpr);
      this.canvas.style.width = `${this.width}px`;
      this.canvas.style.height = `${this.height}px`;
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      const count = reducedMotion.matches ? 18 : (mobile ? 42 : Math.round(Math.min(105, Math.max(60, this.width / 12))));
      this.stars = Array.from({ length: count }, () => ({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        radius: Math.random() * 1.55 + 0.35,
        alpha: Math.random() * 0.6 + 0.2,
        phase: Math.random() * Math.PI * 2,
        speed: 0.35 + Math.random() * 0.75,
        drift: Math.random() * 0.06 + 0.01
      }));
    }

    onVisibility() {
      if (document.hidden) {
        cancelAnimationFrame(this.raf);
        this.raf = 0;
      } else if (!this.raf) {
        this.raf = requestAnimationFrame(this.draw);
      }
    }

    draw(now) {
      this.raf = requestAnimationFrame(this.draw);
      if (now - this.lastFrame < this.frameInterval) return;
      this.lastFrame = now;
      const elapsed = (now - this.loopStart) / 1000;
      this.ctx.clearRect(0, 0, this.width, this.height);
      this.ctx.globalCompositeOperation = "lighter";

      for (const star of this.stars) {
        const twinkle = 0.58 + Math.sin(elapsed * star.speed + star.phase) * 0.32;
        this.ctx.beginPath();
        this.ctx.fillStyle = `rgba(255, 241, 250, ${Math.max(0.08, star.alpha * twinkle)})`;
        this.ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        this.ctx.fill();

        if (star.radius > 1.35) {
          this.ctx.fillStyle = `rgba(170, 220, 255, ${star.alpha * 0.22})`;
          this.ctx.fillRect(star.x - 3.5, star.y - 0.5, 7, 1);
        }

        star.y -= star.drift;
        if (star.y < -4) {
          star.y = this.height + 4;
          star.x = Math.random() * this.width;
        }
      }

      this.ctx.globalCompositeOperation = "source-over";
    }
  }

  class Effects {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d", { alpha: true });
      this.particles = [];
      this.raf = 0;
      this.width = 0;
      this.height = 0;
      this.dpr = 1;
      this.resize = this.resize.bind(this);
      this.tick = this.tick.bind(this);
      window.addEventListener("resize", this.resize, { passive: true });
      this.resize();
    }

    resize() {
      this.width = window.innerWidth;
      this.height = window.innerHeight;
      this.dpr = Math.min(window.devicePixelRatio || 1, this.width < 700 ? 1.5 : 1.75);
      this.canvas.width = Math.round(this.width * this.dpr);
      this.canvas.height = Math.round(this.height * this.dpr);
      this.canvas.style.width = `${this.width}px`;
      this.canvas.style.height = `${this.height}px`;
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    }

    burst(x, y, amount, power = 1) {
      const count = reducedMotion.matches ? Math.max(10, Math.round(amount * 0.3)) : amount;
      const palette = ["#ff8fba", "#9ddcff", "#ffe5a8", "#ffffff", "#c5a7ff", "#81f0c8"];
      for (let i = 0; i < count; i += 1) {
        const angle = Math.random() * Math.PI * 2;
        const velocity = (2.2 + Math.random() * 7.6) * power;
        this.particles.push({
          x,
          y,
          vx: Math.cos(angle) * velocity,
          vy: Math.sin(angle) * velocity - 1.8,
          gravity: 0.045 + Math.random() * 0.04,
          drag: 0.988,
          life: 1,
          decay: 0.009 + Math.random() * 0.012,
          size: 1.5 + Math.random() * 5.2,
          color: palette[Math.floor(Math.random() * palette.length)],
          rotation: Math.random() * Math.PI,
          spin: (Math.random() - 0.5) * 0.18,
          shape: Math.random() > 0.62 ? "rect" : "circle"
        });
      }
      this.ensureLoop();
    }

    fireworkShow(duration = 2200) {
      const start = performance.now();
      const launch = () => {
        const elapsed = performance.now() - start;
        if (elapsed > duration) return;
        const x = this.width * (0.18 + Math.random() * 0.64);
        const y = this.height * (0.16 + Math.random() * 0.5);
        this.burst(x, y, 66 + Math.random() * 45, 0.8 + Math.random() * 0.6);
        window.setTimeout(launch, 260 + Math.random() * 240);
      };
      this.burst(this.width * 0.5, this.height * 0.44, 80, 1.25);
      window.setTimeout(launch, 180);
    }

    ensureLoop() {
      if (!this.raf) this.raf = requestAnimationFrame(this.tick);
    }

    tick() {
      this.ctx.clearRect(0, 0, this.width, this.height);
      this.ctx.globalCompositeOperation = "lighter";

      for (let i = this.particles.length - 1; i >= 0; i -= 1) {
        const particle = this.particles[i];
        particle.vx *= particle.drag;
        particle.vy = particle.vy * particle.drag + particle.gravity;
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.rotation += particle.spin;
        particle.life -= particle.decay;

        if (particle.life <= 0 || particle.y > this.height + 40) {
          this.particles.splice(i, 1);
          continue;
        }

        this.ctx.save();
        this.ctx.globalAlpha = Math.max(0, particle.life);
        this.ctx.fillStyle = particle.color;
        this.ctx.translate(particle.x, particle.y);
        this.ctx.rotate(particle.rotation);
        if (particle.shape === "rect") {
          this.ctx.fillRect(-particle.size * 0.55, -particle.size * 0.3, particle.size * 1.1, particle.size * 0.6);
        } else {
          this.ctx.beginPath();
          this.ctx.arc(0, 0, particle.size * 0.55, 0, Math.PI * 2);
          this.ctx.fill();
        }
        this.ctx.restore();
      }

      this.ctx.globalCompositeOperation = "source-over";
      if (this.particles.length) {
        this.raf = requestAnimationFrame(this.tick);
      } else {
        this.raf = 0;
        this.ctx.clearRect(0, 0, this.width, this.height);
      }
    }
  }

  const sound = new SoundEngine(config.audioUrl);
  const starfield = new Starfield(el.ambientCanvas);
  const effects = new Effects(el.effectCanvas);
  let heartResizeTimer = 0;
  let cake3dModulePromise = null;

  function heartPoint(angle) {
    const x = 16 * Math.pow(Math.sin(angle), 3);
    const y = -(13 * Math.cos(angle) - 5 * Math.cos(2 * angle) - 2 * Math.cos(3 * angle) - Math.cos(4 * angle));
    return { x, y };
  }

  function createHeartCards() {
    if (state.heartBuilt) return;
    const maxCards = window.innerWidth < 700 ? 24 : 32;
    const total = Math.min(config.heartMessages.length, maxCards);
    for (let i = 0; i < total; i += 1) {
      const slot = document.createElement("div");
      slot.className = "heart-slot";
      const windowNode = document.createElement("div");
      windowNode.className = "wish-window";
      const label = document.createElement("span");
      label.textContent = config.heartMessages[i % config.heartMessages.length];
      windowNode.appendChild(label);
      slot.appendChild(windowNode);
      el.heartCards.appendChild(slot);
      state.heartCards.push(slot);
    }
    state.heartBuilt = true;
  }

  function layoutHeartCards() {
    if (!state.heartBuilt) return;
    const rect = el.heartStage.getBoundingClientRect();
    const scale = Math.min((rect.width * 0.42) / 16, (rect.height * 0.43) / 17);
    const cardWidth = Math.max(44, Math.min(68, rect.width * 0.087));
    const cardHeight = cardWidth * 0.64;

    state.heartCards.forEach((slot, index) => {
      const angle = (Math.PI * 2 * index) / state.heartCards.length;
      const point = heartPoint(angle);
      const jitter = 0.965 + (index % 5) * 0.011;
      const x = point.x * scale * jitter;
      const y = point.y * scale * jitter;
      const rotation = Math.sin(angle * 2.2) * 7 + (index % 3 - 1) * 2;
      slot.style.setProperty("--x", `${x.toFixed(2)}px`);
      slot.style.setProperty("--y", `${y.toFixed(2)}px`);
      slot.style.setProperty("--r", `${rotation.toFixed(2)}deg`);
      slot.style.setProperty("--w", `${cardWidth.toFixed(1)}px`);
      slot.style.setProperty("--h", `${cardHeight.toFixed(1)}px`);
      slot.style.setProperty("--o", `${(0.55 + (index % 4) * 0.1).toFixed(2)}`);
      slot.style.setProperty("--delay", `${index * 24}ms`);
      slot.style.setProperty("--float-delay", `${-((index * 317) % 5800)}ms`);
    });
  }

  function showHeart() {
    createHeartCards();
    if (!state.heartPrepared) {
      layoutHeartCards();
      state.heartPrepared = true;
    }
    setScene("heart", "小窗正在拼成一颗爱心。");
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        state.heartCards.forEach((slot) => slot.classList.add("is-visible"));
      });
    });
    window.setTimeout(() => el.heartCard.classList.add("is-visible"), 1250);
  }

  function startExperience() {
    if (state.started) return;
    state.started = true;
    el.soundToggle.hidden = false;
    el.replayButton.hidden = false;
    sound.start();
    showHeart();
    if (config.quality !== "low" && config.quality !== "css") loadCake3DModule();
  }

  function loadCake3DModule() {
    if (window.Cake3D) return Promise.resolve(window.Cake3D);
    if (!cake3dModulePromise) {
      try {
        const dynamicImport = new Function("return import('./cake3d.js?v=4')");
        cake3dModulePromise = dynamicImport()
          .then(() => window.Cake3D || null)
          .catch(() => null);
      } catch (error) {
        cake3dModulePromise = Promise.resolve(null);
      }
    }
    return cake3dModulePromise;
  }

  function waitForCake3D(timeout = 5000) {
    return Promise.race([
      loadCake3DModule(),
      new Promise((resolve) => window.setTimeout(() => resolve(null), timeout))
    ]);
  }

  async function enterCake() {
    if (state.cakePrepared) return;
    state.cakePrepared = true;
    setScene("cake", "进入 3D 星河蛋糕，拖动可以旋转。");
    el.blowCandleButton.disabled = true;

    const lowQuality = config.quality === "low" || config.quality === "css";
    const cake3d = lowQuality ? null : await waitForCake3D();
    let use3d = false;
    if (cake3d && typeof cake3d.init === "function") {
      use3d = await cake3d.init(el.cake3dHost, {
        mobile: window.innerWidth < 700,
        reducedMotion: reducedMotion.matches
      });
    }

    state.mode3d = Boolean(use3d);
    if (state.mode3d) {
      el.cake.hidden = true;
      el.cake3dHost.hidden = false;
      el.cakeHint.textContent = "拖动旋转蛋糕，轻触蛋糕或按钮吹灭蜡烛";
    } else {
      el.cake3dHost.hidden = true;
      el.cake.hidden = false;
      setupCandles();
      el.cakeHint.textContent = config.cakeHint;
    }

    el.blowCandleButton.disabled = false;
    if (!reducedMotion.matches) {
      effects.burst(window.innerWidth * 0.5, window.innerHeight * 0.57, 18, 0.45);
    }
  }

  function setupCandles() {
    if (state.candles.length) return;
    const count = Math.max(3, Math.min(7, Number(config.candleCount) || 5));
    state.blown = 0;
    state.celebrating = false;

    for (let i = 0; i < count; i += 1) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "candle-button";
      button.style.left = `${((i + 0.5) / count) * 100}%`;
      button.style.bottom = `${Math.abs(i - (count - 1) / 2) * 2}px`;
      button.setAttribute("aria-label", `吹灭第 ${i + 1} 根蜡烛`);

      const stick = document.createElement("span");
      stick.className = "candle-stick";
      const flame = document.createElement("span");
      flame.className = "flame";
      const smoke = document.createElement("span");
      smoke.className = "smoke";
      stick.appendChild(flame);
      button.appendChild(stick);
      button.appendChild(smoke);

      button.addEventListener("click", (event) => {
        event.stopPropagation();
        blowCandle(button);
      });
      el.candles.appendChild(button);
      state.candles.push(button);
    }
  }

  function blowCandle(button) {
    if (!button || button.classList.contains("is-blown")) return;
    button.classList.add("is-blown");
    button.setAttribute("aria-label", "蜡烛已吹灭");
    state.blown += 1;
    el.liveStatus.textContent = `已吹灭 ${state.blown} 根蜡烛。`;
    sound.chime();

    if (!reducedMotion.matches) {
      const rect = button.getBoundingClientRect();
      effects.burst(rect.left + rect.width / 2, rect.top + rect.height * 0.2, 14, 0.32);
    }

    if (state.blown === state.candles.length) {
      window.setTimeout(celebrate, 420);
    }
  }

  function blow3DCandle() {
    if (state.celebrating) return;
    state.celebrating = true;
    if (window.Cake3D) window.Cake3D.blow();
    el.liveStatus.textContent = "蜡烛已吹灭，愿望正在升起。";
    sound.chime();
    effects.fireworkShow(2600);
    window.setTimeout(() => revealLetter(true), reducedMotion.matches ? 450 : 1800);
  }

  function blowAllCandles() {
    if (state.mode3d) {
      blow3DCandle();
      return;
    }
    state.candles.forEach((button, index) => {
      if (button.classList.contains("is-blown")) return;
      window.setTimeout(() => blowCandle(button), index * 85);
    });
  }

  function celebrate() {
    if (state.celebrating) return;
    state.celebrating = true;
    el.cake.classList.add("celebrating");
    el.liveStatus.textContent = "愿望已许下，生日贺卡正在打开。";
    effects.fireworkShow(2600);
    window.setTimeout(() => revealLetter(true), reducedMotion.matches ? 450 : 1800);
  }

  function buildLetter() {
    el.letterBody.replaceChildren();
    config.letterLines.forEach((line, index) => {
      const paragraph = document.createElement("p");
      const text = fillTokens(line);
      paragraph.className = text.trim() ? "letter-line" : "letter-line empty";
      paragraph.textContent = text;
      paragraph.style.animationDelay = `${Math.min(index * 115, 1300)}ms`;
      el.letterBody.appendChild(paragraph);
    });
    el.letterSignature.textContent = fillTokens(config.signature);
    el.letterSignature.style.animationDelay = `${Math.min(config.letterLines.length * 115 + 200, 1700)}ms`;
  }

  function revealLetter(fromCandles) {
    buildLetter();
    setScene("letter", "生日贺卡已打开。");
    effects.fireworkShow(fromCandles ? 3000 : 2000);
    if (fromCandles) sound.chime();
  }

  function resetExperience() {
    window.location.reload();
  }

  function setupCakeDrag() {
    let dragging = false;
    let moved = false;
    let startX = 0;
    let startY = 0;
    let startRx = -7;
    let startRy = -9;
    let rx = -7;
    let ry = -9;

    el.cake.addEventListener("pointerdown", (event) => {
      if (event.target.closest(".candle-button")) return;
      dragging = true;
      moved = false;
      startX = event.clientX;
      startY = event.clientY;
      startRx = rx;
      startRy = ry;
      el.cake.classList.add("is-dragging");
      try { el.cake.setPointerCapture(event.pointerId); } catch (error) { /* no-op */ }
    });

    el.cake.addEventListener("pointermove", (event) => {
      if (!dragging) return;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      if (Math.abs(dx) + Math.abs(dy) > 6) moved = true;
      ry = Math.max(-22, Math.min(22, startRy + dx * 0.12));
      rx = Math.max(-16, Math.min(6, startRx - dy * 0.09));
      el.cake.style.setProperty("--rx", `${rx.toFixed(2)}deg`);
      el.cake.style.setProperty("--ry", `${ry.toFixed(2)}deg`);
    });

    const endDrag = (event) => {
      if (!dragging) return;
      dragging = false;
      el.cake.classList.remove("is-dragging");
      try { el.cake.releasePointerCapture(event.pointerId); } catch (error) { /* no-op */ }
      if (!moved) blowAllCandles();
    };

    el.cake.addEventListener("pointerup", endDrag);
    el.cake.addEventListener("pointercancel", endDrag);

    el.cake.addEventListener("click", (event) => {
      if (event.target.closest(".candle-button")) return;
      if (!moved) blowAllCandles();
    });

    el.cake.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        blowAllCandles();
      }
    });
  }

  function bindEvents() {
    el.startButton.addEventListener("click", startExperience);
    el.toCakeButton.addEventListener("click", enterCake);
    el.blowCandleButton.addEventListener("click", blowAllCandles);
    el.cake3dHost.addEventListener("click", () => {
      if (el.cake3dHost.dataset.dragged === "true") {
        el.cake3dHost.dataset.dragged = "false";
        return;
      }
      blowAllCandles();
    });
    el.skipToLetterButton.addEventListener("click", () => revealLetter(false));
    el.againButton.addEventListener("click", resetExperience);
    el.replayButton.addEventListener("click", resetExperience);
    el.soundToggle.addEventListener("click", () => sound.toggle());

    window.addEventListener("resize", () => {
      window.clearTimeout(heartResizeTimer);
      heartResizeTimer = window.setTimeout(() => {
        if (state.heartBuilt) layoutHeartCards();
      }, 140);
    }, { passive: true });
  }

  function prepareHeartIfIdle() {
    const prepare = () => {
      if (state.started || state.heartBuilt) return;
      createHeartCards();
      layoutHeartCards();
      state.heartPrepared = true;
    };
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(prepare, { timeout: 1200 });
    } else {
      window.setTimeout(prepare, 350);
    }
  }
  function init() {
    applyConfig();
    bindEvents();
    setupCakeDrag();
    setScene("intro", "轻触礼物，开启生日惊喜。");
    prepareHeartIfIdle();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();






















