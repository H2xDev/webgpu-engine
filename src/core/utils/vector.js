const isArrayLike = (value) => typeof value !== 'number' && value != null && typeof value.length === 'number';

const elementwise = (a, b, fn) => {
    if (!isArrayLike(a) && !isArrayLike(b)) return fn(a, b);

    const source = isArrayLike(a) ? a : b;
    if (isArrayLike(a) && isArrayLike(b) && a.length !== b.length) {
        throw new RangeError(`Vector length mismatch: ${a.length} and ${b.length}`);
    }

    const out = new source.constructor(source.length);
    for (let i = 0; i < source.length; i++) {
        out[i] = fn(isArrayLike(a) ? a[i] : a, isArrayLike(b) ? b[i] : b);
    }

    return out;
};

const runtime = {
    add: (a, b) => elementwise(a, b, (x, y) => x + y),
    sub: (a, b) => elementwise(a, b, (x, y) => x - y),
    mul: (a, b) => elementwise(a, b, (x, y) => x * y),
    div: (a, b) => elementwise(a, b, (x, y) => x / y),
    neg: (a) => elementwise(a, 0, (x) => -x),
    pending: new Map(),
    into: (id, value) => {
        const target = runtime.pending.get(id);
        runtime.pending.delete(id);

        if (!isArrayLike(value)) throw new TypeError('Expression must evaluate to a vector to be written into an existing vector');
        if (target.length !== value.length) {
            throw new RangeError(`Vector length mismatch: ${target.length} and ${value.length}`);
        }

        for (let i = 0; i < value.length; i++) target[i] = value[i];
        return target;
    },
};

let nextTargetId = 0;

// Generated code references the helpers through this global key, since the
// caller's direct eval cannot see anything defined inside this module.
const RUNTIME_KEY = '__veval';
globalThis[RUNTIME_KEY] ??= runtime;

const TOKEN_PATTERN = /\s*(\d+\.?\d*(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?|[A-Za-z_$][\w$]*|[-+*/()])/y;

const tokenize = (source) => {
    const tokens = [];
    let index = 0;

    while (index < source.length) {
        if (/^\s*$/.test(source.slice(index))) break;

        TOKEN_PATTERN.lastIndex = index;
        const match = TOKEN_PATTERN.exec(source);
        if (!match) {
            const at = index + source.slice(index).search(/\S/);
            throw new SyntaxError(`Unexpected character at position ${at}: '${source[at]}'`);
        }

        tokens.push(match[1]);
        index = TOKEN_PATTERN.lastIndex;
    }

    return tokens;
};

const parse = (tokens) => {
    let pos = 0;
    const peek = () => tokens[pos];
    const next = () => tokens[pos++];

    const parseExpression = () => {
        let left = parseTerm();
        while (peek() === '+' || peek() === '-') {
            const op = next();
            left = `${RUNTIME_KEY}.${op === '+' ? 'add' : 'sub'}(${left}, ${parseTerm()})`;
        }
        return left;
    };

    const parseTerm = () => {
        let left = parseUnary();
        while (peek() === '*' || peek() === '/') {
            const op = next();
            left = `${RUNTIME_KEY}.${op === '*' ? 'mul' : 'div'}(${left}, ${parseUnary()})`;
        }
        return left;
    };

    const parseUnary = () => {
        if (peek() === '-') {
            next();
            return `${RUNTIME_KEY}.neg(${parseUnary()})`;
        }
        if (peek() === '+') {
            next();
            return parseUnary();
        }
        return parsePrimary();
    };

    const parsePrimary = () => {
        const token = next();
        if (token === undefined) throw new SyntaxError('Unexpected end of expression');

        if (token === '(') {
            const inner = parseExpression();
            if (next() !== ')') throw new SyntaxError('Expected closing parenthesis');
            return `(${inner})`;
        }

        if (/^[\d.]/.test(token) || /^[A-Za-z_$]/.test(token)) return token;

        throw new SyntaxError(`Unexpected token '${token}'`);
    };

    const result = parseExpression();
    if (pos !== tokens.length) throw new SyntaxError(`Unexpected token '${tokens[pos]}'`);

    return result;
};

/**
 * Rewrites a vector expression into plain JavaScript that can be evaluated in the caller's scope.
 * Operators `+ - * /` and unary `-` are routed through vector-aware helpers, so arrays and typed
 * arrays are combined element-wise and numbers broadcast against them. If `out` is given, the
 * result is written into it (same length required) and `out` is returned.
 *
 * Use it with a direct eval so the expression can see local variables:
 *
 * @param { string } operations
 * @param { ArrayLike<number> } [out] existing vector to mutate with the result
 * @returns { string } JavaScript source to pass to `eval`
 *
 * @example
 * ```js
 * const vec1 = [1, 1, 0]
 * const vec2 = [1, 0, 1]
 * const vec3 = eval(veval("(vec1 + vec2) * 2.0"));
 * eval(veval("vec1 + vec2", vec3)); // writes [2, 1, 1] into vec3
 * ```
 */
export const veval = (operations, out) => {
    const expression = parse(tokenize(String(operations)));
    if (out === undefined) return expression;

    const id = nextTargetId++;
    runtime.pending.set(id, out);
    return `${RUNTIME_KEY}.into(${id}, ${expression})`;
};
