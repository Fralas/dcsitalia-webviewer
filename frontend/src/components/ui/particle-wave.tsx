import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';

interface ParticleWaveProps {
  className?: string;
}

const ParticleWave: React.FC<ParticleWaveProps> = ({ className = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const canvas = document.createElement('canvas');
    canvas.className = `block ${className}`.trim();
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    canvas.style.margin = '0';
    canvas.style.overflow = 'hidden';
    container.appendChild(canvas);

    const winWidth = window.innerWidth;
    const winHeight = window.innerHeight;
    const aspectRatio = winWidth / Math.max(winHeight, 1);

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

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: false,
        alpha: false,
        stencil: false,
        depth: true,
      });
    } catch (error) {
      console.warn('Particle wave WebGL init failed:', error);
      canvas.remove();
      return undefined;
    }

    const gl = renderer.getContext();
    if (!gl) {
      renderer.dispose();
      canvas.remove();
      return undefined;
    }

    const isDark = document.documentElement.classList.contains('dark');
    renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
    renderer.setSize(winWidth, winHeight);
    renderer.setClearColor(isDark ? 0x000000 : 0xffffff);

    const camera = new THREE.PerspectiveCamera(75, aspectRatio, 0.01, 1000);
    const gridAngle = Math.PI / 4;
    camera.position.set(Math.sin(gridAngle) * 5, 6, Math.cos(gridAngle) * 5);

    const scene = new THREE.Scene();
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
        uTime: { value: 0 },
      },
    });

    const particles = new THREE.Points(particleGeometry, particleMaterial);
    particles.frustumCulled = false;
    particles.rotation.y = Math.PI / 4 + Math.PI / 6;
    scene.add(particles);
    camera.lookAt(scene.position);

    let animationId = 0;
    let lastTime = performance.now();

    const animate = (now: number) => {
      const delta = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      particleMaterial.uniforms.uTime.value -= delta * 3.0;
      renderer.render(scene, camera);
      animationId = requestAnimationFrame(animate);
    };
    animationId = requestAnimationFrame(animate);

    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
      renderer.setSize(width, height);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
      scene.remove(particles);
      particleGeometry.dispose();
      particleMaterial.dispose();
      renderer.dispose();
      canvas.remove();
    };
  }, [className]);

  return <div ref={containerRef} className={className} />;
};

export { ParticleWave };
