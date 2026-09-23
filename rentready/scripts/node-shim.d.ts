/**
 * The few Node APIs scripts/eval.ts uses, typed locally so the repo doesn't need @types/node
 * (not on the approved dependency list). tsx runs the script on real Node.
 */
declare module 'node:fs' {
  export function readFileSync(path: string, encoding: 'utf8'): string;
  export function readdirSync(path: string): string[];
  export function existsSync(path: string): boolean;
}

declare const process: {
  env: Record<string, string | undefined>;
  exitCode: number | undefined;
  cwd(): string;
};
