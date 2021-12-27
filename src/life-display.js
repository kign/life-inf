const {read_i32} = require('../external/wasm-printf');

const RESERVED_REGION = 10000;

function init (elm_map, elm_ovw, life_api, linear_memory) {
  const envelope = life_api.find_envelope(0);
  const [xmin, xmax, ymin, ymax] = [...Array(4).keys()].map(i => read_i32(linear_memory, envelope + 4*i));
  console.log("envelope =", xmin, xmax, ymin, ymax);

  const ovw = {ctx: elm_ovw.getContext("2d"), W: elm_ovw.clientWidth, H: elm_ovw.clientHeight,
    scale: {x: elm_ovw.width/elm_ovw.clientWidth, y: elm_ovw.height/elm_ovw.clientHeight}
  };

  // const map = {ctx: elm_map.getContext("2d"), W: elm_map.clientWidth, H: elm_map.clientHeight,
  //   scale: {x: elm_map.width/elm_map.clientWidth, y: elm_map.height/elm_map.clientHeight}
  // };
  const map = {ctx: elm_map.getContext("2d"), W: elm_map.clientWidth, H: elm_map.clientHeight};

  elm_map.width = map.W / 2;
  elm_map.height = map.H / 2;

  map.scale = {x: elm_map.width/elm_map.clientWidth, y: elm_map.height/elm_map.clientHeight};

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

  update_map (life_api, linear_memory, map);

  // credit: https://codepen.io/AbramPlus/pen/mdymKom
  const pointerEvents = evt => {
    if (evt.type.startsWith("touch")) {
      let touch = evt.touches[0] || evt.changedTouches[0];
      return {x: touch.pageX, y : touch.pageY};
    }
    else if (evt.type.startsWith("mouse"))
      return {x: evt.pageX, y: evt.pageY};
    else
      return {x: 0, y :0};
  };

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

    update_map (life_api, linear_memory, map);
  };

  const scaleCanvasTouch = () => {
    console.log("scaleCanvasTouch()");
  };

  const dragZoom = evt => {
    const is_touch = evt.type.startsWith("touch");
    const rect = elm_map.getBoundingClientRect();
    const map_top = rect.top + window.scrollY;
    const map_left = rect.left + window.scrollX;

    if (evt.type === "mousedown" || evt.type === "touchstart") {
      let position = pointerEvents(evt);
      let touch = evt.touches || evt.changedTouches;

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

        startCoords.x = position.x - map_left/* - last.x*/;
        startCoords.y = position.y - map_top/* - last.y*/;

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
        let position = pointerEvents(evt);
        let offset = is_touch ? 1.3 : 1;

        move.x = (position.x - map_left - startCoords.x) * offset;
        move.y = (position.y - map_top - startCoords.y) * offset;

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

    else {
      const position = pointerEvents(evt);

      ready_to_drag = is_dragging = is_zooming = false;

      last.x = position.x - map_left - startCoords.x;
      last.y = position.y - map_top - startCoords.y;

      console.log("[end] last =", last);

      window.cancelAnimationFrame(scaleDraw);
      window.cancelAnimationFrame(redraw);
    }
  };

  ["mousedown", "touchstart", "mousemove", "touchmove", "mouseup", "touchend"].forEach(x =>
    elm_map.addEventListener(x, dragZoom));

}

function update_map (life_api, linear_memory, map) {
  const x1 = map.vp.x0 + map.W/map.vp.cell;
  const y1 = map.vp.y0 + map.H/map.vp.cell;

  console.log("Region: ", map.vp.x0, x1, map.vp.y0, y1);
  const [ix0, ix1, iy0, iy1] = [Math.floor(map.vp.x0), Math.ceil(x1), Math.floor(map.vp.y0), Math.ceil(y1)];

  // console.log("Integer region:", ix0, ix1, iy0, iy1);
  const [X, Y] = [ix1 - ix0 + 1, iy1 - iy0 + 1];
  const nCols = Math.min(X, Math.floor(RESERVED_REGION/Y));
  // console.log("Size:", X, Y, "; read_region:", nCols, "columns");

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