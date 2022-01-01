const display_init = require('./life-display').init;
const {wasm_printf} = require('../external/wasm-printf');

function main () {
  const wasm_src = 'bundle.wasm';
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
      sel_mode: document.getElementById('mode')
    };

    display_init(controls, life_api);
  });
}

main ();