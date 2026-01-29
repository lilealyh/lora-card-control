/* tslint:disable */
/* eslint-disable */

export class OtaManager {
    free(): void;
    [Symbol.dispose](): void;
    get_data_chunk(index: number, length: number): any;
    get_info_resp(): Uint8Array;
    get_progress(index: number, length: number): number;
    constructor(firmware: Uint8Array, prog_type: number);
}

export class SlipDecoder {
    free(): void;
    [Symbol.dispose](): void;
    decode_byte(byte: number): any;
    constructor();
}

export function build_rf_cfg(power: number, freq_rx: number, freq_tx0: number, freq_tx1: number, sf: number, net: number, period: number, dev_type: number): Uint8Array;

export function create_packet(cmd_id: number, pkt_type: number, data: Uint8Array, sid: number): Uint8Array;

export function parse_packet_to_json(cmd_id: number, data: Uint8Array): any;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_otamanager_free: (a: number, b: number) => void;
    readonly __wbg_slipdecoder_free: (a: number, b: number) => void;
    readonly build_rf_cfg: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => [number, number];
    readonly create_packet: (a: number, b: number, c: number, d: number, e: number) => [number, number];
    readonly otamanager_get_data_chunk: (a: number, b: number, c: number) => any;
    readonly otamanager_get_info_resp: (a: number) => [number, number];
    readonly otamanager_get_progress: (a: number, b: number, c: number) => number;
    readonly otamanager_new: (a: number, b: number, c: number) => number;
    readonly parse_packet_to_json: (a: number, b: number, c: number) => any;
    readonly slipdecoder_decode_byte: (a: number, b: number) => any;
    readonly slipdecoder_new: () => number;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
