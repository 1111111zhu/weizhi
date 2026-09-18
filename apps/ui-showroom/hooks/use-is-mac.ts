/* eslint-disable react/set-state-in-effect -- platform detection is intentionally client-only. */

import { useEffect, useState } from "react";

export const useIsMac = () => {
  const [isMac, setIsMac] = useState(true);

  useEffect(() => {
    setIsMac(navigator.platform.toUpperCase().includes("MAC"));
  }, []);

  return isMac;
};
