import { AppLink } from "@/components/ui/AppLink";
import { INSTALL_COPY } from "@/lib/account/installCopy";

export function InstallGuidance({ signedIn }: { signedIn?: boolean }) {
  return (
    <section className="container section">
      <p className="kicker">{INSTALL_COPY.kicker}</p>
      <h1>{INSTALL_COPY.title}</h1>
      <p className="lede">{INSTALL_COPY.lede}</p>
      <div className="stack" style={{ marginTop: 24, maxWidth: 720 }}>
        <article className="surface-dense" style={{ padding: 24 }}>
          <h2 style={{ fontSize: 28 }}>{INSTALL_COPY.android.label}</h2>
          <ol>
            {INSTALL_COPY.android.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </article>
        <article className="surface-dense" style={{ padding: 24 }}>
          <h2 style={{ fontSize: 28 }}>{INSTALL_COPY.ios.label}</h2>
          <ol>
            {INSTALL_COPY.ios.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </article>
        <ul>
          {INSTALL_COPY.limits.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <div className="row">
          <AppLink className="btn btn-gold" href={signedIn ? "/account/continue" : "/account"}>
            {signedIn ? "Return to your account" : "Sign in"}
          </AppLink>
          <AppLink className="btn btn-ghost" href="/">
            Public site
          </AppLink>
        </div>
      </div>
    </section>
  );
}
