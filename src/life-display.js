const assert = require("assert");
const dlg_reset = require('./reset-dlg');

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

Canvas.prototype.update_vp = function () {
  assert(this.vp_temp.cell);
  this.vp = this.vp_temp;
  this.vp_temp = {};
}

function PanZoom(elm, cvs, update_fn) {
  this.elm = elm;
  this.cvs = cvs;
  this.update_fn = update_fn;
  this.touches = [];
  this.ts = 0;
}

PanZoom.prototype.scroll = function (k, dx, dy) {
  this.cvs.vp.x0 += k * dx / this.cvs.vp.cell;
  this.cvs.vp.y0 += k * dy / this.cvs.vp.cell;

  this._redraw();
}

PanZoom.prototype.zoom = function (k, x, y) {
  const d = {x: x / this.cvs.vp.cell, y: y / this.cvs.vp.cell};
  const o = {x: this.cvs.vp.x0 + d.x, y: this.cvs.vp.y0 + d.y};
  this.cvs.vp.cell *= k;
  this.cvs.vp.x0 = o.x - d.x/k;
  this.cvs.vp.y0 = o.y - d.y/k;

  this._redraw();
}

PanZoom.prototype.down = function (id, x, y) {
  const idx = this.touches.findIndex(t => t.id === id);
  if (idx >= 0) return;
  if (this.touches.length >= 2)
    return;

  if (this.touches.length === 1) {
    this.cvs.update_vp ();
    const t = this.touches[0];
    t.x0 = t.x;
    t.y0 = t.y;
  }

  this.elm.setPointerCapture(id);
  this.touches.push({id: id, x0: x, y0: y, x: x, y : y});
  this.cvs.vp_temp = {...this.cvs.vp};
}

PanZoom.prototype._adjust_vp = function(a, b) {
  const os = this.cvs.vp.cell;
  if (b) {
    const old_d = (a.x0 - b.x0)**2 + (a.y0 - b.y0)**2;
    const new_d = (a.x - b.x)**2 + (a.y - b.y)**2;
    const ns = os * new_d/old_d;
    const shift = {x: ((a.x + b.x)/ns - (a.x0 + b.x0)/os)/2, y: ((a.y + b.y)/ns - (a.y0 + b.y0)/os)/2};

    this.cvs.vp_temp.cell = ns;
    this.cvs.vp_temp.x0 = this.cvs.vp.x0 - shift.x;
    this.cvs.vp_temp.y0 = this.cvs.vp.y0 - shift.y;
  }
  else {
    this.cvs.vp_temp.cell = os;
    this.cvs.vp_temp.x0 = this.cvs.vp.x0 - (a.x - a.x0) / os;
    this.cvs.vp_temp.y0 = this.cvs.vp.y0 - (a.y - a.y0) / os;
  }
}

PanZoom.prototype.move = function (id, x, y) {
  const idx = this.touches.findIndex(x => x.id === id);
  if (idx < 0) return;

  this.touches[idx].x = x;
  this.touches[idx].y = y;

  this._adjust_vp(...this.touches);
  this._redraw();
}

PanZoom.prototype.up = function (id) {
  const idx = this.touches.findIndex(x => x.id === id);
  if (idx < 0) return;

  this.touches.splice(idx, 1);
  this.elm.releasePointerCapture(id);
  this.cvs.update_vp();

  if (this.touches.length === 1) {
    const t = this.touches[0];
    t.x0 = t.x;
    t.y0 = t.y;
  }
}

PanZoom.prototype._redraw = function () {
  const frozen_vp = {...this.cvs.vp_temp};
  window.requestAnimationFrame(ts => {
    if (ts > this.ts) {
      this.ts = ts;
      this.update_fn(this.cvs, frozen_vp);
    }
  });
}

function init (controls, life_api) {
  const default_cell = 20;

  let env = get_envelope(life_api);
  let generation = 1;
  let walkInt = null;
  let is_running = false;

  console.log("envelope =", env);
  let manually_changed = true;

  const ovw = new Canvas(controls.cvs_ovw, 2);
  const map = new Canvas(controls.cvs_map, 2);

  map.vp = {cell: default_cell};
  map.vp.x0 = (env.x0 + env.x1)/2 - map.W/map.vp.cell/2;
  map.vp.y0 = (env.y0 + env.y1)/2 - map.H/map.vp.cell/2;
  map.vp_temp = {};

  console.log("Viewport: ", map.vp);

  console.log("MAP:", map.W, map.H, controls.cvs_map.width, controls.cvs_map.height);
  console.log("OVW:", ovw.W, ovw.H, controls.cvs_ovw.width, controls.cvs_ovw.height);

  update_map (controls, life_api, map, map.vp_temp, ovw, env);

  const panZoom = new PanZoom(controls.cvs_map, map,
        (cvs, vp) => update_map (controls, life_api, cvs, vp, ovw, env));

  // These events support pan with a mouse or pan/pinch zoom with multi-touch
  const pointerPanZoom = evt => {
    evt.preventDefault();
    const rect = controls.cvs_map.getBoundingClientRect();

    if (evt.type === "pointerdown")
      panZoom.down(evt.pointerId, evt.clientX - rect.left, evt.clientY - rect.top);
    else if (evt.type === "pointermove")
      panZoom.move(evt.pointerId, evt.clientX - rect.left, evt.clientY - rect.top);
    else
      panZoom.up(evt.pointerId);
  };

  ["pointerdown", "pointermove", "pointerup", "pointercancel", "pointerout", "pointerleave"].forEach(x =>
    controls.cvs_map.addEventListener(x, pointerPanZoom));

  // These events support pan/zoom with a mouse wheel or a trackpad
  const wheelPanZoom = evt => {
    evt.preventDefault();

    if (evt.ctrlKey) {
      const rect = controls.cvs_map.getBoundingClientRect();
      panZoom.zoom(1 - evt.deltaY * 0.01, evt.clientX - rect.left, evt.clientY - rect.top);
    }
    else
      panZoom.scroll(2, evt.deltaX, evt.deltaY);
  }

  controls.cvs_map.addEventListener("mousewheel", wheelPanZoom);

  const onClick = evt => {
    if (!controls.cb_edit.checked)
      return;

    const rect = controls.cvs_map.getBoundingClientRect();
    const ix = Math.floor(map.vp.x0 + (evt.clientX - rect.left)/map.vp.cell);
    const iy = Math.floor(map.vp.y0 + (evt.clientY - rect.top) /map.vp.cell);

    const val = life_api.life_get_cell(ix, iy);
    life_api.life_set_cell(ix, iy, 1 - val);
    env = get_envelope(life_api);
    update_map (controls, life_api, map, map.vp_temp, ovw, env);
    manually_changed = true;
  }

  controls.cvs_map.addEventListener("click", onClick);

  const one_step = () => {
    if (manually_changed) {
      life_api.life_prepare();
      generation = 1;
      manually_changed = false;
    }
    life_api.life_step();
    generation ++;
    env = get_envelope(life_api);
    update_map (controls, life_api, map, map.vp_temp, ovw, env);
    controls.lb_gen.innerText = generation;
  };

  controls.bt_step.addEventListener("click", one_step);

  controls.bt_walk.addEventListener("click", function () {
    if (walkInt) {
      window.clearInterval(walkInt);
      walkInt = null;

      controls.bt_step.disabled = false;
      controls.bt_walk.innerText = controls.bt_walk.dataset.value;
      controls.bt_run.disabled = false;
    }
    else {
      const val = controls.txt_int.value;
      const f_val = parseFloat(val);
      if (isNaN(f_val))
        alert("Invalid interval " + val);
      else {
        walkInt = window.setInterval(one_step, 1000 * Math.max(1 / 60, f_val));
        controls.bt_step.disabled = true;
        controls.bt_walk.dataset.value = controls.bt_walk.innerText;
        controls.bt_walk.innerText = "Stop";
        controls.bt_run.disabled = true;
      }
    }
  });

  const runTillStopped = () => {
    const limit = 0.1;
    const t0 = window.performance.now();
    do {
      life_api.life_step();
      generation++;
    }
    while(is_running && window.performance.now() < t0 + 1000 * limit);

    env = get_envelope(life_api);
    update_map (controls, life_api, map, map.vp_temp, ovw, env);
    controls.lb_gen.innerText = generation;

    if (is_running)
      window.setTimeout(runTillStopped, 0);
    else {
      controls.bt_step.disabled = false;
      controls.bt_walk.disabled = false;
      controls.bt_run.disabled = false;

      controls.bt_run.innerText = controls.bt_run.dataset.value;
    }
  }

  controls.bt_run.addEventListener("click", function () {
    if (is_running) {
      is_running = false;
      controls.bt_run.disabled = true;
    }
    else {
      if (manually_changed) {
        life_api.life_prepare();
        generation = 1;
        manually_changed = false;
      }

      controls.bt_step.disabled = true;
      controls.bt_walk.disabled = true;
      controls.bt_run.dataset.value = controls.bt_run.innerText;
      controls.bt_run.innerText = "Stop";

      is_running = true;

      runTillStopped ();
    }

  });

  controls.bt_reset.addEventListener("click", function () {
    dlg_reset.show(sel => {
      reset_board(life_api, map, sel);

      env = get_envelope(life_api);
      if (sel.type !== "random") {
        map.vp = {cell: default_cell};
        map.vp.x0 = (env.x0 + env.x1) / 2 - map.W / map.vp.cell / 2;
        map.vp.y0 = (env.y0 + env.y1) / 2 - map.H / map.vp.cell / 2;
      }

      manually_changed = true;
      update_map (controls, life_api, map, map.vp_temp, ovw, env);
    });
  });

}

function reset_board(life_api, map, sel) {
  life_api.clear ();

  if (sel.type === "life") {
    const s_rows = sel.life.split('|');
    const Y = s_rows.length;
    const X = s_rows[0].length;
    for (let y = 0; y < Y; y ++)
      for (let x = 0; x < X; x ++)
        if (s_rows[y][x] === 'x')
          life_api.life_set_cell(x, y, 1);
  }
  else if (sel.type === "random") {
    const [ix0, ix1] = [Math.ceil(map.vp.x0), Math.floor(map.vp.x0 + map.W/map.vp.cell)];
    const [iy0, iy1] = [Math.ceil(map.vp.y0), Math.floor(map.vp.y0 + map.H/map.vp.cell)];

    for (let y = iy0; y <= iy1; y ++)
      for (let x = ix0; x <= ix1; x ++)
        if (Math.random() < sel.density)
          life_api.life_set_cell(x, y, 1);
  }
}

function get_envelope(life_api) {
  const envelope = life_api.find_envelope();
  const linear_memory = new Uint8Array(life_api.memory.buffer);
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

function update_map (controls, life_api, map, _vp, ovw, env) {
  const vp = _vp.cell === undefined ? map.vp : _vp;
  const win = {x0: vp.x0, x1: vp.x0 + map.W/vp.cell, y0: vp.y0, y1: vp.y0 + map.H/vp.cell};

  update_ovw(ovw, env, win);

  const new_disabled = vp.cell < 5;
  if (controls.cb_edit.disabled && !new_disabled) {
    controls.cb_edit.disabled = false;
    controls.cb_edit.checked = controls.cb_edit_state;
  }
  else if (!controls.cb_edit.disabled && new_disabled) {
    controls.cb_edit_state = controls.cb_edit.checked;
    controls.cb_edit.checked = false;
    controls.cb_edit.disabled = true;
  }

  // console.log("Region: ", vp.x0, x1, vp.y0, y1);
  const [ix0, ix1, iy0, iy1] = [Math.max(env.x0, Math.floor(win.x0)), Math.min(env.x1, Math.ceil(win.x1)),
                                Math.max(env.y0, Math.floor(win.y0)), Math.min(env.y1, Math.ceil(win.y1))];

  // console.log("Integer region:", ix0, ix1, iy0, iy1);
  const scale = Math.ceil(1/vp.cell);
  const [X, Y] = [ix1 - ix0 + 1, iy1 - iy0 + 1];
  if (X <= 0 || Y <= 0) return;

  const Ys = Math.ceil(Y/scale);
  const nCols = scale * Math.floor(Math.min(X, Math.floor(scale * RESERVED_REGION/Ys)) / scale);
  assert(nCols > 0);

  map.ctx.fillStyle = COLORS.map.bg;
  map.ctx.fillRect(0, 0, map.W * map.scale.x, map.H * map.scale.y);
  map.ctx.fillStyle = COLORS.map.cell;

  for(let iBand = 0; nCols * iBand < X; iBand ++) {
    const xb0 = iBand * nCols;
    const Xb = Math.min(X, xb0 + nCols) - xb0;

    assert(Xb <= nCols);

    const linear_memory = new Uint8Array(life_api.memory.buffer);

    // console.log("Read region", ix0 + xb0, iy0, Xb, Y);
    if (scale === 1) {
      const region = life_api.read_region(ix0 + xb0, iy0, Xb, Y);
      const gap = Math.floor(vp.cell/10);

      for (let y = 0; y < Y; y++)
        for (let x = 0; x < Xb; x++)
          if (1 === linear_memory[region + y * Xb + x]) {
            const xs = (ix0 + xb0 + x - vp.x0) * vp.cell;
            const ys = (iy0 + y - vp.y0) * vp.cell;
            map.ctx.fillRect(xs * map.scale.x + gap/2, ys * map.scale.y + gap/2,
                  vp.cell * map.scale.x - gap, vp.cell * map.scale.y - gap);
          }
    }
    else {
      const Xs = Math.ceil(Xb/scale);
      const region = life_api.read_region_scale(ix0 + xb0, iy0, Xs, Ys, scale);
      for (let y = 0; y < Ys; y++)
        for (let x = 0; x < Xs; x++)
          if (linear_memory[region + y * Xs + x] > 0) {
            const xs = (ix0 + xb0 + x * scale - vp.x0) * vp.cell;
            const ys = (iy0 + y * scale - vp.y0) * vp.cell;
            map.ctx.fillRect(xs * map.scale.x, ys * map.scale.y, vp.cell * map.scale.x * scale, vp.cell * map.scale.y * scale);
          }
    }
  }
}

module.exports = {
  init: init
};