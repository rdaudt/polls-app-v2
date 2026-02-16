---
name: poll-reset
description: Reset an active poll by removing all files and folders except Poll init.md (testing only)
user_invocable: true
---

# /poll-reset

Reset a poll for testing purposes by removing all files and folders within the active poll folder, except `Poll init.md`.

## Purpose

This skill is designed for testing workflows. It allows you to quickly reset a poll to a clean state while preserving the `Poll init.md` file so you can re-create the poll from scratch using `/poll-create`.

## Setup

1. Read `polls-config.json` from the repo root.
2. Resolve the active poll folder: `<pollsRoot>/<activePoll>/`
3. Verify that the folder exists.

## Actions

1. **List all contents** in the active poll folder (files and subdirectories).

2. **Delete everything EXCEPT `Poll init.md`**:
   - Delete all `.md` files except `Poll init.md`
   - Delete all `.txt` files
   - Delete all subdirectories (e.g., `outbox/`, `inbox/`, `processed/`, etc.) recursively

3. **Preserve**:
   - `Poll init.md` — always kept so the poll can be re-created

## Output

Confirm to the user:
- Active poll being reset: `<pollsRoot>/<activePoll>/`
- List of items deleted (files and folders)
- Confirmation that `Poll init.md` was preserved
- Message: "Poll has been reset. You can now run `/poll-create` to recreate it."

## Safety Notes

- This skill is **destructive** — it permanently deletes files.
- It only operates on the active poll folder specified in `polls-config.json`.
- It preserves `Poll init.md` so users can recreate the poll using the same initialization data.
- No backup is created — ensure you are testing with data you don't need to keep.
