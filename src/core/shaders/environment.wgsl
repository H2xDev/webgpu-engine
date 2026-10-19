struct CameraData {
  view: mat4x4<f32>,
  transform: mat4x4<f32>,
  projection: mat4x4<f32>,
};

struct EnvironmentData {
  cameraData: CameraData,
  energy: f32,
};

@binding(0) @group(0) var panoramaTexture: texture_2d<f32>;
@binding(1) @group(0) var panoramaSampler: sampler;
@binding(2) @group(0) var<uniform> envData: EnvironmentData;

const PI: f32 = 3.1415926535897932384626433832795;

#include "fullscreenTriangle"

@fragment
fn fragment_main(
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>
) -> @location(0) vec4<f32> {
  var ndcUV: vec2<f32> = uv * 2.0 - 1.0; // Convert to NDC space

  let rayView = normalize(vec3<f32>(
    ndcUV.x / envData.cameraData.projection[0][0],
    -ndcUV.y / envData.cameraData.projection[1][1],
    -1.0
  ));

  let rayWorld = normalize((envData.cameraData.transform * vec4<f32>(rayView, 0.0)).xyz);
  let u = (0.5 - atan2(rayWorld.z, rayWorld.x) / (2.0 * PI));
  let v = (0.5 - asin(rayWorld.y) / PI);

  let color = textureSample(panoramaTexture, panoramaSampler, vec2<f32>(u, v)).rgb;

  return vec4<f32>(color, 1.0);
}
