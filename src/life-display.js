const assert = require("assert");
const {read_i32} = require('../external/wasm-printf');

const RESERVED_REGION = 10000;

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
  this.ctx.fillRect(x*this.scale.x, y*this.scale.y, w*this.scale.x, h*this.scale.y);
}

function init (elm_map, elm_ovw, life_api, linear_memory) {
  const env = get_envelope(life_api, linear_memory);
  console.log("envelope =", env);

/*
  const ovw = {ctx: elm_ovw.getContext("2d"), W: elm_ovw.clientWidth, H: elm_ovw.clientHeight};
  elm_ovw.width = ovw.W * 2;
  elm_ovw.height = ovw.H * 2;
  ovw.scale = {x: elm_ovw.width/elm_ovw.clientWidth, y: elm_ovw.height/elm_ovw.clientHeight};

  const map = {ctx: elm_map.getContext("2d"), W: elm_map.clientWidth, H: elm_map.clientHeight};
  elm_map.width = map.W / 2;
  elm_map.height = map.H / 2;
  map.scale = {x: elm_map.width/elm_map.clientWidth, y: elm_map.height/elm_map.clientHeight};
*/

  const ovw = new Canvas(elm_ovw, 2);
  const map = new Canvas(elm_map, 0.5);

  map.vp = {cell: 10};
  map.vp.x0 = (env.x0 + env.x1)/2 - map.W/map.vp.cell/2;
  map.vp.y0 = (env.y0 + env.y1)/2 - map.H/map.vp.cell/2;

  console.log("Viewport: ", map.vp);

/*
  ovw.ctx.fillStyle = '#80FFFF';
  ovw.ctx.fillRect(0, 0, ovw.W * ovw.scale.x/2, ovw.H * ovw.scale.y/2);
  ovw.ctx.fillStyle = '#FF80FF';
  ovw.ctx.fillRect(ovw.W * ovw.scale.x/2, 0,ovw.W * ovw.scale.x/2, ovw.H * ovw.scale.y/2);
  ovw.ctx.fillStyle = '#FFFF80';
  ovw.ctx.fillRect(0, ovw.H * ovw.scale.y/2,ovw.W * ovw.scale.x/2, ovw.H * ovw.scale.y/2);
  ovw.ctx.fillStyle = '#8080FF';
  ovw.ctx.fillRect(ovw.W * ovw.scale.x/2, ovw.H * ovw.scale.y/2, ovw.W * ovw.scale.x/2, ovw.H * ovw.scale.y/2);
*/

  console.log("MAP:", map.W, map.H, elm_map.width, elm_map.height);
  console.log("OVW:", ovw.W, ovw.H, elm_ovw.width, elm_ovw.height);

  update_map (life_api, linear_memory, map, ovw, env);

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

  const dragStartOffset = {x: 0, y: 0};

  const canvasDraw = () => {
    // console.log("canvasDraw(", move, ")");
    map.vp.x0 = dragStartOffset.x - move.x / map.vp.cell;
    map.vp.y0 = dragStartOffset.y - move.y / map.vp.cell;

    update_map (life_api, linear_memory, map, ovw, env);
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

        dragStartOffset.x = map.vp.x0;
        dragStartOffset.y = map.vp.y0;

        console.log("startCoords =", startCoords);
        console.log("dragStartOffset =", dragStartOffset);
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

  const pointerDragZoom = evt => {
    evt.preventDefault();
    console.log("Pointer:", evt.type);
  };

  const wheelZoom = evt => {
    // https://kenneth.io/post/detecting-multi-touch-trackpad-gestures-in-javascript
    evt.preventDefault();
    if (evt.ctrlKey) {
      const rect = elm_map.getBoundingClientRect();
      const map_top = rect.top + window.scrollY;
      const map_left = rect.left + window.scrollX;

      const dx = (evt.clientX - map_left)/map.vp.cell;
      const dy = (evt.clientY - map_top)/map.vp.cell;
      const x = map.vp.x0 + dx;
      const y = map.vp.y0 + dy;

      const k = 1 - evt.deltaY * 0.01;
      map.vp.cell *= k;
      map.vp.x0 = x - dx/k;
      map.vp.y0 = y - dy/k;

      update_map (life_api, linear_memory, map, ovw, env);
    }
    else {
      // With with type of drag, mouse pointer stays still; not sure why there is coefficient "2"
      map.vp.x0 += 2 * evt.deltaX / map.vp.cell;
      map.vp.y0 += 2 * evt.deltaY / map.vp.cell;

      update_map (life_api, linear_memory, map, ovw, env);
    }
  }

  ["pointerdown", "pointermove", "pointerup", "pointercancel", "pointerout", "pointerleave"].forEach(x =>
    elm_map.addEventListener(x, pointerDragZoom));

  elm_map.addEventListener("mousewheel", wheelZoom);
}

function get_envelope(life_api, linear_memory) {
  const envelope = life_api.find_envelope(0);
  const [x0, x1, y0, y1] = [...Array(4).keys()].map(i => read_i32(linear_memory, envelope + 4*i));
  return {x0: x0, x1: x1, y0: y0, y1: y1};
}

function update_ovw(ovw, env, win) {
  const cols = {bg: '#E0E0E0',
                env: '#A0E0A0',
                win: 'white'};

  ovw.ctx.fillStyle = cols.bg;
  ovw.fillRect(0, 0, ovw.W, ovw.H);

  const eps = 0.1;

  const full = {x0: Math.min(env.x0, win.x0), x1: Math.max(env.x1, win.x1),
                y0: Math.min(env.y0, win.y0), y1: Math.max(env.y1, win.y1)};
  const ext = {x0: full.x0 - eps * (full.x1 - full.x0), x1: full.x1 + eps * (full.x1 - full.x0),
               y0: full.y0 - eps * (full.y1 - full.y0), y1: full.y1 + eps * (full.y1 - full.y0)};
  const scale = Math.min(ovw.W / (ext.x1 - ext.x0), ovw.H / (ext.y1 - ext.y0));

  ovw.ctx.fillStyle = cols.env;
  ovw.fillRect((env.x0 - ext.x0)*scale, (env.y0 - ext.y0)*scale, (env.x1 - env.x0)*scale, (env.y1 - env.y0)*scale);

  ovw.ctx.fillStyle = cols.win;
  ovw.fillRect((win.x0 - ext.x0)*scale, (win.y0 - ext.y0)*scale, (win.x1 - win.x0)*scale, (win.y1 - win.y0)*scale);
}

function update_map (life_api, linear_memory, map, ovw, env) {
  const win = {x0: map.vp.x0, x1: map.vp.x0 + map.W/map.vp.cell, y0: map.vp.y0, y1: map.vp.y0 + map.H/map.vp.cell};

  update_ovw(ovw, env, win);

  // console.log("Region: ", map.vp.x0, x1, map.vp.y0, y1);
  const [ix0, ix1, iy0, iy1] = [Math.max(env.x0, Math.floor(win.x0)), Math.min(env.x1, Math.ceil(win.x1)),
                                Math.max(env.y0, Math.floor(win.y0)), Math.min(env.y1, Math.ceil(win.y1))];

  // console.log("Integer region:", ix0, ix1, iy0, iy1);
  const [X, Y] = [ix1 - ix0 + 1, iy1 - iy0 + 1];
  const nCols = Math.min(X, Math.floor(RESERVED_REGION/Y));
  assert(nCols > 0);

  map.ctx.fillStyle = 'white';
  map.ctx.fillRect(0, 0, map.W * map.scale.x, map.H * map.scale.y);
  map.ctx.fillStyle = 'grey';

  for(let iBand = 0; nCols * iBand < X; iBand ++) {
    const xb0 = iBand * nCols;
    const Xb = Math.min(X, xb0 + nCols) - xb0;

    assert(Xb <= nCols);

    // console.log("Read region", ix0 + xb0, iy0, Xb, Y);
    const region = life_api.read_region(0, ix0 + xb0, iy0, Xb, Y);

    for (let y = 0; y < Y; y ++)
      for (let x = 0; x < Xb; x ++)
        if (1 === linear_memory[region + y*Xb + x]) {
          const xs = (ix0 + xb0 + x - map.vp.x0) * map.vp.cell;
          const ys = (iy0 +       y - map.vp.y0) * map.vp.cell;
          map.ctx.fillRect(xs * map.scale.x, ys * map.scale.y, map.vp.cell * map.scale.x,map.vp.cell * map.scale.y);
        }
  }
}

module.exports = {
  init: init
};