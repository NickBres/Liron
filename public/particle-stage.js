/* <particle-stage> — one persistent GPU particle system that morphs between
   procedural 3D forms and text. No addons / import maps: glow is done with an
   additive sprite + halo pass instead of UnrealBloom. */
(function () {
  const SETTINGS = window.projectSettings.particles;
  const AR_SETTINGS = window.projectSettings.ar || {};
  const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.163.0/build/three.module.js';
  const CLOUDS = {};
  let threeP = null, postProcessingP = null, zapparP = null;
  const loadThree = () => (threeP || (threeP = import(THREE_URL)));
  const loadZappar = THREE => {
    if (window.ZapparThree) return Promise.resolve(window.ZapparThree);
    if (zapparP) return zapparP;
    // The official standalone bundle consumes THREE from the global scope.
    window.THREE = THREE;
    zapparP = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = AR_SETTINGS.sdkUrl;
      script.async = true;
      script.onload = () => window.ZapparThree
        ? resolve(window.ZapparThree)
        : reject(new Error('The AR tracking library did not initialize.'));
      script.onerror = () => reject(new Error('The AR tracking library could not be loaded.'));
      document.head.appendChild(script);
    });
    return zapparP;
  };
  const loadPostProcessing = () => (postProcessingP || (postProcessingP = Promise.all([
    import('three/addons/postprocessing/EffectComposer.js'),
    import('three/addons/postprocessing/RenderPass.js'),
    import('three/addons/postprocessing/UnrealBloomPass.js'),
    import('three/addons/postprocessing/OutputPass.js')
  ]).then(([composer, renderPass, bloomPass, outputPass]) => ({
    EffectComposer: composer.EffectComposer,
    RenderPass: renderPass.RenderPass,
    UnrealBloomPass: bloomPass.UnrealBloomPass,
    OutputPass: outputPass.OutputPass
  }))));
  const R = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ---------- shape generators: normalized coords (~[-0.5,0.5]) * size ---------- */
  function lathe(p, i0, n, size, prof, jit) {
    for (let i = i0; i < i0 + n; i++) {
      const t = Math.random(), s = prof(t), th = Math.random() * Math.PI * 2;
      const r = (s[0] + R(-jit, jit)) * size;
      p[i * 3] = Math.cos(th) * r;
      p[i * 3 + 1] = (s[1] + R(-jit, jit) * 0.6) * size;
      p[i * 3 + 2] = Math.sin(th) * r;
    }
  }
  function disc(p, i0, n, size, rad, y, jit) {
    for (let i = i0; i < i0 + n; i++) {
      const r = rad * Math.sqrt(Math.random()) * size, th = Math.random() * Math.PI * 2;
      p[i * 3] = Math.cos(th) * r;
      p[i * 3 + 1] = y * size + R(-jit, jit) * size;
      p[i * 3 + 2] = Math.sin(th) * r;
    }
  }

  const SHAPES = {
    cloud(n, size) {
      const p = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const r = size * (0.55 + Math.pow(Math.random(), 0.6) * 1.15);
        const th = Math.random() * Math.PI * 2, ph = Math.acos(R(-1, 1));
        p[i * 3] = Math.sin(ph) * Math.cos(th) * r * 1.05;
        p[i * 3 + 1] = Math.cos(ph) * r * 0.85;
        p[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * r * 0.7;
      }
      return p;
    },
    envelope(n, size) {
      const p = new Float32Array(n * 3), w = size * 0.60, h = size * 0.40;
      for (let i = 0; i < n; i++) {
        const q = Math.random(); let x, y;
        if (q < 0.34) {                          // border
          const e = Math.random() * 4 | 0, u = R(-1, 1);
          if (e === 0) { x = u * w; y = h; } else if (e === 1) { x = u * w; y = -h; }
          else if (e === 2) { x = -w; y = u * h; } else { x = w; y = u * h; }
        } else if (q < 0.66) {                   // flap (two diagonals + fill)
          const u = Math.random(), side = Math.random() < 0.5 ? -1 : 1;
          const sag = Math.random() * 0.16;
          x = side * w * (1 - u); y = h - u * (h * 0.92) - sag * h;
        } else if (q < 0.80) {                   // lower fold lines
          const u = Math.random(), side = Math.random() < 0.5 ? -1 : 1;
          x = side * w * (1 - u); y = -h + u * h * 0.75;
        } else {                                 // sparse interior
          x = R(-w, w) * 0.96; y = R(-h, h) * 0.9;
        }
        p[i * 3] = x + R(-1, 1) * size * 0.012;
        p[i * 3 + 1] = y + R(-1, 1) * size * 0.012;
        p[i * 3 + 2] = R(-1, 1) * size * 0.03;
      }
      return p;
    },
    heart(n, size) {
      const p = new Float32Array(n * 3), s = size * 0.048;
      for (let i = 0; i < n; i++) {
        const t = Math.random() * Math.PI * 2;
        const rr = 0.68 + 0.32 * Math.pow(Math.random(), 0.55);
        const x = 16 * Math.pow(Math.sin(t), 3);
        const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
        const puff = Math.cos((Math.PI / 2) * rr) * (1 - Math.abs(y) / 22) * 5.2;
        p[i * 3] = x * rr * s;
        p[i * 3 + 1] = (y * rr + 1.2) * s;
        p[i * 3 + 2] = (Math.random() < 0.5 ? -1 : 1) * puff * s * Math.pow(Math.random(), 0.4);
      }
      return p;
    },
    gift(n, size) {
      const p = new Float32Array(n * 3), a = size * 0.30, rib = size * 0.045;
      for (let i = 0; i < n; i++) {
        const q = Math.random(); let x, y, z;
        if (q < 0.18) {                          // bow loops on top
          const side = Math.random() < 0.5 ? -1 : 1, t = Math.random() * Math.PI * 2;
          const rr = a * 0.34 * (0.75 + Math.random() * 0.25);
          x = side * (a * 0.34 + Math.cos(t) * rr * 0.9);
          y = a + Math.abs(Math.sin(t)) * rr * 1.25;
          z = Math.sin(t) * rr * 0.28;
        } else if (q < 0.46) {                   // ribbon bands wrapping the box
          const axis = Math.random() < 0.5;
          const u = R(-1, 1), face = Math.random();
          const band = R(-rib, rib);
          if (face < 0.34) { y = a; x = axis ? band : u * a; z = axis ? u * a : band; }
          else if (face < 0.67) { x = axis ? band : (Math.random() < 0.5 ? -a : a); y = u * a; z = axis ? (Math.random() < 0.5 ? -a : a) : band; if (axis) { const t2 = x; x = t2; } }
          else { y = -a; x = axis ? band : u * a; z = axis ? u * a : band; }
        } else if (q < 0.72) {                   // edges
          const e = Math.random() * 3 | 0, u = R(-1, 1);
          const s1 = Math.random() < 0.5 ? -a : a, s2 = Math.random() < 0.5 ? -a : a;
          if (e === 0) { x = u * a; y = s1; z = s2; } else if (e === 1) { x = s1; y = u * a; z = s2; }
          else { x = s1; y = s2; z = u * a; }
        } else {                                 // faces, sparse
          const f = Math.random() * 3 | 0, s1 = Math.random() < 0.5 ? -a : a;
          const u = R(-1, 1) * a, v = R(-1, 1) * a;
          if (f === 0) { x = u; y = s1; z = v; } else if (f === 1) { x = s1; y = u; z = v; }
          else { x = u; y = v; z = s1; }
        }
        p[i * 3] = x + R(-1, 1) * size * 0.008;
        p[i * 3 + 1] = y + R(-1, 1) * size * 0.008;
        p[i * 3 + 2] = z + R(-1, 1) * size * 0.008;
      }
      return p;
    },
    vase(n, size) {
      const p = new Float32Array(n * 3), nb = n * 0.08 | 0;
      lathe(p, 0, n - nb, size, t => {
        const y = -0.42 + 0.86 * t;
        const r = 0.075 + 0.30 * Math.sin(Math.PI * Math.pow(t, 0.78)) - 0.10 * Math.pow(t, 4);
        return [Math.max(0.055, r), y];
      }, 0.012);
      disc(p, n - nb, nb, size, 0.14, -0.42, 0.006);
      return p;
    },
    glassCup(n, size) {
      const p = new Float32Array(n * 3);
      const nf = n * 0.16 | 0, ns = n * 0.14 | 0, nb = n - nf - ns;
      disc(p, 0, nf, size, 0.20, -0.44, 0.008);                       // foot
      lathe(p, nf, ns, size, t => [0.026, -0.44 + t * 0.36], 0.006);   // stem
      lathe(p, nf + ns, nb, size, t => {                               // bowl
        const u = t;
        return [0.045 + 0.255 * Math.sin(1.42 * Math.pow(u, 0.72)), -0.08 + u * 0.50];
      }, 0.01);
      return p;
    },
    plate(n, size) {
      const p = new Float32Array(n * 3), nr = n * 0.26 | 0;
      for (let i = 0; i < n - nr; i++) {
        const r = 0.44 * Math.sqrt(Math.random()), th = Math.random() * Math.PI * 2;
        p[i * 3] = Math.cos(th) * r * size;
        p[i * 3 + 1] = (-0.05 + 0.30 * r * r) * size + R(-1, 1) * size * 0.006;
        p[i * 3 + 2] = Math.sin(th) * r * size;
      }
      for (let i = n - nr; i < n; i++) {                                // rim lip
        const th = Math.random() * Math.PI * 2, u = Math.random();
        const r = (0.44 + u * 0.06) * size;
        p[i * 3] = Math.cos(th) * r;
        p[i * 3 + 1] = (0.0 + u * 0.06) * size + R(-1, 1) * size * 0.006;
        p[i * 3 + 2] = Math.sin(th) * r;
      }
      return p;
    },
    ornament(n, size) {
      const p = new Float32Array(n * 3), nr = n * 0.10 | 0;
      for (let i = 0; i < n - nr; i++) {
        const th = Math.random() * Math.PI * 2, ph = Math.acos(R(-1, 1));
        const facet = 1 + 0.05 * Math.cos(6 * th) * Math.sin(2 * ph);
        const r = 0.33 * facet * size;
        p[i * 3] = Math.sin(ph) * Math.cos(th) * r;
        p[i * 3 + 1] = Math.cos(ph) * r * 1.06 - 0.03 * size;
        p[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * r;
      }
      for (let i = n - nr; i < n; i++) {                                // neck ring
        const th = Math.random() * Math.PI * 2, r = 0.075 * size;
        p[i * 3] = Math.cos(th) * r;
        p[i * 3 + 1] = 0.34 * size + R(0, 0.07) * size;
        p[i * 3 + 2] = Math.sin(th) * r;
      }
      return p;
    }
  };

  class ParticleStage extends HTMLElement {
    connectedCallback() {
      if (this._boot) return;
      this._boot = true;
      this.style.display = 'block';
      this.style.position = 'absolute';
      this.style.inset = '0';
      const c = document.createElement('canvas');
      c.style.cssText = 'display:block;width:100%;height:100%;touch-action:none';
      this.appendChild(c);
      this._canvas = c;
      this._pointers = new Map();
      this._drag = { active: false, moved: false, lastX: 0, lastY: 0, id: null };
      this._userRot = { y: 0, x: 0 };
      this._camDist = SETTINGS.interaction.cameraDistance.initial;
      this._setupAudio();
      this.addEventListener('pointerdown', e => this._onDown(e));
      this.addEventListener('pointermove', e => this._onMove(e));
      this.addEventListener('pointerup', e => this._onUp(e));
      this.addEventListener('pointercancel', e => this._onUp(e));
      this.addEventListener('wheel', e => { e.preventDefault(); this._zoom(e.deltaY * SETTINGS.interaction.wheelZoomSpeed); }, { passive: false });
      this.ready = loadThree().then(m => this._init(m));
      this.ready.catch(err => console.error('particle-stage', err));
    }

    _init(THREE) {
      this.THREE = THREE;
      const small = Math.min(window.innerWidth, window.innerHeight) < SETTINGS.performance.compactViewportMax;
      const N = this.N = small ? SETTINGS.performance.compactPointCount : SETTINGS.performance.pointCount;
      const g = this.renderer = new THREE.WebGLRenderer({ canvas: this._canvas, antialias: true, alpha: false });
      g.setPixelRatio(Math.min(devicePixelRatio, SETTINGS.performance.maxPixelRatio));
      g.setClearColor(SETTINGS.scene.backgroundColor, 1);
      if (SETTINGS.postProcessing.enabled) {
        g.toneMapping = THREE.ACESFilmicToneMapping;
        g.toneMappingExposure = SETTINGS.postProcessing.exposure;
      }
      const sc = this.scene = new THREE.Scene();
      sc.fog = new THREE.FogExp2(SETTINGS.scene.backgroundColor, SETTINGS.scene.fogDensity);
      const { fov, near, far, distance } = SETTINGS.scene.camera;
      const cam = this.camera = new THREE.PerspectiveCamera(fov, 1, near, far);
      this._regularCamera = cam;
      this._regularFog = sc.fog;
      cam.position.set(0, 0, distance);
      this.worldRoot = new THREE.Group(); sc.add(this.worldRoot);
      this.group = new THREE.Group(); this.worldRoot.add(this.group);

      // buffers
      this.cur = new Float32Array(N * 3);
      this.src = new Float32Array(N * 3);
      this.tgt = new Float32Array(N * 3);
      this.swarm = new Float32Array(N * 3);
      this.seed = new Float32Array(N);
      const sizes = new Float32Array(N), cols = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) { this.seed[i] = Math.random(); sizes[i] = R(SETTINGS.appearance.pointSize.min, SETTINGS.appearance.pointSize.max); }
      const geo = this.geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(this.cur, 3));
      geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
      geo.setAttribute('acolor', new THREE.BufferAttribute(cols, 3));

      const tex = new THREE.CanvasTexture(sprite());
      const mk = (mult, op) => new THREE.ShaderMaterial({
        uniforms: { t: { value: tex }, uSize: { value: 1 }, uMult: { value: mult }, uOp: { value: op }, uPix: { value: 500 } },
        vertexShader: `attribute float size;attribute vec3 acolor;varying vec3 vC;
          uniform float uSize,uMult,uPix;
          void main(){vC=acolor;vec4 mv=modelViewMatrix*vec4(position,1.0);
          gl_PointSize=size*uSize*uMult*(uPix/-mv.z);gl_Position=projectionMatrix*mv;}`,
        fragmentShader: `uniform sampler2D t;uniform float uOp;varying vec3 vC;
          void main(){float a=texture2D(t,gl_PointCoord).a;if(a<0.02)discard;
          gl_FragColor=vec4(vC,a*uOp);}`,
        blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, depthTest: true
      });
      this.matCore = mk(SETTINGS.appearance.core.scale, SETTINGS.appearance.core.opacity);
      this.matHalo = mk(SETTINGS.appearance.halo.scale, SETTINGS.appearance.halo.opacity);
      this.group.add(new THREE.Points(geo, this.matHalo));
      this.group.add(new THREE.Points(geo, this.matCore));

      // ambient dust
      const D = small ? SETTINGS.performance.compactDustCount : SETTINGS.performance.dustCount, dp = new Float32Array(D * 3), ds = new Float32Array(D), dc = new Float32Array(D * 3);
      const dustSettings = SETTINGS.appearance.dust;
      for (let i = 0; i < D; i++) {
        const { spread } = dustSettings;
        dp[i * 3] = R(-spread.x, spread.x);
        dp[i * 3 + 1] = R(-spread.y, spread.y);
        dp[i * 3 + 2] = R(spread.zFar, spread.zNear);
        ds[i] = R(dustSettings.size.min, dustSettings.size.max);
        const l = R(dustSettings.brightness.min, dustSettings.brightness.max);
        dc[i * 3] = l * dustSettings.color.r;
        dc[i * 3 + 1] = l * dustSettings.color.g;
        dc[i * 3 + 2] = l * dustSettings.color.b;
      }
      const dg = new THREE.BufferGeometry();
      dg.setAttribute('position', new THREE.BufferAttribute(dp, 3));
      dg.setAttribute('size', new THREE.BufferAttribute(ds, 1));
      dg.setAttribute('acolor', new THREE.BufferAttribute(dc, 3));
      this.dust = new THREE.Points(dg, mk(SETTINGS.appearance.dust.scale, SETTINGS.appearance.dust.opacity));
      this.worldRoot.add(this.dust);

      // dedicated firework sparks — independent of the persistent cloud, so they never get
      // pulled back into the forming shape; own colors, own physics, short-lived.
      const FW = SETTINGS.fireworks.capacity;
      const fwPos = new Float32Array(FW * 3), fwSize = new Float32Array(FW), fwCol = new Float32Array(FW * 3), fwAlpha = new Float32Array(FW);
      const fwGeo = new THREE.BufferGeometry();
      fwGeo.setAttribute('position', new THREE.BufferAttribute(fwPos, 3));
      fwGeo.setAttribute('size', new THREE.BufferAttribute(fwSize, 1));
      fwGeo.setAttribute('acolor', new THREE.BufferAttribute(fwCol, 3));
      fwGeo.setAttribute('aAlpha', new THREE.BufferAttribute(fwAlpha, 1));
      const fwMat = new THREE.ShaderMaterial({
        uniforms: { t: { value: tex }, uPix: { value: 500 }, uIntensity: { value: SETTINGS.fireworks.glowIntensity } },
        vertexShader: `attribute float size;attribute vec3 acolor;attribute float aAlpha;varying vec3 vC;varying float vA;
          uniform float uPix;
          void main(){vC=acolor;vA=aAlpha;vec4 mv=modelViewMatrix*vec4(position,1.0);
          gl_PointSize=size*(uPix/-mv.z);gl_Position=projectionMatrix*mv;}`,
        fragmentShader: `uniform sampler2D t;uniform float uIntensity;varying vec3 vC;varying float vA;
          void main(){float a=texture2D(t,gl_PointCoord).a;if(a<0.02||vA<=0.0)discard;
          gl_FragColor=vec4(vC*uIntensity,a*vA);}`,
        blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, depthTest: true
      });
      this.fw = { pos: fwPos, size: fwSize, col: fwCol, alpha: fwAlpha, geo: fwGeo, cap: FW, next: 0,
        vel: new Float32Array(FW * 3), life: new Float32Array(FW), maxLife: new Float32Array(FW) };
      this.fwPoints = new THREE.Points(fwGeo, fwMat);
      this.fwPoints.renderOrder = SETTINGS.fireworks.renderOrder;
      this.worldRoot.add(this.fwPoints);

      this.palette = { h: SETTINGS.appearance.palette.startHue, h2: SETTINGS.appearance.palette.endHue };
      this.time = 0; this.morph = null; this.burstAmp = 0; this.spin = SETTINGS.animation.defaultSpin;
      this.drift = SETTINGS.animation.shapeDrift;
      this._resize();
      this._ro = new ResizeObserver(() => this._resize()); this._ro.observe(this);
      this._initPostProcessing();

      // initial state: loose cloud
      const p0 = SHAPES.cloud(N, this.size);
      this.tgt.set(p0); this.cur.set(p0); this.src.set(p0);
      this._colorize();
      this._clock = new THREE.Clock();
      const loop = () => { this._raf = requestAnimationFrame(loop); this._tick(); };
      loop();
      return this;
    }

    disconnectedCallback() {
      cancelAnimationFrame(this._raf);
      this._ro && this._ro.disconnect();
      this.composer && this.composer.dispose();
      this._unlockAudio && document.removeEventListener('pointerdown', this._unlockAudio, true);
      this._twinkle && this._twinkle.pause();
      this._initSound && this._initSound.pause();
      this._arCamera && this._arCamera.stop && this._arCamera.stop();
    }

    _setupAudio() {
      const settings = SETTINGS.audio;
      if (!settings || !settings.enabled) return;
      this._twinkle = new Audio(settings.twinkle.src);
      this._twinkle.preload = 'auto';
      this._twinkle.volume = settings.twinkle.volume;
      this._twinkle.playbackRate = settings.twinkle.playbackRate;
      this._initSound = new Audio(settings.init.src);
      this._initSound.preload = 'auto';
      this._initSound.volume = settings.init.volume;
      this._initSound.playbackRate = settings.init.playbackRate;
      this._unlockAudio = () => {
        this._audioUnlocked = true;
        this._playInitSound();
        const sound = this._twinkle;
        if (!sound) return;
        const volume = sound.volume;
        sound.volume = 0;
        sound.play().then(() => {
          sound.pause();
          sound.currentTime = 0;
          sound.volume = volume;
        }).catch(() => { sound.volume = volume; });
      };
      document.addEventListener('pointerdown', this._unlockAudio, { once: true, capture: true });
    }

    _playTwinkle() {
      if (!this._audioUnlocked || !this._twinkle) return;
      const settings = SETTINGS.audio.twinkle;
      this._twinkle.pause();
      this._twinkle.currentTime = 0;
      this._twinkle.volume = clamp(settings.volume * R(1 - settings.volumeVariance, 1 + settings.volumeVariance), 0, 1);
      this._twinkle.playbackRate = settings.playbackRate * R(1 - settings.playbackRateVariance, 1 + settings.playbackRateVariance);
      this._twinkle.play().catch(() => {});
    }

    playInitSound() {
      if (this._initSoundPlayed) return;
      this._initSoundQueued = true;
      this._playInitSound();
    }

    _playInitSound() {
      if (!this._initSound || !this._initSoundQueued || this._initSoundPlayed) return;
      this._initSound.currentTime = 0;
      this._initSound.play().then(() => {
        this._initSoundPlayed = true;
        this._initSoundQueued = false;
      }).catch(() => {});
    }

    _initPostProcessing() {
      if (!SETTINGS.postProcessing.enabled) return;
      loadPostProcessing().then(({ EffectComposer, RenderPass, UnrealBloomPass, OutputPass }) => {
        if (!this.isConnected || !this.renderer) return;
        const bloom = SETTINGS.postProcessing.bloom;
        const target = SETTINGS.postProcessing.hdr
          ? new this.THREE.WebGLRenderTarget(1, 1, { type: this.THREE.HalfFloatType })
          : undefined;
        this.composer = new EffectComposer(this.renderer, target);
        this.renderPass = new RenderPass(this.scene, this.camera);
        this.composer.addPass(this.renderPass);
        this.bloomPass = new UnrealBloomPass(new this.THREE.Vector2(), bloom.strength, bloom.radius, bloom.threshold);
        this.composer.addPass(this.bloomPass);
        this.composer.addPass(new OutputPass());
        this._resize();
      }).catch(err => console.warn('particle-stage post-processing unavailable', err));
    }

    _onDown(e) {
      this.setPointerCapture(e.pointerId);
      this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this._pointers.size === 1) {
        this._drag = { active: true, moved: false, lastX: e.clientX, lastY: e.clientY, id: e.pointerId };
      } else if (this._pointers.size === 2) {
        this._drag.active = false;
        this._pinchD0 = this._pinchDist();
        this._camDist0 = this._camDist;
      }
    }
    _onMove(e) {
      if (!this._pointers.has(e.pointerId)) return;
      this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this._isAR) {
        const dx = e.clientX - this._drag.lastX, dy = e.clientY - this._drag.lastY;
        if (Math.abs(dx) + Math.abs(dy) > 4) this._drag.moved = true;
        this._drag.lastX = e.clientX; this._drag.lastY = e.clientY;
        return;
      }
      if (this._pointers.size === 2) {
        const d = this._pinchDist();
        if (this._pinchD0) this._camDist = clamp(this._camDist0 * (this._pinchD0 / d), SETTINGS.interaction.cameraDistance.min, SETTINGS.interaction.cameraDistance.max);
        return;
      }
      if (!this._drag.active || e.pointerId !== this._drag.id) return;
      const dx = e.clientX - this._drag.lastX, dy = e.clientY - this._drag.lastY;
      if (Math.abs(dx) + Math.abs(dy) > 4) this._drag.moved = true;
      this._userRot.y += dx * SETTINGS.interaction.orbit.horizontalSpeed;
      this._userRot.x = clamp(this._userRot.x + dy * SETTINGS.interaction.orbit.verticalSpeed, -SETTINGS.interaction.orbit.verticalLimit, SETTINGS.interaction.orbit.verticalLimit);
      this._drag.lastX = e.clientX; this._drag.lastY = e.clientY;
    }
    _onUp(e) {
      this._pointers.delete(e.pointerId);
      if (this.hasPointerCapture(e.pointerId)) this.releasePointerCapture(e.pointerId);
      if (this._pointers.size < 2) this._pinchD0 = null;
      if (e.pointerId === this._drag.id) {
        if (!this._drag.moved) {
          this.dispatchEvent(new CustomEvent('stagetap', { bubbles: true, detail: { x: e.clientX, y: e.clientY } }));
        }
        this._drag.active = false;
      }
    }
    _tickFireworks(dt) {
      const fw = this.fw, g = this.size * SETTINGS.fireworks.gravitySizeMultiplier;
      let any = false;
      for (let idx = 0; idx < fw.cap; idx++) {
        if (fw.life[idx] <= 0) { if (fw.alpha[idx] !== 0) { fw.alpha[idx] = 0; any = true; } continue; }
        any = true;
        const i3 = idx * 3;
        fw.vel[i3 + 1] += g * dt;
        fw.vel[i3] *= (1 - 0.8 * dt); fw.vel[i3 + 1] *= (1 - 0.35 * dt); fw.vel[i3 + 2] *= (1 - 0.8 * dt);
        fw.pos[i3] += fw.vel[i3] * dt;
        fw.pos[i3 + 1] += fw.vel[i3 + 1] * dt;
        fw.pos[i3 + 2] += fw.vel[i3 + 2] * dt;
        fw.life[idx] -= dt;
        fw.alpha[idx] = Math.max(0, fw.life[idx] / fw.maxLife[idx]);
      }
      if (any) {
        fw.geo.attributes.position.needsUpdate = true;
        fw.geo.attributes.aAlpha.needsUpdate = true;
      }
    }
    _pinchDist() {
      const pts = [...this._pointers.values()];
      return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
    }
    _zoom(delta) { this._camDist = clamp(this._camDist + delta, SETTINGS.interaction.cameraDistance.min, SETTINGS.interaction.cameraDistance.max); }

    _resize() {
      if (!this.renderer) return;
      const w = this.clientWidth || window.innerWidth, h = this.clientHeight || window.innerHeight;
      this.renderer.setSize(w, h, false);
      this.composer && this.composer.setSize(w, h);
      if (!this._isAR) {
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
      }
      const { fov, distance } = SETTINGS.scene.camera;
      const vh = 2 * distance * Math.tan((fov / 2) * Math.PI / 180), vw = vh * (w / h);
      this.viewW = vw; this.viewH = vh;
      this.size = Math.min(vw * SETTINGS.scene.shapeWidthFraction, vh * SETTINGS.scene.shapeHeightFraction);
      const pix = h * SETTINGS.scene.pointPixelHeightFraction * (this._isAR ? AR_SETTINGS.pointSizeScale : 1);
      [this.matCore, this.matHalo, this.dust.material].forEach(m => { m.uniforms.uPix.value = pix; });
      if (this.fwPoints) this.fwPoints.material.uniforms.uPix.value = pix;
    }

    _colorize() {
      const c = this.geo.attributes.acolor.array, N = this.N, T = this.THREE, col = new T.Color();
      let ymin = 1e9, ymax = -1e9;
      for (let i = 0; i < N; i++) { const y = this.tgt[i * 3 + 1]; if (y < ymin) ymin = y; if (y > ymax) ymax = y; }
      const span = Math.max(0.001, ymax - ymin);
      for (let i = 0; i < N; i++) {
        const u = (this.tgt[i * 3 + 1] - ymin) / span, s = this.seed[i];
        const white = s > 0.93;
        col.setHSL(this.palette.h + (this.palette.h2 - this.palette.h) * u,
          white ? 0.18 : 0.62 + 0.25 * s,
          white ? 0.92 : 0.48 + 0.28 * u * (0.7 + 0.6 * s));
        col.toArray(c, i * 3);
      }
      this.geo.attributes.acolor.needsUpdate = true;
    }

    /* ---------------- public API ---------------- */
    /** pre-sampled surface point cloud (normalized so max dimension = 1) */
    loadCloud(key, url) {
      if (CLOUDS[key]) return CLOUDS[key];
      const pr = fetch(url).then(r => r.json())
        .then(j => (CLOUDS[key] = { p: Float32Array.from(j.p), ext: j.ext }));
      CLOUDS[key] = pr;
      return pr;
    }

    _cloudPoints(c, N, size, tilt) {
      const p = new Float32Array(N * 3), src = c.p, M = src.length / 3, j = size * 0.0032;
      const ct = Math.cos(tilt || 0), st = Math.sin(tilt || 0);
      for (let i = 0; i < N; i++) {
        const k = (Math.random() * M | 0) * 3;
        const x = src[k] * size + R(-j, j), y = src[k + 1] * size + R(-j, j), z = src[k + 2] * size + R(-j, j);
        p[i * 3] = x;
        p[i * 3 + 1] = y * ct - z * st;
        p[i * 3 + 2] = y * st + z * ct;
      }
      return p;
    }

    setGlow(v) {
      if (!this.matHalo) return;
      this.matHalo.uniforms.uOp.value = SETTINGS.appearance.halo.opacity * v;
      this.matCore.uniforms.uOp.value = SETTINGS.appearance.core.opacity * Math.pow(v, 0.5);
    }
    setPalette(h, h2) { this.palette = { h, h2 }; this._colorize(); }

    /** Preload tracking without requesting camera access. */
    prepareAR() {
      if (!AR_SETTINGS.enabled) return Promise.resolve({ supported: false, reason: 'disabled' });
      return this.ready.then(() => loadZappar(this.THREE)).then(ZapparThree => {
        this._zappar = ZapparThree;
        ZapparThree.glContextSet(this.renderer.getContext());
        return { supported: !ZapparThree.browserIncompatible() };
      });
    }

    /** Called directly from the AR choice so browser permission remains user-initiated. */
    startAR() {
      const ZapparThree = this._zappar;
      if (!ZapparThree) return Promise.reject(new Error('AR is still loading. Please try again.'));
      if (ZapparThree.browserIncompatible()) return Promise.reject(new Error('AR tracking is not supported in this browser.'));
      const permission = ZapparThree.permissionRequest();
      return permission.then(granted => {
        if (!granted) throw new Error('Camera and motion permission are required for AR.');
        if (this._isAR) return this;

        const placement = AR_SETTINGS.placement;
        const camera = this._arCamera = new ZapparThree.Camera({
          zNear: SETTINGS.scene.camera.near,
          zFar: AR_SETTINGS.cameraFar || 100
        });
        const tracker = this._arTracker = new ZapparThree.InstantWorldTracker();
        camera.setPoseModeAnchorOrigin(tracker.anchor);
        this.camera = camera;
        this.renderPass && (this.renderPass.camera = camera);
        this.scene.background = camera.backgroundTexture;
        this.scene.fog = null;
        this.worldRoot.scale.setScalar(AR_SETTINGS.contentScale);
        this._isAR = true;
        this._arPlaced = false;
        tracker.setAnchorPoseFromCameraOffset(placement.x, placement.y, -placement.distance);
        camera.start();
        this._resize();
        return this;
      });
    }

    placeAR() { this._arPlaced = true; }
    beginARPlacement() { if (this._isAR) this._arPlaced = false; }
    isARMode() { return !!this._isAR; }

    /** spec: {shape:'heart'} | {lines:['..','..']} */
    morphTo(spec, dur) {
      if (!this.renderer) { this.ready && this.ready.then(() => this.morphTo(spec, dur)); return; }
      const N = this.N;
      let pts, isText = false;
      if (spec.cloud) {
        const c = CLOUDS[spec.cloud];
        if (!c) pts = SHAPES.cloud(N, this.size);
        else if (typeof c.then === 'function') { c.then(() => this.morphTo(spec, dur)); return; }
        else pts = this._cloudPoints(c, N, this.size * (spec.scale || 1), spec.tiltX || 0);
      }
      else if (spec.lines) { pts = this._textPoints(spec.lines, N, spec.fit || 0.84); isText = true; }
      else pts = (SHAPES[spec.shape] || SHAPES.cloud)(N, this.size * (spec.scale || 1));
      this.src.set(this.cur);
      this.tgt.set(pts);
      const off = this.size * 1.15;
      for (let i = 0; i < N; i++) {
        const i3 = i * 3, s = this.seed[i];
        const mx = (this.src[i3] + this.tgt[i3]) / 2, my = (this.src[i3 + 1] + this.tgt[i3 + 1]) / 2, mz = (this.src[i3 + 2] + this.tgt[i3 + 2]) / 2;
        const a = s * 6.283 * 3, b = Math.acos(2 * ((s * 7.13) % 1) - 1);
        const d = off * (0.45 + ((s * 3.77) % 1) * 0.9);
        this.swarm[i3] = mx + Math.sin(b) * Math.cos(a) * d;
        this.swarm[i3 + 1] = my + Math.cos(b) * d * 0.8;
        this.swarm[i3 + 2] = mz + Math.sin(b) * Math.sin(a) * d * 0.7;
      }
      this.morph = { t: 0, dur: (dur || SETTINGS.animation.defaultMorphDurationMs) / 1000 };
      this._playTwinkle();
      this.isText = isText;
      this.spin = isText ? 0 : (spec.spin != null ? spec.spin : SETTINGS.animation.defaultSpin);
      this.drift = isText ? SETTINGS.animation.textDrift : SETTINGS.animation.shapeDrift;
      this._colorize();
    }

    burst(amp) {
      // one impulse: displace outward once, idle lerp reassembles the form
      if (!this.renderer) return;
      const N = this.N, pos = this.cur, a = (amp || 1) * this.size * SETTINGS.animation.burstSizeMultiplier;
      for (let i = 0; i < N; i++) {
        const i3 = i * 3, s = this.seed[i];
        const th = s * 19.3, ph = Math.acos(2 * ((s * 5.31) % 1) - 1);
        const d = a * (0.5 + ((s * 2.77) % 1));
        pos[i3] += Math.sin(ph) * Math.cos(th) * d;
        pos[i3 + 1] += Math.cos(ph) * d;
        pos[i3 + 2] += Math.sin(ph) * Math.sin(th) * d * 0.6;
      }
      this.geo.attributes.position.needsUpdate = true;
    }

    /** colorful spark burst, spawned well outside the current shape so it never reads as part of it */
    firework(originFrac) {
      if (!this.renderer || !this.fw) return;
      const T = this.THREE, ringR = this.size * R(0.72, 1.0);
      const ang = originFrac && originFrac.ang != null ? originFrac.ang : R(0, Math.PI * 2);
      const ox = Math.cos(ang) * ringR, oy = R(-0.2, 1) * this.size * 0.9 + this.size * 0.15;
      const oz = R(SETTINGS.fireworks.depth.min, SETTINGS.fireworks.depth.max);
      const hue = Math.random();
      const col = new T.Color();
      const fw = this.fw, n = 46 + (Math.random() * 30 | 0);
      for (let k = 0; k < n; k++) {
        const idx = fw.next % fw.cap; fw.next++;
        const i3 = idx * 3;
        const th = Math.random() * Math.PI * 2, ph = Math.acos(R(-1, 1)), sp = R(3.2, 7.5);
        fw.pos[i3] = ox; fw.pos[i3 + 1] = oy; fw.pos[i3 + 2] = oz;
        fw.vel[i3] = Math.sin(ph) * Math.cos(th) * sp;
        fw.vel[i3 + 1] = Math.cos(ph) * sp + 1.2;
        fw.vel[i3 + 2] = Math.sin(ph) * Math.sin(th) * sp * SETTINGS.fireworks.depth.velocityMultiplier;
        fw.life[idx] = fw.maxLife[idx] = R(0.7, 1.15);
        fw.size[idx] = R(0.55, 1.15);
        col.setHSL(hue + R(-0.05, 0.05), 0.85, R(0.6, 0.8));
        col.toArray(fw.col, i3);
        fw.alpha[idx] = 1;
      }
    }

    _textPoints(lines, N, fitFrac) {
      const cv = document.createElement('canvas'), ctx = cv.getContext('2d');
      const F = 190, fam = getComputedStyle(this).getPropertyValue('--particle-font').trim() || '700 190px Heebo, system-ui, sans-serif';
      const font = fam.indexOf('px') > -1 ? fam : `700 ${F}px ${fam}`;
      ctx.font = font;
      let w = 0;
      lines.forEach(l => { w = Math.max(w, ctx.measureText(l).width); });
      const lh = F * 1.22, H = Math.ceil(lh * lines.length) + F * 0.5, W = Math.ceil(w) + F * 0.4;
      cv.width = W; cv.height = H;
      const c2 = cv.getContext('2d');
      c2.font = font; c2.fillStyle = '#fff'; c2.textAlign = 'center'; c2.textBaseline = 'middle';
      c2.direction = 'rtl';
      lines.forEach((l, i) => c2.fillText(l, W / 2, H / 2 + (i - (lines.length - 1) / 2) * lh));
      const d = c2.getImageData(0, 0, W, H).data, hits = [];
      const step = Math.max(1, Math.round(Math.sqrt((W * H) / (N * 5))));
      for (let y = 0; y < H; y += step) for (let x = 0; x < W; x += step) if (d[(y * W + x) * 4 + 3] > 130) hits.push(x, y);
      const p = new Float32Array(N * 3);
      const worldW = this.viewW * fitFrac, sc = worldW / W;
      const n = hits.length / 2 || 1;
      for (let i = 0; i < N; i++) {
        const k = (Math.random() * n | 0) * 2;
        const x = hits.length ? hits[k] + R(-step, step) * 0.5 : W / 2;
        const y = hits.length ? hits[k + 1] + R(-step, step) * 0.5 : H / 2;
        p[i * 3] = (x - W / 2) * sc;
        p[i * 3 + 1] = (H / 2 - y) * sc;
        p[i * 3 + 2] = R(-1, 1) * this.size * 0.035;
      }
      return p;
    }

    _tick() {
      const dt = Math.min(0.05, this._clock.getDelta());
      this.time += dt;
      if (this._isAR && this._arCamera) {
        this._arCamera.updateFrame(this.renderer);
        if (!this._arPlaced && this._arTracker) {
          const placement = AR_SETTINGS.placement;
          this._arTracker.setAnchorPoseFromCameraOffset(placement.x, placement.y, -placement.distance);
        }
      }
      const T = this.time, N = this.N, pos = this.cur;
      if (this.morph) {
        this.morph.t += dt / this.morph.dur;
        const raw = clamp(this.morph.t, 0, 1);
        const t = raw < 0.5 ? 2 * raw * raw : 1 - Math.pow(-2 * raw + 2, 2) / 2;
        const wob = Math.sin(raw * Math.PI);
        for (let i = 0; i < N; i++) {
          const i3 = i * 3, s = this.seed[i], it = 1 - t;
          const q0 = it * it, q1 = 2 * it * t, q2 = t * t;
          let x = this.src[i3] * q0 + this.swarm[i3] * q1 + this.tgt[i3] * q2;
          let y = this.src[i3 + 1] * q0 + this.swarm[i3 + 1] * q1 + this.tgt[i3 + 1] * q2;
          let z = this.src[i3 + 2] * q0 + this.swarm[i3 + 2] * q1 + this.tgt[i3 + 2] * q2;
          const a = wob * this.size * 0.09;
          x += Math.sin(T * 1.7 + s * 31.4) * a;
          y += Math.cos(T * 1.5 + s * 21.7) * a;
          z += Math.sin(T * 1.2 + s * 11.9) * a;
          pos[i3] = x; pos[i3 + 1] = y; pos[i3 + 2] = z;
        }
        if (raw >= 1) {
          this.morph = null;
          this.src.set(this.tgt);
          this._settleT0 = this.time;
        }
      } else {
        const breath = 1 + Math.sin(T * 0.45) * 0.012;
        const dr = this.size * 0.028 * this.drift;
        this._settleT = clamp((T - (this._settleT0 || 0)) / 1.2, 0, 1);
        for (let i = 0; i < N; i++) {
          const i3 = i * 3, s = this.seed[i];
          const tx = this.tgt[i3] * breath + Math.sin(T * 0.62 + s * 28.3) * dr;
          const ty = this.tgt[i3 + 1] * breath + Math.cos(T * 0.51 + s * 19.7) * dr;
          const tz = this.tgt[i3 + 2] * breath + Math.sin(T * 0.44 + s * 12.1) * dr;
          pos[i3] += (tx - pos[i3]) * 0.06;
          pos[i3 + 1] += (ty - pos[i3 + 1]) * 0.06;
          pos[i3 + 2] += (tz - pos[i3 + 2]) * 0.06;
        }
      }
      this.geo.attributes.position.needsUpdate = true;
      if (!this.morph) {
        const dense = 1 + 0.55 * (this._settleT || 0);
        this.matCore.uniforms.uSize.value = dense;
      }
      if (this.fw) this._tickFireworks(dt);
      const gy = this.group.rotation.y;
      this.group.rotation.y = gy + (this.spin ? 0.16 * dt * this.spin : (0 - gy) * 0.05) ;
      this.group.rotation.y += (this._userRot.y - (this._appliedRot || 0)) * 1;
      this._appliedRot = this._userRot.y;
      this.group.rotation.x += (Math.sin(T * 0.22) * 0.06 + this._userRot.x - this.group.rotation.x) * 0.08;
      if (!this._isAR) this.camera.position.z += (this._camDist - this.camera.position.z) * 0.12;
      this.dust.rotation.y += dt * 0.006;
      if (this.composer && (!this._isAR || AR_SETTINGS.postProcessing)) this.composer.render();
      else this.renderer.render(this.scene, this.camera);
    }
  }

  function sprite() {
    const s = 64, cv = document.createElement('canvas');
    cv.width = cv.height = s;
    const c = cv.getContext('2d'), g = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.22, 'rgba(255,255,255,0.75)');
    g.addColorStop(0.55, 'rgba(255,255,255,0.18)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, s, s);
    return cv;
  }

  if (!customElements.get('particle-stage')) customElements.define('particle-stage', ParticleStage);
})();
