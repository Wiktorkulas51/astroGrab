import type { GrabOptions } from '../types.js';

export interface RuntimeGrabOptions extends GrabOptions {
  payloadMode: 'compact' | 'full';
  includeComputedStyles: boolean;
  includeDom: boolean;
  maxDomDepth: number;
  maxChildren: number;
  ignoreAttributes: string[];
  ignoreSelectors: string[];
  preferSelectors: string[];
  targetHeuristics: NonNullable<GrabOptions['targetHeuristics']>;
}

declare global {
  interface Window {
    __ASTRO_GRAB_OPTIONS__?: Partial<GrabOptions>;
  }
}

export function getRuntimeOptions(): RuntimeGrabOptions {
  const options = window.__ASTRO_GRAB_OPTIONS__ ?? {};
  const targetHeuristics = {
    preferInteractive: true,
    preferSemantic: true,
    preferTextContent: true,
    ignoreGenericWrappers: true,
    ...(options.targetHeuristics ?? {}),
  };

  return {
    enabled: options.enabled ?? true,
    holdDuration: options.holdDuration ?? 500,
    contextLines: options.contextLines ?? 5,
    template: options.template,
    payloadMode: options.payloadMode ?? 'compact',
    includeComputedStyles: options.includeComputedStyles ?? false,
    includeDom: options.includeDom ?? false,
    maxDomDepth: options.maxDomDepth ?? 1,
    maxChildren: options.maxChildren ?? 4,
    ignoreAttributes: options.ignoreAttributes ?? [],
    ignoreSelectors: options.ignoreSelectors ?? [],
    preferSelectors: options.preferSelectors ?? [],
    targetHeuristics,
  };
}
