/**
 * Loading state for Driver Progress page
 */

export default function DriverProgressLoading() {
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb skeleton */}
        <div className="mb-6">
          <div className="h-6 w-48 bg-gray-800 animate-pulse rounded"></div>
        </div>

        {/* Header skeleton */}
        <div className="mb-8">
          <div className="h-9 w-64 bg-gray-800 animate-pulse rounded mb-3"></div>
          <div className="h-5 w-48 bg-gray-800 animate-pulse rounded"></div>
        </div>

        {/* Stats skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-gray-800 rounded-lg border border-gray-700 p-4 md:p-6">
              <div className="h-4 w-24 bg-gray-700 animate-pulse rounded mb-3"></div>
              <div className="h-8 w-16 bg-gray-700 animate-pulse rounded"></div>
            </div>
          ))}
        </div>

        {/* Filter buttons skeleton */}
        <div className="mb-6">
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-10 w-28 bg-gray-800 animate-pulse rounded-lg"></div>
            ))}
          </div>
        </div>

        {/* Table skeleton */}
        <div>
          <div className="h-7 w-40 bg-gray-800 animate-pulse rounded mb-4"></div>
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-16 bg-gray-700 animate-pulse rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
