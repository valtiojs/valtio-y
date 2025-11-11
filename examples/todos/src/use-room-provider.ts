import { useEffect, useMemo } from "react";
import YProvider from "y-partyserver/provider";
import type * as Y from "yjs";

type UseRoomProviderOptions = {
  host?: string | undefined;
  room: string;
  party?: string;
  doc: Y.Doc;
  prefix?: string;
  options?: ConstructorParameters<typeof YProvider>[3];
};

/**
 * Custom hook wrapper around YProvider
 * Handles connection lifecycle and cleanup
 */
export function useRoomProvider({
  host,
  room,
  party,
  doc,
  prefix,
  options,
}: UseRoomProviderOptions) {
  // Only ONE useMemo needed - primitives (room, party, prefix) are compared by value
  // Only objects (doc, options) need to be stable to prevent recreation
  const provider = useMemo(() => {
    const resolvedHost =
      host ??
      (typeof window !== "undefined"
        ? window.location.host
        : "dummy-domain.com");

    return new YProvider(resolvedHost, room, doc, {
      connect: false,
      party,
      prefix,
      ...options,
    });
  }, [host, room, doc, party, prefix, options]);

  useEffect(() => {
    void provider.connect();

    return () => {
      provider.disconnect();
      if (typeof provider.destroy === "function") {
        provider.destroy();
      }
    };
  }, [provider]);

  return provider;
}
