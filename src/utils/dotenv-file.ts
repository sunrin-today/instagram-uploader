export function upsertEnvValue(
  contents: string,
  key: string,
  value: string
): { next: string; replaced: boolean } {
  const pattern = new RegExp(`^([ \\t]*${key}[ \\t]*=[ \\t]*)(.*)$`, "m");
  const match = contents.match(pattern);

  if (!match || match.index == null) {
    const line = `${key}="${value}"`;
    const prefix =
      contents === "" || contents.endsWith("\n") ? contents : `${contents}\n`;
    return { next: `${prefix}${line}\n`, replaced: false };
  }

  const raw = match[2] ?? "";
  const quote = raw.startsWith("'") ? "'" : raw.startsWith('"') ? '"' : "";
  const nextValue = quote ? `${quote}${value}${quote}` : value;

  return {
    next:
      contents.slice(0, match.index) +
      match[1] +
      nextValue +
      contents.slice(match.index + match[0].length),
    replaced: true,
  };
}
