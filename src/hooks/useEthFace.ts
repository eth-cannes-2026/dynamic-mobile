/**
 * useEthFace.ts
 *
 * Pure-JS port of the pixel-art ETH face generator.
 * No native module, no canvas, no external dep beyond React.
 *
 * Algorithm:
 *   address → FNV-1a hash → seeded PRNG → 64×64 grayscale levels
 *   → 3× nearest-neighbour upscale (192×192)
 *   → in-memory grayscale PNG (uncompressed deflate, no libs)
 *   → base64 data URI  →  usable directly in <Image source={{ uri }} />
 *
 * Usage:
 *   const { uri } = useEthFace('0xABCD…');
 *   <Image source={{ uri }} style={{ width: 96, height: 96 }} />
 */

import { useMemo } from 'react';

/* =========================================================================
 * Constants
 * ========================================================================= */

const FACE_W = 64;
const FACE_H = 64;
const SCALE = 3;   // each logical pixel → 3×3 block in the output PNG
const OUT_W = FACE_W * SCALE;  // 192
const OUT_H = FACE_H * SCALE;  // 192

/** The 16 allowed grayscale values (0=black … 255=white, step 17) */
const G16 = Array.from({ length: 16 }, (_, i) => i * 17);

/* =========================================================================
 * PRNG — xorshift-multiply (bit-exact with the C / JS Ledger reference)
 * ========================================================================= */

function hashAddr(addr: string): number {
    const hex = addr.toLowerCase().replace(/[^0-9a-f]/g, '').slice(0, 40).padEnd(40, '0');
    let h = 0x811c9dc5 >>> 0;
    for (let i = 0; i < hex.length; i++)
        h = Math.imul(h ^ hex.charCodeAt(i), 0x01000193) >>> 0;
    return h;
}

function mkRng(seed: number): () => number {
    let s = (seed >>> 0) ^ 0xdeadbeef;
    return () => {
        s = Math.imul(s ^ (s >>> 16), 0x45d9f3b) >>> 0;
        s = Math.imul(s ^ (s >>> 16), 0x45d9f3b) >>> 0;
        return s / 4294967296;
    };
}

/* =========================================================================
 * Face pixel generator  →  Uint8Array[FACE_W × FACE_H]  (values 0-255)
 * ========================================================================= */

function generateFacePixels(addr: string): Uint8Array {
    const canvas = new Uint8Array(FACE_W * FACE_H);
    const rng = mkRng(hashAddr(addr));
    const ri = (a: number, b: number) => Math.floor(rng() * (b - a + 1)) + a;
    const gv = (l: number) => G16[Math.max(0, Math.min(15, l))];

    /* ---- draw primitives ---- */
    const cpx = (x: number, y: number, l: number) => {
        if (x >= 0 && x < FACE_W && y >= 0 && y < FACE_H)
            canvas[y * FACE_W + x] = gv(l);
    };
    const crect = (x: number, y: number, w: number, h: number, l: number) => {
        for (let ry = y; ry < y + h; ry++)
            for (let rx = x; rx < x + w; rx++) cpx(rx, ry, l);
    };
    const chline = (x1: number, x2: number, y: number, l: number) => {
        for (let x = x1; x <= x2; x++) cpx(x, y, l);
    };
    const oHw = (y: number, cy: number, rw: number, rh: number): number => {
        const q = rh * rh - (y - cy) * (y - cy);
        return q <= 0 ? 0 : Math.round((rw * Math.sqrt(q)) / rh);
    };
    const coval = (cx: number, cy: number, rw: number, rh: number, l: number) => {
        for (let y = cy - rh; y <= cy + rh; y++)
            chline(cx - oHw(y, cy, rw, rh), cx + oHw(y, cy, rw, rh), y, l);
    };

    /* ---- grayscale level picks ----
     *  bgL    12-15  very light background
     *  skinL   5- 9  medium skin, ≥3 levels below bg
     *  shadL        skin shadow  (skinL - 2)
     *  lipL         lips         (skinL - 3)
     *  hairL  dark: 0-3 / light: 11-14  (|hairL - skinL| ≥ 4)
     *  irisL   2- 6  eye iris
     *  browL        eyebrow shade derived from hair
     *  fhL          facial hair
     */
    const bgL = ri(12, 15);
    const skinL = ri(5, Math.min(9, bgL - 3));
    const shadL = Math.max(skinL - 2, 2);
    const lipL = Math.max(skinL - 3, 2);
    const hairDk = rng() < 0.55;
    let hairL = hairDk ? ri(0, 3) : ri(11, 14);
    if (!hairDk) while (hairL - skinL < 4) hairL = ri(11, 14);
    const hairSL = hairDk ? Math.min(hairL + 1, 4) : Math.max(hairL - 1, 10);
    const browL = hairDk ? Math.min(hairL + 1, 5) : ri(3, 7);
    const irisL = ri(2, 6);
    const fhL = hairDk ? ri(0, 3) : ri(3, 6);

    /* ---- geometry ---- */
    const CX = 32, CY = 36;
    const fW = ri(10, 12), fH = ri(13, 15);
    const topY = CY - fH;

    const hairStyle = ri(0, 6);
    const hlRow = hairStyle === 0 ? -99
        : hairStyle === 1 ? CY - Math.round(fH * 0.84)
            : hairStyle === 2 ? CY - Math.round(fH * 0.73)
                : CY - Math.round(fH * 0.65);

    const eyeRow = CY - ri(3, 5);
    const eyeOff = ri(3, 5);
    const browRow = Math.max(eyeRow - ri(2, 3), hlRow + 2);
    const browType = ri(0, 3);
    const noseRow = CY + ri(1, 3);
    const noseType = ri(0, 3);
    const mouthRow = CY + ri(5, 8);
    const mouthW = ri(2, 4);
    const mouthType = ri(0, 3);
    const hasFH = rng() < 0.28 ? ri(1, 3) : 0;

    /* ===== DRAW (identical order to the JS pixel-art version) ===== */

    // 1. Background
    canvas.fill(gv(bgL));

    // 2. Neck + shoulder stub (top starts deep inside face oval — no visible seam)
    const nW = Math.round(fW * 0.38);
    crect(CX - nW, CY + fH - 2, nW * 2 + 1, FACE_H - (CY + fH - 2), skinL);
    const sTop = CY + fH + 1;
    if (sTop < FACE_H)
        crect(CX - fW - 5, sTop, (fW + 5) * 2 + 1, Math.min(5, FACE_H - sTop), skinL);

    // 3. Long hair back (behind face oval)
    if (hairStyle === 4) {
        const hbTop = CY - Math.round(fH * 0.08);
        crect(CX - fW - 1, hbTop, 3, fH + 17, hairL);
        crect(CX + fW - 1, hbTop, 3, fH + 17, hairL);
        for (let y = hbTop; y < hbTop + fH + 17; y++) {
            cpx(CX - fW - 2, y, hairSL);
            cpx(CX + fW + 2, y, hairSL);
        }
    }

    // 4. Ears (before face so face covers inner edge)
    const earY = CY - ri(0, 2);
    const earH = ri(3, 5);
    crect(CX - fW - 2, earY, 2, earH, skinL);
    crect(CX + fW + 1, earY, 2, earH, skinL);
    cpx(CX - fW - 1, earY + 1, shadL);
    cpx(CX + fW + 2, earY + 1, shadL);

    // 5. Face: 1px dark outline oval, then skin fill
    coval(CX, CY, fW + 1, fH + 1, 0);
    coval(CX, CY, fW, fH, skinL);

    // 6. Hair front
    if (hairStyle > 0) {
        // Cover face-top rows with hair colour down to hairline
        for (let y = topY; y <= hlRow && y <= CY + fH; y++) {
            const hw = oHw(y, CY, fW, fH);
            chline(CX - hw, CX + hw, y, hairL);
        }
        // Dark outline at hairline sides
        if (hlRow >= topY) {
            const hw = oHw(hlRow, CY, fW, fH);
            cpx(CX - hw, hlRow, 0);
            cpx(CX + hw, hlRow, 0);
        }

        if (hairStyle === 1) {           /* buzz: flat rectangular cap */
            crect(CX - fW, topY - 2, fW * 2 + 1, 2, hairL);
            chline(CX - fW, CX + fW, topY - 3, 0);

        } else if (hairStyle === 5) {    /* afro: three puffed ovals */
            coval(CX, topY - 6, fW + 4, 8, hairL);
            coval(CX - Math.round(fW * 0.58), topY - 1, 4, 7, hairL);
            coval(CX + Math.round(fW * 0.58), topY - 1, 4, 7, hairL);
            coval(CX, topY + 1, fW + 2, 3, hairSL);

        } else {                         /* short / medium / long / wavy */
            const capH = hairStyle === 2 ? 3 : 5;
            for (let y = topY - capH; y < topY; y++) {
                const t = topY - y;
                const w = Math.round((fW + 1) * (1 - (0.28 * t) / capH));
                chline(CX - w, CX + w, y, hairL);
            }
            chline(
                CX - Math.round((fW + 1) * 0.72),
                CX + Math.round((fW + 1) * 0.72),
                topY - capH - 1, 0
            );
            if (hairStyle === 6) {         /* wavy: 4 pixel bumps */
                for (const bx of [-6, -2, 2, 6]) {
                    cpx(CX + bx, topY - capH - 1, hairL);
                    cpx(CX + bx, topY - capH - 2, hairL);
                    cpx(CX + bx, topY - capH - 3, 0);
                }
            }
            if (hlRow - 1 >= topY) {
                const hw = oHw(hlRow - 1, CY, fW, fH);
                chline(CX - hw, CX + hw, hlRow - 1, hairSL);
            }
        }
    }

    // 7. Eyes
    for (const s of [-1, 1] as const) {
        const ex = CX + s * eyeOff;
        chline(ex - 2, ex + 2, eyeRow - 1, shadL);   // upper lid
        crect(ex - 2, eyeRow, 5, 2, 15);              // sclera 5×2
        crect(ex - 1, eyeRow, 2, 2, irisL);            // iris 2×2
        cpx(ex, eyeRow + 1, 0);                      // pupil
        cpx(ex - 1, eyeRow, 15);                      // shine
        cpx(ex - 2, eyeRow, shadL);                   // corner detail
        cpx(ex + 2, eyeRow, shadL);
    }

    // 8. Eyebrows — 4 expression variants
    for (const s of [-1, 1] as const) {
        const bx = CX + s * eyeOff;
        if (browType === 0) {
            chline(bx - 2, bx + 2, browRow, browL);
        } else if (browType === 1) {
            chline(bx - 2, bx - 1, browRow, browL);
            cpx(bx, browRow - 1, browL);
            chline(bx + 1, bx + 2, browRow, browL);
        } else if (browType === 2) {
            if (s < 0) { chline(bx - 2, bx, browRow, browL); chline(bx + 1, bx + 2, browRow - 1, browL); }
            else { chline(bx - 2, bx - 1, browRow - 1, browL); chline(bx, bx + 2, browRow, browL); }
        } else {
            if (s < 0) { chline(bx - 2, bx, browRow - 1, browL); chline(bx + 1, bx + 2, browRow, browL); }
            else { chline(bx - 2, bx - 1, browRow, browL); chline(bx, bx + 2, browRow - 1, browL); }
        }
    }

    // 9. Nose — minimal shadow pixels (type 0 = invisible)
    if (noseType === 1) { cpx(CX - 1, noseRow, shadL); cpx(CX + 1, noseRow, shadL); }
    else if (noseType === 2) { cpx(CX, noseRow - 1, shadL); cpx(CX - 1, noseRow, shadL); cpx(CX + 1, noseRow, shadL); }
    else if (noseType === 3) { chline(CX - 1, CX + 1, noseRow, shadL); }

    // 10. Mouth — 4 expression variants
    if (mouthType === 0) {
        chline(CX - mouthW + 1, CX + mouthW - 1, mouthRow, lipL);
        cpx(CX - mouthW, mouthRow - 1, lipL); cpx(CX + mouthW, mouthRow - 1, lipL);
    } else if (mouthType === 1) {
        chline(CX - mouthW, CX + mouthW, mouthRow, lipL);
    } else if (mouthType === 2) {
        cpx(CX - mouthW, mouthRow - 1, lipL); cpx(CX + mouthW, mouthRow - 1, lipL);
        chline(CX - mouthW + 1, CX + mouthW - 1, mouthRow - 1, 15);
        chline(CX - mouthW, CX + mouthW, mouthRow, lipL);
    } else {
        chline(CX - mouthW + 1, CX + mouthW - 1, mouthRow - 1, lipL);
        cpx(CX - mouthW, mouthRow, lipL); cpx(CX + mouthW, mouthRow, lipL);
    }

    // 11. Facial hair
    if (hasFH === 1) {
        for (let fy = noseRow + 2; fy < mouthRow + 5; fy++) {
            const fw = oHw(fy, CY, fW, fH);
            for (let fx = CX - fw + 1; fx <= CX + fw - 1; fx++)
                if ((fx * 7 + fy * 11) % 5 === 0) cpx(fx, fy, fhL);
        }
    } else if (hasFH === 2) {
        chline(CX - 3, CX + 3, noseRow + 2, fhL);
        chline(CX - 2, CX + 2, noseRow + 3, fhL);
    } else if (hasFH === 3) {
        for (let fy = mouthRow - 1; fy < CY + fH - 1; fy++) {
            const fw = oHw(fy, CY, fW, fH);
            if (fw > 1) chline(CX - fw + 1, CX + fw - 1, fy, fhL);
        }
    }

    return canvas;
}

/* =========================================================================
 * PNG encoder — pure JS, zero dependencies
 *
 * Produces a grayscale PNG (colour type 0, 8-bit).
 * Compression: uncompressed deflate (BTYPE=00) wrapped in a valid zlib frame.
 * CRC-32 and Adler-32 are computed so the file passes all strict validators.
 * ========================================================================= */

const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
        let c = i;
        for (let j = 0; j < 8; j++) c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : c >>> 1;
        t[i] = c;
    }
    return t;
})();

function crc32(data: Uint8Array, off: number, len: number): number {
    let c = 0xffffffff;
    for (let i = 0; i < len; i++) c = CRC_TABLE[(c ^ data[off + i]) & 0xff]! ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}

function adler32(data: Uint8Array): number {
    let s1 = 1, s2 = 0;
    for (let i = 0; i < data.length; i++) {
        s1 = (s1 + data[i]!) % 65521;
        s2 = (s2 + s1) % 65521;
    }
    return ((s2 << 16) | s1) >>> 0;
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
    const len = data.length;
    const buf = new Uint8Array(12 + len);
    // length (4 bytes BE)
    buf[0] = (len >>> 24) & 0xff; buf[1] = (len >>> 16) & 0xff;
    buf[2] = (len >>> 8) & 0xff; buf[3] = len & 0xff;
    // chunk type (4 ASCII bytes)
    for (let i = 0; i < 4; i++) buf[4 + i] = type.charCodeAt(i);
    // chunk data
    buf.set(data, 8);
    // CRC over type + data
    const crc = crc32(buf, 4, 4 + len);
    buf[8 + len] = (crc >>> 24) & 0xff; buf[9 + len] = (crc >>> 16) & 0xff;
    buf[10 + len] = (crc >>> 8) & 0xff; buf[11 + len] = crc & 0xff;
    return buf;
}

function encodePNG(pixels: Uint8Array, w: number, h: number): Uint8Array {
    /* Add PNG filter byte 0 (None) before each scanline */
    const rowLen = 1 + w;
    const filtered = new Uint8Array(h * rowLen);
    for (let y = 0; y < h; y++) {
        filtered[y * rowLen] = 0;
        for (let x = 0; x < w; x++) filtered[y * rowLen + 1 + x] = pixels[y * w + x]!;
    }

    const checksum = adler32(filtered);

    /* Build uncompressed deflate stream (one block per ≤65535 bytes) */
    const MAX = 65535;
    const nBlk = Math.ceil(filtered.length / MAX) || 1;
    const deflate = new Uint8Array(filtered.length + nBlk * 5);
    let di = 0;
    for (let b = 0; b < nBlk; b++) {
        const start = b * MAX;
        const end = Math.min(start + MAX, filtered.length);
        const blen = end - start;
        deflate[di++] = (b === nBlk - 1) ? 0x01 : 0x00;  // BFINAL | BTYPE=00
        deflate[di++] = blen & 0xff;               // LEN  lo
        deflate[di++] = (blen >> 8) & 0xff;               // LEN  hi
        deflate[di++] = (~blen) & 0xff;               // NLEN lo
        deflate[di++] = ((~blen) >> 8) & 0xff;               // NLEN hi
        deflate.set(filtered.subarray(start, end), di);
        di += blen;
    }

    /* Wrap in zlib frame: CMF FLG | deflate | adler32 */
    const zlib = new Uint8Array(2 + deflate.length + 4);
    zlib[0] = 0x78; zlib[1] = 0x01;   // CMF=deflate/32K, FLG=no-dict/fastest
    zlib.set(deflate, 2);
    zlib[zlib.length - 4] = (checksum >>> 24) & 0xff;
    zlib[zlib.length - 3] = (checksum >>> 16) & 0xff;
    zlib[zlib.length - 2] = (checksum >>> 8) & 0xff;
    zlib[zlib.length - 1] = checksum & 0xff;

    /* IHDR: width, height, bit-depth=8, colour-type=0 (grayscale) */
    const ihdr = new Uint8Array(13);
    ihdr[0] = (w >>> 24) & 0xff; ihdr[1] = (w >>> 16) & 0xff;
    ihdr[2] = (w >>> 8) & 0xff; ihdr[3] = w & 0xff;
    ihdr[4] = (h >>> 24) & 0xff; ihdr[5] = (h >>> 16) & 0xff;
    ihdr[6] = (h >>> 8) & 0xff; ihdr[7] = h & 0xff;
    ihdr[8] = 8; /* bit depth */  /* ihdr[9..12] = 0: grayscale, deflate, adaptive, no interlace */

    const PNG_SIG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    const ihdrChunk = pngChunk('IHDR', ihdr);
    const idatChunk = pngChunk('IDAT', zlib);
    const iendChunk = pngChunk('IEND', new Uint8Array(0));

    const total = PNG_SIG.length + ihdrChunk.length + idatChunk.length + iendChunk.length;
    const out = new Uint8Array(total);
    let off = 0;
    out.set(PNG_SIG, off); off += PNG_SIG.length;
    out.set(ihdrChunk, off); off += ihdrChunk.length;
    out.set(idatChunk, off); off += idatChunk.length;
    out.set(iendChunk, off);
    return out;
}

/* =========================================================================
 * Base64 encoder — pure JS, no btoa (avoids RN environment issues)
 * ========================================================================= */

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function toBase64(bytes: Uint8Array): string {
    let s = '';
    for (let i = 0; i < bytes.length; i += 3) {
        const b0 = bytes[i]!, b1 = bytes[i + 1] ?? 0, b2 = bytes[i + 2] ?? 0;
        s += B64[b0 >> 2]!
            + B64[((b0 & 3) << 4) | (b1 >> 4)]!
            + (i + 1 < bytes.length ? B64[((b1 & 0xf) << 2) | (b2 >> 6)]! : '=')
            + (i + 2 < bytes.length ? B64[b2 & 0x3f]! : '=');
    }
    return s;
}

/* =========================================================================
 * Public hook
 * ========================================================================= */

export interface EthFaceResult {
    /**
     * PNG data URI ready for <Image source={{ uri }} />, or null if the
     * address is missing / too short to be a real address.
     */
    uri: string | null;
}

/**
 * Deterministically generate a 16-grayscale pixel-art face from an
 * Ethereum address. The result is memoised: it recomputes only when
 * `address` changes.
 *
 * @param address  Any string that looks like an ETH address (0x-prefixed
 *                 or raw hex). Typically the output of isAddress() guard.
 */
export function useEthFace(address: string | undefined | null): EthFaceResult {
    const uri = useMemo(() => {
        if (!address || address.length < 10) return null;

        // 1. Generate 64×64 grayscale face (values 0-255)
        const face64 = generateFacePixels(address);

        // 2. Nearest-neighbour upscale to 192×192 (crisp pixel-art, no blur)
        const scaled = new Uint8Array(OUT_W * OUT_H);
        for (let y = 0; y < FACE_H; y++) {
            for (let x = 0; x < FACE_W; x++) {
                const v = face64[y * FACE_W + x]!;
                for (let dy = 0; dy < SCALE; dy++)
                    for (let dx = 0; dx < SCALE; dx++)
                        scaled[(y * SCALE + dy) * OUT_W + (x * SCALE + dx)] = v;
            }
        }

        // 3. Encode as a valid grayscale PNG
        const png = encodePNG(scaled, OUT_W, OUT_H);

        // 4. Return a data URI
        return 'data:image/png;base64,' + toBase64(png);
    }, [address]);

    return { uri };
}