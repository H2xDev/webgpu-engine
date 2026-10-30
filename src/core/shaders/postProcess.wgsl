@binding(0) @group(0) var screenTexture: texture_2d<f32>;
@binding(1) @group(0) var screenSampler: sampler;
@binding(2) @group(0) var depthTexture: texture_depth_2d;

@binding(0) @group(1) var glowTexture: texture_2d<f32>;
@binding(1) @group(1) var glowSampler: sampler;


const AA_EDGE_THRESHOLD: f32 = 0.02; // relative depth discontinuity
const AA_SPAN: f32 = 1.5;            // blur reach in texels

const CAMERA_NEAR: f32 = 0.1;
const CAMERA_FAR: f32 = 4000.0;
const AO_SAMPLES: i32 = 32;
const AO_RADIUS: f32 = 0.5;      // world units
const AO_BIAS: f32 = 0.01;       // world units
const AO_INTENSITY: f32 = 0.4;
const AO_MAX_SCREEN_RADIUS: f32 = 0.1; // fraction of screen height
const GOLDEN_ANGLE: f32 = 2.39996323;

fn linearDepth(d: f32) -> f32 {
  return CAMERA_NEAR * CAMERA_FAR / (CAMERA_FAR - d * (CAMERA_FAR - CAMERA_NEAR));
}

fn loadDepth(uv: vec2<f32>) -> f32 {
  let dims = vec2<f32>(textureDimensions(depthTexture));
  let p = clamp(vec2<i32>(uv * dims), vec2<i32>(0), vec2<i32>(dims) - vec2<i32>(1));
  return textureLoad(depthTexture, p, 0);
}

fn depthAt(p: vec2<i32>, maxP: vec2<i32>) -> f32 {
  let d = textureLoad(depthTexture, clamp(p, vec2<i32>(0), maxP), 0);
  return linearDepth(d);
}

// Depth-based edge-aware AA: detects geometry edges from depth discontinuities
// and blurs the color across them only.
fn depthAA(uv: vec2<f32>) -> vec4<f32> {
  let dims = vec2<i32>(textureDimensions(depthTexture));
  let maxP = dims - vec2<i32>(1);
  let p = clamp(vec2<i32>(uv * vec2<f32>(dims)), vec2<i32>(0), maxP);
  let texel = 1.0 / vec2<f32>(textureDimensions(screenTexture));

  let center = textureSampleLevel(screenTexture, screenSampler, uv, 0.0);

  let zC = depthAt(p, maxP);
  let zL = depthAt(p + vec2<i32>(-1, 0), maxP);
  let zR = depthAt(p + vec2<i32>(1, 0), maxP);
  let zU = depthAt(p + vec2<i32>(0, -1), maxP);
  let zD = depthAt(p + vec2<i32>(0, 1), maxP);

  // Second derivative ignores smooth slanted surfaces, reacts to silhouettes/creases
  let edgeX = abs(zL + zR - 2.0 * zC);
  let edgeY = abs(zU + zD - 2.0 * zC);
  let edge = max(edgeX, edgeY) / max(zC, 1e-4);
  let strength = smoothstep(AA_EDGE_THRESHOLD, AA_EDGE_THRESHOLD * 4.0, edge);
  if (strength <= 0.0) {
    return center;
  }

  // Depth gradient points across the edge; pick the nearer-side neighbors for stability
  var grad = vec2<f32>(zR - zL, zD - zU);
  if (dot(grad, grad) < 1e-12) {
    grad = vec2<f32>(edgeX, edgeY);
  }
  let dir = normalize(grad) * texel * AA_SPAN;

  let a = textureSampleLevel(screenTexture, screenSampler, uv - dir, 0.0).rgb;
  let b = textureSampleLevel(screenTexture, screenSampler, uv - dir * 0.5, 0.0).rgb;
  let c = textureSampleLevel(screenTexture, screenSampler, uv + dir * 0.5, 0.0).rgb;
  let d = textureSampleLevel(screenTexture, screenSampler, uv + dir, 0.0).rgb;

  let blurred = (a + b + c + d + center.rgb) * 0.2;
  return vec4<f32>(mix(center.rgb, blurred, strength), center.a);
}

fn interleavedGradientNoise(p: vec2<f32>) -> f32 {
  return fract(52.9829189 * fract(dot(p, vec2<f32>(0.06711056, 0.00583715))));
}

// Depth-only screen-space AO: returns occlusion visibility in [0, 1].
fn ambientOcclusion(uv: vec2<f32>, fragCoord: vec2<f32>) -> f32 {
  let rawDepth = loadDepth(uv);
  if (rawDepth >= 1.0) {
    return 1.0;
  }

  let dims = vec2<f32>(textureDimensions(depthTexture));
  let aspect = dims.x / dims.y;
  let z = linearDepth(rawDepth);

  // Project the world radius to screen space (approximated, clamped)
  let screenRadius = min(AO_RADIUS / z, AO_MAX_SCREEN_RADIUS);
  let rotation = interleavedGradientNoise(fragCoord) * 6.2831853;

  var occlusion = 0.0;
  for (var i = 0; i < AO_SAMPLES; i++) {
    let fi = f32(i);
    let t = (fi + 0.5) / f32(AO_SAMPLES);
    let angle = fi * GOLDEN_ANGLE + rotation;
    let offset = vec2<f32>(cos(angle) / aspect, sin(angle)) * sqrt(t) * screenRadius;

    let sampleUV = uv + offset;
    if (any(sampleUV < vec2<f32>(0.0)) || any(sampleUV > vec2<f32>(1.0))) {
      continue;
    }

    let sampleZ = linearDepth(loadDepth(sampleUV));
    let diff = z - sampleZ - AO_BIAS;
    if (diff > 0.0) {
      let rangeCheck = smoothstep(0.0, 1.0, AO_RADIUS / max(abs(z - sampleZ), 1e-4));
      occlusion += rangeCheck;
    }
  }

  occlusion = occlusion / f32(AO_SAMPLES);
  return clamp(1.0 - occlusion * AO_INTENSITY, 0.0, 1.0);
}

@fragment
fn fragment_main(
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>
) -> @location(0) vec4<f32> {
  var screenSample: vec4<f32> = depthAA(uv);
  let glowSample: vec4<f32> = textureSample(glowTexture, glowSampler, uv);

  let ao = ambientOcclusion(uv, position.xy);
  screenSample = vec4<f32>(screenSample.rgb * ao, screenSample.a);

  return screenSample + glowSample;
}
