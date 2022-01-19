#! /usr/bin/env python3
import os.path, argparse, logging, random, re, math
from time import time_ns
from inetlab.cli.colorterm import add_coloring_to_emit_ansi
from wasm_import.sprintf import wasm_sprintf as sprintf, read_i32
import conway_life as life_fin

def get_args () :
    default_log_level = "debug"
    default_density = 0.25
    default_iterations = 1_000
    default_wasm = "~/git/life-inf/docs/life-inf.wasm"
    default_wasm = os.path.realpath(os.path.join(os.path.dirname(os.path.realpath(__file__)),
                                    '..', 'docs', 'life-inf.wasm'))
    default_runtime = "wasmer"

    parser = argparse.ArgumentParser(description="Performance test fir infinite Life Board")
    parser.add_argument('--log', dest='log_level', help="Logging level (default = %s)" % default_log_level,
                        choices=['debug', 'info', 'warning', 'error', 'critical'],
                        default=default_log_level)

    parser.add_argument('-r', '--runtime', help=f"Runtime (default = {default_runtime})",
                        choices=["wasmer", "wasmtime"], default=default_runtime)

    parser.add_argument('-d', '--density', type=float,
        help=f"density for randomized board generation (default = {default_density:0.4f})",
        default=default_density)
    parser.add_argument('-s', '--seed',
        help="Seed for randomized board generation (if omitted results will be different every time)")
    parser.add_argument('--wasm', dest='wasm_file',
        help=f"Location of WASM file (default = {default_wasm})",
        default=os.path.expanduser(default_wasm))
    parser.add_argument('-i', '--iterations', type=int,
        help=f"Number of iterations (default = {default_iterations})",
        default=default_iterations)
    parser.add_argument('--test', '--cmp', dest='cmp_with_fin', action='store_true',
                        help="Compare with final Conway's algorithm")

    parser.add_argument('size', help="board size, e.g. 1200x1600",
        metavar="WIDTHxHEIGHT")

    args = parser.parse_args ()
    logging.basicConfig(format="%(asctime)s.%(msecs)03d %(filename)s:%(lineno)d %(message)s",
                        level=getattr(logging, args.log_level.upper(), None))
    logging.getLogger('matplotlib.font_manager').setLevel(logging.INFO)

    logging.StreamHandler.emit = add_coloring_to_emit_ansi(logging.StreamHandler.emit)

    if not (0 < args.density < 1) :
        logging.error("Invalid density value %f, must be between 0 and 1", args.density)
        exit(1)

    if args.seed :
        random.seed(args.seed)

    if not (0 < args.iterations < 1_000_000_000) :
        logging.error("Invalid number of iterations %d", args.iterations)
        exit(1)

    return args

class LifeInfWasmer :
    RESERVED_REGION = 10000

    def __init__(self, wasm_file):
        from wasmer import engine, Store, Module, Instance, Function, FunctionType, Type, ImportObject
        from wasmer_compiler_llvm import Compiler

        store: Store = Store(engine.Native(Compiler))
        # store = Store(engine.JIT(Compiler))

        logging.info("Loading %s", wasm_file)
        module = Module(store, open(wasm_file, 'rb').read())
        import_object: ImportObject = ImportObject()

        def printf(p_fmt, offset):
            mem = instance.exports.memory.uint8_view()
            res = sprintf(p_fmt, mem, offset)
            print(res, end='')

        import_object.register("c4wa", {"printf": Function(store, printf,
                                                           FunctionType(params=[Type.I32, Type.I32], results=[]))})

        instance = Instance(module, import_object)

        self.api = instance.exports
        self.api.init ()

    def set(self, x: int, y: int, val: int):
        self.api.life_set_cell(x, y, val)

    def prepare(self) :
        self.api.life_prepare ()

    def step(self) :
        self.api.life_step ()

    def clear(self) :
        self.api.clear ()

    def find_envelope (self) :
        offset : int = self.api.find_envelope()
        mem = self.api.memory.uint8_view()
        return [read_i32(mem, offset + 4*x) for x in range(4)]

    def read_region(self, x0 : int, y0 : int, sx : int, sy : int) :
        return self.api.memory.uint8_view(), self.api.read_region(x0, y0, sx, sy)


class LifeInfWasmtime :
    RESERVED_REGION = 10000

    def __init__(self, wasm_file):
        from wasmtime import Store, Module, Instance, Func, FuncType, ValType

        self.store = Store()

        logging.info("Loading %s", wasm_file)
        module = Module.from_file(self.store.engine, wasm_file)

        def printf(p_fmt, offset):
            mem = instance.exports(self.store)["memory"].data_ptr(self.store)
            res = sprintf(p_fmt, mem, offset)
            print(res, end='')

        instance = Instance(self.store, module, [Func(self.store, FuncType([ValType.i32(), ValType.i32()], []), printf)])

        self.api = instance.exports(self.store)
        self.api["init"](self.store)

    def set(self, x: int, y: int, val: int):
        self.api["life_set_cell"](self.store, x, y, val)

    def prepare(self) :
        self.api["life_prepare"] (self.store)

    def step(self) :
        self.api["life_step"] (self.store)

    def clear(self) :
        self.api["clear"] (self.store)

    def find_envelope (self) :
        offset : int = self.api["find_envelope"](self.store)
        mem = self.api["memory"].data_ptr(self.store)
        return [read_i32(mem, offset + 4*x) for x in range(4)]

    def read_region(self, x0 : int, y0 : int, sx : int, sy : int) :
        return self.api["memory"].data_ptr(self.store), self.api["read_region"](self.store, x0, y0, sx, sy)


def main(args) :
    m = re.compile(r'^(\d+)[^0-9](\d+)$').match(args.size)
    if not m :
        logging.error("Invalid size '%s', should be 'WIDTHxHEIGHT'", args.size)
        exit(1)

    X : int = int(m.group(1))
    Y : int = int(m.group(2))
    x0 : int = - X//2
    y0 : int = - Y//2

    Yf = Xf = x0f = y0f = 0
    pos_start = pos_end = []
    y_min = y_max = x_min = x_max = None
    if args.cmp_with_fin :
        Xf = 3 * X
        Yf = 3 * Y
        x0f = X
        y0f = Y
        pos_start = [False] * (Xf * Yf)
        pos_end = [False] * (Xf * Yf)

    life_inf = {'wasmer' : LifeInfWasmer, 'wasmtime' : LifeInfWasmtime}[args.runtime](args.wasm_file)
    do_2nd = True
    for test_idx in range(2 if args.cmp_with_fin else 1) :
        if test_idx == 1 and not do_2nd : break
        if args.cmp_with_fin :
            logging.info("Running comparative test %d", 1 + test_idx)
        # if test_idx > 0 :
        #     life_inf.clear ()
        # print("y_max =", y_max, ", y_min =", y_min)
        for y in range(Y) if test_idx is 0 else range(y_min - y0,y_max - y0 + 1):
            # if test_idx == 1 :
            #     print("y =", y, y + y0, life_inf.find_envelope())
            for x in range(X) if test_idx is 0 else range(x_min - x0, x_max - x0 + 1):
                val = 1 if random.random() < args.density else 0
                if args.cmp_with_fin :
                    xf = x + x0f
                    yf = y + y0f
                    pos_start[yf * Xf + xf] = val == 1

                if val == 1 or test_idx > 0 :
                    life_inf.set(x + x0, y + y0, val)

        logging.debug("Commencing...")
        life_inf.prepare()
        n_iter = 0
        t0 = time_ns ()
        for ii in range(args.iterations) :
            life_inf.step()
            n_iter += 1
            if args.cmp_with_fin :
                x_min, x_max, y_min, y_max = life_inf.find_envelope()
                fx0 = x_min - x0 + x0f
                fx1 = x_max - x0 + x0f
                fy0 = y_min - y0 + y0f
                fy1 = y_max - y0 + y0f
                # if ii >= 589 :
                #     print(ii, x_min, x_max, y_min, y_max, fx0, fx1, fy0, fy1)
                assert 0 <= fx0 < fx1 < Xf and 0 <= fy0 < fy1 < Yf, \
                                        f"out of bounds iter={ii} | {x_min},{x_max},{y_min},{y_max}"
                if fx0 == 0 or fy0 == 0 or fx1 == Xf - 1 or fy1 == Yf - 1 :
                    do_2nd = False
                    break
        perf_inf = (time_ns() - t0)/n_iter

        print("Envelope after", n_iter, "iterations", life_inf.find_envelope())
        if args.cmp_with_fin:
            t0 = time_ns()
            n = life_fin.run(Xf, Yf, 1, n_iter, pos_start, pos_end, None)
            assert n == n_iter, f"life_fin.run was expected to run {n_iter} iterations but returned {n}"
            perf_fin = (time_ns() - t0) / n_iter

            print(f"Inf = {1e9/perf_inf:.2f} fps, fin = {1e9/perf_fin:.2f} fps, ratio = {perf_inf/perf_fin:.2f}")

            grid : int = math.ceil(math.sqrt(Xf * Yf / LifeInfWasmer.RESERVED_REGION))
            if (Xf//grid + 1) * (Yf//grid + 1) > LifeInfWasmer.RESERVED_REGION :
                grid += 1
            assert (Xf//grid + 1) * (Yf//grid + 1) <= LifeInfWasmer.RESERVED_REGION

            yq = 0
            for qy in range(grid) :
                yq_n : int = math.ceil(Yf * (qy + 1) / grid)
                xq = 0
                for qx in range(grid) :
                    xq_n : int = math.ceil(Xf * (qx + 1) / grid)
                    sx = xq_n - xq
                    sy = yq_n - yq
                    mem, offset = life_inf.read_region(xq + x0 - x0f, yq + y0 - y0f, sx, sy)

                    n_fin = n_inf = 0
                    for y in range(yq, yq_n) :
                        for x in range(xq, xq_n) :
                            cmp_fin = pos_end[y * Xf + x]
                            cmp_inf = mem[offset + (y - yq) * sx + (x - xq)]
                            n_fin += 1 if cmp_fin else 0
                            n_inf += 1 if cmp_inf == 1 else 0
                            assert cmp_fin is True or cmp_fin is False
                            assert cmp_inf is 0 or cmp_inf is 1 or cmp_inf is 2, f"cmp_inf = {cmp_inf}"
                            assert cmp_fin == (cmp_inf == 1)

                    assert n_fin == n_inf
                    # print(f"Compared {xq + x0 - x0f}, {yq + y0 - y0f},  {sx}x{sy} : counts are", n_fin, n_inf)

                    xq = xq_n
                yq = yq_n
        else :
            print(f" {1e9/perf_inf:.2f} fps")


if __name__ == "__main__" :
    main(get_args())
