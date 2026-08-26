import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';

interface ParticleWaveProps {
  className?: string;
}

const ParticleWave: React.FC<ParticleWaveProps> = ({ className = '' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    particles: THREE.Points;
    particleMaterial: THREE.ShaderMaterial;
    animationId: number | null;
    mouse: THREE.Vector2;
    clock: THREE.Clock;
  } | null>(null);

  // Function to detect current theme
  const getCurrentTheme = () => {
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  };

  // Function to get background color based on theme
  const getBackgroundColor = (theme: string) => {
    return theme === 'dark'
      ? new THREE.Color(0x000000) // Black background for dark theme
      : new THREE.Color(0xffffff); // White background for light theme
  };

  // Function to get particle color based on theme
  const getParticleColor = (theme: string) => {
    return theme === 'dark'
      ? new THREE.Vector3(1.0, 1.0, 1.0) // White particles for dark theme
      : new THREE.Vector3(0.0, 0.0, 0.0); // Black particles for light theme
  };

    const particleVertex = `
    uniform float uTime;
    varying float vStripe;
    void main() {
      vec3 p = position;
      p.y += (sin(p.x + uTime) * 0.5) + (cos(p.y + uTime) * 0.1) * 2.0;
      p.x += (sin(p.y + uTime) * 0.5);
      float s = 1.0 + (sin(p.x + uTime) * 0.5) + (cos(p.y + uTime) * 0.1) * 2.0;
      vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
      gl_PointSize = s * 18.0 * (1.0 / -mvPosition.z);
      gl_Position = projectionMatrix * mvPosition;
      vStripe = position.x / 42.0;
    }
  `;

  const particleFragment = `
    varying float vStripe;
    void main() {
      float x = clamp(vStripe * 0.5 + 0.5, 0.0, 1.0);
      vec3 green = vec3(0.18, 1.0, 0.52);
      vec3 white = vec3(1.0, 1.0, 1.0);
      vec3 red = vec3(1.0, 0.22, 0.26);
      vec3 flagColor = x < 0.46 ? green : (x < 0.70 ? white : red);
      gl_FragColor = vec4(flagColor, 0.95);
    }
  `;

  const initScene = () => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const winWidth = window.innerWidth;
    const winHeight = window.innerHeight;
    const aspectRatio = winWidth / winHeight;

    // Camera
    const camera = new THREE.PerspectiveCamera(75, aspectRatio, 0.01, 1000);
    const gridAngle = Math.PI / 4;
    camera.position.set(Math.sin(gridAngle) * 5, 6, Math.cos(gridAngle) * 5);

    // Scene
    const scene = new THREE.Scene();

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
      stencil: false,
      depth: true,
    });
    renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
    renderer.setSize(winWidth, winHeight);
    renderer.setClearColor(getBackgroundColor(getCurrentTheme()));

    // Particles
    const gap = 0.42;
    const amountX = 200;
    const amountY = 200;
    const particleNum = amountX * amountY;
    const particlePositions = new Float32Array(particleNum * 3);

    let i = 0;
    for (let ix = 0; ix < amountX; ix++) {
      for (let iy = 0; iy < amountY; iy++) {
        particlePositions[i] = ix * gap - ((amountX * gap) / 2);
        particlePositions[i + 1] = 0;
        particlePositions[i + 2] = iy * gap - ((amountX * gap) / 2);
        i += 3;
      }
    }

    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));

    const particleMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      vertexShader: particleVertex,
      fragmentShader: particleFragment,
      uniforms: {
        uTime: { value: 0 }
      }
    });

    const particles = new THREE.Points(particleGeometry, particleMaterial);
    particles.frustumCulled = false;
    particles.rotation.y = Math.PI / 4 + Math.PI / 6;
    scene.add(particles);

    camera.lookAt(scene.position);

    const mouse = new THREE.Vector2(-10, -10);

    sceneRef.current = {
      scene,
      camera,
      renderer,
      particles,
      particleMaterial,
      animationId: null,
      mouse,
      clock: new THREE.Clock()
    };
  };

  const animate = () => {
    if (!sceneRef.current) return;

    const { camera, renderer, particleMaterial, clock } = sceneRef.current;
    const delta = Math.min(clock.getDelta(), 0.05);
    particleMaterial.uniforms.uTime.value -= delta * 3.0;
    renderer.render(sceneRef.current.scene, camera);
    sceneRef.current.animationId = requestAnimationFrame(animate);
  };

  const handleResize = () => {
    if (!sceneRef.current) return;

    const { camera, renderer } = sceneRef.current;
    const winWidth = window.innerWidth;
    const winHeight = window.innerHeight;

    camera.aspect = winWidth / winHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
    renderer.setSize(winWidth, winHeight);
  };

  useEffect(() => {
    initScene();
    animate();

    const handleResizeEvent = () => handleResize();

    window.addEventListener('resize', handleResizeEvent);

    return () => {
      if (sceneRef.current?.animationId) {
        cancelAnimationFrame(sceneRef.current.animationId);
      }
      window.removeEventListener('resize', handleResizeEvent);

      // Cleanup Three.js resources
      if (sceneRef.current) {
        const { scene, renderer, particles } = sceneRef.current;
        scene.remove(particles);
        if (particles.geometry) particles.geometry.dispose();
        if (particles.material) {
          if (Array.isArray(particles.material)) {
            particles.material.forEach(material => material.dispose());
          } else {
            particles.material.dispose();
          }
        }
        renderer.dispose();
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={`block ${className}`}
      style={{
        width: '100vw',
        height: '100vh',
        margin: 0,
        overflow: 'hidden'
      }}
    />
  );
};

export { ParticleWave };
