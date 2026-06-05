/// <reference types="vite/client" />

import type { DesktopApi } from "../preload/preload";

declare global {
  interface Window {
    nsSwitchDiscordStatus: DesktopApi;
  }
}
