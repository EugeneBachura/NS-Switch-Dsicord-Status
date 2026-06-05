import { copyFile, mkdir } from "node:fs/promises";

const source = "assets/icon-source.png";

await mkdir("assets", { recursive: true });
await mkdir("public", { recursive: true });
await copyFile(source, "assets/icon.png");
await copyFile(source, "public/app-icon.png");
