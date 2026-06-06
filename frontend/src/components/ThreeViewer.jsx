import React, { useState, useRef, useEffect, Suspense } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Center, PerspectiveCamera, useGLTF } from '@react-three/drei';
import { USDZExporter } from 'three/examples/jsm/exporters/USDZExporter.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

/* ─────────────────────────────────────────────
   AR Platform Detection
───────────────────────────────────────────── */
function detectARPlatform() {
  const ua = navigator.userAgent || navigator.vendor || window.opera || '';
  if (/iPad|iPhone|iPod/.test(ua) && !window.MSStream) return 'ios';
  if (/android/i.test(ua)) return 'android';
  return 'desktop';
}

/* ─────────────────────────────────────────────
   Triangle Geometry helper
───────────────────────────────────────────── */
function createTriangleGeometry(w, h) {
  const geom = new THREE.BufferGeometry();
  const vertices = new Float32Array([
    -w / 2, 0, 0,
     w / 2, 0, 0,
     0,     h, 0,
  ]);
  const uvs = new Float32Array([0, 0, 1, 0, 0.5, 1]);
  geom.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geom.computeVertexNormals();
  return geom;
}

function getLonaMaterialProps(colorHex, internalLight) {
  const isGlass = colorHex === '#e2e8f0';

  if (isGlass) {
    return {
      color: '#e2e8f0',
      transparent: true,
      opacity: 0.24,
      roughness: 0.05,
      metalness: 0.1,
      side: 2,
    };
  }

  return {
    color: colorHex,
    roughness: 0.65,
    side: 2,
  };
}

function getLateralMaterialProps(colorHex, internalLight) {
  const isGlass = colorHex === '#e2e8f0';

  if (isGlass) {
    return {
      color: '#e2e8f0',
      transparent: true,
      opacity: 0.22,
      roughness: 0.05,
      metalness: 0.1,
      side: 2,
    };
  }

  return {
    color: colorHex,
    transparent: true,
    opacity: 0.85,
    roughness: 0.65,
    side: 2,
  };
}

/* ─────────────────────────────────────────────
   Hanging Lamp inside Tent
───────────────────────────────────────────── */
function HangingLamp({ position, color = '#ffb347', intensity = 3.5, distance = 25 }) {
  return (
    <group position={position}>
      {/* Cable */}
      <mesh position={[0, -0.175, 0]}>
        <cylinderGeometry args={[0.008, 0.008, 0.35, 6]} />
        <meshStandardMaterial color="#0f172a" roughness={0.8} />
      </mesh>
      {/* Socket */}
      <mesh position={[0, -0.36, 0]}>
        <cylinderGeometry args={[0.03, 0.035, 0.05, 8]} />
        <meshStandardMaterial color="#475569" metalness={0.5} roughness={0.4} />
      </mesh>
      {/* Bulb */}
      <mesh position={[0, -0.4, 0]}>
        <sphereGeometry args={[0.045, 12, 12]} />
        <meshBasicMaterial color={color} />
      </mesh>
      {/* Point Light */}
      <pointLight
        position={[0, -0.4, 0]}
        color={color}
        intensity={intensity}
        distance={distance}
        decay={1.2}
        castShadow
        shadow-mapSize-width={512}
        shadow-mapSize-height={512}
        shadow-bias={-0.001}
      />
    </group>
  );
}

/* ─────────────────────────────────────────────
   Outdoor Spotlight
───────────────────────────────────────────── */
function OutdoorSpotlight({ position, targetObject, color = '#fffaed', intensity = 8 }) {
  const lightRef = useRef();

  useEffect(() => {
    if (lightRef.current && targetObject) {
      lightRef.current.target = targetObject;
    }
  }, [targetObject]);

  return (
    <group position={position}>
      {/* Spotlight support/base */}
      <mesh castShadow position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.12, 0.12, 0.1, 8]} />
        <meshStandardMaterial color="#334155" metalness={0.5} roughness={0.5} />
      </mesh>
      {/* Light head */}
      <mesh castShadow position={[0, 0.2, 0]} rotation={[Math.PI / 6, 0, 0]}>
        <cylinderGeometry args={[0.08, 0.06, 0.2, 8]} />
        <meshStandardMaterial color="#1e293b" metalness={0.6} roughness={0.3} />
      </mesh>
      {/* Glowing lens */}
      <mesh position={[0, 0.28, 0.02]}>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshBasicMaterial color={color} />
      </mesh>
      {/* SpotLight source */}
      <spotLight
        ref={lightRef}
        position={[0, 0.28, 0.02]}
        color={color}
        intensity={intensity}
        angle={Math.PI / 4}
        penumbra={0.5}
        distance={30}
        castShadow
        shadow-mapSize-width={512}
        shadow-mapSize-height={512}
        shadow-bias={-0.001}
      />
    </group>
  );
}

/* ─────────────────────────────────────────────
   Windowed Mesh (Cristal with Border)
───────────────────────────────────────────── */
function WindowedMesh({ args, color, internalLight, materialFn }) {
  const [x, y, z] = args;
  const isBlancoCristal = color === 'Cristal/Blanca';
  const frameColor = isBlancoCristal ? '#ffffff' : '#0f172a';
  const border = 0.2; // 20cm
  const thicknessIndex = [x, y, z].indexOf(Math.min(x, y, z));
  
  if (thicknessIndex === 0) {
     const t = x, h = y, w = z;
     const gH = Math.max(0, h - 2 * border);
     const gW = Math.max(0, w - 2 * border);
     return (
       <group>
         <mesh position={[0, h/2 - border/2, 0]} castShadow receiveShadow>
           <boxGeometry args={[t, border, w]} />
           <meshStandardMaterial {...materialFn(frameColor, internalLight)} />
         </mesh>
         <mesh position={[0, -h/2 + border/2, 0]} castShadow receiveShadow>
           <boxGeometry args={[t, border, w]} />
           <meshStandardMaterial {...materialFn(frameColor, internalLight)} />
         </mesh>
         <mesh position={[0, 0, -w/2 + border/2]} castShadow receiveShadow>
           <boxGeometry args={[t, gH, border]} />
           <meshStandardMaterial {...materialFn(frameColor, internalLight)} />
         </mesh>
         <mesh position={[0, 0, w/2 - border/2]} castShadow receiveShadow>
           <boxGeometry args={[t, gH, border]} />
           <meshStandardMaterial {...materialFn(frameColor, internalLight)} />
         </mesh>
         <mesh castShadow receiveShadow>
           <boxGeometry args={[t, gH, gW]} />
           <meshStandardMaterial {...materialFn('#e2e8f0', internalLight)} />
         </mesh>
       </group>
     );
  } else if (thicknessIndex === 1) {
     const w = x, t = y, l = z;
     const gW = Math.max(0, w - 2 * border);
     const gL = Math.max(0, l - 2 * border);
     return (
       <group>
         <mesh position={[w/2 - border/2, 0, 0]} castShadow receiveShadow>
           <boxGeometry args={[border, t, l]} />
           <meshStandardMaterial {...materialFn(frameColor, internalLight)} />
         </mesh>
         <mesh position={[-w/2 + border/2, 0, 0]} castShadow receiveShadow>
           <boxGeometry args={[border, t, l]} />
           <meshStandardMaterial {...materialFn(frameColor, internalLight)} />
         </mesh>
         <mesh position={[0, 0, l/2 - border/2]} castShadow receiveShadow>
           <boxGeometry args={[gW, t, border]} />
           <meshStandardMaterial {...materialFn(frameColor, internalLight)} />
         </mesh>
         <mesh position={[0, 0, -l/2 + border/2]} castShadow receiveShadow>
           <boxGeometry args={[gW, t, border]} />
           <meshStandardMaterial {...materialFn(frameColor, internalLight)} />
         </mesh>
         <mesh castShadow receiveShadow>
           <boxGeometry args={[gW, t, gL]} />
           <meshStandardMaterial {...materialFn('#e2e8f0', internalLight)} />
         </mesh>
       </group>
     );
  } else {
     const w = x, h = y, t = z;
     const gW = Math.max(0, w - 2 * border);
     const gH = Math.max(0, h - 2 * border);
     return (
       <group>
         <mesh position={[0, h/2 - border/2, 0]} castShadow receiveShadow>
           <boxGeometry args={[w, border, t]} />
           <meshStandardMaterial {...materialFn(frameColor, internalLight)} />
         </mesh>
         <mesh position={[0, -h/2 + border/2, 0]} castShadow receiveShadow>
           <boxGeometry args={[w, border, t]} />
           <meshStandardMaterial {...materialFn(frameColor, internalLight)} />
         </mesh>
         <mesh position={[-w/2 + border/2, 0, 0]} castShadow receiveShadow>
           <boxGeometry args={[border, gH, t]} />
           <meshStandardMaterial {...materialFn(frameColor, internalLight)} />
         </mesh>
         <mesh position={[w/2 - border/2, 0, 0]} castShadow receiveShadow>
           <boxGeometry args={[border, gH, t]} />
           <meshStandardMaterial {...materialFn(frameColor, internalLight)} />
         </mesh>
         <mesh castShadow receiveShadow>
           <boxGeometry args={[gW, gH, t]} />
           <meshStandardMaterial {...materialFn('#e2e8f0', internalLight)} />
         </mesh>
       </group>
     );
  }
}

function PanelMesh({ position, rotation, args, color, internalLight, materialFn }) {
  const isCristal = color === 'Cristal/Blanca' || color === 'Cristal/Negra';
  
  if (isCristal) {
    return (
      <group position={position} rotation={rotation || [0,0,0]}>
         <WindowedMesh args={args} color={color} internalLight={internalLight} materialFn={materialFn} />
      </group>
    );
  }
  
  return (
    <mesh position={position} rotation={rotation || [0,0,0]} castShadow receiveShadow>
      <boxGeometry args={args} />
      <meshStandardMaterial {...materialFn(color, internalLight)} />
    </mesh>
  );
}

/* ─────────────────────────────────────────────
   Gable Triangle Panel
───────────────────────────────────────────── */
function FrontTriangle({ position, width, height, color, internalLight, rotation = [0, 0, 0] }) {
  const isCristal = color === 'Cristal/Blanca' || color === 'Cristal/Negra';
  
  if (isCristal) {
    const frameColor = color === 'Cristal/Blanca' ? '#ffffff' : '#0f172a';
    const border = 0.2;
    const sideLength = Math.sqrt(Math.pow(width/2, 2) + Math.pow(height, 2));
    const sideAngle = Math.atan2(height, width/2);
    
    return (
      <group position={position} rotation={rotation}>
         <mesh position={[0, border/2, 0]} castShadow receiveShadow>
           <boxGeometry args={[width, border, 0.015]} />
           <meshStandardMaterial {...getLonaMaterialProps(frameColor, internalLight)} />
         </mesh>
         <mesh position={[-width/4, height/2, 0]} rotation={[0, 0, sideAngle]} castShadow receiveShadow>
           <boxGeometry args={[sideLength, border, 0.015]} />
           <meshStandardMaterial {...getLonaMaterialProps(frameColor, internalLight)} />
         </mesh>
         <mesh position={[width/4, height/2, 0]} rotation={[0, 0, -sideAngle]} castShadow receiveShadow>
           <boxGeometry args={[sideLength, border, 0.015]} />
           <meshStandardMaterial {...getLonaMaterialProps(frameColor, internalLight)} />
         </mesh>
         <mesh position={[0, 0, 0]} castShadow receiveShadow>
           <primitive object={createTriangleGeometry(width, height)} attach="geometry" />
           <meshStandardMaterial {...getLonaMaterialProps('#e2e8f0', internalLight)} />
         </mesh>
      </group>
    );
  }

  return (
    <group position={position} rotation={rotation}>
      <mesh castShadow receiveShadow>
        <primitive object={createTriangleGeometry(width, height)} attach="geometry" />
        <meshStandardMaterial {...getLonaMaterialProps(color, internalLight)} />
      </mesh>
    </group>
  );
}

/* ─────────────────────────────────────────────
   Tent-style Curtain Wall Panel
   Inspired by real event tent PVC sidewalls:
   flat, semi-transparent, full-height panels
───────────────────────────────────────────── */
const CURTAIN_COLOR_MAP = {
  'Blanco':   '#f8f5f0',
  'Negro':    '#1e293b',
  'Azul':     '#1e3a8a',
  'Rojo':     '#991b1b',
  'Verde':    '#14532d',
  'Gris':     '#94a3b8',
  'Amarillo': '#a16207',
  'Violeta':  '#6b21a8',
};

/* ── Tied event curtains at each structural column (photo-matching gather) ── */
function TiedCurtainDrape({ position, colorName, internalLight, legHeight }) {
  const hex = CURTAIN_COLOR_MAP[colorName] || '#f8f5f0';
  const isWhite = !colorName || colorName === 'Blanco';
  const opacity = isWhite ? 0.88 : 0.95;
  const halfH = legHeight / 2;

  return (
    <group position={position}>
      {/* Top gathered section */}
      <mesh position={[0, 3 * legHeight / 4, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.15, 0.06, halfH, 10, 1]} />
        <meshStandardMaterial
          color={hex}
          roughness={0.9}
          transparent
          opacity={opacity}
          side={2}
        />
      </mesh>

      {/* Cinch Tie Ring */}
      <mesh position={[0, legHeight / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.07, 0.07, 0.04, 10, 1]} />
        <meshStandardMaterial
          color={isWhite ? '#a16207' : '#ffffff'}
          roughness={0.3}
          metalness={isWhite ? 0.8 : 0.1}
        />
      </mesh>

      {/* Bottom flared section */}
      <mesh position={[0, legHeight / 4, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.06, 0.18, halfH, 10, 1]} />
        <meshStandardMaterial
          color={hex}
          roughness={0.9}
          transparent
          opacity={opacity}
          side={2}
        />
      </mesh>
    </group>
  );
}

/* ─────────────────────────────────────────────
   Pagoda 3D GLTF Model Component
 ───────────────────────────────────────────── */
function PagodaModel({ url, showCurtains, curtainColor, internalLight, environment, outdoorLights }) {
  const { scene } = useGLTF(url);
  const [spotTarget, setSpotTarget] = useState(null);

  useEffect(() => {
    scene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        const name = child.name.toLowerCase();
        if (name.includes('metal') || name.includes('estruct') || name.includes('perfil') || name.includes('alum')) {
          child.material = new THREE.MeshStandardMaterial({
            color: '#f1f5f9', metalness: 1.0, roughness: 0.22,
          });
        } else if (child.material) {
          child.material.emissive = new THREE.Color('#000000');
          child.material.emissiveIntensity = 0;
          child.material.roughness = 0.65;
          child.material.needsUpdate = true;
        }
      }
    });
  }, [scene]);

  return (
    <group>
      <primitive object={scene} scale={[1.2, 1.2, 1.2]} position={[0, -0.2, 0]} />
      
      {/* Target for spotlights */}
      <object3D ref={setSpotTarget} position={[0, 1.2, 0]} />

      {showCurtains && (
        <>
          <TiedCurtainDrape position={[1.05, 0, 1.05]} colorName={curtainColor} internalLight={internalLight} legHeight={1.9} />
          <TiedCurtainDrape position={[-1.05, 0, 1.05]} colorName={curtainColor} internalLight={internalLight} legHeight={1.9} />
          <TiedCurtainDrape position={[1.05, 0, -1.05]} colorName={curtainColor} internalLight={internalLight} legHeight={1.9} />
          <TiedCurtainDrape position={[-1.05, 0, -1.05]} colorName={curtainColor} internalLight={internalLight} legHeight={1.9} />
        </>
      )}

      {internalLight !== 'off' && (
        <HangingLamp
          position={[0, 2.6, 0]}
          color={internalLight === 'warm' ? '#ffb347' : '#dbeafe'}
          intensity={4.0}
          distance={15}
        />
      )}

      {/* ── Outdoor reflectores for Pagoda ── */}
      {environment === 'noche' && outdoorLights && (
        <>
          <OutdoorSpotlight position={[-3, 0, -3]} targetObject={spotTarget} />
          <OutdoorSpotlight position={[3, 0, -3]} targetObject={spotTarget} />
          <OutdoorSpotlight position={[-3, 0, 3]} targetObject={spotTarget} />
          <OutdoorSpotlight position={[3, 0, 3]} targetObject={spotTarget} />
        </>
      )}
    </group>
  );
}

/* ─────────────────────────────────────────────
   Main 3D Tent Structure
───────────────────────────────────────────── */
function TentStructure({
  structureRef, modules, legHeight, colors, showLaterales, width = 10,
  showCurtains, curtainColor, internalLight, environment, outdoorLights,
}) {
  const ridgeOffset = width * 0.18;
  const ridgeHeight = parseFloat(legHeight) + ridgeOffset;
  const halfWidth = width / 2;
  const roofAngle = Math.atan2(ridgeOffset, halfWidth);
  const rafterLength = Math.sqrt(halfWidth ** 2 + ridgeOffset ** 2);

  let currentZ = 0;
  const modulesWithOffsets = modules.map((m, index) => {
    const zStart = currentZ;
    currentZ += m.largo;
    return { ...m, zStart, zEnd: currentZ, color: colors.modules[index] || colors.modules[0] || '#ffffff' };
  });
  const totalLength = currentZ;
  const lateralColor = colors.lateral || '#ffffff';

  const [spotTarget, setSpotTarget] = useState(null);

  return (
    <group ref={structureRef} position={[-width / 2, 0, -totalLength / 2]}>
      {/* Target for spotlights */}
      <object3D ref={setSpotTarget} position={[width / 2, parseFloat(legHeight) / 2 || 1.5, totalLength / 2]} />

      {/* ── Portal frames ── */}
      {Array.from({ length: modules.length + 1 }).map((_, i) => {
        const z = i === 0 ? 0 : modulesWithOffsets[i - 1].zEnd;
        return (
          <group key={`frame-${i}`} position={[0, 0, z]}>
            <mesh position={[0, legHeight / 2, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[0.06, 0.06, legHeight]} />
              <meshStandardMaterial color="#cbd5e1" metalness={0.88} roughness={0.25} />
            </mesh>
            <mesh position={[width, legHeight / 2, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[0.06, 0.06, legHeight]} />
              <meshStandardMaterial color="#cbd5e1" metalness={0.88} roughness={0.25} />
            </mesh>
            <mesh position={[halfWidth / 2, legHeight + ridgeOffset / 2, 0]} rotation={[0, 0, roofAngle]} castShadow receiveShadow>
              <boxGeometry args={[rafterLength, 0.08, 0.08]} />
              <meshStandardMaterial color="#cbd5e1" metalness={0.88} roughness={0.25} />
            </mesh>
            <mesh position={[halfWidth + halfWidth / 2, legHeight + ridgeOffset / 2, 0]} rotation={[0, 0, -roofAngle]} castShadow receiveShadow>
              <boxGeometry args={[rafterLength, 0.08, 0.08]} />
              <meshStandardMaterial color="#cbd5e1" metalness={0.88} roughness={0.25} />
            </mesh>
            <mesh position={[width / 2, legHeight, 0]} castShadow receiveShadow>
              <boxGeometry args={[width, 0.04, 0.04]} />
              <meshStandardMaterial color="#cbd5e1" metalness={0.88} roughness={0.25} />
            </mesh>
          </group>
        );
      })}

      {/* ── Ridge purlin ── */}
      <mesh position={[width / 2, ridgeHeight, totalLength / 2]} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.04, 0.04, totalLength]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.88} roughness={0.25} />
      </mesh>

      {/* ── Eave purlins ── */}
      <mesh position={[0, legHeight, totalLength / 2]} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.04, 0.04, totalLength]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.88} roughness={0.25} />
      </mesh>
      <mesh position={[width, legHeight, totalLength / 2]} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.04, 0.04, totalLength]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.88} roughness={0.25} />
      </mesh>

      {/* ── Roof canvas panels & lateral walls ── */}
      {modulesWithOffsets.map((m, index) => {
        const modLength = m.largo;
        const zMid = m.zStart + modLength / 2;
        return (
          <group key={`mod-${index}`}>
            <PanelMesh position={[halfWidth / 2, legHeight + ridgeOffset / 2 + 0.02, zMid]} rotation={[0, 0, roofAngle]} args={[rafterLength, 0.015, modLength]} color={m.color} internalLight={internalLight} materialFn={getLonaMaterialProps} />
            <PanelMesh position={[halfWidth + halfWidth / 2, legHeight + ridgeOffset / 2 + 0.02, zMid]} rotation={[0, 0, -roofAngle]} args={[rafterLength, 0.015, modLength]} color={m.color} internalLight={internalLight} materialFn={getLonaMaterialProps} />
            {showLaterales && (
              <>
                <PanelMesh position={[0, legHeight / 2, zMid]} args={[0.005, legHeight, modLength]} color={colors.laterals?.[index] || colors.lateral || '#ffffff'} internalLight={internalLight} materialFn={getLateralMaterialProps} />
                <PanelMesh position={[width, legHeight / 2, zMid]} args={[0.005, legHeight, modLength]} color={colors.laterals?.[index] || colors.lateral || '#ffffff'} internalLight={internalLight} materialFn={getLateralMaterialProps} />
              </>
            )}
          </group>
        );
      })}

      {/* ── Gable triangles ── */}
      <FrontTriangle position={[width / 2, legHeight, 0]} width={width} height={ridgeOffset}
        color={colors.frontTriangle || '#ffffff'} internalLight={internalLight} />
      <FrontTriangle position={[width / 2, legHeight, totalLength]} width={width} height={ridgeOffset}
        color={colors.backTriangle || colors.frontTriangle || '#ffffff'} internalLight={internalLight} rotation={[0, Math.PI, 0]} />

      {/* ── Tapachata walls (front/back vertical panels) ── */}
      <PanelMesh position={[width / 4, legHeight / 2, 0.005]} args={[width / 2 - 0.04, legHeight, 0.01]} color={colors.frontTapachata || '#ffffff'} internalLight={internalLight} materialFn={getLonaMaterialProps} />
      <PanelMesh position={[3 * width / 4, legHeight / 2, 0.005]} args={[width / 2 - 0.04, legHeight, 0.01]} color={colors.frontTapachata || '#ffffff'} internalLight={internalLight} materialFn={getLonaMaterialProps} />
      <PanelMesh position={[width / 4, legHeight / 2, totalLength - 0.005]} args={[width / 2 - 0.04, legHeight, 0.01]} color={colors.backTapachata || '#ffffff'} internalLight={internalLight} materialFn={getLonaMaterialProps} />
      <PanelMesh position={[3 * width / 4, legHeight / 2, totalLength - 0.005]} args={[width / 2 - 0.04, legHeight, 0.01]} color={colors.backTapachata || '#ffffff'} internalLight={internalLight} materialFn={getLonaMaterialProps} />

      {/* ── Tied event curtains at each structural column (photo-matching gather) ── */}
      {showCurtains && Array.from({ length: modules.length + 1 }).map((_, i) => {
        const z = i === 0 ? 0 : modulesWithOffsets[i - 1].zEnd;
        return (
          <group key={`drapes-${i}`}>
            {/* Left Column Drape */}
            <TiedCurtainDrape
              position={[0.12, 0, z]}
              colorName={curtainColor}
              internalLight={internalLight}
              legHeight={legHeight}
            />
            {/* Right Column Drape */}
            <TiedCurtainDrape
              position={[width - 0.12, 0, z]}
              colorName={curtainColor}
              internalLight={internalLight}
              legHeight={legHeight}
            />
          </group>
        );
      })}

      {/* ── Internal Hanging Lamps ── */}
      {internalLight !== 'off' && modulesWithOffsets.map((m, index) => {
        const modLength = m.largo;
        const zMid = m.zStart + modLength / 2;
        const lampColor = internalLight === 'warm' ? '#ffb347' : '#dbeafe';

        return (
          <HangingLamp
            key={`lamp-${index}`}
            position={[width / 2, ridgeHeight, zMid]}
            color={lampColor}
            intensity={3.5}
            distance={Math.max(width, 15) * 1.5}
          />
        );
      })}

      {/* ── Outdoor Spotlights ── */}
      {environment === 'noche' && outdoorLights && (
        <>
          <OutdoorSpotlight position={[-3, 0, -2]} targetObject={spotTarget} />
          <OutdoorSpotlight position={[width + 3, 0, -2]} targetObject={spotTarget} />
          <OutdoorSpotlight position={[-3, 0, totalLength + 2]} targetObject={spotTarget} />
          <OutdoorSpotlight position={[width + 3, 0, totalLength + 2]} targetObject={spotTarget} />
        </>
      )}
    </group>
  );
}

/* ─────────────────────────────────────────────
   AR Panel — auto-detects iOS / Android
 ───────────────────────────────────────────── */
function ARPanel({ onExport, arLoading }) {
  const platform = detectARPlatform();
  const getButtonText = (p, ext) => {
    if (arLoading === 'ios' && p === 'ios') return 'Generando Quick Look (.usdz)...';
    if (arLoading === 'android' && p === 'android') return 'Preparando Scene Viewer (.glb)...';
    if (arLoading) return 'Procesando...';
    return p === 'ios' ? `Ver en AR — Quick Look (${ext})` : `Ver en AR — Scene Viewer (${ext})`;
  };
  const btnCls = (disabled) =>
    `block w-full rounded-xl text-center py-2.5 text-xs font-bold shadow transition-all-300 ${
      disabled
        ? 'bg-slate-300 text-slate-500 cursor-not-allowed opacity-75'
        : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 active:scale-98 cursor-pointer hover:shadow-lg'
    }`;

  if (platform === 'ios') return (
    <div className="space-y-2">
      <p className="text-[10px] text-emerald-600 font-black uppercase tracking-wider flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />📱 iOS detectado
      </p>
      <button type="button" disabled={!!arLoading} onClick={() => onExport('ios')} className={btnCls(!!arLoading)}>
        {getButtonText('ios', '.usdz')}
      </button>
    </div>
  );

  if (platform === 'android') return (
    <div className="space-y-2">
      <p className="text-[10px] text-emerald-600 font-black uppercase tracking-wider flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />🤖 Android detectado
      </p>
      <button type="button" disabled={!!arLoading} onClick={() => onExport('android')} className={btnCls(!!arLoading)}>
        {getButtonText('android', '.glb')}
      </button>
    </div>
  );

  return (
    <div className="space-y-2">
      <p className="text-[10px] text-slate-400 font-semibold">Usar desde celular para ver en AR</p>
      <div className="grid grid-cols-2 gap-2">
        {['ios', 'android'].map((p) => (
          <button key={p} type="button" disabled={!!arLoading} onClick={() => onExport(p)}
            className={`rounded-xl text-center py-2 text-xs font-bold shadow transition-all-300 ${
              arLoading ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-slate-800 text-white hover:bg-slate-900 active:scale-95 cursor-pointer'
            }`}>
            {arLoading === p ? 'Generando...' : p === 'ios' ? 'iOS (.usdz)' : 'Android (.glb)'}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Color Swatch helper
───────────────────────────────────────────── */
const COLORS = [
  { hex: '#ffffff', label: 'Blanca' },
  { hex: '#0f172a', label: 'Negra' },
  { hex: 'Cristal/Blanca', label: 'Cristal/Blanca' },
  { hex: 'Cristal/Negra', label: 'Cristal/Negra' },
];

function ColorSwatches({ selected, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {COLORS.map(({ hex, label }) => {
        const isCristal = hex === 'Cristal/Blanca' || hex === 'Cristal/Negra';
        const frameColor = hex === 'Cristal/Blanca' ? '#ffffff' : '#0f172a';
        
        return (
          <button
            key={hex}
            type="button"
            onClick={() => onChange(hex)}
            style={
              isCristal
                ? {
                    background: 'linear-gradient(135deg, rgba(226, 232, 240, 0.4) 0%, rgba(226, 232, 240, 0.9) 100%)',
                    border: `3px solid ${frameColor}`,
                  }
                : { background: hex, border: '2px solid transparent' }
            }
            className={`w-6 h-6 rounded-full transition-all-300 hover:scale-110 relative overflow-hidden box-border ${
              selected === hex ? 'ring-2 ring-blue-600 ring-offset-1' : 'ring-1 ring-slate-300 ring-offset-1'
            }`}
            title={label}
          >
            {isCristal && (
              <span className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/40 to-transparent transform rotate-45 pointer-events-none scale-150" />
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Canvas Background Layer (rendered below the 3D canvas)
   Uses the split park image: left=night, right=day
───────────────────────────────────────────── */


/* ─────────────────────────────────────────────
   Main Export
───────────────────────────────────────────── */
export default function ThreeViewer({
  modules,
  legHeight,
  colors,
  setColors,
  width = 10,
  modelName = '',
  telasCortinas = { si: false, color: 'Blanco' },
}) {
  const [showLaterales, setShowLaterales]   = useState(true);
  const [arLoading, setArLoading]           = useState(null);
  // 'neutral' | 'dia' | 'noche'
  const [environment, setEnvironment]       = useState('neutral');
  // 'off' | 'warm' | 'cool'
  const [internalLight, setInternalLight]   = useState('off');
  // Curtains — default from OT config, but user can toggle
  const [showCurtains, setShowCurtains]     = useState(telasCortinas?.si ?? false);

  // Outdoor reflectores & AR selection states
  const [outdoorLights, setOutdoorLights]       = useState(true);
  const [showArModal, setShowArModal]           = useState(false);
  const [arEnv, setArEnv]                       = useState('dia');
  const [arInternalLight, setArInternalLight]   = useState('off');
  const [arOutdoorLights, setArOutdoorLights]   = useState(true);
  const [arExportPlatform, setArExportPlatform] = useState(null);

  const structureRef = useRef();
  const controlsRef  = useRef();
  const containerRef = useRef();

  // Calibration States for Photo integration
  const [tentScale, setTentScale]     = useState(1.0);
  const [tentYOffset, setTentYOffset] = useState(0);
  const [tentZOffset, setTentZOffset] = useState(0);
  const [bgYOffset, setBgYOffset]     = useState(0);
  const [bgScale, setBgScale]         = useState(100);

  // Auto-detect pagoda — purely automatic, no manual toggle
  const isPagoda = modelName && (
    modelName.toLowerCase().includes('pagoda') ||
    modelName.toLowerCase().includes('pag')
  );

  // Curtain color from OT, fallback to Blanco
  const curtainColor = telasCortinas?.color || 'Blanco';

  // Reset internal and outdoor lights when leaving night mode
  useEffect(() => {
    if (environment !== 'noche') {
      setInternalLight('off');
      setOutdoorLights(true);
    }
  }, [environment]);

  // Sync showCurtains default with OT prop changes
  useEffect(() => {
    setShowCurtains(telasCortinas?.si ?? false);
  }, [telasCortinas?.si]);

  // ── Camera and Controls Dynamic Reset ──
  useEffect(() => {
    if (!controlsRef.current) return;
    const controls = controlsRef.current;
    const cam = controls.object;

    if (environment === 'neutral') {
      // Neutral/Studio Mode: High-angle view for inspection
      cam.position.set(12, 10, 15);
      controls.target.set(0, parseFloat(legHeight) / 2 || 1.5, 0);
    } else {
      // Park Mode (Día / Noche): Eye-level perspective matching the background photo
      cam.position.set(0, 3.2, 16);
      controls.target.set(0, parseFloat(legHeight) / 2 || 1.5, 0);
    }
    controls.update();
  }, [environment, legHeight]);

  // ── Lighting presets ──
  const ambientColor     = environment === 'noche' ? '#1e1b4b' : environment === 'dia' ? '#fffbeb' : '#ffffff';
  const ambientIntensity = environment === 'noche' ? 0.2  : environment === 'dia' ? 1.1  : 0.85;
  const sunColor         = environment === 'noche' ? '#60a5fa' : environment === 'dia' ? '#fef3c7' : '#ffffff';
  const sunIntensity     = environment === 'noche' ? 0.4  : environment === 'dia' ? 2.4  : 1.8;

  // ── AR Export ──
  const triggerExportPagoda = (platform) => {
    setArLoading(platform);
    if (platform === 'ios') {
      const link = document.createElement('a');
      link.href = '/4mtspagoda.usdz'; link.rel = 'ar'; link.download = '4mtspagoda.usdz';
      const img = document.createElement('img'); img.alt = 'AR Quick Look';
      img.style.width = '0px'; img.style.height = '0px';
      link.appendChild(img); document.body.appendChild(link); link.click();
      setTimeout(() => { document.body.removeChild(link); setArLoading(null); }, 1500);
    } else {
      const modelUrl = window.location.origin + '/4mtspagoda.glb';
      window.location.href = `intent://arvr.google.com/scene-viewer/1.0?file=${encodeURIComponent(modelUrl)}&mode=ar_only#Intent;scheme=https;package=com.google.ar.core;action=android.intent.action.VIEW;S.browser_fallback_url=${encodeURIComponent(window.location.origin)};end;`;
      setArLoading(null);
    }
  };

  const handleExportAR = (platform) => {
    if (isPagoda) {
      triggerExportPagoda(platform);
      return;
    }
    setArExportPlatform(platform);
    // Initialize AR options modal matching the current screen visualizer settings
    setArEnv(environment === 'noche' ? 'noche' : 'dia');
    setArInternalLight(internalLight);
    setArOutdoorLights(outdoorLights);
    setShowArModal(true);
  };

  const runExportAR = async (platform, options) => {
    const { env, internal, outdoor } = options;
    if (!structureRef.current) { alert('La estructura 3D no está inicializada.'); return; }
    
    setArLoading(platform);
    setShowArModal(false);

    // Save previous state to restore once export is complete
    const prevEnv = environment;
    const prevLight = internalLight;
    const prevOutdoor = outdoorLights;

    // Apply temporary AR settings to re-render the 3D scene before exporting
    setEnvironment(env);
    setInternalLight(internal);
    setOutdoorLights(outdoor);

    // Wait for the scene to re-render in 3D
    await new Promise((resolve) => setTimeout(resolve, 350));

    try {
      if (platform === 'ios') {
        new USDZExporter().parse(
          structureRef.current,
          (buf) => {
            const url = URL.createObjectURL(new Blob([buf], { type: 'model/vnd.usdz+zip' }));
            const link = document.createElement('a'); link.href = url; link.download = 'carpa-dangiola.usdz'; link.rel = 'ar';
            const img = document.createElement('img'); img.alt = 'AR'; img.style.width = '0'; link.appendChild(img);
            document.body.appendChild(link); link.click();
            setTimeout(() => {
              document.body.removeChild(link);
              URL.revokeObjectURL(url);
              // Restore state
              setEnvironment(prevEnv);
              setInternalLight(prevLight);
              setOutdoorLights(prevOutdoor);
              setArLoading(null);
            }, 3000);
          },
          (e) => {
            alert('Error USDZ: ' + e.message);
            setEnvironment(prevEnv);
            setInternalLight(prevLight);
            setOutdoorLights(prevOutdoor);
            setArLoading(null);
          },
          { quickLookCompatible: true }
        );
      } else {
        new GLTFExporter().parse(
          structureRef.current,
          async (buf) => {
            try {
              const res = await fetch('/api/ar/upload-glb', {
                method: 'POST',
                headers: { 'Content-Type': 'application/octet-stream' },
                body: new Blob([buf], { type: 'application/octet-stream' })
              });
              if (!res.ok) throw new Error('Servidor: ' + res.status);
              const { url } = await res.json();
              window.location.href = `intent://arvr.google.com/scene-viewer/1.0?file=${encodeURIComponent(url)}&mode=ar_only#Intent;scheme=https;package=com.google.ar.core;action=android.intent.action.VIEW;S.browser_fallback_url=${encodeURIComponent(window.location.href)};end;`;
            } catch (e) {
              alert('Error GLB: ' + e.message);
            } finally {
              setEnvironment(prevEnv);
              setInternalLight(prevLight);
              setOutdoorLights(prevOutdoor);
              setArLoading(null);
            }
          },
          (e) => {
            alert('Error exportando GLB: ' + e.message);
            setEnvironment(prevEnv);
            setInternalLight(prevLight);
            setOutdoorLights(prevOutdoor);
            setArLoading(null);
          },
          { binary: true }
        );
      }
    } catch (e) {
      alert('Error cargando exportador AR: ' + e.message);
      setEnvironment(prevEnv);
      setInternalLight(prevLight);
      setOutdoorLights(prevOutdoor);
      setArLoading(null);
    }
  };

  const handleModuleColor         = (i, c) => { const n = [...colors.modules]; n[i] = c; setColors({ ...colors, modules: n }); };
  const handleFrontColor          = (c) => setColors({ ...colors, frontTriangle: c });
  const handleBackColor           = (c) => setColors({ ...colors, backTriangle: c });
  const handleFrontTapachataColor = (c) => setColors({ ...colors, frontTapachata: c });
  const handleBackTapachataColor  = (c) => setColors({ ...colors, backTapachata: c });
  const handleLateralColor        = (c) => setColors({ ...colors, lateral: c });
  const handleLateralModuleColor  = (i, c) => { 
    const lats = [...(colors.laterals || [])];
    lats[i] = c;
    setColors({ ...colors, laterals: lats });
  };

  const handleZoom = (f) => {
    if (!controlsRef.current) return;
    const { object: cam, target } = controlsRef.current;
    cam.position.copy(target).add(new THREE.Vector3().subVectors(cam.position, target).multiplyScalar(f));
    controlsRef.current.update();
  };

  // Prevent page scroll inside canvas
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const stop = (e) => e.preventDefault();
    el.addEventListener('wheel',     stop, { capture: true, passive: false });
    el.addEventListener('touchmove', stop, { capture: true, passive: false });
    return () => {
      el.removeEventListener('wheel',     stop, { capture: true });
      el.removeEventListener('touchmove', stop, { capture: true });
    };
  }, []);

  const isParkMode = environment !== 'neutral';

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full">

      {/* ── 3D Canvas Container ── */}
      <div
        ref={containerRef}
        className="flex-1 min-h-[450px] rounded-3xl overflow-hidden relative shadow-inner border border-slate-200 transition-all duration-500"
        style={{
          backgroundColor: '#f8fafc',
          backgroundImage: isParkMode
            ? `url(${environment === 'dia' ? '/diurno.jpg' : '/nocturno.jpg'})`
            : 'none',
          backgroundSize: isParkMode ? `${bgScale}%` : 'cover',
          backgroundPosition: isParkMode ? `center calc(50% + ${bgYOffset}px)` : 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        {/* 3D Canvas — always alpha:true so background shows through */}
        <div className="absolute inset-0 z-10">
          <Canvas
            style={{ width: '100%', height: '100%', background: 'transparent' }}
            gl={{ alpha: true, antialias: true }}
            onCreated={({ gl }) => {
              gl.setClearColor(0x000000, 0);
            }}
            shadows
          >
            <PerspectiveCamera makeDefault position={[12, 10, 15]} fov={45} />
            <ambientLight color={ambientColor} intensity={ambientIntensity} />
            <directionalLight
              color={sunColor}
              position={environment === 'noche' ? [-10, 8, 10] : [12, 18, 12]}
              intensity={sunIntensity}
              castShadow
              shadow-mapSize-width={2048}
              shadow-mapSize-height={2048}
              shadow-bias={-0.0005}
              shadow-camera-far={50}
              shadow-camera-left={-25}
              shadow-camera-right={25}
              shadow-camera-top={25}
              shadow-camera-bottom={-25}
            />
            <directionalLight position={[-10, 10, -10]} intensity={0.35} />

            {/* Shadow-receiving ground plane — invisible, only shows cast shadows over background or grid */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, tentYOffset - 0.01, 0]} receiveShadow>
              <planeGeometry args={[120, 120]} />
              <shadowMaterial opacity={environment === 'noche' ? 0.6 : environment === 'dia' ? 0.4 : 0.25} />
            </mesh>

            <group position={[0, tentYOffset, tentZOffset]} scale={[tentScale, tentScale, tentScale]}>
              <Center disableY>
                {isPagoda ? (
                  <Suspense fallback={null}>
                    <PagodaModel
                      url="/4mtspagoda.glb"
                      showCurtains={showCurtains}
                      curtainColor={curtainColor}
                      internalLight={internalLight}
                      environment={environment}
                      outdoorLights={outdoorLights}
                    />
                  </Suspense>
                ) : (
                  <TentStructure
                    structureRef={structureRef}
                    modules={modules}
                    legHeight={legHeight}
                    colors={colors}
                    showLaterales={showLaterales}
                    width={width}
                    showCurtains={showCurtains}
                    curtainColor={curtainColor}
                    internalLight={internalLight}
                    environment={environment}
                    outdoorLights={outdoorLights}
                  />
                )}
              </Center>
            </group>

            <OrbitControls
              ref={controlsRef}
              enablePan
              enableZoom
              minDistance={5}
              maxDistance={40}
              maxPolarAngle={Math.PI / 2 - 0.05}
            />

            {environment === 'neutral' && (
              <Grid
                renderOrder={-1}
                position={[0, -0.01, 0]}
                args={[30, 30]}
                cellSize={1}
                cellThickness={0.5}
                cellColor="#cbd5e1"
                sectionSize={5}
                sectionThickness={1}
                sectionColor="#94a3b8"
                fadeDistance={30}
              />
            )}
          </Canvas>
        </div>

        {/* ── Overlay Controls (bottom-left) ── */}
        <div className="absolute bottom-4 left-4 z-20 flex flex-wrap gap-2">

          {/* Laterales Toggle */}
          <button
            type="button"
            onClick={() => setShowLaterales(!showLaterales)}
            className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider shadow-md hover:shadow-lg active:scale-[0.97] transition-all duration-300 cursor-pointer ${
              showLaterales ? 'bg-blue-900 text-white' : 'bg-white/90 border border-slate-200 text-slate-600 hover:bg-white'
            }`}
          >
            {showLaterales ? '✓ Laterales' : '✗ Sin Laterales'}
          </button>

          {/* Cortinas Toggle */}
          <button
            type="button"
            onClick={() => setShowCurtains(!showCurtains)}
            className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider shadow-md hover:shadow-lg active:scale-[0.97] transition-all duration-300 cursor-pointer ${
              showCurtains ? 'bg-rose-700 text-white' : 'bg-white/90 border border-slate-200 text-slate-600 hover:bg-white'
            }`}
          >
            {showCurtains ? '🪟 Con Cortinas' : '🪟 Sin Cortinas'}
          </button>

          {/* Environment: 3-state cycle */}
          <button
            type="button"
            onClick={() => setEnvironment(e => e === 'neutral' ? 'dia' : e === 'dia' ? 'noche' : 'neutral')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider shadow-md hover:shadow-lg active:scale-[0.97] transition-all duration-300 cursor-pointer ${
              environment === 'noche'
                ? 'bg-indigo-900 text-white'
                : environment === 'dia'
                ? 'bg-amber-500 text-white'
                : 'bg-white/90 border border-slate-200 text-slate-600 hover:bg-white'
            }`}
          >
            {environment === 'noche' ? '🌙 Modo Noche' : environment === 'dia' ? '☀️ Modo Día' : '🏢 Modo Estudio'}
          </button>

          {/* Reflectores Toggle — only in night mode */}
          {environment === 'noche' && (
            <button
              type="button"
              onClick={() => setOutdoorLights(!outdoorLights)}
              className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider shadow-md hover:shadow-lg active:scale-[0.97] transition-all duration-300 cursor-pointer ${
                outdoorLights
                  ? 'bg-emerald-600 text-white border border-emerald-700'
                  : 'bg-white/90 border border-slate-200 text-slate-550 hover:bg-white'
              }`}
            >
              {outdoorLights ? '🔦 Reflectores ON' : '🔦 Reflectores OFF'}
            </button>
          )}

          {/* Internal Light Toggle — only in night mode */}
          {environment === 'noche' && (
            <button
              type="button"
              onClick={() => setInternalLight(l => l === 'off' ? 'warm' : l === 'warm' ? 'cool' : 'off')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider shadow-md hover:shadow-lg active:scale-[0.97] transition-all duration-300 cursor-pointer ${
                internalLight === 'warm' ? 'bg-amber-600 text-white'
                : internalLight === 'cool' ? 'bg-cyan-600 text-white'
                : 'bg-white/90 border border-slate-200 text-slate-550 hover:bg-white'
              }`}
            >
              {internalLight === 'warm' ? '🔥 Luz Cálida' : internalLight === 'cool' ? '❄️ Luz Fría' : '💡 Sin Luz Interna'}
            </button>
          )}

          {/* Pagoda indicator (read-only) */}
          {isPagoda && (
            <span className="px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider bg-purple-800 text-white shadow-md">
              🎪 Pagoda
            </span>
          )}
        </div>

        {/* ── Floating Zoom Controls ── */}
        <div className="absolute bottom-4 right-4 z-20 flex flex-col gap-1.5">
          <button type="button" onClick={() => handleZoom(0.85)}
            className="w-8 h-8 rounded-lg bg-white/90 border border-slate-200 text-slate-700 shadow-md hover:bg-white flex items-center justify-center font-bold text-base transition-all-300 cursor-pointer" title="Acercar (+)">
            ＋
          </button>
          <button type="button" onClick={() => handleZoom(1.15)}
            className="w-8 h-8 rounded-lg bg-white/90 border border-slate-200 text-slate-700 shadow-md hover:bg-white flex items-center justify-center font-bold text-base transition-all-300 cursor-pointer" title="Alejar (-)">
            －
          </button>
        </div>
      </div>

      {/* ── Side Panel ── */}
      <div className="w-full lg:w-[280px] lg:h-full lg:overflow-y-auto space-y-4 pr-1.5 scrollbar-thin">

        {isPagoda && (
          <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 shadow-sm text-xs text-purple-900 font-semibold space-y-1.5 animate-fade-in">
            <span className="font-extrabold uppercase text-[10px] tracking-wider text-purple-800 block">📢 Diseño Pagoda Activo</span>
            <p className="leading-relaxed text-purple-950/80">
              Modelo Pagoda 4M cargado desde la OT. El selector de colores aplica para estructura estándar.
            </p>
          </div>
        )}

        {showCurtains && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 shadow-sm text-xs text-rose-900 font-semibold space-y-1 animate-fade-in">
            <span className="font-extrabold uppercase text-[10px] tracking-wider text-rose-700 block">🪟 Cortinas Activas</span>
            <p className="leading-relaxed text-rose-800/80">
              Color: <strong>{curtainColor}</strong>
              {telasCortinas?.si ? ' — configurado en la OT.' : ' — activado manualmente.'}
            </p>
          </div>
        )}

        {/* 📐 Calibración de Perspectiva (Fotorrealismo) */}
        {isParkMode && (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4 animate-fade-in">
            <h3 className="text-xs uppercase tracking-widest font-black text-slate-500 flex items-center gap-1.5">
              📐 Calibración de Parque
            </h3>
            
            {/* Tent Scale */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-bold text-slate-700">
                <span>Escala de Carpa:</span>
                <span className="text-blue-600">{(tentScale * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0.3"
                max="1.7"
                step="0.05"
                value={tentScale}
                onChange={(e) => setTentScale(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>

            {/* Tent Depth (Z-axis) */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-bold text-slate-700">
                <span>Profundidad (Atrás/Adelante):</span>
                <span className="text-blue-600">{tentZOffset > 0 ? `+${tentZOffset.toFixed(1)}m` : `${tentZOffset.toFixed(1)}m`}</span>
              </div>
              <input
                type="range"
                min="-15"
                max="15"
                step="0.5"
                value={tentZOffset}
                onChange={(e) => setTentZOffset(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>

            {/* Tent Height (Y-axis) */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-bold text-slate-700">
                <span>Altura (Arriba/Abajo):</span>
                <span className="text-blue-600">{tentYOffset > 0 ? `+${tentYOffset.toFixed(1)}m` : `${tentYOffset.toFixed(1)}m`}</span>
              </div>
              <input
                type="range"
                min="-5"
                max="5"
                step="0.1"
                value={tentYOffset}
                onChange={(e) => setTentYOffset(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>

            {/* Background Position (Y-axis) */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-bold text-slate-700">
                <span>Posición de Foto (↕):</span>
                <span className="text-blue-600">{bgYOffset > 0 ? `+${bgYOffset}px` : `${bgYOffset}px`}</span>
              </div>
              <input
                type="range"
                min="-250"
                max="250"
                step="5"
                value={bgYOffset}
                onChange={(e) => setBgYOffset(parseInt(e.target.value))}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>

            {/* Background Scale (Zoom) */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-bold text-slate-700">
                <span>Zoom de Foto:</span>
                <span className="text-blue-600">{bgScale}%</span>
              </div>
              <input
                type="range"
                min="100"
                max="250"
                step="5"
                value={bgScale}
                onChange={(e) => setBgScale(parseInt(e.target.value))}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>

            {/* Reset Button */}
            <button
              type="button"
              onClick={() => {
                setTentScale(1.0);
                setTentYOffset(0);
                setTentZOffset(0);
                setBgYOffset(0);
                setBgScale(100);
              }}
              className="w-full py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-all active:scale-[0.97]"
            >
              🔄 Restablecer Alineación
            </button>
          </div>
        )}

        {!isPagoda ? (
          <>
            {/* Lonas del Techo */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 shadow-sm">
              <h3 className="text-xs uppercase tracking-widest font-black text-slate-400 mb-3">Lonas del Techo</h3>
              <div className="space-y-3 pr-1">
                {modules.map((m, idx) => (
                  <div key={idx} className="p-2 bg-white rounded-xl border border-slate-100 shadow-sm space-y-1.5">
                    <span className="text-xs font-bold text-slate-700">Módulo {idx + 1} ({m.largo}m)</span>
                    <ColorSwatches selected={colors.modules[idx] || '#ffffff'} onChange={(c) => handleModuleColor(idx, c)} />
                  </div>
                ))}
              </div>
            </div>

            {/* Triángulos de Piñón */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
              <h3 className="text-xs uppercase tracking-widest font-black text-slate-400">Triángulos de Piñón</h3>
              <div className="p-2 bg-white rounded-xl border border-slate-100 shadow-sm space-y-1.5">
                <span className="text-xs font-bold text-slate-700">Triángulo Frontal</span>
                <ColorSwatches selected={colors.frontTriangle || '#ffffff'} onChange={handleFrontColor} />
              </div>
              <div className="p-2 bg-white rounded-xl border border-slate-100 shadow-sm space-y-1.5">
                <span className="text-xs font-bold text-slate-700">Triángulo Trasero</span>
                <ColorSwatches selected={colors.backTriangle || colors.frontTriangle || '#ffffff'} onChange={handleBackColor} />
              </div>
            </div>

            {/* Lonas de Tapachata */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
              <h3 className="text-xs uppercase tracking-widest font-black text-slate-400">Lonas de Tapachata</h3>
              <div className="p-2 bg-white rounded-xl border border-slate-100 shadow-sm space-y-1.5">
                <span className="text-xs font-bold text-slate-700">Puertas (Frente)</span>
                <ColorSwatches selected={colors.frontTapachata || '#ffffff'} onChange={handleFrontTapachataColor} />
              </div>
              <div className="p-2 bg-white rounded-xl border border-slate-100 shadow-sm space-y-1.5">
                <span className="text-xs font-bold text-slate-700">Fondo (Dorso)</span>
                <ColorSwatches selected={colors.backTapachata || '#ffffff'} onChange={handleBackTapachataColor} />
              </div>
            </div>

            {/* Laterales */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 shadow-sm">
              <h3 className="text-xs uppercase tracking-widest font-black text-slate-400 mb-3">Color Laterales</h3>
              <div className="space-y-3 pr-1">
                {modules.map((m, idx) => (
                  <div key={idx} className="p-2 bg-white rounded-xl border border-slate-100 shadow-sm space-y-1.5">
                    <span className="text-xs font-bold text-slate-700">Módulo {idx + 1} ({m.largo}m)</span>
                    <ColorSwatches selected={colors.laterals?.[idx] || colors.lateral || '#ffffff'} onChange={(c) => handleLateralModuleColor(idx, c)} />
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : null}

        {/* Ambiente e Iluminación */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4">
          <h3 className="text-xs uppercase tracking-widest font-black text-slate-400">Ambiente e Iluminación</h3>
          
          <div className="space-y-1.5">
            <span className="text-[10px] uppercase tracking-widest font-black text-slate-400 block">Entorno Visual</span>
            <div className="grid grid-cols-3 gap-1">
              {[
                { id: 'neutral', label: 'Estudio', icon: '🏢' },
                { id: 'dia', label: 'Día', icon: '☀️' },
                { id: 'noche', label: 'Noche', icon: '🌙' }
              ].map((env) => (
                <button
                  key={env.id}
                  type="button"
                  onClick={() => setEnvironment(env.id)}
                  className={`py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all duration-200 active:scale-95 cursor-pointer ${
                    environment === env.id
                      ? 'bg-slate-800 text-white shadow-sm'
                      : 'bg-white border border-slate-200 text-slate-650 hover:bg-slate-100'
                  }`}
                >
                  {env.icon} {env.label}
                </button>
              ))}
            </div>
          </div>

          {environment === 'noche' && (
            <div className="space-y-3 pt-3 border-t border-slate-200/60 animate-fade-in">
              <div className="space-y-1.5">
                <span className="text-[10px] uppercase tracking-widest font-black text-slate-400 block">Iluminación Exterior</span>
                <button
                  type="button"
                  onClick={() => setOutdoorLights(!outdoorLights)}
                  className={`w-full py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 ${
                    outdoorLights
                      ? 'bg-emerald-600 text-white shadow animate-fade-in'
                      : 'bg-white border border-slate-200 text-slate-650 hover:bg-slate-100'
                  }`}
                >
                  🔦 {outdoorLights ? 'Reflectores Activos' : 'Reflectores Apagados'}
                </button>
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] uppercase tracking-widest font-black text-slate-400 block">Luz Interior</span>
                <div className="grid grid-cols-3 gap-1">
                  {[
                    { id: 'off', label: 'Apagada', icon: '❌' },
                    { id: 'warm', label: 'Cálida', icon: '🔥' },
                    { id: 'cool', label: 'Fría', icon: '❄️' }
                  ].map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setInternalLight(mode.id)}
                      className={`py-2 rounded-lg text-[10px] font-bold uppercase transition-all duration-200 active:scale-95 cursor-pointer ${
                        internalLight === mode.id
                          ? mode.id === 'warm'
                            ? 'bg-amber-600 text-white shadow-sm'
                            : mode.id === 'cool'
                            ? 'bg-cyan-600 text-white shadow-sm'
                            : 'bg-slate-700 text-white shadow-sm'
                          : 'bg-white border border-slate-200 text-slate-650 hover:bg-slate-100'
                      }`}
                    >
                      {mode.icon} {mode.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Realidad Aumentada */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 shadow-sm space-y-2">
          <h3 className="text-xs uppercase tracking-widest font-black text-slate-400">Realidad Aumentada (AR)</h3>
          <ARPanel onExport={handleExportAR} arLoading={arLoading} />
        </div>
      </div>

      {/* ── AR Settings Modal ── */}
      {showArModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-[2.5rem] w-full max-w-md p-6 overflow-y-auto shadow-2xl relative space-y-5 animate-scale-up">
            
            {/* Close Button */}
            <button
              onClick={() => setShowArModal(false)}
              className="absolute right-6 top-6 p-1.5 rounded-full hover:bg-slate-100 transition-all duration-200"
            >
              <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Header */}
            <div className="space-y-1.5 pr-8">
              <h3 className="text-sm font-black uppercase text-blue-900 tracking-wider Poppins flex items-center gap-1.5">
                📱 Configurar Proyección AR
              </h3>
              <p className="text-[11px] text-slate-500 font-semibold leading-relaxed">
                Personaliza el entorno y la iluminación de la carpa antes de abrir la cámara en tu celular.
              </p>
            </div>

            {/* Options */}
            <div className="space-y-4">
              
              {/* Ambiente */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-widest font-black text-slate-400 block">Ambiente del Espacio</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setArEnv('dia')}
                    className={`py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-1.5 ${
                      arEnv === 'dia'
                        ? 'bg-blue-900 text-white shadow-md'
                        : 'bg-slate-50 border border-slate-200 text-slate-650 hover:bg-slate-100'
                    }`}
                  >
                    ☀️ Día (Luz Natural)
                  </button>
                  <button
                    type="button"
                    onClick={() => setArEnv('noche')}
                    className={`py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-1.5 ${
                      arEnv === 'noche'
                        ? 'bg-indigo-950 text-white shadow-md'
                        : 'bg-slate-50 border border-slate-200 text-slate-650 hover:bg-slate-100'
                    }`}
                  >
                    🌙 Noche (Espacio Oscuro)
                  </button>
                </div>
              </div>

              {/* Night configurations */}
              {arEnv === 'noche' && (
                <div className="space-y-4 pt-3 border-t border-slate-100 animate-fade-in">
                  
                  {/* Reflectores Exteriores */}
                  <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                    <div className="space-y-0.5">
                      <span className="text-xs font-extrabold text-slate-800 uppercase block">Reflectores de Jardín</span>
                      <span className="text-[9px] text-slate-450 font-semibold leading-none">Simula focos en el pasto hacia la carpa</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setArOutdoorLights(!arOutdoorLights)}
                      className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-200 ${
                        arOutdoorLights
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'bg-white border border-slate-250 text-slate-500'
                      }`}
                    >
                      {arOutdoorLights ? 'Encendidos ✓' : 'Apagados ✗'}
                    </button>
                  </div>

                  {/* Luz Interior */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase tracking-widest font-black text-slate-400 block">Luces Colgantes Interiores</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'off', label: 'Sin Luz', icon: '❌' },
                        { id: 'warm', label: 'Cálida', icon: '🔥' },
                        { id: 'cool', label: 'Fría', icon: '❄️' }
                      ].map((mode) => (
                        <button
                          key={mode.id}
                          type="button"
                          onClick={() => setArInternalLight(mode.id)}
                          className={`py-2.5 rounded-xl text-[10px] font-bold uppercase transition-all duration-200 ${
                            arInternalLight === mode.id
                              ? mode.id === 'warm'
                                ? 'bg-amber-600 text-white shadow-sm'
                                : mode.id === 'cool'
                                ? 'bg-cyan-600 text-white shadow-sm'
                                : 'bg-slate-700 text-white shadow-sm'
                              : 'bg-slate-50 border border-slate-200 text-slate-650 hover:bg-slate-100'
                          }`}
                        >
                          {mode.icon} {mode.label}
                        </button>
                      ))}
                    </div>
                  </div>

                </div>
              )}

            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowArModal(false)}
                className="flex-1 py-3 text-xs font-black uppercase tracking-widest bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl border border-slate-200 transition-all duration-200 active:scale-98"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => runExportAR(arExportPlatform, { env: arEnv, internal: arInternalLight, outdoor: arOutdoorLights })}
                className="flex-1 py-3 text-xs font-black uppercase tracking-widest bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl shadow-md transition-all duration-200 active:scale-98"
              >
                Ver en AR 🚀
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
