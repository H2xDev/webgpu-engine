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
}

const PI: f32 = 3.1415926535897932384626433832795;

@binding(0) @group(0) var<uniform> renderData: RenderData;
@binding(1) @group(0) var<storage, read> object: ObjectData;

@binding(0) @group(1) var albedo: texture_2d<f32>;
@binding(1) @group(1) var albedoSampler: sampler;

@binding(2) @group(1) var normalMap: texture_2d<f32>;
@binding(3) @group(1) var normalMapSampler: sampler;
@binding(4) @group(1) var<uniform> materialProperties: MaterialProperties;

@binding(0) @group(2) var shadowMap: texture_depth_2d;
@binding(1) @group(2) var shadowMapSampler: sampler_comparison;

@binding(0) @group(3) var environmentMap: texture_2d<f32>;
@binding(1) @group(3) var environmentMapSampler: sampler;
@binding(2) @group(3) var<uniform> envData: EnvironmentData;


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

fn getEnvironmentColor(worldNormal: vec3<f32>) -> vec3<f32> {
  let u: f32 = 0.5 + atan2(worldNormal.z, worldNormal.x) / (2.0 * PI);
  let v: f32 = 0.5 - asin(worldNormal.y) / PI;
  let white: vec3<f32> = vec3<f32>(1.0, 1.0, 1.0);
  let env: vec3<f32> = textureSampleLevel(environmentMap, environmentMapSampler, vec2<f32>(u, v), 3.0).rgb;

  return mix(white, env, envData.energy);
}

@fragment
fn fragment_main(
  @builtin(position) pos: vec4<f32>,
  @location(0) normal: vec3<f32>,
  @location(1) uv: vec2<f32>,
  @location(2) depthCoord: vec4<f32>,
  @location(3) worldPos: vec3<f32>
) -> @location(0) vec4<f32> {
  var normalMapSample: vec3<f32> = textureSample(normalMap, normalMapSampler, uv).xyz;
  normalMapSample.y = 1.0 - normalMapSample.y;
  normalMapSample = normalize(normalMapSample * 2.0 - 1.0);
  normalMapSample.xy *= materialProperties.normalScale;

  let shadowValue: f32 = getShadowValue(shadowMap, shadowMapSampler, depthCoord);
  let tbn: mat3x3<f32> = cotangentFrame(normal, worldPos, uv);
  let lightDirection: vec3<f32> = normalize(vec3<f32>(
    renderData.directionalLight.view[0].z,
    renderData.directionalLight.view[1].z,
    renderData.directionalLight.view[2].z
  ));

  let surfaceNormal: vec3<f32> = normalize(tbn * normalMapSample);
  let lightness: f32 = max(0.15, dot(lightDirection, surfaceNormal) * shadowValue);

  var color: vec4<f32> = textureSample(albedo, albedoSampler, uv);
  color.rgb *= lightness * renderData.directionalLight.color;

  return color;
}
