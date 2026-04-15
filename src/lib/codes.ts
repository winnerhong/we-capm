const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomSegment(length: number) {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

export function generateJoinCode(): string {
  return `${randomSegment(4)}-${randomSegment(4)}`;
}

export function generateTeamCode(): string {
  const words = ["FIRE", "WIND", "STAR", "MOON", "WAVE", "LEAF", "SNOW", "GLOW"];
  const word = words[Math.floor(Math.random() * words.length)];
  return `${word}-${randomSegment(4)}`;
}
