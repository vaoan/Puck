export function tid(id: string): Record<string, string> {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.NEXT_PUBLIC_ENABLE_TEST_IDS !== "true"
  ) {
    return {};
  }
  return { "data-testid": id };
}
