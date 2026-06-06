import { useCallback, useEffect, useState } from "react";
import type { AccountInfo } from "./types";
import { invokeBackend, isTauriRuntime } from "./lib/platform";

const TRAY_REFRESH_EVENT = "tray-refresh";
const ACCOUNTS_CHANGED_EVENT = "accounts-changed";

function formatError(err: unknown): string {
  if (!err) return "Unknown error";
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return "Unknown error";
  }
}

function TrayMenu() {
  const [accounts, setAccounts] = useState<AccountInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const list = await invokeBackend<AccountInfo[]>("list_accounts");
      setAccounts(list);
      setError(null);
    } catch (err) {
      setError(formatError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Reload when the tray is reopened or accounts change elsewhere.
  useEffect(() => {
    if (!isTauriRuntime()) return;
    let unlistenRefresh: (() => void) | undefined;
    let unlistenChanged: (() => void) | undefined;

    void (async () => {
      const { listen } = await import("@tauri-apps/api/event");
      unlistenRefresh = await listen(TRAY_REFRESH_EVENT, () => void load());
      unlistenChanged = await listen(ACCOUNTS_CHANGED_EVENT, () => void load());
    })();

    return () => {
      unlistenRefresh?.();
      unlistenChanged?.();
    };
  }, [load]);

  const handleSwitch = useCallback(async (account: AccountInfo) => {
    if (account.is_active) {
      void invokeBackend("hide_tray_window");
      return;
    }
    try {
      setSwitchingId(account.id);
      setError(null);
      await invokeBackend("switch_account", { accountId: account.id });
      void invokeBackend("hide_tray_window");
    } catch (err) {
      setError(formatError(err));
    } finally {
      setSwitchingId(null);
    }
  }, []);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden rounded-xl border border-gray-200 bg-white text-gray-900 shadow-2xl dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100">
      <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2 dark:border-gray-800">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-black text-xs font-bold text-white">
          C
        </div>
        <span className="text-sm font-semibold">Codex Switcher</span>
      </div>

      <div className="flex-1 overflow-y-auto p-1.5">
        {loading ? (
          <div className="px-2 py-6 text-center text-xs text-gray-500 dark:text-gray-400">
            Loading...
          </div>
        ) : accounts.length === 0 ? (
          <div className="px-2 py-6 text-center text-xs text-gray-500 dark:text-gray-400">
            No accounts configured
          </div>
        ) : (
          accounts.map((account) => (
            <button
              key={account.id}
              onClick={() => void handleSwitch(account)}
              disabled={switchingId !== null}
              className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors disabled:opacity-60 ${
                account.is_active
                  ? "bg-gray-100 dark:bg-gray-800"
                  : "hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              <span
                className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
                  account.is_active ? "bg-green-500" : "bg-transparent"
                }`}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {account.name}
                </span>
                {account.email && (
                  <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                    {account.email}
                  </span>
                )}
              </span>
              {switchingId === account.id && (
                <span className="shrink-0 text-xs text-gray-400">...</span>
              )}
            </button>
          ))
        )}
      </div>

      {error && (
        <div className="border-t border-gray-100 px-3 py-2 text-xs text-red-600 dark:border-gray-800 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="flex items-center gap-1 border-t border-gray-100 p-1.5 dark:border-gray-800">
        <button
          onClick={() => void invokeBackend("open_main_window")}
          className="flex-1 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          Open Codex Switcher
        </button>
        <button
          onClick={() => void invokeBackend("quit_app")}
          className="rounded-lg px-2 py-1.5 text-sm text-gray-500 transition-colors hover:bg-gray-100 hover:text-red-600 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-red-400"
        >
          Quit
        </button>
      </div>
    </div>
  );
}

export default TrayMenu;
