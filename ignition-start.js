(() => {
  const VS = "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";

  const FS_BTN = `
precision highp float;
uniform vec2 u_res;
uniform float u_time;
uniform float u_warp;
uniform float u_flash;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
float noise(vec2 p){
  vec2 i=floor(p), f=fract(p);
  vec2 u=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1.,0.)),u.x),
             mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),u.x),u.y);
}
float fbm(vec2 p){
  float v=0.0; float a=0.5;
  for(int i=0;i<4;i++){ v+=a*noise(p); p=p*2.07+vec2(13.1,5.7); a*=0.5; }
  return v;
}
void main(){
  vec2 sc = gl_FragCoord.xy / u_res;
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y;
  float r = length(uv);
  float rr = max(r, 0.08);
  float a = atan(uv.y, uv.x);
  float t = u_time;
  vec3 col = vec3(0.08, 0.22, 0.38);
  float hz = fbm(uv * 2.6 + vec2(t * 0.35, 1.7));
  col += vec3(0.14, 0.36, 0.58) * hz * (0.6 + 0.55 * u_warp);
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float ringN = 26.0 + fi * 9.0;
    vec2 sp = vec2((a / 6.28318 + 0.5) * ringN,
                   (0.3 + fi * 0.22) / rr + t * (2.0 + fi * 1.2));
    vec2 cell = floor(sp);
    vec2 f = fract(sp);
    float h = hash(cell + fi * 17.31);
    float on = step(0.62, h);
    vec2 c = vec2(0.2 + 0.6 * hash(cell + 4.7), 0.5);
    vec2 dlt = f - c;
    float sy = mix(130.0, 8.0, u_warp);
    float star = on * exp(-(dlt.x * dlt.x * 150.0 + dlt.y * dlt.y * sy));
    float tw = 0.7 + 0.3 * sin(h * 81.0 + t * 9.0);
    tw = mix(tw, 1.0, u_warp);
    vec3 sCol = mix(vec3(0.92, 0.97, 1.0), vec3(0.45, 0.78, 1.0), step(0.88, h));
    float fade = smoothstep(0.02, 0.28, r);
    col += sCol * star * tw * fade * (1.15 + 0.75 * u_warp);
  }
  col += vec3(0.55, 0.82, 1.0) * u_warp * 0.28 * exp(-r * 3.6);
  vec2 e = sc * (1.0 - sc);
  col *= 0.48 + 0.52 * pow(e.x * e.y * 16.0, 0.28);
  col = mix(col, vec3(0.9, 0.97, 1.0), clamp(u_flash, 0.0, 1.0) * 0.85);
  gl_FragColor = vec4(col, 1.0);
}`;

  function compile(gl, type, src) {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    return shader;
  }

  function createProgram(gl, fs) {
    const prog = gl.createProgram();
    if (!prog) return null;
    const vs = compile(gl, gl.VERTEX_SHADER, VS);
    const frag = compile(gl, gl.FRAGMENT_SHADER, fs);
    if (!vs || !frag) return null;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, frag);
    gl.linkProgram(prog);
    gl.deleteShader(vs);
    gl.deleteShader(frag);
    return prog;
  }

  let burstUntil = 0;
  let hoverOn = false;
  let setWarpTarget = null;
  let setFlash = null;
  let setWarpNow = null;
  let btnEl = null;

  window.pharmIgnitionBurst = (durationMs = 600) => {
    const ms = Math.max(0, Number(durationMs) || 0);
    burstUntil = performance.now() + ms;
    if (setFlash) setFlash(1);
    if (setWarpNow) setWarpNow(1);
    if (setWarpTarget) setWarpTarget(1);
    btnEl?.classList.add("is-hot", "is-launching");
    return new Promise((resolve) => {
      window.setTimeout(() => {
        btnEl?.classList.remove("is-launching");
        if (!hoverOn) btnEl?.classList.remove("is-hot");
        resolve();
      }, ms);
    });
  };

  function initIgnitionStart() {
    const btn = document.getElementById("ignition-start");
    const canvas = document.getElementById("ignition-start-canvas");
    if (!btn || !canvas) return;
    btnEl = btn;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const gl = canvas.getContext("webgl", { alpha: false, antialias: true });
    if (!gl || reduced) {
      btn.classList.add("is-fallback");
      window.pharmIgnitionBurst = (durationMs = 600) =>
        new Promise((resolve) => window.setTimeout(resolve, Math.max(0, Number(durationMs) || 0)));
      return;
    }

    const prog = createProgram(gl, FS_BTN);
    if (!prog) {
      btn.classList.add("is-fallback");
      return;
    }

    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const locP = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(locP);
    gl.vertexAttribPointer(locP, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, "u_res");
    const uTime = gl.getUniformLocation(prog, "u_time");
    const uWarp = gl.getUniformLocation(prog, "u_warp");
    const uFlash = gl.getUniformLocation(prog, "u_flash");

    let warpTarget = 0;
    let warp = 0;
    let flash = 0;
    let z = 0;
    let last = performance.now();
    let raf = 0;
    let alive = true;

    setWarpTarget = (value) => {
      warpTarget = value;
    };
    setFlash = (value) => {
      flash = value;
    };
    setWarpNow = (value) => {
      warp = value;
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    };

    const syncHoverTarget = () => {
      if (performance.now() < burstUntil) {
        warpTarget = 1;
        return;
      }
      warpTarget = hoverOn ? 1 : 0;
      btn.classList.toggle("is-hot", hoverOn);
    };

    const onEnter = () => {
      hoverOn = true;
      syncHoverTarget();
    };
    const onLeave = () => {
      hoverOn = false;
      btn.classList.remove("is-pressed");
      syncHoverTarget();
    };

    btn.addEventListener("pointerenter", onEnter);
    btn.addEventListener("pointerleave", onLeave);
    btn.addEventListener("focus", onEnter);
    btn.addEventListener("blur", onLeave);
    btn.addEventListener("pointerdown", () => btn.classList.add("is-pressed"));
    btn.addEventListener("pointerup", () => btn.classList.remove("is-pressed"));
    btn.addEventListener("pointercancel", () => btn.classList.remove("is-pressed"));

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    const frame = (now) => {
      if (!alive) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      syncHoverTarget();
      const bursting = now < burstUntil;
      warp += (warpTarget - warp) * Math.min(1, dt * (bursting ? 7 : 2.6));
      flash *= Math.exp(-4.2 * dt);
      z += dt * (0.05 + warp * 1.35);
      resize();
      gl.useProgram(prog);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, z);
      gl.uniform1f(uWarp, warp);
      gl.uniform1f(uFlash, flash);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    window.addEventListener(
      "pagehide",
      () => {
        alive = false;
        cancelAnimationFrame(raf);
        ro.disconnect();
      },
      { once: true }
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initIgnitionStart);
  } else {
    initIgnitionStart();
  }
})();
