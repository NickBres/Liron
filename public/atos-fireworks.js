// Adapted from manthrax/atos src/main.js, commit b3773c0113a16e082664f346e07ced60454b07db.
// https://github.com/manthrax/atos
// Retains its eight-segment trails, shell power, spherical sparks, gravity and drag.
// Uses the card's existing renderer/bloom instead of the demo's standalone scene.
export class Fireworks {
  constructor(stage, { sound = {}, trajectory = {} } = {}) {
    this.stage = stage;
    this.T = stage.THREE;
    this.nodes = [];
    this.running = false;
    this.sound = { audioContext: null };
    this.soundOptions = sound;
    this.trajectory = trajectory;
    this.buffers = [];
    this.capacity = 800;
    this.positions = new Float32Array(this.capacity * 8 * 6);
    this.colors = new Float32Array(this.positions.length);
    this.geometry = new this.T.BufferGeometry();
    this.geometry.setAttribute('position', new this.T.BufferAttribute(this.positions, 3).setUsage(this.T.DynamicDrawUsage));
    this.geometry.setAttribute('color', new this.T.BufferAttribute(this.colors, 3).setUsage(this.T.DynamicDrawUsage));
    this.geometry.setDrawRange(0, 0);
    this.material = new this.T.LineBasicMaterial({
      vertexColors: true, transparent: true, blending: this.T.AdditiveBlending,
      depthWrite: false, fog: false, toneMapped: false
    });
    this.lines = new this.T.LineSegments(this.geometry, this.material);
    this.lines.frustumCulled = false;
    stage.scene.add(this.lines);
    stage.atosFireworks = this;
  }
  async unlockAudio() {
    if (!this.soundOptions.enabled || this.disposed) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const context = this.sound.audioContext ||= new AudioContext();
    await context.resume().catch(() => {});
    if (this.loadingAudio) return;
    this.loadingAudio = true;
    await Promise.all((this.soundOptions.files || []).map(async file => {
      try {
        const response = await fetch(file);
        if (!response.ok) return;
        const buffer = await context.decodeAudioData(await response.arrayBuffer());
        if (!this.disposed) this.buffers.push(buffer);
      } catch { /* A missing sound must not interrupt the animation. */ }
    }));
  }
  boom() {
    const context = this.sound.audioContext;
    if (!this.buffers.length || context?.state !== 'running') return;
    const source = context.createBufferSource(), gain = context.createGain();
    source.buffer = this.buffers[Math.floor(Math.random() * this.buffers.length)];
    const volume = this.soundOptions.volume || { min: 18, max: 30 };
    gain.gain.value = this.random(volume.min, volume.max) / 100;
    source.connect(gain).connect(context.destination);
    source.onended = () => { source.disconnect(); gain.disconnect(); };
    source.start();
  }
  random(a, b) { return a + Math.random() * (b - a); }
  node(position, velocity, life, shell = false, power = 1) {
    return { position, velocity, life, age: 0, shell, power,
      mass: shell ? 1 : this.random(.5, 1), drag: shell ? 1 : this.random(.95, .99),
      color: new this.T.Color().setHSL(Math.random(), 1, .65), trail: [] };
  }
  launch() {
    const power = this.random(.9, 1.4);
    const launchY = this.trajectory.launchY ?? -16;
    const burstY = this.trajectory.burstY || { min: -6, max: 2 };
    const flightTime = this.trajectory.flightTime || { min: .85, max: 1.15 };
    const life = this.random(flightTime.min, flightTime.max);
    const steps = Math.max(1, Math.round(life * 60));
    const targetY = this.random(burstY.min, burstY.max);
    const velocity = new this.T.Vector3().randomDirection();
    velocity.x *= .15; velocity.z *= .15;
    velocity.y = (targetY - launchY + .0098 * steps * (steps - 1) / 2) / steps;
    this.nodes.push(this.node(new this.T.Vector3(this.random(-7, 7), launchY, -12), velocity, life, true, power));
  }
  start() { if (!this.disposed) { this.running = true; this.nextLaunch = 0; } }
  stop(dispose = false) {
    this.running = false;
    this.nodes.length = 0;
    this.geometry.setDrawRange(0, 0);
    if (dispose && !this.disposed) {
      this.disposed = true;
      this.stage.scene.remove(this.lines);
      if (this.stage.atosFireworks === this) this.stage.atosFireworks = null;
      this.geometry.dispose(); this.material.dispose();
      this.sound.audioContext?.close().catch(() => {});
    }
  }
  update(dt) {
    if (!this.running) return;
    // Fixed steps preserve the original 60 Hz physics and trail length on every display.
    this.accumulator = (this.accumulator || 0) + Math.min(dt, .05);
    while (this.accumulator >= 1 / 60) {
      this.accumulator -= 1 / 60;
      this.nextLaunch -= 1 / 60;
      if (this.nextLaunch <= 0) {
        if (this.nodes.length < this.capacity - 60) this.launch();
        this.nextLaunch = this.random(.22, .5);
      }
      const alive = [], sparks = [];
      for (const n of this.nodes) {
        n.age += 1 / 60;
        if (n.age >= n.life) {
          if (n.shell) {
            this.boom();
            for (let i = 0; i < 50; i++) {
              const velocity = new this.T.Vector3().randomDirection().multiplyScalar(.23 * n.power).add(n.velocity);
              sparks.push(this.node(n.position.clone(), velocity, this.random(.8, 1)));
            }
          }
          continue;
        }
        n.trail.push(n.position.clone());
        if (n.trail.length > 8) n.trail.shift();
        n.position.add(n.velocity);
        n.velocity.y -= .0098 * n.mass;
        if (n.position.y < -16) {
          n.position.y = -32 - n.position.y;
          n.velocity.y *= -1;
          n.velocity.multiplyScalar(.5);
        } else n.velocity.multiplyScalar(n.drag);
        alive.push(n);
      }
      this.nodes = alive.concat(sparks).slice(0, this.capacity);
    }
    let offset = 0;
    for (const n of this.nodes) {
      for (let i = 0; i < n.trail.length; i++) {
        const a = n.trail[i], b = n.trail[i + 1] || n.position;
        a.toArray(this.positions, offset); b.toArray(this.positions, offset + 3);
        const brightness = ((i + 1) / n.trail.length) * (1 - n.age / n.life) ** 2 * 3;
        for (let j = 0; j < 2; j++) {
          this.colors[offset + j * 3] = n.color.r * brightness;
          this.colors[offset + j * 3 + 1] = n.color.g * brightness;
          this.colors[offset + j * 3 + 2] = n.color.b * brightness;
        }
        offset += 6;
      }
    }
    this.geometry.setDrawRange(0, offset / 3);
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
  }
}

