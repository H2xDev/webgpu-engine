/**
  * Adds some swizzle methods to a Vector3 object.
  * @param { [number, number, number] } source The source vector to proxy.
  */
export const ProxyVector3 = (source) => new Proxy(source, {
  get(target, prop) {
    if (prop === 'x') return target[0];
    if (prop === 'y') return target[1];
    if (prop === 'z') return target[2];
    if (prop === 'xy') return [target[0], target[1]];
    if (prop === 'xz') return [target[0], target[2]];
    if (prop === 'yz') return [target[1], target[2]];
    if (prop === 'xyz') return [target[0], target[1], target[2]];
    if (prop === 'zz') return [target[2], target[2]];
    if (prop === 'xx') return [target[0], target[0]];
    if (prop === 'yy') return [target[1], target[1]];
    if (prop === 'length') return Math.hypot(target[0], target[1], target[2]);
    if (prop === 'normalized') {
      const length = Math.hypot(target[0], target[1], target[2]);
      if (length === 0) return [0, 0, 0];
      return [target[0] / length, target[1] / length, target[2] / length];
    }
    if (prop === 'toString') {
      return () => `Vector3(${target[0]}, ${target[1]}, ${target[2]})`;
    }

    if (prop === 'raw') {
      return target;
    }
    return Reflect.get(target, prop);
  },
  set(target, prop, value) {
    if (prop === 'x') { target[0] = value; return true; }
    if (prop === 'y') { target[1] = value; return true; }
    if (prop === 'z') { target[2] = value; return true; }
    if (prop === 'xy') { target[0] = value[0]; target[1] = value[1]; return true; }
    if (prop === 'xz') { target[0] = value[0]; target[2] = value[1]; return true; }
    if (prop === 'yz') { target[1] = value[0]; target[2] = value[1]; return true; }
    if (prop === 'xyz') { target[0] = value[0]; target[1] = value[1]; target[2] = value[2]; return true; }
    if (prop === 'zz') { target[2] = value[0]; return true; }
    if (prop === 'xx') { target[0] = value[0]; return true; }
    if (prop === 'yy') { target[1] = value[0]; return true; }
    return Reflect.set(target, prop, value);
  }
});
