import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCreateList, useDeleteList, useLists } from "@/hooks/useLists";
import type { ListResponse } from "@/types/list";

const columnHelper = createColumnHelper<ListResponse>();

export const ListsPage = () => {
  const navigate = useNavigate();
  const [isCreating, setIsCreating] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [newListDescription, setNewListDescription] = useState("");

  const { data: lists = [], isLoading, error } = useLists();
  const createList = useCreateList();
  const deleteList = useDeleteList();

  const columns = useMemo(
    () => [
      columnHelper.accessor("name", {
        header: "Name",
        cell: (info) => (
          <span className="font-semibold text-gray-900">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor("description", {
        header: "Beschreibung",
        cell: (info) => (
          <span className="block max-w-md break-words text-gray-600">
            {info.getValue() || (
              <span className="text-gray-400 italic">Keine Beschreibung</span>
            )}
          </span>
        ),
        meta: {
          className: "whitespace-normal", // Override whitespace-nowrap for this column
        },
      }),
      columnHelper.accessor("video_count", {
        header: "Videos",
        cell: (info) => (
          <span className="text-gray-500 text-sm">
            {info.getValue()} Videos
          </span>
        ),
      }),
      columnHelper.accessor("created_at", {
        header: "Erstellt",
        cell: (info) => (
          <span className="text-gray-500 text-sm">
            {new Date(info.getValue()).toLocaleDateString("de-DE")}
          </span>
        ),
      }),
      columnHelper.accessor("id", {
        header: "Aktionen",
        cell: (info) => (
          <div className="flex gap-2">
            <button
              className="rounded px-3 py-1 text-blue-600 text-sm transition-colors hover:bg-blue-50 hover:text-blue-800"
              onClick={() => navigate("/videos")}
            >
              Videos
            </button>
            <button
              className="rounded px-3 py-1 text-red-600 text-sm transition-colors hover:bg-red-50 hover:text-red-800"
              onClick={() => {
                if (window.confirm("Liste wirklich löschen?")) {
                  deleteList.mutate(info.getValue());
                }
              }}
            >
              Löschen
            </button>
          </div>
        ),
      }),
    ],
    [deleteList, navigate]
  );

  const table = useReactTable({
    data: lists,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListName.trim()) return;

    try {
      await createList.mutateAsync({
        name: newListName,
        description: newListDescription || undefined,
      });

      setNewListName("");
      setNewListDescription("");
      setIsCreating(false);
    } catch (_error) {
      // Error is already handled by React Query error state
      // Form stays open and user input is preserved
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-gray-600">Lädt Listen...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-red-600">
          Fehler beim Laden der Listen. Bitte versuchen Sie es später erneut.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl p-8">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="font-bold text-3xl text-gray-900">Meine Listen</h1>
        <button
          className="rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
          onClick={() => setIsCreating(true)}
        >
          Neue Liste
        </button>
      </div>

      {isCreating && (
        <form
          className="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
          onSubmit={handleCreate}
        >
          <h2 className="mb-4 font-semibold text-lg">Neue Liste erstellen</h2>
          <div className="space-y-4">
            <div>
              <label
                className="mb-1 block font-medium text-gray-700 text-sm"
                htmlFor="name"
              >
                Name *
              </label>
              <input
                autoFocus
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                id="name"
                onChange={(e) => setNewListName(e.target.value)}
                placeholder="Listenname"
                required
                type="text"
                value={newListName}
              />
            </div>
            <div>
              <label
                className="mb-1 block font-medium text-gray-700 text-sm"
                htmlFor="description"
              >
                Beschreibung
              </label>
              <textarea
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                id="description"
                onChange={(e) => setNewListDescription(e.target.value)}
                placeholder="Optionale Beschreibung"
                rows={3}
                value={newListDescription}
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              className="rounded-lg bg-green-600 px-4 py-2 text-white transition-colors hover:bg-green-700 disabled:bg-gray-400"
              disabled={createList.isPending}
              type="submit"
            >
              {createList.isPending ? "Erstellt..." : "Erstellen"}
            </button>
            <button
              className="rounded-lg bg-gray-300 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-400"
              onClick={() => {
                setIsCreating(false);
                setNewListName("");
                setNewListDescription("");
              }}
              type="button"
            >
              Abbrechen
            </button>
          </div>
        </form>
      )}

      {lists.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white py-12 text-center">
          <p className="text-gray-500 text-lg">
            Noch keine Listen vorhanden. Erstellen Sie Ihre erste Liste!
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      className="px-6 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wider"
                      key={header.id}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {table.getRowModel().rows.map((row) => (
                <tr className="transition-colors hover:bg-gray-50" key={row.id}>
                  {row.getVisibleCells().map((cell) => {
                    const isDescriptionColumn =
                      cell.column.id === "description";
                    return (
                      <td
                        className={`px-6 py-4 ${isDescriptionColumn ? "max-w-md" : "whitespace-nowrap"}`}
                        key={cell.id}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
