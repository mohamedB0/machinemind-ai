"use client";
import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Lightformer, Float } from "@react-three/drei";
import * as THREE from "three";

const TAU = Math.PI * 2;

// Shared module so every gear has identically sized teeth and meshes cleanly
const MODULE = 0.148;
const SPEED_MAIN = 0.22;
const MAIN_TEETH = 18;

const gearOf = (teeth: number) => {
  const r = (MODULE * teeth) / 2;
  return { teeth, r, outer: r + MODULE, inner: r - 1.25 * MODULE };
};
const G_MAIN = gearOf(MAIN_TEETH);
const G_B = gearOf(10);
const G_C = gearOf(12);

// Main gear crest directions: crest centers sit at 0.7125 per tooth pitch
const PHI_B = 0.7125 * (TAU / MAIN_TEETH) + TAU / MAIN_TEETH;
const PHI_C = PHI_B + 9 * (TAU / MAIN_TEETH);

const POS_B = [
  Math.cos(PHI_B) * (G_MAIN.r + G_B.r),
  Math.sin(PHI_B) * (G_MAIN.r + G_B.r),
  0.03,
] as [number, number, number];
const POS_C = [
  Math.cos(PHI_C) * (G_MAIN.r + G_C.r),
  Math.sin(PHI_C) * (G_MAIN.r + G_C.r),
  -0.03,
] as [number, number, number];

const SPEED_B = -(SPEED_MAIN * G_MAIN.teeth) / G_B.teeth;
const SPEED_C = -(SPEED_MAIN * G_MAIN.teeth) / G_C.teeth;

// Valley centers sit at 0.2125 per tooth pitch; align each satellite valley
// with a main crest along the line of centers, then the exact speed ratios
// and shared module keep teeth interlocked forever.
const PHASE_B = PHI_B + Math.PI - 0.2125 * (TAU / G_B.teeth);
const PHASE_C = PHI_C + Math.PI - 0.2125 * (TAU / G_C.teeth);

function gearShape(teeth: number, outer: number, inner: number, hole: number) {
  const shape = new THREE.Shape();
  const step = TAU / (teeth * 4);
  let a = 0;
  shape.moveTo(inner * Math.cos(a), inner * Math.sin(a));
  for (let i = 0; i < teeth; i++) {
    shape.absarc(0, 0, inner, a, a + step * 2, false);
    shape.absarc(0, 0, outer, a + step * 2, a + step * 3.7, false);
    shape.absarc(0, 0, inner, a + step * 3.7, a + step * 4, false);
    a += step * 4;
  }
  const bore = new THREE.Path();
  bore.absarc(0, 0, hole, 0, TAU, true);
  shape.holes.push(bore);
  return shape;
}

function useGearGeometry(teeth: number, r: number, depth: number) {
  return useMemo(() => {
    const outer = r + MODULE;
    const inner = r - 1.25 * MODULE;
    const geo = new THREE.ExtrudeGeometry(
      gearShape(teeth, outer, inner, r * 0.32),
      {
        depth,
        bevelEnabled: true,
        bevelThickness: 0.03,
        bevelSize: 0.028,
        bevelSegments: 2,
        curveSegments: 10,
      }
    );
    geo.center();
    return geo;
  }, [teeth, r, depth]);
}

const STEEL: THREE.MeshStandardMaterialParameters = {
  color: "#d6dbe3",
  metalness: 0.9,
  roughness: 0.24,
};

const TITANIUM: THREE.MeshStandardMaterialParameters = {
  color: "#7a828d",
  metalness: 0.82,
  roughness: 0.36,
};

type GearProps = {
  teeth: number;
  r: number;
  depth: number;
  speed: number;
  position: [number, number, number];
  variant?: "steel" | "titanium";
  phase?: number;
};

function Gear({ teeth, r, depth, speed, position, variant = "steel", phase = 0 }: GearProps) {
  const ref = useRef<THREE.Mesh>(null);
  const geo = useGearGeometry(teeth, r, depth);

  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.z += speed * dt;
  });

  return (
    <group position={position}>
      <mesh ref={ref} geometry={geo} rotation={[0, 0, phase]} castShadow receiveShadow>
        <meshStandardMaterial {...(variant === "steel" ? STEEL : TITANIUM)} envMapIntensity={1.1} />
      </mesh>
    </group>
  );
}

function ReactorCore() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const mat = ref.current.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = 1.6 + Math.sin(clock.elapsedTime * 1.2) * 0.5;
  });
  return (
    <group>
      <mesh position={[0, 0, -0.34]}>
        <circleGeometry args={[0.45, 40]} />
        <meshBasicMaterial color="#FF641F" transparent opacity={0.3} toneMapped={false} />
      </mesh>
      <mesh ref={ref} position={[0, 0, -0.3]}>
        <torusGeometry args={[0.3, 0.04, 12, 48]} />
        <meshStandardMaterial color="#FF641F" emissive="#FF641F" emissiveIntensity={1.6} toneMapped={false} />
      </mesh>
    </group>
  );
}

function RimBolts() {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.z += SPEED_MAIN * dt;
  });
  return (
    <group ref={ref}>
      {Array.from({ length: 6 }).map((_, i) => {
        const a = (i / 6) * TAU;
        return (
          <mesh
            key={i}
            position={[Math.cos(a) * 0.95, Math.sin(a) * 0.95, 0.18]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <cylinderGeometry args={[0.07, 0.07, 0.1, 6]} />
            <meshStandardMaterial color="#565d66" metalness={0.9} roughness={0.4} envMapIntensity={1} />
          </mesh>
        );
      })}
    </group>
  );
}

function Orbits() {
  const tilt1: [number, number, number] = [Math.PI / 2.25, 0.5, 0];
  const tilt2: [number, number, number] = [Math.PI / 1.75, -0.45, 0];
  return (
    <group>
      <mesh position={[0, 0, -0.85]} rotation={tilt1}>
        <torusGeometry args={[2.6, 0.012, 8, 128]} />
        <meshStandardMaterial color="#FF641F" emissive="#FF641F" emissiveIntensity={0.55} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0, -0.95]} rotation={tilt2}>
        <torusGeometry args={[2.85, 0.009, 8, 128]} />
        <meshStandardMaterial color="#FF641F" emissive="#FF641F" emissiveIntensity={0.35} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Assembly({ reduced }: { reduced: boolean }) {
  const spin = useRef<THREE.Group>(null);
  const tilt = useRef<THREE.Group>(null);

  useFrame(({ clock, pointer }, dt) => {
    const t = clock.elapsedTime;
    if (reduced) {
      if (spin.current) { spin.current.rotation.y = 0.2; spin.current.position.y = 0; }
      if (tilt.current) { tilt.current.rotation.x = 0.26; tilt.current.rotation.y = 0; }
      return;
    }
    if (spin.current) {
      spin.current.rotation.y = 0.2 + Math.sin(t * 0.18) * 0.4;
      spin.current.position.y = Math.sin(t * 0.45) * 0.07;
    }
    if (tilt.current) {
      const px = THREE.MathUtils.clamp(pointer.x, -0.6, 0.6);
      const py = THREE.MathUtils.clamp(pointer.y, -0.6, 0.6);
      tilt.current.rotation.x = THREE.MathUtils.damp(tilt.current.rotation.x, 0.26 + py * 0.14, 3.5, dt);
      tilt.current.rotation.y = THREE.MathUtils.damp(tilt.current.rotation.y, px * 0.28, 3.5, dt);
    }
  });

  return (
    <group ref={spin} scale={0.95}>
      <group ref={tilt} rotation={[0.26, 0, 0]}>
        <Float speed={1.0} rotationIntensity={reduced ? 0 : 0.1} floatIntensity={reduced ? 0 : 0.2} floatingRange={[-0.05, 0.05]}>
          <Gear teeth={G_MAIN.teeth} r={G_MAIN.r} depth={0.3} position={[0, 0, 0]} variant="steel" speed={SPEED_MAIN} phase={0} />
          <Gear teeth={G_B.teeth} r={G_B.r} depth={0.24} position={POS_B} variant="titanium" speed={SPEED_B} phase={PHASE_B} />
          <Gear teeth={G_C.teeth} r={G_C.r} depth={0.22} position={POS_C} variant="titanium" speed={SPEED_C} phase={PHASE_C} />
          <ReactorCore />
          <RimBolts />
          <Orbits />
        </Float>
      </group>
    </group>
  );
}

export default function HeroScene3D({ reduced = false }: { reduced?: boolean }) {
  return (
    <Canvas
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      camera={{ position: [0, 0.15, 10.4], fov: 35 }}
      style={{ touchAction: "none" }}
    >
      <ambientLight intensity={0.4} />
      <directionalLight position={[4, 5, 6]} intensity={2.0} color="#ffffff" />
      <directionalLight position={[-6, -2, 3]} intensity={0.9} color="#FF641F" />
      <directionalLight position={[-4, 3, -5]} intensity={1.2} color="#ffd4b8" />
      <spotLight position={[0, 6, 4]} angle={0.5} penumbra={1} intensity={1.1} color="#f4f5f7" />

      <Environment resolution={256}>
        <Lightformer intensity={2.6} position={[0, 5, 5]} scale={[10, 2, 1]} color="#ffffff" />
        <Lightformer intensity={1.6} position={[-6, 1, 3]} scale={[6, 1.5, 1]} color="#ffb08a" />
        <Lightformer intensity={1.2} position={[6, -1, 2]} scale={[6, 1.5, 1]} color="#FF641F" />
        <Lightformer intensity={0.6} position={[0, -5, 3]} scale={[10, 2, 1]} color="#aeb6c2" />
      </Environment>

      <Assembly reduced={reduced} />
    </Canvas>
  );
}
