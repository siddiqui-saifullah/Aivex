// Matches ANSI escape sequences (colors, cursor moves, spinner redraws)
// eslint-disable-next-line no-control-regex
const ANSI_PATTERN = /\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07]*\x07/g;

/**
 * Turn raw process output into plain lines. Carriage returns (used by
 * spinners/progress bars to redraw a line) keep only the last redraw.
 */
export const toTerminalLines = (chunk: string): string[] =>
  chunk
    .replace(ANSI_PATTERN, "")
    .split("\n")
    .map((line) => {
      const parts = line.split("\r");
      return parts[parts.length - 1];
    });
