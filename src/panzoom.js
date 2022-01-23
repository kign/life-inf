const {Canvas} = require('./canvas');

function PanZoom(domElm, canvas, redraw_fn) {
  this.domElm = domElm;        // actual HTML DOM Canvas element
  this.canvas = canvas;        // Canvas class
  this.redraw_fn = redraw_fn;  // Callback to redraw canvas
  
  this.touches = [];           // mouse pointer(s) [id, x0, y0, x, y]
  this.lastRedrawTime = 0;     // timestamp of last `redraw_fn` call
}

/*
 * Two events below are triggered by mouse/trackpad.
 * This is simple.
 */
PanZoom.prototype.scroll = function (k, dx, dy) {
  // Mouse scroll
  // dx, dy are mouse movements
  // k is a speed up coefficient, usually 2
  
  // shift the base of the viewport accordingly
  this.canvas.vewport.x0 += k * dx / this.canvas.vewport.zoom;
  this.canvas.vewport.y0 += k * dy / this.canvas.vewport.zoom;

  this._redraw();
}

PanZoom.prototype.zoom = function (k, x, y) {
  // Mouse zoom
  // k is zoom coefficient
  // x,y is application point of zoom (:= point that shouldn't move)

  // transform application point to internal coordinates
  const d = {x: x / this.canvas.vewport.zoom, y: y / this.canvas.vewport.zoom};
  const o = {x: this.canvas.vewport.x0 + d.x, y: this.canvas.vewport.y0 + d.y};

  // update zoom
  this.canvas.vewport.zoom *= k;

  // recompute the base
  this.canvas.vewport.x0 = o.x - d.x/k;
  this.canvas.vewport.y0 = o.y - d.y/k;

  this._redraw();
}

/*
 * Now we have to deal with multi-touch pointer events...
 * We manage these by adding a new property to Canvas
 *   vp_temp : viewport which is only active during continuous pan/zoom
 */
PanZoom.prototype.down = function (id, x, y) {
  // pointer down
  // id is pointer id
  // x, y are current coordinates of the pointer

  // if this pointer is already down, something must be wrong, just return
  const idx = this.touches.findIndex(t => t.id === id);
  if (idx >= 0) return;

  // if we already have two pointers down, ignore and return
  if (this.touches.length >= 2)
    return;

  // if we already had one pointer down, update viewport
  // (in other words, make it look like existing pointer was just pressed)
  if (this.touches.length === 1) {
    this.canvas.update_vp ();
    const t = this.touches[0];
    t.x0 = t.x;
    t.y0 = t.y;
  }

  this.domElm.setPointerCapture(id);

  // now add new pointer (1-st or 2-nd) and initialize `vp_temp`
  this.touches.push({id: id, x0: x, y0: y, x: x, y : y});
  this.canvas.vp_temp = {...this.canvas.vewport};
}

PanZoom.prototype.move = function (id, x, y) {
  // pointer move
  // id is pointer id
  // x, y are current coordinates of the pointer

  // if this pointer is not in the list (e.g. 3-rd finger was pressed and now it moves), ignore
  const idx = this.touches.findIndex(x => x.id === id);
  if (idx < 0) return;

  // update current coordinates (`x0`, `y0` remain)
  this.touches[idx].x = x;
  this.touches[idx].y = y;

  // update temporary viewport and trigger redraw
  this._update_vp_temp(...this.touches);
  this._redraw();
}

PanZoom.prototype.up = function (id) {
  // pointer up
  // id is pointer id
  // x, y are current coordinates of the pointer

  // if this pointer is not in the list (e.g. 3-rd finger was pressed and now released), ignore
  const idx = this.touches.findIndex(x => x.id === id);
  if (idx < 0) return;

  // remove this pointer from the list and make temporary viewport current
  this.touches.splice(idx, 1);
  this.domElm.releasePointerCapture(id);
  this.canvas.update_vp();

  // if (at most one) pointer is still down, reset it similarly to method "down"
  // (as if it was just pressed)
  if (this.touches.length === 1) {
    const t = this.touches[0];
    t.x0 = t.x;
    t.y0 = t.y;
  }
}

/*
 * Now we need to take care of actual logic
 * how to update view based on a multi-touch gesture?
 */
PanZoom.prototype._update_vp_temp = function(a, b) {
  // a,b : two pointers; b could be null
  // each pointer has initial position x0, y0 and current position x,y

  const oldZoom = this.canvas.vewport.zoom;
  if (b) {
    // two-pointer gesture: compute new zoom based on relative change in distance
    const old_d = (a.x0 - b.x0)**2 + (a.y0 - b.y0)**2;
    const new_d = (a.x - b.x)**2 + (a.y - b.y)**2;
    const newZoom = oldZoom * new_d/old_d;

    // This is now similar to method `zoom`, with middle point between `a` and `b` as new fixed point
    const shift = {x: ((a.x + b.x)/newZoom - (a.x0 + b.x0)/oldZoom)/2, y: ((a.y + b.y)/newZoom - (a.y0 + b.y0)/oldZoom)/2};

    this.canvas.vp_temp.zoom = newZoom;
    this.canvas.vp_temp.x0 = this.canvas.vewport.x0 - shift.x;
    this.canvas.vp_temp.y0 = this.canvas.vewport.y0 - shift.y;
  }
  else {
    // only one pointer gesture, this isn't complicated
    this.canvas.vp_temp.zoom = oldZoom;
    this.canvas.vp_temp.x0 = this.canvas.vewport.x0 - (a.x - a.x0) / oldZoom;
    this.canvas.vp_temp.y0 = this.canvas.vewport.y0 - (a.y - a.y0) / oldZoom;
  }
}

/*
 * Actual callback to `redraw_fn`
 * We are using `requestAnimationFrame` to guarantee smooth repainting, and
 * making sure there is at most one repaint per frame
 */
PanZoom.prototype._redraw = function () {
  const frozen_vp = {...this.canvas.vp_temp};
  window.requestAnimationFrame(ts => {
    if (ts > this.lastRedrawTime) {
      this.lastRedrawTime = ts;
      this.redraw_fn(this.canvas, frozen_vp);
    }
  });
}

/*
 * Simple add-on: show current zoom scale in an overlay canvas
 * It will only show up when zoom changes and will disappear 1.5 seconds after it stopped updating
 */

function ZoomScaleOverlay(overlayCanvasElm) {
  this.overlayCanvas = new Canvas(overlayCanvasElm, 2);
  this.timeoutHandler = null;
  this.lastZoom = null;
}

/*
 * This method must be called on every zoom update
 */
ZoomScaleOverlay.prototype.update_zoom = function(zoom) {
  if (this.lastZoom === zoom) return;
  this.lastZoom = zoom;

  const n = this.overlayCanvas.W/zoom;
  const scaleAsString = n.toFixed(n >= 10? 0: n > 1? 1 : n > 0.1? 2 : 3);
  const width = 5;

  if (this.timeoutHandler) {
    window.clearTimeout(this.timeoutHandler);
    this.timeoutHandler = null;
  }

  this.overlayCanvas.clear();
  this.overlayCanvas.ctx.fillStyle = '#808080';
  this.overlayCanvas.ctx.font = "30px Arial";
  this.overlayCanvas.showText(scaleAsString, this.overlayCanvas.W/2 - 5, 15)
  this.overlayCanvas.fillRect(0, this.overlayCanvas.H - width, this.overlayCanvas.W, width);

  this.timeoutHandler = window.setTimeout(() => this.overlayCanvas.clear(), 1500);
}

module.exports = {
  PanZoom: PanZoom,
  ZoomScaleOverlay: ZoomScaleOverlay
};