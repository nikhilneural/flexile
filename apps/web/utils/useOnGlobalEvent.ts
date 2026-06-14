import { useEffect } from "react";

export const useOnGlobalEvent = <EventName extends keyof WindowEventMap>(
  name: EventName,
  cb: (evt: WindowEventMap[EventName]) => void,
) => {
  useEffect(() => {
    window.addEventListener(name, cb);
    return () => window.removeEventListener(name, cb);
  }, [name, cb]);
};
