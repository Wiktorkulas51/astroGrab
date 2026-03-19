// src/client/index.ts
(function () {
  if (typeof window === 'undefined') return;

  let active = false;
  let currentTarget: HTMLElement | null = null;
  let overlay: HTMLDivElement | null = null;

  function createOverlay() {
    overlay = document.createElement('div');
    overlay.id = 'astro-grab-overlay';
    Object.assign(overlay.style, {
      position: 'fixed',
      pointerEvents: 'none',
      zIndex: '10000',
      border: '2px solid #3b82f6',
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      transition: 'all 0.1s ease',
      display: 'none',
      borderRadius: '4px',
      boxShadow: '0 0 10px rgba(59, 130, 246, 0.5)'
    });
    
    // Label for the element
    const label = document.createElement('div');
    label.id = 'astro-grab-label';
    Object.assign(label.style, {
      position: 'absolute',
      bottom: '100%',
      left: '0',
      backgroundColor: '#3b82f6',
      color: 'white',
      padding: '2px 8px',
      fontSize: '12px',
      whiteSpace: 'nowrap',
      borderRadius: '4px 4px 0 0',
      marginBottom: '-2px'
    });
    overlay.appendChild(label);
    
    document.body.appendChild(overlay);
  }

  function updateOverlay(el: HTMLElement) {
    if (!overlay) return;
    const rect = el.getBoundingClientRect();
    const label = overlay.querySelector('#astro-grab-label') as HTMLElement;
    
    label.textContent = el.getAttribute('data-astro-grab')?.split('/').pop() || 'Element';
    
    Object.assign(overlay.style, {
      top: `${rect.top}px`,
      left: `${rect.left}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      display: 'block'
    });
  }

  function hideOverlay() {
    if (overlay) overlay.style.display = 'none';
    if (currentTarget) currentTarget.style.cursor = '';
    currentTarget = null;
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Alt') {
      active = true;
      if (!overlay) createOverlay();
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.key === 'Alt') {
      active = false;
      hideOverlay();
    }
  });

  window.addEventListener('mousemove', (e) => {
    if (!active) return;

    const el = e.target as HTMLElement;
    const target = el.closest('[data-astro-grab]') as HTMLElement;

    if (target) {
      if (currentTarget !== target) {
        currentTarget = target;
        updateOverlay(target);
        target.style.cursor = 'pointer';
      }
    } else {
      hideOverlay();
    }
  });

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
      
      // Visual feedback
      const originalLabel = overlay?.querySelector('#astro-grab-label')?.textContent;
      const label = overlay?.querySelector('#astro-grab-label') as HTMLElement;
      if (label) {
        label.textContent = 'Copied!';
        label.style.backgroundColor = '#10b981';
        setTimeout(() => {
          label.textContent = originalLabel || '';
          label.style.backgroundColor = '#3b82f6';
        }, 1500);
      }
    } catch (err) {
      console.error('[Astro Grab]', err);
    }
  });
})();
