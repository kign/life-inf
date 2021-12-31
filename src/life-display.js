const assert = require("assert");
const {read_i32} = require('../external/wasm-printf');

const RESERVED_REGION = 10000;

const COLORS = {ovw:
                {bg: '#E0E0E0',
                 env: '#A0E0A0',
                 win: 'white',
                 win_border: 'darkblue'},
              map:
                {bg: 'white',
                  cell: 'darkmagenta'}};

function Canvas(elm, density) {
  this.ctx = elm.getContext("2d");
  this.W = elm.clientWidth;
  this.H = elm.clientHeight;
  elm.width = this.W * density;
  elm.height = this.H * density;
  this.scale = {x: elm.width/elm.clientWidth, y: elm.height/elm.clientHeight};
}

Canvas.prototype.fillRect = function(x, y, w, h) {
  this.ctx.fillRect(x*this.scale.x, y*this.scale.y, w*this.scale.x, h*this.scale.y);
}

Canvas.prototype.strokeRect = function(x, y, w, h) {
  this.ctx.strokeRect(x*this.scale.x, y*this.scale.y, w*this.scale.x, h*this.scale.y);
}

function ShiftZoom(elm, cvs, update_fn) {
  this.elm = elm;
  this.cvs = cvs;
  this.vp = {};
  this.update_fn = update_fn;
  this.touches = [];
  this.ts = 0;

  this.old_x = null;
  this.old_y = null;
}

ShiftZoom.prototype.scroll = function (dx, dy) {
  this.cvs.vp.x0 += dx;
  this.cvs.vp.y0 += dy;

  this._redraw(this.cvs.vp);
}

ShiftZoom.prototype.zoom = function (k, x, y) {
  const dx = x - this.cvs.vp.x0;
  const dy = y - this.cvs.vp.y0;

  this.cvs.vp.cell *= k;
  this.cvs.vp.x0 = x - dx/k;
  this.cvs.vp.y0 = y - dy/k;

  this._redraw(this.cvs.vp);
}

ShiftZoom.prototype.down = function (id, x, y) {
  const idx = this.touches.findIndex(t => t.id === id);
  if (idx >= 0) return;
  if (this.touches.length >= 2)
    return;

  if (this.touches.length === 1) {
    this.cvs.vp = {...this.vp};
    const t = this.touches[0];
    t.x0 = t.x;
    t.y0 = t.y;
  }

  this.elm.setPointerCapture(id);
  this.touches.push({id: id, x0: x, y0: y, x: x, y : y});
  this.vp = {...this.cvs.vp};
}

ShiftZoom.prototype._adjust_vp = function(a, b) {
  if (b) {
    const old_d = (a.x0 - b.x0)**2 + (a.y0 - b.y0)**2;
    const new_d = (a.x - b.x)**2 + (a.y - b.y)**2;
    const os = this.cvs.vp.cell;
    const ns = os * new_d/old_d;
    const shift = {x: ((a.x + b.x)/ns - (a.x0 + b.x0)/os)/2, y: ((a.y + b.y)/ns - (a.y0 + b.y0)/os)/2};

    this.vp.cell = ns;
    this.vp.x0 = this.cvs.vp.x0 - shift.x;
    this.vp.y0 = this.cvs.vp.y0 - shift.y;
  }
  else {
    this.vp.cell = this.cvs.vp.cell;
    this.vp.x0 = this.cvs.vp.x0 - (a.x - a.x0) / this.vp.cell;
    this.vp.y0 = this.cvs.vp.y0 - (a.y - a.y0) / this.vp.cell;
  }
}

ShiftZoom.prototype.move = function (id, x, y) {
  const idx = this.touches.findIndex(x => x.id === id);
  if (idx < 0) return;

  this.touches[idx].x = x;
  this.touches[idx].y = y;

  this._adjust_vp(...this.touches);
  this._redraw(this.vp);
}

ShiftZoom.prototype.up = function (id) {
  const idx = this.touches.findIndex(x => x.id === id);
  if (idx < 0) return;

  this.touches.splice(idx, 1);
  this.elm.releasePointerCapture(id);
  this.cvs.vp = {...this.vp};

  if (this.touches.length === 1) {
    const t = this.touches[0];
    t.x0 = t.x;
    t.y0 = t.y;
  }
}

ShiftZoom.prototype._redraw = function (vp) {
  if (this.old_x && this.old_y) {
    const d = {x: Math.abs(vp.x0 - this.old_x), y: Math.abs(vp.y0 - this.old_y)};
    if (d.x > 2)
      console.log("big difference X =", d.x);
    if (d.y > 2)
      console.log("big difference Y =", d.y);
  }
  this.old_x = vp.x0;
  this.old_y = vp.y0;
  const frozen_vp = {...vp};
  window.requestAnimationFrame(ts => {
    if (ts > this.ts) {
      this.ts = ts;
      this.update_fn(this.cvs, frozen_vp);
    }
  });
}

function init (elm_map, elm_ovw, life_api, linear_memory) {
  const env = get_envelope(life_api, linear_memory);
  console.log("envelope =", env);

  const ovw = new Canvas(elm_ovw, 2);
  const map = new Canvas(elm_map, 0.5);

  map.vp = {cell: 10};
  map.vp.x0 = (env.x0 + env.x1)/2 - map.W/map.vp.cell/2;
  map.vp.y0 = (env.y0 + env.y1)/2 - map.H/map.vp.cell/2;

  console.log("Viewport: ", map.vp);

  console.log("MAP:", map.W, map.H, elm_map.width, elm_map.height);
  console.log("OVW:", ovw.W, ovw.H, elm_ovw.width, elm_ovw.height);

  update_map (life_api, linear_memory, map, map.vp, ovw, env);

  // credit: https://codepen.io/AbramPlus/pen/mdymKom
  let ready_to_drag = false;
  let is_dragging = false;
  let is_zooming = false;
  let lastDistance = 0;
  let distance = 0;
  let scaleDraw;
  let redraw;

  const startCoords = {x: 0, y: 0};
  const last = {x: 0, y: 0};
  const move = {x: 0, y: 0};

  let vp_start = {x: 0, y: 0};

  const canvasDraw = () => {
    // console.log("canvasDraw(", move, ")");
    map.vp.x0 = vp_start.x - move.x / map.vp.cell;
    map.vp.y0 = vp_start.y - move.y / map.vp.cell;

    update_map (life_api, linear_memory, map, map.vp, ovw, env);
  };

  const scaleCanvasTouch = () => {
    console.log("scaleCanvasTouch()");
  };

  const dragZoom = evt => {
    const rect = elm_map.getBoundingClientRect();
    const map_top = rect.top + window.scrollY;
    const map_left = rect.left + window.scrollX;

    const is_touch = evt.type.startsWith("touch");
    const touch = evt.touches || evt.changedTouches;
    const pos = is_touch? {x: touch[0].pageX, y : touch[0].pageY} : {x: evt.pageX, y: evt.pageY};

    if (evt.type === "mousedown" || evt.type === "touchstart") {
      if (is_touch && touch.length === 2) {
        is_zooming = true;

        // Pinch detection credits: http://stackoverflow.com/questions/11183174/simplest-way-to-detect-a-pinch/11183333#11183333
        lastDistance = Math.sqrt(
          (touch[0].clientX - touch[1].clientX) *
          (touch[0].clientX - touch[1].clientX) +
          (touch[0].clientY - touch[1].clientY) *
          (touch[0].clientY - touch[1].clientY)
        );
      }
      else {
        ready_to_drag = true;
        is_dragging = is_zooming = false;

        startCoords.x = pos.x - map_left/* - last.x*/;
        startCoords.y = pos.y - map_top/* - last.y*/;

        vp_start.x = map.vp.x0;
        vp_start.y = map.vp.y0;

        console.log("startCoords =", startCoords);
        console.log("dragStartOffset =", vp_start);
      }
    }

    else if (evt.type === "mousemove" || evt.type === "touchmove") {
      evt.preventDefault();

      is_dragging = true;

      if (ready_to_drag && !is_zooming) {
        let offset = is_touch ? 1.3 : 1;

        move.x = (pos.x - map_left - startCoords.x) * offset;
        move.y = (pos.y - map_top - startCoords.y) * offset;

        redraw = window.requestAnimationFrame(canvasDraw);
      }
      else if (is_zooming) {
        const touch = evt.touches || evt.changedTouches;

        //Pinch detection credits: http://stackoverflow.com/questions/11183174/simplest-way-to-detect-a-pinch/11183333#11183333
        distance = Math.sqrt(
          (touch[0].clientX - touch[1].clientX) *
          (touch[0].clientX - touch[1].clientX) +
          (touch[0].clientY - touch[1].clientY) *
          (touch[0].clientY - touch[1].clientY)
        );

        scaleDraw = window.requestAnimationFrame(scaleCanvasTouch);
      }
    }

    else { // "mouseup", "touchend"
      ready_to_drag = is_dragging = is_zooming = false;

      last.x = pos.x - map_left - startCoords.x;
      last.y = pos.y - map_top - startCoords.y;

      console.log("[end] last =", last);

      window.cancelAnimationFrame(scaleDraw);
      window.cancelAnimationFrame(redraw);
    }
  };

/*
  ["mousedown", "touchstart", "mousemove", "touchmove", "mouseup", "touchend"].forEach(x =>
    elm_map.addEventListener(x, dragZoom));
*/

  const shiftZoom = new ShiftZoom(elm_map, map,
        (cvs, vp) => update_map (life_api, linear_memory, cvs, vp, ovw, env));

  const pointerDragZoom = evt => {
    evt.preventDefault();
    const rect = elm_map.getBoundingClientRect();

    if (evt.type === "pointerdown")
      shiftZoom.down(evt.pointerId, evt.clientX - rect.left, evt.clientY - rect.top);
    else if (evt.type === "pointermove")
      shiftZoom.move(evt.pointerId, evt.clientX - rect.left, evt.clientY - rect.top);
    else
      shiftZoom.up(evt.pointerId);
  };

  const wheelZoom_TBR = evt => {
    // https://kenneth.io/post/detecting-multi-touch-trackpad-gestures-in-javascript
    evt.preventDefault();
    if (evt.ctrlKey) {
      const rect = elm_map.getBoundingClientRect();

      const dx = (evt.clientX - rect.left)/map.vp.cell;
      const dy = (evt.clientY - rect.top)/map.vp.cell;
      const x = map.vp.x0 + dx;
      const y = map.vp.y0 + dy;

      const k = 1 - evt.deltaY * 0.01;
      map.vp.cell *= k;
      map.vp.x0 = x - dx/k;
      map.vp.y0 = y - dy/k;

      update_map (life_api, linear_memory, map, map.vp, ovw, env);
    }
    else {
      // With with type of drag, mouse pointer stays still; not sure why there is coefficient "2"
      map.vp.x0 += 2 * evt.deltaX / map.vp.cell;
      map.vp.y0 += 2 * evt.deltaY / map.vp.cell;

      update_map (life_api, linear_memory, map, map.vp, ovw, env);
    }
  }

  const wheelZoom = evt => {
    evt.preventDefault();

    if (evt.ctrlKey) {
      const rect = elm_map.getBoundingClientRect();
      const x = map.vp.x0 + (evt.clientX - rect.left)/map.vp.cell;
      const y = map.vp.y0 + (evt.clientY - rect.top)/map.vp.cell;

      shiftZoom.zoom(1 - evt.deltaY * 0.01, x, y);
    }
    else {
      const dx = 2 * evt.deltaX / map.vp.cell;
      const dy = 2 * evt.deltaY / map.vp.cell;

      shiftZoom.scroll(dx, dy);
    }
  }

  ["pointerdown", "pointermove", "pointerup", "pointercancel", "pointerout", "pointerleave"].forEach(x =>
    elm_map.addEventListener(x, pointerDragZoom));

  elm_map.addEventListener("mousewheel", wheelZoom);
}

function get_envelope(life_api, linear_memory) {
  const envelope = life_api.find_envelope();
  const [x0, x1, y0, y1] = [...Array(4).keys()].map(i => read_i32(linear_memory, envelope + 4*i));
  return {x0: x0, x1: x1, y0: y0, y1: y1};
}

function update_ovw(ovw, env, win) {
  ovw.ctx.fillStyle = COLORS.ovw.bg;
  ovw.fillRect(0, 0, ovw.W, ovw.H);

  const eps = 0.05;

  const full = {x0: Math.min(env.x0, win.x0), x1: Math.max(env.x1, win.x1),
                y0: Math.min(env.y0, win.y0), y1: Math.max(env.y1, win.y1)};
  const ext = {x0: full.x0 - eps * (full.x1 - full.x0), x1: full.x1 + eps * (full.x1 - full.x0),
               y0: full.y0 - eps * (full.y1 - full.y0), y1: full.y1 + eps * (full.y1 - full.y0)};
  const scale = Math.min(ovw.W / (ext.x1 - ext.x0), ovw.H / (ext.y1 - ext.y0));

  ovw.ctx.fillStyle = COLORS.ovw.env;
  ovw.fillRect((env.x0 - ext.x0)*scale, (env.y0 - ext.y0)*scale, (env.x1 - env.x0)*scale, (env.y1 - env.y0)*scale);

  ovw.ctx.fillStyle = COLORS.ovw.win;
  ovw.fillRect((win.x0 - ext.x0)*scale, (win.y0 - ext.y0)*scale, (win.x1 - win.x0)*scale, (win.y1 - win.y0)*scale);

  ovw.ctx.strokeStyle = COLORS.ovw.win_border;
  ovw.strokeRect((win.x0 - ext.x0)*scale, (win.y0 - ext.y0)*scale, (win.x1 - win.x0)*scale, (win.y1 - win.y0)*scale);
}

function update_map (life_api, linear_memory, map, vp, ovw, env) {
  const win = {x0: vp.x0, x1: vp.x0 + map.W/vp.cell, y0: vp.y0, y1: vp.y0 + map.H/vp.cell};

  update_ovw(ovw, env, win);

  // console.log("Region: ", vp.x0, x1, vp.y0, y1);
  const [ix0, ix1, iy0, iy1] = [Math.max(env.x0, Math.floor(win.x0)), Math.min(env.x1, Math.ceil(win.x1)),
                                Math.max(env.y0, Math.floor(win.y0)), Math.min(env.y1, Math.ceil(win.y1))];

  // console.log("Integer region:", ix0, ix1, iy0, iy1);
  const [X, Y] = [ix1 - ix0 + 1, iy1 - iy0 + 1];
  if (X <= 0 || Y <= 0) return;

  const nCols = Math.min(X, Math.floor(RESERVED_REGION/Y));
  assert(nCols > 0);

  map.ctx.fillStyle = COLORS.map.bg;
  map.ctx.fillRect(0, 0, map.W * map.scale.x, map.H * map.scale.y);
  map.ctx.fillStyle = COLORS.map.cell;

  for(let iBand = 0; nCols * iBand < X; iBand ++) {
    const xb0 = iBand * nCols;
    const Xb = Math.min(X, xb0 + nCols) - xb0;

    assert(Xb <= nCols);

    // console.log("Read region", ix0 + xb0, iy0, Xb, Y);
    const region = life_api.read_region(ix0 + xb0, iy0, Xb, Y);

    for (let y = 0; y < Y; y ++)
      for (let x = 0; x < Xb; x ++)
        if (1 === linear_memory[region + y*Xb + x]) {
          const xs = (ix0 + xb0 + x - vp.x0) * vp.cell;
          const ys = (iy0 +       y - vp.y0) * vp.cell;
          map.ctx.fillRect(xs * map.scale.x, ys * map.scale.y, vp.cell * map.scale.x,vp.cell * map.scale.y);
        }
  }
}

module.exports = {
  init: init
};