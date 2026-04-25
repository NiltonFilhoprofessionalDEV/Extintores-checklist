import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const MAPS_DIR = path.join(process.cwd(), "public", "maps");
const MOBILE_WIDTH = 2600;
const WEBP_QUALITY = 80;

async function optimizeMap(fileName) {
  if (!fileName.toLowerCase().endsWith(".jpg")) return;

  const inputPath = path.join(MAPS_DIR, fileName);
  const baseName = fileName.replace(/\.jpg$/i, "");

  const webpPath = path.join(MAPS_DIR, `${baseName}.webp`);
  const mobileJpgPath = path.join(MAPS_DIR, `${baseName}.mobile.jpg`);
  const mobileWebpPath = path.join(MAPS_DIR, `${baseName}.mobile.webp`);

  const image = sharp(inputPath);
  const metadata = await image.metadata();
  const mobileWidth = Math.min(MOBILE_WIDTH, metadata.width ?? MOBILE_WIDTH);

  await image.clone().webp({ quality: WEBP_QUALITY }).toFile(webpPath);
  await image
    .clone()
    .resize({ width: mobileWidth, withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(mobileJpgPath);
  await image
    .clone()
    .resize({ width: mobileWidth, withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toFile(mobileWebpPath);

  const [original, webp, mobileJpg, mobileWebp] = await Promise.all([
    fs.stat(inputPath),
    fs.stat(webpPath),
    fs.stat(mobileJpgPath),
    fs.stat(mobileWebpPath),
  ]);

  console.log(
    `${fileName} -> webp ${(webp.size / 1024 / 1024).toFixed(2)} MB | mobile jpg ${(mobileJpg.size / 1024 / 1024).toFixed(2)} MB | mobile webp ${(mobileWebp.size / 1024 / 1024).toFixed(2)} MB (orig ${(original.size / 1024 / 1024).toFixed(2)} MB)`,
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
