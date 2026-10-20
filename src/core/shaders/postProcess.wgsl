@binding(0) @group(0) var screenTexture: texture_2d<f32>;
@binding(1) @group(0) var screenSampler: sampler;

@binding(0) @group(1) var glowTexture: texture_2d<f32>;
@binding(1) @group(1) var glowSampler: sampler;

const GLOW_THRESHOLD: f32 = 100.8;

@fragment
fn fragment_main(
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>
) -> @location(0) vec4<f32> {
  let screenSample: vec4<f32> = textureSample(screenTexture, screenSampler, uv);
  let glowSample: vec4<f32> = textureSample(glowTexture, glowSampler, uv);

  return screenSample + glowSample;
}
