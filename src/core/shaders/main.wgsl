struct TransformData {
	view: mat4x4<f32>,
	projection: mat4x4<f32>,
  lightView: mat4x4<f32>,
  lightProjection: mat4x4<f32>,
  lightColor: vec3<f32>,
  time: f32
};

struct ObjectData {
  model: mat4x4<f32>
}

struct MaterialProperties {
  normalScale: f32,
}

@binding(0) @group(0) var<uniform> transformUBO: TransformData;
@binding(1) @group(0) var<storage, read> object: ObjectData;

@binding(0) @group(1) var albedo: texture_2d<f32>;
@binding(1) @group(1) var albedoSampler: sampler;

@binding(2) @group(1) var normalMap: texture_2d<f32>;
@binding(3) @group(1) var normalMapSampler: sampler;
@binding(4) @group(1) var<uniform> materialProperties: MaterialProperties;

@binding(0) @group(2) var shadowMap: texture_depth_2d;
@binding(1) @group(2) var shadowMapSampler: sampler_comparison;

struct Fragment {
	@builtin(position) position: vec4<f32>,
  @location(0) normal: vec3<f32>,
	@location(1) uv: vec2<f32>,
  @location(2) depth_coord: vec4<f32>,
  @location(3) shadow_pos: vec3<f32>,
  @location(4) world_pos: vec3<f32>
};

@vertex
fn vertex_main(
  @builtin(instance_index) id: u32,
  @location(0) vpos: vec3<f32>,
  @location(1) normal: vec3<f32>,
  @location(2) uv: vec2<f32>
) -> Fragment {
	var output: Fragment;

	output.position = transformUBO.projection *
		transformUBO.view *
		object.model *
		vec4<f32>(vpos, 1.0);

	output.uv = uv;
  output.world_pos = (object.model * vec4<f32>(vpos, 1.0)).xyz;
  output.normal = normalize((object.model * vec4<f32>(normal, 0.0)).xyz);

  output.depth_coord = transformUBO.lightProjection *
    transformUBO.lightView *
    object.model *
    vec4<f32>(vpos, 1.0);

  output.shadow_pos = vec3<f32>(
    output.depth_coord.xy * vec2(0.5, -0.5) + vec2(0.5),
    output.depth_coord.z
  );

	return output;
}

fn cotangent_frame(
    N: vec3f,
    position: vec3f,
    uv: vec2f
) -> mat3x3f {
    let dp1 = dpdx(position);
    let dp2 = dpdy(position);

    let duv1 = dpdx(uv);
    let duv2 = dpdy(uv);

    let dp2perp = cross(dp2, N);
    let dp1perp = cross(N, dp1);

    let T = dp2perp * duv1.x + dp1perp * duv2.x;
    let B = dp2perp * duv1.y + dp1perp * duv2.y;

    let inv_max = inverseSqrt(max(dot(T, T), dot(B, B)));

    return mat3x3f(
        T * inv_max,
        B * inv_max,
        N
    );
}

fn shadow_pcf(uv: vec2<f32>, depth: f32) -> f32 {
  var shadow: f32 = 0.0;
  let texel_size: vec2<f32> = 1.0 / vec2<f32>(textureDimensions(shadowMap, 0)) / 2.0;
  for (var x: f32 = -1; x <= 1; x = x + 0.5) {
    for (var y: f32 = -1; y <= 1; y = y + 0.5) {
      let offset: vec2<f32> = vec2<f32>(f32(x), f32(y)) * texel_size;
      shadow += textureSampleCompare(
        shadowMap,
        shadowMapSampler,
        uv + offset,
        depth - 0.0001
      );
    }
  }
  return shadow / 18.0;
}

@fragment
fn fragment_main(
  @builtin(position) pos: vec4<f32>,
  @location(0) normal: vec3<f32>,
  @location(1) uv: vec2<f32>,
  @location(2) depth_coord: vec4<f32>,
  @location(3) shadow_pos: vec3<f32>,
  @location(4) world_pos: vec3<f32>
) -> @location(0) vec4<f32> {
  var normal_map_sample: vec3<f32> = textureSample(normalMap, normalMapSampler, uv).xyz;
  normal_map_sample.y = 1.0 - normal_map_sample.y;
  normal_map_sample = normalize(normal_map_sample * 2.0 - 1.0);
  normal_map_sample.xy *= materialProperties.normalScale;

  var shadowProj: vec3<f32> = depth_coord.xyz / depth_coord.w;
  var shadowUV: vec2<f32> = vec2<f32>(shadowProj.x * 0.5 + 0.5, shadowProj.y * 0.5 + 0.5);

  let shadowCoord = vec2<f32>(shadowUV.x, 1.0 - shadowUV.y);
  var shadowValue: f32 = shadow_pcf(shadowCoord, shadowProj.z);

  let outside = any(shadowCoord < vec2<f32>(0.0)) || any(shadowCoord > vec2<f32>(1.0)) ||
    shadowProj.z > 1.0 || shadowProj.z < 0.0;
  shadowValue = select(shadowValue, 1.0, outside);

  var tbn: mat3x3<f32> = cotangent_frame(normal, world_pos, uv);

  var lightDirection: vec3<f32> = vec3<f32>(
    transformUBO.lightView[0].z,
    transformUBO.lightView[1].z,
    transformUBO.lightView[2].z
  );

  var normal_mapped: vec3<f32> = normalize(tbn * normal_map_sample);
  var lightness: f32 = max(0.25, dot(normalize(lightDirection), normal_mapped) * shadowValue);

  var color: vec4<f32> = textureSample(albedo, albedoSampler, uv);

  color.rgb *= lightness * transformUBO.lightColor;

  return color;
}
