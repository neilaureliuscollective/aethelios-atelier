import { AppLink } from "@/components/ui/AppLink";
import { DeviceFrame } from "@/components/marketing/DeviceFrame";
import { FollowUpWorkspace } from "@/components/marketing/demos/FollowUpWorkspace";

export function CustomProjectsInvite() {
  return (
    <div className="custom-invite surface-ivory">
      <div>
        <p className="tiny">Other custom projects</p>
        <h3>Have another project in mind?</h3>
        <p className="muted">
          Need a useful tool for your work, studies, or a personal project? Bring the idea. We’ll help
          define what’s worth building. This is the same craft, scoped to a smaller complete brief —
          not a second product and not a promise that every idea will be accepted.
        </p>
        <div className="row" style={{ marginTop: 18 }}>
          <AppLink className="btn btn-emerald-glass" href="/custom-projects">
            Other custom projects
          </AppLink>
          <AppLink className="btn btn-ghost" href="/project?route=custom_project&purpose=unsure">
            Begin with the idea
          </AppLink>
        </div>
      </div>
      <DeviceFrame variant="tablet" depth="tile" label="Illustrative follow-up workspace">
        <FollowUpWorkspace compact />
      </DeviceFrame>
    </div>
  );
}
