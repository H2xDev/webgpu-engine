@binding(0) @group(0) var screenTexture: texture_2d<f32>;
@binding(1) @group(0) var screenSampler: sampler;

@fragment
fn main(
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>
) -> @location(0) vec4<f32> {
  let color = textureSample(screenTexture, screenSampler, uv).rgb;
  let threshold = 0.5;
  let knee = 0.5;

  let luminance = dot(color, vec3f(0.2126, 0.7152, 0.0722));
  let soft = clamp(luminance - threshold + knee, 0.0, 2.0 * knee);
  let softContribution = soft * soft / (4.0 * knee + 0.0001);

  let contribution = max(luminance - threshold, softContribution);
  let bloomColor = color * (contribution / max(luminance, 0.0001));

  return vec4f(bloomColor, 1.0);
}
