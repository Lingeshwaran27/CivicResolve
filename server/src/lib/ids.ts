import { createHash, randomInt, randomUUID } from 'node:crypto';

// Unambiguous alphabet (no 0/O, 1/I/L) so codes are easy to read aloud or type.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function newIssueId(): string {
  return randomUUID();
}

export function newTrackingCode(): string {
  let code = 'CR-';
  for (let i = 0; i < 6; i += 1) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return code;
}

export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}
