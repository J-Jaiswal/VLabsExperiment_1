import React, { useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";
import * as THREE from "three";
import { Matrix, EigenvalueDecomposition } from "ml-matrix";
import { strikeDipRakeToMomentTensor } from "../data/tensors";

export default function InteractiveBeachBall() {
  const [strike, setStrike] = useState(30);
  const [dip, setDip] = useState(60);
  const [rake, setRake] = useState(-90);
  const magnitudeMw = 5.5;

  const { P, T, B, dots, lobeGeometry, nodalLines } = useMemo(() => {
    const mt = strikeDipRakeToMomentTensor(strike, dip, rake, magnitudeMw);

    const M = new Matrix([
      [mt.Mrr, mt.Mrt, mt.Mrp],
      [mt.Mrt, mt.Mtt, mt.Mtp],
      [mt.Mrp, mt.Mtp, mt.Mpp],
    ]);

    const eig = new EigenvalueDecomposition(M);
    const eigenvalues = eig.realEigenvalues;
    const eigenvectors = eig.eigenvectorMatrix.to2DArray();

    const sorted = eigenvalues
      .map((val, i) => ({ val, vec: eigenvectors.map((row) => row[i]) }))
      .sort((a, b) => a.val - b.val);

    const P = new THREE.Vector3(...sorted[0].vec);
    const B = new THREE.Vector3(...sorted[1].vec);
    const T = new THREE.Vector3(...sorted[2].vec);

    const dots = generateShadedDots(mt, 10000);
    const lobeGeometry = generateRadiationLobe(mt, 1.5);
    const nodalLines = generateNodalGreatCircles(strike, dip, rake);

    return { P, B, T, dots, lobeGeometry, nodalLines };
  }, [strike, dip, rake]);

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      {/* Sidebar sliders */}
      <div style={{ width: "250px", padding: "20px", background: "#f9f9f9" }}>
        <h3>Focal Mechanism</h3>
        <label>Strike: {strike}°</label>
        <input
          type="range"
          min={0}
          max={360}
          value={strike}
          onChange={(e) => setStrike(+e.target.value)}
        />
        <br />
        <label>Dip: {dip}°</label>
        <input
          type="range"
          min={0}
          max={90}
          value={dip}
          onChange={(e) => setDip(+e.target.value)}
        />
        <br />
        <label>Rake: {rake}°</label>
        <input
          type="range"
          min={-180}
          max={180}
          value={rake}
          onChange={(e) => setRake(+e.target.value)}
        />
      </div>

      {/* 3D Scene */}
      <div style={{ flex: 1 }}>
        <Canvas camera={{ position: [0, 0, 3] }}>
          <ambientLight />
          <OrbitControls />

          {/* Transparent sphere */}
          <mesh>
            <sphereGeometry args={[1, 64, 64]} />
            <meshStandardMaterial color="white" opacity={0.2} transparent />
          </mesh>

          {/* Shading dots */}
          {dots.map((dot, i) => (
            <mesh key={i} position={dot.pos}>
              <sphereGeometry args={[0.01, 4, 4]} />
              <meshBasicMaterial color={dot.color} />
            </mesh>
          ))}

          {/* Radiation lobes (amplitude surface) */}
          <mesh geometry={lobeGeometry}>
            <meshStandardMaterial color="#9999ff" opacity={0.4} transparent />
          </mesh>

          {/* Nodal great circles */}
          {nodalLines.map((linePoints, i) => (
            <line key={i}>
              <bufferGeometry>
                <bufferAttribute
                  attach="attributes-position"
                  array={new Float32Array(linePoints.flat())}
                  count={linePoints.length}
                  itemSize={3}
                />
              </bufferGeometry>
              <lineBasicMaterial color="orange" />
            </line>
          ))}

          {/* Axes & labels */}
          <AxisArrow direction={P} color="black" label="P" />
          <AxisArrow direction={T} color="red" label="T" />
          <AxisArrow direction={B} color="blue" label="B" />
        </Canvas>
      </div>
    </div>
  );
}

function AxisArrow({ direction, color, label }) {
  const dir = direction.clone().normalize();
  const neg = dir.clone().negate();

  return (
    <>
      <arrowHelper args={[dir, new THREE.Vector3(0, 0, 0), 1.5, color]} />
      <arrowHelper args={[neg, new THREE.Vector3(0, 0, 0), 1.5, color]} />
      <Text
        position={dir.clone().multiplyScalar(1.7)}
        fontSize={0.12}
        color={color}
      >
        {label}
      </Text>
    </>
  );
}

// Hemisphere polarity shading
function generateShadedDots(mt, count = 10000) {
  const dots = [];
  for (let i = 0; i < count; i++) {
    const theta = Math.acos(Math.random());
    const phi = Math.random() * 2 * Math.PI;
    const x = Math.sin(theta) * Math.cos(phi);
    const y = Math.sin(theta) * Math.sin(phi);
    const z = -Math.abs(Math.cos(theta));

    const dir = new THREE.Vector3(x, y, z).normalize();
    const u =
      mt.Mrr * dir.x * dir.x +
      mt.Mtt * dir.y * dir.y +
      mt.Mpp * dir.z * dir.z +
      2 * mt.Mrt * dir.x * dir.y +
      2 * mt.Mrp * dir.x * dir.z +
      2 * mt.Mtp * dir.y * dir.z;

    const color = u >= 0 ? "black" : "white";
    dots.push({ pos: [x, y, z], color });
  }
  return dots;
}

// Radiation amplitude surface
function generateRadiationLobe(mt, scale = 2) {
  const geometry = new THREE.BufferGeometry();
  const vertices = [];

  const latSteps = 40;
  const lonSteps = 80;
  for (let i = 0; i <= latSteps; i++) {
    const theta = (i / latSteps) * Math.PI; // 0 to π
    for (let j = 0; j <= lonSteps; j++) {
      const phi = (j / lonSteps) * 2 * Math.PI;

      const x = Math.sin(theta) * Math.cos(phi);
      const y = Math.sin(theta) * Math.sin(phi);
      const z = Math.cos(theta);

      const dir = new THREE.Vector3(x, y, z).normalize();

      const u =
        mt.Mrr * dir.x * dir.x +
        mt.Mtt * dir.y * dir.y +
        mt.Mpp * dir.z * dir.z +
        2 * mt.Mrt * dir.x * dir.y +
        2 * mt.Mrp * dir.x * dir.z +
        2 * mt.Mtp * dir.y * dir.z;

      const r = 1 + scale * Math.abs(u);
      vertices.push(x * r, y * r, z * r);
    }
  }

  const positionAttr = new Float32Array(vertices);
  geometry.setAttribute("position", new THREE.BufferAttribute(positionAttr, 3));
  return geometry;
}

// Generate great circles for nodal planes
function generateNodalGreatCircles(strikeDeg, dipDeg, rakeDeg) {
  const strike = THREE.MathUtils.degToRad(strikeDeg);
  const dip = THREE.MathUtils.degToRad(dipDeg);

  const planes = [
    { strike, dip }, // fault plane
    {
      strike: (strike + Math.PI / 2) % (2 * Math.PI),
      dip: Math.acos(Math.cos(dip) * Math.cos(Math.PI / 2)),
    },
  ];

  return planes.map(({ strike, dip }) => {
    const points = [];
    for (let a = 0; a <= 360; a++) {
      const az = THREE.MathUtils.degToRad(a);
      const x = Math.cos(az);
      const y = Math.sin(az);
      const z = -Math.tan(dip) * (x * Math.sin(strike) - y * Math.cos(strike));
      const p = new THREE.Vector3(x, y, z).normalize();
      points.push(p.toArray());
    }
    return points;
  });
}
