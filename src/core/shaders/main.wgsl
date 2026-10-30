struct CameraData {
  view: mat4x4<f32>,
  transform: mat4x4<f32>,
  projection: mat4x4<f32>
};

struct DirectionalLightData {
  view: mat4x4<f32>,
  projection: mat4x4<f32>,
  color: vec3<f32>,
};

struct EnvironmentData {
  cameraData: CameraData,
  energy: f32,
};

struct RenderData {
  camera: CameraData,
  directionalLight: DirectionalLightData,
};

struct ObjectData {
  model: mat4x4<f32>
}

struct MaterialProperties {
  normalScale: f32,
  albedoTint: vec3<f32>,
  metallic: f32,
  roughness: f32,
}

const PI: f32 = 3.1415926535897932384626433832795;

@binding(0) @group(0) var<uniform> renderData: RenderData;
@binding(1) @group(0) var<storage, read> object: ObjectData;

@binding(0) @group(1) var textureSampler: sampler;
@binding(1) @group(1) var albedoTexture: texture_2d<f32>;
@binding(2) @group(1) var normalMap: texture_2d<f32>;
@binding(3) @group(1) var ormMap: texture_2d<f32>;
@binding(4) @group(1) var emissionMap: texture_2d<f32>;
@binding(5) @group(1) var<uniform> materialProperties: MaterialProperties;

@binding(0) @group(2) var shadowMap: texture_depth_2d;
@binding(1) @group(2) var shadowMapSampler: sampler_comparison;

@binding(0) @group(3) var environmentMap: texture_2d<f32>;
@binding(1) @group(3) var environmentMapSampler: sampler;
@binding(2) @group(3) var irradianceMap: texture_2d<f32>;
@binding(3) @group(3) var<uniform> envData: EnvironmentData;


struct Fragment {
	@builtin(position) position: vec4<f32>,
  @location(0) normal: vec3<f32>,
	@location(1) uv: vec2<f32>,
  @location(2) depthCoord: vec4<f32>,
  @location(3) worldPos: vec3<f32>
};

@vertex
fn vertex_main(
  @builtin(instance_index) id: u32,
  @location(0) vpos: vec3<f32>,
  @location(1) normal: vec3<f32>,
  @location(2) uv: vec2<f32>
) -> Fragment {
	var output: Fragment;

	output.position = renderData.camera.projection *
		renderData.camera.view *
		object.model *
		vec4<f32>(vpos, 1.0);

	output.uv = uv;
  output.worldPos = (object.model * vec4<f32>(vpos, 1.0)).xyz;
  output.normal = normalize((object.model * vec4<f32>(normal, 0.0)).xyz);

  output.depthCoord = renderData.directionalLight.projection *
    renderData.directionalLight.view *
    object.model *
    vec4<f32>(vpos, 1.0);

	return output;
}

#include "cotangentFrame"
#include "shadow"

fn getEnvironmentColor(worldNormal: vec3<f32>, lod: f32) -> vec3<f32> {
  let u: f32 = 0.5 + atan2(worldNormal.z, worldNormal.x) / (2.0 * PI);
  let v: f32 = 0.5 - asin(worldNormal.y) / PI;
  return textureSampleLevel(environmentMap, environmentMapSampler, vec2<f32>(u, v), lod).rgb * envData.energy;
}

fn getIrradiance(worldNormal: vec3<f32>) -> vec3<f32> {
  let u: f32 = 0.5 + atan2(worldNormal.z, worldNormal.x) / (2.0 * PI);
  let v: f32 = 0.5 - asin(worldNormal.y) / PI;
  return textureSample(irradianceMap, environmentMapSampler, vec2<f32>(u, v)).rgb * envData.energy;
}

fn getSurfaceNormal(uv: vec2<f32>, surfaceNormal: vec3<f32>, worldFragmentPosition: vec3<f32>) -> vec3<f32> {
  var normalMapSample: vec3<f32> = textureSample(normalMap, textureSampler, uv).xyz;
  // normalMapSample.y = 1.0 - normalMapSample.y;
  normalMapSample = normalize(normalMapSample * 2.0 - 1.0);
  normalMapSample.xy *= materialProperties.normalScale;

  let tbn: mat3x3<f32> = cotangentFrame(surfaceNormal, worldFragmentPosition, uv);
  return normalize(tbn * normalMapSample);
}

fn getForwardFromView(viewMatrix: mat4x4<f32>) -> vec3<f32> {
  return normalize(vec3<f32>(
    viewMatrix[0].z,
    viewMatrix[1].z,
    viewMatrix[2].z
  ));
}

fn F(F0: vec3<f32>, V: vec3<f32>, H: vec3<f32>) -> vec3<f32> {
  return F0 + (vec3<f32>(1.0) - F0) * pow(1.0 - max(dot(V, H), 0.0), 5.0);
}

fn D(N: vec3<f32>, H: vec3<f32>, roughness: f32) -> f32 {
  let alpha = roughness * roughness;
  let alpha2 = alpha * alpha;

  let NdotH = max(dot(N, H), 0.0);
  let denominator = pow(NdotH * NdotH * (alpha2 - 1.0) + 1.0, 2.0);

  return alpha2 / max(PI * denominator, 0.00001);
}

fn G1(N: vec3<f32>, X: vec3<f32>, roughness: f32) -> f32 {
  let NdotX = max(dot(N, X), 0.0);
  let k = pow(roughness + 1.0, 2.0) / 8.0;

  return NdotX / max(NdotX * (1.0 - k) + k, 0.0001);
}

fn G(N: vec3<f32>, V: vec3<f32>, L: vec3<f32>, roughness: f32) -> f32 {
  return G1(N, V, roughness) * G1(N, L, roughness);
}

fn PBR(
  N: vec3<f32>,
  V: vec3<f32>,
  L: vec3<f32>,
  H: vec3<f32>,
  lightColor: vec3<f32>,
  albedo: vec3<f32>,
  roughness: f32,
  metallic: f32,
  emission: vec3<f32>,
  shadowFactor: f32,
) -> vec3<f32> {
  let F0 = mix(vec3<f32>(0.04), albedo, metallic);
  let Ks = F(F0, V, H);
  let Kd = (vec3<f32>(1.0) - Ks) * (1.0 - metallic);
  let lambert = albedo / PI;
  let R = reflect(-V, N);
  let NdotV = max(dot(N, V), 0.0);

  let cookTorranceNumerator = D(N, H, roughness) * G(N, V, L, roughness) * Ks;
  let cookTorranceDemominator = max(4.0 * max(dot(V, N), 0.0) * max(dot(L, N), 0.0), 0.0001);
  let cookTorrance = cookTorranceNumerator / cookTorranceDemominator;

  let BRDF = Kd * lambert + cookTorrance;

  let RAF = F0 + (max(vec3<f32>(1.0 - roughness), F0) - F0) * pow(1.0 - NdotV, 5.0);

  let diffuseIBL = Kd * albedo * getIrradiance(N);
  let environment = RAF * getEnvironmentColor(R, (1.0 - roughness) * 10.0);
  let lighting = (BRDF * lightColor * max(dot(L, N), 0.0) + environment) * shadowFactor;

  return emission + diffuseIBL + lighting;
}

@fragment
fn fragment_main(
  @builtin(position) pos: vec4<f32>,
  @location(0) normal: vec3<f32>,
  @location(1) uv: vec2<f32>,
  @location(2) depthCoord: vec4<f32>,
  @location(3) worldPos: vec3<f32>
) -> @location(0) vec4<f32> {
  let ormSample: vec3<f32> = textureSample(ormMap, textureSampler, uv).rgb;
  let albedo: vec3<f32> = textureSample(albedoTexture, textureSampler, uv).rgb * materialProperties.albedoTint;
  let emissive: vec3<f32> = textureSample(emissionMap, textureSampler, uv).rgb;
  let roughness: f32 = 1.0 - ormSample.g;
  let metallic: f32 = ormSample.b;
  let shinness: f32 = 100.0;

  let cameraPosition: vec3<f32> = renderData.camera.transform[3].xyz;
  let cameraForward: vec3<f32> = getForwardFromView(renderData.camera.view);
  let shadowFactor: f32 = getShadowValue(shadowMap, shadowMapSampler, depthCoord);

  let N: vec3<f32> = getSurfaceNormal(uv, normal, worldPos);
  let V: vec3<f32> = normalize(cameraPosition - worldPos);
  let L: vec3<f32> = getForwardFromView(renderData.directionalLight.view);
  let H: vec3<f32> = normalize(L + V);

  var finalColor: vec3<f32> = albedo;

  finalColor = PBR(
    N, V, L, H,
    renderData.directionalLight.color,
    albedo,
    roughness * materialProperties.roughness,
    metallic * materialProperties.metallic,
    emissive,
    shadowFactor,
  );

  return vec4<f32>(finalColor, 1.0);
}
