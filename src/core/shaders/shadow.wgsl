fn shadowPCF(
  shadowMap: texture_depth_2d,
  shadowMapSampler: sampler_comparison,
  uv: vec2<f32>,
  depth: f32,
  depthGradient: vec2<f32>
) -> f32 {
  var shadow: f32 = 0.0;
  let texel_size: vec2<f32> = 1.0 / vec2<f32>(textureDimensions(shadowMap, 0));

  let radius: i32 = 3;
  var count: f32 = 0.0;

  for (var x: i32 = -radius; x <= radius; x++) {
    for (var y: i32 = -radius; y <= radius; y++) {
      let offset: vec2<f32> = vec2<f32>(f32(x), f32(y)) * texel_size;
      shadow += textureSampleCompare(
        shadowMap,
        shadowMapSampler,
        uv + offset,
        depth + dot(offset, depthGradient) - 0.005
      );
      count += 1.0;
    }
  }

  return shadow / count;
}

fn getShadowValue(
  shadowMap: texture_depth_2d,
  shadowMapSampler: sampler_comparison,
  depthCoord: vec4<f32>
) -> f32 {
  let shadowProj: vec3<f32> = depthCoord.xyz / depthCoord.w;
  let shadowUV: vec2<f32> = vec2<f32>(shadowProj.x * 0.5 + 0.5, shadowProj.y * 0.5 + 0.5);

  let shadowCoord = vec2<f32>(shadowUV.x, 1.0 - shadowUV.y);
  // Receiver-plane depth gradient in shadow-map UV space, so each PCF tap compares against the surface's own depth.
  let duvDx = dpdx(shadowCoord);
  let duvDy = dpdy(shadowCoord);
  let dzDx = dpdx(shadowProj.z);
  let dzDy = dpdy(shadowProj.z);
  let det = duvDx.x * duvDy.y - duvDx.y * duvDy.x;
  var gradient = vec2<f32>(0.0);
  if (abs(det) > 1e-12) {
    gradient = vec2<f32>(
      dzDx * duvDy.y - dzDy * duvDx.y,
      dzDy * duvDx.x - dzDx * duvDy.x
    ) / det;
  }
  gradient = clamp(gradient, vec2<f32>(-10.0), vec2<f32>(10.0));

  var shadowValue: f32 = shadowPCF(shadowMap, shadowMapSampler, shadowCoord, shadowProj.z, gradient);

  let outside = any(shadowCoord < vec2<f32>(0.0))
    || any(shadowCoord > vec2<f32>(1.0))
    || shadowProj.z > 1.0
    || shadowProj.z < 0.0;

  return select(shadowValue, 1.0, outside);
}
