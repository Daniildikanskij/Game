export interface CanvasMetrics {
  width: number;
  height: number;
  dpr: number;
  bufferWidth: number;
  bufferHeight: number;
}

export function getCanvasMetrics(width: number, height: number, devicePixelRatio: number, maxDpr = 2): CanvasMetrics {
  const logicalWidth = Math.max(0, width);
  const logicalHeight = Math.max(0, height);
  const upperBound = Number.isFinite(maxDpr) && maxDpr >= 1 ? maxDpr : 2;
  const requestedDpr = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  const dpr = Math.min(requestedDpr, upperBound);

  return {
    width: logicalWidth,
    height: logicalHeight,
    dpr,
    bufferWidth: Math.round(logicalWidth * dpr),
    bufferHeight: Math.round(logicalHeight * dpr),
  };
}

export function applyCanvasMetrics(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D, metrics: CanvasMetrics): void {
  canvas.style.width = `${metrics.width}px`;
  canvas.style.height = `${metrics.height}px`;
  canvas.width = metrics.bufferWidth;
  canvas.height = metrics.bufferHeight;
  context.setTransform(metrics.dpr, 0, 0, metrics.dpr, 0, 0);
}
