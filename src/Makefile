
c4wa-compile = $(HOME)/git/c4wa/build/install/c4wa-compile/bin/c4wa-compile
# Production
# PP_OPTS = -DN=71 -DN0=100
# Debug
PP_OPTS = -DDEBUG=1 -DN=5 -DN0=6

ALIGNMENT = 1

browserify = ../node_modules/.bin/browserify
light-server = ../node_modules/.bin/light-server
port = 9811

wasm_bundle = ../docs/life-inf.wasm
js_bundle = ../docs/bundle.js

c_sources = life-main.c life-inf.c board.c
h_sources = life-inf.h
js_sources = main.js canvas.js life-display.js panzoom.js reset-dlg.js

build : $(wasm_bundle) $(js_bundle)

$(wasm_bundle) : $(c_sources) $(h_sources) Makefile
	gcc -Wall -Wextra -Werror $(PP_OPTS) $(c_sources) -o /dev/null
	$(c4wa-compile) -a $(ALIGNMENT) $(PP_OPTS) $(c_sources) -lmm_fixed -lstring -o /tmp/bundle.wat
	wat2wasm /tmp/bundle.wat -o $@

$(js_bundle): $(js_sources) Makefile
	$(browserify) main.js -o $@

clean :
	rm -f $(wasm_bundle) $(js_bundle)

start: build
	$(light-server) -s ../docs -p $(port) -w "Makefile,*.js,*.c,*h,../docs/*.html,../docs/*.css # make"

run: start

cmp: $(wasm_bundle)
	$(c4wa-compile) -a $(ALIGNMENT) $(PP_OPTS) $(c_sources) -lmm_fixed -lstring -o /tmp/bundle.wasm
	diff /tmp/bundle.wasm $(wasm_bundle)