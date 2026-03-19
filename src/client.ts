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
      zIndex: '2147483647',
      border: '2px solid #3b82f6',
      backgroundColor: 'rgba(59, 130, 246, 0.15)',
      transition: 'top 0.15s cubic-bezier(0.19, 1, 0.22, 1), left 0.15s cubic-bezier(0.19, 1, 0.22, 1), width 0.15s cubic-bezier(0.19, 1, 0.22, 1), height 0.15s cubic-bezier(0.19, 1, 0.22, 1), opacity 0.1s ease',
      display: 'none',
      borderRadius: '4px',
      boxShadow: '0 0 15px rgba(59, 130, 246, 0.6)',
      opacity: '0'
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

  window.addEventListener('mousedown', async (e) => {
    if (!active) {
      console.log('[Astro Grab] Click ignored: Alt not active');
      return;
    }
    if (!currentTarget) {
      console.log('[Astro Grab] Click ignored: No target');
      return;
    }

    console.log('[Astro Grab] Mousedown detected on:', currentTarget);

    e.preventDefault();
    e.stopPropagation();

    const grabInfo = currentTarget.getAttribute('data-astro-grab');
    if (!grabInfo) {
      console.log('[Astro Grab] No data-astro-grab attribute found');
      return;
    }

    const [file, line] = grabInfo.split(':');
    const label = overlay?.querySelector('#astro-grab-label') as HTMLElement;

    try {
      console.log(`[Astro Grab] Fetching snippet for ${file}:${line}`);
      const resp = await fetch(`/__astro-grab/snippet?file=${encodeURIComponent(file)}&line=${line}`);
      
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Server error: ${text}`);
      }
      
      const data = await resp.json();
      console.log('[Astro Grab] Snippet received, writing to clipboard...');
      
      await navigator.clipboard.writeText(data.result || data.snippet);
      console.log('[Astro Grab] SUCCESS: Copied to clipboard');
      
      if (label) {
        const prevText = label.textContent;
        const prevBg = label.style.backgroundColor;
        label.textContent = '✓ COPIED TO CLIPBOARD';
        label.style.backgroundColor = '#10b981';
        label.style.transform = 'scale(1.1)';
        
        setTimeout(() => {
          label.textContent = prevText;
          label.style.backgroundColor = prevBg;
          label.style.transform = 'scale(1)';
        }, 1500);
      }
    } catch (err: any) {
      console.error('[Astro Grab] ERROR:', err);
      if (label) {
        label.textContent = '❌ ERROR COPYING';
        label.style.backgroundColor = '#ef4444';
        setTimeout(() => {
          label.style.backgroundColor = '#3b82f6';
        }, 2000);
      }
    }
  }, { capture: true });



  // Cleanup on page transitions (optional but cleaner)
  document.addEventListener('astro:before-preparation', () => {
    active = false;
    hideOverlay();
  });
})();

