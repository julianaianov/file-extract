// Transfers are segmented; only automatic parsing needs a bounded memory budget.
export const TRANSFER_PART_BYTES = 3 * 1024 * 1024;
export const AUTOMATIC_PARSE_BYTES = 250 * 1024 * 1024;
export const TOKEN_BLOCK_BYTES = 250 * 1024 * 1024;
export function validFileSize(size: unknown): size is number {
 return typeof size === "number" && Number.isSafeInteger(size) && size > 0;
}
export function extractionUnits(size = 1) {
 if (!validFileSize(size)) throw new Error("Tamanho de arquivo inválido");
 return Math.ceil(size / TOKEN_BLOCK_BYTES);
}
export function automaticParseAvailable(filename: string, size: number) {
 return !/\.(zip|pdf)$/i.test(filename) || size <= AUTOMATIC_PARSE_BYTES;
}
