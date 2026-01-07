import Conf from "conf";
import { homedir } from "os";
import { join } from "path";
import type { Config } from "../types/index.js";

const DEFAULT_API_URL = "https://www.lumifyhub.io";
const DEFAULT_PAGES_DIR = join(homedir(), ".lumifyhub", "pages");

const store = new Conf<Config>({
  projectName: "lumifyhub-cli",
  defaults: {
    apiUrl: DEFAULT_API_URL,
    token: null,
    userId: null,
    email: null,
    pagesDir: DEFAULT_PAGES_DIR,
  },
});

export function getConfig(): Config {
  return {
    apiUrl: store.get("apiUrl"),
    token: store.get("token"),
    userId: store.get("userId"),
    email: store.get("email"),
    pagesDir: store.get("pagesDir"),
  };
}

export function setToken(token: string, userId: string, email: string): void {
  store.set("token", token);
  store.set("userId", userId);
  store.set("email", email);
}

export function clearAuth(): void {
  store.set("token", null);
  store.set("userId", null);
  store.set("email", null);
}

export function setApiUrl(url: string): void {
  store.set("apiUrl", url);
}

export function setPagesDir(dir: string): void {
  store.set("pagesDir", dir);
}

export function isAuthenticated(): boolean {
  return store.get("token") !== null;
}
