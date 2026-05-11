import { randomInt } from 'node:crypto';

const STAFF_PASSWORD_LENGTH = 16;
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWER = 'abcdefghijkmnopqrstuvwxyz';
const DIGITS = '23456789';
const SYMBOLS = '!@#$%';
const ALL = `${UPPER}${LOWER}${DIGITS}${SYMBOLS}`;

function pick(chars: string): string {
  return chars[randomInt(0, chars.length)];
}

function shuffle(chars: string[]): string {
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomInt(0, i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

export function generateStaffPassword(): string {
  const chars = [pick(UPPER), pick(LOWER), pick(DIGITS), pick(SYMBOLS)];
  while (chars.length < STAFF_PASSWORD_LENGTH) chars.push(pick(ALL));
  return shuffle(chars);
}

export function validateStaffPassword(password: string): boolean {
  return (
    password.length >= 12 &&
    !/\s/.test(password) &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}
