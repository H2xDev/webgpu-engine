struct Fragment {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>
}

const vertices: array<vec2<f32>, 3> = array<vec2<f32>, 3>(
  vec2<f32>(-1.0, -1.0),
  vec2<f32>(3.0, -1.0),
  vec2<f32>(-1.0, 3.0),
);

const uvs = array<vec2<f32>, 3>(
  vec2<f32>(-1.0, 1.0),
  vec2<f32>(3.0, 1.0),
  vec2<f32>(-1.0, -3.0)
);

@vertex
fn vertex_main(
  @builtin(vertex_index) vertexIndex: u32
) -> Fragment {
  var output: Fragment;
  output.position = vec4<f32>(vertices[vertexIndex], 0.0, 1.0);
  output.uv = (uvs[vertexIndex] + 1.0) * 0.5;

  return output;
}
