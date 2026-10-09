struct TransformData {
	view: mat4x4<f32>,
	projection: mat4x4<f32>,
  time: f32
};

struct ObjectData {
  model: mat4x4<f32>
}

@binding(0) @group(0) var<uniform> transformUBO: TransformData;
@binding(1) @group(0) var<storage, read> object: ObjectData;

@binding(0) @group(1) var albedo: texture_2d<f32>;
@binding(1) @group(1) var albedoSampler: sampler;

const LIGHT_DIRECTION: vec3<f32> = normalize(vec3<f32>(-0.5, 1.0, -0.5));

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

@fragment
fn fragment_main(@location(0) normal: vec3<f32>, @location(1) uv: vec2<f32>) -> @location(0) vec4<f32> {
  var lightness: f32 = max(0.25, dot(normalize(LIGHT_DIRECTION), normal));
  var color: vec4<f32> = textureSample(albedo, albedoSampler, uv);

  color.rgb *= lightness;

  return color;
}
