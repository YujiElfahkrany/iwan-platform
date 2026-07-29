import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { Film } from "lucide-react";

/**
 * Dashboard shortcut to a booking's recording playback page. Kept at the same
 * size as the Join button so both sit on one action row, and label is passed in
 * because the dashboards already hold their own translator.
 */
export function RecordingsLink({ bookingId, label }: { bookingId: string; label: string }) {
  return (
    // No fixed width and no forced single line: the Arabic and Russian labels
    // are longer, so the button grows (or wraps) instead of clipping them.
    <Button
      variant="outline"
      size="sm"
      className="h-auto min-h-8 min-w-0 py-1 whitespace-normal"
      asChild
    >
      <Link href={`/session/${bookingId}/recordings`}>
        <Film className="h-3.5 w-3.5 me-1.5" />
        {label}
      </Link>
    </Button>
  );
}
