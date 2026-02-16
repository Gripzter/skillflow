"use client";

import Link from "next/link";
import { ReactNode } from "react";

interface AuthLayoutProps {
  children: ReactNode;
  heading: string;
  subtitle: string;
}

export default function AuthLayout({ children, heading, subtitle }: AuthLayoutProps) {
  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-12">
      {/* Background mesh */}
      <div className="pointer-events-none absolute inset-0 bg-mesh-gradient bg-grid-pattern" />

      <div className="relative w-full max-w-[440px]">
        {/* Logo */}
        <Link href="/" className="mb-8 block text-center text-2xl font-bold tracking-tight">
          <span className="text-white">Skill</span>
          <span className="text-teal">Flow</span>
        </Link>

        {/* Card */}
        <div className="card-border rounded-card bg-card p-8 sm:p-10">
          <h1 className="text-center text-2xl font-bold">{heading}</h1>
          <p className="mt-2 text-center text-body-gray">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
