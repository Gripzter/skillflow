"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import Link from "next/link";

type BaseProps = {
  children: ReactNode;
  className?: string;
  "aria-label": string;
};

type ButtonProps = BaseProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label" | "className" | "children"> & {
    href?: undefined;
  };

type LinkProps = BaseProps & {
  href: string;
};

/** Shared 40x40 header icon target — matches Wifi / Settings chrome. */
export default function HeaderIconButton(props: ButtonProps | LinkProps) {
  const classes = `flex h-10 w-10 items-center justify-center rounded-lg text-[#9CA3AF] transition-colors hover:bg-white/[0.06] hover:text-white ${props.className ?? ""}`;

  if ("href" in props && props.href) {
    return (
      <Link href={props.href} className={classes} aria-label={props["aria-label"]}>
        {props.children}
      </Link>
    );
  }

  const { children, className: _c, ...rest } = props as ButtonProps;
  return (
    <button type="button" className={classes} {...rest}>
      {children}
    </button>
  );
}
