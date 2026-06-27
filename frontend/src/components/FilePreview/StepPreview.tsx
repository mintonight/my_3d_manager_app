import { useEffect, useRef, useState } from 'react';
import { Alert, Spin } from 'antd';
import { useAuth } from '../../auth';
import { useI18n } from '../../i18n';
import type { PreviewProps } from './index';

import wasmUrl from 'occt-import-js/dist/occt-import-js.wasm?url';

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

const COLORS = [0xffffff, 0xe27d60, 0x7d8c54, 0xb86bff, 0xf4a261, 0x2a9d8f];

export default function StepPreview({ blob }: PreviewProps) {
  const { user } = useAuth();
  const { isZh, formatNumber } = useI18n();
  const mountRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState('');

  const text = isZh
    ? {
        parseFailed: 'STEP 解析失败：occt 返回 success=false',
        noMeshFound: 'STEP 文件中未找到可渲染的几何体',
        infoLabel: (meshCount: number, totalTri: number) =>
          `${formatNumber(meshCount)} 个零件 · ${formatNumber(Math.round(totalTri))} 三角面`,
        loadingEngine: '加载 STEP 引擎并解析模型...',
        loadingHint: '首次加载需要下载约 6 MB WASM 模块',
        loadFailed: 'STEP 加载失败',
        interactionHint: '鼠标拖拽旋转，滚轮缩放',
      }
    : {
        parseFailed: 'STEP parsing failed: occt returned success=false',
        noMeshFound: 'No renderable geometry found in the STEP file',
        infoLabel: (meshCount: number, totalTri: number) =>
          `${formatNumber(meshCount)} parts · ${formatNumber(Math.round(totalTri))} triangles`,
        loadingEngine: 'Loading STEP engine and parsing model...',
        loadingHint: 'The first load downloads about 6 MB of WASM data',
        loadFailed: 'STEP Load Failed',
        interactionHint: 'Drag to rotate, scroll to zoom',
      };

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
        if (!result.success) throw new Error(text.parseFailed);
        if (!result.meshes || result.meshes.length === 0) throw new Error(text.noMeshFound);

        const width = container.clientWidth;
        const height = Math.max(container.clientHeight, 500);
        const isDark = user?.ui_theme === 'dark';

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(isDark ? 0x0f141b : 0xf0f2f5);
        const camera = new THREE.PerspectiveCamera(45, width / height, 0.01, 100000);
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(width, height);
        container.innerHTML = '';
        container.appendChild(renderer.domElement);

        scene.add(new THREE.AmbientLight(0xffffff, isDark ? 0.8 : 0.6));
        const dir1 = new THREE.DirectionalLight(0xffffff, isDark ? 1 : 0.8);
        dir1.position.set(1, 1, 1);
        scene.add(dir1);
        const dir2 = new THREE.DirectionalLight(0xffffff, isDark ? 0.55 : 0.4);
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
            specular: isDark ? 0x444444 : 0x222222,
            shininess: 40,
            side: THREE.DoubleSide,
          });
          const mesh = new THREE.Mesh(geom, mat);
          group.add(mesh);
          const triCount = m.index ? m.index.array.length / 3 : positions.length / 9;
          totalTri += triCount;
        });

        const box = new THREE.Box3().setFromObject(group);
        const center = box.getCenter(new THREE.Vector3());
        const sizeVec = box.getSize(new THREE.Vector3());
        // Center horizontally (X/Z) and rest on the grid (bottom at y=0).
        group.position.x -= center.x;
        group.position.z -= center.z;
        group.position.y -= box.min.y;
        scene.add(group);

        const size = sizeVec.length();
        const camDist = size * 1.8;
        camera.position.set(camDist, camDist * 0.75, camDist);
        camera.lookAt(0, sizeVec.y / 2, 0);

        const axis = new THREE.AxesHelper(size * 0.5);
        scene.add(axis);
        const grid = new THREE.GridHelper(
          size * 2,
          20,
          isDark ? 0x5d6b7d : 0x999999,
          isDark ? 0x324051 : 0xdddddd,
        );
        // Grid lies on the ground plane (y=0), matching the model's bottom.
        grid.position.y = 0;
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
            const mesh = obj as InstanceType<typeof THREE.Mesh>;
            if ((mesh as { isMesh?: boolean }).isMesh) {
              mesh.geometry?.dispose();
              const mat =
                mesh.material as
                  | InstanceType<typeof THREE.Material>
                  | Array<InstanceType<typeof THREE.Material>>;
              if (Array.isArray(mat)) mat.forEach((item) => item.dispose());
              else mat?.dispose();
            }
          });
          if (renderer.domElement.parentNode) {
            renderer.domElement.parentNode.removeChild(renderer.domElement);
          }
        };

        setInfo(`${text.infoLabel(result.meshes.length, totalTri)} · ${text.interactionHint}`);
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
  }, [blob, formatNumber, isZh, user?.ui_theme]);

  return (
    <div style={{ position: 'relative', background: 'var(--ln-panel)' }}>
      {loading && (
        <div style={{ padding: 80, textAlign: 'center' }}>
          <Spin tip={text.loadingEngine} size="large" />
          <div style={{ marginTop: 16, color: 'var(--ln-preview-note)', fontSize: 12 }}>
            {text.loadingHint}
          </div>
        </div>
      )}
      {error && (
        <Alert
          type="error"
          showIcon
          message={text.loadFailed}
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
            background: 'var(--ln-preview-chip)',
            color: '#fff',
            borderRadius: 4,
            fontSize: 12,
            pointerEvents: 'none',
          }}
        >
          {info}
        </div>
      )}
    </div>
  );
}
