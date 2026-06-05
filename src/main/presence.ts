import { Client, type Activity } from "discord-rpc";
import { defaultApplicationId, fallbackImageKey } from "../shared/constants.js";
import type { PresenceInput, PresenceStatus } from "../shared/types.js";
import { imageInputToPresenceValue } from "../shared/validation.js";

let client: Client | null = null;
let active = false;
let detected = false;
let currentApplicationId: string | null = null;

function buildActivity(
  input: PresenceInput,
  imageMode: "selected" | "fallback" | "none"
): Activity {
  const largeImage =
    imageInputToPresenceValue(input.largeImage) ??
    imageInputToPresenceValue(input.game.imageKey) ??
    imageInputToPresenceValue(input.game.image) ??
    fallbackImageKey;
  const smallImage =
    imageInputToPresenceValue(input.smallImage) ??
    imageInputToPresenceValue(input.game.smallImageKey) ??
    imageInputToPresenceValue(input.game.smallImage);

  return {
    details: input.details.trim() || input.game.title,
    state: input.state.trim() || undefined,
    startTimestamp: input.useStartTimestamp ? new Date() : undefined,
    largeImageKey:
      imageMode === "none" ? undefined : imageMode === "fallback" ? fallbackImageKey : largeImage,
    largeImageText: input.game.title,
    smallImageKey: imageMode === "selected" ? (smallImage ?? undefined) : undefined,
    smallImageText: input.game.platform,
    instance: false
  };
}

async function setActivityWithImageFallbacks(rpc: Client, input: PresenceInput): Promise<void> {
  try {
    await rpc.setActivity(buildActivity(input, "selected"));
    return;
  } catch (assetError) {
    console.debug("Discord rejected selected image assets", assetError);
  }

  try {
    await rpc.setActivity(buildActivity(input, "fallback"));
    return;
  } catch (fallbackError) {
    console.debug("Discord rejected fallback image asset", fallbackError);
  }

  await rpc.setActivity(buildActivity(input, "none"));
}

async function connect(applicationId: string): Promise<Client> {
  if (!applicationId.trim()) {
    throw new Error("Missing Discord Application ID");
  }

  if (client && currentApplicationId === applicationId) {
    return client;
  }

  if (client) {
    try {
      await client.clearActivity();
    } catch {
      // Ignore stale RPC cleanup errors.
    }
    client.destroy();
    client = null;
    currentApplicationId = null;
  }

  const nextClient = new Client({ transport: "ipc" });
  await nextClient.login({ clientId: applicationId });
  client = nextClient;
  currentApplicationId = applicationId;
  detected = true;
  return nextClient;
}

export async function startPresence(
  input: PresenceInput
): Promise<PresenceStatus> {
  try {
    const rpc = await connect(input.applicationId);
    await setActivityWithImageFallbacks(rpc, input);
    active = true;
    detected = true;
    return getPresenceStatus("Status on");
  } catch {
    active = false;
    detected = false;
    return getPresenceStatus("Could not connect to Discord RPC");
  }
}

export async function checkDiscord(): Promise<PresenceStatus> {
  try {
    await connect(currentApplicationId ?? defaultApplicationId);
    detected = true;
    return getPresenceStatus(active ? "Status on" : "Status off");
  } catch {
    detected = false;
    active = false;
    return getPresenceStatus("Could not connect to Discord RPC");
  }
}

export async function clearPresence(): Promise<PresenceStatus> {
  try {
    if (client) {
      await client.clearActivity();
    }
    active = false;
    return getPresenceStatus("Status off");
  } catch {
    active = false;
    return getPresenceStatus("Status off");
  }
}

export async function stopPresence(): Promise<PresenceStatus> {
  await clearPresence();
    if (client) {
      client.destroy();
      client = null;
      currentApplicationId = null;
    }
  return getPresenceStatus("Status off");
}

export function getPresenceStatus(message?: string): PresenceStatus {
  return {
    discordDetected: detected,
    presenceActive: active,
    message: message ?? (active ? "Status on" : "Status off")
  };
}
