import { useEffect, useRef, useState } from "react";
import "./Promo3DIcon.css";

const iconConfig = {
  featured: {
    label: "Featured Local 3D gold star",
    sizeClass: "promo-3d-icon--featured",
    sparkles: [
      ["18%", "23%", "0s"],
      ["79%", "19%", "0.45s"],
      ["68%", "72%", "0.9s"],
      ["29%", "78%", "1.25s"],
      ["50%", "8%", "1.65s"],
    ],
  },
  premium: {
    label: "Premium 3D gold crown",
    sizeClass: "promo-3d-icon--premium",
    sparkles: [
      ["15%", "30%", "0s"],
      ["82%", "24%", "0.38s"],
      ["74%", "69%", "0.82s"],
      ["22%", "74%", "1.18s"],
      ["49%", "11%", "1.5s"],
      ["58%", "85%", "1.95s"],
    ],
  },
};

const disposeObject = (object) => {
  object.traverse((child) => {
    if (child.geometry) child.geometry.dispose();

    if (child.material) {
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => material.dispose());
    }
  });
};

const createStar = (THREE) => {
  const shape = new THREE.Shape();
  const outerRadius = 1.18;
  const innerRadius = 0.52;

  for (let i = 0; i < 10; i += 1) {
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    const angle = Math.PI / 2 + (i * Math.PI) / 5;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;

    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }

  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.34,
    bevelEnabled: true,
    bevelThickness: 0.11,
    bevelSize: 0.11,
    bevelSegments: 5,
    curveSegments: 2,
  });
  geometry.center();

  const material = new THREE.MeshPhysicalMaterial({
    color: 0xffdc73,
    emissive: 0x3a2100,
    emissiveIntensity: 0.12,
    metalness: 1,
    roughness: 0.23,
    clearcoat: 0.45,
    clearcoatRoughness: 0.2,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -0.08;
  mesh.scale.setScalar(0.92);
  return mesh;
};

const createGemMaterial = (THREE, color) =>
  new THREE.MeshPhysicalMaterial({
    color,
    metalness: 0.05,
    roughness: 0.16,
    transmission: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
  });

const createCrown = (THREE) => {
  const group = new THREE.Group();
  const gold = new THREE.MeshPhysicalMaterial({
    color: 0xffdc73,
    emissive: 0x332000,
    emissiveIntensity: 0.09,
    metalness: 1,
    roughness: 0.2,
    clearcoat: 0.55,
    clearcoatRoughness: 0.18,
  });
  const ruby = createGemMaterial(THREE, 0xa4051c);
  const sapphire = createGemMaterial(THREE, 0x165ad8);
  const emerald = createGemMaterial(THREE, 0x06985c);

  const base = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.11, 12, 64), gold);
  base.rotation.x = Math.PI / 2;
  base.scale.y = 0.92;
  base.position.y = -0.58;
  group.add(base);

  const innerRim = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.035, 8, 48), gold);
  innerRim.rotation.x = Math.PI / 2;
  innerRim.scale.y = 0.9;
  innerRim.position.set(0, -0.33, 0);
  group.add(innerRim);

  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.78, 0.36, 64, 1, true), gold);
  band.scale.z = 0.9;
  band.position.y = -0.42;
  group.add(band);

  const panelShape = new THREE.Shape();
  panelShape.moveTo(-0.11, -0.58);
  panelShape.lineTo(0.11, -0.58);
  panelShape.lineTo(0.15, -0.18);
  panelShape.lineTo(0, 0.08);
  panelShape.lineTo(-0.15, -0.18);
  panelShape.closePath();

  const panelGeometry = new THREE.ExtrudeGeometry(panelShape, {
    depth: 0.05,
    bevelEnabled: true,
    bevelThickness: 0.018,
    bevelSize: 0.015,
    bevelSegments: 2,
  });
  panelGeometry.translate(0, 0, -0.025);

  for (let i = 0; i < 12; i += 1) {
    const angle = (i / 12) * Math.PI * 2;
    const frontWeight = Math.max(0, Math.cos(angle));
    const panel = new THREE.Mesh(panelGeometry.clone(), gold);
    panel.position.set(Math.sin(angle) * 0.72, 0, Math.cos(angle) * 0.72);
    panel.rotation.y = angle;
    panel.scale.y = 0.78 + frontWeight * 0.36;
    group.add(panel);
  }

  const crownPoints = [
    { angle: 0, height: 1.2, radius: 0.12, material: emerald },
    { angle: Math.PI / 4, height: 0.9, radius: 0.095, material: ruby },
    { angle: -Math.PI / 4, height: 0.9, radius: 0.095, material: ruby },
    { angle: Math.PI / 2, height: 0.72, radius: 0.082, material: sapphire },
    { angle: -Math.PI / 2, height: 0.72, radius: 0.082, material: sapphire },
    { angle: Math.PI, height: 0.66, radius: 0.078, material: emerald },
  ];

  crownPoints.forEach((point) => {
    const x = Math.sin(point.angle) * 0.72;
    const z = Math.cos(point.angle) * 0.72;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(point.radius, point.height, 5), gold);
    spike.position.set(x, -0.2 + point.height / 2, z);
    spike.rotation.set(0, point.angle, point.angle === 0 ? 0 : Math.sin(point.angle) * -0.08);
    group.add(spike);

    const orb = new THREE.Mesh(new THREE.SphereGeometry(point.radius * 0.92, 16, 10), gold);
    orb.position.set(x, -0.18 + point.height, z);
    group.add(orb);

    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(point.radius * 0.74, 1), point.material);
    gem.position.set(Math.sin(point.angle) * 0.76, -0.42, Math.cos(point.angle) * 0.76);
    gem.rotation.y = point.angle;
    gem.scale.set(1, 1.24, 0.58);
    group.add(gem);
  });

  const archGeometry = new THREE.TorusGeometry(0.5, 0.045, 8, 36, Math.PI);
  for (let i = 0; i < 4; i += 1) {
    const arch = new THREE.Mesh(archGeometry, gold);
    arch.position.y = -0.06;
    arch.rotation.set(0, (i * Math.PI) / 4, 0);
    arch.scale.set(1, 0.95, 1);
    group.add(arch);
  }

  const frontRuby = new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 1), ruby);
  frontRuby.position.set(0, -0.61, 0.79);
  frontRuby.scale.set(1.18, 1, 0.58);
  group.add(frontRuby);

  group.rotation.x = -0.08;
  group.scale.setScalar(1.4);
  return group;
};

export default function Promo3DIcon({ type }) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const [renderStatus, setRenderStatus] = useState("loading");
  const config = iconConfig[type] ?? iconConfig.featured;

  useEffect(() => {
    let frameId = 0;
    let renderer;
    let scene;
    let camera;
    let model;
    let observer;
    let resizeObserver;
    let disposed = false;
    let isVisible = true;
    let isDocumentVisible = !document.hidden;
    const motionQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    let reducedMotion = Boolean(motionQuery?.matches);
    let lastTime = 0;

    const shouldRender = () => !disposed && isVisible && isDocumentVisible;

    const renderFrame = (time = 0) => {
      if (!renderer || !scene || !camera || !model) return;

      if (shouldRender()) {
        const delta = Math.min((time - lastTime) / 1000 || 0, 0.05);
        if (!reducedMotion) {
          model.rotation.y += delta * ((Math.PI * 2) / 8);
        }
        renderer.render(scene, camera);
      }

      lastTime = time;
      frameId = window.requestAnimationFrame(renderFrame);
    };

    const initialize = async () => {
      try {
        const THREE = await import("three");
        if (disposed || !canvasRef.current || !containerRef.current) return;

        renderer = new THREE.WebGLRenderer({
          canvas: canvasRef.current,
          alpha: true,
          antialias: true,
          powerPreference: "high-performance",
          premultipliedAlpha: false,
        });
        renderer.setClearColor(0x000000, 0);
        renderer.setClearAlpha(0);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.06;

        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
        camera.position.set(0, 0.06, 5.2);

        scene.add(new THREE.AmbientLight(0xfff4d5, 1.55));
        const key = new THREE.DirectionalLight(0xffffff, 2.35);
        key.position.set(2.6, 3.4, 4);
        scene.add(key);
        const rim = new THREE.DirectionalLight(0x66dfff, 1.25);
        rim.position.set(-2.8, 1.8, -3);
        scene.add(rim);
        const warmFill = new THREE.PointLight(0xffc44f, 1.35, 7);
        warmFill.position.set(-1.4, -0.8, 2.8);
        scene.add(warmFill);

        model = type === "premium" ? createCrown(THREE) : createStar(THREE);
        scene.add(model);

        const resize = () => {
          if (!renderer || !camera || !containerRef.current) return;
          const { width, height } = containerRef.current.getBoundingClientRect();
          const nextWidth = Math.max(1, Math.round(width));
          const nextHeight = Math.max(1, Math.round(height));
          renderer.setSize(nextWidth, nextHeight, false);
          camera.aspect = nextWidth / nextHeight;
          camera.updateProjectionMatrix();
          renderer.render(scene, camera);
        };

        resize();
        setRenderStatus("ready");
        resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(containerRef.current);
        observer = new IntersectionObserver(([entry]) => {
          isVisible = Boolean(entry?.isIntersecting);
          if (isVisible) lastTime = performance.now();
        });
        observer.observe(containerRef.current);

        frameId = window.requestAnimationFrame(renderFrame);
      } catch (error) {
        console.warn("[Promo3DIcon] WebGL icon fallback:", error);
        setRenderStatus("failed");
      }
    };

    const handleVisibility = () => {
      isDocumentVisible = !document.hidden;
      if (isDocumentVisible) lastTime = performance.now();
    };
    const handleMotionChange = (event) => {
      reducedMotion = Boolean(event.matches);
    };

    document.addEventListener("visibilitychange", handleVisibility);
    motionQuery?.addEventListener?.("change", handleMotionChange);
    initialize();

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frameId);
      observer?.disconnect();
      resizeObserver?.disconnect();
      document.removeEventListener("visibilitychange", handleVisibility);
      motionQuery?.removeEventListener?.("change", handleMotionChange);
      if (model) disposeObject(model);
      renderer?.dispose();
    };
  }, [type]);

  if (renderStatus === "failed") {
    return null;
  }

  return (
    <div className={`promo-3d-icon ${config.sizeClass}`} aria-hidden="true" ref={containerRef}>
      <canvas className={renderStatus === "ready" ? "is-ready" : ""} ref={canvasRef} aria-label={config.label} />
      <span className="promo-3d-sparkles">
        {config.sparkles.map(([left, top, delay]) => (
          <span key={`${left}-${top}`} style={{ left, top, animationDelay: delay }} />
        ))}
      </span>
    </div>
  );
}
