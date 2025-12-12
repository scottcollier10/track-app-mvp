import Image from "next/image";

export function HeroBurst() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10">
      <Image
        src="/images/hero-burst-app.webp"
        alt=""
        fill
        priority
        className="object-cover opacity-80"
      />
      {/* Darken edges so text stays readable */}
      <div className="absolute inset-0 bg-slate-950/20" />
    </div>
  );
}
