/*
 * Central project configuration.
 *
 * Keep project-wide knobs here so visual tuning does not require hunting through
 * component code. This file is loaded before the card and can also be extended
 * with non-particle settings as the project grows.
 */
window.projectSettings = {
  ar: {
    enabled: true,
    // Zappar works on localhost for development. A self-hosted production domain
    // must be registered with an active ZapWorks Universal AR subscription.
    sdkUrl: 'https://libs.zappar.com/zappar-threejs/4.3.0/zappar-threejs.js',
    cameraFar: 100,
    contentScale: 0.11,
    pointSizeScale: 0.12,
    // The preview follows this point until the user taps to place it.
    placement: { x: 0, y: 0, distance: 2.0 },
    // Sprite halos still glow in AR. Full-screen bloom stays off so bright areas
    // in the real camera image do not bloom with the particles.
    postProcessing: false
  },
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
    modePicker: {
      eyebrow: 'מתנה קטנה בשבילך',
      title: 'איך תרצי לפתוח את הקסם?',
      arTitle: 'בתוך החדר',
      arSubtitle: 'מציאות רבודה',
      regularTitle: 'על המסך',
      regularSubtitle: 'החוויה המקורית',
      arLoading: 'מכינה את המצלמה…',
      arPlace: 'כווני למקום שבו תרצי שהקסם יופיע',
      arPlaceAction: 'נגיעה להצבה ולהתחלה',
      reposition: 'מיקום מחדש'
    },
    // Temporary testing shortcut: bypass both video clues and their answer prompts.
    skipClueGate: false
  }
};
