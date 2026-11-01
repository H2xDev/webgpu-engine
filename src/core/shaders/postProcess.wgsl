struct PostProcessParameters {
  aaEdgeThreshold: f32,
  aaSpan: f32,

  cameraNear: f32,
  cameraFar: f32,

  vignetteIntensity: f32,
  vignetteRadius: f32,
  vignetteSoftness: f32,

  dofFocusDistance: f32,
  dofAperture: f32,
  dofMaxRadius: f32,
  dofSamples: i32,
}

@binding(0) @group(0) var screenTexture: texture_2d<f32>;
@binding(1) @group(0) var screenSampler: sampler;
@binding(2) @group(0) var depthTexture: texture_depth_2d;
@binding(3) @group(0) var<uniform> postProcessParams: PostProcessParameters;

@binding(0) @group(1) var glowTexture: texture_2d<f32>;
@binding(1) @group(1) var glowSampler: sampler;



const GOLDEN_ANGLE: f32 = 2.39996323;

// Camera uses mat4.perspective (GL-style NO), so stored depth d = (f+n)/(f-n) - 2fn/((f-n)z)
fn linearDepth(d: f32) -> f32 {
  let near = postProcessParams.cameraNear;
  let far = postProcessParams.cameraFar;
  return 2.0 * near * far / ((far + near) - d * (far - near));
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
  let threshold = postProcessParams.aaEdgeThreshold;
  let strength = smoothstep(threshold, threshold * 4.0, edge);
  if (strength <= 0.0) {
    return center;
  }

  // Depth gradient points across the edge; pick the nearer-side neighbors for stability
  var grad = vec2<f32>(zR - zL, zD - zU);
  if (dot(grad, grad) < 1e-12) {
    grad = vec2<f32>(edgeX, edgeY);
  }
  let dir = normalize(grad) * texel * postProcessParams.aaSpan;

  let a = textureSampleLevel(screenTexture, screenSampler, uv - dir, 0.0).rgb;
  let b = textureSampleLevel(screenTexture, screenSampler, uv - dir * 0.5, 0.0).rgb;
  let c = textureSampleLevel(screenTexture, screenSampler, uv + dir * 0.5, 0.0).rgb;
  let d = textureSampleLevel(screenTexture, screenSampler, uv + dir, 0.0).rgb;

  let blurred = (a + b + c + d + center.rgb) * 0.2;
  return vec4<f32>(mix(center.rgb, blurred, strength), center.a);
}

fn circleOfConfusion(uv: vec2<f32>) -> f32 {
  let z = linearDepth(loadDepth(uv));
  return clamp(abs(1.0 / postProcessParams.dofFocusDistance - 1.0 / z) * postProcessParams.dofAperture, 0.0, 1.0);
}

fn depthOfField(uv: vec2<f32>, center: vec3<f32>) -> vec3<f32> {
  let coc = circleOfConfusion(uv);
  if (coc <= 0.0) {
    return center;
  }

  let texel = 1.0 / vec2<f32>(textureDimensions(screenTexture));
  let maxRadius = postProcessParams.dofMaxRadius;
  let radius = coc * maxRadius;
  let samples = postProcessParams.dofSamples;
  var sum = center;
  var weightSum = 1.0;
  for (var i = 0; i < samples; i++) {
    let fi = f32(i);
    let r = sqrt((fi + 0.5) / f32(samples));
    let theta = fi * GOLDEN_ANGLE;
    let dir = vec2<f32>(cos(theta), sin(theta));
    let dist = r * radius;
    let sampleUV = uv + dir * dist * texel;
    // A neighbour only bleeds onto this pixel if its own blur disc reaches this far
    let sampleRadius = circleOfConfusion(sampleUV) * maxRadius;
    let w = clamp(sampleRadius - dist + 1.0, 0.0, 1.0);
    sum += textureSampleLevel(screenTexture, screenSampler, sampleUV, 0.0).rgb * w;
    weightSum += w;
  }
  return sum / weightSum;
}

fn vignette(uv: vec2<f32>, dims: vec2<f32>) -> f32 {
  // Scale by height so the vignette stays circular regardless of aspect ratio
  let centered = (uv - vec2<f32>(0.5)) * vec2<f32>(dims.x / dims.y, 1.0);
  let dist = length(centered) / length(vec2<f32>(dims.x / dims.y, 1.0) * 0.5);
  let radius = postProcessParams.vignetteRadius;
  let falloff = smoothstep(radius, radius + postProcessParams.vignetteSoftness, dist);
  return 1.0 - falloff * postProcessParams.vignetteIntensity;
}

@fragment
fn fragment_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
  var screenSample: vec4<f32> = depthAA(uv);
  screenSample = vec4<f32>(depthOfField(uv, screenSample.rgb), screenSample.a);
  let glowSample: vec4<f32> = textureSample(glowTexture, glowSampler, uv);

  let color = screenSample + glowSample;
  let dims = vec2<f32>(textureDimensions(screenTexture));
  return vec4<f32>(color.rgb * vignette(uv, dims), color.a);
}
