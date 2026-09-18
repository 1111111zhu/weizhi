"use client";

import * as React from "react";

interface AspectRatioProps extends React.ComponentProps<"div"> {
  ratio?: number;
}

function AspectRatio({
  ratio = 1,
  className,
  style,
  ...props
}: AspectRatioProps) {
  return (
    <div
      data-slot="aspect-ratio"
      className={className}
      style={{ ...style, aspectRatio: ratio }}
      {...props}
    />
  );
}

export { AspectRatio };
