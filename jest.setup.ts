/// <reference types="jest" />
/// <reference types="node" />
import { TextDecoder, TextEncoder } from "util";

(globalThis as any).TextEncoder ??= TextEncoder;
(globalThis as any).TextDecoder ??= TextDecoder;

(globalThis as any).btoa ??= (str: string) => Buffer.from(str, "binary").toString("base64");

(globalThis as any).atob ??= (b64: string) => Buffer.from(b64, "base64").toString("binary");

jest.mock("@react-native-async-storage/async-storage");
