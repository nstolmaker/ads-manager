/**
 * TimingTracker — port from ThryvGuide
 * Wraps async calls and records durations for profiling
 */
export class TimingTracker {
  private timings: Record<string, number> = {};

  async track<T>(label: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    const result = await fn();
    this.timings[label] = Math.round(performance.now() - start);
    return result;
  }

  merge(other: Record<string, number>) {
    Object.assign(this.timings, other);
  }

  getTimings(): Record<string, number> {
    return { ...this.timings };
  }

  log(prefix = '') {
    const entries = Object.entries(this.timings)
      .map(([k, v]) => `${k}=${v}ms`)
      .join(' | ');
    console.log(`[timings] ${prefix}${entries}`);
  }
}
