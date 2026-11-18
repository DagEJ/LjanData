// Spillet har ingen lyd. Sfx er en stille plassholder slik at kall som Sfx.play('…')
// i resten av koden ikke trenger å fjernes. muted = true gjør også sidespillet (fight.js) stille.
const Sfx = {
  play() {},
  unlock() {},
  toggle() { return true; },
  muted: true,
};
