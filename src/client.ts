// src/client.ts
(function () {
  if (typeof window === 'undefined') return;

  // Prevent multiple initializations (Astro View Transitions)
  if ((window as any).__astro_grab_initialized) return;
  (window as any).__astro_grab_initialized = true;

  let active = false;
  let currentTarget: HTMLElement | null = null;
  let overlay: HTMLDivElement | null = null;

  function createOverlay() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.id = 'astro-grab-overlay';
    Object.assign(overlay.style, {
      position: 'fixed',
      pointerEvents: 'none',
      zIndex: '2147483647', // Max possible z-index
      border: '2px solid #3b82f6',
      backgroundColor: 'rgba(59, 130, 246, 0.15)',
      transition: 'opacity 0.1s ease',
      display: 'none',
      borderRadius: '4px',
      boxShadow: '0 0 15px rgba(59, 130, 246, 0.6)'
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
      marginBottom: '-2px'
    });
    overlay.appendChild(label);
    document.body.appendChild(overlay);
  }

  function updateOverlayPosition() {
    if (!overlay || !currentTarget || !active) {
      hideOverlay();
      return;
    }
    const rect = currentTarget.getBoundingClientRect();
    const label = overlay.querySelector('#astro-grab-label') as HTMLElement;
    
    const grabInfo = currentTarget.getAttribute('data-astro-grab') || '';
    label.textContent = grabInfo.split('/').pop() || 'Element';
    
    Object.assign(overlay.style, {
      top: `${rect.top}px`,
      left: `${rect.left}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      display: 'block',
      opacity: '1'
    });
  }

  function hideOverlay() {
    if (overlay) {
      overlay.style.display = 'none';
      overlay.style.opacity = '0';
    }
    currentTarget = null;
  }

  // Monitor Alt key globally
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Alt') {
      active = true;
      createOverlay();
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.key === 'Alt') {
      active = false;
      hideOverlay();
    }
  });

  // Secondary safety check for Alt key state
  window.addEventListener('mousemove', (e) => {
    if (!e.altKey) {
      if (active) {
        active = false;
        hideOverlay();
      }
      return;
    }

    active = true;
    createOverlay();

    const el = e.target as HTMLElement;
    const target = el.closest('[data-astro-grab]') as HTMLElement;

    if (target) {
      if (currentTarget !== target) {
        currentTarget = target;
        updateOverlayPosition();
      }
    } else {
      hideOverlay();
    }
  });

  // Handle scroll to keep overlay pinned
  window.addEventListener('scroll', () => {
    if (active && currentTarget) {
      updateOverlayPosition();
    }
  }, { passive: true });

  window.addEventListener('click', async (e) => {
    if (!active || !currentTarget) return;

    e.preventDefault();
    e.stopPropagation();

    const grabInfo = currentTarget.getAttribute('data-astro-grab');
    if (!grabInfo) return;

    const [file, line] = grabInfo.split(':');

    try {
      const resp = await fetch(`/__astro-grab/snippet?file=${encodeURIComponent(file)}&line=${line}`);
      if (!resp.ok) throw new Error('Failed to fetch snippet');
      
      const data = await resp.json();
      await navigator.clipboard.writeText(data.snippet);
      
      const label = overlay?.querySelector('#astro-grab-label') as HTMLElement;
      if (label) {
        const prevText = label.textContent;
        label.textContent = 'COPIED TO CLIPBOARD';
        label.style.backgroundColor = '#10b981';
        setTimeout(() => {
          label.textContent = prevText;
          label.style.backgroundColor = '#3b82f6';
        }, 1200);
      }
    } catch (err) {
      console.error('[Astro Grab]', err);
    }
  });

  // Cleanup on page transitions (optional but cleaner)
  document.addEventListener('astro:before-preparation', () => {
    active = false;
    hideOverlay();
  });
})();

