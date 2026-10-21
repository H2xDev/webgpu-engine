fn shadowPCF(
  shadowMap: texture_depth_2d,
  shadowMapSampler: sampler_comparison,
  uv: vec2<f32>,
  depth: f32
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
        depth - 0.001
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
  var shadowValue: f32 = shadowPCF(shadowMap, shadowMapSampler, shadowCoord, shadowProj.z);

  let outside = any(shadowCoord < vec2<f32>(0.0))
    || any(shadowCoord > vec2<f32>(1.0))
    || shadowProj.z > 1.0
    || shadowProj.z < 0.0;

  return select(shadowValue, 1.0, outside);
}
