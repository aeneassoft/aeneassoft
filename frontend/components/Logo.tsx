import Link from "next/link";
import Image from "next/image";

export function Logo({ className = "", href = "/" }: { className?: string; href?: string }) {
  return (
    <Link href={href} className={`flex items-center gap-2.5 ${className}`}>
      <SpartanHelm className="h-9 w-9 logo-glow" />
      <span className="text-xl font-bold text-white tracking-tight">
        AeneasSoft
      </span>
    </Link>
  );
}

function SpartanHelm({ className = "" }: { className?: string }) {
  return (
    <Image
      src="/logo.svg"
      alt="AeneasSoft"
      width={36}
      height={36}
      className={className}
      priority
    />
  );
}

export { SpartanHelm };
