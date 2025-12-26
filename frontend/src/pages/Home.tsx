const Home = () => {
  return (
    <div className="max-w-4xl">
      <h1 className="text-3xl font-bold text-white mb-6">
        Welcome to AI Clips
      </h1>

      <p className="text-gray-300 text-lg mb-8">
        AI-powered video transcription and clip generation platform.
        Create, manage, and export video clips with intelligent transcription.
      </p>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h3 className="text-gray-400 text-sm font-medium mb-2">
            Total Projects
          </h3>
          <p className="text-3xl font-bold text-white">0</p>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h3 className="text-gray-400 text-sm font-medium mb-2">
            Total Clips
          </h3>
          <p className="text-3xl font-bold text-white">0</p>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h3 className="text-gray-400 text-sm font-medium mb-2">
            Processing Time
          </h3>
          <p className="text-3xl font-bold text-white">0h</p>
        </div>
      </div>

      {/* Getting Started */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h2 className="text-xl font-semibold text-white mb-4">
          Getting Started
        </h2>
        <ol className="space-y-3 text-gray-300">
          <li className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
              1
            </span>
            <span>Create a new project from the Projects page</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
              2
            </span>
            <span>Upload your video file for transcription</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
              3
            </span>
            <span>Select moments and generate clips</span>
          </li>
        </ol>
      </div>
    </div>
  );
};

export default Home;
