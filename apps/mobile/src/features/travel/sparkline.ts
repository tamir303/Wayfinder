/** Points for an SVG polyline: x spread evenly across the width, the highest value at the top. */
export const sparklinePoints = (values: number[], width: number, height: number): string => {
  if (values.length === 0) return '';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const x = (i: number) => (values.length === 1 ? width / 2 : (i / (values.length - 1)) * width);
  const y = (v: number) => (max === min ? height / 2 : height - ((v - min) / (max - min)) * height);
  return values.map((v, i) => `${round(x(i))},${round(y(v))}`).join(' ');
};

const round = (n: number) => Math.round(n * 10) / 10;
