/**
 * Deterministic cinematic gradient for a title — used as a placeholder poster
 * when no artwork is available (empty states, auth collage, missing posters).
 * Same title always yields the same gradient.
 */
const PALETTE: Array<[string, string]> = [
  ['#e8b45e', '#5a2c12'],
  ['#ff7a2f', '#140a08'],
  ['#3f8f88', '#0d1a1c'],
  ['#c3b0ea', '#2a2140'],
  ['#c2465a', '#160a0c'],
  ['#9bd14a', '#3a1240'],
  ['#3a92c8', '#06202e'],
  ['#e05a9a', '#1a1b4a'],
  ['#e8933c', '#301810'],
  ['#4a6f92', '#0a1016'],
  ['#4a9a72', '#0e1a14'],
  ['#c04aa0', '#20103a'],
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function posterGradient(title: string): string {
  const [a, b] = PALETTE[hash(title) % PALETTE.length]!;
  return `linear-gradient(150deg, ${a} 0%, ${b} 92%)`;
}
