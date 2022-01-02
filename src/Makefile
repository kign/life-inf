
c4wa-compile = $(HOME)/git/c4wa/build/install/c4wa-compile/bin/c4wa-compile
browserify = ../node_modules/.bin/browserify
light-server = ../node_modules/.bin/light-server
port = 9811

wasm_bundle = ../docs/bundle.wasm
js_bundle = ../docs/bundle.js

c_sources = life-main.c life-inf.c board.c
h_sources = life-inf.h
js_sources = life-display.js main.js reset-dlg.js

build : $(wasm_bundle) $(js_bundle)

$(wasm_bundle) : $(c_sources) $(h_sources)
	gcc -Wall -Wextra -Werror $(c_sources) -o /dev/null
	$(c4wa-compile) $(c_sources) -lmm_fixed -lstring -o /tmp/bundle.wat
	wat2wasm --enable-bulk-memory /tmp/bundle.wat -o $@

$(js_bundle): $(js_sources)
	$(browserify) main.js -o $@

start: build
	ln -sf ../docs/life-web.html ../docs/index.html
	$(light-server) -s ../docs -p $(port) -w "*.js,*.c,*h,../docs/*.html,../docs/*.css # make"

run: start