fn shadowPCF(
  shadowMap: texture_depth_2d,
  shadowMapSampler: sampler_comparison,
  uv: vec2<f32>,
  depth: f32
) -> f32 {
  var shadow: f32 = 0.0;
  let texel_size: vec2<f32> = 1.0 / vec2<f32>(textureDimensions(shadowMap, 0)) / 1.0;

  for (var x: f32 = -1; x <= 1; x = x + 0.5) {
    for (var y: f32 = -1; y <= 1; y = y + 0.5) {
      let offset: vec2<f32> = vec2<f32>(f32(x), f32(y)) * texel_size;
      shadow += textureSampleCompare(
        shadowMap,
        shadowMapSampler,
        uv + offset,
        depth - 0.0001
      );
    }
  }

  return shadow / 18.0;
}

fn getShadowValue(
  shadowMap: texture_depth_2d,
  shadowMapSampler: sampler_comparison,
  depthCoord: vec4<f32>
) -> f32 {
  let shadowProj: vec3<f32> = depthCoord.xyz / depthCoord.w;
  let shadowUV: vec2<f32> = vec2<f32>(shadowProj.x * 0.5 + 0.5, shadowProj.y * 0.5 + 0.5);

  let shadowCoord = vec2<f32>(shadowUV.x, 1.0 - shadowUV.y);
  var shadowValue: f32 = shadowPCF(shadowMap, shadowMapSampler, shadowCoord, shadowProj.z);

  let outside = any(shadowCoord < vec2<f32>(0.0))
    || any(shadowCoord > vec2<f32>(1.0))
    || shadowProj.z > 1.0
    || shadowProj.z < 0.0;

  return select(shadowValue, 1.0, outside);
}
