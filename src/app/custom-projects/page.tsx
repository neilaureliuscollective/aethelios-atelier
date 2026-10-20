import type { Metadata } from "next";
import { AppLink } from "@/components/ui/AppLink";
import { DeviceFrame } from "@/components/marketing/DeviceFrame";
import { FollowUpWorkspace } from "@/components/marketing/demos/FollowUpWorkspace";
import { PersonalTracker } from "@/components/marketing/demos/PersonalTracker";
import { StudyOrganizer } from "@/components/marketing/demos/StudyOrganizer";
import { Reveal } from "@/components/motion/Reveal";
import { CUSTOM_PROJECT_EXAMPLES } from "@/lib/customProjectExamples";

export const metadata: Metadata = { title: "Other custom projects" };

const DEMOS = {
  follow_up_workspace: FollowUpWorkspace,
  study_organizer: StudyOrganizer,
  personal_tracker: PersonalTracker
} as const;

export default function CustomProjectsPage() {
  return (
    <section className="container section">
      <p className="kicker">Other custom projects</p>
      <h1>Bring the idea. We’ll help define what’s worth building.</h1>
      <p className="lede">
        Atelier remains a business studio first. If you have another worthwhile digital project — a
        professional workflow, a study tool, or a bounded personal utility — Neil can review it
        through the same commission path, scoped to what a useful first version actually needs.
      </p>
      <p className="notice">
        These demonstrations use synthetic data. They are labeled examples, not completed client work,
        and they do not connect to live accounts or employer systems.
      </p>

      {CUSTOM_PROJECT_EXAMPLES.map((example, index) => {
        const Demo = DEMOS[example.id];
        return (
          <Reveal
            as="article"
            className={`service-feature ${index % 2 ? "service-feature-reverse" : ""} surface-ivory`}
            delay={(index % 3) as 0 | 1 | 2}
            key={example.id}
          >
            <div>
              <p className="tiny">{example.kicker}</p>
              <h2>{example.title}</h2>
              <p className="lede">{example.summary}</p>
              <AppLink className="btn btn-emerald-glass" href={example.briefHref}>
                Start a brief from this idea
              </AppLink>
            </div>
            <DeviceFrame variant="desktop" depth="tile" label={`${example.kicker}: ${example.title}`}>
              <Demo />
            </DeviceFrame>
          </Reveal>
        );
      })}

      <div className="row" style={{ marginTop: 28 }}>
        <AppLink className="btn btn-gold" href="/project?route=custom_project&purpose=unsure">
          Begin with your own idea
        </AppLink>
        <AppLink className="btn btn-ghost" href="/services">
          Business services
        </AppLink>
        <AppLink className="btn btn-ghost" href="/">
          Back to Atelier
        </AppLink>
      </div>
    </section>
  );
}
