<script lang="ts">
  let { onclick }: { onclick?: () => void } = $props();

  const SIZE = 56;
  const HALF = SIZE / 2;

  type Edge = 'left' | 'right' | 'top' | 'bottom';

  let isDragging = $state(false);
  let isHovering = $state(false);
  let dockedEdge = $state<Edge>('left');
  let position = $state({ x: -HALF, y: 100 }); // Start docked on left
  let dragOffset = { x: 0, y: 0 };
  let hasMoved = false;

  function getDockedPosition(edge: Edge, alongEdge: number): { x: number; y: number } {
    const maxX = window.innerWidth;
    const maxY = window.innerHeight;

    switch (edge) {
      case 'left':
        return { x: -HALF, y: clamp(alongEdge, 0, maxY - SIZE) };
      case 'right':
        return { x: maxX - HALF, y: clamp(alongEdge, 0, maxY - SIZE) };
      case 'top':
        return { x: clamp(alongEdge, 0, maxX - SIZE), y: -HALF };
      case 'bottom':
        return { x: clamp(alongEdge, 0, maxX - SIZE), y: maxY - HALF };
    }
  }

  function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  function findNearestEdge(x: number, y: number): { edge: Edge; alongEdge: number } {
    const centerX = x + HALF;
    const centerY = y + HALF;
    const maxX = window.innerWidth;
    const maxY = window.innerHeight;

    const distances = {
      left: centerX,
      right: maxX - centerX,
      top: centerY,
      bottom: maxY - centerY
    };

    const nearest = (Object.entries(distances) as [Edge, number][])
      .reduce((min, curr) => curr[1] < min[1] ? curr : min);

    const edge = nearest[0];
    const alongEdge = (edge === 'left' || edge === 'right') ? y : x;

    return { edge, alongEdge };
  }

  function handleMouseDown(e: MouseEvent) {
    isDragging = true;
    hasMoved = false;

    // Calculate offset from actual visual center when docked
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    dragOffset = {
      x: e.clientX - rect.left - HALF,
      y: e.clientY - rect.top - HALF
    };
    e.preventDefault();
  }

  function handleMouseMove(e: MouseEvent) {
    if (!isDragging) return;
    hasMoved = true;

    // During drag, show full ball (not docked)
    position = {
      x: e.clientX - HALF - dragOffset.x,
      y: e.clientY - HALF - dragOffset.y
    };
  }

  function handleMouseUp() {
    if (!isDragging) return;
    isDragging = false;

    // Snap to nearest edge
    const { edge, alongEdge } = findNearestEdge(position.x, position.y);
    dockedEdge = edge;
    position = getDockedPosition(edge, alongEdge);
  }

  function handleClick() {
    if (!hasMoved && onclick) {
      onclick();
    }
  }

  // Handle window resize - keep ball docked properly
  function handleResize() {
    if (!isDragging) {
      const alongEdge = (dockedEdge === 'left' || dockedEdge === 'right')
        ? position.y
        : position.x;
      position = getDockedPosition(dockedEdge, alongEdge);
    }
  }

  // Compute transform for hover expansion when docked
  let hoverTransform = $derived.by(() => {
    if (isDragging || !isHovering) return 'none';

    switch (dockedEdge) {
      case 'left': return `translateX(${HALF}px)`;
      case 'right': return `translateX(-${HALF}px)`;
      case 'top': return `translateY(${HALF}px)`;
      case 'bottom': return `translateY(-${HALF}px)`;
    }
  });

  // Determine if currently docked (not being dragged)
  let isDocked = $derived(!isDragging);
</script>

<svelte:window
  onmousemove={handleMouseMove}
  onmouseup={handleMouseUp}
  onresize={handleResize}
/>

<button
  class="floating-ball"
  class:dragging={isDragging}
  class:docked={isDocked}
  class:docked-left={isDocked && dockedEdge === 'left'}
  class:docked-right={isDocked && dockedEdge === 'right'}
  class:docked-top={isDocked && dockedEdge === 'top'}
  class:docked-bottom={isDocked && dockedEdge === 'bottom'}
  style="left: {position.x}px; top: {position.y}px; {isHovering && isDocked ? `transform: ${hoverTransform};` : ''}"
  aria-label="Quick actions"
  onmousedown={handleMouseDown}
  onmouseenter={() => isHovering = true}
  onmouseleave={() => isHovering = false}
  onclick={handleClick}
>
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <circle cx="12" cy="12" r="3" />
    <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
  </svg>
</button>

<style>
  .floating-ball {
    position: fixed;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    border: none;
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
    cursor: grab;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    z-index: 9999;
    user-select: none;
    transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1),
                box-shadow 0.2s,
                border-radius 0.2s ease,
                left 0.3s cubic-bezier(0.34, 1.56, 0.64, 1),
                top 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .floating-ball.dragging {
    cursor: grabbing;
    transition: box-shadow 0.2s;
    box-shadow: 0 8px 24px rgba(99, 102, 241, 0.5);
    border-radius: 50%;
  }

  .floating-ball:hover {
    box-shadow: 0 6px 16px rgba(99, 102, 241, 0.5);
  }

  /* Docked states - clip to show hemisphere */
  .floating-ball.docked-left {
    border-radius: 0 50% 50% 0;
  }

  .floating-ball.docked-right {
    border-radius: 50% 0 0 50%;
  }

  .floating-ball.docked-top {
    border-radius: 0 0 50% 50%;
  }

  .floating-ball.docked-bottom {
    border-radius: 50% 50% 0 0;
  }

  /* Restore full circle on hover when docked */
  .floating-ball.docked:hover {
    border-radius: 50%;
  }
</style>
