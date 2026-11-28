import { useEffect } from "react";
import { useReadingLibrary } from "./useReadingLibrary";

export type ReadingRuntimeSnapshot = ReturnType<typeof useReadingLibrary> & { account: string };

/** Keep the optional storage runtime out of the initial workspace chunk. */
export default function ReadingRuntime({ account, onChange }: {
  account: string;
  onChange: (snapshot: ReadingRuntimeSnapshot | null) => void;
}) {
  const reading = useReadingLibrary(true, account);
  useEffect(() => {
    onChange({ account, ...reading });
  }, [account, reading.library, reading.error, reading.busy, onChange]);
  useEffect(() => () => onChange(null), [onChange]);
  return null;
}
