declare module "discord-rpc" {
  export interface RpcClientOptions {
    transport: "ipc";
  }

  export interface Activity {
    details?: string;
    state?: string;
    startTimestamp?: Date;
    largeImageKey?: string;
    largeImageText?: string;
    smallImageKey?: string;
    smallImageText?: string;
    instance?: boolean;
  }

  export class Client {
    constructor(options: RpcClientOptions);
    login(options: { clientId: string }): Promise<void>;
    setActivity(activity: Activity): Promise<void>;
    clearActivity(): Promise<void>;
    destroy(): void;
  }
}
