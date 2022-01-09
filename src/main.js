const display_init = require('./life-display').init;
const {wasm_printf} = require('../external/wasm-printf');

function main () {
  const wasm_src = 'life-inf.wasm';
  let wasm_mem;

  fetch(wasm_src).then(response => {
    if (response.status !== 200)
      alert(`File ${wasm_src} returned status ${response.status}`);
    return response.arrayBuffer();
  }).then(bytes => {
    return WebAssembly.instantiate(bytes, { c4wa: {
      printf: wasm_printf(() => new Uint8Array(wasm_mem.buffer), x => console.log(x.trim())) } });
  }).then(wasm => {
    console.log("Loaded", wasm_src);
    const life_api = wasm.instance.exports;
    wasm_mem = life_api.memory;
    life_api.init();

    const controls = {
      cvs_map: document.getElementById('map'),
      cvs_ovw: document.getElementById('overview'),
      cvs_leg: document.getElementById('legend'),
      cb_edit: document.getElementById('edit'),
      bt_step: document.getElementById("bt-step"),
      bt_walk: document.getElementById("bt-walk"),
      bt_run: document.getElementById("bt-run"),
      bt_reset: document.getElementById("bt-reset"),
      lb_gen: document.getElementById("lb-gen"),
      txt_int: document.getElementById("txt-int"),
      bt_find: document.getElementById("bt-find")
    };

    display_init(controls, life_api);
  });
}

main ();