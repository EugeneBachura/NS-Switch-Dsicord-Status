import path from "node:path";
import { rcedit } from "rcedit";

function toWindowsVersion(version) {
  const parts = version.split(".");
  return parts.length === 3 ? `${version}.0` : version;
}

export default async function afterPack(context) {
  if (context.electronPlatformName !== "win32") {
    return;
  }

  const appInfo = context.packager.appInfo;
  const exePath = path.join(context.appOutDir, `${appInfo.productFilename}.exe`);
  const iconPath = path.join(context.packager.projectDir, "assets", "icon.ico");
  const windowsVersion = toWindowsVersion(appInfo.version);

  await rcedit(exePath, {
    icon: iconPath,
    "file-version": windowsVersion,
    "product-version": windowsVersion,
    "version-string": {
      CompanyName: "YOUR_NAME",
      FileDescription: appInfo.productName,
      InternalFilename: `${appInfo.productFilename}.exe`,
      OriginalFilename: `${appInfo.productFilename}.exe`,
      ProductName: appInfo.productName
    }
  });
}
