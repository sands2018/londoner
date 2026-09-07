export function fitSicBoViewport(width: number, height: number, desktop: boolean) {
  const rotated = !desktop && height > width;
  const w = rotated ? height : width, h = rotated ? width : height;
  const scale = Math.min(1, w / (desktop ? 1000 : 720), h / (desktop ? 620 : 360));
  return { rotated, scale, width: w / scale, height: h / scale };
}
