import { ReactNode } from "react";

type ContainerProps = {
  children: ReactNode;
  className?: string;
};

export function Container({ children, className = "" }: ContainerProps) {
  return (
    <div className={`mx-auto w-full max-w-7xl px-6 sm:px-8 lg:px-10 ${className}`}>
      {children}
    </div>
  );
}

type SectionProps = {
  children: ReactNode;
  className?: string;
  id?: string;
};

export function Section({ children, className = "", id }: SectionProps) {
  return (
    <section id={id} className={`py-20 sm:py-24 lg:py-32 ${className}`}>
      <Container>{children}</Container>
    </section>
  );
}
