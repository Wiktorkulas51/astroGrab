import { copyToClipboard } from './client/clipboard.js';
import { extractPromptPayload } from './client/payload-extractor.js';
import { formatGrabPrompt } from './client/payload-formatter.js';
import { getRuntimeOptions } from './client/runtime-config.js';
import { findSourceAnchor, moveTargetByDepth, resolveTargetFromPoint } from './client/target-resolver.js';

(function () {
  if (typeof window === 'undefined') return;
  const state = window as Window & { __astro_grab_initialized?: boolean };
  if (state.__astro_grab_initialized) return;
  state.__astro_grab_initialized = true;

  const runtime = getRuntimeOptions();
  let active = false;
  let currentTarget: HTMLElement | null = null;
  let overlay: HTMLDivElement | null = null;

  function createOverlay() {
    const existing = document.getElementById('astro-grab-overlay');
    if (existing) {
      overlay = existing as HTMLDivElement;
      return;
    }

    overlay = document.createElement('div');
    overlay.id = 'astro-grab-overlay';
    Object.assign(overlay.style, {
      position: 'fixed',
      pointerEvents: 'none',
      zIndex: '2147483647',
      border: '2px solid #3b82f6',
      backgroundColor: 'rgba(59, 130, 246, 0.15)',
      transition: 'top 0.15s cubic-bezier(0.19, 1, 0.22, 1), left 0.15s cubic-bezier(0.19, 1, 0.22, 1), width 0.15s cubic-bezier(0.19, 1, 0.22, 1), height 0.15s cubic-bezier(0.19, 1, 0.22, 1), opacity 0.1s ease',
      display: 'none',
      borderRadius: '4px',
      boxShadow: '0 0 15px rgba(59, 130, 246, 0.6)',
      opacity: '0',
    });

    const label = document.createElement('div');
    label.id = 'astro-grab-label';
    Object.assign(label.style, {
      position: 'absolute',
      bottom: '100%',
      left: '0',
      backgroundColor: '#3b82f6',
      color: 'white',
      padding: '4px 10px',
      fontSize: '11px',
      fontWeight: 'bold',
      fontFamily: 'monospace',
      whiteSpace: 'nowrap',
      borderRadius: '4px 4px 0 0',
      marginBottom: '-2px',
    });

    overlay.appendChild(label);
    document.body.appendChild(overlay);
  }

  function updateOverlayPosition() {
    if (!overlay || !currentTarget || !active) return hideOverlay();
    const rect = currentTarget.getBoundingClientRect();
    const label = overlay.querySelector('#astro-grab-label') as HTMLElement | null;
    if (label) label.textContent = describeElement(currentTarget);
    Object.assign(overlay.style, {
      top: `${rect.top}px`,
      left: `${rect.left}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      display: 'block',
      opacity: '1',
    });
  }

  function hideOverlay() {
    if (overlay) {
      overlay.style.display = 'none';
      overlay.style.opacity = '0';
    }
    currentTarget = null;
  }

  function describeElement(element: HTMLElement) {
    const tag = element.tagName.toLowerCase();
    const id = element.id ? `#${element.id}` : '';
    const classes = element.className.split(/\s+/).filter(Boolean).slice(0, 2).map((name) => `.${name}`).join('');
    return `${tag}${id}${classes}`;
  }

  function readSourceInfo(element: { getAttribute(name: string): string | null } | null): { file: string; line: number } | null {
    if (!element) return null;
    const astroLoc = element.getAttribute('data-astro-source-loc');
    const astroFile = element.getAttribute('data-astro-source-file');
    const agLine = element.getAttribute('data-ag-line');
    if (astroLoc && astroFile) return { file: astroFile, line: Number.parseInt(astroLoc.split(':')[0] || '1', 10) };
    if (agLine) {
      const [file, line] = agLine.split(':');
      if (file && line) return { file: decodeURIComponent(file), line: Number.parseInt(line, 10) };
    }
    return null;
  }

  function selectTarget(event: MouseEvent): HTMLElement | null {
    return resolveTargetFromPoint(document, event.clientX, event.clientY, {
      ignoreSelectors: runtime.ignoreSelectors,
      preferSelectors: runtime.preferSelectors,
      targetHeuristics: runtime.targetHeuristics,
    }) as HTMLElement | null;
  }

  async function copyCurrentTarget() {
    if (!currentTarget) return;
    const sourceTarget = findSourceAnchor(currentTarget);
    const source = readSourceInfo(sourceTarget ?? currentTarget);
    if (!source) return;

    const response = await fetch(`/__astro-grab/snippet?file=${encodeURIComponent(source.file)}&line=${source.line}`);
    if (!response.ok) throw new Error(await response.text());
    const data = await response.json();

    const payload = extractPromptPayload(currentTarget, {
      file: data.file,
      line: data.targetLine,
      snippet: data.snippet,
      language: data.language,
      startLine: data.startLine,
      endLine: data.endLine,
    }, runtime);

    await copyToClipboard(formatGrabPrompt(payload, {
      payloadMode: runtime.payloadMode,
      template: runtime.template,
    }));
    flashStatus('✓ COPIED TO CLIPBOARD', '#10b981');
  }

  function flashStatus(text: string, backgroundColor: string) {
    const label = overlay?.querySelector('#astro-grab-label') as HTMLElement | null;
    if (!label) return;
    const previousText = label.textContent;
    const previousBackground = label.style.backgroundColor;
    label.textContent = text;
    label.style.backgroundColor = backgroundColor;
    label.style.transform = 'scale(1.08)';
    window.setTimeout(() => {
      label.textContent = previousText;
      label.style.backgroundColor = previousBackground;
      label.style.transform = 'scale(1)';
    }, 1400);
  }

  function setErrorStatus() {
    flashStatus('ERROR COPYING', '#ef4444');
  }

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Alt') {
      active = true;
      createOverlay();
    }
  });

  window.addEventListener('keyup', (event) => {
    if (event.key === 'Alt') {
      active = false;
      hideOverlay();
    }
  });

  window.addEventListener('mousemove', (event) => {
    if (!event.altKey) {
      if (active) {
        active = false;
        hideOverlay();
      }
      return;
    }

    active = true;
    createOverlay();

    const resolvedTarget = selectTarget(event);
    if (resolvedTarget && currentTarget !== resolvedTarget) {
      currentTarget = resolvedTarget;
      updateOverlayPosition();
      return;
    }
    if (!resolvedTarget) hideOverlay();
  });

  window.addEventListener('wheel', (event) => {
    if (!active || !event.altKey || !currentTarget) return;

    const direction: -1 | 1 = event.deltaY < 0 ? -1 : 1;
    const nextTarget = moveTargetByDepth(currentTarget, direction);
    if (!nextTarget || nextTarget === currentTarget) return;

    event.preventDefault();
    event.stopPropagation();
    currentTarget = nextTarget as HTMLElement;
    updateOverlayPosition();
  }, { capture: true, passive: false });

  window.addEventListener('mousedown', async (event) => {
    if (!active || !currentTarget) return;
    event.preventDefault();
    event.stopPropagation();
    try {
      await copyCurrentTarget();
    } catch {
      setErrorStatus();
    }
  }, { capture: true });

  const preventAll = (event: MouseEvent) => {
    if (active) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  window.addEventListener('mouseup', preventAll, { capture: true });
  window.addEventListener('click', preventAll, { capture: true });

  document.addEventListener('astro:before-preparation', () => {
    active = false;
    hideOverlay();
  });

  document.addEventListener('astro:page-load', () => {
    createOverlay();
  });
})();
