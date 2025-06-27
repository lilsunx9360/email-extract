
import React from 'react';

const Button = ({ onClick, loading, children }) => {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`w-full py-2 px-4 rounded-md text-white font-semibold ${
        loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
      }`}
    >
      {loading ? 'Scraping...' : children}
    </button>
  );
};

export default Button;