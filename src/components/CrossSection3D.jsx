import React, { useMemo, useState, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";
import * as THREE from "three";

const crustWidth = 600;
const crustHeight = 100;
const crustDepth = 500;
const scale = 1;
const displayedDepthMultiplier = 3;
const trueEpicenterDepth = 10;
const visualDepth = trueEpicenterDepth * displayedDepthMultiplier;
const maxReceiverDistance = crustWidth / 2;

function BillboardText({ position, color, fontSize = 8, children }) {
  const textRef = useRef();
  const { camera } = useThree();

  useFrame(() => {
    if (!textRef.current) return;
    textRef.current.quaternion.slerp(camera.quaternion, 0.2);
  });

  return (
    <Text ref={textRef} position={position} color={color} fontSize={fontSize}>
      {children}
    </Text>
  );
}

export default function CrossSection3D() {
  const [azimuth, setAzimuth] = useState(0);
  const [distance, setDistance] = useState(200);

  const safeDistance = Math.min(distance, maxReceiverDistance);
  const surfaceCenter = new THREE.Vector3(0, 0, 0);

  const epicenter = useMemo(
    () => new THREE.Vector3(0, -visualDepth * scale, 0),
    []
  );

  const receiver = useMemo(() => {
    const azimuthRad = THREE.MathUtils.degToRad(azimuth);
    const x = safeDistance * Math.cos(azimuthRad);
    const z = safeDistance * Math.sin(azimuthRad);
    return new THREE.Vector3(x, 0, z);
  }, [azimuth, safeDistance]);

  const lineDepth = useMemo(
    () => new THREE.BufferGeometry().setFromPoints([surfaceCenter, epicenter]),
    []
  );
  const lineSurface = useMemo(
    () => new THREE.BufferGeometry().setFromPoints([surfaceCenter, receiver]),
    [receiver]
  );
  const lineDiag = useMemo(
    () => new THREE.BufferGeometry().setFromPoints([epicenter, receiver]),
    [epicenter, receiver]
  );

  const lineZeroDeg = useMemo(() => {
    return new THREE.BufferGeometry().setFromPoints([
      surfaceCenter,
      new THREE.Vector3(safeDistance, 0, 0),
    ]);
  }, [safeDistance]);

  const arcPoints = useMemo(() => {
    const points = [];
    const segments = 64;
    const radius = safeDistance / 4;
    const endAngle = THREE.MathUtils.degToRad(azimuth);

    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * endAngle;
      const x = radius * Math.cos(angle);
      const z = radius * Math.sin(angle);
      points.push(new THREE.Vector3(x, 0.5, z));
    }

    return new THREE.BufferGeometry().setFromPoints(points);
  }, [azimuth, safeDistance]);

  return (
    <div style={{ height: "100vh", width: "100vw", position: "relative" }}>
      <div
        style={{
          position: "absolute",
          top: 10,
          left: 10,
          zIndex: 10,
          padding: "12px",
          background: "rgba(255, 255, 255, 0.9)",
          border: "1px solid #ccc",
          borderRadius: "8px",
        }}
      >
        <label>
          Azimuth (°):&nbsp;
          <input
            type="number"
            value={azimuth}
            min={0}
            max={360}
            step={1}
            onChange={(e) =>
              setAzimuth(
                Math.max(0, Math.min(360, Number(e.target.value) || 0))
              )
            }
            style={{ width: "100px", marginBottom: "8px" }}
          />
        </label>
      </div>

      <Canvas
        camera={{ position: [0, 200, 600], fov: 50, near: 0.1, far: 5000 }}
      >
        <ambientLight />
        <pointLight position={[0, 300, 300]} />
        <OrbitControls maxDistance={1000} />

        {/* Crust */}
        <mesh position={[0, -crustHeight / 2, 0]}>
          <boxGeometry args={[crustWidth, crustHeight, crustDepth]} />
          <meshStandardMaterial color="#b8860b" transparent opacity={0.25} />
        </mesh>

        {/* Surface */}
        <mesh position={[0, 0.51, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[crustWidth, crustDepth]} />
          <meshStandardMaterial color="#228B22" transparent opacity={0.3} />
        </mesh>

        {/* Reference Ring */}
        <mesh position={[0, 0.55, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[safeDistance - 1, safeDistance + 1, 128]} />
          <meshBasicMaterial
            color="purple"
            side={THREE.DoubleSide}
            transparent
            opacity={0.5}
          />
        </mesh>

        {/* Azimuth Arc */}
        <line geometry={arcPoints}>
          <lineBasicMaterial color="red" />
        </line>

        {/* 0° Line */}
        <line geometry={lineZeroDeg}>
          <lineBasicMaterial color="green" />
        </line>

        {/* Epicenter */}
        <mesh position={epicenter}>
          <sphereGeometry args={[6, 32, 32]} />
          <meshStandardMaterial color="red" />
        </mesh>

        {/* Receiver */}
        <mesh position={receiver}>
          <coneGeometry args={[8, 20, 32]} />
          <meshStandardMaterial color="blue" />
        </mesh>

        {/* Connection Lines */}
        <line geometry={lineDepth}>
          <lineBasicMaterial color="blue" />
        </line>
        <line geometry={lineSurface}>
          <lineBasicMaterial color="orange" />
        </line>
        <line geometry={lineDiag}>
          <lineBasicMaterial color="gray" />
        </line>

        {/* Labels */}
        <BillboardText
          position={[safeDistance + 10, 5, 0]}
          fontSize={10}
          color="green"
        >
          0° (N)
        </BillboardText>

        <BillboardText
          position={[receiver.x, 10, receiver.z]}
          fontSize={12}
          color="blue"
        >
          Receiver
        </BillboardText>

        <BillboardText position={[0, 10, 0]} fontSize={12} color="red">
          Azimuth: {azimuth.toFixed(1)}°
        </BillboardText>

        <BillboardText
          position={[
            (surfaceCenter.x + receiver.x) / 2,
            8,
            (surfaceCenter.z + receiver.z) / 2,
          ]}
          fontSize={12}
          color="orange"
        >
          600 km
        </BillboardText>

        <BillboardText
          position={[0, -visualDepth / 2 - 5, 10]}
          fontSize={10}
          color="red"
        >
          Epicenter (10 km)
        </BillboardText>
      </Canvas>
    </div>
  );
}
