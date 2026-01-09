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

    // Random seed for consistent jitter per stroke
    this.seed = Math.random();

    // Dynamics settings (can be set from preset)
    this.dynamics = {
      sizeJitter: 0,
      sizePressure: true,
      sizeMinimum: 0,
      opacityJitter: 0,
      opacityPressure: false,
      flowJitter: 0,
      flowPressure: false,
      angleJitter: 0,
      anglePressure: false,
      roundnessJitter: 0,
      roundnessPressure: false,
      scatter: 0,
      scatterBothAxes: false,
      count: 1,
      countJitter: 0
    };
  }

  /**
   * Seeded random number generator for reproducible jitter
   */
  seededRandom() {
    const x = Math.sin(this.seed++) * 10000;
    return x - Math.floor(x);
  }

  /**
   * Get a random value in range [-1, 1]
   */
  randomRange() {
    return (this.seededRandom() - 0.5) * 2;
  }

  /**
   * Apply jitter to a value
   */
  applyJitter(value, jitterPercent, minimum = 0) {
    if (jitterPercent <= 0) return value;
    const jitterAmount = value * (jitterPercent / 100) * this.randomRange();
    return Math.max(minimum, value + jitterAmount);
  }

  /**
   * Apply pressure to a value
   */
  applyPressure(value, pressure, applyPressure, minimum = 0) {
    if (!applyPressure) return value;
    return minimum + (value - minimum) * pressure;
  }

  /**
   * Set dynamics from a brush preset
   */
  setDynamics(dynamics) {
    this.dynamics = { ...this.dynamics, ...dynamics };
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
    this.seed = Math.random();
  }

  /**
   * Calculate dab properties with dynamics applied
   */
  calculateDabProperties(point, baseSize, baseOpacity, baseFlow, baseAngle, baseRoundness) {
    const d = this.dynamics;
    const pressure = point.pressure;

    // Size with pressure and jitter
    let size = baseSize;
    size = this.applyPressure(size, pressure, d.sizePressure, baseSize * (d.sizeMinimum / 100));
    size = this.applyJitter(size, d.sizeJitter, 1);

    // Opacity with pressure and jitter
    let opacity = baseOpacity;
    opacity = this.applyPressure(opacity, pressure, d.opacityPressure, 0);
    opacity = this.applyJitter(opacity, d.opacityJitter, 0);
    opacity = Math.max(0, Math.min(100, opacity));

    // Flow with pressure and jitter
    let flow = baseFlow;
    flow = this.applyPressure(flow, pressure, d.flowPressure, 0);
    flow = this.applyJitter(flow, d.flowJitter, 0);
    flow = Math.max(0, Math.min(100, flow));

    // Angle with direction and jitter
    let angle = baseAngle;
    if (d.anglePressure && point.direction !== undefined) {
      angle = point.direction * (180 / Math.PI);
    }
    if (d.angleJitter > 0) {
      angle += d.angleJitter * this.randomRange();
    }

    // Roundness with pressure and jitter
    let roundness = baseRoundness;
    roundness = this.applyPressure(roundness, pressure, d.roundnessPressure, 0);
    roundness = this.applyJitter(roundness, d.roundnessJitter, 10);
    roundness = Math.max(10, Math.min(100, roundness));

    return { size, opacity, flow, angle, roundness };
  }

  /**
   * Calculate scatter offset for a dab
   */
  calculateScatter(baseSize) {
    const d = this.dynamics;
    if (d.scatter <= 0) return { dx: 0, dy: 0 };

    const scatterAmount = baseSize * (d.scatter / 100);

    let dx = 0;
    let dy = 0;

    if (d.scatterBothAxes) {
      dx = scatterAmount * this.randomRange();
      dy = scatterAmount * this.randomRange();
    } else {
      // Scatter perpendicular to stroke direction only
      dy = scatterAmount * this.randomRange();
    }

    return { dx, dy };
  }

  /**
   * Get the number of dabs to draw (for count jitter)
   */
  getDabCount() {
    const d = this.dynamics;
    let count = d.count;
    if (d.countJitter > 0) {
      const jitter = Math.round(count * (d.countJitter / 100) * this.seededRandom());
      count = Math.max(1, count + jitter);
    }
    return count;
  }

  /**
   * Generate multiple dab positions with scatter
   */
  generateDabPositions(point, baseSize) {
    const count = this.getDabCount();
    const dabs = [];

    for (let i = 0; i < count; i++) {
      const scatter = this.calculateScatter(baseSize);
      dabs.push({
        x: point.x + scatter.dx,
        y: point.y + scatter.dy,
        pressure: point.pressure,
        tiltX: point.tiltX,
        tiltY: point.tiltY
      });
    }

    return dabs;
  }

  /**
   * Process a point and return all dabs to draw
   * This includes scatter and count dynamics
   */
  processPointWithDynamics(point, lastPoint, baseSize, baseOpacity, baseFlow, baseAngle, baseRoundness) {
    // Calculate direction from last point if available
    if (lastPoint) {
      const dx = point.x - lastPoint.x;
      const dy = point.y - lastPoint.y;
      point.direction = Math.atan2(dy, dx);
    }

    // Generate multiple dab positions
    const dabPositions = this.generateDabPositions(point, baseSize);

    // Calculate properties for each dab
    return dabPositions.map(pos => {
      const props = this.calculateDabProperties(
        pos, baseSize, baseOpacity, baseFlow, baseAngle, baseRoundness
      );
      return {
        x: pos.x,
        y: pos.y,
        ...props
      };
    });
  }
}
