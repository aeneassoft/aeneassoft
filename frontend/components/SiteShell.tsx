"use client";

import { usePathname } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

export function SiteShell({
  lang,
  navDict,
  footerDict,
  children,
}: {
  lang: string;
  navDict: React.ComponentProps<typeof Navbar>["dict"];
  footerDict: React.ComponentProps<typeof Footer>["dict"];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isLogin = pathname.endsWith("/login");
  const isDashboard = pathname.includes("/dashboard");

  const hideChrome = isLogin || isDashboard;

  return (
    <>
      {!hideChrome && <Navbar lang={lang} dict={navDict} />}
      <main className="flex-1 min-w-0 overflow-x-hidden circuit-bg">{children}</main>
      {!hideChrome && <Footer lang={lang} dict={footerDict} />}
    </>
  );
}
