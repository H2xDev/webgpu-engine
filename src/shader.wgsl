struct TransformData {
	model: mat4x4<f32>,
	view: mat4x4<f32>,
	projection: mat4x4<f32>
};

@binding(0) @group(0) var<uniform> transformUBO: TransformData;
@binding(1) @group(0) var myTexture: texture_2d<f32>;
@binding(2) @group(0) var mySampler: sampler;

struct Fragment {
	@builtin(position) position: vec4<f32>,
	@location(0) uv: vec2<f32>
};

@vertex
fn vertex_main(@location(0) vertexPosition: vec3<f32>, @location(1) uv: vec2<f32>) -> Fragment {
	var output: Fragment;

	output.position = transformUBO.projection *
		transformUBO.view *
		transformUBO.model *
		vec4<f32>(vertexPosition, 1.0);

	output.uv = uv;

	return output;
}

@fragment
fn fragment_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
	return textureSample(myTexture, mySampler, uv);
}
