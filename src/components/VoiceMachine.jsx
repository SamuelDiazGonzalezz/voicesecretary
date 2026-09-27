import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Float, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';

const YELLOW = '#ffd400';

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return reduced;
}

function useCanvasVisibility(ref) {
  const [isVisible, setVisible] = useState(true);

  useEffect(() => {
    if (!ref.current) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { rootMargin: '120px' },
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref]);

  return isVisible;
}

function supportsWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext('webgl2') || canvas.getContext('webgl')),
    );
  } catch {
    return false;
  }
}

function ResponsiveCamera() {
  const { camera, size } = useThree();

  useEffect(() => {
    const isMobile = size.width < 720;
    camera.position.set(isMobile ? 0.4 : 0.9, isMobile ? -0.35 : 0.05, isMobile ? 8.9 : 7.2);
    camera.fov = isMobile ? 48 : 42;
    camera.updateProjectionMatrix();
  }, [camera, size.width]);

  return null;
}

function SignalLine({ activity, reducedMotion }) {
  const geometry = useMemo(() => {
    const buffer = new THREE.BufferGeometry();
    buffer.setAttribute('position', new THREE.BufferAttribute(new Float32Array(180 * 3), 3));
    return buffer;
  }, []);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame(({ clock }) => {
    const position = geometry.attributes.position;
    const time = reducedMotion ? 0.7 : clock.elapsedTime;
    const energy = activity ? 0.62 : 0.22;

    for (let index = 0; index < position.count; index += 1) {
      const progress = index / (position.count - 1);
      const x = (progress - 0.5) * 7.8;
      const envelope = Math.pow(Math.sin(progress * Math.PI), 1.7);
      const voice =
        Math.sin(x * 4.2 + time * 4.1) * 0.42 +
        Math.sin(x * 8.7 - time * 2.4) * 0.18 +
        Math.sin(x * 15.4 + time * 6.2) * 0.07;

      position.setXYZ(index, x, voice * envelope * energy, 0.95);
    }
    position.needsUpdate = true;
  });

  return (
    <line geometry={geometry}>
      <lineBasicMaterial color={YELLOW} transparent opacity={0.9} toneMapped={false} />
    </line>
  );
}

function DataArc({ radius, rotation, opacity = 0.45 }) {
  return (
    <mesh rotation={rotation}>
      <torusGeometry args={[radius, 0.012, 8, 180]} />
      <meshBasicMaterial
        color={YELLOW}
        transparent
        opacity={opacity}
        toneMapped={false}
      />
    </mesh>
  );
}

function SideModule({ position, side = 1 }) {
  return (
    <group position={position} rotation={[0, side * -0.14, 0]}>
      <RoundedBox args={[0.86, 2.65, 0.64]} radius={0.12} smoothness={5}>
        <meshStandardMaterial color="#101010" metalness={0.82} roughness={0.3} />
      </RoundedBox>
      <mesh position={[0, 0.63, 0.34]}>
        <boxGeometry args={[0.48, 0.028, 0.02]} />
        <meshBasicMaterial color={YELLOW} toneMapped={false} />
      </mesh>
      <mesh position={[0, -0.72, 0.34]}>
        <circleGeometry args={[0.13, 32]} />
        <meshBasicMaterial color="#5f5f5f" />
      </mesh>
      <mesh position={[0, -1.03, 0.34]}>
        <circleGeometry args={[0.08, 32]} />
        <meshBasicMaterial color="#303030" />
      </mesh>
    </group>
  );
}

function VoiceCore({ activity, reducedMotion }) {
  const group = useRef();
  const core = useRef();
  const halo = useRef();
  const particles = useRef();

  const particlePositions = useMemo(() => {
    const positions = new Float32Array(160 * 3);
    for (let index = 0; index < 160; index += 1) {
      const angle = index * 2.399963;
      const radius = 2.25 + ((index * 17) % 31) / 72;
      positions[index * 3] = Math.cos(angle) * radius;
      positions[index * 3 + 1] = ((index % 29) / 28 - 0.5) * 4.4;
      positions[index * 3 + 2] = Math.sin(angle) * radius * 0.52;
    }
    return positions;
  }, []);

  useFrame(({ clock, pointer }, delta) => {
    if (!group.current || !core.current || !halo.current) return;

    const targetX = reducedMotion ? 0 : pointer.y * 0.08;
    const targetY = reducedMotion ? 0 : pointer.x * 0.12;
    group.current.rotation.x = THREE.MathUtils.damp(group.current.rotation.x, targetX, 4, delta);
    group.current.rotation.y = THREE.MathUtils.damp(group.current.rotation.y, targetY, 4, delta);

    if (!reducedMotion) {
      core.current.rotation.y += delta * (activity ? 0.42 : 0.16);
      core.current.rotation.x += delta * 0.07;
      halo.current.rotation.z -= delta * (activity ? 0.32 : 0.12);
      if (particles.current) particles.current.rotation.y += delta * 0.025;
    }

    const pulse = reducedMotion
      ? 1
      : 1 + Math.sin(clock.elapsedTime * (activity ? 5.4 : 2.2)) * (activity ? 0.045 : 0.012);
    core.current.scale.setScalar(pulse);
  });

  const content = (
    <group ref={group} position={[1.04, 0.06, 0]}>
      <SideModule position={[-2.05, 0, -0.28]} side={-1} />
      <SideModule position={[2.05, 0, -0.28]} side={1} />

      <group ref={core}>
        <RoundedBox args={[2.35, 3.45, 1.36]} radius={0.34} smoothness={8}>
          <meshPhysicalMaterial
            color="#0d0d0d"
            metalness={0.92}
            roughness={0.2}
            clearcoat={0.8}
            clearcoatRoughness={0.25}
          />
        </RoundedBox>
        <mesh position={[0, 0, 0.72]}>
          <icosahedronGeometry args={[0.94, 5]} />
          <meshStandardMaterial
            color="#171717"
            emissive={YELLOW}
            emissiveIntensity={activity ? 0.35 : 0.12}
            metalness={0.72}
            roughness={0.28}
          />
        </mesh>
        <mesh position={[0, 0, 0.74]} scale={1.02}>
          <icosahedronGeometry args={[0.94, 2]} />
          <meshBasicMaterial color={YELLOW} wireframe transparent opacity={0.23} />
        </mesh>
        <mesh position={[0, -1.28, 0.71]}>
          <boxGeometry args={[0.72, 0.028, 0.02]} />
          <meshBasicMaterial color={YELLOW} toneMapped={false} />
        </mesh>
      </group>

      <group ref={halo} position={[0, 0, 0.12]}>
        <DataArc radius={1.72} rotation={[1.26, 0.1, 0.35]} opacity={activity ? 0.76 : 0.34} />
        <DataArc radius={2.12} rotation={[0.38, 0.86, 0.12]} opacity={0.24} />
        <DataArc radius={2.58} rotation={[1.48, 0.2, -0.34]} opacity={0.16} />
      </group>

      <SignalLine activity={activity} reducedMotion={reducedMotion} />

      <points ref={particles} positions={particlePositions}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[particlePositions, 3]} />
        </bufferGeometry>
        <pointsMaterial color="#b7b7b0" size={0.018} transparent opacity={0.46} sizeAttenuation />
      </points>
    </group>
  );

  return reducedMotion ? content : (
    <Float speed={1.1} rotationIntensity={0.08} floatIntensity={0.18} floatingRange={[-0.08, 0.08]}>
      {content}
    </Float>
  );
}

function MachineScene({ activity, reducedMotion }) {
  return (
    <>
      <ResponsiveCamera />
      <ambientLight intensity={0.8} />
      <directionalLight position={[2, 4, 5]} intensity={3.4} color="#fff8d5" />
      <pointLight position={[2.2, 0, 3.2]} intensity={activity ? 16 : 7} color={YELLOW} distance={7} />
      <pointLight position={[-4, -1, 2]} intensity={3} color="#4a87ff" distance={7} />
      <VoiceCore activity={activity} reducedMotion={reducedMotion} />
    </>
  );
}

function StaticFallback() {
  return (
    <div className="machine-fallback" aria-hidden="true">
      <span className="machine-fallback__ring machine-fallback__ring--one" />
      <span className="machine-fallback__ring machine-fallback__ring--two" />
      <span className="machine-fallback__core" />
      <span className="machine-fallback__signal" />
    </div>
  );
}

export default function VoiceMachine({ activity = false }) {
  const wrapperRef = useRef(null);
  const reducedMotion = useReducedMotion();
  const isVisible = useCanvasVisibility(wrapperRef);
  const [webglAvailable] = useState(() => supportsWebGL());

  return (
    <div className="voice-machine" ref={wrapperRef} data-webgl={webglAvailable ? 'ready' : 'fallback'}>
      {webglAvailable ? (
        <Canvas
          aria-hidden="true"
          camera={{ position: [0.9, 0.05, 7.2], fov: 42, near: 0.1, far: 100 }}
          dpr={[1, 1.7]}
          frameloop={isVisible && !reducedMotion ? 'always' : 'demand'}
          gl={{
            alpha: true,
            antialias: true,
            powerPreference: 'high-performance',
            preserveDrawingBuffer: true,
          }}
        >
          <MachineScene activity={activity} reducedMotion={reducedMotion} />
        </Canvas>
      ) : (
        <StaticFallback />
      )}
    </div>
  );
}
