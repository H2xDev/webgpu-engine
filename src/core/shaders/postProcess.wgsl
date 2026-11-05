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

  aoIntensity: f32,
  aoRadius: f32,
}

@binding(0) @group(0) var screenTexture: texture_2d<f32>;
@binding(1) @group(0) var screenSampler: sampler;
@binding(2) @group(0) var depthTexture: texture_depth_2d;
@binding(3) @group(0) var<uniform> postProcessParams: PostProcessParameters;

@binding(0) @group(1) var glowTexture: texture_2d<f32>;
@binding(1) @group(1) var glowSampler: sampler;

override REVERSED_Z: bool = false;

const GOLDEN_ANGLE: f32 = 2.39996323;

// Camera uses mat4.perspectiveZO
fn linearDepth(d: f32) -> f32 {
  let near = postProcessParams.cameraNear;
  let far = postProcessParams.cameraFar;

  if (REVERSED_Z) {
    return near * far / (near + d * (far - near));
  }

  return near * far / (far - d * (far - near));
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
  let depthStrength = smoothstep(threshold, threshold * 4.0, edge);

  // Color edges catch aliasing the depth buffer can't see (textures, glow, shadows)
  let lumaW = vec3<f32>(0.299, 0.587, 0.114);
  let lC = dot(center.rgb, lumaW);
  let lL = dot(textureSampleLevel(screenTexture, screenSampler, uv + vec2<f32>(-1.0, 0.0) * texel, 0.0).rgb, lumaW);
  let lR = dot(textureSampleLevel(screenTexture, screenSampler, uv + vec2<f32>(1.0, 0.0) * texel, 0.0).rgb, lumaW);
  let lU = dot(textureSampleLevel(screenTexture, screenSampler, uv + vec2<f32>(0.0, -1.0) * texel, 0.0).rgb, lumaW);
  let lD = dot(textureSampleLevel(screenTexture, screenSampler, uv + vec2<f32>(0.0, 1.0) * texel, 0.0).rgb, lumaW);
  let lumaGrad = vec2<f32>(lR - lL, lD - lU);
  let lumaRange = max(max(lL, lR), max(max(lU, lD), lC)) - min(min(lL, lR), min(min(lU, lD), lC));
  let lumaStrength = smoothstep(0.05, 0.25, lumaRange / max(max(lL, lR), max(max(lU, lD), max(lC, 0.05))));

  let strength = max(depthStrength, lumaStrength);
  if (strength <= 0.0) {
    return center;
  }

  // Gradient points across the edge; prefer depth, fall back to luma
  var grad = vec2<f32>(zR - zL, zD - zU);
  if (depthStrength <= 0.0 || dot(grad, grad) < 1e-12) {
    grad = lumaGrad;
  }
  if (dot(grad, grad) < 1e-12) {
    grad = vec2<f32>(edgeX, edgeY);
  }
  if (dot(grad, grad) < 1e-12) {
    return center;
  }
  let dir = normalize(grad) * texel * postProcessParams.aaSpan;

  let a = textureSampleLevel(screenTexture, screenSampler, uv - dir, 0.0).rgb;
  let b = textureSampleLevel(screenTexture, screenSampler, uv - dir * 0.5, 0.0).rgb;
  let c = textureSampleLevel(screenTexture, screenSampler, uv + dir * 0.5, 0.0).rgb;
  let d = textureSampleLevel(screenTexture, screenSampler, uv + dir, 0.0).rgb;

  let blurred = (a + b + c + d + center.rgb) * 0.2;
  return vec4<f32>(mix(center.rgb, blurred, strength), center.a);
}

const AO_PAIRS: i32 = 8;

// Depth-only SSAO. Samples come in opposite pairs: a flat or slanted surface has
// zA + zB == 2 * zC and yields no occlusion, only concave corners do.
fn ambientOcclusion(uv: vec2<f32>, fragCoord: vec2<f32>) -> f32 {
  let intensity = postProcessParams.aoIntensity;
  if (intensity <= 0.0) {
    return 1.0;
  }

  let dims = vec2<i32>(textureDimensions(depthTexture));
  let maxP = dims - vec2<i32>(1);
  let p = clamp(vec2<i32>(uv * vec2<f32>(dims)), vec2<i32>(0), maxP);
  let zC = depthAt(p, maxP);
  let worldRadius = postProcessParams.aoRadius;

  // Approximates a ~90 degree vertical FOV to convert world radius into pixels
  let radiusPx = clamp(worldRadius / zC * f32(dims.y) * 0.5, 2.0, 64.0);
  let noise = fract(52.9829189 * fract(dot(fragCoord, vec2<f32>(0.06711056, 0.00583715))));

  var occlusion = 0.0;
  for (var i = 0; i < AO_PAIRS; i++) {
    let fi = f32(i);
    let angle = (fi + noise) * GOLDEN_ANGLE;
    let r = sqrt((fi + 0.5) / f32(AO_PAIRS)) * radiusPx;
    let offset = vec2<i32>(round(vec2<f32>(cos(angle), sin(angle)) * max(r, 1.0)));
    let zA = depthAt(p + offset, maxP);
    let zB = depthAt(p - offset, maxP);

    let rangeA = 1.0 - smoothstep(worldRadius, worldRadius * 2.0, abs(zC - zA));
    let rangeB = 1.0 - smoothstep(worldRadius, worldRadius * 2.0, abs(zC - zB));
    let concavity = (2.0 * zC - zA - zB) * 0.5;
    let bias = 0.002 * zC;
    occlusion += clamp((concavity - bias) / worldRadius, 0.0, 1.0) * min(rangeA, rangeB);
  }

  occlusion /= f32(AO_PAIRS);
  return clamp(1.0 - occlusion * intensity, 0.0, 1.0);
}

fn circleOfConfusion(uv: vec2<f32>) -> f32 {
  let z = linearDepth(loadDepth(uv));
  return clamp(abs(1.0 / postProcessParams.dofFocusDistance - 1.0 / z) * postProcessParams.dofAperture, 0.0, 1.0);
}

fn depthOfField(uv: vec2<f32>, center: vec3<f32>, screenTex: texture_2d<f32>) -> vec3<f32> {
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
    sum += textureSampleLevel(screenTex, screenSampler, sampleUV, 0.0).rgb * w;
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
fn fragment_main(@builtin(position) fragCoord: vec4<f32>, @location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
  // DOF resamples the raw texture and would wash out an AA'd center (weight ~1/N),
  // so apply the AA correction on top of the DOF result, fading out as blur grows.
  let rawSample = textureSampleLevel(screenTexture, screenSampler, uv, 0.0);
  let aaSample = depthAA(uv);
  let focus = 1.0 - circleOfConfusion(uv);
  var screenSample = vec4<f32>(
    depthOfField(uv, rawSample.rgb, screenTexture) + (aaSample.rgb - rawSample.rgb) * focus,
    rawSample.a
  );
  screenSample = vec4<f32>(screenSample.rgb * ambientOcclusion(uv, fragCoord.xy), screenSample.a);

  var glowSample: vec4<f32> = textureSample(glowTexture, glowSampler, uv);
  glowSample = vec4<f32>(depthOfField(uv, glowSample.rgb, glowTexture), glowSample.a);
  // glowSample /= f32(postProcessParams.dofSamples);

  let color = screenSample + max(vec4<f32>(0.0), glowSample);
  let dims = vec2<f32>(textureDimensions(screenTexture));
  return vec4<f32>(color.rgb * vignette(uv, dims), color.a);
}
