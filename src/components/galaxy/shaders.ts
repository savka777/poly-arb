// GLSL noise + vertex/fragment shaders for galaxy particle clouds

export const vertexShader = /* glsl */ `
  precision highp float;

  // Instance attributes
  attribute vec3 aPos;       // disc distribution position
  attribute float aSize;     // per-particle size multiplier
  attribute float aPhase;    // random phase offset
  attribute float aArm;      // spiral arm index (0–1)

  // Uniforms
  uniform float uTime;
  uniform float uTwistAmp;
  uniform float uBaseSize;
  uniform vec3 uMouse;
  uniform float uMouseRadius;
  uniform float uSphereRadius;
  uniform float uFlatten;      // 0 = normal, 1 = squash Y into disc
  varying vec2 vUv;
  varying float vAlpha;

  //
  // Simplex 3D noise
  //
  vec4 permute(vec4 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);

    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);

    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;

    i = mod(i, 289.0);
    vec4 p = permute(permute(permute(
              i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));

    float n_ = 1.0/7.0;
    vec3  ns = n_ * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);

    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));

    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;

    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);

    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;

    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }

  // FBM — 3 octaves
  float fbm(vec3 p) {
    float val = 0.0;
    float amp = 0.5;
    float freq = 1.0;
    for (int i = 0; i < 3; i++) {
      val += amp * snoise(p * freq);
      freq *= 2.0;
      amp *= 0.5;
    }
    return val;
  }

  // Rotation around Y axis
  mat3 rotateY(float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return mat3(c, 0, s, 0, 1, 0, -s, 0, c);
  }

  void main() {
    // A. Particle size from noise
    float nSize = snoise(aPos * 0.5) * 0.5 + 0.5;
    float particleSize = uBaseSize * (0.6 + nSize * 1.5) * aSize;

    // B. Slow base rotation — entire disc spins gently
    float dist = length(aPos.xz);
    float speed = 0.008 + 0.005 * nSize + 0.001 * dist;
    mat3 rot1 = rotateY(uTime * speed + aPhase * 0.3);
    vec3 worldPos = rot1 * aPos;

    // C. Subtle twist — inner rotates slightly faster than outer
    float twistScale = snoise(worldPos * 0.2 + uTime * 0.008) * 0.5 + 0.5;
    float twistSpeed = 0.003 + 0.005 * twistScale * uTwistAmp;
    mat3 rot2 = rotateY(uTime * twistSpeed);
    vec3 twisted = rot2 * worldPos;

    // D. Nebula breathing — Y billows freely for volumetric cloud feel
    vec3 offset = vec3(
      fbm(twisted * 0.1 + uTime * 0.006),
      fbm(twisted * 0.1 + 100.0 + uTime * 0.004),
      fbm(twisted * 0.1 + 200.0 + uTime * 0.006)
    );
    vec3 finalPos = twisted + offset * 2.0;

    // E. Flatten into disc — squash Y toward 0
    finalPos.y *= mix(1.0, 0.03, uFlatten);

    // F. Mouse sphere attractor
    float mouseDist = length(finalPos.xz - uMouse.xz);
    float influence = 1.0 - clamp(mouseDist / uMouseRadius, 0.0, 1.0);
    influence *= influence;
    if (influence > 0.001) {
      vec3 dir = finalPos - uMouse;
      vec3 spherePos = uMouse + normalize(dir) * uSphereRadius;
      finalPos = mix(finalPos, spherePos, influence * 0.6);
    }

    // F. Billboard: transform to view space, add plane verts
    vec4 mvPosition = viewMatrix * modelMatrix * vec4(finalPos, 1.0);
    mvPosition.xy += position.xy * particleSize;

    gl_Position = projectionMatrix * mvPosition;

    vUv = uv;
    // Brighter near center, fade at edges
    float centerFade = 1.0 - smoothstep(0.0, 1.0, dist / 8.0);
    vAlpha = (0.5 + 0.5 * centerFade) * (0.7 + 0.3 * aSize);
  }
`;

export const fragmentShader = /* glsl */ `
  precision highp float;

  uniform vec3 uColor;
  uniform float uOpacity;
  uniform sampler2D uTexture;

  varying vec2 vUv;
  varying float vAlpha;

  void main() {
    vec4 tex = texture2D(uTexture, vUv);
    float alpha = tex.a * vAlpha * uOpacity;
    // Hot white core boost
    vec3 color = uColor * (1.0 + tex.r * 1.5);
    gl_FragColor = vec4(color, alpha);
  }
`;
