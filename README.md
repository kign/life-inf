# Conway's Game of Life: infinite board

This project complements [earlier implementation](https://github.com/kign/life) 
by providing utilities plus browser-based demo to work with 
[Conways' Game of Life](https://en.wikipedia.org/wiki/Conway%27s_Game_of_Life) 
on a potentially infinite board.

## Web demo

[https://kign.github.io/life-inf](https://kign.github.io/life-inf/).

![Web UI Screenshot](https://github.com/kign/life-inf/blob/master/etc/life_inf_web_ui.png?raw=true "Web UI Screenshot" )

## Implementation

In progress...

## Development

First, make sure you have [c4wa](https://github.com/kign/c4wa#installation) compiler installed and working. 
It needs Java 11 or above, [wat2wasm](https://github.com/WebAssembly/wabt) 
and also `gcc` compiler (any other decent C compiler would work, but you'll need to
adjust your configuration).

Additionally, you'll need `make` and `node`+`npm`.

To download required node modules, run from the project directory:

```bash
npm install
```

Then edit `Makefile` to change path to `c4wa-compile`, and run from `src` subdirectory:

```bash
make clean # only needed once to remove production-optimized WASM file
make run
```

You can now open `http://localhost:9811/` in your browser. Upon any changes to source files 
Web Assembly and `browserify`'ed JavaScript bundle will be rebuilt and browser page automatically
reloaded.

To build production distribution, use 

```bash
make clean && make PP_OPTS='-DN=71 -DN0=100'
```
