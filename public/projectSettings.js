/*
 * Central project configuration.
 *
 * Keep project-wide knobs here so visual tuning does not require hunting through
 * component code. This file is loaded before the card and can also be extended
 * with non-particle settings as the project grows.
 */
window.projectSettings = {
  particles: {
    performance: {
      compactViewportMax: 520,
      compactPointCount: 5000,
      pointCount: 7200,
      compactDustCount: 3000,
      dustCount: 900,
      maxPixelRatio: 2
    },
    scene: {
      backgroundColor: 0x000000,
      fogDensity: 0.018,
      camera: { fov: 58, near: 0.1, far: 400, distance: 26 },
      shapeWidthFraction: 0.78,
      shapeHeightFraction: 0.42,
      pointPixelHeightFraction: 0.2
    },
    postProcessing: {
      enabled: true,
      hdr: true,
      exposure: 1.05,
      bloom: { strength: 0.75, radius: 0.38, threshold: 0.7 }
    },
    appearance: {
      pointSize: { min: 0.2, max: 0.6 },
      core: { scale: 1.0, opacity: 1 },
      halo: { scale: 3.4, opacity: 0.5 },
      dust: {
        scale: 1.0,
        opacity: 0.72,
        size: { min: 0.65, max: 1.8 },
        brightness: { min: 0.55, max: 1.0 },
        color: { r: 0.9, g: 0.95, b: 1.0 },
        spread: { x: 38, y: 28, zFar: -55, zNear: -15 }
      },
      palette: { startHue: 0.095, endHue: 0.135 }
    },
    interaction: {
      cameraDistance: { initial: 26, min: 12, max: 46 },
      wheelZoomSpeed: 0.02,
      orbit: { horizontalSpeed: 0.0055, verticalSpeed: 0.0035, verticalLimit: 0.6 }
    },
    animation: {
      defaultMorphDurationMs: 2200,
      defaultSpin: 0.9,
      textDrift: 0.2,
      shapeDrift: .7,
      burstSizeMultiplier: 0.5
    },
    audio: {
      enabled: true,
      init: { src: './audio/init-sound.mp3', volume: 0.5, playbackRate: 1 },
      twinkle: {
        src: './audio/twinkle.mp3',
        volume: 0.55,
        volumeVariance: 0.12,
        playbackRate: 1,
        playbackRateVariance: 0.18
      },
      fireworks: {
        enabled: true,
        // The fireworks library chooses randomly from this list on each explosion.
        files: [
          './audio/firework-explosion-1.mp3',
          './audio/firework-explosion-2.mp3',
          './audio/firework-explosion-3.mp3',
          './audio/firework-explosion-4.mp3',
          './audio/firework-explosion-5.mp3',
          './audio/firework-explosion-6.mp3',
          './audio/firework-explosion-7.mp3',
          './audio/firework-explosion-8.mp3'
        ],
        volume: { min: 18, max: 30 }
      }
    },
    fireworks: {
      capacity: 900,
      glowIntensity: 2.4,
      gravitySizeMultiplier: -0.045,
      // Negative Z is farther from the camera. Keep sparks behind the main form.
      depth: { min: -12, max: -9, velocityMultiplier: 0.3 },
      renderOrder: -1
    }
  },
  experience: {
    // Temporary testing shortcut: bypass both video clues and their answer prompts.
    skipClueGate: true
  }
};
