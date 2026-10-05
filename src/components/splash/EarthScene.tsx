import {useEffect, useRef} from 'react';
import {
  AdditiveBlending,
  AmbientLight,
  BackSide,
  Clock,
  Color,
  DirectionalLight,
  Group,
  LinearFilter,
  Mesh,
  MeshPhongMaterial,
  PerspectiveCamera,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  ACESFilmicToneMapping,
  Vector3,
  WebGLRenderer,
  type Material,
} from 'three';

const TEX = '/assets/earth/';
const SUN = new Vector3(-1.1, 0.7, 0.9).normalize();
const INDIA_LON = 79;
const TILT = -0.55;
const FOV = 3;
const CAM_Z = 160;

const ATMO_VERT = `
varying vec3 vN; varying vec3 vV;
void main(){
  vec4 mv = modelViewMatrix * vec4(position,1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;
const ATMO_FRAG = `
uniform vec3 uColor; uniform vec3 uSun; uniform float uPower; uniform float uGain; uniform float uBack;
varying vec3 vN; varying vec3 vV;
void main(){
  float f = uBack > 0.5 ? -dot(vN, vV) / 0.378 : 1.0 - dot(vN, vV);
  f = pow(clamp(f, 0.0, 1.0), uPower);
  float lit = clamp(dot(normalize(vN), uSun) * 0.9 + 0.35, 0.0, 1.0);
  gl_FragColor = vec4(uColor, 1.0) * f * uGain * lit;
}`;

function atmosphere(radius: number, color: string, power: number, gain: number, back: boolean) {
  const mat = new ShaderMaterial({
    vertexShader: ATMO_VERT,
    fragmentShader: ATMO_FRAG,
    uniforms: {
      uColor: {value: new Color(color)},
      uSun: {value: SUN.clone()},
      uPower: {value: power},
      uGain: {value: gain},
      uBack: {value: back ? 1 : 0},
    },
    blending: AdditiveBlending,
    transparent: true,
    depthWrite: false,
    side: back ? BackSide : 0,
  });
  return new Mesh(new SphereGeometry(radius, 96, 96), mat);
}

function loadTex(loader: TextureLoader, name: string, color: boolean): Promise<Texture> {
  return new Promise((resolve, reject) =>
    loader.load(
      TEX + name,
      (t) => {
        if (color) t.colorSpace = SRGBColorSpace;
        t.anisotropy = 8;
        t.minFilter = LinearFilter;
        t.generateMipmaps = false;
        resolve(t);
      },
      undefined,
      reject,
    ),
  );
}

interface Props {
  reducedMotion: boolean;
  onReady: () => void;
  onError: () => void;
}

export default function EarthScene({reducedMotion, onReady, onError}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    let disposed = false;
    let raf = 0;
    const disposables: {dispose: () => void}[] = [];
    let renderer: WebGLRenderer | null = null;
    let ro: ResizeObserver | null = null;
    let onVis: (() => void) | null = null;

    try {
      renderer = new WebGLRenderer({antialias: true, alpha: true, powerPreference: 'high-performance'});
    } catch {
      onError();
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.cssText = 'width:100%;height:100%;display:block';
    wrap.appendChild(renderer.domElement);

    const scene = new Scene();
    const camera = new PerspectiveCamera(FOV, 1, 50, 400);
    camera.position.set(0, 0, CAM_Z);

    const sun = new DirectionalLight(0xfff4e6, 3.1);
    sun.position.copy(SUN).multiplyScalar(40);
    scene.add(sun, new AmbientLight(0x1a2a52, 0.55));

    const planet = new Group(); // positioned and scaled to screen
    const tilt = new Group();
    tilt.rotation.x = TILT;
    planet.add(tilt);
    scene.add(planet);

    const loader = new TextureLoader();
    Promise.all([
      loadTex(loader, 'earth_day_4096.jpg', true),
      loadTex(loader, 'earth_bump_2048.jpg', false),
      loadTex(loader, 'earth_specular_2048.jpg', false),
      loadTex(loader, 'earth_clouds_1024.png', true),
    ])
      .then(([day, bump, spec, clouds]) => {
        if (disposed || !renderer) return;
        disposables.push(day, bump, spec, clouds);

        const earthGeo = new SphereGeometry(1, 128, 128);
        const earthMat = new MeshPhongMaterial({
          map: day,
          bumpMap: bump,
          bumpScale: 0.035,
          specularMap: spec,
          specular: new Color(0x34496b),
          shininess: 38,
        });
        const earth = new Mesh(earthGeo, earthMat);
        earth.rotation.y = -((INDIA_LON + 90) * Math.PI) / 180;

        const cloudGeo = new SphereGeometry(1.012, 96, 96);
        const cloudMat = new MeshPhongMaterial({
          map: clouds,
          transparent: true,
          opacity: 0.75,
          depthWrite: false,
          shininess: 0,
        });
        const cloudMesh = new Mesh(cloudGeo, cloudMat);

        const rim = atmosphere(1.006, '#6db0ff', 2.6, 1.8, false);
        const halo = atmosphere(1.08, "#4a90ff", 2.2, 1.7, true);
        tilt.add(earth, cloudMesh, rim, halo);
        disposables.push(earthGeo, earthMat, cloudGeo, cloudMat);
        [rim, halo].forEach((m) => {
          disposables.push(m.geometry, m.material as Material);
        });

        const layout = () => {
          if (!renderer) return;
          const w = wrap.clientWidth;
          const h = wrap.clientHeight;
          if (!w || !h) return;
          renderer.setSize(w, h, false);
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          const ppu = h / (2 * CAM_Z * Math.tan((FOV * Math.PI) / 360)); // px per world unit at z=0
          const phone = w < 640;
          const radius = phone ? Math.max(w * 0.95, h * 0.42) : Math.max(w * 0.58, h * 0.9);
          const topY = h * (phone ? 0.5 : 0.47); // where the globe's crown sits
          const cy = topY + radius;
          planet.scale.setScalar(radius / ppu);
          planet.position.set(0, (h / 2 - cy) / ppu, 0);
        };
        layout();
        ro = new ResizeObserver(layout);
        ro.observe(wrap);

        const clock = new Clock();
        const draw = () => renderer?.render(scene, camera);
        const tick = () => {
          raf = requestAnimationFrame(tick);
          const dt = Math.min(clock.getDelta(), 0.1);
          earth.rotation.y += dt * 0.035;
          cloudMesh.rotation.y += dt * 0.045;
          draw();
        };
        const start = () => {
          if (raf || reducedMotion) return;
          clock.getDelta();
          raf = requestAnimationFrame(tick);
        };
        const stop = () => {
          cancelAnimationFrame(raf);
          raf = 0;
        };
        onVis = () => (document.hidden ? stop() : start());
        document.addEventListener('visibilitychange', onVis);

        draw();
        onReady();
        start();
      })
      .catch(() => {
        if (!disposed) onError();
      });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro?.disconnect();
      if (onVis) document.removeEventListener('visibilitychange', onVis);
      disposables.forEach((d) => d.dispose());
      renderer?.dispose();
      renderer?.domElement.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion]);

  return <div ref={wrapRef} className="absolute inset-0" />;
}
