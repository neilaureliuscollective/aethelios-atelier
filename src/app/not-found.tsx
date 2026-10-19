import { AppLink } from "@/components/ui/AppLink";

export default function NotFound() {
  return (
    <section className="container section">
      <p className="kicker">Not found</p>
      <h1>That page is not part of Atelier.</h1>
      <AppLink className="btn btn-gold" href="/">
        Return home
      </AppLink>
    </section>
  );
}
