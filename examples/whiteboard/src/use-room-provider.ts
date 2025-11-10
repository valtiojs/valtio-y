import { useEffect, useMemo } from "react";
import YProvider from "y-partyserver/provider";
import type * as Y from "yjs";
import type * as awarenessProtocol from "y-protocols/awareness";

type UseRoomProviderOptions = {
  host?: string | undefined;
  room: string;
  party?: string;
  doc: Y.Doc;
  prefix?: string;
  awareness?: awarenessProtocol.Awareness;
  options?: ConstructorParameters<typeof YProvider>[3];
};

/**
 * Custom hook wrapper around YProvider
 * Handles connection lifecycle and cleanup
 *
 * Note: Pass awareness as a separate parameter (not in options) to avoid
 * unnecessary re-renders. The hook memoizes based on awareness identity.
 */
export function useRoomProvider({
  host,
  room,
  party,
  doc,
  prefix,
  awareness,
  options,
}: UseRoomProviderOptions) {
  // Only ONE useMemo needed - primitives (room, party, prefix) are compared by value
  // Only objects (doc, awareness, options) need to be stable to prevent recreation
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
      ...(awareness && { awareness }),
      ...options,
    });
  }, [host, room, doc, party, prefix, awareness, options]);

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
