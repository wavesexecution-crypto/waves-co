import { Badge } from "@/components/badge";
import { Button } from "@/components/button";
import { Container } from "@/components/container";

export default function NotFound() {
  return (
    <main className="border-b border-line bg-paper">
      <Container className="grid min-h-[calc(100vh-4rem)] place-items-center py-24">
        <section className="w-full max-w-3xl">
          <Badge>404</Badge>
          <h1 className="mt-8 font-heading text-[40px] font-semibold leading-[1.1] tracking-[-0.02em] text-navy sm:text-[56px]">
            This page is outside the system.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-body">
            The link may have moved, or the page may no longer exist. You can
            return home or book a review to start in the right place.
          </p>
          <div className="mt-8 flex flex-col gap-4 sm:flex-row">
            <Button href="/">Return Home</Button>
            <Button href="/architecture-audit" variant="secondary">
              Book Architecture Review
            </Button>
          </div>
        </section>
      </Container>
    </main>
  );
}

