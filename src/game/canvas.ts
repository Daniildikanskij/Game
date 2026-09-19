export interface CanvasMetrics {
  width: number;
  height: number;
  dpr: number;
  bufferWidth: number;
  bufferHeight: number;
}

export interface CanvasViewport {
  width: number;
  height: number;
}

export function getCanvasViewport(
  containerWidth: number,
  containerHeight: number,
  fallbackWidth: number,
  fallbackHeight: number,
): CanvasViewport {
  const resolveDimension = (containerDimension: number, fallbackDimension: number) => {
    if (Number.isFinite(containerDimension) && containerDimension > 0) return containerDimension;
    return Number.isFinite(fallbackDimension) && fallbackDimension > 0 ? fallbackDimension : 0;
  };

  return {
    width: resolveDimension(containerWidth, fallbackWidth),
    height: resolveDimension(containerHeight, fallbackHeight),
  };
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
