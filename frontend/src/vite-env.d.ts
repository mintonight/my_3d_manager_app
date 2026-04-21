/// <reference types="vite/client" />

declare module '*?url' {
  const src: string;
  export default src;
}

declare module 'occt-import-js' {
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
    root?: unknown;
    meshes: OcctMesh[];
  }
  interface OcctInstance {
    ReadStepFile(buf: Uint8Array, opts: unknown): OcctResult;
    ReadIgesFile?(buf: Uint8Array, opts: unknown): OcctResult;
    ReadBrepFile?(buf: Uint8Array, opts: unknown): OcctResult;
  }
  interface OcctOptions {
    locateFile?: (filename: string) => string;
  }
  const factory: (opts?: OcctOptions) => Promise<OcctInstance>;
  export default factory;
}
