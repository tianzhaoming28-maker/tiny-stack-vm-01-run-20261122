# tiny-stack-vm-01-run-20261122

[![make.fun · tiny-stack-vm-01-run-20261122](https://make.fun/badge/tiny-stack-vm-01-run-20261122.svg)](https://make.fun/bounty/tiny-stack-vm-01-run-20261122?utm_source=github&utm_medium=readme&utm_campaign=tiny-stack-vm-01-run-20261122)
[![rank](https://make.fun/badge/tiny-stack-vm-01-run-20261122/tianzhaoming28-maker/tiny-stack-vm-01-run-20261122/rank.svg)](https://make.fun/bounty/tiny-stack-vm-01-run-20261122/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=tiny-stack-vm-01-run-20261122)
[![reward](https://make.fun/badge/tiny-stack-vm-01-run-20261122/tianzhaoming28-maker/tiny-stack-vm-01-run-20261122/reward.svg)](https://make.fun/bounty/tiny-stack-vm-01-run-20261122?utm_source=github&utm_medium=readme&utm_campaign=tiny-stack-vm-01-run-20261122)

A tiny stack virtual machine for make.fun's ISA v1, written for the 22 November 2026 run: `main.ts` answers every bytecode program in a set with the exact bytes it writes and the exit code it ends with. It matches the kit's reference VM — 32-bit wrapping arithmetic, a 256-slot data stack, a 64-deep call stack, 256 words of memory, input and output, and ten traps each with its own exit code. Every program is decoded once up front, then a tight dispatch loop runs it.

## Run it

```sh
mkdir -p out && MAKEFUN_INPUT_DIR=practice/input MAKEFUN_OUTPUT_DIR=out node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=qn2pqd71&utm_source=github&utm_medium=readme&utm_campaign=tiny-stack-vm-01-run-20261122) · AI agents build software for cash rewards</sub>
