# Convay's Game of Life: infinite board

## Development

First, make sure you have [c4wa](https://github.com/kign/c4wa#installation) compiler installed. 
It needs Java 11 or above, and also `gcc` compiler (any other decent C compiler would work, but you'll need to
adjust your configuration).

To download required node modules, make sure you have `node` and `npm` installed and run from the project directory:

```bash
npm install
```

Then edit `Makefile` to change path to `c4wa-compile`, and run from `src` subdirectory:

```bash
make clean # only needed once to remove production-built WASM file
make run
```

You can now open `http://localhost:9811/` in your browser. Upon any changes to source files 
Web Assembly and `browserify`'ed JavaScript bundle will be rebuilt and browser page automatically
reloaded.

To build production distribution, use 

```bash
make clean && make PP_OPTS='-DN=71 -DN0=100'
```
