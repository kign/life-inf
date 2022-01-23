File `bundle.wat` is an intermediary step to build `bundle.wasm`. It's not required, but kept here for reference.

## Performance testing

(Mac 2.4 GHz Quad-Core Intel Core i5, 16 GB 2133 MHz LPDDR3)

### Debug version

#### Test 1

```
# ./life-inf-test.py 1000x1000 --test --seed 144
2022-01-22 23:30:50,362.362 life-inf-test.py:75 Loading /Users/kignatiev/git/life-inf/docs/life-inf.wasm
Box0 = 92, Box = 120, ratio = 1.3043
2022-01-22 23:30:50,993.993 life-inf-test.py:182 Running comparative test 1
2022-01-22 23:30:52,180.180 life-inf-test.py:194 Commencing...
Envelope after 1000 iterations [-747, 724, -739, 728]
Inf = 18.39 fps, fin = 119.20 fps, ratio = 6.48
2022-01-22 23:31:59,783.783 life-inf-test.py:182 Running comparative test 2
2022-01-22 23:32:27,512.512 life-inf-test.py:194 Commencing...
Envelope after 1000 iterations [-993, 1172, -976, 968]
Inf = 8.52 fps, fin = 75.86 fps, ratio = 8.90
```

#### Test 2

```
# ./life-inf-test.py 800x650 --test --seed 154
2022-01-22 23:35:17,086.086 life-inf-test.py:75 Loading /Users/kignatiev/git/life-inf/docs/life-inf.wasm
Box0 = 92, Box = 120, ratio = 1.3043
2022-01-22 23:35:17,623.623 life-inf-test.py:182 Running comparative test 1
2022-01-22 23:35:18,262.262 life-inf-test.py:194 Commencing...
Envelope after 1000 iterations [-645, 619, -548, 563]
Inf = 34.66 fps, fin = 228.36 fps, ratio = 6.59
2022-01-22 23:35:54,066.066 life-inf-test.py:182 Running comparative test 2
2022-01-22 23:36:08,678.678 life-inf-test.py:194 Commencing...
Envelope after 1000 iterations [-895, 869, -789, 804]
Inf = 13.09 fps, fin = 126.50 fps, ratio = 9.66
```

### Production version

#### Test 1

```
# ./life-inf-test.py 1000x1000 --test --seed 144
2022-01-22 23:41:32,230.230 life-inf-test.py:75 Loading /Users/kignatiev/git/life-inf/docs/life-inf.wasm
Box0 = 20020, Box = 20184, ratio = 1.0082
2022-01-22 23:41:32,861.861 life-inf-test.py:182 Running comparative test 1
2022-01-22 23:41:34,027.027 life-inf-test.py:194 Commencing...
Envelope after 1000 iterations [-747, 724, -739, 728]
Inf = 104.81 fps, fin = 118.44 fps, ratio = 1.13
2022-01-22 23:41:56,791.791 life-inf-test.py:182 Running comparative test 2
2022-01-22 23:42:20,811.811 life-inf-test.py:194 Commencing...
Envelope after 1000 iterations [-993, 1172, -976, 968]
Inf = 49.80 fps, fin = 76.77 fps, ratio = 1.54
```

#### Test 2

```
# ./life-inf-test.py 800x650 --test --seed 154
2022-01-22 23:43:04,112.112 life-inf-test.py:75 Loading /Users/kignatiev/git/life-inf/docs/life-inf.wasm
Box0 = 20020, Box = 20184, ratio = 1.0082
2022-01-22 23:43:04,608.608 life-inf-test.py:182 Running comparative test 1
2022-01-22 23:43:05,238.238 life-inf-test.py:194 Commencing...
Envelope after 1000 iterations [-645, 619, -548, 563]
Inf = 199.44 fps, fin = 219.52 fps, ratio = 1.10
2022-01-22 23:43:17,346.346 life-inf-test.py:182 Running comparative test 2
2022-01-22 23:43:31,073.073 life-inf-test.py:194 Commencing...
Envelope after 1000 iterations [-895, 869, -789, 804]
Inf = 74.14 fps, fin = 125.77 fps, ratio = 1.70
```

#### Test 3

```
# ./life-inf-test.py 1600x1200 --seed 164
2022-01-22 23:44:53,182.182 life-inf-test.py:75 Loading /Users/kignatiev/git/life-inf/docs/life-inf.wasm
Box0 = 20020, Box = 20184, ratio = 1.0082
2022-01-22 23:44:55,438.438 life-inf-test.py:194 Commencing...
Envelope after 1000 iterations [-1041, 1046, -843, 848]
 50.38 fps
```