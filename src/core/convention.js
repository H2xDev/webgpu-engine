export const REVERSED_Z = true;
export const DEPTH_CLEAR = REVERSED_Z ? 0.0 : 1.0;
export const DEPTH_COMPARE = REVERSED_Z ? "greater" : "less";
export const DEPTH_FORMAT = "depth32float";
export const OBJECT_SIZE = 112; // model matrix 4x4 + normalized matrix 3x3 = 112 bytes
export const OBJECT_STRIDE = 256;
