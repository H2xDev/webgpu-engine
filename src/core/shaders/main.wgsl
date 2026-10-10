struct TransformData {
	view: mat4x4<f32>,
	projection: mat4x4<f32>,
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

struct Fragment {
	@builtin(position) position: vec4<f32>,
  @location(0) normal: vec3<f32>,
	@location(1) uv: vec2<f32>
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
  output.normal = normalize((object.model * vec4<f32>(normal, 0.0)).xyz);

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

@fragment
fn fragment_main(@builtin(position) pos: vec4<f32>, @location(0) normal: vec3<f32>, @location(1) uv: vec2<f32>) -> @location(0) vec4<f32> {
  var light_x: f32 = sin(transformUBO.time);
  var light_z: f32 = cos(transformUBO.time);
  var light_y: f32 = 1.0;

  var LIGHT_DIRECTION: vec3<f32> = normalize(vec3<f32>(light_x, light_y, light_z));

  var normal_map_sample: vec3<f32> = textureSample(normalMap, normalMapSampler, uv).xyz;
  normal_map_sample = normalize(normal_map_sample * 2.0 - 1.0);
  normal_map_sample.xy *= materialProperties.normalScale;

  var tbn: mat3x3<f32> = cotangent_frame(normal, pos.xyz, uv);

  var normal_mapped: vec3<f32> = normalize(tbn * normal_map_sample);
  var lightness: f32 = max(0.25, dot(normalize(LIGHT_DIRECTION), normal_mapped));

  var color: vec4<f32> = textureSample(albedo, albedoSampler, uv);

  color.rgb *= lightness;

  return color;
}
