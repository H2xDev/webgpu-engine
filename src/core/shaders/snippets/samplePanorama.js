export const SAMPLE_PANORAMA_SHADER_FUNCTION = /* wgsl */`
  fn samplePanorama(tex: texture_2d, samp: sampler, direction: vec3<f32>) -> vec4<f32> {
      let theta = atan2(direction.z, direction.x);
      let phi = acos(clamp(direction.y, -1.0, 1.0));

      let u = (theta + PI) / (2.0 * PI);
      let v = phi / PI;

      return textureSample(tex, samp, vec2<f32>(u, v));
  }
`;
