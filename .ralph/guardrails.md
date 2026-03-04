# Guardrails (Signs)

> Lessons learned from failures. Read before acting.

## Core Signs

### Sign: Read Before Writing

- **Trigger**: Before modifying any file
- **Instruction**: Read the file first
- **Added after**: Core principle

### Sign: Test Before Commit

- **Trigger**: Before committing changes
- **Instruction**: Run required tests and verify outputs
- **Added after**: Core principle

---

## Learned Signs

### Sign: Verify Cloudflare Infrastructure Before Deployment

- **Trigger**: Before running `wrangler deploy` for US-010
- **Instruction**: Verify R2 is enabled in Cloudflare Dashboard first. Run `wrangler r2 bucket list` to check. If you get error code 10042, R2 must be enabled manually through the Dashboard before proceeding.
- **Added after**: Iteration 1 - US-010 blocked by R2 not enabled (Error code 10042: Please enable R2 through the Cloudflare Dashboard)
