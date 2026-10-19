import { readCapturedSignInUrl } from "@/lib/auth/emailCapture";
import { json } from "@/lib/http";
import { emailCaptureAllowed } from "@/lib/runtime/hosted";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const capture = emailCaptureAllowed();
  if (!capture.allowed) {
    return json(
      {
        ok: false,
        error: "forbidden",
        message: capture.reason ?? "Email capture is not available."
      },
      403
    );
  }
  const email = new URL(request.url).searchParams.get("email");
  if (!email) {
    return json({ ok: false, error: "invalid", message: "email is required." }, 400);
  }
  const captured = readCapturedSignInUrl(email);
  if (!captured) {
    return json(
      { ok: false, error: "not_found", message: "No captured sign-in link for that email." },
      404
    );
  }
  return json({
    ok: true,
    labeled: true,
    email: captured.email,
    url: captured.url,
    createdAt: captured.createdAt
  });
}
