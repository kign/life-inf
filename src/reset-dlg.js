let initialized = false;

function rect (x, y, w, h, c) {
  const rect = document.createElementNS("http://www.w3.org/2000/svg", 'rect');
  rect.setAttribute('x', `${100*x}%`);
  rect.setAttribute('y', `${100*y}%`);
  rect.setAttribute('width', `${100*w}%`);
  rect.setAttribute('height', `${100*h}%`);
  rect.setAttribute('fill', c);
  rect.setAttribute('rx', '2%');
  rect.setAttribute('ry', '2%');
  return rect;
}

function board(svg, def) {
  const s_rows = def.split('|');
  const Y = s_rows.length;
  const X = s_rows[0].length;
  const gap = 1/Math.max(Y,X)/20;
  for (let y = 0; y < Y; y ++)
    for (let x = 0; x < X; x ++) {
      if (s_rows[y].length !== X) {
        console.error("Invalid length", s_rows[y].length, "expecting", X);
        return;
      }
      svg.appendChild(rect(x/X + gap, y/Y + gap, 1/X - 2*gap, 1/Y - 2*gap, s_rows[y][x] === 'x'? 'darkmagenta' : "WhiteSmoke"));
    }
}

function init (selection_fn) {
  const elm_close = document.querySelector("#reset-dlg .dlg-close");
  elm_close.onclick = evt => {evt.stopPropagation(); hide();}

  const elm_content = document.querySelector("#reset-dlg .dlg-content");
  elm_content.onclick = evt => evt.stopPropagation();

  const options = document.querySelectorAll("#reset-dlg .dlg-content > div");
  for (const opt of options) {
    if (opt.dataset.life)
      board(opt.querySelector("svg"), opt.dataset.life);
    opt.onclick = evt => {
      evt.stopPropagation();
      if (opt.dataset.life)
        selection_fn({type: "life", life: opt.dataset.life});
      else if (opt.dataset.type === "random")
        selection_fn({type: "random", density: parseFloat(opt.querySelector('input').value)});
      else
        return;
      hide ();
    }
  }

  const elm_dlg = document.getElementById('reset-dlg');
  elm_dlg.onclick = evt => {evt.stopPropagation(); hide();}

  initialized = true;
}


function hide () {
  document.getElementById('reset-dlg').style.display = 'none';
}

function show (selection_fn) {
  if (!initialized)
    init(selection_fn);

  // window.onclick = on_click;
  document.getElementById('reset-dlg').style.display = 'inherit';
}

module.exports = {
  show: show
};