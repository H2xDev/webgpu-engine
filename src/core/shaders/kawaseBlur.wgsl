struct BlurParams {
  passIndex: u32
};

@binding(0) @group(0) var inputTexture: texture_2d<f32>;
@binding(1) @group(0) var inputSampler: sampler;
@binding(2) @group(0) var<uniform> blurParams: BlurParams;

#include "fullscreenTriangle"

@fragment
fn fragment_main(
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>
) -> @location(0) vec4<f32> {
  let dimensions = vec2<f32>(textureDimensions(inputTexture));
  let texelSize = vec2<f32>(1.0) / dimensions;
  let offset = (f32(blurParams.passIndex) + 1.0) * 0.1;

  var sample = textureSample(inputTexture, inputSampler, uv + texelSize * offset);
  sample += textureSample(inputTexture, inputSampler, uv + vec2f(-texelSize.x, texelSize.y) * offset);
  sample += textureSample(inputTexture, inputSampler, uv - texelSize * offset);
  sample += textureSample(inputTexture, inputSampler, uv + vec2f(texelSize.x, -texelSize.y) * offset);
  sample *= 0.25;

  return sample;
}
