"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/button";
import { Container } from "@/components/container";
import {
  MotionNavigationMenu,
  MotionNavigationMenuContent,
  MotionNavigationMenuItem,
  MotionNavigationMenuLink,
  MotionNavigationMenuList,
  MotionNavigationMenuTrigger,
} from "@/components/ui/motion-navigation-menu";
import { ArrowUpRight, BookOpen, Building2, ChartNoAxesColumn, Rocket, Sparkles, Users } from "lucide-react";

export function Navigation() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 border-b transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        scrolled
          ? "border-line bg-paper/95 shadow-[0_8px_30px_rgba(6,20,46,0.06)] backdrop-blur-md"
          : "border-line/70 bg-paper/90 backdrop-blur-sm"
      }`}
    >
      <Container className="flex h-16 items-center justify-between gap-6">
        <Link
          href="/"
          className="focus-ring flex items-center gap-4 rounded-sm text-navy"
          aria-label="Waves home"
        >
          <span className="font-heading text-2xl font-bold tracking-[0.12em] uppercase">Waves</span>
          <span className="hidden h-4 w-px bg-line/80 sm:block" />
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.2em] text-muted sm:inline">
            Systems Architecture
          </span>
        </Link>
        <div className="hidden md:flex">
          <MotionNavigationMenu viewportClassName="bg-white border border-line shadow-precise rounded-xl">
            <MotionNavigationMenuList>
              <MotionNavigationMenuItem value="products">
                <MotionNavigationMenuTrigger>Products</MotionNavigationMenuTrigger>
                <MotionNavigationMenuContent>
                  <div className="grid w-[500px] grid-cols-[1fr_1.25fr] gap-2">
                    <MotionNavigationMenuLink href="#products" className="bg-paper rounded-lg min-h-44 justify-between p-4 border border-line">
                      <span className="bg-white flex size-9 items-center justify-center rounded-lg border border-line">
                        <ChartNoAxesColumn className="size-4 text-navy" />
                      </span>
                      <span className="space-y-1">
                        <span className="block text-sm font-medium text-navy">Command center</span>
                        <span className="text-muted-foreground block text-xs">Monitor product growth, workflow health, and team output.</span>
                      </span>
                    </MotionNavigationMenuLink>
                    <div className="grid grid-cols-2 gap-0.5">
                      {[
                        { title: "Analytics", desc: "Live funnels, cohorts, and retention." },
                        { title: "Automation", desc: "Trigger workflows from events." },
                        { title: "Insights", desc: "AI recommendations for next steps." },
                        { title: "Reports", desc: "Share snapshots with stakeholders." },
                      ].map((p) => (
                        <MotionNavigationMenuLink key={p.title} href="#products">
                          <span className="flex items-center justify-between gap-2 text-sm font-medium text-navy">
                            {p.title}
                            <ArrowUpRight className="size-3" />
                          </span>
                          <span className="text-muted-foreground text-xs">{p.desc}</span>
                        </MotionNavigationMenuLink>
                      ))}
                    </div>
                  </div>
                </MotionNavigationMenuContent>
              </MotionNavigationMenuItem>

              <MotionNavigationMenuItem value="solutions">
                <MotionNavigationMenuTrigger>Solutions</MotionNavigationMenuTrigger>
                <MotionNavigationMenuContent>
                  <div className="w-[380px] space-y-1">
                    <div className="text-muted-foreground px-2 py-2 text-xs font-medium">Built for teams</div>
                    {[
                      { title: "Audit Cycle", desc: "Diagnose how work actually moves.", icon: Building2, href: "/#audit-cycle" },
                      { title: "Process", desc: "Design roles, handoffs, and review loops.", icon: Users, href: "/#process" },
                      { title: "Architecture Audit", desc: "A focused review of your systems.", icon: Rocket, href: "/architecture-audit" },
                    ].map((s) => (
                      <MotionNavigationMenuLink key={s.title} href={s.href} className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
                        <span className="flex size-8 items-center justify-center rounded-lg bg-paper border border-line">
                          <s.icon className="size-4 text-navy" />
                        </span>
                        <span className="space-y-0.5">
                          <span className="block text-sm font-medium text-navy">{s.title}</span>
                          <span className="text-muted-foreground block text-xs">{s.desc}</span>
                        </span>
                        <span className="text-navy text-xs">View</span>
                      </MotionNavigationMenuLink>
                    ))}
                  </div>
                </MotionNavigationMenuContent>
              </MotionNavigationMenuItem>

              <MotionNavigationMenuItem value="resources">
                <MotionNavigationMenuTrigger>Resources</MotionNavigationMenuTrigger>
                <MotionNavigationMenuContent>
                  <div className="grid w-[460px] grid-cols-2 gap-2">
                    <div className="space-y-0.5">
                      {[
                        { title: "Case Study", desc: "How we install an OS.", href: "/case-study" },
                        { title: "Documentation", desc: "Guides and API reference.", href: "#" },
                        { title: "Blog", desc: "Engineering and product notes.", href: "#" },
                      ].map((r) => (
                        <MotionNavigationMenuLink key={r.title} href={r.href}>
                          <span className="flex items-center gap-2 text-sm font-medium text-navy">
                            <BookOpen className="size-3.5" />
                            {r.title}
                          </span>
                          <span className="text-muted-foreground text-xs">{r.desc}</span>
                        </MotionNavigationMenuLink>
                      ))}
                    </div>
                    <MotionNavigationMenuLink href="/architecture-audit" className="bg-paper min-h-44 justify-between p-4 border border-line rounded-lg">
                      <span className="flex items-center gap-2 text-sm font-medium text-navy">
                        <Sparkles className="size-4" />
                        New release
                      </span>
                      <span className="text-muted-foreground text-xs">Explore the latest workflow templates and API improvements.</span>
                      <span className="text-xs font-medium text-navy">Book review →</span>
                    </MotionNavigationMenuLink>
                  </div>
                </MotionNavigationMenuContent>
              </MotionNavigationMenuItem>

              <MotionNavigationMenuItem>
                <MotionNavigationMenuLink href="/architecture-audit" className="flex h-9 items-center px-4 py-2 text-sm font-medium text-navy hover:text-accent">
                  Pricing
                </MotionNavigationMenuLink>
              </MotionNavigationMenuItem>
            </MotionNavigationMenuList>
          </MotionNavigationMenu>
        </div>
        <Button href="/architecture-audit" className="hidden md:inline-flex">
          Book Review
        </Button>
        <Button href="/architecture-audit" className="md:hidden">
          Book
        </Button>
      </Container>
    </header>
  );
}
