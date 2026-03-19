export interface GrabOptions {
  /** Enable the integration in dev mode (default: true) */
  enabled?: boolean;
  /** Duration in ms to hold the Alt key before activating targeting mode (default: 500) */
  holdDuration?: number;
  /** Number of context lines around the target line (default: 5) */
  contextLines?: number;
  /** Custom clipboard template */
  template?: string;
}

export interface SnippetRequest {
  file: string;
  line: number;
}

export interface SnippetResponse {
  file: string;
  snippet: string;
  startLine: number;
  endLine: number;
  targetLine: number;
  language: string;
}
