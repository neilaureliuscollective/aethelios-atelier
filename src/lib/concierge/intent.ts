const BUSINESS_SIGNAL =
  /\b(i run|we run|my (shop|studio|salon|practice|clinic|restaurant|barbershop|business)|our (shop|studio|salon|practice|clinic)|i own|we own|i have a|we have a|barber|salon|studio|shop|clinic|restaurant|practice)\b/i;
const SHORT_QUESTION = /^(hi|hello|hey|what is this|who are you|how does this work)\b/i;
const REVISION =
  /\b(make it|more|less|shorter|longer|luxury|quieter|warmer|gold|emerald|rewrite|change|add a slide|tighten)\b/i;

export function shouldOpenCanvas(message: string, hasDocument = false): boolean {
  const text = message.trim();
  if (text.length < 18) return false;
  if (SHORT_QUESTION.test(text) && text.length < 48) return false;
  if (hasDocument && REVISION.test(text)) return true;
  return BUSINESS_SIGNAL.test(text) || text.length >= 48;
}

export function isRevisionRequest(message: string, hasDocument: boolean): boolean {
  return hasDocument && REVISION.test(message);
}
