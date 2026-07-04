/**
 * Input — unified touch + keyboard/mouse input.
 * Left screen half = floating movement joystick. Right half = look.
 * Desktop: WASD move, pointer-lock mouse look, Space jump, C crouch, Shift sprint.
 */
export class Input {
  // Movement axes, -1..1. moveX = strafe, moveY = forward(+)/back(-)
  moveX = 0; moveY = 0;
  // Accumulated look delta (consumed each frame)
  lookDX = 0; lookDY = 0;
  sprint = false;
  ads = false;
  // Edge-triggered actions (consume via take*)
  private _jump = false; private _crouch = false; private _fire = false; private _firing = false;

  private keys: Record<string, boolean> = {};
  private touches = new Map<number, { type: 'move' | 'look'; ox: number; oy: number }>();
  readonly isMobile: boolean;
  private el: HTMLElement;

  constructor(el: HTMLElement) {
    this.el = el;
    // Bind BOTH schemes: many desktops report touch support ('ontouchstart'),
    // so either/or detection breaks mouse look on touchscreen laptops.
    this.isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
    this.bindDesktop();
    this.bindTouch();
  }

  takeJump() { const v = this._jump; this._jump = false; return v; }
  takeCrouch() { const v = this._crouch; this._crouch = false; return v; }
  /** Held-fire state for full-auto. Edge flag (_fire) is reserved for semi-auto later. */
  get firing() { return this._firing; }
  takeFireEdge() { const v = this._fire; this._fire = false; return v; }
  consumeLook() { const dx = this.lookDX, dy = this.lookDY; this.lookDX = 0; this.lookDY = 0; return { dx, dy }; }

  private bindDesktop() {
    addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (e.code === 'Space') { this._jump = true; e.preventDefault(); }
      if (e.code === 'KeyC' || e.code === 'ControlLeft') this._crouch = true;
      if (e.code === 'ShiftLeft') this.sprint = true;
      this.updateKeyAxes();
    });
    addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
      if (e.code === 'ShiftLeft') this.sprint = false;
      this.updateKeyAxes();
    });
    let dragging = false; let lx = 0, ly = 0;
    this.el.addEventListener('mousedown', (e) => {
      if (document.pointerLockElement !== this.el) {
        this.el.requestPointerLock?.();
        dragging = true; lx = e.clientX; ly = e.clientY; // drag-look fallback if lock denied
        return;
      }
      if (e.button === 0) { this._fire = true; this._firing = true; }
      if (e.button === 2) this.ads = true;
    });
    addEventListener('mouseup', (e) => { dragging = false; if (e.button === 0) this._firing = false; if (e.button === 2) this.ads = false; });
    this.el.addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === this.el) { this.lookDX += e.movementX; this.lookDY += e.movementY; }
      else if (dragging) { this.lookDX += e.clientX - lx; this.lookDY += e.clientY - ly; lx = e.clientX; ly = e.clientY; }
    });
  }

  private updateKeyAxes() {
    this.moveX = (this.keys['KeyD'] ? 1 : 0) - (this.keys['KeyA'] ? 1 : 0);
    this.moveY = (this.keys['KeyW'] ? 1 : 0) - (this.keys['KeyS'] ? 1 : 0);
  }

  private bindTouch() {
    const half = () => window.innerWidth * 0.45;
    this.el.addEventListener('touchstart', (e) => {
      e.preventDefault();
      for (const t of Array.from(e.changedTouches)) {
        const left = t.clientX < half();
        this.touches.set(t.identifier, { type: left ? 'move' : 'look', ox: t.clientX, oy: t.clientY });
      }
    }, { passive: false });
    this.el.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const t of Array.from(e.changedTouches)) {
        const rec = this.touches.get(t.identifier); if (!rec) continue;
        if (rec.type === 'move') {
          const dx = t.clientX - rec.ox, dy = t.clientY - rec.oy;
          const R = 42;
          this.moveX = Math.max(-1, Math.min(1, dx / R));
          this.moveY = Math.max(-1, Math.min(1, -dy / R));
        } else {
          this.lookDX += t.clientX - rec.ox; this.lookDY += t.clientY - rec.oy;
          rec.ox = t.clientX; rec.oy = t.clientY;
        }
      }
    }, { passive: false });
    const end = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) {
        const rec = this.touches.get(t.identifier);
        if (rec?.type === 'move') { this.moveX = 0; this.moveY = 0; }
        this.touches.delete(t.identifier);
      }
    };
    this.el.addEventListener('touchend', end, { passive: false });
    this.el.addEventListener('touchcancel', end, { passive: false });
  }

  // Mobile action buttons call these
  pressJump() { this._jump = true; }
  pressCrouch() { this._crouch = true; }
  startFire() { this._firing = true; this._fire = true; }
  stopFire() { this._firing = false; }
  toggleAds() { this.ads = !this.ads; return this.ads; }
  toggleSprint() { this.sprint = !this.sprint; return this.sprint; }
}
