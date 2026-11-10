import { Button } from "@/components/ui/button";

export function VideoPagination({
  page,
  pageSize,
  total,
  shown,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  shown: number;
  onPage: (page: number) => void;
}) {
  return (
    <nav
      aria-label="Videoseiten"
      className="my-4 flex items-center justify-between gap-4"
    >
      <Button
        disabled={page === 0}
        onClick={() => onPage(page - 1)}
        variant="outline"
      >
        Vorherige Seite
      </Button>
      <span role="status">
        {total ? page * pageSize + 1 : 0}–{page * pageSize + shown} von {total}
      </span>
      <Button
        disabled={(page + 1) * pageSize >= total}
        onClick={() => onPage(page + 1)}
        variant="outline"
      >
        Nächste Seite
      </Button>
    </nav>
  );
}
