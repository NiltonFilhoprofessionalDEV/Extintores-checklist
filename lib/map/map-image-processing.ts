import sharp from "sharp";

/** Maior lado da versão otimizada para visualização no app (zoom operacional). */
export const MAP_PREVIEW_MAX_SIDE = 4000;

export type ProcessedMapImage = {
  originalBuffer: Buffer;
  originalContentType: string;
  previewBuffer: Buffer;
  width: number;
  height: number;
};

export async function processMapImageUpload(
  buffer: Buffer,
  contentType: string,
): Promise<ProcessedMapImage> {
  const image = sharp(buffer);
  const meta = await image.metadata();
  const width = meta.width ?? 14042;
  const height = meta.height ?? 9934;
  const maxSide = Math.max(width, height);

  let previewPipeline = image.clone();
  if (maxSide > MAP_PREVIEW_MAX_SIDE) {
    previewPipeline = previewPipeline.resize({
      width: width >= height ? MAP_PREVIEW_MAX_SIDE : undefined,
      height: height > width ? MAP_PREVIEW_MAX_SIDE : undefined,
      fit: "inside",
      withoutEnlargement: true,
    });
  }

  const previewBuffer = await previewPipeline.webp({ quality: 82 }).toBuffer();

  return {
    originalBuffer: buffer,
    originalContentType: contentType,
    previewBuffer,
    width,
    height,
  };
}
