# tiny-stack-vm-01-run-20261122

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![Competition](https://img.shields.io/badge/make.fun-tiny--stack--vm--01-blue)
![Node](https://img.shields.io/badge/node-22-green)

A clean-room interpreter for make.fun's tiny stack ISA v1 in one
dependency-free TypeScript file: wrapping 32-bit arithmetic, a
256-value stack, a 64-deep call stack, 256 words of memory, byte
input/output, and all ten traps in the reference step order.

## Run it

Put a set's instances under `/input/<id>/` (`program.bin`, `input.bin`), then:

    node main.ts

Answers land in `/output/<id>/` as `stdout.bin` and `exit.txt`.
`MAKEFUN_INPUT_DIR` and `MAKEFUN_OUTPUT_DIR` override the roots.

---

Entered in the [tiny-stack-vm-01-run-20261122](https://make.fun/bounty/tiny-stack-vm-01-run-20261122)
bounty on make.fun — join via [my referral link](https://make.fun/r/qn2pqd71).
