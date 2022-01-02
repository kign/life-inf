(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
const printf = require('fast-printf').printf;

const read_i32 = function (mem, offset) {
    // not really necessary, we can use Number(read_i64(...))
    let val = 0;

    for (let i = 3; i >= 0; i--)
        val = 256 * val + mem[offset + i];
    if (mem[offset + 3] >= 128)
        val -= 2 ** 32;
    return val;
}

const read_i64 = function (mem, offset) {
    // have to use BigInt, since native Number doesn't have sufficient precision to support
    // full 64-bit integer arithmetic (it works up to 53 binary digits).
    let val = 0n;

    if (mem[offset + 7] >= 128) {
        for (let i = 7; i >= 0; i--)
            val = 256n * val + BigInt(255 ^ mem[offset + i]);
        val = -val - 1n;
    } else {
        for (let i = 7; i >= 0; i--)
            val = 256n * val + BigInt(mem[offset + i]);
    }
    return val;
}

const read_f64 = function (mem, offset) {
    return new Float64Array(mem.slice(offset, offset + 8).buffer)[0];
}

const read_str = function (mem, offset) {
    const bytes = new Uint8Array(1024);
    let i = 0;
    while (i < 1024) {
        const c = mem[offset + i];
        if (c === 0)
            return new TextDecoder().decode(bytes.slice(0, i));
        bytes[i++] = c;
    }
    return null;
}

const wasm_printf = function (wasm_mem, consumer) {
    return function(fmt, offset) {
        wasm_mem_printf(fmt, offset, wasm_mem, consumer);
    }
}

const wasm_mem_printf = function (p_fmt, offset, wasm_mem, consumer) {
    // console.log(_fmt, offset, wasm_mem, target);
    const mem = wasm_mem ();

    const fmt = read_str(mem, p_fmt).split('');

    const args = [];
    for (let i = 0; i < fmt.length - 1; i++) {
        if (fmt[i] === '%') {
            i++;
            if (fmt[i] === '%')
                continue;
            while (i < fmt.length && !('a' <= fmt[i] && fmt[i] <= 'z' || 'A' <= fmt[i] && fmt[i] <= 'Z'))
                i++;
            if (i === fmt.length) {
                console.error("Invalid format string", fmt);
                return;
            }

            const is_long = fmt[i] === 'l';
            if (fmt[i] === 'l') {
                fmt[i] = null;
                i++;
            }
            if ('cdxu'.includes(fmt[i])) {
                const r = read_i64(mem, offset);
                if (fmt[i] === 'c')
                    args.push(String.fromCharCode(Number(r)));
                else if (-(2n ** 53n) < r && r < 2n ** 53n && (!'xu'.includes(fmt[i]) || (r >= 0n && r < 4294967296n)))
                    args.push(Number(r));
                else {
                    // bad hack: loosing all format specifiers
                    if (r < 0n && 'xu'.includes(fmt[i]))
                        args.push((r + (is_long? 2n ** 64n : 2n ** 32n)).toString(fmt[i] === 'x'? 16: 10));
                    else if (r >= 4294967296n && 'xu'.includes(fmt[i]))
                        args.push(r.toString(fmt[i] === 'x'? 16: 10));
                    else
                        args.push(r.toString());
                    fmt[i] = 's';
                }
            } else if ("feE".includes(fmt[i]))
                args.push(read_f64(mem, offset));
            else if (fmt[i] === 's') {
                const s = read_str(mem, Number(read_i64(mem, offset)));
                args.push(s);
            } else {
                console.error("Format '" + fmt[i] + "' not known at this time");
                return;
            }

            offset += 8;
        }
    }

    const res = printf(fmt.filter(x => x !== null).join(''), ...args);

    if (consumer)
        consumer(res);
}

module.exports = {
    wasm_printf  : wasm_printf,
    read_i32 : read_i32
};


},{"fast-printf":8}],2:[function(require,module,exports){
(function (global){(function (){
'use strict';

var objectAssign = require('object-assign');

// compare and isBuffer taken from https://github.com/feross/buffer/blob/680e9e5e488f22aac27599a57dc844a6315928dd/index.js
// original notice:

/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */
function compare(a, b) {
  if (a === b) {
    return 0;
  }

  var x = a.length;
  var y = b.length;

  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i];
      y = b[i];
      break;
    }
  }

  if (x < y) {
    return -1;
  }
  if (y < x) {
    return 1;
  }
  return 0;
}
function isBuffer(b) {
  if (global.Buffer && typeof global.Buffer.isBuffer === 'function') {
    return global.Buffer.isBuffer(b);
  }
  return !!(b != null && b._isBuffer);
}

// based on node assert, original notice:
// NB: The URL to the CommonJS spec is kept just for tradition.
//     node-assert has evolved a lot since then, both in API and behavior.

// http://wiki.commonjs.org/wiki/Unit_Testing/1.0
//
// THIS IS NOT TESTED NOR LIKELY TO WORK OUTSIDE V8!
//
// Originally from narwhal.js (http://narwhaljs.org)
// Copyright (c) 2009 Thomas Robinson <280north.com>
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the 'Software'), to
// deal in the Software without restriction, including without limitation the
// rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
// sell copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN
// ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
// WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

var util = require('util/');
var hasOwn = Object.prototype.hasOwnProperty;
var pSlice = Array.prototype.slice;
var functionsHaveNames = (function () {
  return function foo() {}.name === 'foo';
}());
function pToString (obj) {
  return Object.prototype.toString.call(obj);
}
function isView(arrbuf) {
  if (isBuffer(arrbuf)) {
    return false;
  }
  if (typeof global.ArrayBuffer !== 'function') {
    return false;
  }
  if (typeof ArrayBuffer.isView === 'function') {
    return ArrayBuffer.isView(arrbuf);
  }
  if (!arrbuf) {
    return false;
  }
  if (arrbuf instanceof DataView) {
    return true;
  }
  if (arrbuf.buffer && arrbuf.buffer instanceof ArrayBuffer) {
    return true;
  }
  return false;
}
// 1. The assert module provides functions that throw
// AssertionError's when particular conditions are not met. The
// assert module must conform to the following interface.

var assert = module.exports = ok;

// 2. The AssertionError is defined in assert.
// new assert.AssertionError({ message: message,
//                             actual: actual,
//                             expected: expected })

var regex = /\s*function\s+([^\(\s]*)\s*/;
// based on https://github.com/ljharb/function.prototype.name/blob/adeeeec8bfcc6068b187d7d9fb3d5bb1d3a30899/implementation.js
function getName(func) {
  if (!util.isFunction(func)) {
    return;
  }
  if (functionsHaveNames) {
    return func.name;
  }
  var str = func.toString();
  var match = str.match(regex);
  return match && match[1];
}
assert.AssertionError = function AssertionError(options) {
  this.name = 'AssertionError';
  this.actual = options.actual;
  this.expected = options.expected;
  this.operator = options.operator;
  if (options.message) {
    this.message = options.message;
    this.generatedMessage = false;
  } else {
    this.message = getMessage(this);
    this.generatedMessage = true;
  }
  var stackStartFunction = options.stackStartFunction || fail;
  if (Error.captureStackTrace) {
    Error.captureStackTrace(this, stackStartFunction);
  } else {
    // non v8 browsers so we can have a stacktrace
    var err = new Error();
    if (err.stack) {
      var out = err.stack;

      // try to strip useless frames
      var fn_name = getName(stackStartFunction);
      var idx = out.indexOf('\n' + fn_name);
      if (idx >= 0) {
        // once we have located the function frame
        // we need to strip out everything before it (and its line)
        var next_line = out.indexOf('\n', idx + 1);
        out = out.substring(next_line + 1);
      }

      this.stack = out;
    }
  }
};

// assert.AssertionError instanceof Error
util.inherits(assert.AssertionError, Error);

function truncate(s, n) {
  if (typeof s === 'string') {
    return s.length < n ? s : s.slice(0, n);
  } else {
    return s;
  }
}
function inspect(something) {
  if (functionsHaveNames || !util.isFunction(something)) {
    return util.inspect(something);
  }
  var rawname = getName(something);
  var name = rawname ? ': ' + rawname : '';
  return '[Function' +  name + ']';
}
function getMessage(self) {
  return truncate(inspect(self.actual), 128) + ' ' +
         self.operator + ' ' +
         truncate(inspect(self.expected), 128);
}

// At present only the three keys mentioned above are used and
// understood by the spec. Implementations or sub modules can pass
// other keys to the AssertionError's constructor - they will be
// ignored.

// 3. All of the following functions must throw an AssertionError
// when a corresponding condition is not met, with a message that
// may be undefined if not provided.  All assertion methods provide
// both the actual and expected values to the assertion error for
// display purposes.

function fail(actual, expected, message, operator, stackStartFunction) {
  throw new assert.AssertionError({
    message: message,
    actual: actual,
    expected: expected,
    operator: operator,
    stackStartFunction: stackStartFunction
  });
}

// EXTENSION! allows for well behaved errors defined elsewhere.
assert.fail = fail;

// 4. Pure assertion tests whether a value is truthy, as determined
// by !!guard.
// assert.ok(guard, message_opt);
// This statement is equivalent to assert.equal(true, !!guard,
// message_opt);. To test strictly for the value true, use
// assert.strictEqual(true, guard, message_opt);.

function ok(value, message) {
  if (!value) fail(value, true, message, '==', assert.ok);
}
assert.ok = ok;

// 5. The equality assertion tests shallow, coercive equality with
// ==.
// assert.equal(actual, expected, message_opt);

assert.equal = function equal(actual, expected, message) {
  if (actual != expected) fail(actual, expected, message, '==', assert.equal);
};

// 6. The non-equality assertion tests for whether two objects are not equal
// with != assert.notEqual(actual, expected, message_opt);

assert.notEqual = function notEqual(actual, expected, message) {
  if (actual == expected) {
    fail(actual, expected, message, '!=', assert.notEqual);
  }
};

// 7. The equivalence assertion tests a deep equality relation.
// assert.deepEqual(actual, expected, message_opt);

assert.deepEqual = function deepEqual(actual, expected, message) {
  if (!_deepEqual(actual, expected, false)) {
    fail(actual, expected, message, 'deepEqual', assert.deepEqual);
  }
};

assert.deepStrictEqual = function deepStrictEqual(actual, expected, message) {
  if (!_deepEqual(actual, expected, true)) {
    fail(actual, expected, message, 'deepStrictEqual', assert.deepStrictEqual);
  }
};

function _deepEqual(actual, expected, strict, memos) {
  // 7.1. All identical values are equivalent, as determined by ===.
  if (actual === expected) {
    return true;
  } else if (isBuffer(actual) && isBuffer(expected)) {
    return compare(actual, expected) === 0;

  // 7.2. If the expected value is a Date object, the actual value is
  // equivalent if it is also a Date object that refers to the same time.
  } else if (util.isDate(actual) && util.isDate(expected)) {
    return actual.getTime() === expected.getTime();

  // 7.3 If the expected value is a RegExp object, the actual value is
  // equivalent if it is also a RegExp object with the same source and
  // properties (`global`, `multiline`, `lastIndex`, `ignoreCase`).
  } else if (util.isRegExp(actual) && util.isRegExp(expected)) {
    return actual.source === expected.source &&
           actual.global === expected.global &&
           actual.multiline === expected.multiline &&
           actual.lastIndex === expected.lastIndex &&
           actual.ignoreCase === expected.ignoreCase;

  // 7.4. Other pairs that do not both pass typeof value == 'object',
  // equivalence is determined by ==.
  } else if ((actual === null || typeof actual !== 'object') &&
             (expected === null || typeof expected !== 'object')) {
    return strict ? actual === expected : actual == expected;

  // If both values are instances of typed arrays, wrap their underlying
  // ArrayBuffers in a Buffer each to increase performance
  // This optimization requires the arrays to have the same type as checked by
  // Object.prototype.toString (aka pToString). Never perform binary
  // comparisons for Float*Arrays, though, since e.g. +0 === -0 but their
  // bit patterns are not identical.
  } else if (isView(actual) && isView(expected) &&
             pToString(actual) === pToString(expected) &&
             !(actual instanceof Float32Array ||
               actual instanceof Float64Array)) {
    return compare(new Uint8Array(actual.buffer),
                   new Uint8Array(expected.buffer)) === 0;

  // 7.5 For all other Object pairs, including Array objects, equivalence is
  // determined by having the same number of owned properties (as verified
  // with Object.prototype.hasOwnProperty.call), the same set of keys
  // (although not necessarily the same order), equivalent values for every
  // corresponding key, and an identical 'prototype' property. Note: this
  // accounts for both named and indexed properties on Arrays.
  } else if (isBuffer(actual) !== isBuffer(expected)) {
    return false;
  } else {
    memos = memos || {actual: [], expected: []};

    var actualIndex = memos.actual.indexOf(actual);
    if (actualIndex !== -1) {
      if (actualIndex === memos.expected.indexOf(expected)) {
        return true;
      }
    }

    memos.actual.push(actual);
    memos.expected.push(expected);

    return objEquiv(actual, expected, strict, memos);
  }
}

function isArguments(object) {
  return Object.prototype.toString.call(object) == '[object Arguments]';
}

function objEquiv(a, b, strict, actualVisitedObjects) {
  if (a === null || a === undefined || b === null || b === undefined)
    return false;
  // if one is a primitive, the other must be same
  if (util.isPrimitive(a) || util.isPrimitive(b))
    return a === b;
  if (strict && Object.getPrototypeOf(a) !== Object.getPrototypeOf(b))
    return false;
  var aIsArgs = isArguments(a);
  var bIsArgs = isArguments(b);
  if ((aIsArgs && !bIsArgs) || (!aIsArgs && bIsArgs))
    return false;
  if (aIsArgs) {
    a = pSlice.call(a);
    b = pSlice.call(b);
    return _deepEqual(a, b, strict);
  }
  var ka = objectKeys(a);
  var kb = objectKeys(b);
  var key, i;
  // having the same number of owned properties (keys incorporates
  // hasOwnProperty)
  if (ka.length !== kb.length)
    return false;
  //the same set of keys (although not necessarily the same order),
  ka.sort();
  kb.sort();
  //~~~cheap key test
  for (i = ka.length - 1; i >= 0; i--) {
    if (ka[i] !== kb[i])
      return false;
  }
  //equivalent values for every corresponding key, and
  //~~~possibly expensive deep test
  for (i = ka.length - 1; i >= 0; i--) {
    key = ka[i];
    if (!_deepEqual(a[key], b[key], strict, actualVisitedObjects))
      return false;
  }
  return true;
}

// 8. The non-equivalence assertion tests for any deep inequality.
// assert.notDeepEqual(actual, expected, message_opt);

assert.notDeepEqual = function notDeepEqual(actual, expected, message) {
  if (_deepEqual(actual, expected, false)) {
    fail(actual, expected, message, 'notDeepEqual', assert.notDeepEqual);
  }
};

assert.notDeepStrictEqual = notDeepStrictEqual;
function notDeepStrictEqual(actual, expected, message) {
  if (_deepEqual(actual, expected, true)) {
    fail(actual, expected, message, 'notDeepStrictEqual', notDeepStrictEqual);
  }
}


// 9. The strict equality assertion tests strict equality, as determined by ===.
// assert.strictEqual(actual, expected, message_opt);

assert.strictEqual = function strictEqual(actual, expected, message) {
  if (actual !== expected) {
    fail(actual, expected, message, '===', assert.strictEqual);
  }
};

// 10. The strict non-equality assertion tests for strict inequality, as
// determined by !==.  assert.notStrictEqual(actual, expected, message_opt);

assert.notStrictEqual = function notStrictEqual(actual, expected, message) {
  if (actual === expected) {
    fail(actual, expected, message, '!==', assert.notStrictEqual);
  }
};

function expectedException(actual, expected) {
  if (!actual || !expected) {
    return false;
  }

  if (Object.prototype.toString.call(expected) == '[object RegExp]') {
    return expected.test(actual);
  }

  try {
    if (actual instanceof expected) {
      return true;
    }
  } catch (e) {
    // Ignore.  The instanceof check doesn't work for arrow functions.
  }

  if (Error.isPrototypeOf(expected)) {
    return false;
  }

  return expected.call({}, actual) === true;
}

function _tryBlock(block) {
  var error;
  try {
    block();
  } catch (e) {
    error = e;
  }
  return error;
}

function _throws(shouldThrow, block, expected, message) {
  var actual;

  if (typeof block !== 'function') {
    throw new TypeError('"block" argument must be a function');
  }

  if (typeof expected === 'string') {
    message = expected;
    expected = null;
  }

  actual = _tryBlock(block);

  message = (expected && expected.name ? ' (' + expected.name + ').' : '.') +
            (message ? ' ' + message : '.');

  if (shouldThrow && !actual) {
    fail(actual, expected, 'Missing expected exception' + message);
  }

  var userProvidedMessage = typeof message === 'string';
  var isUnwantedException = !shouldThrow && util.isError(actual);
  var isUnexpectedException = !shouldThrow && actual && !expected;

  if ((isUnwantedException &&
      userProvidedMessage &&
      expectedException(actual, expected)) ||
      isUnexpectedException) {
    fail(actual, expected, 'Got unwanted exception' + message);
  }

  if ((shouldThrow && actual && expected &&
      !expectedException(actual, expected)) || (!shouldThrow && actual)) {
    throw actual;
  }
}

// 11. Expected to throw an error:
// assert.throws(block, Error_opt, message_opt);

assert.throws = function(block, /*optional*/error, /*optional*/message) {
  _throws(true, block, error, message);
};

// EXTENSION! This is annoying to write outside this module.
assert.doesNotThrow = function(block, /*optional*/error, /*optional*/message) {
  _throws(false, block, error, message);
};

assert.ifError = function(err) { if (err) throw err; };

// Expose a strict only variant of assert
function strict(value, message) {
  if (!value) fail(value, true, message, '==', strict);
}
assert.strict = objectAssign(strict, assert, {
  equal: assert.strictEqual,
  deepEqual: assert.deepStrictEqual,
  notEqual: assert.notStrictEqual,
  notDeepEqual: assert.notDeepStrictEqual
});
assert.strict.strict = assert.strict;

var objectKeys = Object.keys || function (obj) {
  var keys = [];
  for (var key in obj) {
    if (hasOwn.call(obj, key)) keys.push(key);
  }
  return keys;
};

}).call(this)}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"object-assign":10,"util/":5}],3:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],4:[function(require,module,exports){
module.exports = function isBuffer(arg) {
  return arg && typeof arg === 'object'
    && typeof arg.copy === 'function'
    && typeof arg.fill === 'function'
    && typeof arg.readUInt8 === 'function';
}
},{}],5:[function(require,module,exports){
(function (process,global){(function (){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var formatRegExp = /%[sdj%]/g;
exports.format = function(f) {
  if (!isString(f)) {
    var objects = [];
    for (var i = 0; i < arguments.length; i++) {
      objects.push(inspect(arguments[i]));
    }
    return objects.join(' ');
  }

  var i = 1;
  var args = arguments;
  var len = args.length;
  var str = String(f).replace(formatRegExp, function(x) {
    if (x === '%%') return '%';
    if (i >= len) return x;
    switch (x) {
      case '%s': return String(args[i++]);
      case '%d': return Number(args[i++]);
      case '%j':
        try {
          return JSON.stringify(args[i++]);
        } catch (_) {
          return '[Circular]';
        }
      default:
        return x;
    }
  });
  for (var x = args[i]; i < len; x = args[++i]) {
    if (isNull(x) || !isObject(x)) {
      str += ' ' + x;
    } else {
      str += ' ' + inspect(x);
    }
  }
  return str;
};


// Mark that a method should not be used.
// Returns a modified function which warns once by default.
// If --no-deprecation is set, then it is a no-op.
exports.deprecate = function(fn, msg) {
  // Allow for deprecating things in the process of starting up.
  if (isUndefined(global.process)) {
    return function() {
      return exports.deprecate(fn, msg).apply(this, arguments);
    };
  }

  if (process.noDeprecation === true) {
    return fn;
  }

  var warned = false;
  function deprecated() {
    if (!warned) {
      if (process.throwDeprecation) {
        throw new Error(msg);
      } else if (process.traceDeprecation) {
        console.trace(msg);
      } else {
        console.error(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }

  return deprecated;
};


var debugs = {};
var debugEnviron;
exports.debuglog = function(set) {
  if (isUndefined(debugEnviron))
    debugEnviron = process.env.NODE_DEBUG || '';
  set = set.toUpperCase();
  if (!debugs[set]) {
    if (new RegExp('\\b' + set + '\\b', 'i').test(debugEnviron)) {
      var pid = process.pid;
      debugs[set] = function() {
        var msg = exports.format.apply(exports, arguments);
        console.error('%s %d: %s', set, pid, msg);
      };
    } else {
      debugs[set] = function() {};
    }
  }
  return debugs[set];
};


/**
 * Echos the value of a value. Trys to print the value out
 * in the best way possible given the different types.
 *
 * @param {Object} obj The object to print out.
 * @param {Object} opts Optional options object that alters the output.
 */
/* legacy: obj, showHidden, depth, colors*/
function inspect(obj, opts) {
  // default options
  var ctx = {
    seen: [],
    stylize: stylizeNoColor
  };
  // legacy...
  if (arguments.length >= 3) ctx.depth = arguments[2];
  if (arguments.length >= 4) ctx.colors = arguments[3];
  if (isBoolean(opts)) {
    // legacy...
    ctx.showHidden = opts;
  } else if (opts) {
    // got an "options" object
    exports._extend(ctx, opts);
  }
  // set default options
  if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
  if (isUndefined(ctx.depth)) ctx.depth = 2;
  if (isUndefined(ctx.colors)) ctx.colors = false;
  if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
  if (ctx.colors) ctx.stylize = stylizeWithColor;
  return formatValue(ctx, obj, ctx.depth);
}
exports.inspect = inspect;


// http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
inspect.colors = {
  'bold' : [1, 22],
  'italic' : [3, 23],
  'underline' : [4, 24],
  'inverse' : [7, 27],
  'white' : [37, 39],
  'grey' : [90, 39],
  'black' : [30, 39],
  'blue' : [34, 39],
  'cyan' : [36, 39],
  'green' : [32, 39],
  'magenta' : [35, 39],
  'red' : [31, 39],
  'yellow' : [33, 39]
};

// Don't use 'blue' not visible on cmd.exe
inspect.styles = {
  'special': 'cyan',
  'number': 'yellow',
  'boolean': 'yellow',
  'undefined': 'grey',
  'null': 'bold',
  'string': 'green',
  'date': 'magenta',
  // "name": intentionally not styling
  'regexp': 'red'
};


function stylizeWithColor(str, styleType) {
  var style = inspect.styles[styleType];

  if (style) {
    return '\u001b[' + inspect.colors[style][0] + 'm' + str +
           '\u001b[' + inspect.colors[style][1] + 'm';
  } else {
    return str;
  }
}


function stylizeNoColor(str, styleType) {
  return str;
}


function arrayToHash(array) {
  var hash = {};

  array.forEach(function(val, idx) {
    hash[val] = true;
  });

  return hash;
}


function formatValue(ctx, value, recurseTimes) {
  // Provide a hook for user-specified inspect functions.
  // Check that value is an object with an inspect function on it
  if (ctx.customInspect &&
      value &&
      isFunction(value.inspect) &&
      // Filter out the util module, it's inspect function is special
      value.inspect !== exports.inspect &&
      // Also filter out any prototype objects using the circular check.
      !(value.constructor && value.constructor.prototype === value)) {
    var ret = value.inspect(recurseTimes, ctx);
    if (!isString(ret)) {
      ret = formatValue(ctx, ret, recurseTimes);
    }
    return ret;
  }

  // Primitive types cannot have properties
  var primitive = formatPrimitive(ctx, value);
  if (primitive) {
    return primitive;
  }

  // Look up the keys of the object.
  var keys = Object.keys(value);
  var visibleKeys = arrayToHash(keys);

  if (ctx.showHidden) {
    keys = Object.getOwnPropertyNames(value);
  }

  // IE doesn't make error fields non-enumerable
  // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx
  if (isError(value)
      && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
    return formatError(value);
  }

  // Some type of object without properties can be shortcutted.
  if (keys.length === 0) {
    if (isFunction(value)) {
      var name = value.name ? ': ' + value.name : '';
      return ctx.stylize('[Function' + name + ']', 'special');
    }
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    }
    if (isDate(value)) {
      return ctx.stylize(Date.prototype.toString.call(value), 'date');
    }
    if (isError(value)) {
      return formatError(value);
    }
  }

  var base = '', array = false, braces = ['{', '}'];

  // Make Array say that they are Array
  if (isArray(value)) {
    array = true;
    braces = ['[', ']'];
  }

  // Make functions say that they are functions
  if (isFunction(value)) {
    var n = value.name ? ': ' + value.name : '';
    base = ' [Function' + n + ']';
  }

  // Make RegExps say that they are RegExps
  if (isRegExp(value)) {
    base = ' ' + RegExp.prototype.toString.call(value);
  }

  // Make dates with properties first say the date
  if (isDate(value)) {
    base = ' ' + Date.prototype.toUTCString.call(value);
  }

  // Make error with message first say the error
  if (isError(value)) {
    base = ' ' + formatError(value);
  }

  if (keys.length === 0 && (!array || value.length == 0)) {
    return braces[0] + base + braces[1];
  }

  if (recurseTimes < 0) {
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    } else {
      return ctx.stylize('[Object]', 'special');
    }
  }

  ctx.seen.push(value);

  var output;
  if (array) {
    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
  } else {
    output = keys.map(function(key) {
      return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
    });
  }

  ctx.seen.pop();

  return reduceToSingleString(output, base, braces);
}


function formatPrimitive(ctx, value) {
  if (isUndefined(value))
    return ctx.stylize('undefined', 'undefined');
  if (isString(value)) {
    var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                             .replace(/'/g, "\\'")
                                             .replace(/\\"/g, '"') + '\'';
    return ctx.stylize(simple, 'string');
  }
  if (isNumber(value))
    return ctx.stylize('' + value, 'number');
  if (isBoolean(value))
    return ctx.stylize('' + value, 'boolean');
  // For some reason typeof null is "object", so special case here.
  if (isNull(value))
    return ctx.stylize('null', 'null');
}


function formatError(value) {
  return '[' + Error.prototype.toString.call(value) + ']';
}


function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
  var output = [];
  for (var i = 0, l = value.length; i < l; ++i) {
    if (hasOwnProperty(value, String(i))) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          String(i), true));
    } else {
      output.push('');
    }
  }
  keys.forEach(function(key) {
    if (!key.match(/^\d+$/)) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          key, true));
    }
  });
  return output;
}


function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
  var name, str, desc;
  desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
  if (desc.get) {
    if (desc.set) {
      str = ctx.stylize('[Getter/Setter]', 'special');
    } else {
      str = ctx.stylize('[Getter]', 'special');
    }
  } else {
    if (desc.set) {
      str = ctx.stylize('[Setter]', 'special');
    }
  }
  if (!hasOwnProperty(visibleKeys, key)) {
    name = '[' + key + ']';
  }
  if (!str) {
    if (ctx.seen.indexOf(desc.value) < 0) {
      if (isNull(recurseTimes)) {
        str = formatValue(ctx, desc.value, null);
      } else {
        str = formatValue(ctx, desc.value, recurseTimes - 1);
      }
      if (str.indexOf('\n') > -1) {
        if (array) {
          str = str.split('\n').map(function(line) {
            return '  ' + line;
          }).join('\n').substr(2);
        } else {
          str = '\n' + str.split('\n').map(function(line) {
            return '   ' + line;
          }).join('\n');
        }
      }
    } else {
      str = ctx.stylize('[Circular]', 'special');
    }
  }
  if (isUndefined(name)) {
    if (array && key.match(/^\d+$/)) {
      return str;
    }
    name = JSON.stringify('' + key);
    if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
      name = name.substr(1, name.length - 2);
      name = ctx.stylize(name, 'name');
    } else {
      name = name.replace(/'/g, "\\'")
                 .replace(/\\"/g, '"')
                 .replace(/(^"|"$)/g, "'");
      name = ctx.stylize(name, 'string');
    }
  }

  return name + ': ' + str;
}


function reduceToSingleString(output, base, braces) {
  var numLinesEst = 0;
  var length = output.reduce(function(prev, cur) {
    numLinesEst++;
    if (cur.indexOf('\n') >= 0) numLinesEst++;
    return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
  }, 0);

  if (length > 60) {
    return braces[0] +
           (base === '' ? '' : base + '\n ') +
           ' ' +
           output.join(',\n  ') +
           ' ' +
           braces[1];
  }

  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
}


// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.
function isArray(ar) {
  return Array.isArray(ar);
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return isObject(re) && objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return isObject(d) && objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return isObject(e) &&
      (objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

exports.isBuffer = require('./support/isBuffer');

function objectToString(o) {
  return Object.prototype.toString.call(o);
}


function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}


var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
              'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
  var d = new Date();
  var time = [pad(d.getHours()),
              pad(d.getMinutes()),
              pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}


// log is just a thin wrapper to console.log that prepends a timestamp
exports.log = function() {
  console.log('%s - %s', timestamp(), exports.format.apply(exports, arguments));
};


/**
 * Inherit the prototype methods from one constructor into another.
 *
 * The Function.prototype.inherits from lang.js rewritten as a standalone
 * function (not on Function.prototype). NOTE: If this file is to be loaded
 * during bootstrapping this function needs to be rewritten using some native
 * functions as prototype setup using normal JavaScript does not work as
 * expected during bootstrapping (see mirror.js in r114903).
 *
 * @param {function} ctor Constructor function which needs to inherit the
 *     prototype.
 * @param {function} superCtor Constructor function to inherit prototype from.
 */
exports.inherits = require('inherits');

exports._extend = function(origin, add) {
  // Don't do anything if add isn't an object
  if (!add || !isObject(add)) return origin;

  var keys = Object.keys(add);
  var i = keys.length;
  while (i--) {
    origin[keys[i]] = add[keys[i]];
  }
  return origin;
};

function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

}).call(this)}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./support/isBuffer":4,"_process":11,"inherits":3}],6:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.boolean = void 0;
const boolean = function (value) {
    switch (Object.prototype.toString.call(value)) {
        case '[object String]':
            return ['true', 't', 'yes', 'y', 'on', '1'].includes(value.trim().toLowerCase());
        case '[object Number]':
            return value.valueOf() === 1;
        case '[object Boolean]':
            return value.valueOf();
        default:
            return false;
    }
};
exports.boolean = boolean;

},{}],7:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPrintf = void 0;
const boolean_1 = require("boolean");
const tokenize_1 = require("./tokenize");
const formatDefaultUnboundExpression = (
// @ts-expect-error unused parameter
subject, token) => {
    return token.placeholder;
};
const createPrintf = (configuration) => {
    var _a;
    const padValue = (value, width, flag) => {
        if (flag === '-') {
            return value.padEnd(width, ' ');
        }
        else if (flag === '-+') {
            return ((Number(value) >= 0 ? '+' : '') + value).padEnd(width, ' ');
        }
        else if (flag === '+') {
            return ((Number(value) >= 0 ? '+' : '') + value).padStart(width, ' ');
        }
        else if (flag === '0') {
            return value.padStart(width, '0');
        }
        else {
            return value.padStart(width, ' ');
        }
    };
    const formatUnboundExpression = (_a = configuration === null || configuration === void 0 ? void 0 : configuration.formatUnboundExpression) !== null && _a !== void 0 ? _a : formatDefaultUnboundExpression;
    const cache = {};
    // eslint-disable-next-line complexity
    return (subject, ...boundValues) => {
        let tokens = cache[subject];
        if (!tokens) {
            tokens = cache[subject] = tokenize_1.tokenize(subject);
        }
        let result = '';
        for (const token of tokens) {
            if (token.type === 'literal') {
                result += token.literal;
            }
            else {
                let boundValue = boundValues[token.position];
                if (boundValue === undefined) {
                    result += formatUnboundExpression(subject, token, boundValues);
                }
                else if (token.conversion === 'b') {
                    result += boolean_1.boolean(boundValue) ? 'true' : 'false';
                }
                else if (token.conversion === 'B') {
                    result += boolean_1.boolean(boundValue) ? 'TRUE' : 'FALSE';
                }
                else if (token.conversion === 'c') {
                    result += boundValue;
                }
                else if (token.conversion === 'C') {
                    result += String(boundValue).toUpperCase();
                }
                else if (token.conversion === 'i' || token.conversion === 'd') {
                    boundValue = String(Math.trunc(boundValue));
                    if (token.width !== null) {
                        boundValue = padValue(boundValue, token.width, token.flag);
                    }
                    result += boundValue;
                }
                else if (token.conversion === 'e') {
                    result += Number(boundValue)
                        .toExponential();
                }
                else if (token.conversion === 'E') {
                    result += Number(boundValue)
                        .toExponential()
                        .toUpperCase();
                }
                else if (token.conversion === 'f') {
                    if (token.precision !== null) {
                        boundValue = Number(boundValue).toFixed(token.precision);
                    }
                    if (token.width !== null) {
                        boundValue = padValue(String(boundValue), token.width, token.flag);
                    }
                    result += boundValue;
                }
                else if (token.conversion === 'o') {
                    result += (Number.parseInt(String(boundValue), 10) >>> 0).toString(8);
                }
                else if (token.conversion === 's') {
                    if (token.width !== null) {
                        boundValue = padValue(String(boundValue), token.width, token.flag);
                    }
                    result += boundValue;
                }
                else if (token.conversion === 'S') {
                    if (token.width !== null) {
                        boundValue = padValue(String(boundValue), token.width, token.flag);
                    }
                    result += String(boundValue).toUpperCase();
                }
                else if (token.conversion === 'u') {
                    result += Number.parseInt(String(boundValue), 10) >>> 0;
                }
                else if (token.conversion === 'x') {
                    boundValue = (Number.parseInt(String(boundValue), 10) >>> 0).toString(16);
                    if (token.width !== null) {
                        boundValue = padValue(String(boundValue), token.width, token.flag);
                    }
                    result += boundValue;
                }
                else {
                    throw new Error('Unknown format specifier.');
                }
            }
        }
        return result;
    };
};
exports.createPrintf = createPrintf;

},{"./tokenize":9,"boolean":6}],8:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.printf = exports.createPrintf = void 0;
const createPrintf_1 = require("./createPrintf");
Object.defineProperty(exports, "createPrintf", { enumerable: true, get: function () { return createPrintf_1.createPrintf; } });
exports.printf = createPrintf_1.createPrintf();

},{"./createPrintf":7}],9:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tokenize = void 0;
const TokenRule = /(?:%(?<flag>([+0-]|-\+))?(?<width>\d+)?(?<position>\d+\$)?(?<precision>\.\d+)?(?<conversion>[%BCESb-iosux]))|(\\%)/g;
const tokenize = (subject) => {
    let matchResult;
    const tokens = [];
    let argumentIndex = 0;
    let lastIndex = 0;
    let lastToken = null;
    while ((matchResult = TokenRule.exec(subject)) !== null) {
        if (matchResult.index > lastIndex) {
            lastToken = {
                literal: subject.slice(lastIndex, matchResult.index),
                type: 'literal',
            };
            tokens.push(lastToken);
        }
        const match = matchResult[0];
        lastIndex = matchResult.index + match.length;
        if (match === '\\%' || match === '%%') {
            if (lastToken && lastToken.type === 'literal') {
                lastToken.literal += '%';
            }
            else {
                lastToken = {
                    literal: '%',
                    type: 'literal',
                };
                tokens.push(lastToken);
            }
        }
        else if (matchResult.groups) {
            lastToken = {
                conversion: matchResult.groups.conversion,
                flag: matchResult.groups.flag || null,
                placeholder: match,
                position: matchResult.groups.position ? Number.parseInt(matchResult.groups.position, 10) - 1 : argumentIndex++,
                precision: matchResult.groups.precision ? Number.parseInt(matchResult.groups.precision.slice(1), 10) : null,
                type: 'placeholder',
                width: matchResult.groups.width ? Number.parseInt(matchResult.groups.width, 10) : null,
            };
            tokens.push(lastToken);
        }
    }
    if (lastIndex <= subject.length - 1) {
        if (lastToken && lastToken.type === 'literal') {
            lastToken.literal += subject.slice(lastIndex);
        }
        else {
            tokens.push({
                literal: subject.slice(lastIndex),
                type: 'literal',
            });
        }
    }
    return tokens;
};
exports.tokenize = tokenize;

},{}],10:[function(require,module,exports){
/*
object-assign
(c) Sindre Sorhus
@license MIT
*/

'use strict';
/* eslint-disable no-unused-vars */
var getOwnPropertySymbols = Object.getOwnPropertySymbols;
var hasOwnProperty = Object.prototype.hasOwnProperty;
var propIsEnumerable = Object.prototype.propertyIsEnumerable;

function toObject(val) {
	if (val === null || val === undefined) {
		throw new TypeError('Object.assign cannot be called with null or undefined');
	}

	return Object(val);
}

function shouldUseNative() {
	try {
		if (!Object.assign) {
			return false;
		}

		// Detect buggy property enumeration order in older V8 versions.

		// https://bugs.chromium.org/p/v8/issues/detail?id=4118
		var test1 = new String('abc');  // eslint-disable-line no-new-wrappers
		test1[5] = 'de';
		if (Object.getOwnPropertyNames(test1)[0] === '5') {
			return false;
		}

		// https://bugs.chromium.org/p/v8/issues/detail?id=3056
		var test2 = {};
		for (var i = 0; i < 10; i++) {
			test2['_' + String.fromCharCode(i)] = i;
		}
		var order2 = Object.getOwnPropertyNames(test2).map(function (n) {
			return test2[n];
		});
		if (order2.join('') !== '0123456789') {
			return false;
		}

		// https://bugs.chromium.org/p/v8/issues/detail?id=3056
		var test3 = {};
		'abcdefghijklmnopqrst'.split('').forEach(function (letter) {
			test3[letter] = letter;
		});
		if (Object.keys(Object.assign({}, test3)).join('') !==
				'abcdefghijklmnopqrst') {
			return false;
		}

		return true;
	} catch (err) {
		// We don't expect any of the above to throw, but better to be safe.
		return false;
	}
}

module.exports = shouldUseNative() ? Object.assign : function (target, source) {
	var from;
	var to = toObject(target);
	var symbols;

	for (var s = 1; s < arguments.length; s++) {
		from = Object(arguments[s]);

		for (var key in from) {
			if (hasOwnProperty.call(from, key)) {
				to[key] = from[key];
			}
		}

		if (getOwnPropertySymbols) {
			symbols = getOwnPropertySymbols(from);
			for (var i = 0; i < symbols.length; i++) {
				if (propIsEnumerable.call(from, symbols[i])) {
					to[symbols[i]] = from[symbols[i]];
				}
			}
		}
	}

	return to;
};

},{}],11:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],12:[function(require,module,exports){
const assert = require("assert");
const dlg_reset = require('./reset-dlg');

const {read_i32} = require('../external/wasm-printf');

const RESERVED_REGION = 10000;

const COLORS = {ovw:
                {bg: '#E0E0E0',
                 env: '#A0E0A0',
                 win: 'white',
                 win_border: 'darkblue'},
              map:
                {bg: 'white',
                  cell: 'darkmagenta'}};

function Canvas(elm, density) {
  this.ctx = elm.getContext("2d");
  this.W = elm.clientWidth;
  this.H = elm.clientHeight;
  elm.width = this.W * density;
  elm.height = this.H * density;
  this.scale = {x: elm.width/elm.clientWidth, y: elm.height/elm.clientHeight};
}

Canvas.prototype.fillRect = function(x, y, w, h) {
  this.ctx.fillRect(x*this.scale.x, y*this.scale.y, w*this.scale.x, h*this.scale.y);
}

Canvas.prototype.strokeRect = function(x, y, w, h) {
  this.ctx.strokeRect(x*this.scale.x, y*this.scale.y, w*this.scale.x, h*this.scale.y);
}

Canvas.prototype.update_vp = function () {
  assert(this.vp_temp.cell);
  this.vp = this.vp_temp;
  this.vp_temp = {};
}

function PanZoom(elm, cvs, update_fn) {
  this.elm = elm;
  this.cvs = cvs;
  this.update_fn = update_fn;
  this.touches = [];
  this.ts = 0;
}

PanZoom.prototype.scroll = function (k, dx, dy) {
  this.cvs.vp.x0 += k * dx / this.cvs.vp.cell;
  this.cvs.vp.y0 += k * dy / this.cvs.vp.cell;

  this._redraw();
}

PanZoom.prototype.zoom = function (k, x, y) {
  const d = {x: x / this.cvs.vp.cell, y: y / this.cvs.vp.cell};
  const o = {x: this.cvs.vp.x0 + d.x, y: this.cvs.vp.y0 + d.y};
  this.cvs.vp.cell *= k;
  this.cvs.vp.x0 = o.x - d.x/k;
  this.cvs.vp.y0 = o.y - d.y/k;

  this._redraw();
}

PanZoom.prototype.down = function (id, x, y) {
  const idx = this.touches.findIndex(t => t.id === id);
  if (idx >= 0) return;
  if (this.touches.length >= 2)
    return;

  if (this.touches.length === 1) {
    this.cvs.update_vp ();
    const t = this.touches[0];
    t.x0 = t.x;
    t.y0 = t.y;
  }

  this.elm.setPointerCapture(id);
  this.touches.push({id: id, x0: x, y0: y, x: x, y : y});
  this.cvs.vp_temp = {...this.cvs.vp};
}

PanZoom.prototype._adjust_vp = function(a, b) {
  const os = this.cvs.vp.cell;
  if (b) {
    const old_d = (a.x0 - b.x0)**2 + (a.y0 - b.y0)**2;
    const new_d = (a.x - b.x)**2 + (a.y - b.y)**2;
    const ns = os * new_d/old_d;
    const shift = {x: ((a.x + b.x)/ns - (a.x0 + b.x0)/os)/2, y: ((a.y + b.y)/ns - (a.y0 + b.y0)/os)/2};

    this.cvs.vp_temp.cell = ns;
    this.cvs.vp_temp.x0 = this.cvs.vp.x0 - shift.x;
    this.cvs.vp_temp.y0 = this.cvs.vp.y0 - shift.y;
  }
  else {
    this.cvs.vp_temp.cell = os;
    this.cvs.vp_temp.x0 = this.cvs.vp.x0 - (a.x - a.x0) / os;
    this.cvs.vp_temp.y0 = this.cvs.vp.y0 - (a.y - a.y0) / os;
  }
}

PanZoom.prototype.move = function (id, x, y) {
  const idx = this.touches.findIndex(x => x.id === id);
  if (idx < 0) return;

  this.touches[idx].x = x;
  this.touches[idx].y = y;

  this._adjust_vp(...this.touches);
  this._redraw();
}

PanZoom.prototype.up = function (id) {
  const idx = this.touches.findIndex(x => x.id === id);
  if (idx < 0) return;

  this.touches.splice(idx, 1);
  this.elm.releasePointerCapture(id);
  this.cvs.update_vp();

  if (this.touches.length === 1) {
    const t = this.touches[0];
    t.x0 = t.x;
    t.y0 = t.y;
  }
}

PanZoom.prototype._redraw = function () {
  const frozen_vp = {...this.cvs.vp_temp};
  window.requestAnimationFrame(ts => {
    if (ts > this.ts) {
      this.ts = ts;
      this.update_fn(this.cvs, frozen_vp);
    }
  });
}

function init (controls, life_api) {
  const default_cell = 20;

  let env = get_envelope(life_api);
  let generation = 1;
  let walkInt = null;
  let is_running = false;

  console.log("envelope =", env);
  let manually_changed = true;

  const ovw = new Canvas(controls.cvs_ovw, 2);
  const map = new Canvas(controls.cvs_map, 2);

  map.vp = {cell: default_cell};
  map.vp.x0 = (env.x0 + env.x1)/2 - map.W/map.vp.cell/2;
  map.vp.y0 = (env.y0 + env.y1)/2 - map.H/map.vp.cell/2;
  map.vp_temp = {};

  console.log("Viewport: ", map.vp);

  console.log("MAP:", map.W, map.H, controls.cvs_map.width, controls.cvs_map.height);
  console.log("OVW:", ovw.W, ovw.H, controls.cvs_ovw.width, controls.cvs_ovw.height);

  update_map (controls, life_api, map, map.vp_temp, ovw, env);

  const panZoom = new PanZoom(controls.cvs_map, map,
        (cvs, vp) => update_map (controls, life_api, cvs, vp, ovw, env));

  // These events support pan with a mouse or pan/pinch zoom with multi-touch
  const pointerPanZoom = evt => {
    evt.preventDefault();
    const rect = controls.cvs_map.getBoundingClientRect();

    if (evt.type === "pointerdown")
      panZoom.down(evt.pointerId, evt.clientX - rect.left, evt.clientY - rect.top);
    else if (evt.type === "pointermove")
      panZoom.move(evt.pointerId, evt.clientX - rect.left, evt.clientY - rect.top);
    else
      panZoom.up(evt.pointerId);
  };

  ["pointerdown", "pointermove", "pointerup", "pointercancel", "pointerout", "pointerleave"].forEach(x =>
    controls.cvs_map.addEventListener(x, pointerPanZoom));

  // These events support pan/zoom with a mouse wheel or a trackpad
  const wheelPanZoom = evt => {
    evt.preventDefault();

    if (evt.ctrlKey) {
      const rect = controls.cvs_map.getBoundingClientRect();
      panZoom.zoom(1 - evt.deltaY * 0.01, evt.clientX - rect.left, evt.clientY - rect.top);
    }
    else
      panZoom.scroll(2, evt.deltaX, evt.deltaY);
  }

  controls.cvs_map.addEventListener("mousewheel", wheelPanZoom);

  const onClick = evt => {
    if (!controls.cb_edit.checked)
      return;

    const rect = controls.cvs_map.getBoundingClientRect();
    const ix = Math.floor(map.vp.x0 + (evt.clientX - rect.left)/map.vp.cell);
    const iy = Math.floor(map.vp.y0 + (evt.clientY - rect.top) /map.vp.cell);

    const val = life_api.life_get_cell(ix, iy);
    life_api.life_set_cell(ix, iy, 1 - val);
    env = get_envelope(life_api);
    update_map (controls, life_api, map, map.vp_temp, ovw, env);
    manually_changed = true;
  }

  controls.cvs_map.addEventListener("click", onClick);

  const one_step = () => {
    if (manually_changed) {
      life_api.life_prepare();
      generation = 1;
      manually_changed = false;
    }
    const cycle = life_api.life_step() !== 0;
    generation ++;
    env = get_envelope(life_api);
    update_map (controls, life_api, map, map.vp_temp, ovw, env);
    controls.lb_gen.innerText = generation;

    if (cycle && walkInt)
      cancelWalk();
  };

  controls.bt_step.addEventListener("click", one_step);

  const cancelWalk = () => {
    window.clearInterval(walkInt);
    walkInt = null;

    controls.bt_step.disabled = false;
    controls.bt_walk.innerText = controls.bt_walk.dataset.value;
    controls.bt_run.disabled = false;
  }

  controls.bt_walk.addEventListener("click", function () {
    if (walkInt)
      cancelWalk();

    else {
      const val = controls.txt_int.value;
      const f_val = parseFloat(val);
      if (isNaN(f_val))
        alert("Invalid interval " + val);
      else {
        walkInt = window.setInterval(one_step, 1000 * Math.max(1 / 60, f_val));
        controls.bt_step.disabled = true;
        controls.bt_walk.dataset.value = controls.bt_walk.innerText;
        controls.bt_walk.innerText = "Stop";
        controls.bt_run.disabled = true;
      }
    }
  });

  const runTillStopped = () => {
    const limit = 0.1;
    const t0 = window.performance.now();
    let cycle = false;
    do {
      cycle = life_api.life_step() !== 0;
      generation++;
    }
    while(is_running && !cycle && window.performance.now() < t0 + 1000 * limit);

    if (cycle)
      is_running = false;

    env = get_envelope(life_api);
    update_map (controls, life_api, map, map.vp_temp, ovw, env);
    controls.lb_gen.innerText = generation;

    if (is_running)
      window.setTimeout(runTillStopped, 0);
    else {
      controls.bt_step.disabled = false;
      controls.bt_walk.disabled = false;
      controls.bt_run.disabled = false;

      controls.bt_run.innerText = controls.bt_run.dataset.value;
    }
  }

  controls.bt_run.addEventListener("click", function () {
    if (is_running) {
      is_running = false;
      controls.bt_run.disabled = true;
    }
    else {
      if (manually_changed) {
        life_api.life_prepare();
        generation = 1;
        manually_changed = false;
      }

      controls.bt_step.disabled = true;
      controls.bt_walk.disabled = true;
      controls.bt_run.dataset.value = controls.bt_run.innerText;
      controls.bt_run.innerText = "Stop";

      is_running = true;

      runTillStopped ();
    }

  });

  controls.bt_reset.addEventListener("click", function () {
    dlg_reset.show(sel => {
      reset_board(life_api, map, sel);

      env = get_envelope(life_api);
      if (sel.type !== "random") {
        map.vp = {cell: default_cell};
        map.vp.x0 = (env.x0 + env.x1) / 2 - map.W / map.vp.cell / 2;
        map.vp.y0 = (env.y0 + env.y1) / 2 - map.H / map.vp.cell / 2;
      }

      manually_changed = true;
      update_map (controls, life_api, map, map.vp_temp, ovw, env);
    });
  });

}

function reset_board(life_api, map, sel) {
  life_api.clear ();

  if (sel.type === "life") {
    const s_rows = sel.life.split('|');
    const Y = s_rows.length;
    const X = s_rows[0].length;
    for (let y = 0; y < Y; y ++)
      for (let x = 0; x < X; x ++)
        if (s_rows[y][x] === 'x')
          life_api.life_set_cell(x, y, 1);
  }
  else if (sel.type === "random") {
    const [ix0, ix1] = [Math.ceil(map.vp.x0), Math.floor(map.vp.x0 + map.W/map.vp.cell)];
    const [iy0, iy1] = [Math.ceil(map.vp.y0), Math.floor(map.vp.y0 + map.H/map.vp.cell)];

    for (let y = iy0; y <= iy1; y ++)
      for (let x = ix0; x <= ix1; x ++)
        if (Math.random() < sel.density)
          life_api.life_set_cell(x, y, 1);
  }
}

function get_envelope(life_api) {
  const envelope = life_api.find_envelope();
  const linear_memory = new Uint8Array(life_api.memory.buffer);
  const [x0, x1, y0, y1] = [...Array(4).keys()].map(i => read_i32(linear_memory, envelope + 4*i));
  return {x0: x0, x1: x1, y0: y0, y1: y1};
}

function update_ovw(ovw, env, win) {
  ovw.ctx.fillStyle = COLORS.ovw.bg;
  ovw.fillRect(0, 0, ovw.W, ovw.H);

  const eps = 0.05;

  const full = {x0: Math.min(env.x0, win.x0), x1: Math.max(env.x1, win.x1),
                y0: Math.min(env.y0, win.y0), y1: Math.max(env.y1, win.y1)};
  const ext = {x0: full.x0 - eps * (full.x1 - full.x0), x1: full.x1 + eps * (full.x1 - full.x0),
               y0: full.y0 - eps * (full.y1 - full.y0), y1: full.y1 + eps * (full.y1 - full.y0)};
  const scale = Math.min(ovw.W / (ext.x1 - ext.x0), ovw.H / (ext.y1 - ext.y0));

  ovw.ctx.fillStyle = COLORS.ovw.env;
  ovw.fillRect((env.x0 - ext.x0)*scale, (env.y0 - ext.y0)*scale, (env.x1 - env.x0)*scale, (env.y1 - env.y0)*scale);

  ovw.ctx.fillStyle = COLORS.ovw.win;
  ovw.fillRect((win.x0 - ext.x0)*scale, (win.y0 - ext.y0)*scale, (win.x1 - win.x0)*scale, (win.y1 - win.y0)*scale);

  ovw.ctx.strokeStyle = COLORS.ovw.win_border;
  ovw.strokeRect((win.x0 - ext.x0)*scale, (win.y0 - ext.y0)*scale, (win.x1 - win.x0)*scale, (win.y1 - win.y0)*scale);
}

function update_map (controls, life_api, map, _vp, ovw, env) {
  const vp = _vp.cell === undefined ? map.vp : _vp;
  const win = {x0: vp.x0, x1: vp.x0 + map.W/vp.cell, y0: vp.y0, y1: vp.y0 + map.H/vp.cell};

  update_ovw(ovw, env, win);

  const new_disabled = vp.cell < 5;
  if (controls.cb_edit.disabled && !new_disabled) {
    controls.cb_edit.disabled = false;
    controls.cb_edit.checked = controls.cb_edit_state;
  }
  else if (!controls.cb_edit.disabled && new_disabled) {
    controls.cb_edit_state = controls.cb_edit.checked;
    controls.cb_edit.checked = false;
    controls.cb_edit.disabled = true;
  }

  // console.log("Region: ", vp.x0, x1, vp.y0, y1);
  const [ix0, ix1, iy0, iy1] = [Math.max(env.x0, Math.floor(win.x0)), Math.min(env.x1, Math.ceil(win.x1)),
                                Math.max(env.y0, Math.floor(win.y0)), Math.min(env.y1, Math.ceil(win.y1))];

  // console.log("Integer region:", ix0, ix1, iy0, iy1);
  const scale = Math.ceil(1/vp.cell);
  const [X, Y] = [ix1 - ix0 + 1, iy1 - iy0 + 1];
  if (X <= 0 || Y <= 0) return;

  const Ys = Math.ceil(Y/scale);
  const nCols = scale * Math.floor(Math.min(X, Math.floor(scale * RESERVED_REGION/Ys)) / scale);
  assert(nCols > 0);

  map.ctx.fillStyle = COLORS.map.bg;
  map.ctx.fillRect(0, 0, map.W * map.scale.x, map.H * map.scale.y);
  map.ctx.fillStyle = COLORS.map.cell;

  for(let iBand = 0; nCols * iBand < X; iBand ++) {
    const xb0 = iBand * nCols;
    const Xb = Math.min(X, xb0 + nCols) - xb0;

    assert(Xb <= nCols);

    const linear_memory = new Uint8Array(life_api.memory.buffer);

    // console.log("Read region", ix0 + xb0, iy0, Xb, Y);
    if (scale === 1) {
      const region = life_api.read_region(ix0 + xb0, iy0, Xb, Y);
      const gap = Math.floor(vp.cell/10);

      for (let y = 0; y < Y; y++)
        for (let x = 0; x < Xb; x++)
          if (1 === linear_memory[region + y * Xb + x]) {
            const xs = (ix0 + xb0 + x - vp.x0) * vp.cell;
            const ys = (iy0 + y - vp.y0) * vp.cell;
            map.ctx.fillRect(xs * map.scale.x + gap/2, ys * map.scale.y + gap/2,
                  vp.cell * map.scale.x - gap, vp.cell * map.scale.y - gap);
          }
    }
    else {
      const Xs = Math.ceil(Xb/scale);
      const region = life_api.read_region_scale(ix0 + xb0, iy0, Xs, Ys, scale);
      for (let y = 0; y < Ys; y++)
        for (let x = 0; x < Xs; x++)
          if (linear_memory[region + y * Xs + x] > 0) {
            const xs = (ix0 + xb0 + x * scale - vp.x0) * vp.cell;
            const ys = (iy0 + y * scale - vp.y0) * vp.cell;
            map.ctx.fillRect(xs * map.scale.x, ys * map.scale.y, vp.cell * map.scale.x * scale, vp.cell * map.scale.y * scale);
          }
    }
  }
}

module.exports = {
  init: init
};
},{"../external/wasm-printf":1,"./reset-dlg":14,"assert":2}],13:[function(require,module,exports){
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
      cb_edit: document.getElementById('edit'),
      bt_step: document.getElementById("bt-step"),
      bt_walk: document.getElementById("bt-walk"),
      bt_run: document.getElementById("bt-run"),
      bt_reset: document.getElementById("bt-reset"),
      lb_gen: document.getElementById("lb-gen"),
      txt_int: document.getElementById("txt-int")
    };

    display_init(controls, life_api);
  });
}

main ();
},{"../external/wasm-printf":1,"./life-display":12}],14:[function(require,module,exports){
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
},{}]},{},[13]);
