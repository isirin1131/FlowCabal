<script lang="ts">
  let { onclick }: { onclick?: () => void } = $props();

  let isDragging = $state(false);
  let position = $state({ x: 24, y: 100 });
  let dragOffset = { x: 0, y: 0 };

  function handleMouseDown(e: MouseEvent) {
    isDragging = true;
    dragOffset = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
    e.preventDefault();
  }

  function handleMouseMove(e: MouseEvent) {
    if (!isDragging) return;
    position = {
      x: Math.max(0, Math.min(window.innerWidth - 56, e.clientX - dragOffset.x)),
      y: Math.max(0, Math.min(window.innerHeight - 56, e.clientY - dragOffset.y))
    };
  }

  function handleMouseUp() {
    isDragging = false;
  }
</script>

<svelte:window onmousemove={handleMouseMove} onmouseup={handleMouseUp} />

<button
  class="floating-ball"
  class:dragging={isDragging}
  style="left: {position.x}px; top: {position.y}px;"
  aria-label="Quick actions"
  onmousedown={handleMouseDown}
  onclick={(e) => {
    if (!isDragging && onclick) {
      onclick();
    }
  }}
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
    transition: transform 0.2s, box-shadow 0.2s;
    user-select: none;
  }

  .floating-ball:hover {
    transform: scale(1.05);
    box-shadow: 0 6px 16px rgba(99, 102, 241, 0.5);
  }

  .floating-ball:active,
  .floating-ball.dragging {
    cursor: grabbing;
    transform: scale(0.95);
  }
</style>
