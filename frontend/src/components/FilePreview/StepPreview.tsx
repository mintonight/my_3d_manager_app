import { useEffect, useRef, useState } from 'react';
import { Alert, Spin } from 'antd';
import type { PreviewProps } from './index';

// Vite handles the .wasm as a URL asset so the loader can fetch it at runtime
import wasmUrl from 'occt-import-js/dist/occt-import-js.wasm?url';

// occt-import-js mesh shape
interface OcctMesh {
  name?: string;
  color?: [number, number, number];
  attributes: {
    position: { array: number[] | Float32Array };
    normal?: { array: number[] | Float32Array };
  };
  index?: { array: number[] | Uint32Array };
}
interface OcctResult {
  success: boolean;
  meshes: OcctMesh[];
}

const COLORS = [0x4a90e2, 0xe27d60, 0x7d8c54, 0xb86bff, 0xf4a261, 0x2a9d8f];

export default function StepPreview({ blob }: PreviewProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState('');

  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | null = null;

    (async () => {
      try {
        const THREE = await import('three');
        const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');
        const occtMod = await import('occt-import-js');
        const occtImport = (occtMod.default ?? occtMod) as (
          opts?: { locateFile?: (f: string) => string }
        ) => Promise<{ ReadStepFile: (buf: Uint8Array, opts: unknown) => OcctResult }>;

        const occt = await occtImport({ locateFile: () => wasmUrl });
        if (cancelled) return;

        const container = mountRef.current;
        if (!container) return;

        const buf = new Uint8Array(await blob.arrayBuffer());
        const result = occt.ReadStepFile(buf, null);
        if (!result.success) throw new Error('STEP 解析失败：occt 返回 success=false');
        if (!result.meshes || result.meshes.length === 0)
          throw new Error('STEP 文件中未找到可渲染的几何体');

        const width = container.clientWidth;
        const height = Math.max(container.clientHeight, 500);

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xf0f2f5);
        const camera = new THREE.PerspectiveCamera(45, width / height, 0.01, 100000);
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(width, height);
        container.innerHTML = '';
        container.appendChild(renderer.domElement);

        scene.add(new THREE.AmbientLight(0xffffff, 0.6));
        const dir1 = new THREE.DirectionalLight(0xffffff, 0.8);
        dir1.position.set(1, 1, 1);
        scene.add(dir1);
        const dir2 = new THREE.DirectionalLight(0xffffff, 0.4);
        dir2.position.set(-1, -1, -1);
        scene.add(dir2);

        const group = new THREE.Group();
        let totalTri = 0;

        result.meshes.forEach((m, i) => {
          const geom = new THREE.BufferGeometry();
          const positions = m.attributes.position.array;
          geom.setAttribute(
            'position',
            new THREE.Float32BufferAttribute(Array.from(positions), 3),
          );
          if (m.attributes.normal) {
            geom.setAttribute(
              'normal',
              new THREE.Float32BufferAttribute(Array.from(m.attributes.normal.array), 3),
            );
          } else {
            geom.computeVertexNormals();
          }
          if (m.index) {
            geom.setIndex(Array.from(m.index.array));
          }
          const colorHex = m.color
            ? new THREE.Color(m.color[0], m.color[1], m.color[2]).getHex()
            : COLORS[i % COLORS.length];
          const mat = new THREE.MeshPhongMaterial({
            color: colorHex,
            specular: 0x222222,
            shininess: 40,
            side: THREE.DoubleSide,
          });
          const mesh = new THREE.Mesh(geom, mat);
          group.add(mesh);
          const triCount = m.index
            ? m.index.array.length / 3
            : positions.length / 9;
          totalTri += triCount;
        });

        const box = new THREE.Box3().setFromObject(group);
        const center = box.getCenter(new THREE.Vector3());
        group.position.sub(center);
        scene.add(group);

        const size = box.getSize(new THREE.Vector3()).length();
        const camDist = size * 1.8;
        camera.position.set(camDist, camDist * 0.75, camDist);
        camera.lookAt(0, 0, 0);

        const axis = new THREE.AxesHelper(size * 0.5);
        scene.add(axis);
        const grid = new THREE.GridHelper(size * 2, 20, 0x999999, 0xdddddd);
        grid.position.y = -size / 2;
        scene.add(grid);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;

        let raf = 0;
        const animate = () => {
          raf = requestAnimationFrame(animate);
          controls.update();
          renderer.render(scene, camera);
        };
        animate();

        const onResize = () => {
          const w = container.clientWidth;
          const h = Math.max(container.clientHeight, 500);
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h);
        };
        window.addEventListener('resize', onResize);

        cleanup = () => {
          cancelAnimationFrame(raf);
          window.removeEventListener('resize', onResize);
          controls.dispose();
          renderer.dispose();
          scene.traverse((obj) => {
            const m = obj as InstanceType<typeof THREE.Mesh>;
            if ((m as { isMesh?: boolean }).isMesh) {
              m.geometry?.dispose();
              const mat = m.material as
                | InstanceType<typeof THREE.Material>
                | Array<InstanceType<typeof THREE.Material>>;
              if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
              else mat?.dispose();
            }
          });
          if (renderer.domElement.parentNode) {
            renderer.domElement.parentNode.removeChild(renderer.domElement);
          }
        };

        setInfo(`${result.meshes.length} 个零件 · ${Math.round(totalTri).toLocaleString()} 三角面`);
        setLoading(false);
      } catch (e) {
        if (!cancelled) {
          console.error(e);
          setError(String(e));
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (cleanup) cleanup();
    };
  }, [blob]);

  return (
    <div style={{ position: 'relative', background: '#f0f2f5' }}>
      {loading && (
        <div style={{ padding: 80, textAlign: 'center' }}>
          <Spin tip="加载 STEP 引擎并解析模型..." size="large" />
          <div style={{ marginTop: 16, color: '#888', fontSize: 12 }}>
            首次加载需下载约 6 MB WASM 模块
          </div>
        </div>
      )}
      {error && (
        <Alert
          type="error"
          showIcon
          message="STEP 加载失败"
          description={error}
          style={{ margin: 24 }}
        />
      )}
      <div ref={mountRef} style={{ width: '100%', height: '70vh' }} />
      {!loading && !error && info && (
        <div
          style={{
            position: 'absolute',
            left: 12,
            bottom: 12,
            padding: '4px 8px',
            background: 'rgba(0,0,0,0.5)',
            color: '#fff',
            borderRadius: 4,
            fontSize: 12,
            pointerEvents: 'none',
          }}
        >
          {info} · 鼠标拖拽旋转，滚轮缩放
        </div>
      )}
    </div>
  );
}
