
struct Fragment {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>
}

@binding(0) @group(0) var screenTexture: texture_2d<f32>;
@binding(0) @group(1) var screenSampler: sampler;

// fullscreen triangle vertices and uvs
const vertices = array<vec2<f32>, 3>(
  vec2<f32>(-1.0, -1.0),
  vec2<f32>(3.0, -1.0),
  vec2<f32>(-1.0, 3.0)
);

const uvs = array<vec2<f32>, 3>(
  vec2<f32>(0.0, 0.0),
  vec2<f32>(2.0, 0.0),
  vec2<f32>(0.0, 2.0)
);

@vertex
fn vertex_main(
  @builtin(vertex_index) vertexIndex: u32,
) -> Fragment {
  var output: Fragment;

  output.position = vec4<f32>(vertices[vertexIndex], 0.0, 1.0);
  output.uv = (uvs[vertexIndex] + vec2<f32>(1.0)) * 0.5;

  return output;
}

@fragment
fn fragment_main(
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>
) -> @location(0) vec4<f32> {
  return textureSample(screenTexture, screenSampler, uv);
}
