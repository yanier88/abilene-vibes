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
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
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
    color: 0xf5b72f,
    emissive: 0x2c1600,
    emissiveIntensity: 0.1,
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
    color: 0xf0b333,
    emissive: 0x2b1600,
    emissiveIntensity: 0.08,
    metalness: 1,
    roughness: 0.21,
    clearcoat: 0.52,
    clearcoatRoughness: 0.18,
  });
  const ruby = createGemMaterial(THREE, 0xa4051c);
  const sapphire = createGemMaterial(THREE, 0x165ad8);
  const emerald = createGemMaterial(THREE, 0x06985c);

  const base = new THREE.Mesh(new THREE.TorusGeometry(0.92, 0.12, 10, 42), gold);
  base.scale.y = 0.44;
  base.rotation.x = Math.PI / 2;
  base.position.y = -0.56;
  group.add(base);

  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.94, 0.88, 0.32, 42, 1, true), gold);
  band.scale.z = 0.45;
  band.position.y = -0.43;
  group.add(band);

  const jewelGeometry = new THREE.OctahedronGeometry(0.095, 1);
  const jewelMaterials = [ruby, sapphire, emerald, ruby, sapphire];

  for (let i = 0; i < 5; i += 1) {
    const x = (i - 2) * 0.36;
    const isCenter = i === 2;
    const spikeHeight = isCenter ? 1.05 : 0.8;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.16, spikeHeight, 4), gold);
    spike.position.set(x, -0.03 + spikeHeight / 2, 0.08);
    spike.rotation.y = Math.PI / 4;
    group.add(spike);

    const orb = new THREE.Mesh(new THREE.SphereGeometry(isCenter ? 0.14 : 0.11, 16, 10), gold);
    orb.position.set(x, -0.03 + spikeHeight, 0.08);
    group.add(orb);

    const gem = new THREE.Mesh(jewelGeometry.clone(), jewelMaterials[i]);
    gem.position.set(x, -0.44, 0.42);
    gem.scale.set(1, 1.22, 0.55);
    group.add(gem);
  }

  const archGeometry = new THREE.TorusGeometry(0.6, 0.045, 8, 32, Math.PI);
  for (let i = 0; i < 2; i += 1) {
    const arch = new THREE.Mesh(archGeometry, gold);
    arch.position.y = -0.1;
    arch.rotation.set(0, i === 0 ? Math.PI / 2 : 0, 0);
    arch.scale.set(1, 0.86, 1);
    group.add(arch);
  }

  group.rotation.x = -0.08;
  group.scale.setScalar(1.02);
  return group;
};

export default function Promo3DIcon({ type }) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const [fallback, setFallback] = useState(false);
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
        });
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
        setFallback(true);
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

  return (
    <div className={`promo-3d-icon ${config.sizeClass}`} aria-hidden="true" ref={containerRef}>
      {fallback ? <span className="promo-3d-fallback">{type === "premium" ? "Premium" : "Featured"}</span> : null}
      <canvas ref={canvasRef} aria-label={config.label} />
      <span className="promo-3d-sparkles">
        {config.sparkles.map(([left, top, delay]) => (
          <span key={`${left}-${top}`} style={{ left, top, animationDelay: delay }} />
        ))}
      </span>
    </div>
  );
}
