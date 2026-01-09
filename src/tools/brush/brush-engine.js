/**
 * Brush Engine - Handles pressure sensitivity, interpolation, and brush dynamics
 */

export class BrushEngine {
  constructor() {
    // Pressure curve: gamma < 1 = soft response, > 1 = firm response
    this.pressureGamma = 1.0;

    // Minimum spacing between dabs (as fraction of brush size)
    this.spacing = 0.25;

    // Smoothing factor for stroke (0 = no smoothing, 1 = max smoothing)
    this.smoothing = 0.5;

    // Accumulated distance for spacing calculation
    this.accumulatedDistance = 0;
  }

  /**
   * Apply pressure curve to raw pressure value
   */
  applyPressureCurve(pressure) {
    // Clamp pressure to valid range
    pressure = Math.max(0, Math.min(1, pressure || 0.5));

    // Apply gamma curve
    return Math.pow(pressure, this.pressureGamma);
  }

  /**
   * Process a pointer event into a brush point
   */
  processPoint(event) {
    return {
      x: event.x,
      y: event.y,
      pressure: this.applyPressureCurve(event.pressure),
      tiltX: event.tiltX || 0,
      tiltY: event.tiltY || 0,
      timestamp: event.timestamp || Date.now()
    };
  }

  /**
   * Interpolate points between two positions for smooth strokes
   * Uses quadratic Bezier curves
   */
  interpolate(p1, p2, brushSize = 20) {
    if (!p1 || !p2) return [p2];

    const points = [];
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Calculate spacing in pixels
    const spacingPx = Math.max(1, brushSize * this.spacing);

    // If points are very close, just return the end point
    if (distance < spacingPx) {
      return [p2];
    }

    // Calculate how many points we need
    const steps = Math.ceil(distance / spacingPx);

    for (let i = 1; i <= steps; i++) {
      const t = i / steps;

      // Linear interpolation for position
      const x = p1.x + dx * t;
      const y = p1.y + dy * t;

      // Linear interpolation for pressure
      const pressure = p1.pressure + (p2.pressure - p1.pressure) * t;

      // Linear interpolation for tilt
      const tiltX = p1.tiltX + (p2.tiltX - p1.tiltX) * t;
      const tiltY = p1.tiltY + (p2.tiltY - p1.tiltY) * t;

      points.push({
        x,
        y,
        pressure,
        tiltX,
        tiltY,
        timestamp: p1.timestamp + (p2.timestamp - p1.timestamp) * t
      });
    }

    return points;
  }

  /**
   * Catmull-Rom spline interpolation for smoother curves
   * Takes 4 points: p0 (previous), p1 (start), p2 (end), p3 (next)
   */
  catmullRomInterpolate(p0, p1, p2, p3, brushSize = 20) {
    if (!p1 || !p2) return [];

    // Use simpler linear interpolation if we don't have enough points
    if (!p0 || !p3) {
      return this.interpolate(p1, p2, brushSize);
    }

    const points = [];
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    const spacingPx = Math.max(1, brushSize * this.spacing);
    const steps = Math.ceil(distance / spacingPx);

    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const t2 = t * t;
      const t3 = t2 * t;

      // Catmull-Rom coefficients
      const c0 = -0.5 * t3 + t2 - 0.5 * t;
      const c1 = 1.5 * t3 - 2.5 * t2 + 1;
      const c2 = -1.5 * t3 + 2 * t2 + 0.5 * t;
      const c3 = 0.5 * t3 - 0.5 * t2;

      const x = c0 * p0.x + c1 * p1.x + c2 * p2.x + c3 * p3.x;
      const y = c0 * p0.y + c1 * p1.y + c2 * p2.y + c3 * p3.y;

      // Linear interpolation for pressure (spline can cause overshoots)
      const pressure = p1.pressure + (p2.pressure - p1.pressure) * t;

      points.push({
        x,
        y,
        pressure,
        tiltX: p1.tiltX + (p2.tiltX - p1.tiltX) * t,
        tiltY: p1.tiltY + (p2.tiltY - p1.tiltY) * t
      });
    }

    return points;
  }

  /**
   * Calculate brush tip angle from tilt values
   */
  calculateTiltAngle(tiltX, tiltY) {
    return Math.atan2(tiltY, tiltX);
  }

  /**
   * Calculate brush tip pressure from tilt (for rotation-sensitive tips)
   */
  calculateTiltPressure(tiltX, tiltY) {
    const tiltMagnitude = Math.sqrt(tiltX * tiltX + tiltY * tiltY);
    return Math.min(1, tiltMagnitude / 90);
  }

  /**
   * Set pressure curve gamma
   */
  setPressureCurve(gamma) {
    this.pressureGamma = Math.max(0.1, Math.min(3, gamma));
  }

  /**
   * Set brush spacing
   */
  setSpacing(spacing) {
    this.spacing = Math.max(0.01, Math.min(2, spacing));
  }

  /**
   * Set smoothing amount
   */
  setSmoothing(smoothing) {
    this.smoothing = Math.max(0, Math.min(1, smoothing));
  }

  /**
   * Reset accumulated distance (call at start of each stroke)
   */
  resetStroke() {
    this.accumulatedDistance = 0;
  }
}
