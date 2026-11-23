// Tiny stack VM for make.fun's tiny stack ISA v1: wrapping 32-bit
// integers, a 256-value stack, a 64-deep call stack, 256 words of
// memory, byte input/output, ten traps. runProgram() follows the
// ISA's step order (step limit, pc, opcode, immediate, stack,
// traps, effect). Output before a trap is kept.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Values each opcode pops, by opcode byte; unlisted pop 0.
const POPN = { 3: 1, 4: 1, 5: 2, 6: 2, 7: 3, 16: 2, 17: 2, 18: 2, 19: 2, 20: 2, 21: 2, 22: 2, 23: 1, 24: 2, 25: 2, 26: 2, 27: 1, 28: 2, 29: 2, 30: 2, 32: 2, 33: 2, 34: 2, 49: 1, 50: 1, 64: 1, 65: 2, 80: 1, 81: 1, 83: 1 };

const BIN = {
  16: (a, b) => (a + b) | 0, 17: (a, b) => (a - b) | 0, 18: (a, b) => Math.imul(a, b),
  24: (a, b) => a & b, 25: (a, b) => a | b, 26: (a, b) => a ^ b,
  32: (a, b) => (a === b ? 1 : 0), 33: (a, b) => (a < b ? 1 : 0),
  34: (a, b) => ((a >>> 0) < (b >>> 0) ? 1 : 0),
};

function runProgram(prog: Uint8Array, input: Uint8Array) {
  const st: number[] = [];
  const cs: number[] = [];
  const mem = new Int32Array(256);
  const out = new Uint8Array(65_536);
  let outLen = 0, pc = 0, steps = 0, readAt = 0;
  const done = (code: number) => ({ bytes: out.subarray(0, outLen), code });
  const pop = (): number => st.pop() as number;

  for (;;) {
    if (steps >= 1_000_000) return done(10);
    if (pc < 0 || pc >= prog.length) return done(9);
    const op = prog[pc];
    const imm = op === 1 ? 1 : op === 2 ? 4 : op >= 0x30 && op <= 0x33 ? 2 : 0;
    if (imm > 0 && pc + imm >= prog.length) return done(9);
    steps++;
    pc += 1 + imm;
    const at = pc - imm;
    if (st.length < (POPN[op] ?? 0)) return done(2);
    if ((op === 1 || op === 2 || op === 4 || op === 6 || op === 0x52) && st.length >= 256) return done(3);

    switch (op) {
      case 0x00: return done(0); // HALT
      case 0x01: { // PUSH8, sign-extended
        const b = prog[at];
        st.push(b > 127 ? b - 256 : b);
        break;
      }
      case 0x02: // PUSH32, little-endian
        st.push(prog[at] | (prog[at + 1] << 8) | (prog[at + 2] << 16) | (prog[at + 3] << 24));
        break;
      case 0x03: st.pop(); break; // POP
      case 0x04: st.push(st[st.length - 1]); break; // DUP
      case 0x05: { // SWAP
        const t = st[st.length - 1];
        st[st.length - 1] = st[st.length - 2];
        st[st.length - 2] = t;
        break;
      }
      case 0x06: st.push(st[st.length - 2]); break; // OVER
      case 0x07: { // ROT: ( a b c -- b c a )
        const c = pop();
        const b = pop();
        const a = pop();
        st.push(b, c, a);
        break;
      }
      case 0x10: case 0x11: case 0x12: case 0x18: case 0x19: case 0x1a:
      case 0x20: case 0x21: case 0x22: {
        const b = pop();
        const a = pop();
        st.push(BIN[op](a, b));
        break;
      }
      case 0x13: case 0x14: case 0x15: case 0x16: { // DIV MOD DIVU MODU
        const b = pop();
        const a = pop();
        if (op <= 0x14) {
          if (b === 0) return done(4);
          st.push(op === 0x13 ? ((a - (a % b)) / b) | 0 : (a % b) | 0);
        } else {
          const ua = a >>> 0;
          const ub = b >>> 0;
          if (ub === 0) return done(4);
          st.push(op === 0x15 ? ((ua - (ua % ub)) / ub) | 0 : (ua % ub) | 0);
        }
        break;
      }
      case 0x17: case 0x1b: { // NEG, NOT
        const a = pop();
        st.push(op === 0x17 ? (-a) | 0 : ~a);
        break;
      }
      case 0x1c: case 0x1d: case 0x1e: { // SHL SHR SHRU
        const b = pop();
        const a = pop();
        st.push(op === 0x1c ? a << b : op === 0x1d ? a >> b : (a >>> b) | 0);
        break;
      }
      case 0x30: case 0x31: case 0x32: { // JMP, JZ, JNZ
        const raw = prog[at] | (prog[at + 1] << 8);
        const offset = (raw << 16) >> 16;
        let take = op === 0x30;
        if (!take) take = op === 0x31 ? pop() === 0 : pop() !== 0;
        if (take) pc += offset;
        break;
      }
      case 0x33: { // CALL
        if (cs.length >= 64) return done(7);
        cs.push(pc);
        pc = prog[at] | (prog[at + 1] << 8);
        break;
      }
      case 0x34: // RET
        if (cs.length === 0) return done(8);
        pc = cs.pop() as number;
        break;
      case 0x40: { // LOAD
        const addr = pop();
        if (addr < 0 || addr > 255) return done(6);
        st.push(mem[addr]);
        break;
      }
      case 0x41: { // STORE: ( v addr -- )
        const addr = pop();
        const v = pop();
        if (addr < 0 || addr > 255) return done(6);
        mem[addr] = v;
        break;
      }
      case 0x50: { // PRINT
        const text = String(pop());
        if (outLen + text.length > 65_536) return done(11);
        for (let i = 0; i < text.length; i++) out[outLen++] = text.charCodeAt(i);
        break;
      }
      case 0x51: // PUTC: the value's low byte
        if (outLen + 1 > 65_536) return done(11);
        out[outLen++] = pop() & 255;
        break;
      case 0x52: // IN
        st.push(readAt < input.length ? input[readAt++] : -1);
        break;
      case 0x53: return done(pop() & 255); // EXIT: the low byte
      default: return done(5); // a byte no opcode names
    }
  }
}

// Driver: answer every instance directory under the input root.
const IN_ROOT = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const OUT_ROOT = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
for (const d of readdirSync(IN_ROOT, { withFileTypes: true })) {
  if (!d.isDirectory()) continue;
  const dir = join(IN_ROOT, d.name);
  const progPath = join(dir, 'program.bin');
  if (!existsSync(progPath)) continue;
  const inPath = join(dir, 'input.bin');
  const input = existsSync(inPath) ? readFileSync(inPath) : new Uint8Array(0);
  const r = runProgram(readFileSync(progPath), input);
  const outDir = join(OUT_ROOT, d.name);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'stdout.bin'), r.bytes);
  writeFileSync(join(outDir, 'exit.txt'), String(r.code));
}
