export interface DomAttribute {
  name: string;
  value: string;
}

export interface DomLikeElement {
  tagName: string;
  id: string;
  className: string;
  textContent: string | null;
  parentElement: DomLikeElement | null;
  children: ArrayLike<DomLikeElement>;
  attributes: ArrayLike<DomAttribute>;
  getAttribute(name: string): string | null;
  hasAttribute(name: string): boolean;
  matches?(selector: string): boolean;
  querySelectorAll?(selector: string): ArrayLike<DomLikeElement>;
  getBoundingClientRect?(): DOMRect | DOMRectReadOnly;
  outerHTML?: string;
}

export interface SourceSnippetInfo {
  file: string;
  line: number;
  snippet: string;
  language: string;
}

export interface PromptSourceInfo extends SourceSnippetInfo {
  startLine?: number;
  endLine?: number;
}
