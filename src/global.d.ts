/**
 * Global type declarations for Node.js runtime and React.
 * Required when @types/node and @types/react are not installed.
 */

/// <reference lib="es2022" />
/// <reference lib="dom" />

// ============================================================
// REACT TYPE DECLARATIONS
// ============================================================

declare module 'react' {
  export type ReactNode = 
    | ReactElement
    | string
    | number
    | boolean
    | null
    | undefined
    | Iterable<ReactNode>;

  export interface ReactElement<P = any> {
    type: any;
    props: P;
    key: string | null;
  }

  export interface Attributes {
    key?: string | number | null;
  }

  export type FC<P = {}> = (props: P & Attributes) => ReactElement | null;
  export type FunctionComponent<P = {}> = FC<P>;

  export function useState<T>(initialState: T | (() => T)): [T, (value: T | ((prev: T) => T)) => void];
  export function useEffect(effect: () => void | (() => void), deps?: readonly any[]): void;
  export function useCallback<T extends (...args: any[]) => any>(callback: T, deps: readonly any[]): T;
  export function useMemo<T>(factory: () => T, deps: readonly any[]): T;
  export function useRef<T>(initialValue: T): { current: T };
  
  export function createElement(
    type: any,
    props?: any,
    ...children: ReactNode[]
  ): ReactElement;

  export const Fragment: unique symbol;

  // Class component support (for ErrorBoundary)
  export interface ErrorInfo {
    componentStack: string;
  }

  export abstract class Component<P = {}, S = {}> {
    constructor(props: P);
    props: Readonly<P>;
    state: Readonly<S>;
    setState(state: Partial<S> | ((prevState: S, props: P) => Partial<S>)): void;
    forceUpdate(): void;
    abstract render(): ReactNode;
  }
}

declare module 'react/jsx-runtime' {
  export function jsx(type: any, props: any, key?: string): any;
  export function jsxs(type: any, props: any, key?: string): any;
  export const Fragment: unique symbol;
}

// ============================================================
// NODE.JS TYPE DECLARATIONS
// ============================================================

// Buffer type
interface Buffer extends Uint8Array {
  toString(encoding?: BufferEncoding): string;
}

interface BufferConstructor {
  from(data: string, encoding?: BufferEncoding): Buffer;
  from(data: ArrayBufferView | ArrayBuffer): Buffer;
  alloc(size: number, fill?: number | string): Buffer;
  allocUnsafe(size: number): Buffer;
  isBuffer(obj: unknown): obj is Buffer;
}

type BufferEncoding = 'ascii' | 'utf8' | 'utf-8' | 'utf16le' | 'ucs2' | 'ucs-2' | 'base64' | 'latin1' | 'binary' | 'hex';

declare var Buffer: BufferConstructor;

// Console
interface Console {
  log(...args: unknown[]): void;
  error(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  info(...args: unknown[]): void;
}

declare var console: Console;

// Process
interface Process {
  exit(code?: number): never;
  env: Record<string, string | undefined>;
}

declare var process: Process;

// Node.js fs module
declare module 'fs' {
  export function existsSync(path: string): boolean;
  export function mkdirSync(path: string, options?: { recursive?: boolean }): string | undefined;
  export function writeFileSync(path: string, data: Buffer | string): void;
  export function readFileSync(path: string): Buffer;
  export function unlinkSync(path: string): void;
  export function statSync(path: string): { size: number };
}

// Node.js fs/promises module
declare module 'fs/promises' {
  export function readFile(path: string): Promise<Buffer>;
  export function writeFile(path: string, data: Buffer | string): Promise<void>;
  export function mkdir(path: string, options?: { recursive?: boolean }): Promise<string | undefined>;
  export function unlink(path: string): Promise<void>;
  export function stat(path: string): Promise<{ size: number }>;
  export function access(path: string): Promise<void>;
}

// Node.js path module
declare module 'path' {
  export function join(...paths: string[]): string;
  export function dirname(path: string): string;
  export function basename(path: string, ext?: string): string;
  export function extname(path: string): string;
  export function resolve(...paths: string[]): string;
}
