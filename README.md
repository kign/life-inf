# Conway's Game of Life: infinite board

This project complements [earlier implementation](https://github.com/kign/life) 
by providing utilities plus browser-based demo to work with 
[Conways' Game of Life](https://en.wikipedia.org/wiki/Conway%27s_Game_of_Life) 
on a potentially infinite board.

## Web demo

[https://kign.github.io/life-inf](https://kign.github.io/life-inf/)

![Web UI Screenshot](https://github.com/kign/life-inf/blob/master/etc/life_inf_web_ui.png?raw=true "Web UI Screenshot" )

All usual Pan/Zoom gestures are supported.

## Implementation

The core algorithm is implemented in C, and has a theoretical capacity to support a board up to 
the size of 32-bit integers (that is, -2<sup>31</sup> ⩽ _x_,_y_ ⩽ 2<sup>31</sup>-1).
Current API is as follows:

```c
// initialization
void init ();

// get and set individual cell 
int life_get_cell(int x, int y);
void life_set_cell(int x, int y, int val);

// read region as char array (sX*sY <= RESERVED_REGION, a compile-time constant).
char * read_region(int x0, int y0, int sX, int sY);
// with scale > 1, save *count* of live cells in every scale x scale square in every output byte
// this is used when zoomed out view can no longer resolve individual cells
char * read_region_scale(int x0, int y0, int sX, int sY, int scale);

// Get xmin, xmax, ymin, ymax in int[4] array
int * find_envelope();

// Clear the board
void clear();

// Game of Life single step. 
// Returns non-zero if a cycle has been found
int life_step ();
// For initial or manually changed position, this function must be called first
void life_prepare ();
```

Implementation uses tree of embedded squares (not unlike [octree](https://en.wikipedia.org/wiki/Octree) in 2D),
of customizable sizes (known at compile time). Lowest-level square contains arrays of cells, higher level squares
contain arrays of embedded cells. Further, lowest-level squares have two _separate_ arrays, we call them _planes_; 
at every step one plane is considered "source", and the other is "destination", 
and then they swap on the subsequent step.

In addition to processing all cells in the destination plane according to Conway's rules, we also mark separately 
all neighbour cells to "live" (== marked as "1") cells; this allows to bypass on the next step all cells not marked
as either "1" and "2". This improved efficiency, 
but necessitates special "prepare" API call on an initial (or manually edited) position.

For the purpose of Web UI, C source is compiled to Web Assembly with [c4wa compiler](https://github.com/kign/c4wa).
It uses fixed-size memory manager for Web Assembly; see details 
[here](https://github.com/kign/c4wa/blob/master/etc/doc/language.md#memory-managers). Intermediary WAT file
(**W**eb **A**ssembly **T**ext format) for Web Assembly bundle is preserved 
[here](https://github.com/kign/life-inf/blob/master/etc/bundle.wat).

Note that since it's problematic in Web Assembly to return multiple primitive values from an exported
functions, API is designed to work around this problem by returning an array pointer instead. See discussion 
[here](https://github.com/kign/c4wa/blob/master/etc/doc/language.md#use-case-returning-complex-data-types-from-exported-functions). 

## Development

First, make sure you have [c4wa](https://github.com/kign/c4wa#installation) compiler installed and working. 
It needs Java 11 or above, [wat2wasm](https://github.com/WebAssembly/wabt) 
and also `gcc` compiler (any other decent C compiler would work, but you'll need to
adjust your configuration).

(NOTE: as of version 0.5 of `c4wa`, it's possible to make WASM directly, though verification 
with `wat2wasm` is still useful. There is special target `cmp` to compare generated WASM files).

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

You can now open [localhost:9811](http://localhost:9811/) in your browser. 
Upon any changes to source files, 
Web Assembly and `browserify`'ed JavaScript bundle will be rebuilt and browser page automatically
reloaded.

To build production distribution, use 

```bash
make clean && make PP_OPTS='-DN=71 -DN0=100'
```
