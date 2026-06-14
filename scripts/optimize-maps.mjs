import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const MAPS_DIR = path.join(process.cwd(), "public", "maps");
const WEBP_QUALITY = 80;

async function optimizeMap(fileName) {
  const lower = fileName.toLowerCase();
  if (!lower.endsWith(".jpg")) return;

  const inputPath = path.join(MAPS_DIR, fileName);
  const baseName = fileName.replace(/\.jpg$/i, "");
  const webpPath = path.join(MAPS_DIR, `${baseName}.webp`);

  const image = sharp(inputPath);
  await image.clone().webp({ quality: WEBP_QUALITY }).toFile(webpPath);

  const [original, webp] = await Promise.all([fs.stat(inputPath), fs.stat(webpPath)]);

  console.log(
    `${fileName} -> webp ${(webp.size / 1024 / 1024).toFixed(2)} MB (orig ${(original.size / 1024 / 1024).toFixed(2)} MB)`,
  );
}

async function run() {
  const files = await fs.readdir(MAPS_DIR);
  await Promise.all(files.map((file) => optimizeMap(file)));
  console.log("Otimização concluída.");
}

run().catch((error) => {
  console.error("Falha na otimização de mapas:", error);
  process.exit(1);
});
