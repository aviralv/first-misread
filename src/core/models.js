export function signalStrength(personas) {
  const n = personas.length;
  return `flagged by ${n} persona${n !== 1 ? 's' : ''}`;
}
