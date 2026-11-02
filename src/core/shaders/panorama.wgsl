// Requires `PI` to be declared by the including shader.

fn directionToUV(dir: vec3<f32>) -> vec2<f32> {
  let u: f32 = 0.5 - atan2(dir.z, dir.x) / (2.0 * PI);
  let v: f32 = 0.5 - asin(clamp(dir.y, -1.0, 1.0)) / PI;
  return vec2<f32>(u, v);
}

fn uvToDirection(uv: vec2<f32>) -> vec3<f32> {
  let phi: f32 = (0.5 - uv.x) * 2.0 * PI;
  let theta: f32 = (0.5 - uv.y) * PI;
  let cosTheta: f32 = cos(theta);
  return vec3<f32>(cos(phi) * cosTheta, sin(theta), sin(phi) * cosTheta);
}
