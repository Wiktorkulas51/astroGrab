export interface GrabOptions {
  /** Enable the integration in dev mode (default: true) */
  enabled?: boolean;
  /** Duration in ms to hold the Alt key before activating targeting mode (default: 500) */
  holdDuration?: number;
  /** Number of context lines around the target line (default: 5) */
  contextLines?: number;
  /** Custom clipboard template */
  template?: string;
  /** Compact prompt by default, or full DOM as a debug fallback */
  payloadMode?: 'compact' | 'full';
  /** Include computed styles that add editing context */
  includeComputedStyles?: boolean;
  /** Include a local DOM excerpt around the chosen element */
  includeDom?: boolean;
  /** Maximum ancestor depth for local DOM excerpts */
  maxDomDepth?: number;
  /** Maximum children per DOM level in local excerpts */
  maxChildren?: number;
  /** Attribute names to omit from prompt payloads */
  ignoreAttributes?: string[];
  /** CSS selectors to ignore during target resolution */
  ignoreSelectors?: string[];
  /** CSS selectors to prefer during target resolution */
  preferSelectors?: string[];
  /** Heuristics that bias target selection */
  targetHeuristics?: {
    preferInteractive?: boolean;
    preferSemantic?: boolean;
    preferTextContent?: boolean;
    ignoreGenericWrappers?: boolean;
  };
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
