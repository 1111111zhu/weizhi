/* eslint-disable react/set-state-in-effect -- mounted is intentionally set after hydration. */

import { useState, useEffect } from "react";

export const useMounted = () => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return mounted;
};
