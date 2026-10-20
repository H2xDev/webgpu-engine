fn cotangentFrame(
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
