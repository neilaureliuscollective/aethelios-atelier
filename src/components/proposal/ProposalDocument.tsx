import type { Proposal, ProposalDecision } from "@/lib/types";

function Section({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="proposal-section">
      <h3>{title}</h3>
      {items.length ? (
        <ul>
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="muted">None recorded on this version.</p>
      )}
    </section>
  );
}

export function ProposalDocument({
  proposal,
  decisions = [],
  compact = false
}: {
  proposal: Proposal;
  decisions?: ProposalDecision[];
  compact?: boolean;
}) {
  const related = decisions.filter((item) => item.proposalId === proposal.id);
  return (
    <article className={`proposal-document ${compact ? "proposal-document-compact" : ""}`}>
      <header className="proposal-document-head">
        <p className="kicker">Proposal v{proposal.version}</p>
        <h2>Scoped commission</h2>
        <p className="tiny">
          {proposal.status.replaceAll("_", " ")}
          {proposal.publishedAt ? ` · published ${new Date(proposal.publishedAt).toLocaleString()}` : " · unpublished draft"}
        </p>
        {proposal.changeSummary ? <p className="lede">{proposal.changeSummary}</p> : null}
      </header>
      <p className="proposal-summary">{proposal.scope.summary || "No summary on this version yet."}</p>
      <Section title="Deliverables" items={proposal.scope.deliverables} />
      <Section title="Included pages" items={proposal.scope.includedPages} />
      <Section title="Included features" items={proposal.scope.includedFeatures} />
      <Section title="Exclusions" items={proposal.scope.exclusions} />
      <Section title="Client responsibilities" items={proposal.scope.clientResponsibilities} />
      <section className="proposal-section">
        <h3>Milestones</h3>
        {proposal.scope.milestones.length ? (
          <ol className="proposal-milestones">
            {proposal.scope.milestones.map((item) => (
              <li key={item.title}>
                <strong>{item.title}</strong>
                {item.timing ? <span className="tiny"> {item.timing}</span> : null}
                <p>{item.description}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="muted">None recorded on this version.</p>
        )}
      </section>
      {proposal.scope.brandDirection ? (
        <section className="proposal-section">
          <h3>Brand direction</h3>
          <p>{proposal.scope.brandDirection}</p>
        </section>
      ) : null}
      <section className="proposal-price">
        <p className="tiny">Founder-set price · not collected</p>
        <p className="proposal-amount">{proposal.scope.price.amount || "Unset"} {proposal.scope.price.currency}</p>
        <p className="muted">{proposal.scope.price.terms}</p>
      </section>
      {related.length ? (
        <section className="proposal-section">
          <h3>Version history</h3>
          {related.map((item) => (
            <article className="brief-item" key={item.id}>
              <p className="tiny">
                {item.kind.replaceAll("_", " ")} · v{item.agreedVersion} · {new Date(item.createdAt).toLocaleString()}
              </p>
              <p>{item.body || item.agreementText}</p>
            </article>
          ))}
        </section>
      ) : null}
    </article>
  );
}
