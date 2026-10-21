import { safeCallbackUrl } from "@/lib/auth/callbackUrl";
import { signInDestination } from "@/lib/auth/continuation";
import type { Project, Role } from "@/lib/types";

export type FirstLoginAction = {
  href: string;
  label: string;
  kind: "primary" | "secondary";
};

export type FirstLoginState = {
  title: string;
  lede: string;
  actions: FirstLoginAction[];
  hasSavedWork: boolean;
};

export function firstLoginDestination(next: unknown, hasGuestDraft: boolean) {
  return signInDestination(next, hasGuestDraft);
}

export function latestOwnedDraft(projects: Project[]): Project | null {
  const drafts = projects
    .filter((project) => project.status === "draft")
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return drafts[0] ?? null;
}

export function latestOwnedSubmission(projects: Project[]): Project | null {
  const submitted = projects
    .filter((project) => project.status !== "draft")
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return submitted[0] ?? null;
}

export function firstLoginState(input: {
  role: Role;
  projects: Project[];
  hasGuestDraft: boolean;
  intended?: string | null;
}): FirstLoginState {
  const intended = input.intended ? safeCallbackUrl(input.intended, "") : "";
  const draft = latestOwnedDraft(input.projects);
  const submitted = latestOwnedSubmission(input.projects);
  const actions: FirstLoginAction[] = [];

  if (intended && intended !== "/account" && intended !== "/account/continue") {
    actions.push({ href: intended, label: "Continue where you left off", kind: "primary" });
  }

  if (input.hasGuestDraft) {
    actions.push({
      href: intended ? `/account/adopt?next=${encodeURIComponent(intended)}` : "/account/adopt",
      label: "Review the guest draft on this device",
      kind: actions.some((action) => action.kind === "primary") ? "secondary" : "primary"
    });
  }

  if (draft) {
    actions.push({
      href: `/project/${encodeURIComponent(draft.id)}`,
      label: "Continue your saved brief",
      kind: actions.some((action) => action.kind === "primary") ? "secondary" : "primary"
    });
  } else if (!input.hasGuestDraft) {
    actions.push({
      href: "/project/new",
      label: "Start a project",
      kind: actions.some((action) => action.kind === "primary") ? "secondary" : "primary"
    });
  }

  if (submitted) {
    actions.push({
      href: `/workspace/${encodeURIComponent(submitted.id)}`,
      label: "Open your sent request",
      kind: "secondary"
    });
  }

  actions.push({ href: "/discover", label: "Explore Discovery", kind: "secondary" });
  actions.push({ href: "/workspace", label: "Commissions", kind: "secondary" });
  actions.push({ href: "/install", label: "Install on your phone", kind: "secondary" });

  if (input.role === "founder") {
    actions.push({ href: "/founder", label: "Founder workspace", kind: "secondary" });
  } else {
    actions.push({ href: "/companion", label: "Business Studio", kind: "secondary" });
  }

  const unique = actions.filter(
    (action, index) => actions.findIndex((candidate) => candidate.href === action.href) === index
  );

  if (draft || submitted) {
    return {
      title: "Welcome back.",
      lede: "Your saved work is still on this account. Sending a request is separate from saving a draft.",
      actions: unique,
      hasSavedWork: true
    };
  }

  if (input.hasGuestDraft) {
    return {
      title: "Review the draft on this device.",
      lede: "Signing in did not copy that draft into this account. You choose whether it belongs here.",
      actions: unique,
      hasSavedWork: false
    };
  }

  return {
    title: "Your Atelier account is ready.",
    lede: "This account is free. It does not start a subscription, create a payment, or grant founder access.",
    actions: unique,
    hasSavedWork: false
  };
}
