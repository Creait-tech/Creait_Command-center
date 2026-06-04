import Image from "next/image";
import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen flex-1 flex-col items-center justify-center gap-8 bg-background px-4 py-12">
      <div className="flex flex-col items-center gap-3">
        <Image
          src="/logo.svg"
          alt="CREAIT"
          width={48}
          height={48}
          priority
        />
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
          CREAIT Command Center
        </h1>
        <p className="text-sm text-muted-foreground">
          Create your account
        </p>
      </div>
      <SignUp />
    </div>
  );
}
