import { useState, useMemo } from 'react'
import {
  useReactTable,
  createColumnHelper,
  flexRender,
  getCoreRowModel,
} from '@tanstack/react-table'
import { useLists, useCreateList, useDeleteList } from '@/hooks/useLists'
import type { ListResponse } from '@/types/list'

const columnHelper = createColumnHelper<ListResponse>()

interface ListsPageProps {
  onSelectList?: (listId: string) => void
}

export const ListsPage = ({ onSelectList }: ListsPageProps) => {
  const [isCreating, setIsCreating] = useState(false)
  const [newListName, setNewListName] = useState('')
  const [newListDescription, setNewListDescription] = useState('')

  const { data: lists = [], isLoading, error } = useLists()
  const createList = useCreateList()
  const deleteList = useDeleteList()

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: 'Name',
        cell: (info) => (
          <span className="font-semibold text-gray-900">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor('description', {
        header: 'Beschreibung',
        cell: (info) => (
          <span className="text-gray-600">
            {info.getValue() || <span className="italic text-gray-400">Keine Beschreibung</span>}
          </span>
        ),
      }),
      columnHelper.accessor('video_count', {
        header: 'Videos',
        cell: (info) => (
          <span className="text-sm text-gray-500">{info.getValue()} Videos</span>
        ),
      }),
      columnHelper.accessor('created_at', {
        header: 'Erstellt',
        cell: (info) => (
          <span className="text-sm text-gray-500">
            {new Date(info.getValue()).toLocaleDateString('de-DE')}
          </span>
        ),
      }),
      columnHelper.accessor('id', {
        header: 'Aktionen',
        cell: (info) => (
          <div className="flex gap-2">
            <button
              onClick={() => onSelectList?.(info.getValue())}
              className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
            >
              Videos
            </button>
            <button
              onClick={() => {
                if (window.confirm('Liste wirklich löschen?')) {
                  deleteList.mutate(info.getValue())
                }
              }}
              className="px-3 py-1 text-sm text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
            >
              Löschen
            </button>
          </div>
        ),
      }),
    ],
    [deleteList, onSelectList]
  )

  const table = useReactTable({
    data: lists,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newListName.trim()) return

    try {
      await createList.mutateAsync({
        name: newListName,
        description: newListDescription || undefined,
      })

      setNewListName('')
      setNewListDescription('')
      setIsCreating(false)
    } catch (error) {
      // Error is already handled by React Query error state
      // Form stays open and user input is preserved
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Lädt Listen...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-600">
          Fehler beim Laden der Listen. Bitte versuchen Sie es später erneut.
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Meine Listen</h1>
        <button
          onClick={() => setIsCreating(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Neue Liste
        </button>
      </div>

      {isCreating && (
        <form onSubmit={handleCreate} className="mb-6 p-6 border border-gray-200 rounded-lg bg-white shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Neue Liste erstellen</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Name *
              </label>
              <input
                id="name"
                type="text"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder="Listenname"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                autoFocus
                required
              />
            </div>
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                Beschreibung
              </label>
              <textarea
                id="description"
                value={newListDescription}
                onChange={(e) => setNewListDescription(e.target.value)}
                placeholder="Optionale Beschreibung"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              type="submit"
              disabled={createList.isPending}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors"
            >
              {createList.isPending ? 'Erstellt...' : 'Erstellen'}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsCreating(false)
                setNewListName('')
                setNewListDescription('')
              }}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
            >
              Abbrechen
            </button>
          </div>
        </form>
      )}

      {lists.length === 0 ? (
        <div className="text-center py-12 bg-white border border-gray-200 rounded-lg">
          <p className="text-gray-500 text-lg">
            Noch keine Listen vorhanden. Erstellen Sie Ihre erste Liste!
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-6 py-4 whitespace-nowrap">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
