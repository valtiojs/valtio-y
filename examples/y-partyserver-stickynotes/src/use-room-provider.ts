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

export function useRoomProvider({
  host,
  room,
  party,
  doc,
  prefix,
  options,
}: UseRoomProviderOptions) {
  const connectionOptions = useMemo(
    () => ({
      connect: false,
      party,
      prefix,
      ...options,
    }),
    [party, prefix, options],
  );

  const provider = useMemo(() => {
    const resolvedHost =
      host ??
      (typeof window !== "undefined"
        ? window.location.host
        : "dummy-domain.com");

    return new YProvider(resolvedHost, room, doc, connectionOptions);
  }, [host, room, doc, connectionOptions]);

  useEffect(() => {
    void provider.connect();

    return () => {
      provider.disconnect();
      if (typeof provider.destroy === "function") {
        provider.destroy();
      }
    };
  }, [provider, room]);

  return provider;
}
