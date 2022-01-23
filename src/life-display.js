const assert = require("assert");
const dlg_reset = require('./reset-dlg');
const {PanZoom, ZoomScaleOverlay} = require('./panzoom');
const {Canvas} = require('./canvas');
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

function init (controls, life_api) {
  const default_cell = 20;

  /*
   * One-time initialization on initial page load
   */

  board_from_string(life_api, "..x|xxx|.x.");

  let env = get_envelope(life_api);
  let generation = 1;
  let walkInt = null;
  let is_running = false;

  let manually_changed = true;

  const ovw = new Canvas(controls.cvs_ovw, 2);
  const map = new Canvas(controls.cvs_map, 2);
  const zoomScaleOverlay = new ZoomScaleOverlay(controls.cvs_leg);

  map.vewport = {zoom: default_cell, 
            x0: (env.x0 + env.x1)/2 - map.W/default_cell/2, 
            y0: (env.y0 + env.y1)/2 - map.H/default_cell/2};
  map.vp_temp = {};

  zoomScaleOverlay.update_zoom(map.vewport.zoom);

  update_map (controls, life_api, map, map.vp_temp, ovw, env);

  /*
   * Pan/Zoom callbacks
   */
  const panZoom = new PanZoom(controls.cvs_map, map,
        (cvs, vp) => {
          update_map (controls, life_api, cvs, vp, ovw, env);
          zoomScaleOverlay.update_zoom(map.vewport.zoom);
        });

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
      zoomScaleOverlay.update_zoom(map.vewport.zoom);
    }
    else
      panZoom.scroll(2, evt.deltaX, evt.deltaY);
  }

  controls.cvs_map.addEventListener("mousewheel", wheelPanZoom);

  /*
   * Turn cell on/off on click callback
   */
  const onClick = evt => {
    // click ignored unless checkmark is "on"
    if (!controls.cb_edit.checked)
      return;

    const rect = controls.cvs_map.getBoundingClientRect();
    const ix = Math.floor(map.vewport.x0 + (evt.clientX - rect.left)/map.vewport.zoom);
    const iy = Math.floor(map.vewport.y0 + (evt.clientY - rect.top) /map.vewport.zoom);

    const val = life_api.life_get_cell(ix, iy);
    life_api.life_set_cell(ix, iy, 1 - val);
    env = get_envelope(life_api);
    update_map (controls, life_api, map, map.vp_temp, ovw, env);
    manually_changed = true;
  }

  controls.cvs_map.addEventListener("click", onClick);

  /*
   * Control button callbacks
   */
  const one_step = () => {
    if (manually_changed) {
      life_api.life_prepare();
      generation = 1;
      manually_changed = false;
    }
    const cycle = life_api.life_step() !== 0;
    generation ++;
    env = get_envelope(life_api);
    update_map (controls, life_api, map, map.vp_temp, ovw, env);
    controls.lb_gen.innerText = generation;

    if (cycle && walkInt)
      cancelWalk();
  };

  controls.bt_step.addEventListener("click", one_step);

  const cancelWalk = () => {
    window.clearInterval(walkInt);
    walkInt = null;

    controls.bt_step.disabled = false;
    controls.bt_walk.innerText = controls.bt_walk.dataset.value;
    controls.bt_run.disabled = false;
  }

  controls.bt_walk.addEventListener("click", function () {
    if (walkInt)
      cancelWalk();

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
    let cycle = false;
    do {
      cycle = life_api.life_step() !== 0;
      generation++;
    }
    while(is_running && !cycle && window.performance.now() < t0 + 1000 * limit);

    if (cycle)
      is_running = false;

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
        map.vewport = {zoom: default_cell};
        map.vewport.x0 = (env.x0 + env.x1) / 2 - map.W / map.vewport.zoom / 2;
        map.vewport.y0 = (env.y0 + env.y1) / 2 - map.H / map.vewport.zoom / 2;
      }

      manually_changed = true;
      update_map (controls, life_api, map, map.vp_temp, ovw, env);
    });
  });

  controls.bt_find.addEventListener("click", function () {
    const size = {x: env.x1 - env.x0, y: env.y1 - env.y0};
    map.vewport.zoom = Math.min(map.W/size.x, map.H/size.y, default_cell);

    map.vewport.x0 = (env.x0 + env.x1)/2 - map.W / map.vewport.zoom / 2;
    map.vewport.y0 = (env.y0 + env.y1)/2 - map.H / map.vewport.zoom / 2;
    update_map (controls, life_api, map, map.vp_temp, ovw, env);
  });
}

function board_from_string(life_api, str_board) {
  const s_rows = str_board.split('|');
  const Y = s_rows.length;
  const X = s_rows[0].length;
  for (let y = 0; y < Y; y ++)
    for (let x = 0; x < X; x ++)
      if (s_rows[y][x] === 'x')
        life_api.life_set_cell(x, y, 1);
}

function reset_board(life_api, map, sel) {
  life_api.clear ();

  if (sel.type === "life")
    board_from_string(life_api, sel.life);

  else if (sel.type === "random") {
    const [ix0, ix1] = [Math.ceil(map.vewport.x0), Math.floor(map.vewport.x0 + map.W/map.vewport.zoom)];
    const [iy0, iy1] = [Math.ceil(map.vewport.y0), Math.floor(map.vewport.y0 + map.H/map.vewport.zoom)];

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
  const vp = _vp.zoom === undefined ? map.vewport : _vp;
  const win = {x0: vp.x0, x1: vp.x0 + map.W/vp.zoom, y0: vp.y0, y1: vp.y0 + map.H/vp.zoom};

  update_ovw(ovw, env, win);

  const new_disabled = vp.zoom < 5;
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
  const scale = Math.ceil(1/vp.zoom);
  const [X, Y] = [ix1 - ix0 + 1, iy1 - iy0 + 1];

  map.ctx.fillStyle = COLORS.map.bg;
  map.ctx.fillRect(0, 0, map.W * map.scale.x, map.H * map.scale.y);

  if (X <= 0 || Y <= 0) return;

  const Ys = Math.ceil(Y/scale);
  const nCols = scale * Math.floor(Math.min(X, Math.floor(scale * RESERVED_REGION/Ys)) / scale);
  assert(nCols > 0);

  map.ctx.fillStyle = COLORS.map.cell;

  for(let iBand = 0; nCols * iBand < X; iBand ++) {
    const xb0 = iBand * nCols;
    const Xb = Math.min(X, xb0 + nCols) - xb0;

    assert(Xb <= nCols);

    const linear_memory = new Uint8Array(life_api.memory.buffer);

    // console.log("Read region", ix0 + xb0, iy0, Xb, Y);
    if (scale === 1) {
      const region = life_api.read_region(ix0 + xb0, iy0, Xb, Y);
      const gap = Math.floor(vp.zoom/10);

      for (let y = 0; y < Y; y++)
        for (let x = 0; x < Xb; x++)
          if (1 === linear_memory[region + y * Xb + x]) {
            const xs = (ix0 + xb0 + x - vp.x0) * vp.zoom;
            const ys = (iy0 + y - vp.y0) * vp.zoom;
            map.ctx.fillRect(xs * map.scale.x + gap/2, ys * map.scale.y + gap/2,
                  vp.zoom * map.scale.x - gap, vp.zoom * map.scale.y - gap);
          }
    }
    else {
      const Xs = Math.ceil(Xb/scale);
      const region = life_api.read_region_scale(ix0 + xb0, iy0, Xs, Ys, scale);
      for (let y = 0; y < Ys; y++)
        for (let x = 0; x < Xs; x++)
          if (linear_memory[region + y * Xs + x] > 0) {
            const xs = (ix0 + xb0 + x * scale - vp.x0) * vp.zoom;
            const ys = (iy0 + y * scale - vp.y0) * vp.zoom;
            map.ctx.fillRect(xs * map.scale.x, ys * map.scale.y, vp.zoom * map.scale.x * scale, vp.zoom * map.scale.y * scale);
          }
    }
  }
}

module.exports = {
  init: init
};