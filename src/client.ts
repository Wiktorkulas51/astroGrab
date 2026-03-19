(function () {
  if (typeof window === 'undefined') return;
  if ((window as any).__astro_grab_initialized) return;
  (window as any).__astro_grab_initialized = true;

  let active = false;
  let currentTarget: HTMLElement | null = null;
  let overlay: HTMLDivElement | null = null;

  function createOverlay() {
    // If it exists in DOM, we're good
    if (document.getElementById('astro-grab-overlay')) {
      overlay = document.getElementById('astro-grab-overlay') as HTMLDivElement;
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
    const target = el.closest('[data-ag-line], [data-astro-source-loc]') as HTMLElement;



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

  // Block all interactions when active
  const preventAll = (e: MouseEvent) => {
    if (active) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  window.addEventListener('mousedown', preventAll, { capture: true });
  window.addEventListener('mouseup', preventAll, { capture: true });
  window.addEventListener('click', preventAll, { capture: true });

  window.addEventListener('mousedown', async (e) => {
    if (!active) return;
    if (!currentTarget) return;


    console.log('[Astro Grab] Mousedown detected on:', currentTarget);

    e.preventDefault();
    e.stopPropagation();

    let file = '';
    let line = '';
    
    // Priority: 1. Native Astro source (100% accurate) 2. Our ag-line
    const astroLoc = currentTarget.getAttribute('data-astro-source-loc');
    const astroFile = currentTarget.getAttribute('data-astro-source-file');
    const agLine = currentTarget.getAttribute('data-ag-line');

    if (astroLoc && astroFile) {
      file = astroFile;
      line = astroLoc.split(':')[0];
    } else if (agLine) {
      [file, line] = agLine.split(':');
    }

    if (!file || !line) {
      console.log('[Astro Grab] Could not determine source location', { agLine, astroLoc, astroFile });
      return;
    }


    const label = overlay?.querySelector('#astro-grab-label') as HTMLElement;

    try {
      console.log(`[Astro Grab] Fetching snippet for ${file}:${line}`);
      const resp = await fetch(`/__astro-grab/snippet?file=${encodeURIComponent(file)}&line=${line}`);

      
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Server error: ${text}`);
      }
      
      const data = await resp.json();
      console.log('[Astro Grab] Snippet received, processing template...');
      
      let finalResult = data.result || data.snippet;
      
      // Inject real DOM if template asks for it
      if (finalResult.includes('{{dom}}')) {
        // Create a clean clone for AI context
        const clone = currentTarget.cloneNode(true) as HTMLElement;
        
        // 1. Remove our tracking and Astro's source attributes
        const toRemove = ['data-ag-line', 'data-astro-source-loc', 'data-astro-source-file', 'data-astro-grab'];
        
        const cleanEl = (el: Element) => {
          toRemove.forEach(attr => el.removeAttribute(attr));
          // Also remove CID attributes
          for (let i = el.attributes.length - 1; i >= 0; i--) {
            if (el.attributes[i].name.startsWith('data-astro-cid')) {
              el.removeAttribute(el.attributes[i].name);
            }
          }
        };

        cleanEl(clone);
        clone.querySelectorAll('*').forEach(cleanEl);

        
        const dom = clone.outerHTML;
        finalResult = finalResult.replace(/{{dom}}/g, dom);
      }
      
      await navigator.clipboard.writeText(finalResult);

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



  // Cleanup and re-init on page transitions
  document.addEventListener('astro:before-preparation', () => {
    active = false;
    hideOverlay();
  });

  document.addEventListener('astro:page-load', () => {
    createOverlay();
  });
})();


