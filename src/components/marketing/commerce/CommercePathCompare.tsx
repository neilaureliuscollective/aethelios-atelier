"use client";

import { useState } from "react";
import { AppLink } from "@/components/ui/AppLink";
import {
  COMMERCE_COMPARISON,
  COMMERCE_FOUNDATION_BRIEF_HREF,
  COMMERCE_FOUNDATION_OFFER,
  COMMERCE_LAUNCH_BRIEF_HREF,
  COMMERCE_LAUNCH_OFFER
} from "@/lib/offers/commerce";

type Path = "foundation" | "launch";

export function CommercePathCompare() {
  const [path, setPath] = useState<Path>("launch");
  const href = path === "launch" ? COMMERCE_LAUNCH_BRIEF_HREF : COMMERCE_FOUNDATION_BRIEF_HREF;
  const action = path === "launch" ? "Start a Commerce Launch brief" : "Start a Commerce Foundation brief";

  return (
    <div className="commerce-compare">
      <div className="commerce-path-toggle" role="group" aria-label="Choose a commerce path">
        <button
          type="button"
          className={`surface-ivory commerce-path ${path === "foundation" ? "commerce-path-active" : ""}`}
          aria-pressed={path === "foundation"}
          onClick={() => setPath("foundation")}
        >
          <p className="tiny">{COMMERCE_FOUNDATION_OFFER.kicker}</p>
          <h3>{COMMERCE_FOUNDATION_OFFER.title}</h3>
          <p>{COMMERCE_FOUNDATION_OFFER.summary}</p>
        </button>
        <button
          type="button"
          className={`surface-ivory commerce-path ${path === "launch" ? "commerce-path-active" : ""}`}
          aria-pressed={path === "launch"}
          onClick={() => setPath("launch")}
        >
          <p className="tiny">{COMMERCE_LAUNCH_OFFER.kicker}</p>
          <h3>{COMMERCE_LAUNCH_OFFER.title}</h3>
          <p>{COMMERCE_LAUNCH_OFFER.summary}</p>
        </button>
      </div>

      <div className="commerce-compare-table surface-read" role="table" aria-label="Commerce engagement comparison">
        <div className="commerce-compare-row commerce-compare-head" role="row">
          <span role="columnheader">Question</span>
          <span role="columnheader">{COMMERCE_FOUNDATION_OFFER.title}</span>
          <span role="columnheader">{COMMERCE_LAUNCH_OFFER.title}</span>
        </div>
        {COMMERCE_COMPARISON.map((row) => (
          <div className="commerce-compare-row" role="row" key={row.id}>
            <span role="rowheader">{row.label}</span>
            <span role="cell" data-active={path === "foundation" ? "true" : "false"}>
              {row.foundation}
            </span>
            <span role="cell" data-active={path === "launch" ? "true" : "false"}>
              {row.launch}
            </span>
          </div>
        ))}
      </div>

      <div className="row" style={{ marginTop: 22 }}>
        <AppLink className="btn btn-gold" href={href}>
          {action}
        </AppLink>
        <AppLink className="btn btn-ghost" href="/project">
          Begin with a general brief
        </AppLink>
      </div>
    </div>
  );
}
