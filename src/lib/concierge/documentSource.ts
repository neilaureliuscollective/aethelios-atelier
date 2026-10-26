export function isUsableDocumentSource(text: string) {
  return text.trim().length >= 18;
}

export function documentSourceFromTalk(input: string, visitorTurns: string[] = []) {
  const parts = [...visitorTurns, input.trim()].filter(Boolean);
  const source = parts.join("\n") || "Write a first document from this conversation.";
  // Match the talk endpoint's message limit, retaining the opening context and latest details.
  if (source.length <= 2000) return source;
  const separator = "\n[Earlier details omitted from this draft source]\n";
  return source.slice(0, 800) + separator + source.slice(-(2000 - 800 - separator.length));
}
