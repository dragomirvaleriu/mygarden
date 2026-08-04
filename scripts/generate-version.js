// Runs as the `prebuild` step (see package.json) — writes public/version.json
// fresh on every build so VersionChecker (components/VersionChecker.tsx) has
// something new to detect. Git commit hash is included for traceability
// (which deploy is a user actually running) on top of the timestamp, which
// remains the real comparison key since it's guaranteed to change even
// across builds of the same commit (e.g. a rebuild with no code changes).
import { writeFileSync } from 'fs';
import { execSync } from 'child_process';

let commit = 'unknown';
try {
  commit = execSync('git rev-parse --short HEAD').toString().trim();
} catch {
  // No git available (e.g. some CI checkouts) — timestamp alone still works.
}

writeFileSync(
  'public/version.json',
  JSON.stringify({ version: Date.now(), commit })
);
