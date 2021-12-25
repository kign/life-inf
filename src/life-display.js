const {read_i32} = require('../external/wasm-printf');

const RESERVED_REGION = 10000;

function init (elm_map, elm_ovw, life_api, linear_memory) {
  const envelope = life_api.find_envelope(0);
  const [xmin, xmax, ymin, ymax] = [...Array(4).keys()].map(i => read_i32(linear_memory, envelope + 4*i));
  console.log("envelope =", xmin, xmax, ymin, ymax);

  // const ctx_map = elm_map.getContext("2d");

  const ovw = {ctx: elm_ovw.getContext("2d"), W: elm_ovw.clientWidth, H: elm_ovw.clientHeight,
    scale: {x: elm_ovw.width/elm_ovw.clientWidth, y: elm_ovw.height/elm_ovw.clientHeight}
  };

  const map = {ctx: elm_map.getContext("2d"), W: elm_map.clientWidth, H: elm_map.clientHeight,
    scale: {x: elm_map.width/elm_map.clientWidth, y: elm_map.height/elm_map.clientHeight}
  };
  map.vp = {cell: 10};
  map.vp.x0 = (xmin + xmax)/2 - map.W/map.vp.cell/2;
  map.vp.y0 = (ymin + ymax)/2 - map.H/map.vp.cell/2;

  console.log("Viewport: ", map.vp);

  ovw.ctx.fillStyle = '#80FFFF';
  ovw.ctx.fillRect(0, 0, ovw.W * ovw.scale.x/2, ovw.H * ovw.scale.y/2);
  ovw.ctx.fillStyle = '#FF80FF';
  ovw.ctx.fillRect(ovw.W * ovw.scale.x/2, 0,ovw.W * ovw.scale.x/2, ovw.H * ovw.scale.y/2);
  ovw.ctx.fillStyle = '#FFFF80';
  ovw.ctx.fillRect(0, ovw.H * ovw.scale.y/2,ovw.W * ovw.scale.x/2, ovw.H * ovw.scale.y/2);
  ovw.ctx.fillStyle = '#8080FF';
  ovw.ctx.fillRect(ovw.W * ovw.scale.x/2, ovw.H * ovw.scale.y/2, ovw.W * ovw.scale.x/2, ovw.H * ovw.scale.y/2);

  console.log("MAP:", map.W, map.H, elm_map.width, elm_map.height);
  console.log("OVW:", ovw.W, ovw.H, elm_ovw.width, elm_ovw.height);

  const x1 = map.vp.x0 + map.W/map.vp.cell;
  const y1 = map.vp.y0 + map.H/map.vp.cell;

  console.log("Region: ", map.vp.x0, x1, map.vp.y0, y1);
  const [ix0, ix1, iy0, iy1] = [Math.floor(map.vp.x0), Math.ceil(x1), Math.floor(map.vp.y0), Math.ceil(y1)];

  console.log("Integer region:", ix0, ix1, iy0, iy1);
  const [X, Y] = [ix1 - ix0 + 1, iy1 - iy0 + 1];
  const nCols = Math.min(X, Math.floor(RESERVED_REGION/Y));
  console.log("Size:", X, Y, "; read_region:", nCols, "columns");

  map.ctx.fillStyle = 'white';
  map.ctx.fillRect(0, 0, map.W * map.scale.x, map.H * map.scale.y);

  const region = life_api.read_region(0, ix0, iy0, X, Y);

  map.ctx.fillStyle = 'grey';
  for (let y = 0; y < Y; y ++)
    for (let x = 0; x < X; x ++)
      if (1 === linear_memory[region + y*X + x]) {
        const xs = (ix0 + x - map.vp.x0) * map.vp.cell;
        const ys = (iy0 + y - map.vp.y0) * map.vp.cell;
        map.ctx.fillRect(xs * map.scale.x, ys * map.scale.y, map.vp.cell * map.scale.x,map.vp.cell * map.scale.y);
      }




}

module.exports = {
  init: init
};