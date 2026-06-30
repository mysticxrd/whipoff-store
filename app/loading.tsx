export default function Loading() {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div
        role="status"
        aria-label="Loading"
        className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-foreground"
      />
    </div>
  );
}
