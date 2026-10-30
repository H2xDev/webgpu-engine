@binding(0) @group(0) var screenTexture: texture_2d<f32>;
@binding(1) @group(0) var screenSampler: sampler;

@binding(0) @group(1) var glowTexture: texture_2d<f32>;
@binding(1) @group(1) var glowSampler: sampler;


const FXAA_REDUCE_MIN: f32 = 1.0 / 128.0;
const FXAA_REDUCE_MUL: f32 = 1.0 / 8.0;
const FXAA_SPAN_MAX: f32 = 8.0;

fn luma(c: vec3<f32>) -> f32 {
  return dot(c, vec3<f32>(0.299, 0.587, 0.114));
}

fn fxaa(uv: vec2<f32>) -> vec4<f32> {
  let texel = 1.0 / vec2<f32>(textureDimensions(screenTexture));

  let center = textureSampleLevel(screenTexture, screenSampler, uv, 0.0);
  let rgbNW = textureSampleLevel(screenTexture, screenSampler, uv + vec2<f32>(-1.0, -1.0) * texel, 0.0).rgb;
  let rgbNE = textureSampleLevel(screenTexture, screenSampler, uv + vec2<f32>(1.0, -1.0) * texel, 0.0).rgb;
  let rgbSW = textureSampleLevel(screenTexture, screenSampler, uv + vec2<f32>(-1.0, 1.0) * texel, 0.0).rgb;
  let rgbSE = textureSampleLevel(screenTexture, screenSampler, uv + vec2<f32>(1.0, 1.0) * texel, 0.0).rgb;

  let lNW = luma(rgbNW);
  let lNE = luma(rgbNE);
  let lSW = luma(rgbSW);
  let lSE = luma(rgbSE);
  let lM = luma(center.rgb);

  let lMin = min(lM, min(min(lNW, lNE), min(lSW, lSE)));
  let lMax = max(lM, max(max(lNW, lNE), max(lSW, lSE)));

  var dir = vec2<f32>(
    -((lNW + lNE) - (lSW + lSE)),
    (lNW + lSW) - (lNE + lSE)
  );

  let dirReduce = max((lNW + lNE + lSW + lSE) * 0.25 * FXAA_REDUCE_MUL, FXAA_REDUCE_MIN);
  let rcpDirMin = 1.0 / (min(abs(dir.x), abs(dir.y)) + dirReduce);
  dir = clamp(dir * rcpDirMin, vec2<f32>(-FXAA_SPAN_MAX), vec2<f32>(FXAA_SPAN_MAX)) * texel;

  let rgbA = 0.5 * (
    textureSampleLevel(screenTexture, screenSampler, uv + dir * (1.0 / 3.0 - 0.5), 0.0).rgb +
    textureSampleLevel(screenTexture, screenSampler, uv + dir * (2.0 / 3.0 - 0.5), 0.0).rgb
  );
  let rgbB = rgbA * 0.5 + 0.25 * (
    textureSampleLevel(screenTexture, screenSampler, uv + dir * -0.5, 0.0).rgb +
    textureSampleLevel(screenTexture, screenSampler, uv + dir * 0.5, 0.0).rgb
  );

  let lB = luma(rgbB);
  if (lB < lMin || lB > lMax) {
    return vec4<f32>(rgbA, center.a);
  }
  return vec4<f32>(rgbB, center.a);
}

@fragment
fn fragment_main(
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>
) -> @location(0) vec4<f32> {
  let screenSample: vec4<f32> = fxaa(uv);
  let glowSample: vec4<f32> = textureSample(glowTexture, glowSampler, uv);

  return screenSample + glowSample;
}
