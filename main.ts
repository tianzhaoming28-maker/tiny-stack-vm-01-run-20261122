// Tiny stack VM, ISA v1 — written fresh for the 22 November 2026 run.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Opcode shapes as "op:pops pushes imm": "18:210" is MUL (pops 2, pushes 1, no immediate).
const SHAPE = new Int8Array(768).fill(-1);
for (const e of '0:000,1:011,2:014,3:100,4:120,5:220,6:230,7:330,16:210,17:210,18:210,19:210,20:210,21:210,22:210,23:110,24:210,25:210,26:210,27:110,28:210,29:210,30:210,32:210,33:210,34:210,48:002,49:102,50:102,51:002,52:000,64:110,65:200,80:100,81:100,82:010,83:100'.split(',')) { const [o, s] = e.split(':'); SHAPE[o * 3] = +s[0]; SHAPE[o * 3 + 1] = +s[1]; SHAPE[o * 3 + 2] = +s[2]; }
const NO_OP = 0x100, NO_IMM = 0x101; // trap markers
function decode(bytes) {
  const n = bytes.length, ops = new Int16Array(n), args = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    const b = bytes[i], pops = SHAPE[b * 3], imm = SHAPE[b * 3 + 2];
    if (pops < 0) { ops[i] = NO_OP; continue; }
    if (i + 1 + imm > n) { ops[i] = NO_IMM; continue; }
    ops[i] = b;
    if (b === 0x01) args[i] = (bytes[i + 1] << 24) >> 24;
    else if (b === 0x02) args[i] = bytes[i + 1] | (bytes[i + 2] << 8) | (bytes[i + 3] << 16) | (bytes[i + 4] << 24);
    else if (b >= 0x30 && b <= 0x32) args[i] = ((bytes[i + 1] | (bytes[i + 2] << 8)) << 16) >> 16;
    else if (b === 0x33) args[i] = bytes[i + 1] | (bytes[i + 2] << 8);
  }
  return { ops, args };
}
function execute(program, input) {
  const { ops, args } = decode(program);
  const n = program.length;
  const stack = new Int32Array(256);
  const calls = new Int32Array(64);
  const memory = new Int32Array(256);
  const out = new Uint8Array(65536);
  let sp = 0, cp = 0, pc = 0, steps = 0, ip = 0, olen = 0;
  const done = (code) => ({ out: out.slice(0, olen), code });
  for (;;) {
    if (steps === 1000000) return done(10);
    if (pc < 0 || pc >= n) return done(9);
    const op = ops[pc];
    if (op === NO_OP) return done(5);
    if (op === NO_IMM) return done(9);
    steps++;
    const pops = SHAPE[op * 3], pushes = SHAPE[op * 3 + 1];
    if (sp < pops) return done(2);
    if (sp - pops + pushes > 256) return done(3);
    const here = pc;
    pc = pc + 1 + SHAPE[op * 3 + 2];
    if (op >= 0x10 && op <= 0x22 && op !== 0x17 && op !== 0x1b) {
      const b = stack[sp - 1], a = stack[sp - 2];
      let r;
      if (op === 0x10) r = (a + b) | 0;
      else if (op === 0x11) r = (a - b) | 0;
      else if (op === 0x12) r = Math.imul(a, b);
      else if (op >= 0x13 && op <= 0x16) {
        if (!b) return done(4);
        if (op === 0x13) r = a === -2147483648 && b === -1 ? a : (a / b) | 0;
        else if (op === 0x14) r = b === -1 ? 0 : (a % b) | 0;
        else if (op === 0x15) r = Math.floor((a >>> 0) / (b >>> 0)) | 0;
        else r = ((a >>> 0) % (b >>> 0)) | 0;
      }
      else if (op === 0x18) r = a & b;
      else if (op === 0x19) r = a | b;
      else if (op === 0x1a) r = a ^ b;
      else if (op === 0x1c) r = a << (b & 31);
      else if (op === 0x1d) r = a >> (b & 31);
      else if (op === 0x1e) r = (a >>> (b & 31)) | 0;
      else if (op === 0x20) r = a === b ? 1 : 0;
      else if (op === 0x21) r = a < b ? 1 : 0;
      else r = (a >>> 0) < (b >>> 0) ? 1 : 0;
      sp -= 2;
      stack[sp++] = r;
      continue;
    }
    switch (op) {
      case 0x00: return done(0);
      case 0x01: case 0x02: stack[sp++] = args[here]; break;
      case 0x03: sp--; break;
      case 0x04: stack[sp] = stack[sp - 1]; sp++; break;
      case 0x05: { const t = stack[sp - 1]; stack[sp - 1] = stack[sp - 2]; stack[sp - 2] = t; break; }
      case 0x06: stack[sp] = stack[sp - 2]; sp++; break;
      case 0x07: { const a = stack[sp - 3]; stack[sp - 3] = stack[sp - 2]; stack[sp - 2] = stack[sp - 1]; stack[sp - 1] = a; break; }
      case 0x17: stack[sp - 1] = (-stack[sp - 1]) | 0; break;
      case 0x1b: stack[sp - 1] = ~stack[sp - 1]; break;
      case 0x30: pc += args[here]; break;
      case 0x31: { const v = stack[--sp]; if (v === 0) pc += args[here]; break; }
      case 0x32: { const v = stack[--sp]; if (v !== 0) pc += args[here]; break; }
      case 0x33: if (cp === 64) return done(7); calls[cp++] = pc; pc = args[here]; break;
      case 0x34: if (cp === 0) return done(8); pc = calls[--cp]; break;
      case 0x40: { const a = stack[sp - 1]; if (a < 0 || a >= 256) return done(6); stack[sp - 1] = memory[a]; break; }
      case 0x41: { const a = stack[sp - 1], v = stack[sp - 2]; if (a < 0 || a >= 256) return done(6); sp -= 2; memory[a] = v; break; }
      case 0x50: { const s = String(stack[sp - 1]); if (olen + s.length > 65536) return done(11); sp--; for (let i = 0; i < s.length; i++) out[olen++] = s.charCodeAt(i); break; }
      case 0x51: if (olen + 1 > 65536) return done(11); out[olen++] = stack[--sp] & 255; break;
      case 0x52: stack[sp++] = ip < input.length ? input[ip++] : -1; break;
      case 0x53: return done(stack[--sp] & 255);
    }
  }
}
const inDir = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
for (const id of readdirSync(inDir).sort()) {
  const r = execute(new Uint8Array(readFileSync(join(inDir, id, 'program.bin'))), new Uint8Array(readFileSync(join(inDir, id, 'input.bin'))));
  mkdirSync(join(outDir, id), { recursive: true });
  writeFileSync(join(outDir, id, 'stdout.bin'), r.out);
  writeFileSync(join(outDir, id, 'exit.txt'), `${r.code}\n`);
}
