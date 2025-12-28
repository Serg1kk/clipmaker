import { useState } from 'react';
import RenderCard from '../components/RenderCard';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal';
import { useRenders } from '../hooks/useRenders';
import type { Render } from '../hooks/useRenders';

const Renders = () => {
  const { renders, loading, error, refetch, deleteRender, streamUrl, downloadUrl } = useRenders();

  // Delete modal state
  const [renderToDelete, setRenderToDelete] = useState<Render | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleView = (render: Render) => {
    // Open video in new tab
    window.open(streamUrl(render.id), '_blank');
  };

  const handleDownload = (render: Render) => {
    // Trigger download
    const link = document.createElement('a');
    link.href = downloadUrl(render.id);
    link.download = '';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDeleteClick = (render: Render) => {
    setRenderToDelete(render);
  };

  const handleConfirmDelete = async () => {
    if (!renderToDelete) return;

    setIsDeleting(true);
    const success = await deleteRender(renderToDelete.id);
    setIsDeleting(false);

    if (success) {
      setRenderToDelete(null);
    }
  };

  const handleCancelDelete = () => {
    if (!isDeleting) {
      setRenderToDelete(null);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="max-w-6xl">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-white">Renders</h1>
        </div>

        <div className="flex items-center justify-center min-h-[300px]">
          <div className="text-center">
            <svg
              className="w-12 h-12 text-purple-500 animate-spin mx-auto mb-4"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <p className="text-gray-400">Loading renders...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="max-w-6xl">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-white">Renders</h1>
        </div>

        <div className="bg-red-900/30 border border-red-700 rounded-lg p-8 text-center">
          <svg
            className="w-12 h-12 text-red-400 mx-auto mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h3 className="text-xl font-medium text-white mb-2">
            Failed to load renders
          </h3>
          <p className="text-gray-400 mb-4">{error}</p>
          <button
            onClick={refetch}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Renders</h1>
          <p className="text-gray-400 mt-1">
            {renders.length} {renders.length === 1 ? 'render' : 'renders'}
          </p>
        </div>

        {renders.length > 0 && (
          <button
            onClick={refetch}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Refresh
          </button>
        )}
      </div>

      {/* Empty state */}
      {renders.length === 0 ? (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-12 text-center">
          <svg
            className="w-16 h-16 text-gray-600 mx-auto mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
          <h3 className="text-xl font-medium text-gray-300 mb-2">
            No renders yet
          </h3>
          <p className="text-gray-500">
            Rendered clips will appear here. Go to a project and render a moment to get started.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...renders]
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .map((render) => (
            <RenderCard
              key={render.id}
              render={render}
              onView={handleView}
              onDownload={handleDownload}
              onDelete={handleDeleteClick}
            />
          ))}
        </div>
      )}

      {/* Delete confirmation modal */}
      <ConfirmDeleteModal
        isOpen={renderToDelete !== null}
        projectName={renderToDelete ? `render from "${renderToDelete.project_name}"` : ''}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        isDeleting={isDeleting}
      />
    </div>
  );
};

export default Renders;
